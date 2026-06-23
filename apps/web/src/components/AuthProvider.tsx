"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, permissionsLoaded } = useAuthStore();

  // SEC-03 — rehydrate user+permissions from the backend on mount.
  // `ready` guards the first render so we don't flash stale UI
  // (role-gated features) before /auth/me resolves.
  const ready = useAuthBootstrap();

  // Settings fetched after successful auth. Users with settings:read get the
  // full map; the rest (excluded by RBAC v4 §NOTE 3 — IT_SUPPORT, BASIC_USER,
  // CONTRIBUTEUR, OBSERVATEUR…) get the non-sensitive public projection so the
  // planning view + date utils reflect the admin-defined global config for
  // EVERY role, instead of falling back to the hardcoded Mon–Fri default.
  useEffect(() => {
    if (!isAuthenticated || !ready) return;
    const canReadSettings = useAuthStore
      .getState()
      .permissions.includes("settings:read");
    if (canReadSettings) {
      useSettingsStore.getState().fetchSettings();
    } else {
      useSettingsStore.getState().fetchPublicSettings();
    }
  }, [isAuthenticated, ready]);

  useEffect(() => {
    if (!ready || isLoading) return;

    // Extract locale from pathname (e.g., /fr/dashboard -> fr)
    const segments = pathname.split("/");
    const locale = ["fr", "en"].includes(segments[1]) ? segments[1] : "fr";

    const isPublicRoute =
      pathname === "/" ||
      pathname.match(/^\/(fr|en)$/) ||
      pathname.match(/^\/(fr|en)\/login$/) ||
      pathname.match(/^\/(fr|en)\/register$/) ||
      pathname.match(/^\/(fr|en)\/forgot-password$/) ||
      pathname.match(/^\/(fr|en)\/reset-password$/) ||
      // SEC-FE-001 — change-password screen is accessible without full auth state
      // (flagged session has a valid JWT but /auth/me is blocked by the guard).
      pathname.match(/^\/(fr|en)\/change-password$/);

    if (!isAuthenticated && !isPublicRoute) {
      router.push(`/${locale}/login`);
    } else if (
      isAuthenticated &&
      (pathname.match(/^\/(fr|en)\/login$/) ||
        pathname.match(/^\/(fr|en)\/register$/))
    ) {
      router.push(`/${locale}/dashboard`);
    }
  }, [ready, isAuthenticated, isLoading, pathname, router]);

  if (!ready || isLoading || (isAuthenticated && !permissionsLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
