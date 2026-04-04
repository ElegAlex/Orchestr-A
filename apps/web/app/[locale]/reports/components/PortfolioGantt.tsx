"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { api } from "@/lib/api";
import type { Milestone } from "@/types";

interface Project {
  id: string;
  name: string;
  code?: string;
  status: string;
  progress: number;
  startDate: string;
  dueDate?: string | null;
  projectManager?: string;
  managerDepartment?: string;
  priority?: string;
}

interface PortfolioGanttProps {
  projects: Project[];
}

type TimeScale = "day" | "week" | "month";
type RagStatus = 'onTrack' | 'atRisk' | 'late' | 'upcoming' | 'completed';

export default function PortfolioGantt({ projects }: PortfolioGanttProps) {
  const [timeScale, setTimeScale] = useState<TimeScale>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const locale = useLocale();

  // F5 — Tooltip state
  const [tooltip, setTooltip] = useState<{
    project: Project;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback((project: Project, event: React.MouseEvent) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({
        project,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }, 300);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setTooltip(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  // F3 — RAG status & colors
  const getRagStatus = (project: Project): RagStatus => {
    const status = project.status.toLowerCase();
    if (status === 'completed' || status === 'cancelled') return 'completed';

    const now = new Date();
    const start = new Date(project.startDate);
    if (start > now) return 'upcoming';

    const end = project.dueDate ? new Date(project.dueDate) : new Date();
    const totalDuration = end.getTime() - start.getTime();
    if (totalDuration <= 0) return 'onTrack';

    const elapsed = now.getTime() - start.getTime();
    const timeElapsedPct = Math.min((elapsed / totalDuration) * 100, 100);
    const progress = project.progress;

    if (progress >= timeElapsedPct - 10) return 'onTrack';
    if (progress >= timeElapsedPct - 25) return 'atRisk';
    return 'late';
  };

  const RAG_COLORS: Record<RagStatus, string> = {
    onTrack: '#22c55e',
    atRisk: '#f59e0b',
    late: '#ef4444',
    upcoming: '#60a5fa',
    completed: '#9ca3af',
  };

  const getRagColor = (project: Project): string => {
    return RAG_COLORS[getRagStatus(project)];
  };

  const RAG_LABELS: Record<RagStatus, string> = {
    onTrack: t("ganttPortfolio.rag.onTrack"),
    atRisk: t("ganttPortfolio.rag.atRisk"),
    late: t("ganttPortfolio.rag.late"),
    upcoming: t("ganttPortfolio.rag.upcoming"),
    completed: t("ganttPortfolio.rag.completed"),
  };

  const MILESTONE_COLORS: Record<string, string> = {
    PENDING: '#9ca3af',
    IN_PROGRESS: '#60a5fa',
    COMPLETED: '#22c55e',
    DELAYED: '#ef4444',
  };

  const PRIORITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
  };

  // F7 — Expand/collapse milestones
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [milestonesCache, setMilestonesCache] = useState<Record<string, Milestone[]>>({});
  const [loadingMilestones, setLoadingMilestones] = useState<Set<string>>(new Set());

  // F8 — Sort
  type SortOption = 'name-asc' | 'name-desc' | 'progress-asc' | 'progress-desc' | 'endDate-asc' | 'endDate-desc' | 'priority-high' | 'priority-low' | 'health-worst' | 'health-best' | 'service' | 'manager';
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  // F9 — RAG filter
  const [activeRagFilters, setActiveRagFilters] = useState<Set<RagStatus>>(
    new Set(['onTrack', 'atRisk', 'late', 'upcoming', 'completed'] as RagStatus[])
  );

  // F7 — Toggle expand functions
  const toggleExpand = useCallback(async (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
    // Fetch milestones if not cached
    if (!milestonesCache[projectId]) {
      setLoadingMilestones(prev => new Set(prev).add(projectId));
      try {
        const response = await api.get('/milestones', { params: { projectId, limit: 100 } });
        const data = response.data;
        setMilestonesCache(prev => ({
          ...prev,
          [projectId]: Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [],
        }));
      } catch {
        setMilestonesCache(prev => ({ ...prev, [projectId]: [] }));
      } finally {
        setLoadingMilestones(prev => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    }
  }, [milestonesCache]);

  // Filtrer les projets actifs + F9 RAG filter + F8 sort
  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) =>
      ["active", "draft", "suspended"].includes(p.status.toLowerCase()),
    );

    // F9 — RAG filter
    if (activeRagFilters.size < 5) {
      result = result.filter((p) => activeRagFilters.has(getRagStatus(p)));
    }

    // F8 — Sort
    const RAG_SEVERITY: Record<RagStatus, number> = { late: 0, atRisk: 1, onTrack: 2, upcoming: 3, completed: 4 };

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'progress-asc': return a.progress - b.progress;
        case 'progress-desc': return b.progress - a.progress;
        case 'endDate-asc': return new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime();
        case 'endDate-desc': return new Date(b.dueDate || '0000').getTime() - new Date(a.dueDate || '0000').getTime();
        case 'priority-high': return (PRIORITY_ORDER[a.priority || 'NORMAL'] ?? 2) - (PRIORITY_ORDER[b.priority || 'NORMAL'] ?? 2);
        case 'priority-low': return (PRIORITY_ORDER[b.priority || 'NORMAL'] ?? 2) - (PRIORITY_ORDER[a.priority || 'NORMAL'] ?? 2);
        case 'health-worst': return RAG_SEVERITY[getRagStatus(a)] - RAG_SEVERITY[getRagStatus(b)];
        case 'health-best': return RAG_SEVERITY[getRagStatus(b)] - RAG_SEVERITY[getRagStatus(a)];
        case 'service': return (a.managerDepartment || 'zzz').localeCompare(b.managerDepartment || 'zzz');
        case 'manager': return (a.projectManager || 'zzz').localeCompare(b.projectManager || 'zzz');
        default: return 0;
      }
    });

    return result;
  }, [projects, activeRagFilters, sortBy]);

  const toggleExpandAll = useCallback(() => {
    if (expandedProjects.size > 0) {
      setExpandedProjects(new Set());
    } else {
      const allIds = new Set(filteredProjects.map(p => p.id));
      setExpandedProjects(allIds);
      filteredProjects.forEach(async (p) => {
        if (!milestonesCache[p.id]) {
          setLoadingMilestones(prev => new Set(prev).add(p.id));
          try {
            const response = await api.get('/milestones', { params: { projectId: p.id, limit: 100 } });
            const data = response.data;
            setMilestonesCache(prev => ({
              ...prev,
              [p.id]: Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [],
            }));
          } catch {
            setMilestonesCache(prev => ({ ...prev, [p.id]: [] }));
          } finally {
            setLoadingMilestones(prev => {
              const next = new Set(prev);
              next.delete(p.id);
              return next;
            });
          }
        }
      });
    }
  }, [expandedProjects.size, filteredProjects, milestonesCache]);

  // Calculer la période visible selon l'échelle
  const getVisibleRange = () => {
    switch (timeScale) {
      case "day":
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15),
        };
      case "week":
        return {
          start: startOfWeek(addWeeks(currentDate, -15), { locale: fr }),
          end: endOfWeek(addWeeks(currentDate, 15), { locale: fr }),
        };
      case "month":
        return {
          start: startOfMonth(addMonths(currentDate, -6)),
          end: endOfMonth(addMonths(currentDate, 5)),
        };
      default:
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15),
        };
    }
  };

  const visibleRange = getVisibleRange();

  // F1 — Position de la ligne "Aujourd'hui"
  const getTodayPosition = (): number | null => {
    const now = new Date();
    if (now < visibleRange.start || now > visibleRange.end) return null;
    const totalDays = differenceInDays(visibleRange.end, visibleRange.start) + 1;
    const offset = differenceInDays(now, visibleRange.start);
    return (offset / totalDays) * 100;
  };

  // Calculer les colonnes de temps
  const getTimeData = (): {
    totalUnits: number;
    columns: Array<{
      date: Date;
      label: string;
      sublabel: string;
      width: number;
    }>;
  } => {
    switch (timeScale) {
      case "day": {
        const totalDays =
          differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentDay = visibleRange.start;

        while (currentDay <= visibleRange.end) {
          columns.push({
            date: currentDay,
            label: format(currentDay, "d", { locale: fr }),
            sublabel: format(currentDay, "EEE", { locale: fr }),
            width: 100 / totalDays,
          });
          currentDay = addDays(currentDay, 1);
        }
        return { totalUnits: totalDays, columns };
      }

      case "week": {
        const columns = [];
        let currentWeek = visibleRange.start;

        while (currentWeek <= visibleRange.end) {
          const weekEnd = endOfWeek(currentWeek, { locale: fr });
          const adjustedEnd =
            weekEnd > visibleRange.end ? visibleRange.end : weekEnd;
          const weekDays = differenceInDays(adjustedEnd, currentWeek) + 1;

          columns.push({
            date: currentWeek,
            label: `S${getISOWeek(currentWeek)}`,
            sublabel: "",
            width:
              (weekDays * 100) /
              (differenceInDays(visibleRange.end, visibleRange.start) + 1),
          });
          currentWeek = addWeeks(currentWeek, 1);
        }
        return {
          totalUnits:
            differenceInDays(visibleRange.end, visibleRange.start) + 1,
          columns,
        };
      }

      case "month": {
        const totalDays =
          differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentMonth = visibleRange.start;

        while (currentMonth <= visibleRange.end) {
          const monthEnd = endOfMonth(currentMonth);
          const adjustedEnd =
            monthEnd > visibleRange.end ? visibleRange.end : monthEnd;
          const monthDays = differenceInDays(adjustedEnd, currentMonth) + 1;

          columns.push({
            date: currentMonth,
            label: format(currentMonth, "MMM", { locale: fr }),
            sublabel: format(currentMonth, "yyyy"),
            width: (monthDays * 100) / totalDays,
          });
          currentMonth = addMonths(currentMonth, 1);
        }
        return { totalUnits: totalDays, columns };
      }

      default:
        return { totalUnits: 0, columns: [] };
    }
  };

  const timeData = getTimeData();
  const timeColumns = timeData.columns;

  // Calculer la position et largeur d'un élément sur le Gantt
  const getBarPosition = (startDate: string, dueDate?: string | null) => {
    const start = new Date(startDate);
    const end = dueDate ? new Date(dueDate) : new Date();

    if (end < visibleRange.start || start > visibleRange.end) {
      return null;
    }

    const adjustedStart =
      start < visibleRange.start ? visibleRange.start : start;
    const adjustedEnd = end > visibleRange.end ? visibleRange.end : end;

    const startOffset = differenceInDays(adjustedStart, visibleRange.start);
    const duration = differenceInDays(adjustedEnd, adjustedStart) + 1;
    const totalUnits =
      differenceInDays(visibleRange.end, visibleRange.start) + 1;

    return {
      left: (startOffset / totalUnits) * 100,
      width: (duration / totalUnits) * 100,
    };
  };

  // Navigation temporelle
  const navigateTime = (direction: "prev" | "next") => {
    let amount = 1;
    switch (timeScale) {
      case "day":
        amount = 30;
        break;
      case "week":
        amount = 7;
        break;
      case "month":
        amount = 12;
        break;
    }

    if (timeScale === "day") {
      setCurrentDate(
        direction === "next"
          ? addDays(currentDate, amount)
          : addDays(currentDate, -amount),
      );
    } else if (timeScale === "week") {
      setCurrentDate(
        direction === "next"
          ? addWeeks(currentDate, amount)
          : addWeeks(currentDate, -amount),
      );
    } else {
      setCurrentDate(
        direction === "next"
          ? addMonths(currentDate, amount)
          : addMonths(currentDate, -amount),
      );
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Zoom
  const handleZoom = (direction: "in" | "out") => {
    const scales: TimeScale[] = ["day", "week", "month"];
    const currentIndex = scales.indexOf(timeScale);

    if (direction === "in" && currentIndex > 0) {
      setTimeScale(scales[currentIndex - 1]);
    } else if (direction === "out" && currentIndex < scales.length - 1) {
      setTimeScale(scales[currentIndex + 1]);
    }
  };

  // F8 — Group headers for service/manager sort
  const getGroupKey = (project: Project): string | null => {
    if (sortBy === 'service') return project.managerDepartment || t("ganttPortfolio.sort.unassigned");
    if (sortBy === 'manager') return project.projectManager || t("ganttPortfolio.sort.unassigned");
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 h-full flex flex-col">
      {/* En-tete avec controles */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">
          {t("ganttPortfolio.title")}
        </h3>

        <div className="flex items-center gap-4">
          {/* Selecteur d'echelle */}
          <select
            value={timeScale}
            onChange={(e) => setTimeScale(e.target.value as TimeScale)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>

          {/* Navigation temporelle */}
          <div className="flex gap-2">
            <button
              onClick={() => navigateTime("prev")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Precedent"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
              title="Aujourd'hui"
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={() => navigateTime("next")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Suivant"
            >
              →
            </button>
          </div>

          {/* Zoom */}
          <div className="flex gap-2">
            <button
              onClick={() => handleZoom("in")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Zoom avant"
              disabled={timeScale === "day"}
            >
              🔍+
            </button>
            <button
              onClick={() => handleZoom("out")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Zoom arriere"
              disabled={timeScale === "month"}
            >
              🔍-
            </button>
          </div>
        </div>
      </div>

      {/* F8+F9 toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {/* F7 — Expand all */}
          <button
            onClick={toggleExpandAll}
            className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
          >
            {expandedProjects.size > 0
              ? t("ganttPortfolio.collapseAll")
              : t("ganttPortfolio.expandAll")}
          </button>

          {/* F8 — Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs"
          >
            <option value="name-asc">{t("ganttPortfolio.sort.nameAsc")}</option>
            <option value="name-desc">{t("ganttPortfolio.sort.nameDesc")}</option>
            <option value="progress-asc">{t("ganttPortfolio.sort.progressAsc")}</option>
            <option value="progress-desc">{t("ganttPortfolio.sort.progressDesc")}</option>
            <option value="endDate-asc">{t("ganttPortfolio.sort.endDateAsc")}</option>
            <option value="endDate-desc">{t("ganttPortfolio.sort.endDateDesc")}</option>
            <option value="priority-high">{t("ganttPortfolio.sort.priorityHigh")}</option>
            <option value="priority-low">{t("ganttPortfolio.sort.priorityLow")}</option>
            <option value="health-worst">{t("ganttPortfolio.sort.healthWorst")}</option>
            <option value="health-best">{t("ganttPortfolio.sort.healthBest")}</option>
            <option value="service">{t("ganttPortfolio.sort.service")}</option>
            <option value="manager">{t("ganttPortfolio.sort.manager")}</option>
          </select>
        </div>

        {/* F9 — RAG filter chips */}
        <div className="flex items-center gap-2">
          {([
            { key: 'onTrack' as RagStatus, color: RAG_COLORS.onTrack },
            { key: 'atRisk' as RagStatus, color: RAG_COLORS.atRisk },
            { key: 'late' as RagStatus, color: RAG_COLORS.late },
            { key: 'upcoming' as RagStatus, color: RAG_COLORS.upcoming },
            { key: 'completed' as RagStatus, color: RAG_COLORS.completed },
          ] as const).map(({ key, color }) => {
            const count = projects.filter(p =>
              ["active", "draft", "suspended"].includes(p.status.toLowerCase()) && getRagStatus(p) === key
            ).length;
            const isActive = activeRagFilters.has(key);
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveRagFilters(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive ? '' : 'opacity-40'
                }`}
                style={{
                  backgroundColor: `${color}15`,
                  color: color,
                  boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {RAG_LABELS[key]}
                <span className="ml-0.5 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Corps du Gantt */}
      <div className="flex-1 overflow-auto border border-gray-300 rounded">
        {/* En-tete de l'echelle de temps */}
        <div className="flex border-b-2 border-gray-400 bg-gray-50 sticky top-0 z-10">
          <div className="w-64 p-2 border-r border-gray-300 font-semibold text-sm">
            {t("ganttPortfolio.projectsColumn")}
          </div>
          <div className="flex-1 flex relative">
            {timeColumns.map((col, index) => (
              <div
                key={index}
                style={{ width: `${col.width}%` }}
                className="p-1 border-r border-gray-300 text-center min-w-[30px]"
              >
                <div className="text-xs font-semibold">{col.label}</div>
                {col.sublabel && (
                  <div className="text-xs text-gray-900">{col.sublabel}</div>
                )}
              </div>
            ))}
            {(() => {
              const todayPos = getTodayPosition();
              if (todayPos === null) return null;
              return (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${todayPos}%` }}
                >
                  <div className="text-[10px] text-red-500 font-semibold whitespace-nowrap -translate-x-1/2 -top-0.5 absolute">
                    {t("ganttPortfolio.todayLabel")}
                  </div>
                  <div className="w-0 h-full border-l-2 border-dashed border-red-500" />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Lignes des projets */}
        {filteredProjects.map((project, index) => {
          const projectBar = getBarPosition(project.startDate, project.dueDate);
          const groupKey = getGroupKey(project);
          const prevGroupKey = index > 0 ? getGroupKey(filteredProjects[index - 1]) : null;
          const showGroupHeader = groupKey !== null && groupKey !== prevGroupKey;

          return (
            <React.Fragment key={project.id}>
              {showGroupHeader && (
                <div className="flex border-b border-gray-300 bg-gray-100 min-h-[32px]">
                  <div className="w-64 p-2 border-r border-gray-300">
                    <span className="text-xs font-bold text-gray-700">{groupKey}</span>
                  </div>
                  <div className="flex-1" />
                </div>
              )}
              <div
                className={`flex border-b border-gray-200 min-h-[50px] transition-colors duration-150 ${
                  hoveredItem === project.id ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
                onMouseEnter={() => setHoveredItem(project.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className="w-64 p-2 border-r border-gray-300">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(project.id); }}
                      className="text-gray-400 hover:text-gray-600 text-xs w-4 flex-shrink-0"
                    >
                      {expandedProjects.has(project.id) ? '\u25BC' : '\u25B6'}
                    </button>
                    <span className="font-semibold text-sm truncate">{project.name}</span>
                  </div>
                  <div className="flex gap-2 mt-1 items-center">
                    <span
                      className="text-xs px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: getRagColor(project) }}
                    >
                      {project.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-900">
                      {project.progress}%
                    </span>
                  </div>
                </div>

                <div className="flex-1 relative">
                  {(() => {
                    const todayPos = getTodayPosition();
                    if (todayPos === null) return null;
                    return (
                      <div
                        className="absolute top-0 bottom-0 z-5 pointer-events-none"
                        style={{ left: `${todayPos}%` }}
                      >
                        <div className="w-0 h-full border-l-2 border-dashed border-red-500" />
                      </div>
                    );
                  })()}
                  {projectBar && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full cursor-pointer transition-all hover:-translate-y-[calc(50%+1px)] hover:shadow-lg"
                      style={{
                        left: `${projectBar.left}%`,
                        width: `${projectBar.width}%`,
                        backgroundColor: `${getRagColor(project)}33`,
                      }}
                      onClick={() => router.push(`/${locale}/projects/${project.id}`)}
                      onMouseMove={(e) => showTooltip(project, e)}
                      onMouseLeave={hideTooltip}
                    >
                      {/* Portion progressee */}
                      <div
                        className="absolute top-0 left-0 h-full rounded-full"
                        style={{
                          width: `${Math.min(project.progress, 100)}%`,
                          backgroundColor: getRagColor(project),
                          borderTopRightRadius: project.progress >= 100 ? undefined : 0,
                          borderBottomRightRadius: project.progress >= 100 ? undefined : 0,
                        }}
                      />
                      {/* F4 — Pourcentage */}
                      <div className="relative z-10 flex items-center h-full px-1">
                        {projectBar.width > 4 ? (
                          <span className="text-xs font-semibold text-white truncate ml-1">
                            {project.progress}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {/* F4 — % outside bar when too narrow */}
                  {projectBar && projectBar.width <= 4 && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold"
                      style={{
                        left: `${projectBar.left + projectBar.width + 0.5}%`,
                        color: getRagColor(project),
                      }}
                    >
                      {project.progress}%
                    </span>
                  )}
                </div>
              </div>

              {/* F7 — Milestone sub-rows */}
              {expandedProjects.has(project.id) && (
                <>
                  {loadingMilestones.has(project.id) && (
                    <div className={`flex border-b border-gray-200 min-h-[36px] ${
                      hoveredItem === project.id ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                      <div className="w-64 p-2 pl-8 border-r border-gray-300 text-xs text-gray-400 italic">
                        {t("ganttPortfolio.loading")}
                      </div>
                      <div className="flex-1" />
                    </div>
                  )}
                  {(milestonesCache[project.id] || []).map((milestone) => {
                    const milestonePos = getBarPosition(milestone.dueDate, milestone.dueDate);
                    const isOverdue = new Date(milestone.dueDate) < new Date() && milestone.status !== 'COMPLETED';
                    const milestoneColor = isOverdue ? '#ef4444' : MILESTONE_COLORS[milestone.status] || '#9ca3af';
                    return (
                      <div
                        key={milestone.id}
                        className={`flex border-b border-gray-100 min-h-[36px] transition-colors duration-150 ${
                          hoveredItem === project.id ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        <div className="w-64 p-1.5 pl-9 border-r border-gray-300 flex items-center gap-1.5">
                          <span style={{ color: milestoneColor }}>&#9670;</span>
                          <span className="text-xs text-gray-600 truncate">{milestone.name}</span>
                          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                            {format(new Date(milestone.dueDate), "d MMM", { locale: fr })}
                          </span>
                        </div>
                        <div className="flex-1 relative">
                          {/* Today line in milestone row */}
                          {(() => {
                            const todayPos = getTodayPosition();
                            if (todayPos === null) return null;
                            return (
                              <div className="absolute top-0 bottom-0 z-5 pointer-events-none" style={{ left: `${todayPos}%` }}>
                                <div className="w-0 h-full border-l-2 border-dashed border-red-500" />
                              </div>
                            );
                          })()}
                          {milestonePos && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                              style={{ left: `${milestonePos.left}%` }}
                              onClick={() => router.push(`/${locale}/projects/${project.id}`)}
                              title={`${milestone.name} — ${format(new Date(milestone.dueDate), "d MMM yyyy", { locale: fr })}`}
                            >
                              <span className="text-lg" style={{ color: milestoneColor }}>&#9670;</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </React.Fragment>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="p-8 text-center text-gray-900">
            {t("ganttPortfolio.noProjects")}
          </div>
        )}
      </div>

      {/* F5 — Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold text-sm mb-2">{tooltip.project.name}</div>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-white text-[10px]"
                style={{ backgroundColor: getRagColor(tooltip.project) }}
              >
                {tooltip.project.status.replace("_", " ")}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-white text-[10px]"
                style={{ backgroundColor: getRagColor(tooltip.project) }}
              >
                {RAG_LABELS[getRagStatus(tooltip.project)]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{t("ganttPortfolio.tooltip.progress")}:</span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${tooltip.project.progress}%`,
                    backgroundColor: getRagColor(tooltip.project),
                  }}
                />
              </div>
              <span className="font-semibold">{tooltip.project.progress}%</span>
            </div>
            <div>
              <span className="text-gray-500">{t("ganttPortfolio.tooltip.start")}:</span>{" "}
              {format(new Date(tooltip.project.startDate), "d MMM yyyy", { locale: fr })}
              {" → "}
              <span className="text-gray-500">{t("ganttPortfolio.tooltip.end")}:</span>{" "}
              {tooltip.project.dueDate
                ? format(new Date(tooltip.project.dueDate), "d MMM yyyy", { locale: fr })
                : "—"}
            </div>
            {tooltip.project.projectManager && (
              <div>
                <span className="text-gray-500">{t("ganttPortfolio.tooltip.manager")}:</span>{" "}
                {tooltip.project.projectManager}
              </div>
            )}
            {tooltip.project.managerDepartment && (
              <div>
                <span className="text-gray-500">{t("ganttPortfolio.tooltip.service")}:</span>{" "}
                {tooltip.project.managerDepartment}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legende RAG */}
      <div className="flex gap-4 mt-4 justify-center flex-wrap">
        {[
          { key: 'onTrack' as const, color: RAG_COLORS.onTrack },
          { key: 'atRisk' as const, color: RAG_COLORS.atRisk },
          { key: 'late' as const, color: RAG_COLORS.late },
          { key: 'upcoming' as const, color: RAG_COLORS.upcoming },
          { key: 'completed' as const, color: RAG_COLORS.completed },
        ].map(({ key, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600">{t(`ganttPortfolio.rag.${key}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
