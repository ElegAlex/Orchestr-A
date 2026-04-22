"use client";

import Image from "next/image";
import { useState, useRef, type ReactNode } from "react";
import { getGradient, getInitials } from "@/lib/avatar";
import type { UserSummary } from "@/types";

interface UserAvatarProps {
  user: UserSummary;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  badge?: ReactNode;
  className?: string;
}

const sizeMap = {
  xs: { dim: 20, text: "text-[10px] font-semibold" },
  sm: { dim: 28, text: "text-xs font-semibold" },
  md: { dim: 40, text: "text-sm font-semibold tracking-tight" },
  lg: { dim: 48, text: "text-base font-semibold tracking-tight" },
  xl: { dim: 96, text: "text-3xl font-bold tracking-tight" },
} as const;

function getAvatarSrc(avatarUrl: string): string {
  if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/")) return avatarUrl;
  return `/${avatarUrl}`;
}

export function UserAvatar({ user, size = "md", badge, className = "" }: UserAvatarProps) {
  const { dim, text } = sizeMap[size];
  const style = { width: dim, height: dim };
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const [imageFailed, setImageFailed] = useState(false);

  const prevUserIdRef = useRef(user.id);
  if (prevUserIdRef.current !== user.id) {
    prevUserIdRef.current = user.id;
    setImageFailed(false);
  }

  const renderShell = (inner: ReactNode) => (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={style}
      title={fullName}
    >
      {inner}
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 z-10 pointer-events-none">
          {badge}
        </span>
      )}
    </div>
  );

  if (user.avatarUrl && !imageFailed) {
    return renderShell(
      <span className="rounded-full overflow-hidden block w-full h-full">
        <Image
          src={getAvatarSrc(user.avatarUrl)}
          alt={fullName}
          width={dim}
          height={dim}
          className="w-full h-full object-cover"
          unoptimized
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  if (user.avatarPreset && user.avatarPreset !== "initials" && !imageFailed) {
    return renderShell(
      <span className="rounded-full overflow-hidden block w-full h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/avatars/${user.avatarPreset}.svg`}
          alt={fullName}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  const { from, to, angle } = getGradient(user);
  const initials = getInitials(user);

  return renderShell(
    <span
      className={`relative rounded-full flex items-center justify-center overflow-hidden text-white w-full h-full ${text}`}
      style={{
        background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
      }}
      aria-label={fullName}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25), transparent 55%)",
        }}
      />
      <span className="relative drop-shadow-sm">{initials}</span>
    </span>
  );
}
