"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/MainLayout";
import { MetricCard } from "./components/MetricCard";
import { ProjectProgressChart } from "./components/ProjectProgressChart";
import { TaskStatusCards } from "./components/TaskStatusCards";
import { ProjectsDetailTable } from "./components/ProjectsDetailTable";
import PortfolioGantt from "./components/PortfolioGantt";
import { ProjectProgressionChart } from "./components/ProjectProgressionChart";
import { CollaboratorWorkloadChart } from "./components/CollaboratorWorkloadChart";
import { ProgressTrendChart } from "./components/ProgressTrendChart";
import { MilestoneCompletionChart } from "./components/MilestoneCompletionChart";
import { PriorityDistributionChart } from "./components/PriorityDistributionChart";
import { RecentActivityCards } from "./components/RecentActivityCards";
import { AnalyticsData, DateRange } from "./types";
import { format } from "date-fns";
import { ExportService } from "@/services/export.service";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { api } from "@/lib/api";
import { ClientSelector } from "@/components/clients/ClientSelector";

export default function ReportsPage() {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const locale = useLocale();
  const { hasPermission, permissionsLoaded } = usePermissions();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [activeTab, setActiveTab] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<"json" | "pdf" | "excel">(
    "pdf",
  );
  const [exporting, setExporting] = useState(false);
  const [clientsFilter, setClientsFilter] = useState<string[]>([]);
  const progressChartRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const canView = !permissionsLoaded || hasPermission("reports:view");
  const canExport = hasPermission("reports:export");
  const canReadClients = hasPermission("clients:read");

  const loadProjects = useCallback(async () => {
    try {
      const response = await api.get("/projects");
      const projectsData = response.data;
      setProjects(projectsData.data || projectsData);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateRange });
      if (selectedProject !== "all") {
        params.append("projectId", selectedProject);
      }

      const response = await api.get(`/analytics?${params.toString()}`);
      const analyticsData = response.data;
      setData(analyticsData);

      // Load projects for filter if not already loaded
      loadProjects();
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedProject, loadProjects]);

  useEffect(() => {
    if (canView) {
      loadAnalytics();
    } else if (permissionsLoaded) {
      setLoading(false);
    }
  }, [loadAnalytics, canView, permissionsLoaded]);

  const exportReport = async () => {
    if (!data) return;

    try {
      switch (exportFormat) {
        case "pdf":
          setExporting(true);
          try {
            if (activeTab === 0) {
              await ExportService.exportOverviewToPDF(
                {
                  metrics: data.metrics,
                  projectDetails: data.projectDetails,
                  taskStatusData: data.taskStatusData,
                  projectProgressData: data.projectProgressData,
                },
                dateRange,
                selectedProject !== "all" ? selectedProject : undefined,
                progressChartRef.current,
              );
            } else if (activeTab === 2) {
              if (ganttRef.current) {
                await ExportService.exportGanttPortfolioToPDF(
                  ganttRef.current,
                  dateRange,
                );
              }
            } else {
              await ExportService.exportToPDF(
                data,
                dateRange,
                selectedProject !== "all" ? selectedProject : undefined,
              );
            }
          } finally {
            setExporting(false);
          }
          break;

        case "excel":
          await ExportService.exportToExcel(data, dateRange);
          break;

        case "json": {
          const params = new URLSearchParams({ dateRange });
          if (selectedProject !== "all") {
            params.append("projectId", selectedProject);
          }

          const response = await api.get(
            `/analytics/export?${params.toString()}`,
          );
          const exportData = response.data;
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `orchestr-a-report-${format(new Date(), "yyyy-MM-dd")}.json`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
      }
    } catch (error) {
      console.error("Error exporting report:", error);
      alert(t("errors.exportError"));
    }
  };

  // Permission guard
  if (permissionsLoaded && !canView) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4">
            <h3 className="font-semibold text-yellow-800">
              Accès non autorisé
            </h3>
            <p className="text-sm text-yellow-700">
              Vous n&apos;avez pas la permission d&apos;accéder aux rapports
              analytics.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="border-l-4 border-red-500 bg-red-50 p-4">
            <h3 className="font-semibold text-red-800">{t("errors.title")}</h3>
            <p className="text-sm text-red-700">{t("errors.loadFailed")}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const overdueTasks =
    data.projectDetails.reduce(
      (sum, p) => sum + (p.isOverdue ? p.totalTasks - p.completedTasks : 0),
      0,
    ) || 0;

  const projectIdFilter =
    selectedProject !== "all" ? selectedProject : undefined;

  // Client-side filter par client(s) : s'applique à la Detail Table et au
  // Gantt Portfolio. Les agrégats/charts de la vue d'ensemble restent sur
  // tous les projets (filter côté backend = scope évolution).
  const visibleProjectDetails =
    clientsFilter.length > 0
      ? data.projectDetails.filter((p) =>
          (p.clients ?? []).some((c) => clientsFilter.includes(c.id)),
        )
      : data.projectDetails;

  return (
    <MainLayout>
      <div className="p-8 space-y-8">
        {/* Header: title + tabs */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab(0)}
              className={`px-4 py-2 font-medium ${
                activeTab === 0
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t("tabs.overview")}
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`px-4 py-2 font-medium ${
                activeTab === 1
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t("tabs.advanced")}
            </button>
            <button
              onClick={() => setActiveTab(2)}
              className={`px-4 py-2 font-medium ${
                activeTab === 2
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t("tabs.gantt")}
            </button>
          </div>
        </div>

        {/* Toolbar: filters + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="week">{t("dateRange.week")}</option>
            <option value="month">{t("dateRange.month")}</option>
            <option value="quarter">{t("dateRange.quarter")}</option>
            <option value="year">{t("dateRange.year")}</option>
          </select>

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t("filters.allProjects")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {canReadClients && (
            <div className="min-w-[220px]">
              <ClientSelector
                value={clientsFilter}
                onChange={setClientsFilter}
                placeholder="Filtrer par client(s)…"
              />
            </div>
          )}

          <button
            onClick={loadAnalytics}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            {t("filters.refresh")}
          </button>

          <div className="flex-1" />

          {canExport && (
            <>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as "json" | "pdf" | "excel")
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pdf">{t("exportFormats.pdf")}</option>
                <option value="excel">{t("exportFormats.excel")}</option>
                <option value="json">{t("exportFormats.json")}</option>
              </select>

              <button
                onClick={exportReport}
                disabled={exporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? t("exportingPdf") : t("filters.export")}
              </button>
            </>
          )}
        </div>

        {/* Tab: Vue d'ensemble */}
        {activeTab === 0 && (
          <div className="space-y-8">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {data.metrics.map((metric, index) => (
                <MetricCard
                  key={index}
                  metric={metric}
                  onClick={
                    metric.title === "Tâches en Retard"
                      ? () => router.push(`/${locale}/tasks?overdue=true`)
                      : undefined
                  }
                />
              ))}
            </div>

            {/* Task status cards — compact row */}
            <TaskStatusCards data={data.taskStatusData} />

            {/* Project progress — full width, horizontal bars */}
            <div ref={progressChartRef}>
              <ProjectProgressChart data={data.projectProgressData} />
            </div>

            {/* Projects Detail Table (fusion santé + détail) */}
            <ProjectsDetailTable
              projects={visibleProjectDetails}
              dateRange={dateRange}
              projectId={projectIdFilter}
            />

            {/* Alerts */}
            {overdueTasks > 0 && (
              <div className="border-l-4 border-red-500 bg-red-50 p-4">
                <h3 className="font-semibold text-red-800">
                  {t("alerts.attentionRequired")}
                </h3>
                <p className="text-sm text-red-700">
                  {overdueTasks} {t("alerts.overdueTasks")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Analytics Avancés */}
        {activeTab === 1 && (
          <div className="space-y-8">
            {/* Row 1: Progression + Charge */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectProgressionChart
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
              <CollaboratorWorkloadChart
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
            </div>

            {/* Row 2: Tendance + Jalons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressTrendChart
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
              <MilestoneCompletionChart
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
            </div>

            {/* Row 3: Priorités + Activité */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PriorityDistributionChart
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
              <RecentActivityCards
                dateRange={dateRange}
                projectId={projectIdFilter}
              />
            </div>
          </div>
        )}

        {/* Tab: Gantt Portfolio */}
        {activeTab === 2 && (
          <div className="min-h-[600px]">
            <PortfolioGantt ref={ganttRef} projects={visibleProjectDetails} />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
