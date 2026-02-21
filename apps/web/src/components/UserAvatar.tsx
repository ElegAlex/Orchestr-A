"use client";

import Image from "next/image";

interface UserAvatarProps {
  user: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    avatarPreset?: string | null;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { px: 40, text: "text-sm font-semibold" },
  md: { px: 48, text: "text-base font-semibold" },
  lg: { px: 96, text: "text-3xl font-bold" },
};

function getAvatarSrc(avatarUrl: string): string {
  if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/")) return avatarUrl;
  return `/${avatarUrl}`;
}

export function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const { px, text } = sizeMap[size];
  const style = { width: px, height: px };

  if (user.avatarUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={style}
      >
        <Image
          src={getAvatarSrc(user.avatarUrl)}
          alt={`${user.firstName} ${user.lastName}`}
          width={px}
          height={px}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    );
  }

  if (user.avatarPreset) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/avatars/${user.avatarPreset}.svg`}
          alt={`${user.firstName} ${user.lastName}`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: initials
  return (
    <div
      className={`rounded-full bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 ${text} ${className}`}
      style={style}
    >
      {user.firstName[0]}
      {user.lastName[0]}
    </div>
  );
}
