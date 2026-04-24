"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { usePlanningBalancer } from "@/hooks/usePlanningBalancer";
import {
  predefinedTasksService,
  PredefinedTask,
  BalancerResult,
} from "@/services/predefined-tasks.service";
import { servicesService } from "@/services/services.service";
import { usersService } from "@/services/users.service";
import { Service, User } from "@/types";

// ── Props ────────────────────────────────────────────────────────────────────

export interface BalancedPlanningModalProps {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
  defaultTaskIds?: string[];
  defaultUserIds?: string[];
  defaultServiceId?: string;
}

// ── Equity badge helper ───────────────────────────────────────────────────────

function EquityBadge({ ratio }: { ratio: number }) {
  const t = useTranslations("predefinedTasks.balancer.preview");
  let colorClass =
    "bg-red-50 border-red-200 text-red-700";
  if (ratio >= 0.85) {
    colorClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
  } else if (ratio >= 0.7) {
    colorClass = "bg-amber-50 border-amber-200 text-amber-700";
  }

  return (
    <span
      data-testid="equity-badge"
      data-ratio={ratio}
      className={`inline-flex items-center gap-1 border px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}
    >
      {t("equityRatio")} : {ratio.toFixed(2)}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BalancedPlanningModal({
  open,
  onClose,
  onApplied,
  defaultTaskIds = [],
  defaultUserIds = [],
  defaultServiceId,
}: BalancedPlanningModalProps) {
  const t = useTranslations("predefinedTasks.balancer");

  // Config state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [serviceId, setServiceId] = useState(defaultServiceId ?? "");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(defaultUserIds);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(defaultTaskIds);

  // Data state
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<PredefinedTask[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Preview result
  const [previewResult, setPreviewResult] = useState<BalancerResult | null>(null);

  const { preview, apply, isPending } = usePlanningBalancer({ onApplied });

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);

    Promise.all([
      servicesService.getAll(),
      usersService.getAll() as Promise<User[]>,
      predefinedTasksService.getAll(),
    ])
      .then(([svcList, userList, taskRes]) => {
        setServices(svcList);
        const allUsers = Array.isArray(userList)
          ? (userList as User[])
          : (userList as { data: User[] }).data ?? [];
        setUsers(allUsers.filter((u) => u.isActive));
        const taskList = Array.isArray(taskRes)
          ? (taskRes as PredefinedTask[])
          : (taskRes as { data: PredefinedTask[] }).data ?? [];
        setTasks(taskList.filter((t) => t.isActive));
      })
      .catch(() => {
        /* silent — user will see empty selects */
      })
      .finally(() => setLoadingData(false));
  }, [open]);

  // Filter users by service when serviceId changes
  const filteredUsers =
    serviceId
      ? users.filter(
          (u) =>
            u.userServices?.some((us) => us.service.id === serviceId),
        )
      : users;

  const toggleUserId = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleTaskId = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Validation
  const validate = (): boolean => {
    if (!startDate || !endDate || startDate > endDate) {
      toast.error(t("config.validation.datesInvalid"));
      return false;
    }
    if (!serviceId && selectedUserIds.length === 0) {
      toast.error(t("config.validation.noAgent"));
      return false;
    }
    if (selectedTaskIds.length === 0) {
      toast.error(t("config.validation.noTask"));
      return false;
    }
    return true;
  };

  const buildDto = () => ({
    startDate,
    endDate,
    serviceId: serviceId || undefined,
    userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
    taskIds: selectedTaskIds,
    mode: "preview" as const,
  });

  const handlePreview = async () => {
    if (!validate()) return;
    const result = await preview(buildDto());
    if (result) setPreviewResult(result);
  };

  const handleApply = async () => {
    if (!previewResult || !validate()) return;
    const result = await apply({ ...buildDto(), mode: "apply" });
    if (result) {
      onClose();
    }
  };

  // Group proposed assignments by agent for display
  const assignmentsByAgent = previewResult
    ? previewResult.proposedAssignments.reduce<Record<string, typeof previewResult.proposedAssignments>>(
        (acc, a) => {
          if (!acc[a.userId]) acc[a.userId] = [];
          acc[a.userId].push(a);
          return acc;
        },
        {},
      )
    : {};

  const maxLoad =
    previewResult && previewResult.workloadByAgent.length > 0
      ? Math.max(...previewResult.workloadByAgent.map((a) => a.weightedLoad))
      : 1;

  const getUserName = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : userId;
  };

  const getTaskName = (taskId: string) => {
    const task = tasks.find((x) => x.id === taskId);
    return task ? task.name : taskId;
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-zinc-900/50 z-40" />
        <Dialog.Content
          aria-label={t("title")}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onEscapeKeyDown={onClose}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-blue-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
                <Dialog.Title className="font-semibold text-zinc-900 text-base">
                  {t("title")}
                </Dialog.Title>
              </div>
              <Dialog.Close
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                aria-label="Fermer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Body — split layout C */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left column — config (sticky) */}
              <aside
                aria-label="Configuration"
                className="w-[360px] flex-shrink-0 border-r border-zinc-100 px-5 py-5 space-y-5 overflow-y-auto"
              >
                <p className="text-xs text-zinc-500">{t("description")}</p>

                {/* Date range */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-zinc-700">
                    {t("config.range")}
                  </legend>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 block mb-0.5">
                        {t("config.startDate")}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        aria-label={t("config.startDate")}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500 block mb-0.5">
                        {t("config.endDate")}
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        aria-label={t("config.endDate")}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Service */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 block">
                    {t("config.service")}
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => {
                      setServiceId(e.target.value);
                      setSelectedUserIds([]);
                    }}
                    aria-label={t("config.service")}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— {t("config.service")} —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Users multi-select */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 block">
                    {t("config.users")}
                  </label>
                  <div
                    aria-label={t("config.users")}
                    className="border border-zinc-200 rounded-lg p-2 bg-zinc-50 max-h-32 overflow-y-auto space-y-1"
                  >
                    {loadingData ? (
                      <span className="text-xs text-zinc-400">
                        {t("preview.loading")}
                      </span>
                    ) : filteredUsers.length === 0 ? (
                      <span className="text-xs text-zinc-400 italic">
                        Aucun agent disponible
                      </span>
                    ) : (
                      filteredUsers.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-100 rounded px-1 py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleUserId(u.id)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600"
                          />
                          {u.firstName} {u.lastName}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Tasks multi-select */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 block">
                    {t("config.tasks")}
                  </label>
                  <div
                    aria-label={t("config.tasks")}
                    className="border border-zinc-200 rounded-lg p-2 bg-zinc-50 max-h-32 overflow-y-auto space-y-1"
                  >
                    {loadingData ? (
                      <span className="text-xs text-zinc-400">
                        {t("preview.loading")}
                      </span>
                    ) : tasks.length === 0 ? (
                      <span className="text-xs text-zinc-400 italic">
                        Aucune tâche active
                      </span>
                    ) : (
                      tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-100 rounded px-1 py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={() => toggleTaskId(task.id)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600"
                          />
                          <span>{task.icon}</span>
                          <span className="flex-1 truncate">{task.name}</span>
                          <span className="text-xs text-zinc-400">×{task.weight}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handlePreview}
                    disabled={isPending}
                    aria-label={t("config.preview")}
                    className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition"
                  >
                    {isPending ? t("preview.loading") : t("config.preview")}
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!previewResult || isPending}
                    aria-label={t("config.apply")}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition"
                  >
                    {t("config.apply")}
                  </button>
                </div>
              </aside>

              {/* Right column — preview (scrollable) */}
              <section
                aria-label="Aperçu"
                aria-live="polite"
                className="flex-1 overflow-y-auto px-6 py-5"
              >
                {!previewResult && !isPending && (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <p className="text-sm text-zinc-400 italic text-center">
                      {t("preview.empty")}
                    </p>
                  </div>
                )}

                {isPending && (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <span className="ml-3 text-sm text-zinc-500">
                      {t("preview.loading")}
                    </span>
                  </div>
                )}

                {previewResult && !isPending && (
                  <div className="space-y-6">
                    {/* Equity header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                        {t("preview.workloadByAgent")}
                      </h3>
                      <EquityBadge ratio={previewResult.equityRatio} />
                    </div>

                    {/* Low equity warning */}
                    {previewResult.equityRatio < 0.7 && (
                      <div
                        role="alert"
                        className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {t("preview.warningLowEquity")}
                      </div>
                    )}

                    {/* Workload table */}
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <table
                        role="table"
                        className="w-full text-sm"
                      >
                        <caption className="sr-only">
                          {t("preview.workloadByAgent")}
                        </caption>
                        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">
                              {t("preview.agent")}
                            </th>
                            <th className="text-right px-4 py-2 font-medium">
                              {t("preview.load")}
                            </th>
                            <th className="text-right px-4 py-2 font-medium">
                              {t("preview.count")}
                            </th>
                            <th className="px-4 py-2 font-medium w-28">
                              %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {previewResult.workloadByAgent.map((row) => {
                            const agentAssignments =
                              assignmentsByAgent[row.userId] ?? [];
                            const pct =
                              maxLoad > 0
                                ? Math.round((row.weightedLoad / maxLoad) * 100)
                                : 0;
                            return (
                              <tr key={row.userId} className="hover:bg-zinc-50">
                                <td className="px-4 py-2.5 font-medium">
                                  {getUserName(row.userId)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-zinc-700">
                                  {row.weightedLoad}
                                </td>
                                <td className="px-4 py-2.5 text-right text-zinc-700">
                                  {agentAssignments.length}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="bg-zinc-100 rounded-full h-2 w-full">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Proposed assignments by agent */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                        {t("preview.proposedAssignments")}
                      </h4>
                      {Object.entries(assignmentsByAgent).map(
                        ([userId, agentAssignments]) => (
                          <details key={userId} className="border border-zinc-200 rounded-lg">
                            <summary className="px-4 py-2.5 cursor-pointer text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                              {getUserName(userId)} ({agentAssignments.length})
                            </summary>
                            <div className="px-4 py-2 space-y-1">
                              {agentAssignments.map((a, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs text-zinc-600 py-0.5"
                                >
                                  <span>{a.date}</span>
                                  <span className="text-zinc-500">{a.period}</span>
                                  <span className="font-medium">
                                    {getTaskName(a.taskId)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ),
                      )}
                    </div>

                    {/* Unassigned occurrences */}
                    {previewResult.unassignedOccurrences.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
                          {t("preview.unassignedOccurrences")} (
                          {previewResult.unassignedOccurrences.length})
                        </h4>
                        <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">
                          {previewResult.unassignedOccurrences.map((uo, i) => (
                            <div key={i} className="text-xs text-red-700 flex justify-between">
                              <span>
                                {uo.date} — {uo.period}
                              </span>
                              <span className="text-red-500">
                                {uo.reason === "NO_ELIGIBLE_AGENT"
                                  ? t("preview.reasons.NO_ELIGIBLE_AGENT")
                                  : uo.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50 flex-shrink-0 text-xs text-zinc-400">
              <span>{t("footer.escHint")}</span>
              {previewResult && (
                <span>
                  {previewResult.proposedAssignments.length} assignation(s) proposée(s)
                </span>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
