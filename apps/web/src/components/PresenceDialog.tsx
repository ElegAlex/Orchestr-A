'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usersService, UserPresenceItem, PresenceData } from '@/services/users.service';

function UserPresenceCard({ user }: { user: UserPresenceItem }) {
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium overflow-hidden">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={`${user.firstName} ${user.lastName}`}
            width={36}
            height={36}
            className="rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.firstName} {user.lastName}
        </p>
        {user.serviceName && (
          <p className="text-xs text-gray-500 truncate">
            {user.serviceName}
          </p>
        )}
      </div>
    </div>
  );
}

function PresenceList({
  users,
  emptyMessage
}: {
  users: UserPresenceItem[];
  emptyMessage: string;
}) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
      {users.map((user) => (
        <UserPresenceCard key={user.id} user={user} />
      ))}
    </div>
  );
}

function PresenceLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
          <div className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PresenceDialog() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PresenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'onsite' | 'remote' | 'absent'>('onsite');

  useEffect(() => {
    if (open) {
      fetchPresence();
    }
  }, [open]);

  const fetchPresence = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await usersService.getPresence();
      setData(result);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Presence
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-25 transition-opacity"
              onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Presence du jour
                  </h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {error ? (
                  <div className="text-center py-8 text-red-600">
                    {error}
                  </div>
                ) : (
                  <>
                    {/* Summary badges */}
                    {data && (
                      <div className="flex gap-2 mb-4 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {data.totals.onSite} sur site
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          {data.totals.remote} teletravail
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          {data.totals.absent} absents
                        </span>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="border-b border-gray-200 mb-4">
                      <nav className="-mb-px flex space-x-4">
                        <button
                          onClick={() => setActiveTab('onsite')}
                          className={`pb-3 px-1 border-b-2 text-sm font-medium transition ${
                            activeTab === 'onsite'
                              ? 'border-green-500 text-green-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Sur site
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('remote')}
                          className={`pb-3 px-1 border-b-2 text-sm font-medium transition ${
                            activeTab === 'remote'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Teletravail
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('absent')}
                          className={`pb-3 px-1 border-b-2 text-sm font-medium transition ${
                            activeTab === 'absent'
                              ? 'border-gray-500 text-gray-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Absents
                          </span>
                        </button>
                      </nav>
                    </div>

                    {/* Tab content */}
                    {loading ? (
                      <PresenceLoadingSkeleton />
                    ) : data ? (
                      <div>
                        {activeTab === 'onsite' && (
                          <PresenceList
                            users={data.onSite}
                            emptyMessage="Aucun collaborateur sur site"
                          />
                        )}
                        {activeTab === 'remote' && (
                          <PresenceList
                            users={data.remote}
                            emptyMessage="Aucun collaborateur en teletravail"
                          />
                        )}
                        {activeTab === 'absent' && (
                          <PresenceList
                            users={data.absent}
                            emptyMessage="Aucun collaborateur absent"
                          />
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
