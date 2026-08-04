export const themeStorageKey = "personalos.theme.v1";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getBrowserThemeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThemePreference(
  storage: ThemeStorage | null = getBrowserThemeStorage(),
): ThemePreference {
  try {
    const storedValue = storage?.getItem(themeStorageKey) ?? null;
    return isThemePreference(storedValue) ? storedValue : "system";
  } catch {
    return "system";
  }
}

export function persistThemePreference(
  preference: ThemePreference,
  storage: ThemeStorage | null = getBrowserThemeStorage(),
): void {
  try {
    storage?.setItem(themeStorageKey, preference);
  } catch {
    // Storage may be unavailable in private or hardened browser contexts.
  }
}

export function clearThemePreference(
  storage: Pick<Storage, "removeItem"> | null = getBrowserThemeStorage(),
): void {
  try {
    storage?.removeItem(themeStorageKey);
  } catch {
    // Storage may be unavailable in private or hardened browser contexts.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}

export function getSystemThemeQuery(): MediaQueryList | null {
  if (typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia("(prefers-color-scheme: dark)");
}

export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
  systemThemeQuery: MediaQueryList | null = getSystemThemeQuery(),
): ResolvedTheme {
  const resolvedTheme = resolveTheme(
    preference,
    systemThemeQuery?.matches ?? false,
  );

  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export function initializeTheme(): ThemePreference {
  const preference = readThemePreference();
  applyTheme(preference);
  return preference;
}
