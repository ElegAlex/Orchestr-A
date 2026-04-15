import { usePlanningViewStore } from "../planningView.store";

// localStorage mock (le store utilise zustand/persist → localStorage)
let localStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((k: string) => localStore[k] ?? null),
  setItem: jest.fn((k: string, v: string) => {
    localStore[k] = v;
  }),
  removeItem: jest.fn((k: string) => {
    delete localStore[k];
  }),
  clear: jest.fn(() => {
    localStore = {};
  }),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("planningView.store — initializeServicesIfNeeded (BUG-03)", () => {
  beforeEach(() => {
    localStore = {};
    // Reset l'état du store en mémoire à ses valeurs par défaut
    usePlanningViewStore.setState({
      collapsedServices: {},
      selectedServices: [],
      hasInitializedServices: false,
    });
  });

  it("store frais : initializeServicesIfNeeded sélectionne tous les services et marque initialisé", () => {
    usePlanningViewStore.getState().initializeServicesIfNeeded(["s1", "s2"]);

    const state = usePlanningViewStore.getState();
    expect(state.selectedServices).toEqual(["s1", "s2"]);
    expect(state.hasInitializedServices).toBe(true);
  });

  it("initialisé avec selectedServices vide : l'init ne doit PAS écraser (intention utilisateur respectée)", () => {
    usePlanningViewStore.setState({
      selectedServices: [],
      hasInitializedServices: true,
    });

    usePlanningViewStore.getState().initializeServicesIfNeeded(["s1", "s2"]);

    const state = usePlanningViewStore.getState();
    expect(state.selectedServices).toEqual([]);
    expect(state.hasInitializedServices).toBe(true);
  });

  it("initialisé avec selectedServices non vide : l'init ne doit PAS écraser", () => {
    usePlanningViewStore.setState({
      selectedServices: ["x"],
      hasInitializedServices: true,
    });

    usePlanningViewStore.getState().initializeServicesIfNeeded(["s1"]);

    const state = usePlanningViewStore.getState();
    expect(state.selectedServices).toEqual(["x"]);
    expect(state.hasInitializedServices).toBe(true);
  });

  it("liste disponible vide : ne rien faire, ne pas marquer initialisé", () => {
    usePlanningViewStore.getState().initializeServicesIfNeeded([]);

    const state = usePlanningViewStore.getState();
    expect(state.selectedServices).toEqual([]);
    expect(state.hasInitializedServices).toBe(false);
  });

  it("setSelectedServices : toute action utilisateur marque initialisé (même vide)", () => {
    usePlanningViewStore.getState().setSelectedServices([]);

    expect(usePlanningViewStore.getState().hasInitializedServices).toBe(true);
    expect(usePlanningViewStore.getState().selectedServices).toEqual([]);

    // Et par la suite, init est un no-op
    usePlanningViewStore.getState().initializeServicesIfNeeded(["s1", "s2"]);
    expect(usePlanningViewStore.getState().selectedServices).toEqual([]);
  });
});
