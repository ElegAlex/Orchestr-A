"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  analyticsService,
  MilestoneDetail,
} from "@/services/analytics.service";

const COLORS = {
  success: "#1D9E75",
  successText: "#0f6e56",
  blocked: "#E24B4A",
  dangerText: "#a32d2d",
  info: "#378ADD",
  infoText: "#185fa5",
};

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-3/4 rounded bg-gray-200" />
      <div className="h-4 w-1/2 rounded bg-gray-200" />
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

export default function MilestonesCompletion() {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "milestones-completion"],
    queryFn: () => analyticsService.getAdvancedMilestonesCompletion(),
    staleTime: 5 * 60 * 1000,
  });

  // Sépare en 2 groupes : en retard / dans les temps (upcoming, le plus proche par projet)
  const { lateItems, ontimeItems } = useMemo(() => {
    if (!data) return { lateItems: [], ontimeItems: [] };

    const details = data.details ?? [];
    const late = details.filter((d) => d.status === "OVERDUE");

    // Pour "dans les temps" : pour chaque projet sans jalon en retard, prendre le plus proche upcoming
    const lateProjectIds = new Set(late.map((d) => d.projectId));
    const upcomingByProject = new Map<string, MilestoneDetail>();
    for (const d of details) {
      if (d.status !== "UPCOMING") continue;
      if (lateProjectIds.has(d.projectId)) continue;
      const existing = upcomingByProject.get(d.projectId);
      if (!existing || d.daysFromNow < existing.daysFromNow) {
        upcomingByProject.set(d.projectId, d);
      }
    }
    const ontime = Array.from(upcomingByProject.values()).sort(
      (a, b) => a.daysFromNow - b.daysFromNow,
    );

    // Tri "en retard" par retard décroissant (le plus en retard en premier)
    const sortedLate = late.sort((a, b) => a.daysFromNow - b.daysFromNow);

    return { lateItems: sortedLate, ontimeItems: ontime };
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
      <h3 className="text-base font-medium text-gray-900">
        {t("milestoneCompletion")}
      </h3>

      {isLoading && <Skeleton />}
      {isError && <p className="text-sm text-red-600">{t("loadError")}</p>}

      {!isLoading && !isError && data && (
        <>
          {data.total === 0 && data.byProject.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noMilestoneDefined")}</p>
          ) : (
            <>
              {/* Sous-titre dense */}
              <p className="mb-5 text-[13px] text-gray-500">
                {data.onTime} / {data.total} atteints à temps{" "}
                <span
                  style={{ color: COLORS.successText }}
                  className="font-medium"
                >
                  ({Math.round(data.ratio * 100)} %)
                </span>
                {data.overdue > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: COLORS.dangerText }}>
                      {data.overdue} en retard à traiter en priorité
                    </span>
                  </>
                )}
              </p>

              {/* 3 KPI tiles */}
              <div className="mb-5 grid grid-cols-3 gap-3">
                <KpiTile
                  dotColor={COLORS.success}
                  textColor={COLORS.successText}
                  label="Terminés"
                  value={data.completed}
                />
                <KpiTile
                  dotColor={COLORS.blocked}
                  textColor={COLORS.dangerText}
                  label="En retard"
                  value={data.overdue}
                />
                <KpiTile
                  dotColor={COLORS.info}
                  textColor={COLORS.infoText}
                  label="À venir"
                  value={data.upcoming}
                />
              </div>

              {/* Group: En retard */}
              {lateItems.length > 0 && (
                <>
                  <p className="mb-2.5 mt-5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    En retard — action requise
                  </p>
                  {lateItems.map((m) => (
                    <LateItem key={m.milestoneId} milestone={m} />
                  ))}
                </>
              )}

              {/* Group: Dans les temps */}
              {ontimeItems.length > 0 && (
                <>
                  <p className="mb-2.5 mt-5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    Dans les temps
                  </p>
                  {ontimeItems.map((m) => (
                    <OnTimeItem key={m.milestoneId} milestone={m} />
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiTile({
  dotColor,
  textColor,
  label,
  value,
}: {
  dotColor: string;
  textColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        {label}
      </p>
      <p
        className="m-0 text-2xl font-medium leading-none tabular-nums"
        style={{ color: textColor }}
      >
        {value}
      </p>
    </div>
  );
}

function LateItem({ milestone }: { milestone: MilestoneDetail }) {
  const daysLate = Math.abs(milestone.daysFromNow);
  const pct =
    milestone.totalInProject > 0
      ? (milestone.reachedInProject / milestone.totalInProject) * 100
      : 0;
  const latePct =
    milestone.totalInProject > 0 ? 100 / milestone.totalInProject : 0;

  return (
    <div
      className="mb-2 rounded-lg border px-3.5 py-3"
      style={{
        borderColor: "rgba(226, 75, 74, 0.35)",
        backgroundColor: "#fdf0f0",
      }}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">
          {milestone.projectName} — {milestone.milestoneName}
        </span>
        <span
          className="whitespace-nowrap text-xs font-medium tabular-nums"
          style={{ color: COLORS.dangerText }}
        >
          Dû il y a {daysLate} j · {milestone.reachedInProject}/
          {milestone.totalInProject}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-200">
        <span
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: COLORS.success }}
        />
        <span
          className="h-full"
          style={{ width: `${latePct}%`, backgroundColor: COLORS.blocked }}
        />
      </div>
    </div>
  );
}

function OnTimeItem({ milestone }: { milestone: MilestoneDetail }) {
  const pct =
    milestone.totalInProject > 0
      ? (milestone.reachedInProject / milestone.totalInProject) * 100
      : 0;

  return (
    <div className="mb-2 rounded-lg border border-gray-200 px-3.5 py-3 transition hover:border-gray-300">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">
          {milestone.projectName} — {milestone.milestoneName}
        </span>
        <span className="whitespace-nowrap text-xs text-gray-500 tabular-nums">
          Prochain : {formatDateShort(milestone.dueDate)} ·{" "}
          {milestone.reachedInProject}/{milestone.totalInProject}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-200">
        <span
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: COLORS.success }}
        />
      </div>
    </div>
  );
}
