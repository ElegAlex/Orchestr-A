"use client";

import { Folder } from "lucide-react";

interface ProjectIconProps {
  icon?: string | null;
  size?: number;
  className?: string;
}

export function ProjectIcon({ icon, size = 16, className = "" }: ProjectIconProps) {
  if (icon) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ fontSize: size, lineHeight: 1, width: size, height: size }}
        role="img"
      >
        {icon}
      </span>
    );
  }

  return <Folder size={size} className={`text-gray-400 shrink-0 ${className}`} />;
}
