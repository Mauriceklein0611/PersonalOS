export type NavigationIconName =
  | "finance"
  | "goals"
  | "habits"
  | "insights"
  | "journal"
  | "settings"
  | "tasks"
  | "today"
  | "weekly-review";

export type NavigationItem = {
  icon: NavigationIconName;
  /** Ein Begriff je Bereich, auf jeder Größe und in jeder Überschrift. */
  label: string;
  to: string;
};

export const primaryNavigationItems: NavigationItem[] = [
  { icon: "today", label: "Heute", to: "/" },
  { icon: "tasks", label: "Aufgaben", to: "/aufgaben" },
  { icon: "habits", label: "Gewohnheiten", to: "/gewohnheiten" },
  { icon: "journal", label: "Journal", to: "/journal" },
];

export const secondaryNavigationItems: NavigationItem[] = [
  { icon: "goals", label: "Ziele", to: "/ziele" },
  { icon: "finance", label: "Finanzen", to: "/finanzen" },
  { icon: "insights", label: "Insights", to: "/insights" },
  {
    icon: "weekly-review",
    label: "Wochenrückblick",
    to: "/wochenrueckblick",
  },
  { icon: "settings", label: "Einstellungen", to: "/einstellungen" },
];

export const navigationItems = [
  ...primaryNavigationItems,
  ...secondaryNavigationItems,
];
