/**
 * Gemeinsame Grundlage der Datenpalette. Eine Serie wird immer über Text oder
 * Muster unterscheidbar; die Farbe ist ausschließlich Zusatz.
 */
export const dataSeriesTones = [1, 2, 3, 4, 5, 6] as const;

export type DataSeriesTone = (typeof dataSeriesTones)[number];

/** Zeichen für Legenden und Listen, damit Serien ohne Farbe lesbar bleiben. */
export const dataSeriesMarkers: Record<DataSeriesTone, string> = {
  1: "●",
  2: "■",
  3: "▲",
  4: "◆",
  5: "✚",
  6: "✕",
};

/** Strichmuster für Linien, damit Serien ohne Farbe lesbar bleiben. */
export const dataSeriesDashes: Record<DataSeriesTone, string | undefined> = {
  1: undefined,
  2: "7 4",
  3: "2 3",
  4: "11 4 2 4",
  5: "1 4",
  6: "8 3 1 3",
};

/** Anteil zwischen 0 und 1 als deutscher Prozenttext, ohne Nachkommastellen. */
export function formatRatio(value: number): string {
  return `${Math.round(clampRatio(value) * 100)} %`;
}

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

/** Einheitlicher Text, wenn keine Datenbasis vorliegt. Niemals „0 %“. */
export const noDataText = "Keine Angabe";
