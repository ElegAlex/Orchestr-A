"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { MetricCard } from "./components/MetricCard";
import { ProjectProgressChart } from "./components/ProjectProgressChart";
import { TaskStatusChart } from "./components/TaskStatusChart";
import { ProjectsTable } from "./components/ProjectsTable";
import PortfolioGantt from "./components/PortfolioGantt";
import { BurndownChart } from "./components/BurndownChart";
import { VelocityChart } from "./components/VelocityChart";
import { WorkloadChart } from "./components/WorkloadChart";
import { AnalyticsData, DateRange } from "./types";
import { format } from "date-fns";
import { ExportService } from "@/services/export.service";
import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const t = useTranslations("admin.reports");
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

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (response.ok) {
        const projectsData = await response.json();
        setProjects(projectsData.data || projectsData); // Extract data array
      }
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

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const analyticsData = await response.json();
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
    loadAnalytics();
  }, [loadAnalytics]);

  const exportReport = async () => {
    if (!data) return;

    try {
      switch (exportFormat) {
        case "pdf":
          await ExportService.exportToPDF(
            data,
            dateRange,
            selectedProject !== "all" ? selectedProject : undefined,
          );
          break;

        case "excel":
          await ExportService.exportToExcel(data, dateRange);
          break;

        case "json":
          const params = new URLSearchParams({ dateRange });
          if (selectedProject !== "all") {
            params.append("projectId", selectedProject);
          }

          const response = await fetch(
            `/api/analytics/export?${params.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error("Failed to export analytics");
          }

          const exportData = await response.json();
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
    } catch (error) {
      console.error("Error exporting report:", error);
      alert(t("errors.exportError"));
    }
  };

  const overdueTasks =
    data?.projectDetails.reduce(
      (sum, p) => sum + (p.isOverdue ? p.totalTasks - p.completedTasks : 0),
      0,
    ) || 0;

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

  return (
    <MainLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t("title")}</h1>

          <div className="flex items-center gap-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab(0)}
                className={`px-4 py-2 font-medium ${
                  activeTab === 0
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-900 hover:text-gray-900"
                }`}
              >
                {t("tabs.overview")}
              </button>
              <button
                onClick={() => setActiveTab(1)}
                className={`px-4 py-2 font-medium ${
                  activeTab === 1
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-900 hover:text-gray-900"
                }`}
              >
                {t("tabs.advanced")}
              </button>
              <button
                onClick={() => setActiveTab(2)}
                className={`px-4 py-2 font-medium ${
                  activeTab === 2
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-900 hover:text-gray-900"
                }`}
              >
                {t("tabs.gantt")}
              </button>
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="week">{t("dateRange.week")}</option>
              <option value="month">{t("dateRange.month")}</option>
              <option value="quarter">{t("dateRange.quarter")}</option>
              <option value="year">{t("dateRange.year")}</option>
            </select>

            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="all">{t("filters.allProjects")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <button
              onClick={loadAnalytics}
              className="px-4 py-2 border rounded-md hover:bg-gray-100"
            >
              {t("filters.refresh")}
            </button>

            <select
              value={exportFormat}
              onChange={(e) =>
                setExportFormat(e.target.value as "json" | "pdf" | "excel")
              }
              className="px-4 py-2 border rounded-md"
            >
              <option value="pdf">{t("exportFormats.pdf")}</option>
              <option value="excel">{t("exportFormats.excel")}</option>
              <option value="json">{t("exportFormats.json")}</option>
            </select>

            <button
              onClick={exportReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t("filters.export")}
            </button>
          </div>
        </div>

        {/* Tab: Analytics */}
        {activeTab === 0 && (
          <div className="space-y-8">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {data.metrics.map((metric, index) => (
                <MetricCard key={index} metric={metric} />
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectProgressChart data={data.projectProgressData} />
              <TaskStatusChart data={data.taskStatusData} />
            </div>

            {/* Projects Table */}
            <ProjectsTable projects={data.projectDetails} />

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BurndownChart
                projectId={
                  selectedProject !== "all" ? selectedProject : undefined
                }
              />
              <VelocityChart />
            </div>
            <WorkloadChart />
          </div>
        )}

        {/* Tab: Gantt Portfolio */}
        {activeTab === 2 && (
          <div className="min-h-[600px]">
            <PortfolioGantt projects={data.projectDetails} />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
