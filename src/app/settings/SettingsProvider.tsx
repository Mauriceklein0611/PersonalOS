import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createDefaultSettingsDetails,
  toSettingsDetails,
  type Settings,
  type SettingsDetails,
} from "../../db/schemas/settings";
import {
  personalOsSettingsRepository,
  type SettingsRepository,
} from "../../db/settings/repository";
import { ThemeContext } from "../theme/theme-context";
import type { ThemePreference } from "../theme/theme-preference";
import { AppSettingsContext } from "./settings-context";

export type SettingsProviderProps = {
  children: ReactNode;
  repository?: SettingsRepository;
};

/**
 * Hält den einen Settings-Datensatz bereit. Der Datensatz entsteht beim Öffnen
 * der Datenbank; hier wird er gelesen, geändert und mit dem Bootstrap-Spiegel
 * des Themes aus ADR 0002 abgeglichen.
 */
export function SettingsProvider({
  children,
  repository = personalOsSettingsRepository,
}: SettingsProviderProps) {
  const theme = useContext(ThemeContext);
  const [settings, setSettings] = useState<SettingsDetails>(
    createDefaultSettingsDetails,
  );
  const [isStored, setIsStored] = useState(false);

  const applyStored = useCallback((stored: Settings) => {
    setSettings(toSettingsDetails(stored));
    setIsStored(true);
  }, []);

  const load = useCallback(async () => {
    applyStored(await repository.loadOrCreate());
  }, [applyStored, repository]);

  useEffect(() => {
    let isCurrent = true;
    void repository.loadOrCreate().then(
      (stored) => {
        if (isCurrent) applyStored(stored);
      },
      () => {
        // Ohne lesbaren Datensatz bleibt die Oberfläche mit den erkannten
        // Vorgaben bedienbar. Gespeichert wird dann nichts.
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [applyStored, repository]);

  /*
   * Der gespeicherte Wert ist die Quelle, sobald er vorliegt: Nach einem
   * Import oder einem gelöschten Spiegel zieht das Theme hier nach. Vorher
   * bleibt der Spiegel unangetastet, damit kein ungestaltetes Bild aufblitzt.
   */
  useEffect(() => {
    if (!isStored || theme === null) return;
    if (theme.preference !== settings.theme) {
      theme.setPreference(settings.theme);
    }
  }, [isStored, settings.theme, theme]);

  const update = useCallback(
    async (patch: Partial<SettingsDetails>) => {
      setSettings((current) => ({ ...current, ...patch }));
      try {
        applyStored(await repository.save(patch));
      } catch (error) {
        await load().catch(() => undefined);
        throw error;
      }
    },
    [applyStored, load, repository],
  );

  const value = useMemo(
    () => ({ isStored, reload: load, settings, update }),
    [isStored, load, settings, update],
  );

  const themeValue = useMemo(() => {
    if (theme === null) return null;
    return {
      preference: theme.preference,
      setPreference: (preference: ThemePreference) => {
        theme.setPreference(preference);
        void update({ theme: preference }).catch(() => undefined);
      },
    };
  }, [theme, update]);

  const content = (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );

  if (themeValue === null) {
    return content;
  }

  return (
    <ThemeContext.Provider value={themeValue}>{content}</ThemeContext.Provider>
  );
}
