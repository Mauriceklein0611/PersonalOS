import { describe, expect, it } from "vitest";

import {
  applyTheme,
  clearThemePreference,
  initializeTheme,
  readThemePreference,
  resolveTheme,
  themeStorageKey,
  type ThemeStorage,
} from "./theme-preference";

describe("theme preference", () => {
  it("falls back to system for an invalid stored value", () => {
    const storage: ThemeStorage = {
      getItem: () => "sepia",
      setItem: () => undefined,
    };

    expect(readThemePreference(storage)).toBe("system");
  });

  it("resolves the system preference neutrally", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("applies the resolved preference to a root element", () => {
    const root = document.createElement("div");
    const mediaQuery = {
      matches: true,
    } as MediaQueryList;

    expect(applyTheme("system", root, mediaQuery)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("reads the versioned storage key", () => {
    const storage: ThemeStorage = {
      getItem: (key) => (key === themeStorageKey ? "light" : null),
      setItem: () => undefined,
    };

    expect(readThemePreference(storage)).toBe("light");
  });

  it("initializes the stored theme synchronously before the app renders", () => {
    window.localStorage.setItem(themeStorageKey, "dark");

    expect(initializeTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    clearThemePreference();
    expect(window.localStorage.getItem(themeStorageKey)).toBeNull();

    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
  });
});
