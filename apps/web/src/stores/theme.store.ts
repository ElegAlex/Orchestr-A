import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "girly";

interface ThemeState {
  theme: Theme;
  previousTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  exitGirlyMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      previousTheme: "light",

      setTheme: (theme: Theme) => {
        const { theme: currentTheme } = get();
        if (theme !== "girly") {
          set({ theme, previousTheme: theme });
        } else {
          set({
            theme,
            previousTheme: currentTheme !== "girly" ? currentTheme : "light",
          });
        }
        if (typeof window !== "undefined") {
          const root = document.documentElement;
          root.classList.remove("light", "dark", "girly");
          root.classList.add(theme);
        }
      },

      toggleTheme: () => {
        const { theme } = get();
        const nextTheme = theme === "light" ? "dark" : "light";
        get().setTheme(nextTheme);
      },

      exitGirlyMode: () => {
        const { theme, previousTheme } = get();
        if (theme === "girly") {
          get().setTheme(previousTheme);
        }
      },
    }),
    {
      name: "orchestr-a-theme",
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== "undefined") {
          const root = document.documentElement;
          root.classList.remove("light", "dark", "girly");
          root.classList.add(state.theme);
        }
      },
    },
  ),
);
