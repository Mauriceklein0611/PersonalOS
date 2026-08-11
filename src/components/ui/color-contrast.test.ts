import { describe, expect, it } from "vitest";

/**
 * Neo Quiet Density verwendet deckende Arbeitsflächen. Nur die Shell und der
 * Hero bleiben durchscheinend; für sie rechnet die Prüfung weiterhin den
 * ungünstigsten Nebelfleck und den Shell-Alpha-Wert zusammen.
 * Erreicht ein Wert die Schwelle nicht, wird das Token geändert, nicht die
 * Schwelle. Die Werte stammen aus `src/styles/tokens.css`.
 *
 * Die dichten Flächen aus Issue #117 sind deckend und deshalb vom Nebel
 * unabhängig. Dass sie im Browser tatsächlich ohne Blur und deckend
 * ankommen, prüft `e2e/components.spec.ts`; hier steht nur ihr Kontrast.
 */

type Rgba = { alpha: number; blue: number; green: number; red: number };

const themes = {
  dark: {
    /** Farbstopps des Grundverlaufs; der hellste trägt den Nebel. */
    canvasStops: ["#05070d", "#07101a", "#0b0712"],
    /** Nebelflecken; sie überlappen einander nicht. */
    blobs: [
      rgba(58, 255, 181, 0.18),
      rgba(61, 222, 255, 0.17),
      rgba(191, 119, 255, 0.16),
      rgba(255, 74, 193, 0.13),
    ],
    /** `brightness` aus `--blur-glass`; der Filter dimmt den Untergrund. */
    backdropBrightness: 0.78,
    shellGlass: rgba(7, 12, 20, 0.84),
    glass: rgba(11, 17, 28, 1),
    glassStrong: rgba(16, 25, 39, 1),
    glassOpaque: "#0b111c",
    field: rgba(7, 13, 23, 1),
    text: "#f2f7ff",
    textMuted: rgba(184, 197, 216, 1),
    accents: ["#6cffb6", "#4de4ff"],
    accentContrast: "#03110d",
    accentText: "#9effd1",
    accentSoft: rgba(108, 255, 182, 0.12),
    danger: "#ff9ab2",
    dangerSurface: "#ff5a84",
    dangerContrast: "#1a0309",
    focusRing: "#4de4ff",
    edgeStrong: rgba(151, 255, 212, 0.52),
    data: ["#7dffbd", "#55e7ff", "#ff70cf", "#b79cff", "#ffd166", "#78a9ff"],
    densePanel: "#070b12",
    denseRow: rgba(226, 238, 255, 0.04),
    denseRowActive: rgba(108, 255, 182, 0.1),
  },
  light: {
    canvasStops: ["#edf7f3", "#eef5fa", "#f6f0fb"],
    blobs: [
      rgba(42, 220, 172, 0.24),
      rgba(45, 196, 255, 0.2),
      rgba(194, 85, 255, 0.16),
      rgba(255, 70, 181, 0.13),
    ],
    /** Hier hebt der Filter den Untergrund an, statt ihn zu dimmen. */
    backdropBrightness: 1,
    shellGlass: rgba(248, 252, 251, 0.84),
    glass: rgba(248, 250, 252, 1),
    glassStrong: rgba(240, 245, 247, 1),
    glassOpaque: "#f8fafc",
    field: rgba(255, 255, 255, 1),
    text: "#15202b",
    textMuted: rgba(21, 32, 43, 0.72),
    accents: ["#057a55", "#006b8f"],
    accentContrast: "#ffffff",
    accentText: "#056342",
    accentSoft: rgba(5, 122, 85, 0.12),
    danger: "#8f3025",
    dangerSurface: "#8f3025",
    dangerContrast: "#ffffff",
    focusRing: "#006b8f",
    edgeStrong: rgba(21, 32, 43, 0.55),
    data: ["#057a55", "#006b8f", "#7a35b8", "#b45309", "#087f78", "#b21c64"],
    densePanel: "#f4f7f8",
    denseRow: rgba(21, 32, 43, 0.04),
    denseRowActive: rgba(5, 122, 85, 0.1),
  },
} as const;

type ThemeName = keyof typeof themes;
const themeNames = Object.keys(themes) as ThemeName[];

/**
 * Für helle Schrift auf der dunklen Shell ist der hellste Untergrund der
 * schlimmste Fall, für dunkle Schrift auf der hellen Shell der dunkelste.
 */
function worstBackdrop(theme: ThemeName): Rgba {
  const { blobs, canvasStops } = themes[theme];
  const compositions = canvasStops.flatMap((stop) => {
    const base = parseHex(stop);
    return [base, ...blobs.map((blob) => composite(blob, base))];
  });

  return pickExtreme(theme, compositions);
}

function pickExtreme(theme: ThemeName, colors: readonly Rgba[]): Rgba {
  return colors.reduce((worst, color) =>
    theme === "dark"
      ? relativeLuminance(color) > relativeLuminance(worst)
        ? color
        : worst
      : relativeLuminance(color) < relativeLuminance(worst)
        ? color
        : worst,
  );
}

/**
 * Die Shell wird über dem ungünstigsten Nebel geschichtet. Alle übrigen
 * Flächen sind deckend und damit unabhängig von Blur, fehlender
 * Blur-Unterstützung und reduzierter Transparenz.
 */
