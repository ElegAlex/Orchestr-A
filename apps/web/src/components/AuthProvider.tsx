"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading) {
      // Check if pathname matches public routes (with or without locale prefix)
      const isPublicRoute = pathname === "/" ||
                           pathname === "/login" ||
                           pathname === "/register" ||
                           pathname.match(/^\/(fr|en)$/) ||
                           pathname.match(/^\/(fr|en)\/login$/) ||
                           pathname.match(/^\/(fr|en)\/register$/);

      if (!isAuthenticated && !isPublicRoute) {
        router.push("/login");
      } else if (
        isAuthenticated &&
        (pathname === "/login" ||
         pathname === "/register" ||
         pathname.match(/^\/(fr|en)\/login$/) ||
         pathname.match(/^\/(fr|en)\/register$/))
      ) {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
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
