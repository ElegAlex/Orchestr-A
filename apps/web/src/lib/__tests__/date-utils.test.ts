import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDateRelative,
  formatDateShort,
  formatDateLong,
  getDateLocale,
} from "../date-utils";

// Mock du store settings
jest.mock("@/stores/settings.store", () => ({
  useSettingsStore: Object.assign(
    jest.fn(() => ({
      getSetting: jest.fn((key: string, defaultValue: string) => {
        const defaults: Record<string, string> = {
          dateFormat: "dd/MM/yyyy",
          timeFormat: "HH:mm",
          dateTimeFormat: "dd/MM/yyyy HH:mm",
          locale: "fr-FR",
        };
        return defaults[key] ?? defaultValue;
      }),
    })),
    {
      getState: jest.fn(() => ({
        getSetting: (key: string, defaultValue: string) => {
          const defaults: Record<string, string> = {
            dateFormat: "dd/MM/yyyy",
            timeFormat: "HH:mm",
            dateTimeFormat: "dd/MM/yyyy HH:mm",
            locale: "fr-FR",
          };
          return defaults[key] ?? defaultValue;
        },
      })),
    },
  ),
}));

describe("date-utils", () => {
  describe("getDateLocale", () => {
    it("should return French locale by default", () => {
      const locale = getDateLocale();
      expect(locale.code).toBe("fr");
    });
  });

  describe("formatDate", () => {
    it("should return empty string for null date", () => {
      expect(formatDate(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatDate(undefined)).toBe("");
    });

    it("should return empty string for invalid date string", () => {
      expect(formatDate("invalid-date")).toBe("");
    });

    it("should format Date object correctly", () => {
      const date = new Date(2025, 0, 15); // 15 janvier 2025
      const result = formatDate(date);
      expect(result).toBe("15/01/2025");
    });

    it("should format ISO string correctly", () => {
      const result = formatDate("2025-01-15");
      expect(result).toBe("15/01/2025");
    });

    it("should use custom format string when provided", () => {
      const date = new Date(2025, 0, 15);
      const result = formatDate(date, "yyyy-MM-dd");
      expect(result).toBe("2025-01-15");
    });

    it("should handle date with time in ISO string", () => {
      const result = formatDate("2025-01-15T10:30:00");
      expect(result).toBe("15/01/2025");
    });
  });

  describe("formatDateTime", () => {
    it("should return empty string for null date", () => {
      expect(formatDateTime(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatDateTime(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDateTime("not-a-date")).toBe("");
    });

    it("should format date with time correctly", () => {
      const date = new Date(2025, 0, 15, 10, 30);
      const result = formatDateTime(date);
      expect(result).toBe("15/01/2025 10:30");
    });

    it("should parse ISO string with time", () => {
      const result = formatDateTime("2025-01-15T14:45:00");
      expect(result).toBe("15/01/2025 14:45");
    });

    it("should use custom format when provided", () => {
      const date = new Date(2025, 0, 15, 10, 30);
      const result = formatDateTime(date, "HH:mm dd/MM/yyyy");
      expect(result).toBe("10:30 15/01/2025");
    });
  });

  describe("formatTime", () => {
    it("should return empty string for null date", () => {
      expect(formatTime(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatTime(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatTime("invalid")).toBe("");
    });

    it("should format time correctly", () => {
      const date = new Date(2025, 0, 15, 14, 30);
      const result = formatTime(date);
      expect(result).toBe("14:30");
    });

    it("should parse ISO string and extract time", () => {
      const result = formatTime("2025-01-15T09:15:00");
      expect(result).toBe("09:15");
    });

    it("should use custom format when provided", () => {
      const date = new Date(2025, 0, 15, 14, 30, 45);
      const result = formatTime(date, "HH:mm:ss");
      expect(result).toBe("14:30:45");
    });
  });

  describe("formatDateRelative", () => {
    it("should return empty string for null date", () => {
      expect(formatDateRelative(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatDateRelative(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDateRelative("xyz")).toBe("");
    });

    it("should format date with weekday and month in French", () => {
      const date = new Date(2025, 0, 15); // mercredi 15 janvier
      const result = formatDateRelative(date);
      expect(result).toMatch(/mercredi/i);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/janvier/i);
    });

    it("should parse ISO string and format correctly", () => {
      const result = formatDateRelative("2025-06-01"); // dimanche 1 juin
      expect(result).toMatch(/1/);
      expect(result).toMatch(/juin/i);
    });
  });

  describe("formatDateShort", () => {
    it("should return empty string for null date", () => {
      expect(formatDateShort(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatDateShort(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDateShort("bad")).toBe("");
    });

    it("should format date in short format (day + month abbrev)", () => {
      const date = new Date(2025, 0, 15);
      const result = formatDateShort(date);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/janv/i);
    });

    it("should handle ISO string", () => {
      const result = formatDateShort("2025-12-25");
      expect(result).toMatch(/25/);
      expect(result).toMatch(/déc/i);
    });
  });

  describe("formatDateLong", () => {
    it("should return empty string for null date", () => {
      expect(formatDateLong(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatDateLong(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDateLong("not valid")).toBe("");
    });

    it("should format date in long format (day month year)", () => {
      const date = new Date(2025, 0, 15);
      const result = formatDateLong(date);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/janvier/i);
      expect(result).toMatch(/2025/);
    });

    it("should handle ISO string", () => {
      const result = formatDateLong("2025-06-20");
      expect(result).toMatch(/20/);
      expect(result).toMatch(/juin/i);
      expect(result).toMatch(/2025/);
    });
  });

  describe("Edge cases", () => {
    it("should handle dates at midnight", () => {
      const date = new Date(2025, 5, 15, 0, 0, 0);
      expect(formatDate(date)).toBe("15/06/2025");
      expect(formatTime(date)).toBe("00:00");
    });

    it("should handle dates at end of day", () => {
      const date = new Date(2025, 5, 15, 23, 59, 59);
      expect(formatDate(date)).toBe("15/06/2025");
      expect(formatTime(date)).toBe("23:59");
    });

    it("should handle leap year date", () => {
      const date = new Date(2024, 1, 29); // 29 février 2024
      expect(formatDate(date)).toBe("29/02/2024");
    });

    it("should handle year boundary", () => {
      const date = new Date(2024, 11, 31); // 31 décembre 2024
      expect(formatDate(date)).toBe("31/12/2024");
    });

    it("should handle first day of year", () => {
      const date = new Date(2025, 0, 1);
      expect(formatDate(date)).toBe("01/01/2025");
    });
  });
});
