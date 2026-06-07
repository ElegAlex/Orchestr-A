jest.mock("jspdf", () => {
  return jest.fn().mockImplementation(() => ({
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      pages: [1, 2],
    },
    lastAutoTable: { finalY: 0 },
    text: jest.fn(),
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    setTextColor: jest.fn(),
    setPage: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
  }));
});

jest.mock("jspdf-autotable", () => jest.fn());

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ExportService } from "../export.service";

/** Helper: get the HTML string from the Blob passed to createObjectURL.
 *  Uses FileReader because jsdom's Blob.text() is not available in all versions.
 */
function getBlobHtml(createObjectURL: jest.Mock): Promise<string> {
  const blob: Blob = createObjectURL.mock.calls[0][0];
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Parse the HTML string and return all h2 text content (sheet names) */
function getSheetNames(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("h2")).map(
    (el) => el.textContent ?? "",
  );
}

/** Return all th texts from the section whose h2 matches sheetName */
function getHeaders(html: string, sheetName: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("section"));
  const section = sections.find(
    (s) => s.querySelector("h2")?.textContent === sheetName,
  );
  if (!section) return [];
  return Array.from(section.querySelectorAll("th")).map(
    (el) => el.textContent ?? "",
  );
}

/** Return all td texts from the first data row of the named sheet */
function getFirstDataRow(html: string, sheetName: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("section"));
  const section = sections.find(
    (s) => s.querySelector("h2")?.textContent === sheetName,
  );
  if (!section) return [];
  const rows = section.querySelectorAll("tr");
  // row 0 = header (th); row 1 = first data row (td)
  const dataRow = rows[1];
  if (!dataRow) return [];
  return Array.from(dataRow.querySelectorAll("td")).map(
    (el) => el.textContent ?? "",
  );
}

/** Count data rows (tr rows that contain td, not th) in a named sheet */
function countDataRows(html: string, sheetName: string): number {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("section"));
  const section = sections.find(
    (s) => s.querySelector("h2")?.textContent === sheetName,
  );
  if (!section) return 0;
  return Array.from(section.querySelectorAll("tr")).filter((row) =>
    row.querySelector("td"),
  ).length;
}

