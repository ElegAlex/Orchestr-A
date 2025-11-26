'use client';

import { useState } from 'react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlanningGrid } from './PlanningGrid';
import { usePlanningData } from '@/hooks/usePlanningData';

type ViewFilter = 'all' | 'availability' | 'activity';

interface PlanningViewProps {
  filterUserId?: string; // Filtrer pour un utilisateur spécifique (pour dashboard)
  title?: string; // Titre personnalisé
  showFilters?: boolean; // Afficher les filtres (default: true)
  showControls?: boolean; // Afficher les contrôles (semaine/mois, navigation) (default: true)
  showGroupHeaders?: boolean; // Afficher les headers de groupes (default: true)
  showLegend?: boolean; // Afficher la légende (default: true)
  initialViewMode?: 'week' | 'month'; // Mode initial (default: 'week')
}

export const PlanningView = ({
  filterUserId,
  title = 'Planning des Ressources',
  showFilters = true,
  showControls = true,
  showGroupHeaders = true,
  showLegend = true,
  initialViewMode = 'week',
}: PlanningViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>(initialViewMode);
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  // Utiliser filterUserId si fourni, sinon utiliser le filtre de l'interface
  const effectiveFilterUserId = filterUserId || (selectedUser !== 'ALL' ? selectedUser : undefined);

  const { displayDays, users } = usePlanningData({
    currentDate,
    viewMode,
    filterUserId: effectiveFilterUserId,
    viewFilter,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">
            {viewMode === 'week'
              ? `Semaine du ${format(displayDays[0] || new Date(), 'dd MMM', {
                  locale: fr,
                })} au ${format(displayDays[displayDays.length - 1] || new Date(), 'dd MMM yyyy', {
                  locale: fr,
                })}`
              : format(currentDate, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>
        {showControls && (
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === 'week' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === 'month' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                }`}
              >
                Mois
              </button>
            </div>
            <button
              onClick={() =>
                viewMode === 'week'
                  ? setCurrentDate(subWeeks(currentDate, 1))
                  : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">←</span>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() =>
                viewMode === 'week'
                  ? setCurrentDate(addWeeks(currentDate, 1))
                  : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">→</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && !filterUserId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <label className="text-sm font-medium text-gray-700">Ressource :</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Toutes les ressources</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Affichage :</label>
              <select
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tout</option>
                <option value="availability">Disponibilités</option>
                <option value="activity">Activités</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 ml-auto">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded mr-1"></span>Tâche
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded mr-1"></span>Congé
                </span>
                <span className="flex items-center">
                  <span>🏠</span>Télétravail
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planning Grid */}
      <PlanningGrid
        currentDate={currentDate}
        viewMode={viewMode}
        filterUserId={effectiveFilterUserId}
        viewFilter={viewFilter}
        showGroupHeaders={showGroupHeaders}
      />

      {/* Legend */}
      {showLegend && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Légende</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <span>○</span>
              <span>À faire</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>◐</span>
              <span>En cours</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>◕</span>
              <span>En revue</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>●</span>
              <span>Terminé</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>⊗</span>
              <span>Bloqué</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏠</span>
              <span>Télétravail</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏢</span>
              <span>Bureau</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🌴</span>
              <span>Congé validé</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="opacity-60">🌴?</span>
              <span>Congé en attente</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
