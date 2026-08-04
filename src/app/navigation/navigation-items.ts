export type NavigationItem = {
  label: string;
  shortLabel: string;
  to: string;
};

export const primaryNavigationItems: NavigationItem[] = [
  { label: "Heute", shortLabel: "Heute", to: "/" },
  { label: "Aufgaben", shortLabel: "Aufgaben", to: "/aufgaben" },
  { label: "Gewohnheiten", shortLabel: "Routinen", to: "/gewohnheiten" },
  { label: "Journal", shortLabel: "Journal", to: "/journal" },
];

export const secondaryNavigationItems: NavigationItem[] = [
  { label: "Ziele", shortLabel: "Ziele", to: "/ziele" },
  { label: "Finanzen", shortLabel: "Finanzen", to: "/finanzen" },
  { label: "Insights", shortLabel: "Insights", to: "/insights" },
  {
    label: "Einstellungen",
    shortLabel: "Einstellungen",
    to: "/einstellungen",
  },
];

export const navigationItems = [
  ...primaryNavigationItems,
  ...secondaryNavigationItems,
];
