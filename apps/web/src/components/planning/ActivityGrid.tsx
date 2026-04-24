"use client";

/**
 * ActivityGrid — W4.3
 * Vue Activité : pivot jours-lignes × tâches-colonnes.
 * Variante B validée PO : lignes aérées, avatars 32px avec overlap,
 * badge statut pill textuel à droite du groupe d'avatars.
 * Option A (minimaliste) : read-only, pas d'interaction clic.
 */

import "./ActivityGrid.print.css";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Printer, Check, Clock, AlertTriangle, Minus, Circle } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { isAssignmentLate } from "@/components/planning/DayCell";
import type {
  PredefinedTask,
  PredefinedTaskAssignment,
  CompletionStatus,
} from "@/services/predefined-tasks.service";
import type { UserSummary } from "@/types";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ActivityGridProps {
  days: Date[];
  tasks: PredefinedTask[];
  assignments: PredefinedTaskAssignment[];
  users: UserSummary[];
  lateThresholdDays: number;
  currentUserId: string;
  onAssignmentStatusChanged?: () => void;
  isHoliday?: (date: Date) => boolean;
  isWeekend?: (date: Date) => boolean;
}

// ─── Status pill (inline, read-only, variante B) ─────────────────────────────

type EffectiveStatus = CompletionStatus | "LATE";

/**
 * Ordre de sévérité pour "pire statut" :
 * LATE > NOT_DONE > IN_PROGRESS > DONE > NOT_APPLICABLE
 */
const STATUS_SEVERITY: Record<EffectiveStatus, number> = {
  LATE: 5,
  NOT_DONE: 4,
  IN_PROGRESS: 3,
  DONE: 2,
  NOT_APPLICABLE: 1,
};

function getWorstStatus(statuses: EffectiveStatus[]): EffectiveStatus {
  if (statuses.length === 0) return "NOT_DONE";
  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst,
  );
}

interface StatusPillProps {
  status: EffectiveStatus;
}

/**
 * Pill statut read-only (variant B : icône + libellé textuel court).
 * N'utilise PAS AssignmentStatusBadge qui est interactif (week/month mode).
 */
function StatusPill({ status }: StatusPillProps) {
  const t = useTranslations("planning");

  const CONFIG: Record<
    EffectiveStatus,
    {
      bg: string;
      text: string;
      Icon: React.ComponentType<{ className?: string }>;
      labelKey: string;
    }
  > = {
    DONE: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      Icon: Check,
      labelKey: "status.DONE",
    },
    IN_PROGRESS: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      Icon: Clock,
      labelKey: "status.IN_PROGRESS",
    },
    NOT_DONE: {
      bg: "bg-zinc-100",
      text: "text-zinc-600",
      Icon: Circle,
      labelKey: "status.NOT_DONE",
    },
    LATE: {
      bg: "bg-red-50",
      text: "text-red-700",
      Icon: AlertTriangle,
      labelKey: "status.LATE",
    },
    NOT_APPLICABLE: {
      bg: "bg-violet-50",
      text: "text-violet-700",
      Icon: Minus,
      labelKey: "status.NOT_APPLICABLE",
    },
  };

  const { bg, text, Icon, labelKey } = CONFIG[status];
  const label = t(labelKey as Parameters<ReturnType<typeof useTranslations>>[0]);

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── AvatarStack ─────────────────────────────────────────────────────────────

const MAX_VISIBLE_AVATARS = 3;

interface AvatarStackProps {
  users: UserSummary[];
}

