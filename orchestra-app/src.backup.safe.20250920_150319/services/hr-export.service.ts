import { 
  LeaveRequest, 
  User, 
  DatePeriod,
  LeaveType 
} from '../types';
import { 
  hrAnalyticsService, 
  HRMetrics 
} from './hr-analytics.service';
import { leaveService } from './leave.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Types pour l'export
export interface ExportConfig {
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  period: DatePeriod;
  includePersonalData: boolean;
  sections: ExportSection[];
  template: 'STANDARD' | 'EXECUTIVE' | 'DETAILED' | 'CUSTOM';
}

export interface ExportSection {
  id: string;
  name: string;
  enabled: boolean;
  options?: { [key: string]: any };
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  data: Blob | string;
  size: number;
  generatedAt: Date;
}

export interface HRReport {
  title: string;
  subtitle: string;
  period: DatePeriod;
  generatedAt: Date;
  generatedBy: string;
  summary: ReportSummary;
  sections: ReportSection[];
  appendices?: ReportAppendix[];
}

export interface ReportSummary {
  totalEmployees: number;
  totalLeaveRequests: number;
  totalLeaveDays: number;
  keyFindings: string[];
  recommendations: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'METRICS' | 'TABLE' | 'CHART' | 'TEXT' | 'LIST';
  content: any;
  pageBreak?: boolean;
}

export interface ReportAppendix {
  title: string;
  content: any;
  type: 'TABLE' | 'RAW_DATA' | 'METHODOLOGY';
}

class HRExportService {
  private readonly AVAILABLE_SECTIONS: ExportSection[] = [
    { id: 'summary', name: 'Résumé exécutif', enabled: true },
    { id: 'kpis', name: 'Indicateurs clés', enabled: true },
    { id: 'leaveAnalysis', name: 'Analyse des congés', enabled: true },
    { id: 'departmentStats', name: 'Statistiques par département', enabled: true },
    { id: 'employeeRanking', name: 'Classement employés', enabled: false },
    { id: 'trends', name: 'Tendances temporelles', enabled: true },
    { id: 'patterns', name: 'Patterns et anomalies', enabled: false },
    { id: 'capacity', name: 'Prévisions de capacité', enabled: true },
    { id: 'compliance', name: 'Conformité réglementaire', enabled: false },
    { id: 'recommendations', name: 'Recommandations', enabled: true },
    { id: 'rawData', name: 'Données brutes', enabled: false },
  ];

  private readonly TEMPLATES: { [key: string]: ExportSection[] } = {
    STANDARD: [
      { id: 'summary', name: 'Résumé exécutif', enabled: true },
      { id: 'kpis', name: 'Indicateurs clés', enabled: true },
      { id: 'leaveAnalysis', name: 'Analyse des congés', enabled: true },
      { id: 'departmentStats', name: 'Statistiques par département', enabled: true },
      { id: 'recommendations', name: 'Recommandations', enabled: true },
    ],
    EXECUTIVE: [
      { id: 'summary', name: 'Résumé exécutif', enabled: true },
      { id: 'kpis', name: 'Indicateurs clés', enabled: true },
      { id: 'trends', name: 'Tendances temporelles', enabled: true },
      { id: 'capacity', name: 'Prévisions de capacité', enabled: true },
      { id: 'recommendations', name: 'Recommandations', enabled: true },
    ],
    DETAILED: [
      { id: 'summary', name: 'Résumé exécutif', enabled: true },
      { id: 'kpis', name: 'Indicateurs clés', enabled: true },
      { id: 'leaveAnalysis', name: 'Analyse des congés', enabled: true },
      { id: 'departmentStats', name: 'Statistiques par département', enabled: true },
      { id: 'employeeRanking', name: 'Classement employés', enabled: true },
      { id: 'trends', name: 'Tendances temporelles', enabled: true },
      { id: 'patterns', name: 'Patterns et anomalies', enabled: true },
      { id: 'capacity', name: 'Prévisions de capacité', enabled: true },
      { id: 'compliance', name: 'Conformité réglementaire', enabled: true },
      { id: 'recommendations', name: 'Recommandations', enabled: true },
      { id: 'rawData', name: 'Données brutes', enabled: true },
    ],
  };

  // ========================================
  // GÉNÉRATION DE RAPPORTS
  // ========================================

