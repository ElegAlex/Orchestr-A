import type { UserSummary } from '@/types';

export const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#6366f1', '#8b5cf6'], // indigo → violet
  ['#3b82f6', '#06b6d4'], // blue → cyan
  ['#0ea5e9', '#6366f1'], // sky → indigo
  ['#14b8a6', '#10b981'], // teal → emerald
  ['#10b981', '#65a30d'], // emerald → lime
  ['#f59e0b', '#f97316'], // amber → orange
  ['#f97316', '#e11d48'], // orange → rose
  ['#f43f5e', '#ec4899'], // rose → pink
  ['#8b5cf6', '#d946ef'], // violet → fuchsia
  ['#475569', '#0f172a'], // slate → deep-slate
] as const;

export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getGradient(user: Pick<UserSummary, 'firstName' | 'lastName'>): { from: string; to: string; angle: number } {
  const key = `${(user.firstName ?? '').toLowerCase()}:${(user.lastName ?? '').toLowerCase()}`;
  const idx = hashString(key) % GRADIENTS.length;
  const [from, to] = GRADIENTS[idx];
  return { from, to, angle: (hashString(key) >>> 8) % 360 };
}

export function getInitials(user: Pick<UserSummary, 'firstName' | 'lastName'>): string {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}
