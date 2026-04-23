"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { ProjectIcon } from "@/components/ProjectIcon";
import { ProjectDetail } from "../types";

interface ProjectsDetailTableProps {
  projects: ProjectDetail[];
  dateRange: string;
  projectId?: string;
}

interface Task {
  id: string;
  status: string;
  projectId: string | null;
  endDate: string | null;
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string | null;
  projectId: string;
  status?: string;
}

type SortKey =
  | "rag"
  | "name"
  | "status"
  | "progress"
  | "tasks"
  | "milestone"
  | "dueDate"
  | "hours"
  | "manager";
type SortDir = "asc" | "desc";

type RagColor = "red" | "orange" | "green" | "blue" | "grey";

const RAG_ORDER: Record<RagColor, number> = {
  red: 0,
  orange: 1,
  green: 2,
  blue: 3,
  grey: 4,
};

const RAG_DOT_CLASSES: Record<RagColor, string> = {
  red: "bg-[#ef4444]",
  orange: "bg-[#f59e0b]",
  green: "bg-[#22c55e]",
  blue: "bg-[#60a5fa]",
  grey: "bg-[#9ca3af]",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface Row {
  id: string;
  name: string;
  icon?: string | null;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  nextMilestone: { name: string; date: string | null } | null;
  dueDate: string | null;
  isOverdue: boolean;
  loggedHours: number;
  budgetHours: number;
  manager: string;
  rag: RagColor;
}

function computeRag(
  project: ProjectDetail,
): RagColor {
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    return "grey";
  }

  const now = new Date();
  const start = project.startDate ? new Date(project.startDate) : null;
  const end = project.dueDate ? new Date(project.dueDate) : null;

  if (start && start > now) return "blue";
  if (!start || !end) return "green";

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return "green";

  const elapsedMs = now.getTime() - start.getTime();
  const timeElapsed = (elapsedMs / totalMs) * 100;
  const progress = project.progress ?? 0;

  if (progress >= timeElapsed - 10) return "green";
  if (progress >= timeElapsed - 25) return "orange";
  return "red";
}

