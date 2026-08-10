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

/**
 * Ein Hauptbereich mit seinen Unterbereichen.
 *
 * Vier Bereiche im Band, mehr nicht. Vorher lagen acht gleichrangige Punkte
 * nebeneinander, und ausgerechnet die Finanzen — mit einer der häufigsten
 * Erfassungsaktionen — steckten hinter dem Überlaufmenü.
 */
export type NavigationArea = NavigationItem & {
  /** Leer, wenn der Bereich aus einer einzigen Ansicht besteht. */
  items: NavigationItem[];
};

const planArea: NavigationArea = {
  icon: "tasks",
  // Aufgaben und Ziele beantworten dieselbe Frage: was tue ich und wofür.
  items: [
    { icon: "tasks", label: "Aufgaben", to: "/planen/aufgaben" },
    { icon: "goals", label: "Ziele", to: "/planen/ziele" },
  ],
  label: "Planen",
  to: "/planen",
};

const routineArea: NavigationArea = {
  icon: "habits",
  // Beides ist tägliche Selbsterfassung im festen Rhythmus; der Abendeintrag
  // ist selbst eine Routine.
  items: [
    { icon: "habits", label: "Routinen", to: "/routinen/uebersicht" },
    { icon: "journal", label: "Journal", to: "/routinen/journal" },
  ],
  label: "Routinen",
  to: "/routinen",
};

const moneyArea: NavigationArea = {
  icon: "finance",
  items: [],
  label: "Geld",
  to: "/geld",
};

/**
 * Auswertung fasst die drei Sichten auf dieselbe Frage zusammen. Sie wird
 * wöchentlich besucht, nicht täglich, und liegt deshalb in der Kopfzeile statt
 * im Band.
 */
const analysisArea: NavigationArea = {
  icon: "insights",
  items: [
    { icon: "insights", label: "Überblick", to: "/auswertung/ueberblick" },
    {
      icon: "weekly-review",
      label: "Wochenrückblick",
      to: "/auswertung/wochenrueckblick",
    },
  ],
  label: "Auswertung",
  to: "/auswertung",
};

/** Die vier Einträge des mobilen Bands, jeder mit Icon und Beschriftung. */
export const primaryNavigationItems: NavigationArea[] = [
  { icon: "today", items: [], label: "Heute", to: "/" },
  planArea,
  routineArea,
  moneyArea,
];

/** Nebenbereiche: über die Kopfzeile erreichbar, nicht im Band. */
export const secondaryNavigationItems: NavigationArea[] = [
  analysisArea,
  { icon: "settings", items: [], label: "Einstellungen", to: "/einstellungen" },
];

export const navigationAreas = [
  ...primaryNavigationItems,
  ...secondaryNavigationItems,
];

export const navigationItems: NavigationItem[] = navigationAreas;

/** Die Unterbereiche des Bereichs, in dem ein Pfad liegt. */
export function findAreaForPath(pathname: string): NavigationArea | undefined {
  return navigationAreas.find(
    (area) =>
      area.items.length > 0 &&
      (pathname === area.to || pathname.startsWith(`${area.to}/`)),
  );
}
