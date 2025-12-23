import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlanningViewState {
  /** Map serviceId -> isCollapsed */
  collapsedServices: Record<string, boolean>;

  /** Basculer l'état d'un service */
  toggleService: (serviceId: string) => void;

  /** Replier un service spécifique */
  collapseService: (serviceId: string) => void;

  /** Déplier un service spécifique */
  expandService: (serviceId: string) => void;

  /** Replier tous les services */
  collapseAll: (serviceIds: string[]) => void;

  /** Déplier tous les services */
  expandAll: () => void;

  /** Vérifier si un service est replié */
  isCollapsed: (serviceId: string) => boolean;
}

export const usePlanningViewStore = create<PlanningViewState>()(
  persist(
    (set, get) => ({
      collapsedServices: {},

      toggleService: (serviceId: string) => {
        set((state) => ({
          collapsedServices: {
            ...state.collapsedServices,
            [serviceId]: !state.collapsedServices[serviceId],
          },
        }));
      },

      collapseService: (serviceId: string) => {
        set((state) => ({
          collapsedServices: {
            ...state.collapsedServices,
            [serviceId]: true,
          },
        }));
      },

      expandService: (serviceId: string) => {
        set((state) => ({
          collapsedServices: {
            ...state.collapsedServices,
            [serviceId]: false,
          },
        }));
      },

      collapseAll: (serviceIds: string[]) => {
        const allCollapsed: Record<string, boolean> = {};
        serviceIds.forEach((id) => {
          allCollapsed[id] = true;
        });
        set({ collapsedServices: allCollapsed });
      },

      expandAll: () => {
        set({ collapsedServices: {} });
      },

      isCollapsed: (serviceId: string) => {
        return get().collapsedServices[serviceId] ?? false;
      },
    }),
    {
      name: 'orchestra-planning-view',
      partialize: (state) => ({ collapsedServices: state.collapsedServices }),
    }
  )
);
