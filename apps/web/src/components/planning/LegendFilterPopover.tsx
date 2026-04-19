"use client";

import * as Popover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import {
  LegendFilterKey,
  usePlanningViewStore,
} from "@/stores/planningView.store";
import { getStatusIcon } from "@/lib/planning-utils";
import { TaskStatus } from "@/types";
import {
  leaveTypesService,
  LeaveTypeConfig,
} from "@/services/leave-types.service";
import { ReactNode, useEffect, useState } from "react";

type StandardItem = {
  kind: "standard";
  key: LegendFilterKey;
  label: string;
  visual: ReactNode;
};

type LeaveTypeItem = {
  kind: "leaveType";
  code: string;
  label: string;
  visual: ReactNode;
};

type LegendItem = StandardItem | LeaveTypeItem;

interface LegendSection {
  titleKey: string;
  items: LegendItem[];
}

const Swatch = ({ className }: { className: string }) => (
  <span className={`inline-block w-3 h-3 rounded ${className}`} />
);

const ColorDot = ({ color }: { color: string }) => (
  <span
    className="inline-block w-3 h-3 rounded border"
    style={{ backgroundColor: color, borderColor: color }}
    aria-hidden="true"
  />
);

const LeaveTypeVisual = ({ type }: { type: LeaveTypeConfig }) => (
  <span className="inline-flex items-center gap-1">
    <span className="text-base leading-none">{type.icon}</span>
    <ColorDot color={type.color} />
  </span>
);

export const LegendFilterPopover = () => {
  const t = useTranslations("planning");
  const tCommon = useTranslations("common");
  const legendFilters = usePlanningViewStore((s) => s.legendFilters);
  const leaveTypeFilters = usePlanningViewStore((s) => s.leaveTypeFilters);
  const toggleLegendFilter = usePlanningViewStore((s) => s.toggleLegendFilter);
  const toggleLeaveTypeFilter = usePlanningViewStore(
    (s) => s.toggleLeaveTypeFilter,
  );
  const resetLegendFilters = usePlanningViewStore((s) => s.resetLegendFilters);

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);

  // Fetch des types de congés actifs au montage. Pattern existant dans le
  // projet (useEffect + service) — pas de TanStack Query en place ailleurs.
  useEffect(() => {
    let cancelled = false;
    leaveTypesService
      .getAll(false)
      .then((data) => {
        if (cancelled) return;
        const active = data
          .filter((lt) => lt.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setLeaveTypes(active);
      })
      .catch(() => {
        // Silencieux : si le fetch échoue, on garde la section "statut" seule
        // et les congés restent visibles (fallback `true` dans le store).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sections: LegendSection[] = [
    {
      titleKey: "taskStatuses",
      items: [
        {
          kind: "standard",
          key: "todo",
          label: tCommon("taskStatus.TODO"),
          visual: (
            <span className="text-base leading-none">
              {getStatusIcon(TaskStatus.TODO)}
            </span>
          ),
        },
        {
          kind: "standard",
          key: "inProgress",
          label: tCommon("taskStatus.IN_PROGRESS"),
          visual: (
            <span className="text-base leading-none">
              {getStatusIcon(TaskStatus.IN_PROGRESS)}
            </span>
          ),
        },
        {
          kind: "standard",
          key: "inReview",
          label: tCommon("taskStatus.IN_REVIEW"),
          visual: (
            <span className="text-base leading-none">
              {getStatusIcon(TaskStatus.IN_REVIEW)}
            </span>
          ),
        },
        {
          kind: "standard",
          key: "done",
          label: tCommon("taskStatus.DONE"),
          visual: (
            <span className="text-base leading-none">
              {getStatusIcon(TaskStatus.DONE)}
            </span>
          ),
        },
        {
          kind: "standard",
          key: "blocked",
          label: tCommon("taskStatus.BLOCKED"),
          visual: (
            <span className="text-base leading-none">
              {getStatusIcon(TaskStatus.BLOCKED)}
            </span>
          ),
        },
      ],
    },
    {
      titleKey: "taskTypes",
      items: [
        {
          kind: "standard",
          key: "projectTask",
          label: t("legend.projectTask"),
          visual: <Swatch className="bg-blue-500" />,
        },
        {
          kind: "standard",
          key: "orphanTask",
          label: t("legend.orphanTask"),
          visual: <Swatch className="bg-slate-400" />,
        },
      ],
    },
    {
      titleKey: "presence",
      items: [
        {
          kind: "standard",
          key: "telework",
          label: t("legend.telework"),
          visual: <span className="text-base leading-none">🏠</span>,
        },
        {
          kind: "standard",
          key: "office",
          label: t("legend.office"),
          visual: <span className="text-base leading-none">🏢</span>,
        },
      ],
    },
    {
      titleKey: "absences",
      items: [
        {
          kind: "standard",
          key: "leavePending",
          label: t("legend.leavePending"),
          visual: (
            <span className="text-base leading-none opacity-60">🌴?</span>
          ),
        },
        ...leaveTypes.map<LegendItem>((type) => ({
          kind: "leaveType",
          code: type.code,
          label: type.name,
          visual: <LeaveTypeVisual type={type} />,
        })),
      ],
    },
    {
      titleKey: "events",
      items: [
        {
          kind: "standard",
          key: "event",
          label: t("legend.event"),
          visual: <span className="text-base leading-none">📅</span>,
        },
        {
          kind: "standard",
          key: "externalIntervention",
          label: t("legend.externalIntervention"),
          visual: <Swatch className="bg-red-500" />,
        },
      ],
    },
  ];

  const isChecked = (item: LegendItem): boolean =>
    item.kind === "standard"
      ? legendFilters[item.key]
      : (leaveTypeFilters[item.code] ?? true);

  const onToggle = (item: LegendItem) => {
    if (item.kind === "standard") toggleLegendFilter(item.key);
    else toggleLeaveTypeFilter(item.code);
  };

  const itemId = (item: LegendItem) =>
    item.kind === "standard" ? `std-${item.key}` : `lt-${item.code}`;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("legend.triggerAria")}
          className="px-3 py-2 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700 flex items-center space-x-2 border border-gray-200"
        >
          <span aria-hidden="true">🎨</span>
          <span>{t("legend.title")}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 focus:outline-none"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("legend.title")}
            </h3>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {sections.map((section) => (
              <div key={section.titleKey}>
                <h4 className="text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">
                  {t(`legend.sections.${section.titleKey}`)}
                </h4>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={itemId(item)}>
                      <label className="flex items-center px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked(item)}
                          onChange={() => onToggle(item)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="mr-2 inline-flex items-center justify-center min-w-5">
                          {item.visual}
                        </span>
                        <span className="text-sm text-gray-800">
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={resetLegendFilters}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
            >
              {t("legend.showAll")}
            </button>
          </div>
          <Popover.Arrow className="fill-white stroke-gray-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
