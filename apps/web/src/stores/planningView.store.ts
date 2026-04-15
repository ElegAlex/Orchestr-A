import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PlanningViewState {
  /** Map serviceId -> isCollapsed */
  collapsedServices: Record<string, boolean>;

  /** IDs des services actuellement sélectionnés dans le filtre */
  selectedServices: string[];

  /** Flag pour distinguer "jamais initialisé" de "explicitement vide" */
  hasInitializedServices: boolean;

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

  /** Définir la sélection de services (action utilisateur explicite) */
  setSelectedServices: (serviceIds: string[]) => void;

  /**
   * Initialise la sélection de services si ce n'est pas déjà fait.
   * À appeler une fois la liste des services chargée. Si l'utilisateur
   * a déjà interagi (hasInitializedServices === true), ne fait rien,
   * même si selectedServices est vide (respect de l'intention utilisateur).
   */
  initializeServicesIfNeeded: (availableServiceIds: string[]) => void;
}

export const usePlanningViewStore = create<PlanningViewState>()(
  persist(
    (set, get) => ({
      collapsedServices: {},
      selectedServices: [],
      hasInitializedServices: false,

      setSelectedServices: (serviceIds: string[]) => {
        // Toute action utilisateur explicite marque le store comme initialisé :
        // une liste vide choisie par l'utilisateur ne doit PAS être écrasée
        // par une initialisation automatique au prochain montage.
        set({ selectedServices: serviceIds, hasInitializedServices: true });
      },

      initializeServicesIfNeeded: (availableServiceIds: string[]) => {
        if (get().hasInitializedServices) return;
        if (availableServiceIds.length === 0) return;
        set({
          selectedServices: availableServiceIds,
          hasInitializedServices: true,
        });
      },

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
      name: "orchestra-planning-view",
      partialize: (state) => ({
        collapsedServices: state.collapsedServices,
        selectedServices: state.selectedServices,
        hasInitializedServices: state.hasInitializedServices,
      }),
    },
  ),
);
