import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsService } from '@/services/settings.service';

interface SettingsState {
  settings: Record<string, any>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<void>;
  getSetting: <T = any>(key: string, defaultValue?: T) => T;
}

// Valeurs par défaut pour l'application
const DEFAULT_SETTINGS: Record<string, any> = {
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  dateTimeFormat: 'dd/MM/yyyy HH:mm',
  locale: 'fr-FR',
  weekStartsOn: 1,
  appName: 'ORCHESTR\'A',
  defaultLeaveDays: 25,
  maxTeleworkDaysPerWeek: 3,
  emailNotifications: true,
  leaveRequestNotifications: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      isLoaded: false,
      error: null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await settingsService.getAll();
          set({
            settings: { ...DEFAULT_SETTINGS, ...response.settings },
            isLoading: false,
            isLoaded: true,
          });
        } catch (error: any) {
          console.error('Error fetching settings:', error);
          set({
            error: error.message || 'Erreur lors du chargement des paramètres',
            isLoading: false,
            isLoaded: true, // Mark as loaded even on error to use defaults
          });
        }
      },

      updateSetting: async (key: string, value: any) => {
        try {
          await settingsService.update(key, value);
          set((state) => ({
            settings: { ...state.settings, [key]: value },
          }));
        } catch (error: any) {
          console.error('Error updating setting:', error);
          throw error;
        }
      },

      getSetting: <T = any>(key: string, defaultValue?: T): T => {
        const { settings } = get();
        if (settings[key] !== undefined) {
          return settings[key] as T;
        }
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        return DEFAULT_SETTINGS[key] as T;
      },
    }),
    {
      name: 'orchestr-a-settings',
      partialize: (state) => ({ settings: state.settings, isLoaded: state.isLoaded }),
    }
  )
);
