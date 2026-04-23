"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionCode } from "rbac";
import { Logo, LogoIcon } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";

interface NavItem {
  key: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common");
  const { user, logout } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation: (NavItem & { permission?: PermissionCode })[] = [
    { key: "dashboard", href: `/${locale}/dashboard`, icon: "🎯" },
    {
      key: "projects",
      href: `/${locale}/projects`,
      icon: "📁",
      permission: "projects:read",
    },
    {
      key: "tasks",
      href: `/${locale}/tasks`,
      icon: "✓",
      permission: "tasks:read",
    },
    {
      key: "events",
      href: `/${locale}/events`,
      icon: "📣",
      permission: "events:read",
    },
    { key: "planning", href: `/${locale}/planning`, icon: "🗓️" },
    {
      key: "timeTracking",
      href: `/${locale}/time-tracking`,
      icon: "⏱️",
      permission: "time_tracking:read",
    },
    {
      key: "leaves",
      href: `/${locale}/leaves`,
      icon: "🏖️",
      permission: "leaves:read",
    },
    {
      key: "telework",
      href: `/${locale}/telework`,
      icon: "🏠",
      permission: "telework:read",
    },
  ];

  const adminNavigation: (NavItem & { permission?: PermissionCode })[] = [
    {
      key: "reports",
      href: `/${locale}/reports`,
      icon: "📊",
      permission: "reports:view",
    },
    {
      key: "users",
      href: `/${locale}/users`,
      icon: "👥",
      permission: "users:manage",
    },
    {
      key: "departments",
      href: `/${locale}/departments`,
      icon: "🏢",
      permission: "departments:read",
    },
    {
      key: "skills",
      href: `/${locale}/skills`,
      icon: "⭐",
      permission: "skills:read",
    },
    {
      key: "thirdParties",
      href: `/${locale}/third-parties`,
      icon: "🤝",
      permission: "third_parties:read",
    },
    {
      key: "roleManagement",
      href: `/${locale}/admin/roles`,
      icon: "🛡️",
      adminOnly: true,
    },
    {
      key: "settings",
      href: `/${locale}/settings`,
      icon: "⚙️",
      adminOnly: true,
    },
  ];

  const isAdmin = hasPermission("users:manage_roles");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)]">
          <Link href={`/${locale}/dashboard`} className="flex items-center">
            {sidebarOpen ? (
              <Logo
                size="sm"
                showText
                enableEasterEgg
                className="hover:opacity-80 transition"
              />
            ) : (
              <LogoIcon size="sm" className="hover:opacity-80 transition" />
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition text-[var(--foreground)]"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation
            .filter(
              (item) => !item.permission || hasPermission(item.permission),
            )
            .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                      : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  <span className="text-xl mr-3">{item.icon}</span>
                  {sidebarOpen && <span>{t(`nav.${item.key}`)}</span>}
                </Link>
              );
            })}

          {adminNavigation.some((item) => {
            if (item.adminOnly) return isAdmin;
            if (item.permission) return hasPermission(item.permission);
            return true;
          }) && (
            <>
              <div className="pt-4 pb-2">
                {sidebarOpen && (
                  <p className="px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    {t("common.administration")}
                  </p>
                )}
              </div>
              {adminNavigation
                .filter((item) => {
                  if (item.adminOnly) return isAdmin;
                  if (item.permission) return hasPermission(item.permission);
                  return true;
                })
                .map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                          : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      <span className="text-xl mr-3">{item.icon}</span>
                      {sidebarOpen && <span>{t(`nav.${item.key}`)}</span>}
                    </Link>
                  );
                })}
            </>
          )}
        </nav>

        {/* User menu */}
        <div className="border-t border-[var(--border)] p-4">
          <Link
            href={`/${locale}/profile`}
            className="flex items-center hover:bg-[var(--accent)] rounded-lg p-2 -m-2 transition"
          >
            {user && <UserAvatar user={user} size="md" />}
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {user?.role?.label ?? "—"}
                </p>
              </div>
            )}
          </Link>
          {sidebarOpen && (
            <button
              onClick={logout}
              className="mt-3 w-full px-3 py-2 text-sm text-left text-[var(--destructive)] hover:bg-[var(--destructive)] hover:bg-opacity-10 rounded-lg transition"
            >
              {t("common.logout")}
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
