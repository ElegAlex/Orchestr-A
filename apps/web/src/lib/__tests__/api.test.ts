/**
 * Tests for the axios instance interceptors in @/lib/api.
 *
 * We verify the SEC-04 refresh flow: on 401 the interceptor calls
 * /auth/refresh, stores the new tokens, retries the original request, and
 * deduplicates concurrent refresh attempts behind a single promise.
 */

type AxiosConfig = { url: string; headers: Record<string, string>; data?: unknown };
type AxiosResult = { data: unknown; config?: AxiosConfig };
type MockAxios = {
  create: jest.Mock;
  post: jest.Mock;
  default: MockAxios;
};

// Mock localStorage (jsdom provides one, but we want spies)
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((k: string) => store[k] ?? null),
  setItem: jest.fn((k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: jest.fn((k: string) => {
    delete store[k];
  }),
  clear: jest.fn(() => {
    store = {};
  }),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Silence navigation
const originalLocation = window.location;
beforeAll(() => {
  // @ts-expect-error — overriding read-only window.location for test isolation
  delete window.location;
  // @ts-expect-error — stub minimal Location shape (test only reads/writes href)
  window.location = { href: "" };
});
afterAll(() => {
  // @ts-expect-error — restoring original Location instance
  window.location = originalLocation;
});

describe("api interceptors (SEC-04 refresh flow)", () => {
  beforeEach(() => {
    jest.resetModules();
    store = {};
    jest.clearAllMocks();
  });

  function loadApi(opts: {
    onRequest?: (cfg: AxiosConfig) => Promise<AxiosResult>;
    onRefresh?: (body: unknown) => Promise<AxiosResult>;
  }) {
    jest.isolateModules(() => {});
    const requestHandler = opts.onRequest ?? (async () => ({ data: "ok" }));
    const refreshHandler =
      opts.onRefresh ??
      (async () => ({
        data: { access_token: "new-at", refresh_token: "new-rt" },
      }));

    const instancePost = jest.fn().mockImplementation(async (url: string, body: unknown) => {
      return requestHandler({ url, data: body, headers: {} });
    });
    const instanceRequest = jest.fn().mockImplementation(async (cfg: AxiosConfig) => {
      return requestHandler(cfg);
    });
    const instance = {
      post: instancePost,
      request: instanceRequest,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    jest.doMock("axios", () => {
      const mockAxios: MockAxios = {
        create: jest.fn(() => instance),
        post: jest.fn().mockImplementation(async (_url: string, body: unknown) => {
          return refreshHandler(body);
        }),
        default: undefined as unknown as MockAxios,
      };
      mockAxios.default = mockAxios;
      return mockAxios;
    });

    // Load module fresh
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("../api");

    // Capture the response interceptor the module registered
    const responseUse = instance.interceptors.response.use as jest.Mock;
    const responseErrorHandler = responseUse.mock.calls[0][1];

    return { api, instance, responseErrorHandler };
  }

  it("auto-refreshes on 401 and retries the original request", async () => {
    const { api, instance, responseErrorHandler } = loadApi({
      onRequest: async (cfg) => ({ data: "retried", config: cfg }),
    });
    store["refresh_token"] = "rt-1";

    const original = {
      url: "/some-endpoint",
      headers: {},
    };
    const err = {
      response: { status: 401 },
      config: original,
    };

    const result = await responseErrorHandler(err);
    expect(result.data).toBe("retried");
    // Refresh was stored
    expect(store["access_token"]).toBe("new-at");
    expect(store["refresh_token"]).toBe("new-rt");
    // Original retried via instance.request
    expect(instance.request).toHaveBeenCalledTimes(1);
    // axios.post called once for the refresh
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const axios = require("axios");
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain("/auth/refresh");
    expect(api).toBeDefined();
  });

  it("deduplicates concurrent 401s into a single refresh call", async () => {
    let resolveRefresh!: (v: AxiosResult) => void;
    const refreshPromise = new Promise<AxiosResult>((r) => {
      resolveRefresh = r;
    });
    const { responseErrorHandler, instance } = loadApi({
      onRequest: async () => ({ data: "retried" }),
      onRefresh: () => refreshPromise,
    });
    store["refresh_token"] = "rt-1";

    const p1 = responseErrorHandler({
      response: { status: 401 },
      config: { url: "/a", headers: {} },
    });
    const p2 = responseErrorHandler({
      response: { status: 401 },
      config: { url: "/b", headers: {} },
    });

    resolveRefresh({
      data: { access_token: "new-at", refresh_token: "new-rt" },
    });

    await Promise.all([p1, p2]);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const axios = require("axios");
    // Only ONE call to /auth/refresh for two concurrent 401s
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(instance.request).toHaveBeenCalledTimes(2);
  });

  it("clears auth and redirects when refresh fails", async () => {
    const { responseErrorHandler } = loadApi({
      onRefresh: async () => {
        throw new Error("refresh-failed");
      },
    });
    store["refresh_token"] = "rt-bad";
    store["access_token"] = "old-at";

    await expect(
      responseErrorHandler({
        response: { status: 401 },
        config: { url: "/x", headers: {} },
      }),
    ).rejects.toBeDefined();

    expect(store["access_token"]).toBeUndefined();
    expect(store["refresh_token"]).toBeUndefined();
  });

  it("clears auth when no refresh token is available", async () => {
    const { responseErrorHandler } = loadApi({});
    // no refresh_token in store
    store["access_token"] = "old-at";

    await expect(
      responseErrorHandler({
        response: { status: 401 },
        config: { url: "/x", headers: {} },
      }),
    ).rejects.toBeDefined();
    expect(store["access_token"]).toBeUndefined();
  });

  it("does not recurse when /auth/refresh itself returns 401", async () => {
    const { responseErrorHandler } = loadApi({});
    store["refresh_token"] = "rt-1";

    const err = {
      response: { status: 401 },
      config: { url: "/auth/refresh", headers: {} },
    };
    await expect(responseErrorHandler(err)).rejects.toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const axios = require("axios");
    // No refresh attempted since the failing request IS /auth/refresh
    expect(axios.post).not.toHaveBeenCalled();
  });
});
