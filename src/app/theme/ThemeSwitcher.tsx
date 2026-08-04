import type { ChangeEvent } from "react";

import { useTheme } from "./theme-context";
import type { ThemePreference } from "./theme-preference";

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "System", value: "system" },
  { label: "Hell", value: "light" },
  { label: "Dunkel", value: "dark" },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPreference(event.target.value as ThemePreference);
  };

  return (
    <label className="theme-switcher">
      <span>Farbschema</span>
      <select onChange={handleChange} value={preference}>
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
