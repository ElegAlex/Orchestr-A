"use client";

import { useTranslations } from "next-intl";

interface WeightInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  id?: string;
}

const WEIGHT_LEVELS = [1, 2, 3, 4, 5] as const;

export function WeightInput({ value, onChange, disabled, id }: WeightInputProps) {
  const t = useTranslations("predefinedTasks");

  const legendId = id ? `${id}-legend` : "weight-input-legend";

  return (
    <fieldset role="radiogroup" aria-labelledby={legendId} className="border-0 p-0 m-0">
      <legend id={legendId} className="text-sm font-medium text-gray-700 mb-1">
        {t("weight.label")}
      </legend>
      <p className="text-xs text-gray-500 mb-2">{t("weight.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {WEIGHT_LEVELS.map((level) => {
          const isActive = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-pressed={isActive}
              aria-label={t("weight.ariaLabel", { level })}
              disabled={disabled}
              onClick={() => onChange(level)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition focus:outline-none focus:ring-2 focus:ring-blue-500",
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:border-zinc-400",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              {t(`weight.levels.${level}`)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
