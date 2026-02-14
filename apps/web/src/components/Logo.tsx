"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useThemeStore } from "@/stores/theme.store";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
  enableEasterEgg?: boolean;
}

const sizes: Record<LogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export function Logo({
  size = "md",
  showText = false,
  className = "",
  enableEasterEgg = false,
}: LogoProps) {
  const dimension = sizes[size];
  const clickCountRef = useRef(0);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const exitGirlyMode = useThemeStore((state) => state.exitGirlyMode);

  const handleClick = () => {
    if (!enableEasterEgg) return;

    clickCountRef.current += 1;

    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
    }

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      if (theme === "girly") {
        exitGirlyMode();
        toast("👋 Mode Fabulous désactivé", {
          icon: "🌙",
          duration: 3000,
        });
      } else {
        setTheme("girly");
        toast("✨ Mode Fabulous activé ✨", {
          icon: "💅",
          duration: 4000,
          style: {
            background: "#fce4ec",
            color: "#880e4f",
            border: "2px solid #e91e63",
          },
        });
      }
      return;
    }

    clickTimeout.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 600);
  };

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      onClick={handleClick}
    >
      <Image
        src="/logo/logo.png"
        alt="Orchestr'A"
        width={dimension}
        height={dimension}
        className="object-contain"
        priority={size === "lg" || size === "xl"}
      />
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${
            size === "xs"
              ? "text-sm"
              : size === "sm"
                ? "text-base"
                : size === "md"
                  ? "text-lg"
                  : size === "lg"
                    ? "text-xl"
                    : "text-2xl"
          }`}
        >
          ORCHESTR&apos;A
        </span>
      )}
    </div>
  );
}

export function LogoIcon({
  size = "sm",
  className = "",
}: Omit<LogoProps, "showText">) {
  const dimension = sizes[size];

  return (
    <Image
      src="/logo/logo.png"
      alt="Orchestr'A"
      width={dimension}
      height={dimension}
      className={`object-contain ${className}`}
    />
  );
}
