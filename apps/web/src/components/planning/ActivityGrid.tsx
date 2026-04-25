"use client";

/**
 * ActivityGrid — W4.3 + W6.2 (refonte cellule nom+prénom)
 *
 * Vue Activité : pivot jours-lignes × tâches-colonnes.
 * Cellule = liste verticale des agents assignés (avatar 20px + Prénom NOM),
 * max 3 visibles, "+N autres" en bas si surplus.
 *
 * Plus de status d'exécution / alerte retard / canUpdate (W6.1) — les tâches
 * prédéfinies n'ont pas de notion de réalisation.
 */

import "./ActivityGrid.print.css";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Printer } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type {
  PredefinedTask,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";
import type { UserSummary, Leave } from "@/types";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ActivityGridProps {
  days: Date[];
  tasks: PredefinedTask[];
  assignments: PredefinedTaskAssignment[];
  users: UserSummary[];
  leaves?: Leave[];
  canAssign?: boolean;
  onAddUsers?: (taskId: string, dateIso: string) => void;
  isHoliday?: (date: Date) => boolean;
  isWeekend?: (date: Date) => boolean;
}

// ─── Cell user row (avatar + Prénom NOM) ─────────────────────────────────────

interface UserRowItemProps {
  user: UserSummary;
}

function UserRowItem({ user }: UserRowItemProps) {
  const firstName = user.firstName ?? "";
  const lastName = (user.lastName ?? "").toUpperCase();
  return (
    <li className="flex items-center gap-2 py-0.5 text-xs leading-tight">
      <UserAvatar user={user} size="sm" />
      <span className="min-w-0 truncate">
        <span className="font-normal text-zinc-700">{firstName}</span>{" "}
        <span className="font-semibold text-zinc-900">{lastName}</span>
      </span>
    </li>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const MAX_VISIBLE_USERS = 3;

export function ActivityGrid({
  days,
  tasks,
  assignments,
  users,
  leaves: _leaves,
  canAssign = false,
  onAddUsers,
  isHoliday,
  isWeekend,
}: ActivityGridProps) {
  const t = useTranslations("planning");
  const now = useMemo(() => new Date(), []);

  // Map userId → UserSummary pour résolution rapide
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // Map (predefinedTaskId + date-iso) → assignments[]
  const assignmentIndex = useMemo(() => {
    const idx = new Map<string, PredefinedTaskAssignment[]>();
    for (const a of assignments) {
      const dateKey =
        typeof a.date === "string"
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="activity-grid space-y-2">
      {/* Toolbar */}
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

          {/* thead */}
          <thead className="sticky top-0 z-20 bg-zinc-50 border-b-2 border-zinc-200">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 bg-zinc-50 border-r-2 border-zinc-200 px-4 py-3 text-left text-zinc-500 font-semibold min-w-[108px]"
              >
                {t("activityGrid.dateCol" as Parameters<typeof t>[0])}
              </th>

              {tasks.map((task, idx) => (
                <th
                  key={task.id}
                  scope="col"
                  className={`px-3 py-3 text-center min-w-[160px] font-semibold text-zinc-700${
                    idx < tasks.length - 1 ? " border-r border-zinc-200" : ""
                  }`}
                >
                  <span
                    className="block leading-tight"
                    style={{
                      wordBreak: "break-word",
                      maxWidth: "10rem",
                      margin: "0 auto",
                    }}
                  >
                    {task.icon && (
                      <span className="mr-0.5" aria-hidden>
                        {task.icon}
                      </span>
                    )}
                    {task.name}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Poids <strong>{task.weight}</strong>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* tbody */}
          <tbody>
            {days.map((day) => {
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

                  {tasks.map((task, colIdx) => {
                    const key = `${task.id}::${dateIso}`;
                    const cellAssignments = assignmentIndex.get(key) ?? [];

                    if (isOffDay) {
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
                      return null;
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
                          {canAssign && onAddUsers ? (
                            <button
                              type="button"
                              onClick={() => onAddUsers(task.id, dateIso)}
                              className="no-print text-xs text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5 transition"
                            >
                              + {t("activityGrid.addUsers" as Parameters<typeof t>[0])}
                            </button>
                          ) : (
                            t("activityGrid.emptyCell" as Parameters<typeof t>[0])
                          )}
                        </td>
                      );
                    }

                    // Liste verticale agents (avatar + Prénom NOM)
                    const cellUsers = cellAssignments
                      .map((a) => userMap.get(a.userId))
                      .filter((u): u is UserSummary => u !== undefined);

                    const visible = cellUsers.slice(0, MAX_VISIBLE_USERS);
                    const overflow = cellUsers.length - visible.length;

                    return (
                      <td
                        key={task.id}
                        className={`px-3 py-2 align-top${
                          colIdx < tasks.length - 1
                            ? " border-r border-zinc-100"
                            : ""
                        }`}
                      >
                        <ul className="space-y-0.5">
                          {visible.map((u) => (
                            <UserRowItem key={u.id} user={u} />
                          ))}
                          {overflow > 0 && (
                            <li className="pl-7 text-[10px] text-zinc-500 italic">
                              {t("activityGrid.moreUsers" as Parameters<typeof t>[0], {
                                count: overflow,
                              })}
                            </li>
                          )}
                          {canAssign && onAddUsers && (
                            <li className="no-print pt-1">
                              <button
                                type="button"
                                onClick={() => onAddUsers(task.id, dateIso)}
                                className="text-xs text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5 transition"
                              >
                                + {t("activityGrid.addUsers" as Parameters<typeof t>[0])}
                              </button>
                            </li>
                          )}
                        </ul>
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
