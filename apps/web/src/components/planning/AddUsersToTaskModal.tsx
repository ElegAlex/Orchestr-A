"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/UserAvatar";
import {
  predefinedTasksService,
  type PredefinedTask,
  type PredefinedTaskAssignment,
  type TaskDuration,
} from "@/services/predefined-tasks.service";
import type { UserSummary, Leave, TeleworkSchedule } from "@/types";

export interface AddUsersToTaskModalProps {
  task: PredefinedTask;
  date: Date;
  allUsers: UserSummary[];
  existingAssignments: PredefinedTaskAssignment[];
  leaves: Leave[];
  teleworkSchedules?: TeleworkSchedule[];
  onClose: () => void;
  onSuccess: () => void;
}

type EligibilityStatus =
  | "eligible"
  | "already_assigned"
  | "on_leave"
  | "on_telework";

interface EligibilityInfo {
  status: EligibilityStatus;
  leaveType?: string;
}

function computeEligibility(
  user: UserSummary,
  existingAssignments: PredefinedTaskAssignment[],
  leaves: Leave[],
  teleworkSchedules: TeleworkSchedule[],
  task: PredefinedTask,
  date: Date,
): EligibilityInfo {
  if (existingAssignments.some((a) => a.userId === user.id)) {
    return { status: "already_assigned" };
  }
  const userLeave = leaves.find((l) => {
    if (l.userId !== user.id) return false;
    if (l.status !== "APPROVED") return false;
    try {
      return isWithinInterval(date, {
        start: parseISO(l.startDate),
        end: parseISO(l.endDate),
      });
    } catch {
      return false;
    }
  });
  if (userLeave) {
    const leaveTypeCode =
      userLeave.leaveType?.code ?? userLeave.type ?? "OTHER";
    return { status: "on_leave", leaveType: leaveTypeCode };
  }
  if (!task.isTeleworkAllowed) {
    const userTelework = teleworkSchedules.find((schedule) => {
      if (schedule.userId !== user.id) return false;
      if (!schedule.isTelework) return false;
      try {
        return isSameDay(parseISO(schedule.date), date);
      } catch {
        return false;
      }
    });
    if (userTelework) return { status: "on_telework" };
  }
  return { status: "eligible" };
}

function toPeriod(
  duration: TaskDuration,
): "MORNING" | "AFTERNOON" | "FULL_DAY" {
  if (duration === "HALF_DAY") return "MORNING";
  return "FULL_DAY";
}

export function AddUsersToTaskModal({
  task,
  date,
  allUsers,
  existingAssignments,
  leaves,
  teleworkSchedules = [],
  onClose,
  onSuccess,
}: AddUsersToTaskModalProps) {
  const t = useTranslations("planning");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const sortedUsers = useMemo(
    () =>
      [...allUsers].sort((a, b) =>
        (a.lastName ?? "").localeCompare(b.lastName ?? "", "fr"),
      ),
    [allUsers],
  );

  const eligibility = useMemo(() => {
    const map = new Map<string, EligibilityInfo>();
    for (const u of sortedUsers) {
      map.set(
        u.id,
        computeEligibility(
          u,
          existingAssignments,
          leaves,
          teleworkSchedules,
          task,
          date,
        ),
      );
    }
    return map;
  }, [sortedUsers, existingAssignments, leaves, teleworkSchedules, task, date]);

  const eligibleCount = useMemo(
    () =>
      sortedUsers.filter((u) => eligibility.get(u.id)?.status === "eligible")
        .length,
    [sortedUsers, eligibility],
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    setSubmitting(true);
    try {
      await predefinedTasksService.bulkAssign({
        predefinedTaskId: task.id,
        userIds: Array.from(selectedUserIds),
        dates: [format(date, "yyyy-MM-dd")],
        period: toPeriod(task.defaultDuration),
      });
      toast.success(
        t("activityGrid.addUsersModal.successToast", {
          count: selectedUserIds.size,
        }),
      );
      onSuccess();
      onClose();
    } catch {
      toast.error(t("activityGrid.addUsersModal.errorToast"));
    } finally {
      setSubmitting(false);
    }
  };

  const dateLabel = format(date, "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("activityGrid.addUsersModal.title")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("activityGrid.addUsersModal.subtitle", {
                taskName: task.name,
                date: dateLabel,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label={t("activityGrid.addUsersModal.cancel")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        {eligibleCount === 0 && (
          <p className="text-sm text-gray-500 italic text-center py-4">
            {t("activityGrid.addUsersModal.noEligibleUsers")}
          </p>
        )}
        {sortedUsers.length > 0 && (
          <ul className="space-y-1 max-h-80 overflow-y-auto" role="list">
            {sortedUsers.map((user) => {
              const info = eligibility.get(user.id)!;
              const isAlreadyAssigned = info.status === "already_assigned";
              const isOnLeave = info.status === "on_leave";
              const isOnTelework = info.status === "on_telework";
              const disabled = isAlreadyAssigned || isOnLeave || isOnTelework;
              const checked = isAlreadyAssigned || selectedUserIds.has(user.id);
              const firstName = user.firstName ?? "";
              const lastName = (user.lastName ?? "").toUpperCase();
              return (
                <li
                  key={user.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded ${disabled ? "opacity-50" : "hover:bg-blue-50 cursor-pointer"}`}
                  onClick={() => !disabled && toggleUser(user.id)}
                >
                  <input
                    type="checkbox"
                    data-user-id={user.id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => !disabled && toggleUser(user.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-blue-600"
                  />
                  <UserAvatar user={user} size="sm" />
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="font-normal text-zinc-700">
                      {firstName}
                    </span>{" "}
                    <span className="font-semibold text-zinc-900">
                      {lastName}
                    </span>
                  </span>
                  {isAlreadyAssigned && (
                    <span className="text-xs italic text-gray-400">
                      {t("activityGrid.addUsersModal.alreadyAssigned")}
                    </span>
                  )}
                  {isOnLeave && (
                    <span className="text-xs italic text-gray-400">
                      {t("activityGrid.addUsersModal.onLeave", {
                        type: info.leaveType ?? "",
                      })}
                    </span>
                  )}
                  {isOnTelework && (
                    <span className="text-xs italic text-gray-400">
                      {t("activityGrid.addUsersModal.onTelework")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <span className="text-xs text-gray-500">
            {t("activityGrid.addUsersModal.selectedCount", {
              count: selectedUserIds.size,
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {t("activityGrid.addUsersModal.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedUserIds.size === 0 || submitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? t("activityGrid.addUsersModal.submitting")
                : t("activityGrid.addUsersModal.submit", {
                    count: selectedUserIds.size,
                  })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
