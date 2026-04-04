"use client";

import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { useTranslations } from "next-intl";

const EMOJI_LIST = [
  "🚀", "🎯", "🏗️", "📊", "🛡️",
  "⚡", "🔧", "📁", "🌟", "💡",
  "🎨", "📋", "🔬", "🏆", "💼",
  "🌍", "📈", "🔒", "🎓", "❤️",
  "🏠", "📡", "🧩", "⚙️", "🔥",
];

interface EmojiPickerProps {
  value?: string | null;
  onChange: (emoji: string | null) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const t = useTranslations("projects");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 transition-colors"
      >
        {value ? (
          <span className="text-lg leading-none">{value}</span>
        ) : (
          <>
            <Smile size={16} className="text-gray-400" />
            <span className="text-gray-500">{t("projectEditModal.chooseIcon")}</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-5 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji);
                  setIsOpen(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-gray-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t("projectEditModal.noIcon")}
          </button>
        </div>
      )}
    </div>
  );
}
