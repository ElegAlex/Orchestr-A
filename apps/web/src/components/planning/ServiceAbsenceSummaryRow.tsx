import React, { useMemo } from "react";
import { getDay } from "date-fns";
import { useTranslations } from "next-intl";
import { ServiceGroup, DayCell } from "@/hooks/usePlanningData";
import { usePlanningViewStore } from "@/stores/planningView.store";
import {
  computeDayAbsenceSummary,
  type AbsenceLevel,
  type DayAbsenceSummary,
} from "@/lib/planning-absence-summary";
import { Leave } from "@/types";

interface ServiceAbsenceSummaryRowProps {
  group: ServiceGroup;
  displayDays: Date[];
  viewMode: "week" | "month";
  gridTemplateColumns: string;
  getDayCell: (userId: string, date: Date) => DayCell;
}

/** A day either has a rendered summary or is suppressed (weekend / holiday / no headcount). */
type DaySummary =
  | { suppressed: true }
  | { suppressed: false; summary: DayAbsenceSummary };

const LEVEL_STYLES: Record<
  AbsenceLevel,
  { dot: string; monthBg: string; weekText: string; monthText: string }
> = {
  neutral: {
    dot: "bg-gray-300",
    monthBg: "bg-gray-100",
    weekText: "text-gray-500",
    monthText: "text-gray-600",
  },
  orange: {
    dot: "bg-amber-500",
    monthBg: "bg-amber-100",
    weekText: "text-amber-700",
    monthText: "text-amber-800",
  },
  red: {
    dot: "bg-red-500",
    monthBg: "bg-red-200",
    weekText: "text-red-700",
    monthText: "text-red-800",
  },
};

/**
 * Per-service daily absence summary band (FEAT-PLANNING-001).
 *
 * Rendered once per service group, directly under the group header and always
 * visible (even when the service is collapsed). Each day column shows how many
 * members of the service are absent that day, derived from the SAME in-memory
 * data the grid renders via `getDayCell` (no extra fetch). Weekends and holidays
 * are suppressed.
 */
export const ServiceAbsenceSummaryRow = React.memo(
  ({
    group,
    displayDays,
    viewMode,
    gridTemplateColumns,
    getDayCell,
  }: ServiceAbsenceSummaryRowProps) => {
    const t = useTranslations("planning");
    const showLeavePending = usePlanningViewStore(
      (s) => s.legendFilters.leavePending,
    );
    const leaveTypeFilters = usePlanningViewStore((s) => s.leaveTypeFilters);

    const headcount = group.users.length;

    const daySummaries = useMemo<DaySummary[]>(() => {
      const filters = { leaveTypeFilters, showLeavePending };
      const resolveName = (leave: Leave): string =>
        leave.leaveType?.name ?? t(`leaveTypes.${leave.type ?? "OTHER"}`);

      return displayDays.map((day) => {
        const weekDay = getDay(day);
        const isWeekend = weekDay === 0 || weekDay === 6;
        if (isWeekend || headcount === 0) return { suppressed: true };

        const cells = group.users.map((u) => getDayCell(u.id, day));
        // Holidays are non-working days → suppress (holiday flag is global per date).
        if (cells[0]?.isHoliday) return { suppressed: true };

        const members = cells.map((c) => ({
          leaves: c.leaves,
          isTelework: c.isTelework,
        }));
        return {
          suppressed: false,
          summary: computeDayAbsenceSummary(
            members,
            headcount,
            filters,
            resolveName,
          ),
        };
      });
    }, [
      group.users,
      headcount,
      displayDays,
      getDayCell,
      leaveTypeFilters,
      showLeavePending,
      t,
    ]);

    const buildTooltip = (summary: DayAbsenceSummary): string => {
      const header = t("absenceSummary.tooltipHeader", {
        count: summary.absentCount,
        total: summary.total,
        percent: summary.percent,
      });
      if (summary.breakdown.length === 0) return header;
      const lines = summary.breakdown.map((b) => `• ${b.name}: ${b.count}`);
      return `${header}\n${lines.join("\n")}`;
    };

    return (
      <div
        className="bg-gray-50/70 border-b border-gray-200"
        style={{ display: "grid", gridTemplateColumns }}
        role="row"
        aria-label={t("absenceSummary.label")}
      >
        {/* Resource column — caption */}
        <div className="sticky left-0 bg-gray-50/70 z-10 px-3 py-1 flex items-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {t("absenceSummary.label")}
          </span>
        </div>

        {/* One cell per displayed day, aligned to the grid columns */}
        {daySummaries.map((entry, index) => {
          const day = displayDays[index];
          const key = day.toISOString();

          if (entry.suppressed) {
            return <div key={key} aria-hidden="true" />;
          }

          const { summary } = entry;
          const styles = LEVEL_STYLES[summary.level];
          const hasAbsence = summary.absentCount > 0;
          const tooltip = buildTooltip(summary);
          const ariaLabel = t("absenceSummary.cellAria", {
            count: summary.absentCount,
            total: summary.total,
            percent: summary.percent,
          });

          if (viewMode === "month") {
            return (
              <div
                key={key}
                className={`flex items-center justify-center py-0.5 text-[10px] font-bold ${
                  hasAbsence ? `${styles.monthBg} ${styles.monthText}` : ""
                }`}
                title={tooltip}
                aria-label={ariaLabel}
              >
                {hasAbsence ? summary.absentCount : ""}
              </div>
            );
          }

          // Week view: "N · P%" with a small colored indicator.
          return (
            <div
              key={key}
              className="flex items-center justify-center gap-1 py-1 text-[11px]"
              title={tooltip}
              aria-label={ariaLabel}
            >
              {hasAbsence ? (
                <>
                  <span
                    className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${styles.dot}`}
                    aria-hidden="true"
                  />
                  <span className={`font-semibold ${styles.weekText}`}>
                    {summary.absentCount} · {summary.percent}%
                  </span>
                </>
              ) : (
                <span className="text-gray-300" aria-hidden="true">
                  –
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);

ServiceAbsenceSummaryRow.displayName = "ServiceAbsenceSummaryRow";