  /**
   * Génère un rapport RH complet
   */
  async generateHRReport(config: ExportConfig, generatedBy: string = 'System'): Promise<HRReport> {
    try {
      // Collecter les données nécessaires
      const [hrMetrics, patterns, users, leaves] = await Promise.all([
        hrAnalyticsService.getHRMetrics(config.period),
        hrAnalyticsService.analyzeLeavePatterns(config.period),
        this.getUsers(),
        this.getLeaveRequests(config.period),
      ]);

      // Générer le rapport structuré
      const report: HRReport = {
        title: 'Rapport RH',
        subtitle: `Analyse des ressources humaines - ${config.period.label}`,
        period: config.period,
        generatedAt: new Date(),
        generatedBy,
        summary: this.generateSummary(hrMetrics),
        sections: await this.generateReportSections(config.sections, {
          hrMetrics,
          patterns,
          users,
          leaves,
          period: config.period,
        }),
      };

      return report;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Exporte un rapport selon le format spécifié
   */
  async exportReport(config: ExportConfig, generatedBy?: string): Promise<ExportResult> {
    const report = await this.generateHRReport(config, generatedBy);
    
    switch (config.format) {
      case 'PDF':
        return this.exportToPDF(report);
      case 'EXCEL':
        return this.exportToExcel(report);
      case 'CSV':
        return this.exportToCSV(report);
      case 'JSON':
        return this.exportToJSON(report);
      default:
        throw new Error(`Format d'export non supporté: ${config.format}`);
    }
  }

  /**
   * Export rapide des données de congés au format CSV
   */
  async exportLeaveData(period: DatePeriod): Promise<ExportResult> {
    const leaves = await this.getLeaveRequests(period);
    const users = await this.getUsers();
    
    const csvData = this.generateLeaveCSV(leaves, users);
    
    return {
      filename: `conges_${format(period.startDate, 'yyyy-MM-dd')}_${format(period.endDate, 'yyyy-MM-dd')}.csv`,
      mimeType: 'text/csv',
      data: csvData,
      size: csvData.length,
      generatedAt: new Date(),
    };
  }

  /**
   * Export des métriques RH au format Excel
   */
  async exportHRMetrics(period: DatePeriod): Promise<ExportResult> {
    const metrics = await hrAnalyticsService.getHRMetrics(period);
    
    // Simuler un export Excel (en réalité, utiliserait une bibliothèque comme xlsx)
    const excelData = this.generateMetricsExcel(metrics);
    
    return {
      filename: `metriques_rh_${format(period.startDate, 'yyyy-MM-dd')}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: excelData,
      size: excelData.length,
      generatedAt: new Date(),
    };
  }

  // ========================================
  // TEMPLATES ET CONFIGURATION
  // ========================================

  /**
   * Obtient les sections disponibles pour l'export
   */
  getAvailableSections(): ExportSection[] {
    return [...this.AVAILABLE_SECTIONS];
  }

  /**
   * Obtient les templates prédéfinis
   */
  getTemplates(): { [key: string]: ExportSection[] } {
    return { ...this.TEMPLATES };
  }

  /**
   * Crée une configuration d'export basée sur un template
   */
  createConfigFromTemplate(
    template: 'STANDARD' | 'EXECUTIVE' | 'DETAILED' | 'CUSTOM',
    period: DatePeriod,
    format: ExportConfig['format'] = 'PDF'
  ): ExportConfig {
    return {
      format,
      period,
      includePersonalData: template === 'DETAILED',
      sections: [...this.TEMPLATES[template]],
      template,
    };
  }

  // ========================================
  // GÉNÉRATION DE SECTIONS
  // ========================================

  private async generateReportSections(
    sections: ExportSection[],
    data: {
      hrMetrics: HRMetrics;
      patterns: any;
      users: User[];
      leaves: LeaveRequest[];
      period: DatePeriod;
    }
  ): Promise<ReportSection[]> {
    const reportSections: ReportSection[] = [];

    for (const section of sections.filter(s => s.enabled)) {
      switch (section.id) {
        case 'summary':
          reportSections.push(this.generateSummarySection(data.hrMetrics));
          break;
        case 'kpis':
          reportSections.push(this.generateKPIsSection(data.hrMetrics));
          break;
        case 'leaveAnalysis':
          reportSections.push(this.generateLeaveAnalysisSection(data.hrMetrics));
          break;
        case 'departmentStats':
          reportSections.push(this.generateDepartmentStatsSection(data.hrMetrics));
          break;
        case 'employeeRanking':
          reportSections.push(this.generateEmployeeRankingSection(data.hrMetrics));
          break;
        case 'trends':
          reportSections.push(this.generateTrendsSection(data.hrMetrics));
          break;
        case 'capacity':
          reportSections.push(await this.generateCapacitySection(data.period));
          break;
        case 'recommendations':
          reportSections.push(this.generateRecommendationsSection(data.hrMetrics));
          break;
        case 'rawData':
          reportSections.push(this.generateRawDataSection(data.leaves, data.users));
          break;
      }
    }

    return reportSections;
  }

  private generateSummary(metrics: HRMetrics): ReportSummary {
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Analyse automatique des findings
    if (metrics.absenteeismRate > 5) {
      keyFindings.push(`Taux d'absentéisme élevé (${metrics.absenteeismRate.toFixed(1)}%)`);
      recommendations.push('Analyser les causes de l\'absentéisme élevé');
    }

    if (metrics.leaveApprovalRate < 85) {
      keyFindings.push(`Taux d'approbation faible (${metrics.leaveApprovalRate.toFixed(1)}%)`);
      recommendations.push('Revoir les critères d\'approbation des congés');
    }

    if (metrics.averageApprovalTime > 48) {
      keyFindings.push(`Temps d'approbation long (${metrics.averageApprovalTime.toFixed(1)}h)`);
      recommendations.push('Optimiser le processus de validation');
    }

    // Ajouter des findings positifs
    if (metrics.leaveApprovalRate > 95) {
      keyFindings.push('Excellent taux d\'approbation des congés');
    }

    return {
      totalEmployees: metrics.totalEmployees,
      totalLeaveRequests: metrics.totalLeaveRequests,
      totalLeaveDays: metrics.totalLeaveDays,
      keyFindings,
      recommendations,
    };
  }

  // Sections spécialisées
  private generateSummarySection(metrics: HRMetrics): ReportSection {
    return {
      id: 'summary',
      title: 'Résumé exécutif',
      type: 'TEXT',
      content: {
        introduction: `Cette analyse porte sur ${metrics.totalEmployees} employés et couvre ${metrics.totalLeaveRequests} demandes de congés totalisant ${metrics.totalLeaveDays} jours.`,
        highlights: [
          `Taux d'approbation: ${metrics.leaveApprovalRate.toFixed(1)}%`,
          `Absentéisme: ${metrics.absenteeismRate.toFixed(1)}%`,
          `Temps d'approbation moyen: ${metrics.averageApprovalTime.toFixed(1)}h`,
        ],
      },
      pageBreak: true,
    };
  }

  private generateKPIsSection(metrics: HRMetrics): ReportSection {
    return {
      id: 'kpis',
      title: 'Indicateurs clés de performance',
      type: 'METRICS',
      content: {
        metrics: [
          { name: 'Employés actifs', value: metrics.activeEmployees, unit: 'personnes' },
          { name: 'Demandes de congés', value: metrics.totalLeaveRequests, unit: 'demandes' },
          { name: 'Jours de congés', value: metrics.totalLeaveDays, unit: 'jours' },
          { name: 'Taux d\'approbation', value: metrics.leaveApprovalRate, unit: '%' },
          { name: 'Taux d\'absentéisme', value: metrics.absenteeismRate, unit: '%' },
          { name: 'Temps d\'approbation', value: metrics.averageApprovalTime, unit: 'heures' },
        ],
      },
    };
  }

  private generateLeaveAnalysisSection(metrics: HRMetrics): ReportSection {
    return {
      id: 'leaveAnalysis',
      title: 'Analyse des congés',
      type: 'TABLE',
      content: {
        headers: ['Type de congé', 'Nombre', 'Jours total', 'Durée moyenne', 'Taux d\'approbation'],
        rows: metrics.leaveTypeBreakdown.map(breakdown => [
          this.getLeaveTypeLabel(breakdown.type),
          breakdown.count.toString(),
          breakdown.totalDays.toString(),
          breakdown.averageDuration.toFixed(1),
          `${breakdown.approvalRate.toFixed(1)}%`,
        ]),
      },
    };
  }

  private generateDepartmentStatsSection(metrics: HRMetrics): ReportSection {
    return {
      id: 'departmentStats',
      title: 'Statistiques par département',
      type: 'TABLE',
      content: {
        headers: ['Département', 'Employés', 'Jours de congés', 'Moyenne/employé', 'Absentéisme'],
        rows: metrics.departmentStats.map(dept => [
          dept.department,
          dept.employeeCount.toString(),
          dept.totalLeaveDays.toString(),
          dept.averageLeaveDaysPerEmployee.toFixed(1),
          `${dept.absenteeismRate.toFixed(1)}%`,
        ]),
      },
    };
  }

  private generateEmployeeRankingSection(metrics: HRMetrics): ReportSection {
    return {
      id: 'employeeRanking',
      title: 'Classement des employés',
      type: 'TABLE',
      content: {
        headers: ['Nom', 'Département', 'Demandes', 'Jours total', 'Derniers congés'],
        rows: metrics.topLeaveUsers.slice(0, 20).map(user => [
          user.displayName,
          user.department,
          user.leaveRequestsCount.toString(),
          user.totalLeaveDays.toString(),
          user.lastLeaveDate ? format(user.lastLeaveDate, 'dd/MM/yyyy', { locale: fr }) : 'Aucun',
        ]),
      },
    };
  }

  private generateTrendsSection(metrics: HRMetrics): ReportSection {
    return {
      id: 'trends',
      title: 'Tendances temporelles',
      type: 'CHART',
      content: {
        chartType: 'line',
        data: metrics.monthlyTrends.map(trend => ({
          month: trend.month,
          approuve: trend.approvedDays,
          rejete: trend.rejectedDays,
          total: trend.totalDays,
        })),
      },
    };
  }

  private async generateCapacitySection(period: DatePeriod): Promise<ReportSection> {
    const forecast = await hrAnalyticsService.forecastTeamCapacity({
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
      label: 'Mois prochain',
    });

    return {
      id: 'capacity',
      title: 'Prévisions de capacité',
      type: 'TABLE',
      content: {
        headers: ['Département', 'Capacité totale', 'Absences prévues', 'Disponible', 'Utilisation', 'Risque'],
        rows: forecast.departments.map(dept => [
          dept.name,
          `${dept.totalCapacity}j`,
          `${dept.plannedAbsence}j`,
          `${dept.availableCapacity}j`,
          `${dept.utilizationRate.toFixed(1)}%`,
          dept.riskLevel,
        ]),
      },
    };
  }

  private generateRecommendationsSection(metrics: HRMetrics): ReportSection {
    const recommendations: string[] = [];

    // Recommandations automatiques basées sur les métriques
    if (metrics.absenteeismRate > 5) {
      recommendations.push('Mettre en place des actions de prévention de l\'absentéisme');
      recommendations.push('Analyser les causes racines de l\'absentéisme par département');
    }

    if (metrics.averageApprovalTime > 48) {
      recommendations.push('Automatiser davantage le processus d\'approbation');
      recommendations.push('Former les managers aux outils de validation');
    }

    if (metrics.leaveApprovalRate < 90) {
      recommendations.push('Revoir les critères d\'approbation des congés');
      recommendations.push('Améliorer la communication sur les politiques de congés');
    }

    // Recommandations générales
    recommendations.push('Maintenir un suivi régulier des métriques RH');
    recommendations.push('Organiser des formations sur la gestion des congés');

    return {
      id: 'recommendations',
      title: 'Recommandations',
      type: 'LIST',
      content: {
        items: recommendations,
      },
    };
  }

  private generateRawDataSection(leaves: LeaveRequest[], users: User[]): ReportSection {
    return {
      id: 'rawData',
      title: 'Données brutes',
      type: 'TABLE',
      content: {
        headers: ['Date début', 'Date fin', 'Type', 'Jours', 'Statut', 'Employé', 'Département'],
        rows: leaves.map(leave => {
          const user = users.find(u => u.id === leave.userId);
          return [
            format(leave.startDate, 'dd/MM/yyyy', { locale: fr }),
            format(leave.endDate, 'dd/MM/yyyy', { locale: fr }),
            this.getLeaveTypeLabel(leave.type),
            leave.totalDays.toString(),
            leave.status,
            user?.displayName || 'Inconnu',
            user?.department || 'N/A',
          ];
        }),
      },
    };
  }

  // ========================================
  // EXPORTS SPÉCIALISÉS
  // ========================================

  private async exportToPDF(report: HRReport): Promise<ExportResult> {
    // TODO: Utiliser une bibliothèque comme jsPDF ou puppeteer
    const pdfContent = this.generatePDFContent(report);
    
    return {
      filename: `rapport_rh_${format(report.generatedAt, 'yyyy-MM-dd_HH-mm')}.pdf`,
      mimeType: 'application/pdf',
      data: new Blob([pdfContent], { type: 'application/pdf' }),
      size: pdfContent.length,
      generatedAt: report.generatedAt,
    };
  }

  private async exportToExcel(report: HRReport): Promise<ExportResult> {
    // TODO: Utiliser une bibliothèque comme xlsx
    const excelContent = this.generateExcelContent(report);
    
    return {
      filename: `rapport_rh_${format(report.generatedAt, 'yyyy-MM-dd_HH-mm')}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: new Blob([excelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      size: excelContent.length,
      generatedAt: report.generatedAt,
    };
  }

  private async exportToCSV(report: HRReport): Promise<ExportResult> {
    const csvContent = this.generateCSVContent(report);
    
    return {
      filename: `rapport_rh_${format(report.generatedAt, 'yyyy-MM-dd_HH-mm')}.csv`,
      mimeType: 'text/csv',
      data: csvContent,
      size: csvContent.length,
      generatedAt: report.generatedAt,
    };
  }

  private async exportToJSON(report: HRReport): Promise<ExportResult> {
    const jsonContent = JSON.stringify(report, null, 2);
    
    return {
      filename: `rapport_rh_${format(report.generatedAt, 'yyyy-MM-dd_HH-mm')}.json`,
      mimeType: 'application/json',
      data: jsonContent,
      size: jsonContent.length,
      generatedAt: report.generatedAt,
    };
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  private async getUsers(): Promise<User[]> {
    // TODO: Utiliser le vrai service utilisateur
    return [];
  }

  private async getLeaveRequests(period: DatePeriod): Promise<LeaveRequest[]> {
    return await leaveService.getTeamLeaves([], period);
  }

  private getLeaveTypeLabel(type: LeaveType): string {
    const labels = {
      PAID_LEAVE: 'Congés payés',
      RTT: 'RTT',
      SICK_LEAVE: 'Congé maladie',
      MATERNITY_LEAVE: 'Congé maternité',
      PATERNITY_LEAVE: 'Congé paternité',
      EXCEPTIONAL_LEAVE: 'Congé exceptionnel',
      UNPAID_LEAVE: 'Congé sans solde',
      TRAINING: 'Formation',
    };
    return labels[type] || type;
  }

  private generateLeaveCSV(leaves: LeaveRequest[], users: User[]): string {
    const headers = [
      'Date début',
      'Date fin',
      'Type',
      'Jours',
      'Demi-journée début',
      'Demi-journée fin',
      'Statut',
      'Motif',
      'Employé',
      'Département',
      'Date création',
      'Date approbation',
    ];

    const rows = leaves.map(leave => {
      const user = users.find(u => u.id === leave.userId);
      return [
        format(leave.startDate, 'dd/MM/yyyy', { locale: fr }),
        format(leave.endDate, 'dd/MM/yyyy', { locale: fr }),
        this.getLeaveTypeLabel(leave.type),
        leave.totalDays.toString(),
        leave.halfDayStart ? 'Oui' : 'Non',
        leave.halfDayEnd ? 'Oui' : 'Non',
        leave.status,
        `"${leave.reason || ''}"`,
        user?.displayName || 'Inconnu',
        user?.department || 'N/A',
        format(leave.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr }),
        leave.approvedAt ? format(leave.approvedAt, 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
      ];
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private generateMetricsExcel(metrics: HRMetrics): string {
    // Simulation de génération Excel - en réalité utiliserait xlsx
    return `Métriques RH générées le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`;
  }

  private generatePDFContent(report: HRReport): string {
    // Simulation de génération PDF - en réalité utiliserait jsPDF
    return `PDF: ${report.title} - ${format(report.generatedAt, 'dd/MM/yyyy', { locale: fr })}`;
  }

  private generateExcelContent(report: HRReport): string {
    // Simulation de génération Excel - en réalité utiliserait xlsx
    return `Excel: ${report.title} - ${format(report.generatedAt, 'dd/MM/yyyy', { locale: fr })}`;
  }

  private generateCSVContent(report: HRReport): string {
    let csv = `Rapport RH - ${report.title}\n`;
    csv += `Période: ${report.period.label}\n`;
    csv += `Généré le: ${format(report.generatedAt, 'dd/MM/yyyy HH:mm', { locale: fr })}\n\n`;
    
    // Ajouter les métriques principales
    csv += 'Métrique,Valeur\n';
    csv += `Employés,${report.summary.totalEmployees}\n`;
    csv += `Demandes,${report.summary.totalLeaveRequests}\n`;
    csv += `Jours de congés,${report.summary.totalLeaveDays}\n`;
    
    return csv;
  }
}

export const hrExportService = new HRExportService();