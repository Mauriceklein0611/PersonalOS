import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyTheme,
  getSystemThemeQuery,
  persistThemePreference,
  readThemePreference,
  type ThemePreference,
} from "./theme-preference";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemThemeQuery = useMemo(() => getSystemThemeQuery(), []);
  const [preference, setPreferenceState] = useState(readThemePreference);

  useLayoutEffect(() => {
    applyTheme(preference, document.documentElement, systemThemeQuery);
  }, [preference, systemThemeQuery]);

  useEffect(() => {
    if (preference !== "system" || systemThemeQuery === null) {
      return undefined;
    }

    const updateSystemTheme = () => {
      applyTheme("system", document.documentElement, systemThemeQuery);
    };

    systemThemeQuery.addEventListener("change", updateSystemTheme);
    return () =>
      systemThemeQuery.removeEventListener("change", updateSystemTheme);
  }, [preference, systemThemeQuery]);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      persistThemePreference(nextPreference);
      applyTheme(nextPreference, document.documentElement, systemThemeQuery);
      setPreferenceState(nextPreference);
    },
    [systemThemeQuery],
  );

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
