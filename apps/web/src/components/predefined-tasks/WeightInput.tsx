"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

interface WeightInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  id?: string;
}

const WEIGHT_LEVELS = [1, 2, 3, 4, 5] as const;
type WeightLevel = (typeof WEIGHT_LEVELS)[number];

export function WeightInput({ value, onChange, disabled, id }: WeightInputProps) {
  const t = useTranslations("predefinedTasks");

  const legendId = id ? `${id}-legend` : "weight-input-legend";
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  // clamp value into [1,5] for UI state (DB default 1, but be defensive for malformed data)
  const activeValue: WeightLevel = WEIGHT_LEVELS.includes(value as WeightLevel)
    ? (value as WeightLevel)
    : 1;

  const focusLevel = (level: WeightLevel) => {
    const idx = WEIGHT_LEVELS.indexOf(level);
    buttonsRef.current[idx]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: WeightLevel) => {
    if (disabled) return;
    const idx = WEIGHT_LEVELS.indexOf(current);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = (idx + 1) % WEIGHT_LEVELS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = (idx - 1 + WEIGHT_LEVELS.length) % WEIGHT_LEVELS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = WEIGHT_LEVELS.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      const nextLevel = WEIGHT_LEVELS[nextIdx];
      onChange(nextLevel);
      focusLevel(nextLevel);
    }
  };

  return (
    <fieldset role="radiogroup" aria-labelledby={legendId} className="border-0 p-0 m-0">
      <legend id={legendId} className="text-sm font-medium text-gray-700 mb-1">
        {t("weight.label")}
      </legend>
      <p className="text-xs text-gray-500 mb-2">{t("weight.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {WEIGHT_LEVELS.map((level, idx) => {
          const isActive = activeValue === level;
          return (
            <button
              key={level}
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t("weight.ariaLabel", { level })}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(level)}
              onKeyDown={(e) => handleKeyDown(e, level)}
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
