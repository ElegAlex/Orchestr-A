'use client';

import { useEffect } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { HolidaysManager } from '@/components/holidays/HolidaysManager';
import { Role } from '@/types';
import { useRouter } from 'next/navigation';

export default function HolidaysPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const isAdmin = user?.role === Role.ADMIN;

  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/dashboard');
    }
  }, [user, isAdmin, router]);

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/settings')}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des jours feries
              </h1>
            </div>
            <p className="text-gray-600 mt-1">
              Configurez les jours feries et ponts de votre organisation
            </p>
          </div>
        </div>

        {/* Contenu */}
        <HolidaysManager />
      </div>
    </MainLayout>
  );
}
