"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Role } from "@/types";
import { Logo, LogoIcon } from "@/components/Logo";

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: "Tableau de bord", href: "/dashboard", icon: "🎯" },
  { name: "Projets", href: "/projects", icon: "📁" },
  { name: "Tâches", href: "/tasks", icon: "✓" },
  { name: "Événements", href: "/events", icon: "📅" },
  { name: "Planning", href: "/planning", icon: "🗓️" },
  { name: "Temps passé", href: "/time-tracking", icon: "⏱️" },
  { name: "Congés", href: "/leaves", icon: "🏖️" },
  { name: "Télétravail", href: "/telework", icon: "🏠" },
];

const adminNavigation: NavItem[] = [
  { name: "Rapports & Analytics", href: "/reports", icon: "📊" },
  { name: "Utilisateurs", href: "/users", icon: "👥" },
  { name: "Départements", href: "/departments", icon: "🏢" },
  { name: "Compétences", href: "/skills", icon: "⭐" },
  { name: "Paramètres", href: "/settings", icon: "⚙️", adminOnly: true },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isManager =
    user?.role === Role.ADMIN ||
    user?.role === Role.RESPONSABLE ||
    user?.role === Role.MANAGER;

  const isAdmin = user?.role === Role.ADMIN;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)]">
          <Link href="/dashboard" className="flex items-center">
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
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-[var(--primary)] bg-opacity-10 text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}

          {isManager && (
            <>
              <div className="pt-4 pb-2">
                {sidebarOpen && (
                  <p className="px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Administration
                  </p>
                )}
              </div>
              {adminNavigation
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-[var(--primary)] bg-opacity-10 text-[var(--primary)]"
                          : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      <span className="text-xl mr-3">{item.icon}</span>
                      {sidebarOpen && <span>{item.name}</span>}
                    </Link>
                  );
                })}
            </>
          )}
        </nav>

        {/* User menu */}
        <div className="border-t border-[var(--border)] p-4">
          <Link
            href="/profile"
            className="flex items-center hover:bg-[var(--accent)] rounded-lg p-2 -m-2 transition"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-semibold">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {user?.role}
                </p>
              </div>
            )}
          </Link>
          {sidebarOpen && (
            <button
              onClick={logout}
              className="mt-3 w-full px-3 py-2 text-sm text-left text-[var(--destructive)] hover:bg-[var(--destructive)] hover:bg-opacity-10 rounded-lg transition"
            >
              Déconnexion
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
