'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { settingsService, AppSetting } from '@/services/settings.service';
import { Role } from '@/types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { HolidaysManager } from '@/components/holidays/HolidaysManager';

type CategoryTab = 'display' | 'notifications' | 'holidays';

const DATE_FORMAT_OPTIONS = [
  { value: 'dd/MM/yyyy', label: 'JJ/MM/AAAA (31/12/2025)', example: '31/12/2025' },
  { value: 'MM/dd/yyyy', label: 'MM/JJ/AAAA (12/31/2025)', example: '12/31/2025' },
  { value: 'yyyy-MM-dd', label: 'AAAA-MM-JJ (2025-12-31)', example: '2025-12-31' },
  { value: 'd MMMM yyyy', label: 'J Mois AAAA (31 décembre 2025)', example: '31 décembre 2025' },
  { value: 'EEEE d MMMM yyyy', label: 'Jour J Mois AAAA (mercredi 31 décembre 2025)', example: 'mercredi 31 décembre 2025' },
];

const TIME_FORMAT_OPTIONS = [
  { value: 'HH:mm', label: '24h (14:30)', example: '14:30' },
  { value: 'HH:mm:ss', label: '24h avec secondes (14:30:45)', example: '14:30:45' },
  { value: 'hh:mm a', label: '12h (02:30 PM)', example: '02:30 PM' },
];

const LOCALE_OPTIONS = [
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'en-US', label: 'English (US)' },
];

const WEEK_START_OPTIONS = [
  { value: 1, label: 'Lundi' },
  { value: 0, label: 'Dimanche' },
];

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { fetchSettings } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryTab>('display');
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [, setSettingsList] = useState<AppSetting[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const isAdmin = user?.role === Role.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }
    loadSettings();
  }, [isAdmin, router]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getAll();
      setSettings(response.settings);
      setSettingsList(response.list);
    } catch (err) {
      console.error('Error loading settings:', err);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.bulkUpdate(settings);
      await fetchSettings(); // Refresh global settings
      setHasChanges(false);
      toast.success('Paramètres enregistrés avec succès');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      console.error('Error saving settings:', err);
      toast.error(axiosError.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres à leurs valeurs par défaut ?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await settingsService.resetAllToDefaults();
      setSettings(response.settings);
      setSettingsList(response.list);
      await fetchSettings();
      setHasChanges(false);
      toast.success('Paramètres réinitialisés');
    } catch (err) {
      console.error('Error resetting settings:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
            <p className="text-gray-600 mt-1">Configuration globale de l&apos;application</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Réinitialiser
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>Enregistrer</span>
              )}
            </button>
          </div>
        </div>

        {hasChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              Vous avez des modifications non enregistrées.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('display')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'display'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Affichage
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holidays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Jours feries
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Display Settings */}
          {activeTab === 'display' && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Paramètres d&apos;affichage</h2>

              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format de date
                </label>
                <select
                  value={(settings.dateFormat as string) || 'dd/MM/yyyy'}
                  onChange={(e) => handleChange('dateFormat', e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {DATE_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Exemple : {DATE_FORMAT_OPTIONS.find((o) => o.value === settings.dateFormat as string)?.example || '31/12/2025'}
                </p>
              </div>

              {/* Time Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format d&apos;heure
                </label>
                <select
                  value={(settings.timeFormat as string) || 'HH:mm'}
                  onChange={(e) => handleChange('timeFormat', e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {TIME_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Locale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Langue / Région
                </label>
                <select
                  value={(settings.locale as string) || 'fr-FR'}
                  onChange={(e) => handleChange('locale', e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {LOCALE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Affecte le format des noms de mois et jours de la semaine
                </p>
              </div>

              {/* Week Starts On */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Premier jour de la semaine
                </label>
                <select
                  value={(settings.weekStartsOn as number) ?? 1}
                  onChange={(e) => handleChange('weekStartsOn', parseInt(e.target.value))}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {WEEK_START_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Paramètres de notifications</h2>

              {/* Email Notifications */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Notifications par email</p>
                  <p className="text-sm text-gray-500">Activer l&apos;envoi de notifications par email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings.emailNotifications as boolean) ?? true}
                    onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Leave Request Notifications */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Demandes de congés</p>
                  <p className="text-sm text-gray-500">Notifier les managers des nouvelles demandes de congés</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings.leaveRequestNotifications as boolean) ?? true}
                    onChange={(e) => handleChange('leaveRequestNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="flex items-start">
                  <span className="text-blue-600 text-xl mr-3">ℹ️</span>
                  <div>
                    <p className="font-medium text-blue-800">Note</p>
                    <p className="text-sm text-blue-700">
                      Les notifications par email nécessitent une configuration SMTP.
                      Contactez l&apos;administrateur système pour activer cette fonctionnalité.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Holidays Settings */}
          {activeTab === 'holidays' && (
            <div className="p-6">
              <HolidaysManager />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
