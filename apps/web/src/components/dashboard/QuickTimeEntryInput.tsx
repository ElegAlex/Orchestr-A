"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { timeTrackingService } from "@/services/time-tracking.service";
import { ActivityType } from "@/types";

type Props = {
  taskId: string;
  /** Peut être null si la tâche est orpheline. */
  projectId: string | null;
  /** Cumul déclaré (tous contributeurs) utilisé pour l'affichage. */
  initialCumul: number;
  /** Callback déclenché après succès — sert à l'optimistic update côté parent. */
  onSuccess: (taskId: string, hours: number) => void;
};

const MIN_HOURS = 0.25;
const MAX_HOURS = 24;

function todayISO(): string {
  // Convention projet — cf. V3 commit b1492f8.
  return new Date().toISOString().split("T")[0];
}

function isValidHours(raw: string): number | null {
  if (!raw.trim()) return null;
  // Accepter virgule ou point pour les décimales.
  const normalized = raw.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_HOURS || value > MAX_HOURS) return null;
  return value;
}

/**
 * Input inline pour saisir rapidement des heures sur une tâche depuis le dashboard.
 *
 * Comportement :
 *   - Accepte des décimales (step 0.25, min 0.25, max 24).
 *   - Submit sur Enter ou blur (si valeur valide).
 *   - Poste un TimeEntry réel (pas un dismissal — cf. D1/D9).
 *   - Reset l'input sur succès, laisse la valeur et affiche un toast sur erreur.
 *
 * Gating : ce composant ne gère PAS la permission — c'est à TaskCard/parent de
 * ne pas le rendre si `!hasPermission('time_tracking:create')`. Voir D8.
 */
export function QuickTimeEntryInput({
  taskId,
  projectId,
  initialCumul,
  onSuccess,
}: Props) {
  const t = useTranslations("dashboard");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = isValidHours(value);
  const hasValue = value.trim().length > 0;
  const isInvalid = touched && hasValue && parsed === null;

  const loggedTooltip = t("tasks.quickEntry.loggedTooltip");
  const placeholder = t("tasks.quickEntry.placeholder");
  const ariaLabel = t("tasks.quickEntry.ariaLabel");
  const successMessage = t("tasks.quickEntry.submitSuccess");
  const errorMessage = t("tasks.quickEntry.submitError");

  const submit = async () => {
    if (submitting) return;
    const hours = parsed;
    if (hours === null) return;

    setSubmitting(true);
    try {
      await timeTrackingService.create({
        taskId,
        projectId: projectId ?? undefined,
        hours,
        activityType: ActivityType.DEVELOPMENT,
        date: todayISO(),
        description: "",
      });
      onSuccess(taskId, hours);
      setValue("");
      setTouched(false);
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Empêcher la navigation du card parent (onClick router.push).
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      setTouched(true);
      void submit();
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (parsed !== null) {
      void submit();
    }
  };

  const handleFormClick = (event: FormEvent) => {
    // Les clics dans le formulaire ne doivent pas déclencher la navigation du card.
    event.stopPropagation();
  };

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setTouched(true);
          void submit();
        }}
        onClick={handleFormClick}
        className="flex items-center"
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.25"
          min={MIN_HOURS}
          max={MAX_HOURS}
          value={value}
          placeholder={placeholder}
          disabled={submitting}
          aria-label={ariaLabel}
          aria-invalid={isInvalid || undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          className={`w-16 px-2 py-1 text-sm rounded-md border transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60 disabled:cursor-not-allowed ${
            isInvalid
              ? "border-red-500 focus:border-red-500"
              : "border-[var(--input-border)] focus:border-[var(--primary)]"
          }`}
        />
        {submitting && (
          <span
            className="ml-1 inline-block h-3 w-3 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
      </form>

      <span
        className="text-xs text-[var(--muted-foreground)] whitespace-nowrap"
        title={loggedTooltip}
        aria-label={loggedTooltip}
      >
        {initialCumul.toFixed(2)} h
      </span>
    </div>
  );
}

export default QuickTimeEntryInput;
