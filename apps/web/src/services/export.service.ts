import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AnalyticsData {
  metrics: Array<{
    title: string;
    value: string | number;
    change?: string;
  }>;
  projectDetails: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
    projectManager?: string;
    loggedHours: number;
    budgetHours: number;
    startDate: string;
    dueDate?: string;
    isOverdue: boolean;
  }>;
}

export class ExportService {
  /**
   * Export analytics data to PDF
   */
  static async exportToPDF(
    data: AnalyticsData,
    dateRange: string,
    selectedProject?: string,
  ): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Rapport Analytics - ORCHESTR'A", pageWidth / 2, currentY, {
      align: "center",
    });

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Généré le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 5;
    doc.text(
      `Période: ${this.translateDateRange(dateRange)}${selectedProject && selectedProject !== "all" ? " - Projet spécifique" : ""}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 15;

    // Metrics Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("📊 Indicateurs Clés", 14, currentY);
    currentY += 10;

    const metricsData = data.metrics.map((m) => [
      m.title,
      String(m.value),
      m.change || "-",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Indicateur", "Valeur", "Évolution"]],
      body: metricsData,
      theme: "striped",
      headStyles: { fillColor: [102, 126, 234] },
    });

    currentY =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 15;

    // Projects Table
    if (currentY > 200) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("🎯 Détail des Projets", 14, currentY);
    currentY += 10;

    const projectsData = data.projectDetails.map((p) => [
      p.name,
      p.status,
      `${p.progress}%`,
      `${p.completedTasks}/${p.totalTasks}`,
      p.projectManager || "-",
      `${p.loggedHours}h / ${p.budgetHours}h`,
      p.isOverdue ? "⚠️ Retard" : "✅",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "Projet",
          "Statut",
          "Progression",
          "Tâches",
          "Manager",
          "Heures",
          "Échéance",
        ],
      ],
      body: projectsData,
      theme: "striped",
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 35 },
        5: { cellWidth: 30 },
        6: { cellWidth: 20 },
      },
    });

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} / ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" },
      );
      doc.text(
        "ORCHESTR'A V2 - Rapport généré automatiquement",
        14,
        doc.internal.pageSize.getHeight() - 10,
      );
    }

    // Save
    const filename = `orchestr-a-analytics-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
    doc.save(filename);
  }

  /**
   * Export analytics data to Excel
   */
  static async exportToExcel(
    data: AnalyticsData,
    dateRange: string,
  ): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Metrics
    const metricsData = [
      ["Rapport Analytics - ORCHESTR'A"],
      [`Généré le: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}`],
      [`Période: ${this.translateDateRange(dateRange)}`],
      [""],
      ["Indicateur", "Valeur", "Évolution"],
      ...data.metrics.map((m) => [m.title, m.value, m.change || ""]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(metricsData);

    // Styling: merge cells for title
    ws1["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    ];

    // Column widths
    ws1["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(workbook, ws1, "Indicateurs");

    // Sheet 2: Projects
    const projectsHeader = [
      "Code",
      "Nom",
      "Statut",
      "Progression (%)",
      "Tâches Complétées",
      "Tâches Totales",
      "Chef de Projet",
      "Heures Consommées",
      "Heures Budgétées",
      "Date Début",
      "Date Échéance",
      "En Retard",
    ];

    const projectsData = data.projectDetails.map((p) => [
      p.code,
      p.name,
      p.status,
      p.progress,
      p.completedTasks,
      p.totalTasks,
      p.projectManager || "",
      p.loggedHours,
      p.budgetHours,
      format(new Date(p.startDate), "dd/MM/yyyy"),
      p.dueDate ? format(new Date(p.dueDate), "dd/MM/yyyy") : "",
      p.isOverdue ? "Oui" : "Non",
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet([projectsHeader, ...projectsData]);

    // Column widths
    ws2["!cols"] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, ws2, "Projets");

    // Sheet 3: Summary Statistics
    const totalProjects = data.projectDetails.length;
    const activeProjects = data.projectDetails.filter((p) =>
      p.status.includes("ACTIVE"),
    ).length;
    const overdueProjects = data.projectDetails.filter(
      (p) => p.isOverdue,
    ).length;
    const totalTasks = data.projectDetails.reduce(
      (sum, p) => sum + p.totalTasks,
      0,
    );
    const completedTasks = data.projectDetails.reduce(
      (sum, p) => sum + p.completedTasks,
      0,
    );
    const totalLoggedHours = data.projectDetails.reduce(
      (sum, p) => sum + p.loggedHours,
      0,
    );
    const totalBudgetHours = data.projectDetails.reduce(
      (sum, p) => sum + p.budgetHours,
      0,
    );

    const summaryData = [
      ["Statistiques Globales"],
      [""],
      ["Métrique", "Valeur"],
      ["Total Projets", totalProjects],
      ["Projets Actifs", activeProjects],
      ["Projets en Retard", overdueProjects],
      [""],
      ["Total Tâches", totalTasks],
      ["Tâches Complétées", completedTasks],
      [
        "Taux de Complétion (%)",
        totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
      ],
      [""],
      ["Heures Consommées", totalLoggedHours],
      ["Heures Budgétées", totalBudgetHours],
      [
        "Utilisation Budget (%)",
        totalBudgetHours > 0
          ? ((totalLoggedHours / totalBudgetHours) * 100).toFixed(1)
          : 0,
      ],
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(summaryData);
    ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ws3["!cols"] = [{ wch: 30 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(workbook, ws3, "Statistiques");

    // Save
    const filename = `orchestr-a-analytics-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Translate date range to French
   */
  private static translateDateRange(dateRange: string): string {
    const ranges: Record<string, string> = {
      week: "Cette semaine",
      month: "Ce mois",
      quarter: "Ce trimestre",
      year: "Cette année",
    };
    return ranges[dateRange] || dateRange;
  }
}
