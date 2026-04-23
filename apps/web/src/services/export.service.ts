import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toPng } from "html-to-image";

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
    clients?: string[];
  }>;
}

interface OverviewMetric {
  title: string;
  value: string | number;
  change?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
}

interface OverviewExportData {
  metrics: OverviewMetric[];
  projectDetails: AnalyticsData["projectDetails"];
  taskStatusData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  projectProgressData: Array<{
    name: string;
    progress: number;
    status: string;
    tasks: number;
    endDate?: string;
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
      p.clients?.join(", ") || "-",
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
          "Clients",
          "Heures",
          "Échéance",
        ],
      ],
      body: projectsData,
      theme: "striped",
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 22 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 28 },
        5: { cellWidth: 28 },
        6: { cellWidth: 25 },
        7: { cellWidth: 18 },
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
      "Clients",
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
      p.clients?.join(", ") || "",
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
      { wch: 25 },
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
   * Export Overview tab to a rich landscape PDF
   */
  static async exportOverviewToPDF(
    data: OverviewExportData,
    dateRange: string,
    selectedProject?: string,
    progressChartElement?: HTMLElement | null,
  ): Promise<void> {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let currentY = 20;

    const colorRgbMap: Record<string, [number, number, number]> = {
      primary: [59, 130, 246],
      secondary: [107, 114, 128],
      success: [34, 197, 94],
      warning: [234, 179, 8],
      error: [239, 68, 68],
      info: [6, 182, 212],
    };

    const now = new Date();

    // --- Header ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Rapports & Analytics — Vue d'ensemble", pageWidth / 2, currentY, {
      align: "center",
    });

    currentY += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Généré le ${format(now, "dd MMMM yyyy à HH:mm", { locale: fr })}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 5;
    doc.text(
      `Période: ${this.translateDateRange(dateRange)}${selectedProject ? " — Projet spécifique" : ""}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 12;

    // --- KPI Cards ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Indicateurs Clés", marginLeft, currentY);
    currentY += 8;

    const cardGap = 3;
    const cardCount = Math.min(data.metrics.length, 4);
    const cardWidth = (contentWidth - cardGap * (cardCount - 1)) / cardCount;
    const cardHeight = 28;

    for (let i = 0; i < cardCount; i++) {
      const metric = data.metrics[i];
      const x = marginLeft + i * (cardWidth + cardGap);
      const color =
        colorRgbMap[metric.color || "primary"] || colorRgbMap.primary;

      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, "F");

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(String(metric.value), x + cardWidth / 2, currentY + 11, {
        align: "center",
      });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(metric.title, x + cardWidth / 2, currentY + 18, {
        align: "center",
      });

      if (metric.change) {
        doc.setFontSize(7);
        doc.text(metric.change, x + cardWidth / 2, currentY + 24, {
          align: "center",
        });
      }
    }

    currentY += cardHeight + 10;

    // --- Task Status ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Volumes par statut", marginLeft, currentY);
    currentY += 8;

    const totalTasks = data.taskStatusData.reduce((s, t) => s + t.value, 0);
    const statusItemWidth =
      contentWidth / Math.max(data.taskStatusData.length, 1);

    data.taskStatusData.forEach((status, i) => {
      const x = marginLeft + i * statusItemWidth;
      const pct =
        totalTasks > 0 ? ((status.value / totalTasks) * 100).toFixed(1) : "0";

      const hexColor = status.color.replace("#", "");
      const r = parseInt(hexColor.substring(0, 2), 16) || 100;
      const g = parseInt(hexColor.substring(2, 4), 16) || 100;
      const b = parseInt(hexColor.substring(4, 6), 16) || 100;
      doc.setFillColor(r, g, b);
      doc.circle(x + 4, currentY + 2, 2.5, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(String(status.value), x + 10, currentY + 4);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`${status.name} (${pct}%)`, x + 10, currentY + 9);
    });

    currentY += 16;

    // --- Project Progress ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Progression des projets", marginLeft, currentY);
    currentY += 8;

    let chartRendered = false;

    if (progressChartElement) {
      try {
        const dataUrl = await toPng(progressChartElement, {
          cacheBust: true,
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });
        const imgProps = doc.getImageProperties(dataUrl);
        const imgWidth = contentWidth;
        const imgHeight = (imgProps.height / imgProps.width) * imgWidth;

        if (currentY + imgHeight > pageHeight - 20) {
          doc.addPage();
          currentY = 20;
        }

        doc.addImage(dataUrl, "PNG", marginLeft, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 8;
        chartRendered = true;
      } catch (err) {
        console.warn("Chart capture failed, falling back to table:", err);
      }
    }

    if (!chartRendered) {
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
      }

      autoTable(doc, {
        startY: currentY,
        head: [["Projet", "Progression", "Statut", "Tâches", "Échéance"]],
        body: data.projectProgressData.map((p) => [
          p.name,
          `${p.progress}%`,
          p.status,
          String(p.tasks),
          p.endDate ? format(new Date(p.endDate), "dd/MM/yyyy") : "-",
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });

      currentY =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 10;
    }

    // --- Projects Table ---
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Détail des Projets", marginLeft, currentY);
    currentY += 8;

    const projectsData = data.projectDetails.map((p) => [
      p.name,
      p.status,
      `${p.progress}%`,
      `${p.completedTasks}/${p.totalTasks}`,
      p.projectManager || "-",
      `${p.loggedHours}h / ${p.budgetHours}h`,
      p.dueDate ? format(new Date(p.dueDate), "dd/MM/yyyy") : "-",
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
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 45 },
        5: { cellWidth: 40 },
        6: { cellWidth: 30 },
      },
    });

    // --- Footer ---
    const pageCount = doc.internal.pages.length - 1;
    const footerY = pageHeight - 10;
    const footerTimestamp = format(now, "dd/MM/yyyy HH:mm");

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128);
      doc.text(
        `Généré par Orchestr'A — ${footerTimestamp}`,
        marginLeft,
        footerY,
      );
      doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, footerY, {
        align: "center",
      });
    }

    const filename = `orchestr-a-vue-ensemble-${format(now, "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
  }

  /**
   * Export Gantt Portfolio to a landscape PDF (single page)
   */
  static async exportGanttPortfolioToPDF(
    ganttElement: HTMLElement,
    dateRange: string,
  ): Promise<void> {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const now = new Date();

    // --- Header ---
    let currentY = margin + 8;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(
      "Gantt Portfolio — Vue d'ensemble des Projets",
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(
      `Période : ${this.translateDateRange(dateRange)}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 5;
    doc.text(
      `Généré le ${format(now, "dd/MM/yyyy à HH:mm", { locale: fr })}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 6;

    // --- Capture the Gantt element ---
    // Temporarily expand the container so the full Gantt is captured (no overflow clipping)
    // Remove overflow clipping from both the scroll container (.overflow-auto)
    // and the rounded-corner clip container (.overflow-hidden) so the full Gantt is captured
    const overflowEls = ganttElement.querySelectorAll<HTMLElement>(
      ".overflow-auto, .overflow-hidden",
    );
    const savedStyles: { el: HTMLElement; overflow: string; height: string }[] =
      [];
    overflowEls.forEach((el) => {
      savedStyles.push({
        el,
        overflow: el.style.overflow,
        height: el.style.height,
      });
      el.style.overflow = "visible";
      el.style.height = "auto";
    });

    try {
      const dataUrl = await toPng(ganttElement, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const imgProps = doc.getImageProperties(dataUrl);
      const availableHeight = pageHeight - currentY - 12; // 12mm for footer
      const availableWidth = contentWidth;

      // Scale to fit within the available area
      const imgAspect = imgProps.width / imgProps.height;
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / imgAspect;

      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspect;
      }

      // Center horizontally
      const imgX = margin + (availableWidth - imgWidth) / 2;

      doc.addImage(dataUrl, "PNG", imgX, currentY, imgWidth, imgHeight);
    } finally {
      // Restore overflow
      savedStyles.forEach(({ el, overflow, height }) => {
        el.style.overflow = overflow;
        el.style.height = height;
      });
    }

    // --- Footer ---
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128);
    const footerY = pageHeight - margin;
    doc.text(
      `Orchestr'A — ${format(now, "dd/MM/yyyy HH:mm")}`,
      margin,
      footerY,
    );
    doc.text("Page 1 / 1", pageWidth / 2, footerY, { align: "center" });

    const filename = `orchestr-a-gantt-portfolio-${format(now, "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
  }

  /**
   * Export clients list to PDF
   */
  static exportClientsToPDF(
    clients: Array<{
      id: string;
      name: string;
      isActive: boolean;
      createdAt: string;
      projectsCount: number;
    }>,
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    let currentY = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Référentiel Clients — ORCHESTR'A", pageWidth / 2, currentY, {
      align: "center",
    });

    currentY += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Généré le ${format(now, "dd MMMM yyyy à HH:mm", { locale: fr })}`,
      pageWidth / 2,
      currentY,
      { align: "center" },
    );

    currentY += 12;

    autoTable(doc, {
      startY: currentY,
      head: [["Nom", "Statut", "Projets", "Créé le"]],
      body: clients.map((c) => [
        c.name,
        c.isActive ? "Actif" : "Archivé",
        String(c.projectsCount),
        format(new Date(c.createdAt), "dd/MM/yyyy"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
      },
    });

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
    }

    doc.save(`orchestr-a-clients-${format(now, "yyyy-MM-dd-HHmm")}.pdf`);
  }

  /**
   * Export clients list to Excel (2 sheets: Clients + Projets par client)
   */
  static exportClientsToExcel(
    clients: Array<{
      id: string;
      name: string;
      isActive: boolean;
      createdAt: string;
      projectsCount: number;
    }>,
    projectsByClient: Array<{
      clientId: string;
      clientName: string;
      projectId: string;
      projectName: string;
      projectStatus: string;
    }>,
  ): void {
    const now = new Date();
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Clients
    const clientsHeader = ["ID", "Nom", "Statut", "Nb Projets", "Créé le"];
    const clientsRows = clients.map((c) => [
      c.id,
      c.name,
      c.isActive ? "Actif" : "Archivé",
      c.projectsCount,
      format(new Date(c.createdAt), "dd/MM/yyyy"),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([clientsHeader, ...clientsRows]);
    ws1["!cols"] = [
      { wch: 36 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws1, "Clients");

    // Sheet 2: Projets par client
    const projectsHeader = ["Client", "Projet", "Statut Projet"];
    const projectsRows = projectsByClient.map((r) => [
      r.clientName,
      r.projectName,
      r.projectStatus,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([projectsHeader, ...projectsRows]);
    ws2["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, ws2, "Projets par client");

    XLSX.writeFile(
      workbook,
      `orchestr-a-clients-${format(now, "yyyy-MM-dd-HHmm")}.xlsx`,
    );
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
