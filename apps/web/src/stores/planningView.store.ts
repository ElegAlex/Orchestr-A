import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LegendFilterKey =
  | "todo"
  | "inProgress"
  | "inReview"
  | "done"
  | "blocked"
  | "projectTask"
  | "orphanTask"
  | "telework"
  | "office"
  | "leaveValidated"
  | "leavePending"
  | "event"
  | "externalIntervention";

export type LegendFiltersState = Record<LegendFilterKey, boolean>;

export const DEFAULT_LEGEND_FILTERS: LegendFiltersState = {
  todo: true,
  inProgress: true,
  inReview: true,
  done: true,
  blocked: true,
  projectTask: true,
  orphanTask: true,
  telework: true,
  office: true,
  leaveValidated: true,
  leavePending: true,
  event: true,
  externalIntervention: true,
};

interface PlanningViewState {
  /** Map serviceId -> isCollapsed */
  collapsedServices: Record<string, boolean>;

  /** IDs des services actuellement sélectionnés dans le filtre */
  selectedServices: string[];

  /** Flag pour distinguer "jamais initialisé" de "explicitement vide" */
  hasInitializedServices: boolean;

  /**
   * Filtres de visibilité de la légende planning.
   * Non persistés (exclus de `partialize`) → reset à chaque reload (session-only).
   */
  legendFilters: LegendFiltersState;

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

  /** Basculer un filtre légende individuel (ON/OFF) */
  toggleLegendFilter: (key: LegendFilterKey) => void;

  /** Réinitialiser tous les filtres légende à `true` */
  resetLegendFilters: () => void;
}

export const usePlanningViewStore = create<PlanningViewState>()(
  persist(
    (set, get) => ({
      collapsedServices: {},
      selectedServices: [],
      hasInitializedServices: false,
      legendFilters: { ...DEFAULT_LEGEND_FILTERS },

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

      toggleLegendFilter: (key: LegendFilterKey) => {
        set((state) => ({
          legendFilters: {
            ...state.legendFilters,
            [key]: !state.legendFilters[key],
          },
        }));
      },

      resetLegendFilters: () => {
        set({ legendFilters: { ...DEFAULT_LEGEND_FILTERS } });
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
