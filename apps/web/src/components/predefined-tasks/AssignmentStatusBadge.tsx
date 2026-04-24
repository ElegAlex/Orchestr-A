"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Clock,
  Circle,
  Minus,
  AlertTriangle,
  X,
} from "lucide-react";
import type {
  CompletionStatus,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";

/**
 * AssignmentStatusBadge — variante C (expansion inline) du mockup E3.2.
 *
 * Comportement :
 * - Collapsed (défaut) : icône compacte + couleur selon `assignment.completionStatus`,
 *   ou `LATE` si `isLate=true` (prend le pas visuellement sur NOT_DONE).
 * - Au click si `canUpdateStatus=true` : expansion inline, chips de transitions
 *   valides affichés (pas de popover / overlay z-index).
 * - Chip `NOT_APPLICABLE` sélectionné → textarea "Motif" inline (min 3 chars)
 *   + boutons Valider/Annuler.
 * - Escape → retour collapsed sans mutation.
 *
 * Accessibilité : `role="status"` sur l'état collapsed, aria-label dynamique.
 * En mode expanded, chips avec `role="button"` et navigation clavier native.
 */

export interface AssignmentStatusBadgeProps {
  assignment: Pick<
    PredefinedTaskAssignment,
    "id" | "completionStatus" | "canUpdateStatus"
  >;
  isLate: boolean;
  onTransition: (to: CompletionStatus, reason?: string) => void;
  disabled?: boolean;
  viewMode: "week" | "month";
}

const STATUS_COLORS: Record<
  CompletionStatus | "LATE",
  { bg: string; text: string; border: string; icon: string }
> = {
  NOT_DONE: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-300",
    icon: "text-zinc-500",
  },
  IN_PROGRESS: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-500",
    icon: "text-amber-600",
  },
  DONE: {
    bg: "bg-emerald-100",
    text: "text-emerald-900",
    border: "border-emerald-500",
    icon: "text-emerald-600",
  },
  NOT_APPLICABLE: {
    bg: "bg-violet-100",
    text: "text-violet-900",
    border: "border-violet-500",
    icon: "text-violet-600",
  },
  LATE: {
    bg: "bg-red-100",
    text: "text-red-900",
    border: "border-red-500",
    icon: "text-red-600",
  },
};

const STATUS_ICON: Record<CompletionStatus | "LATE", React.ComponentType<{ className?: string }>> = {
  NOT_DONE: Circle,
  IN_PROGRESS: Clock,
  DONE: Check,
  NOT_APPLICABLE: Minus,
  LATE: AlertTriangle,
};

/**
 * State machine des transitions valides (cohérent avec backend service W2.4).
 */
function getValidTransitions(from: CompletionStatus): CompletionStatus[] {
  switch (from) {
    case "NOT_DONE":
      return ["IN_PROGRESS", "DONE", "NOT_APPLICABLE"];
    case "IN_PROGRESS":
      return ["DONE", "NOT_APPLICABLE"];
    case "DONE":
      return ["NOT_DONE", "NOT_APPLICABLE"];
    case "NOT_APPLICABLE":
      return ["NOT_DONE"];
  }
}

export function AssignmentStatusBadge({
  assignment,
  isLate,
  onTransition,
  disabled,
  viewMode,
}: AssignmentStatusBadgeProps) {
  const t = useTranslations("predefinedTasks");
  const [expanded, setExpanded] = useState(false);
  const [pendingNA, setPendingNA] = useState(false);
  const [reason, setReason] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visualStatus: CompletionStatus | "LATE" =
    isLate && assignment.completionStatus === "NOT_DONE"
      ? "LATE"
      : assignment.completionStatus;

  const canInteract = !!assignment.canUpdateStatus && !disabled;

  const collapse = useCallback(() => {
    setExpanded(false);
    setPendingNA(false);
    setReason("");
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        collapse();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, collapse]);

  useEffect(() => {
    if (pendingNA) textareaRef.current?.focus();
  }, [pendingNA]);

  // --- rendu viewMode=month : juste un point coloré, pas d'interaction ---
  if (viewMode === "month") {
    const c = STATUS_COLORS[visualStatus];
    return (
      <span
        role="status"
        aria-label={t(`status.ariaLabel.${visualStatus}`)}
        title={t(`status.${visualStatus}`)}
        className={`inline-block h-1.5 w-1.5 rounded-full ${c.bg} border ${c.border}`}
      />
    );
  }

  // --- rendu collapsed ---
  if (!expanded) {
    const c = STATUS_COLORS[visualStatus];
    const Icon = STATUS_ICON[visualStatus];
    return (
      <button
        type="button"
        role="status"
        aria-label={t(`status.ariaLabel.${visualStatus}`)}
        title={
          canInteract ? t(`status.${visualStatus}`) : t("status.notAllowed")
        }
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (canInteract) setExpanded(true);
        }}
        className={`inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-medium ${c.bg} ${c.text} ${c.border} border ${canInteract ? "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-blue-500" : "cursor-default opacity-90"}`}
      >
        <Icon className={`h-3 w-3 ${c.icon}`} />
        <span className="sr-only">{t(`status.${visualStatus}`)}</span>
      </button>
    );
  }

  // --- rendu expanded (variante C : inline, pas de popover) ---
  const transitions = getValidTransitions(assignment.completionStatus);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={t(`status.ariaLabel.${visualStatus}`)}
      className="mt-1 flex flex-col gap-1 rounded border border-blue-400 bg-white p-1 shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1">
        {transitions.map((to) => {
          const c = STATUS_COLORS[to];
          const Icon = STATUS_ICON[to];
          const isActive = pendingNA && to === "NOT_APPLICABLE";
          return (
            <button
              key={to}
              type="button"
              aria-label={t("status.transitionTo", {
                status: t(`status.${to}`),
              })}
              onClick={(e) => {
                e.stopPropagation();
                if (to === "NOT_APPLICABLE") {
                  setPendingNA(true);
                } else {
                  onTransition(to);
                  collapse();
                }
              }}
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border ${c.bg} ${c.text} ${isActive ? "ring-2 ring-blue-500" : c.border} hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <Icon className={`h-3 w-3 ${c.icon}`} />
              {t(`status.${to}`)}
            </button>
          );
        })}
        <button
          type="button"
          aria-label={t("status.cancel")}
          onClick={(e) => {
            e.stopPropagation();
            collapse();
          }}
          className="ml-auto inline-flex items-center justify-center rounded p-0.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {pendingNA && (
        <div className="flex flex-col gap-1 pt-1">
          <label className="text-[10px] font-medium text-zinc-700">
            {t("status.reason.label")}
          </label>
          <textarea
            ref={textareaRef}
            aria-label={t("status.reason.label")}
            placeholder={t("status.reason.placeholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded border border-zinc-300 px-1 py-0.5 text-[10px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
            minLength={3}
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingNA(false);
                setReason("");
              }}
              className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t("status.cancel")}
            </button>
            <button
              type="button"
              disabled={reason.trim().length < 3}
              onClick={(e) => {
                e.stopPropagation();
                onTransition("NOT_APPLICABLE", reason.trim());
                collapse();
              }}
              className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              {t("status.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
