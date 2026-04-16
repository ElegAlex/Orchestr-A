"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ProjectIcon } from "@/components/ProjectIcon";

interface ProjectHealthTableProps {
  dateRange: string;
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  icon?: string | null;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  manager?: { id: string; firstName: string; lastName: string } | null;
  members?: Array<{
    userId: string;
    role: string;
    user?: { firstName: string; lastName: string };
  }>;
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
  | "progress"
  | "remaining"
  | "overdue"
  | "milestone"
  | "endDate"
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

interface ProjectRow {
  id: string;
  name: string;
  icon?: string | null;
  progress: number;
  remaining: number;
  overdue: number;
  nextMilestone: { name: string; date: string | null } | null;
  endDate: string | null;
  manager: string;
  rag: RagColor;
}

function computeRag(project: Project): RagColor {
  if (
    project.status === "COMPLETED" ||
    project.status === "CANCELLED"
  ) {
    return "grey";
  }

  const now = new Date();
  const start = project.startDate ? new Date(project.startDate) : null;
  const end = project.endDate ? new Date(project.endDate) : null;

  if (start && start > now) {
    return "blue";
  }

  if (!start || !end) {
    return "green"; // no dates, assume OK
  }

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return "green";

  const elapsedMs = now.getTime() - start.getTime();
  const timeElapsed = (elapsedMs / totalMs) * 100;
  const progress = project.progress ?? 0;

  if (progress >= timeElapsed - 10) return "green";
  if (progress >= timeElapsed - 25) return "orange";
  return "red";
}

export function ProjectHealthTable({
  dateRange,
  projectId,
}: ProjectHealthTableProps) {
  const t = useTranslations("admin.reports.analytics");
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rag");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const projectUrl = projectId
        ? `/projects?projectId=${projectId}`
        : "/projects";
      const taskUrl = projectId
        ? `/tasks?projectId=${projectId}`
        : "/tasks";
      const milestoneUrl = projectId
        ? `/milestones?projectId=${projectId}`
        : "/milestones";

      const [projRes, taskRes, msRes] = await Promise.all([
        api.get(projectUrl),
        api.get(taskUrl),
        api.get(milestoneUrl),
      ]);

      const projData = projRes.data;
      const taskData = taskRes.data;
      const msData = msRes.data;

      setProjects(
        Array.isArray(projData) ? projData : projData.data ?? []
      );
      setTasks(Array.isArray(taskData) ? taskData : taskData.data ?? []);
      setMilestones(Array.isArray(msData) ? msData : msData.data ?? []);
    } catch (err) {
      console.error("Error loading project health data:", err);
      setError("Impossible de charger les donnees de sante projet.");
    } finally {
      setLoading(false);
    }
  };

  const rows: ProjectRow[] = useMemo(() => {
    const now = new Date();

    return projects
      .filter((p) => (projectId ? p.id === projectId : true))
      .map((project) => {
        const projectTasks = tasks.filter(
          (t) => t.projectId === project.id
        );
        const remaining = projectTasks.filter(
          (t) => t.status !== "DONE"
        ).length;
        const overdue = projectTasks.filter(
          (t) =>
            t.status !== "DONE" &&
            t.endDate &&
            new Date(t.endDate) < now
        ).length;

        const projectMilestones = milestones
          .filter(
            (m) =>
              m.projectId === project.id &&
              m.dueDate &&
              new Date(m.dueDate) >= now
          )
          .sort(
            (a, b) =>
              new Date(a.dueDate!).getTime() -
              new Date(b.dueDate!).getTime()
          );

        const nextMs = projectMilestones[0] ?? null;

        // Find project manager
        const manager = project.manager
          ? `${project.manager.firstName} ${project.manager.lastName}`
          : "-";

        return {
          id: project.id,
          name: project.name,
          icon: project.icon,
          progress: project.progress ?? 0,
          remaining,
          overdue,
          nextMilestone: nextMs
            ? { name: nextMs.name, date: nextMs.dueDate }
            : null,
          endDate: project.endDate,
          manager,
          rag: computeRag(project),
        };
      });
  }, [projects, tasks, milestones, projectId]);

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
        case "progress":
          cmp = a.progress - b.progress;
          break;
        case "remaining":
          cmp = a.remaining - b.remaining;
          break;
        case "overdue":
          cmp = a.overdue - b.overdue;
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
        case "endDate": {
          const aEnd = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const bEnd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          cmp = aEnd - bEnd;
          break;
        }
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

  const SortHeader = ({
    label,
    sortKeyName,
    className = "",
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => handleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyName && (
          <span className="text-blue-600">
            {sortDir === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          <span className="mr-2">&#127973;</span>
          {t("projectHealth")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          <span className="mr-2">&#127973;</span>
          {t("projectHealth")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        <span className="mr-2">&#127973;</span>
        {t("projectHealth")}
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="RAG" sortKeyName="rag" className="w-16" />
              <SortHeader label="Projet" sortKeyName="name" />
              <SortHeader label="Progression" sortKeyName="progress" />
              <SortHeader
                label="Taches restantes"
                sortKeyName="remaining"
              />
              <SortHeader
                label="Taches en retard"
                sortKeyName="overdue"
              />
              <SortHeader
                label="Jalons a venir"
                sortKeyName="milestone"
              />
              <SortHeader label="Date de fin" sortKeyName="endDate" />
              <SortHeader
                label="Chef de projet"
                sortKeyName="manager"
              />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRows.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                {/* RAG dot */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${RAG_DOT_CLASSES[row.rag]}`}
                    title={row.rag.toUpperCase()}
                  />
                </td>

                {/* Project name */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/projects/${row.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1.5"
                  >
                    <ProjectIcon icon={row.icon} size={16} />
                    {row.name}
                  </Link>
                </td>

                {/* Progress bar */}
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

                {/* Remaining tasks */}
                <td className="px-4 py-3 text-sm text-gray-900 text-center">
                  {row.remaining}
                </td>

                {/* Overdue tasks */}
                <td className="px-4 py-3 text-center">
                  {row.overdue > 0 ? (
                    <button
                      onClick={() =>
                        router.push(`/tasks?projectId=${row.id}`)
                      }
                      className="text-sm font-semibold text-red-600 hover:text-red-800 hover:underline"
                    >
                      {row.overdue}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-900">0</span>
                  )}
                </td>

                {/* Next milestone */}
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
                            { locale: fr }
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

                {/* End date */}
                <td className="px-4 py-3 text-sm text-gray-900">
                  {row.endDate
                    ? format(new Date(row.endDate), "dd/MM/yyyy", {
                        locale: fr,
                      })
                    : "-"}
                </td>

                {/* Project manager */}
                <td className="px-4 py-3 text-sm text-gray-900">
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
