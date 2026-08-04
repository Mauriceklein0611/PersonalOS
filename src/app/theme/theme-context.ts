import { createContext, useContext } from "react";

import type { ThemePreference } from "./theme-preference";

export type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new Error(
      "useTheme muss innerhalb des ThemeProvider verwendet werden.",
    );
  }

  return value;
}
