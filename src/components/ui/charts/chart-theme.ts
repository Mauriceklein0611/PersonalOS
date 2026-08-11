import { dataSeriesTones, type DataSeriesTone } from "../data-series";

/**
 * Das Diagramm-Theme wird zur Laufzeit aus den CSS-Tokens gelesen. Farbwerte
 * werden dadurch genau einmal gepflegt, in `src/styles/tokens.css`, und ein
 * Theme-Wechsel wirkt ohne zweite Quelle.
 */
export type ChartTheme = {
  accent1: string;
  accent2: string;
  areaOpacity: number;
  edge: string;
  glass: string;
  grid: string;
  series: Record<DataSeriesTone, string>;
  text: string;
  textMuted: string;
  track: string;
};

/**
 * Fallbacks für Umgebungen ohne geladenes Stylesheet, etwa jsdom im Test. Sie
 * halten das Diagramm lesbar und sind bewusst neutral.
 */
const fallbackTheme: ChartTheme = {
  accent1: "#6cffb6",
  accent2: "#4de4ff",
  areaOpacity: 0.28,
  edge: "#385064",
  glass: "#0b111c",
  grid: "#324255",
  series: {
    1: "#7dffbd",
    2: "#55e7ff",
    3: "#ff70cf",
    4: "#b79cff",
    5: "#ffd166",
    6: "#78a9ff",
  },
  text: "#f2f7ff",
  textMuted: "#b8c5d8",
  track: "#324255",
};

export function readChartTheme(
  root: HTMLElement | null = typeof document === "undefined"
    ? null
    : document.documentElement,
): ChartTheme {
  if (root === null) {
    return fallbackTheme;
  }

  const styles = getComputedStyle(root);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };

  const series = Object.fromEntries(
    dataSeriesTones.map((tone) => [
      tone,
      read(`--data-${tone}`, fallbackTheme.series[tone]),
    ]),
  ) as Record<DataSeriesTone, string>;

  const areaOpacity = Number.parseFloat(
    read("--chart-area-opacity", String(fallbackTheme.areaOpacity)),
  );

  return {
    accent1: read("--accent-1", fallbackTheme.accent1),
    accent2: read("--accent-2", fallbackTheme.accent2),
    areaOpacity: Number.isFinite(areaOpacity)
      ? areaOpacity
      : fallbackTheme.areaOpacity,
    edge: read("--edge", fallbackTheme.edge),
    glass: read("--glass-opaque", fallbackTheme.glass),
    grid: read("--chart-grid", fallbackTheme.grid),
    series,
    text: read("--text", fallbackTheme.text),
    textMuted: read("--text-muted", fallbackTheme.textMuted),
    track: read("--chart-track", fallbackTheme.track),
  };
}

/**
 * Verlauf als Flächenschmuck unter einer Linie oder in einem Balken. Er
 * codiert keine Kategorie; die Kategorie steckt in der Serienfarbe selbst.
 */
export function verticalFade(
  color: string,
  opacity: number,
): {
  colorStops: Array<{ color: string; offset: number }>;
  type: "linear";
  x: number;
  x2: number;
  y: number;
  y2: number;
} {
  return {
    colorStops: [
      { color: withAlpha(color, opacity), offset: 0 },
      { color: withAlpha(color, 0), offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };
}

/**
 * Balkenfüllung: unten fast durchsichtig, oben voll. Der Balken wirkt dadurch
 * aus dem Glas herausgewachsen statt aufgeklebt.
 */
export function barFade(color: string): ReturnType<typeof verticalFade> {
  return {
    colorStops: [
      { color: withAlpha(color, 1), offset: 0 },
      { color: withAlpha(color, 0.25), offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };
}

/** Verlauf entlang der Linie, von der ersten zur zweiten Akzentfarbe. */
export function accentStroke(
  from: string,
  to: string,
): ReturnType<typeof verticalFade> {
  return {
    colorStops: [
      { color: from, offset: 0 },
      { color: to, offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 1,
    y: 0,
    y2: 0,
  };
}

/**
 * Setzt die Deckkraft einer Tokenfarbe. Tokens liegen als `#rrggbb` oder als
 * `rgb(r g b / a%)` vor; beides muss ohne zweite Farbquelle funktionieren.
 */
export function withAlpha(color: string, alpha: number): string {
  const channels = toChannels(color);
  if (channels === undefined) {
    return color;
  }

  const [red, green, blue, baseAlpha] = channels;
  const combined = Math.max(0, Math.min(1, baseAlpha * alpha));
  return `rgba(${red}, ${green}, ${blue}, ${roundAlpha(combined)})`;
}

function toChannels(
  color: string,
): [number, number, number, number] | undefined {
  const trimmed = color.trim();

  if (trimmed.startsWith("#")) {
    const digits =
      trimmed.length === 4
        ? [...trimmed.slice(1)].map((digit) => `${digit}${digit}`).join("")
        : trimmed.slice(1, 7);
    if (digits.length !== 6) return undefined;
    const value = Number.parseInt(digits, 16);
    if (Number.isNaN(value)) return undefined;
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }

  const numbers = trimmed.match(/[\d.]+%?/g);
  if (numbers === null || numbers.length < 3) return undefined;
  const [red, green, blue, opacity] = numbers;

  return [
    Number.parseFloat(red!),
    Number.parseFloat(green!),
    Number.parseFloat(blue!),
    opacity === undefined ? 1 : toUnitInterval(opacity),
  ];
}

function toUnitInterval(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 1;
  return value.includes("%") ? parsed / 100 : parsed;
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}