function AvatarStack({ users }: AvatarStackProps) {
  const visible = users.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((u, idx) => (
          <div
            key={u.id}
            className="ring-2 ring-white rounded-full"
            style={{ zIndex: MAX_VISIBLE_AVATARS - idx }}
          >
            {/* size="sm" = 28px — le plus proche des 32px du mockup sans hacker le composant */}
            <UserAvatar user={u} size="sm" />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1 text-[10px] text-zinc-500 font-medium">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ─── ActivityGrid ─────────────────────────────────────────────────────────────

export function ActivityGrid({
  days,
  tasks,
  assignments,
  users,
  lateThresholdDays,
  isHoliday,
  isWeekend,
}: ActivityGridProps) {
  const t = useTranslations("planning");
  const now = new Date();

  // Map userId → UserSummary pour résolution rapide
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // Map (predefinedTaskId + date-iso) → assignments[]
  const assignmentIndex = useMemo(() => {
    const idx = new Map<string, PredefinedTaskAssignment[]>();
    for (const a of assignments) {
      const dateKey = typeof a.date === "string"
        ? a.date.slice(0, 10)
        : format(a.date as unknown as Date, "yyyy-MM-dd");
      const key = `${a.predefinedTaskId}::${dateKey}`;
      const bucket = idx.get(key) ?? [];
      bucket.push(a);
      idx.set(key, bucket);
    }
    return idx;
  }, [assignments]);

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
        {t("activityGrid.emptyState" as Parameters<typeof t>[0])}
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="activity-grid space-y-2">
      {/* Toolbar (no-print) */}
      <div className="activity-grid-no-print no-print flex items-center justify-end">
        <button
          type="button"
          aria-label={t("activityGrid.print" as Parameters<typeof t>[0])}
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <Printer className="w-3.5 h-3.5" />
          {t("activityGrid.print" as Parameters<typeof t>[0])}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-zinc-200 shadow-sm">
        <table className="border-collapse w-full text-xs activity-grid">
          <caption className="sr-only">
            {t("activityGrid.caption" as Parameters<typeof t>[0])}
          </caption>

          {/* ── thead ── */}
          <thead
            className="sticky top-0 z-20 bg-zinc-50 border-b-2 border-zinc-200"
          >
            <tr>
              {/* Date column header */}
              <th
                scope="col"
                className="sticky left-0 z-30 bg-zinc-50 border-r-2 border-zinc-200 px-4 py-3 text-left text-zinc-500 font-semibold min-w-[108px]"
              >
                {t("activityGrid.dateCol" as Parameters<typeof t>[0])}
              </th>

              {/* Task column headers */}
              {tasks.map((task, idx) => (
                <th
                  key={task.id}
                  scope="col"
                  className={`px-3 py-3 text-center min-w-[110px] font-semibold text-zinc-700${
                    idx < tasks.length - 1 ? " border-r border-zinc-200" : ""
                  }`}
                >
                  <span
                    className="block leading-tight"
                    style={{ wordBreak: "break-word", maxWidth: "8rem", margin: "0 auto" }}
                  >
                    {task.icon && (
                      <span className="mr-0.5" aria-hidden>
                        {task.icon}
                      </span>
                    )}
                    {task.name}
                  </span>
                  {/* Weight badge */}
                  <span className="mt-1 inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Poids <strong>{task.weight}</strong>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── tbody ── */}
          <tbody>
            {days.map((day, rowIdx) => {
              const dateIso = format(day, "yyyy-MM-dd");
              const holiday = isHoliday?.(day) ?? false;
              const weekend = isWeekend?.(day) ?? false;
              const isOffDay = holiday || weekend;
              const isToday =
                format(day, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");

              const rowClasses = [
                "border-b border-zinc-100",
                isOffDay
                  ? "bg-zinc-100 text-zinc-400"
                  : isToday
                    ? "bg-blue-50"
                    : "hover:bg-zinc-50",
              ].join(" ");

              const dayLabel = format(day, "EEEE", { locale: fr })
                .slice(0, 3)
                .replace(/^\w/, (c) => c.toUpperCase());
              const dateLabel = format(day, "dd MMM", { locale: fr });

              return (
                <tr key={dateIso} className={rowClasses}>
                  {/* Row header: date */}
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 border-r-2 border-zinc-200 px-4 py-3 text-left font-semibold whitespace-nowrap${
                      isOffDay
                        ? " bg-zinc-100"
                        : isToday
                          ? " bg-blue-50 text-blue-700"
                          : " bg-white text-zinc-700"
                    }`}
                  >
                    <div
                      className={`text-xs font-normal ${
                        isToday ? "text-blue-400" : "text-zinc-400"
                      }`}
                    >
                      {dayLabel}
                    </div>
                    <div>{dateLabel}</div>
                  </th>

                  {/* Task cells */}
                  {tasks.map((task, colIdx) => {
                    const key = `${task.id}::${dateIso}`;
                    const cellAssignments = assignmentIndex.get(key) ?? [];

                    if (isOffDay) {
                      // On holidays/weekends, show a merge-like empty cell
                      if (colIdx === 0) {
                        return (
                          <td
                            key={task.id}
                            colSpan={tasks.length}
                            className="px-3 py-3 text-center text-zinc-400 italic text-xs"
                          >
                            —
                          </td>
                        );
                      }
                      return null; // merged
                    }

                    if (cellAssignments.length === 0) {
                      return (
                        <td
                          key={task.id}
                          className={`px-3 py-3 text-zinc-300 text-center bg-zinc-50${
                            colIdx < tasks.length - 1
                              ? " border-r border-zinc-100"
                              : ""
                          }`}
                        >
                          {t("activityGrid.emptyCell" as Parameters<typeof t>[0])}
                        </td>
                      );
                    }

                    // Resolve users for this cell
                    const cellUsers = cellAssignments
                      .map((a) => userMap.get(a.userId))
                      .filter((u): u is UserSummary => u !== undefined);

                    // Compute worst effective status (Option A — single badge)
                    const effectiveStatuses: EffectiveStatus[] =
                      cellAssignments.map((a) => {
                        const late = isAssignmentLate(a, now, lateThresholdDays);
                        return late ? "LATE" : a.completionStatus;
                      });
                    const worstStatus = getWorstStatus(effectiveStatuses);

                    return (
                      <td
                        key={task.id}
                        className={`px-3 py-3${
                          colIdx < tasks.length - 1
                            ? " border-r border-zinc-100"
                            : ""
                        }`}
                      >
                        {/* Variante B layout: avatars group + badge pill à droite */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <AvatarStack users={cellUsers} />
                          <StatusPill status={worstStatus} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