describe("ExportService", () => {
  const createObjectURL = jest.fn(() => "blob:export");
  const revokeObjectURL = jest.fn();
  const click = jest.fn();

  const mockAnalyticsData = {
    metrics: [
      { title: "Total Projects", value: 10, change: "+5%" },
      { title: "Total Tasks", value: 50, change: "+10%" },
    ],
    projectDetails: [
      {
        id: "project-1",
        name: "Project 1",
        code: "PRJ-001",
        status: "ACTIVE",
        progress: 50,
        totalTasks: 10,
        completedTasks: 5,
        projectManager: "John Doe",
        loggedHours: 100,
        budgetHours: 200,
        startDate: "2025-01-01",
        dueDate: "2025-12-31",
        isOverdue: false,
      },
      {
        id: "project-2",
        name: "Project 2",
        code: "PRJ-002",
        status: "ACTIVE",
        progress: 75,
        totalTasks: 20,
        completedTasks: 15,
        projectManager: "Jane Smith",
        loggedHours: 150,
        budgetHours: 180,
        startDate: "2025-02-01",
        dueDate: "2025-06-30",
        isOverdue: true,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        tagName,
      ) as HTMLAnchorElement;
      if (tagName === "a") {
        element.click = click;
      }
      return element;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("exportToPDF", () => {
    it("should call jsPDF and autoTable with metrics data", async () => {
      await ExportService.exportToPDF(mockAnalyticsData, "month");
      const jsPDFInstance = (jsPDF as jest.Mock).mock.results[0].value;
      // doc.text should have been called (title, date, period, section headings)
      expect(jsPDFInstance.text).toHaveBeenCalled();
      // autoTable should have been called at least twice: metrics + projects
      expect(autoTable as jest.Mock).toHaveBeenCalledTimes(2);
      // doc.save should have been called once
      expect(jsPDFInstance.save).toHaveBeenCalledTimes(1);
    });

    it("should pass metrics rows to the first autoTable call", async () => {
      await ExportService.exportToPDF(mockAnalyticsData, "month");
      const calls = (autoTable as jest.Mock).mock.calls;
      // First call: metrics table — body should contain the 2 metrics
      const metricsBody: string[][] = calls[0][1].body;
      expect(metricsBody).toHaveLength(2);
      expect(metricsBody[0]).toEqual(["Total Projects", "10", "+5%"]);
      expect(metricsBody[1]).toEqual(["Total Tasks", "50", "+10%"]);
    });

    it("should pass project rows to the second autoTable call", async () => {
      await ExportService.exportToPDF(
        mockAnalyticsData,
        "quarter",
        "project-1",
      );
      const calls = (autoTable as jest.Mock).mock.calls;
      // Second call: projects table — body should contain 2 project rows
      const projectsBody: string[][] = calls[1][1].body;
      expect(projectsBody).toHaveLength(2);
      // First column is project name
      expect(projectsBody[0][0]).toBe("Project 1");
      expect(projectsBody[1][0]).toBe("Project 2");
    });

    it("should handle different date ranges without error", async () => {
      await ExportService.exportToPDF(mockAnalyticsData, "week");
      await ExportService.exportToPDF(mockAnalyticsData, "year");
      // 2 calls each with 2 autoTable calls = 4 total
      expect((autoTable as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
        4,
      );
    });
  });

  describe("exportToExcel", () => {
    it("should produce a Blob with exactly 3 named sheets", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      const html = await getBlobHtml(createObjectURL);
      const sheetNames = getSheetNames(html);
      expect(sheetNames).toHaveLength(3);
      expect(sheetNames).toEqual(["Indicateurs", "Projets", "Statistiques"]);
    });

    it("should include all project column headers in the Projets sheet", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      const html = await getBlobHtml(createObjectURL);
      const headers = getHeaders(html, "Projets");
      expect(headers).toContain("Code");
      expect(headers).toContain("Nom");
      expect(headers).toContain("Statut");
      expect(headers).toContain("Progression (%)");
      expect(headers).toContain("Chef de Projet");
      expect(headers).toContain("Date Début");
    });

    it("should write one data row per project in the Projets sheet", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      const html = await getBlobHtml(createObjectURL);
      // 2 projects in mockAnalyticsData → 2 data rows
      expect(countDataRows(html, "Projets")).toBe(2);
    });

    it("should write correct project values in first data row", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      const html = await getBlobHtml(createObjectURL);
      const firstRow = getFirstDataRow(html, "Projets");
      // code=PRJ-001, name=Project 1, status=ACTIVE
      expect(firstRow[0]).toBe("PRJ-001");
      expect(firstRow[1]).toBe("Project 1");
      expect(firstRow[2]).toBe("ACTIVE");
    });

    it("should write metrics rows in the Indicateurs sheet", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      const html = await getBlobHtml(createObjectURL);
      // The Indicateurs sheet has a multi-row layout; check at least 2 data rows with metric values
      expect(countDataRows(html, "Indicateurs")).toBeGreaterThanOrEqual(2);
    });

    it("should still invoke browser download side-effects", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "month");
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    });

    it("should handle different date ranges", async () => {
      await ExportService.exportToExcel(mockAnalyticsData, "week");
      const htmlWeek = await getBlobHtml(createObjectURL);
      expect(getSheetNames(htmlWeek)).toHaveLength(3);

      jest.clearAllMocks();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: createObjectURL,
      });
      await ExportService.exportToExcel(mockAnalyticsData, "quarter");
      const htmlQuarter = await getBlobHtml(createObjectURL);
      expect(getSheetNames(htmlQuarter)).toHaveLength(3);
    });

    it("should handle projects with no manager", async () => {
      const dataWithNoManager = {
        ...mockAnalyticsData,
        projectDetails: [
          {
            ...mockAnalyticsData.projectDetails[0],
            projectManager: undefined,
          },
        ],
      };
      await ExportService.exportToExcel(dataWithNoManager, "month");
      const html = await getBlobHtml(createObjectURL);
      expect(countDataRows(html, "Projets")).toBe(1);
    });

    it("should handle projects with no due date", async () => {
      const dataWithNoDueDate = {
        ...mockAnalyticsData,
        projectDetails: [
          {
            ...mockAnalyticsData.projectDetails[0],
            dueDate: undefined,
          },
        ],
      };
      await ExportService.exportToExcel(dataWithNoDueDate, "month");
      const html = await getBlobHtml(createObjectURL);
      expect(countDataRows(html, "Projets")).toBe(1);
    });
  });
});
