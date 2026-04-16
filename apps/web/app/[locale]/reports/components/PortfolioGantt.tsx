"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Gantt, type GanttPortfolioRow, type GanttView } from "@/components/gantt";
import { classify } from "@/components/gantt/status-classifier";

interface Project {
  id: string;
  name: string;
  code?: string;
  icon?: string | null;
  status: string;
  progress: number;
  startDate: string;
  dueDate?: string | null;
  projectManager?: string;
  managerDepartment?: string;
  priority?: string;
}

interface PortfolioGanttProps {
  projects: Project[];
}

function projectsToPortfolioRows(projects: Project[]): GanttPortfolioRow[] {
  return projects
    .filter((p) => p.startDate)
    .map((p) => {
      const startDate = new Date(p.startDate);
      const endDate = p.dueDate ? new Date(p.dueDate) : new Date();
      const health = classify({ startDate, endDate, progress: p.progress, status: p.status });
      return {
        id: p.id,
        name: p.name,
        startDate,
        endDate,
        progress: p.progress,
        status: p.status,
        health,
        departmentName: p.managerDepartment,
        managerName: p.projectManager,
        code: p.code,
        priority: p.priority,
      };
    });
}

const PortfolioGantt = React.forwardRef<HTMLDivElement, PortfolioGanttProps>(
  function PortfolioGantt({ projects }, ref) {
    const router = useRouter();
    const locale = useLocale();
    const [view, setView] = useState<GanttView>("month");

    const rows = useMemo(() => projectsToPortfolioRows(projects), [projects]);

    const handleRowClick = (row: GanttPortfolioRow) => {
      router.push(`/${locale}/projects/${row.id}`);
    };

    return (
      <div ref={ref}>
        <Gantt
          scope="portfolio"
          rows={rows}
          view={view}
          onRowClick={handleRowClick}
        />
      </div>
    );
  }
);

PortfolioGantt.displayName = "PortfolioGantt";

export default PortfolioGantt;