function SortHeader({
  label,
  sortKeyName,
  className = "",
  align = "left",
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  className?: string;
  align?: "left" | "center" | "right";
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className={`px-4 py-3 text-${align} text-xs font-semibold text-gray-900 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => onSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyName && (
          <span className="text-blue-600">
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </span>
    </th>
  );
}

export function ProjectsDetailTable({
  projects,
  dateRange,
  projectId,
}: ProjectsDetailTableProps) {
  const t = useTranslations("admin.reports.analytics");
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("rag");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const load = async () => {
      try {
        const taskUrl = projectId ? `/tasks?projectId=${projectId}` : "/tasks";
        const milestoneUrl = projectId
          ? `/milestones?projectId=${projectId}`
          : "/milestones";
        const [taskRes, msRes] = await Promise.all([
          api.get(taskUrl),
          api.get(milestoneUrl),
        ]);
        const taskData = taskRes.data;
        const msData = msRes.data;
        setTasks(Array.isArray(taskData) ? taskData : taskData.data ?? []);
        setMilestones(Array.isArray(msData) ? msData : msData.data ?? []);
      } catch (err) {
        console.error("Error loading projects detail data:", err);
      }
    };
    load();
  }, [dateRange, projectId]);

  const rows: Row[] = useMemo(() => {
    const now = new Date();
    return projects.map((project) => {
      const projectTasks = tasks.filter((tk) => tk.projectId === project.id);
      const overdueTasks = projectTasks.filter(
        (tk) =>
          tk.status !== "DONE" && tk.endDate && new Date(tk.endDate) < now,
      ).length;

      const nextMs =
        milestones
          .filter(
            (m) =>
              m.projectId === project.id &&
              m.dueDate &&
              new Date(m.dueDate) >= now,
          )
          .sort(
            (a, b) =>
              new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
          )[0] ?? null;

      return {
        id: project.id,
        name: project.name,
        icon: project.icon,
        status: project.status,
        progress: project.progress ?? 0,
        totalTasks: project.totalTasks,
        completedTasks: project.completedTasks,
        overdueTasks,
        nextMilestone: nextMs
          ? { name: nextMs.name, date: nextMs.dueDate }
          : null,
        dueDate: project.dueDate ?? null,
        isOverdue: project.isOverdue,
        loggedHours: project.loggedHours,
        budgetHours: project.budgetHours,
        manager: project.manager
          ? `${project.manager.firstName} ${project.manager.lastName}`
          : "-",
        rag: computeRag(project),
      };
    });
  }, [projects, tasks, milestones]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "rag":
          cmp = RAG_ORDER[a.rag] - RAG_ORDER[b.rag];
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "progress":
          cmp = a.progress - b.progress;
          break;
        case "tasks":
          cmp = a.completedTasks - b.completedTasks;
          break;
        case "milestone": {
          const aDate = a.nextMilestone?.date
            ? new Date(a.nextMilestone.date).getTime()
            : Infinity;
          const bDate = b.nextMilestone?.date
            ? new Date(b.nextMilestone.date).getTime()
            : Infinity;
          cmp = aDate - bDate;
          break;
        }
        case "dueDate": {
          const aEnd = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bEnd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = aEnd - bEnd;
          break;
        }
        case "hours":
          cmp = a.loggedHours - b.loggedHours;
          break;
        case "manager":
          cmp = a.manager.localeCompare(b.manager);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (sortedRows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Détail des projets</h3>
        <p className="text-sm text-gray-500 text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Détail des projets</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="RAG" sortKeyName="rag" className="w-16" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Projet" sortKeyName="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Statut" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Progression" sortKeyName="progress" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader
                label="Tâches"
                sortKeyName="tasks"
                align="center"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader label="Prochain jalon" sortKeyName="milestone" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Échéance" sortKeyName="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader
                label="Heures"
                sortKeyName="hours"
                align="right"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader label="Chef de projet" sortKeyName="manager" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRows.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${RAG_DOT_CLASSES[row.rag]}`}
                    title={row.rag.toUpperCase()}
                  />
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/projects/${row.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1.5"
                  >
                    <ProjectIcon icon={row.icon} size={16} />
                    {row.name}
                  </Link>
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      STATUS_COLORS[row.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {row.status.replace("_", " ").toUpperCase()}
                  </span>
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(row.progress, 100)}%`,
                          backgroundColor:
                            row.progress >= 75
                              ? "#22c55e"
                              : row.progress >= 40
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-10 text-right">
                      {row.progress}%
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3 text-sm text-gray-900 text-center whitespace-nowrap">
                  <span>
                    {row.completedTasks}/{row.totalTasks}
                  </span>
                  {row.overdueTasks > 0 && (
                    <>
                      <span className="text-gray-400"> · </span>
                      <button
                        onClick={() =>
                          router.push(`/tasks?projectId=${row.id}&overdue=true`)
                        }
                        className="font-semibold text-red-600 hover:text-red-800 hover:underline"
                      >
                        {row.overdueTasks} en retard
                      </button>
                    </>
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-gray-900">
                  {row.nextMilestone ? (
                    <div>
                      <span className="font-medium">
                        {row.nextMilestone.name}
                      </span>
                      {row.nextMilestone.date && (
                        <span className="text-gray-500 ml-1">
                          (
                          {format(
                            new Date(row.nextMilestone.date),
                            "dd/MM/yyyy",
                            { locale: fr },
                          )}
                          )
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">
                      {t("noMilestone")}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {row.dueDate ? (
                      <span
                        className={
                          row.isOverdue
                            ? "text-red-600 font-semibold"
                            : "text-gray-900"
                        }
                      >
                        {format(new Date(row.dueDate), "dd/MM/yyyy", {
                          locale: fr,
                        })}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Non définie</span>
                    )}
                    {row.isOverdue && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Retard
                      </span>
                    )}
                  </div>
                </td>

                <td
                  className={`px-4 py-3 whitespace-nowrap text-right text-sm ${
                    row.loggedHours > row.budgetHours
                      ? "text-red-600 font-semibold"
                      : "text-gray-900"
                  }`}
                >
                  {row.loggedHours}h / {row.budgetHours}h
                </td>

                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                  {row.manager}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
