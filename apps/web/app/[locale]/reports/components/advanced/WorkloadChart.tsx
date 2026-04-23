"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { analyticsService, WorkloadUser } from "@/services/analytics.service";

interface Props {
  limit?: number;
}

const COLORS = {
  TODO: "#888780",
  IN_PROGRESS: "#378ADD",
  IN_REVIEW: "#EF9F27",
  BLOCKED: "#E24B4A",
} as const;

type StatusKey = keyof typeof COLORS;

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[180px_1fr_56px] items-center gap-4 py-2"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-6 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-10 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

export function WorkloadChart({ limit = 15 }: Props) {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "workload", { limit }],
    queryFn: () => analyticsService.getAdvancedWorkload(limit),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
      <h3 className="text-base font-medium text-gray-900">
        {t("collaboratorWorkload")}
      </h3>
      <p className="mb-5 text-[13px] text-gray-500">
        Tâches actives par collaborateur, triées par volume total
      </p>

      {isLoading && <Skeleton />}
      {isError && (
        <p className="text-sm text-red-600">{t("loadError")}</p>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="text-sm text-gray-500">{t("noActiveTasks")}</p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
            <LegendItem color={COLORS.TODO} label={t("todo")} />
            <LegendItem color={COLORS.IN_PROGRESS} label={t("inProgress")} />
            <LegendItem color={COLORS.IN_REVIEW} label={t("inReview")} />
            <LegendItem color={COLORS.BLOCKED} label={t("blocked")} />
          </div>

          <div>
            {data.map((user, idx) => (
              <UserRow key={user.userId} user={user} isFirst={idx === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function UserRow({
  user,
  isFirst,
}: {
  user: WorkloadUser;
  isFirst: boolean;
}) {
  const segments: Array<{ key: StatusKey; count: number }> = (
    ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"] as StatusKey[]
  )
    .map((key) => ({ key, count: user.counts[key] }))
    .filter((s) => s.count > 0);

  return (
    <div
      className={`grid grid-cols-[180px_1fr_56px] items-center gap-4 py-2 ${
        isFirst ? "" : "border-t border-gray-100"
      }`}
    >
      <span className="truncate text-[13px] font-medium text-gray-900">
        {user.name}
      </span>
      <span className="flex h-6 overflow-hidden rounded-sm bg-gray-100">
        {segments.map((s) => (
          <span
            key={s.key}
            className="flex items-center justify-center text-[11px] font-medium text-white"
            style={{
              flex: s.count,
              backgroundColor: COLORS[s.key],
              minWidth: 4,
            }}
            title={`${labelFor(s.key)} : ${s.count}`}
          >
            {s.count}
          </span>
        ))}
      </span>
      <span className="text-right text-[13px] font-medium tabular-nums text-gray-900">
        {user.total}
      </span>
    </div>
  );
}

function labelFor(key: StatusKey): string {
  switch (key) {
    case "TODO":
      return "À faire";
    case "IN_PROGRESS":
      return "En cours";
    case "IN_REVIEW":
      return "En revue";
    case "BLOCKED":
      return "Bloqué";
  }
}
