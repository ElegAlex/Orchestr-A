import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

// Use NEXT_PUBLIC_API_URL directly (should be "/api" or "https://domain.com/api")
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token + fix Content-Type for FormData
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let Axios set the correct Content-Type for FormData (multipart/form-data with boundary)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function clearAuthAndRedirect() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("auth_user_display");
  localStorage.removeItem("user"); // legacy pre-SEC-03 key
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:cleared"));
    window.location.href = "/login";
  }
}

// Deduplicate concurrent refresh attempts — only one in-flight at a time.
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error("no refresh token");
  }
  // Use a plain axios call (NOT the `api` instance) to avoid interceptor recursion.
  const response = await axios.post<{
    access_token: string;
    refresh_token: string;
  }>(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 },
  );
  const { access_token, refresh_token } = response.data;
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  if (refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  }
  return access_token;
}

export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isRefreshRequest(config?: AxiosRequestConfig): boolean {
  const url = config?.url || "";
  return url.includes("/auth/refresh");
}

// Response interceptor - attempt auto-refresh on 401, then retry original request.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as RetriableConfig | undefined;

    if (error.response?.status !== 401 || !originalConfig) {
      return Promise.reject(error);
    }

    // Don't try to refresh the refresh endpoint itself, and avoid infinite loops.
    if (isRefreshRequest(originalConfig) || originalConfig._retry) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    originalConfig._retry = true;
    try {
      const newAccessToken = await refreshAccessToken();
      originalConfig.headers = originalConfig.headers ?? {};
      (originalConfig.headers as Record<string, string>).Authorization =
        `Bearer ${newAccessToken}`;
      return api.request(originalConfig);
    } catch {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }
  },
);

export default api;
