"use client";

import type { GanttPortfolioRow, GanttTaskRow } from "./types";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_DEFAULT_COLOR,
  HEALTH_COLORS,
  lightenColor,
} from "./tokens";
import type { HealthStatus } from "./types";
import { format } from "date-fns";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { UserAvatar } from "@/components/UserAvatar";

interface GanttTooltipProps {
  row: GanttPortfolioRow | GanttTaskRow;
  scope: "portfolio" | "project";
  x: number;
  y: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  "on-track": "En bonne voie",
  "at-risk": "À risque",
  late: "En retard",
  upcoming: "À venir",
  done: "Terminé",
};

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: color,
        backgroundColor: lightenColor(color),
        padding: "1px 8px",
        borderRadius: 8,
      }}
    >
      {label}
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      style={{ minHeight: 22 }}
    >
      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export default function GanttTooltip({
  row,
  scope,
  x,
  y,
  containerRef,
}: GanttTooltipProps) {
  const tooltipWidth = 240;
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;
    const rect = container.getBoundingClientRect();
    const left = Math.min(
      Math.max(x - rect.left - tooltipWidth / 2, 8),
      rect.width - tooltipWidth - 8,
    );
    const top = y - rect.top + 16;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = "visible";
  }, [containerRef, x, y]);

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 pointer-events-none"
      style={{
        visibility: "hidden",
        width: tooltipWidth,
        backgroundColor: "white",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        boxShadow: "0 8px 16px -4px rgba(0,0,0,0.1)",
        padding: "12px 16px",
      }}
    >
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2"
        style={{
          width: 10,
          height: 10,
          backgroundColor: "white",
          border: "1px solid #E2E8F0",
          borderRight: "none",
          borderBottom: "none",
          transform: "translateX(-50%) rotate(45deg)",
        }}
      />
      <div className="flex flex-col gap-1">
        {scope === "project" ? (
          <ProjectTooltip row={row as GanttTaskRow} />
        ) : (
          <PortfolioTooltip row={row as GanttPortfolioRow} />
        )}
      </div>
    </div>
  );
}

function ProjectTooltip({ row }: { row: GanttTaskRow }) {
  const color = TASK_STATUS_COLORS[row.status] ?? TASK_STATUS_DEFAULT_COLOR;
  const label = TASK_STATUS_LABELS[row.status] ?? row.status;
  return (
    <>
      <div
        className="truncate"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#0F172A",
          marginBottom: 4,
        }}
      >
        {row.name}
      </div>
      <Row label="Statut">
        <StatusBadge color={color} label={label} />
      </Row>
      {(row.assignee || row.assigneeName) && (
        <Row label="Assigné">
          {row.assignee && <UserAvatar user={row.assignee} size="xs" />}
          {row.assigneeName && (
            <span style={{ fontSize: 12, color: "#334155" }}>
              {row.assigneeName}
            </span>
          )}
        </Row>
      )}
      <Row label="Dates">
        <span style={{ fontSize: 12, color: "#334155" }}>
          {format(row.startDate, "MMM d")} — {format(row.endDate, "MMM d")}
        </span>
      </Row>
      <Row label="Progrès">
        <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>
          {Math.round(row.progress)}%
        </span>
      </Row>
      {row.priority && (
        <Row label="Priorité">
          <span style={{ fontSize: 12, color: "#334155" }}>{row.priority}</span>
        </Row>
      )}
    </>
  );
}

function PortfolioTooltip({ row }: { row: GanttPortfolioRow }) {
  const color = HEALTH_COLORS[row.health];
  const label = HEALTH_LABELS[row.health];
  return (
    <>
      <div
        className="truncate"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#0F172A",
          marginBottom: 4,
        }}
      >
        {row.name}
      </div>
      <Row label="Santé">
        <StatusBadge color={color} label={label} />
      </Row>
      {(row.manager || row.managerName) && (
        <Row label="Chef de projet">
          {row.manager && <UserAvatar user={row.manager} size="xs" />}
          {row.managerName && (
            <span style={{ fontSize: 12, color: "#334155" }}>
              {row.managerName}
            </span>
          )}
        </Row>
      )}
      <Row label="Dates">
        <span style={{ fontSize: 12, color: "#334155" }}>
          {format(row.startDate, "MMM yyyy")} —{" "}
          {format(row.endDate, "MMM yyyy")}
        </span>
      </Row>
      <Row label="Progrès">
        <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>
          {Math.round(row.progress)}%
        </span>
      </Row>
    </>
  );
}
