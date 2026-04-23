"use client";

import { useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GanttGroup } from "./types";
import { GROUP_HEADER_HEIGHT } from "./tokens";

interface GanttGroupHeaderProps {
  group: GanttGroup;
  onToggle: (key: string) => void;
}

export default function GanttGroupHeader({
  group,
  onToggle,
}: GanttGroupHeaderProps) {
  const handleClick = useCallback(
    () => onToggle(group.key),
    [group.key, onToggle],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(group.key);
      }
    },
    [group.key, onToggle],
  );

  const Icon = group.isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      role="row"
      aria-expanded={group.isExpanded}
      tabIndex={0}
      className="flex items-center gap-2 px-3 cursor-pointer select-none transition-colors"
      style={{
        height: GROUP_HEADER_HEIGHT,
        backgroundColor: "#F1F5F9",
        borderBottom: "1px solid #E2E8F0",
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "#E2E8F0";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "#F1F5F9";
      }}
    >
      <Icon size={16} color="#475569" />
      <span
        style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}
        className="truncate"
      >
        {group.label}
      </span>
      <span
        className="shrink-0"
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#334155",
          backgroundColor: "#E2E8F0",
          padding: "2px 8px",
          borderRadius: 10,
        }}
      >
        {group.rows.length}
      </span>
    </div>
  );
}