function surfaces(theme: ThemeName): Array<{ color: Rgba; name: string }> {
  const backdrop = worstBackdrop(theme);
  const {
    backdropBrightness,
    densePanel,
    denseRow,
    denseRowActive,
    field,
    glass,
    glassOpaque,
    glassStrong,
    shellGlass,
  } = themes[theme];
  const filtered = scale(backdrop, backdropBrightness);
  const glassSurface = composite(glass, filtered);
  const densePanelSurface = parseHex(densePanel);

  return [
    { color: composite(shellGlass, filtered), name: "shell-glass" },
    { color: glassSurface, name: "glass" },
    { color: composite(glassStrong, glassSurface), name: "glass-strong" },
    { color: parseHex(glassOpaque), name: "glass-opaque" },
    { color: composite(field, backdrop), name: "field" },
    { color: densePanelSurface, name: "dense-panel" },
    { color: composite(denseRow, densePanelSurface), name: "dense-row" },
    {
      color: composite(denseRowActive, densePanelSurface),
      name: "dense-row-active",
    },
  ];
}

/** `brightness()` multipliziert jeden Farbkanal, siehe Filter-Effects-Spec. */
function scale(color: Rgba, factor: number): Rgba {
  const clamp = (channel: number) =>
    Math.min(255, Math.max(0, channel * factor));
  return rgba(clamp(color.red), clamp(color.green), clamp(color.blue), 1);
}

describe.each(themeNames)("glass palette %s", (theme) => {
  const { accentContrast, accents, danger, dangerContrast, text, textMuted } =
    themes[theme];

  it.each(surfaces(theme))("keeps body text readable on $name", ({ color }) => {
    expect(contrastRatio(parseHex(text), color)).toBeGreaterThanOrEqual(4.5);
  });

  // Gedämpfter Text ist selbst durchscheinend und mischt sich mit der Fläche.
  it.each(surfaces(theme))(
    "keeps muted text readable on $name",
    ({ color }) => {
      expect(
        contrastRatio(composite(textMuted, color), color),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(surfaces(theme))(
    "keeps error text readable on $name",
    ({ color }) => {
      expect(contrastRatio(parseHex(danger), color)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  /*
   * Der ausgewählte Zustand — aktiver Navigationslink, aktiver Reiter, gewählte
   * Skalenstufe — färbt seine Schrift im Akzent und legt sie auf
   * `--accent-soft`. Beide Schichten gehören deshalb in dieselbe Prüfung: Die
   * weiche Fläche verschiebt den Untergrund, auf dem die Schrift landet.
   */
  const accentSurfaces = surfaces(theme).flatMap(({ color, name }) => [
    { color, name },
    {
      color: composite(themes[theme].accentSoft, color),
      name: `${name} + accent-soft`,
    },
  ]);

  it.each(accentSurfaces)(
    "keeps accent text readable on $name",
    ({ color }) => {
      expect(
        contrastRatio(parseHex(themes[theme].accentText), color),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(accents)("keeps accent contrast on the gradient stop %s", (stop) => {
    expect(
      contrastRatio(parseHex(accentContrast), parseHex(stop)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the danger button label readable", () => {
    expect(
      contrastRatio(
        parseHex(dangerContrast),
        parseHex(themes[theme].dangerSurface),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * Überschriften und Meldungen liegen zwischen den Karten direkt auf dem
   * Nebel. Gedämpfte Schrift gehört dort nicht hin und wird deshalb auch nicht
   * geprüft: Sie steht laut `docs/UI_GUIDELINES.md` ausschließlich auf Glas.
   */
  it("keeps a heading readable directly on the fog", () => {
    expect(
      contrastRatio(parseHex(text), worstBackdrop(theme)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(themeNames)("glass non-text contrast %s", (theme) => {
  const { data, edgeStrong, focusRing } = themes[theme];
  const backdrop = worstBackdrop(theme);

  // Der Fokus-Ring liegt auf Karten und direkt auf dem Seitengrund.
  it.each([...surfaces(theme), { color: backdrop, name: "canvas" }])(
    "keeps the focus ring visible on $name",
    ({ color }) => {
      expect(contrastRatio(parseHex(focusRing), color)).toBeGreaterThanOrEqual(
        3,
      );
    },
  );

  it.each(surfaces(theme))(
    "keeps a control border visible on $name",
    ({ color }) => {
      expect(
        contrastRatio(composite(edgeStrong, color), color),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  const dataSurfaces = surfaces(theme).filter(
    ({ name }) => name === "glass" || name === "dense-panel",
  );

  it.each(
    dataSurfaces.flatMap(({ color, name }) =>
      data.map((value) => ({ color, surface: name, value })),
    ),
  )("keeps the data colour $value visible on $surface", ({ color, value }) => {
    expect(contrastRatio(parseHex(value), color)).toBeGreaterThanOrEqual(3);
  });
});

function rgba(red: number, green: number, blue: number, alpha: number): Rgba {
  return { alpha, blue, green, red };
}

function parseHex(color: string): Rgba {
  const value = Number.parseInt(color.slice(1), 16);
  return rgba((value >> 16) & 255, (value >> 8) & 255, value & 255, 1);
}

/** Quelle über Ziel, wie der Browser durchscheinende Schichten zeichnet. */
function composite(source: Rgba, target: Rgba): Rgba {
  const mix = (channel: keyof Omit<Rgba, "alpha">) =>
    source[channel] * source.alpha + target[channel] * (1 - source.alpha);

  return rgba(mix("red"), mix("green"), mix("blue"), 1);
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: Rgba): number {
  const [red, green, blue] = [color.red, color.green, color.blue].map(
    (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    },
  );

  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}
