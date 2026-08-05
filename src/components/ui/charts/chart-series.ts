import type { DataSeriesTone } from "../data-series";

export type ChartSeries = {
  id: string;
  label: string;
  tone: DataSeriesTone;
  /** `null` bedeutet: für diesen Zeitpunkt liegt kein Wert vor. */
  values: Array<number | null>;
};

/** Höchstens drei Serien je Diagramm; weitere werden bewusst nicht gezeichnet. */
export const maximumChartSeries = 3;
