import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/services/auth.service";
import type { User } from "@/types";

/**
 * SEC-03 — Bootstrap hook.
 *
 * On mount, if a JWT is present in localStorage, fetch `/auth/me` and
 * `/auth/me/permissions` in parallel and populate the Zustand auth store with
 * the *server-authoritative* user + permissions. On failure (401, stale token,
 * deactivated account, network issue), clear the auth state.
 *
 * Rationale: role / permissions are never persisted — they always come from
 * the backend. Client-side privilege escalation via localStorage tampering is
 * therefore impossible: even if an attacker writes `role: "ADMIN"` into any
 * storage key, it is overwritten on mount from the backend.
 */
export function useAuthBootstrap(): boolean {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const setLoading = useAuthStore((s) => s.setLoading);
  const [ready, setReady] = useState(false);

  // Listen for forced-clear events fired by the axios 401 interceptor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onCleared = () => clear();
    window.addEventListener("auth:cleared", onCleared);
    return () => window.removeEventListener("auth:cleared", onCleared);
  }, [clear]);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(AUTH_TOKEN_KEY)
        : null;

    if (!token) {
      setLoading(false);
      setReady(true);
      return;
    }

    setLoading(true);
    Promise.all([
      api.get<User>("/auth/me").then((r) => r.data),
      api
        .get<{ permissions: string[] }>("/auth/me/permissions")
        .then((r) => r.data.permissions),
    ])
      .then(([user, permissions]) => {
        setAuth(user, permissions);
      })
      .catch(() => {
        clear();
      })
      .finally(() => {
        setLoading(false);
        setReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
