'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: '🎯' },
  { name: 'Projets', href: '/projects', icon: '📁' },
  { name: 'Tâches', href: '/tasks', icon: '✓' },
  { name: 'Planning', href: '/planning', icon: '📅' },
  { name: 'Temps passé', href: '/time-tracking', icon: '⏱️' },
  { name: 'Congés', href: '/leaves', icon: '🏖️' },
  { name: 'Télétravail', href: '/telework', icon: '🏠' },
];

const adminNavigation: NavItem[] = [
  { name: 'Rapports & Analytics', href: '/reports', icon: '📊' },
  { name: 'Utilisateurs', href: '/users', icon: '👥' },
  { name: 'Départements', href: '/departments', icon: '🏢' },
  { name: 'Compétences', href: '/skills', icon: '⭐' },
  { name: 'Paramètres', href: '/settings', icon: '⚙️', adminOnly: true },
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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-blue-600">ORCHESTR&apos;A</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            {sidebarOpen ? '◀' : '▶'}
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
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
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
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase">
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
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100'
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
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={logout}
              className="mt-3 w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Déconnexion
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {navigation.find((item) => item.href === pathname)?.name ||
              adminNavigation.find((item) => item.href === pathname)?.name ||
              'ORCHESTR\'A V2'}
          </h2>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
              🔔
            </button>
            <Link
              href="/profile"
              className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
            >
              ⚙️
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
