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
  sm: { px: 40, text: "text-sm font-semibold tracking-tight" },
  md: { px: 48, text: "text-base font-semibold tracking-tight" },
  lg: { px: 96, text: "text-3xl font-bold tracking-tight" },
};

const GRADIENTS: Array<[string, string]> = [
  ["#6366f1", "#8b5cf6"], // indigo → violet
  ["#3b82f6", "#06b6d4"], // blue → cyan
  ["#0ea5e9", "#6366f1"], // sky → indigo
  ["#14b8a6", "#10b981"], // teal → emerald
  ["#10b981", "#65a30d"], // emerald → lime
  ["#f59e0b", "#f97316"], // amber → orange
  ["#f97316", "#e11d48"], // orange → rose
  ["#f43f5e", "#ec4899"], // rose → pink
  ["#8b5cf6", "#d946ef"], // violet → fuchsia
  ["#475569", "#0f172a"], // slate → deep-slate
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getGradient(user: { firstName: string; lastName: string }) {
  const key = `${user.firstName.toLowerCase()}:${user.lastName.toLowerCase()}`;
  const idx = hashString(key) % GRADIENTS.length;
  const [from, to] = GRADIENTS[idx];
  return { from, to, angle: (hashString(key) >> 8) % 360 };
}

function getAvatarSrc(avatarUrl: string): string {
  if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/"))
    return avatarUrl;
  return `/${avatarUrl}`;
}

export function UserAvatar({
  user,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const { px, text } = sizeMap[size];
  const dim = { width: px, height: px };

  if (user.avatarUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={dim}
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

  if (user.avatarPreset && user.avatarPreset !== "initials") {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={dim}
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

  // Premium initials monogram: unique gradient per user
  const { from, to, angle } = getGradient(user);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      className={`relative rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden text-white ${text} ${className}`}
      style={{
        ...dim,
        background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
      }}
      aria-label={`${user.firstName} ${user.lastName}`}
    >
      {/* subtle highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25), transparent 55%)",
        }}
      />
      <span className="relative drop-shadow-sm">{initials}</span>
    </div>
  );
}
