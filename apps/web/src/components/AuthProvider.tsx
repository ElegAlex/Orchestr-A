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

  // Settings still fetched after successful auth — only when user has the perm.
  // Templates excluded from settings:read by RBAC v4 §NOTE 3 (IT_SUPPORT,
  // BASIC_USER, etc.) would otherwise hit a guaranteed 403 at every login.
  useEffect(() => {
    if (!isAuthenticated || !ready) return;
    const canReadSettings = useAuthStore
      .getState()
      .permissions.includes("settings:read");
    if (canReadSettings) {
      useSettingsStore.getState().fetchSettings();
    } else {
      useSettingsStore.setState({ isLoaded: true });
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
      pathname.match(/^\/(fr|en)\/reset-password$/);

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
