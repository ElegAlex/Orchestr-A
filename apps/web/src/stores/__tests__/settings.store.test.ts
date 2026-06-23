import { useSettingsStore } from "../settings.store";

// Mock the API-backed service so the store can be driven in isolation.
jest.mock("@/services/settings.service", () => ({
  settingsService: {
    getAll: jest.fn(),
    getPublic: jest.fn(),
    update: jest.fn(),
  },
}));

import { settingsService } from "@/services/settings.service";

const mockedGetPublic = settingsService.getPublic as jest.Mock;

describe("useSettingsStore.fetchPublicSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      settings: { "planning.visibleDays": [1, 2, 3, 4, 5] },
      isLoading: false,
      isLoaded: false,
      error: null,
    });
  });

  // Low-privilege roles (no settings:read) must still receive the
  // admin-defined visible days instead of the hardcoded Mon–Fri default.
  it("merges the public projection over defaults and marks loaded", async () => {
    mockedGetPublic.mockResolvedValue({
      settings: {
        "planning.visibleDays": [1, 2, 3, 4, 5, 6],
        "planning.specialDays": [6],
        dateFormat: "dd/MM/yyyy",
      },
    });

    await useSettingsStore.getState().fetchPublicSettings();

    const state = useSettingsStore.getState();
    expect(state.settings["planning.visibleDays"]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(state.settings["planning.specialDays"]).toEqual([6]);
    // A default key not returned by the server is preserved from DEFAULT_SETTINGS.
    expect(state.settings["timeFormat"]).toBe("HH:mm");
    expect(state.isLoaded).toBe(true);
    expect(state.error).toBeNull();
  });

  it("falls back to defaults and still marks loaded on error", async () => {
    mockedGetPublic.mockRejectedValue(new Error("network"));

    await useSettingsStore.getState().fetchPublicSettings();

    const state = useSettingsStore.getState();
    expect(state.settings["planning.visibleDays"]).toEqual([1, 2, 3, 4, 5]);
    expect(state.isLoaded).toBe(true);
    expect(state.error).toBe("network");
  });
});
