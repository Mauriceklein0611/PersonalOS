import { describe, expect, it } from "vitest";

/**
 * Glas hat keinen festen Hintergrund. Jede Prüfung rechnet deshalb die
 * tatsächliche Schichtung nach: Nebelfleck über Grundverlauf, darüber das
 * Glas-Alpha, darüber der Text. Geprüft wird immer der ungünstigste Fleck.
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
    canvasStops: ["#2a1030", "#3a1226", "#241030"],
    /** Nebelflecken; sie überlappen einander nicht. */
    blobs: [
      rgba(255, 178, 125, 0.5),
      rgba(255, 143, 179, 0.52),
      rgba(199, 139, 255, 0.44),
      rgba(255, 216, 138, 0.4),
    ],
    /** `brightness` aus `--blur-glass`; der Filter dimmt den Untergrund. */
    backdropBrightness: 0.6,
    glass: rgba(255, 255, 255, 0.09),
    glassStrong: rgba(255, 255, 255, 0.11),
    glassOpaque: "#3a2040",
    field: rgba(46, 24, 55, 0.92),
    text: "#f4f6ff",
    textMuted: rgba(226, 232, 255, 1),
    accents: ["#ffb27d", "#ff8fb3"],
    accentContrast: "#33130a",
    danger: "#ffe8e3",
    dangerSurface: "#ff8f7a",
    dangerContrast: "#24100d",
    focusRing: "#bae6fd",
    edgeStrong: rgba(255, 255, 255, 0.6),
    data: ["#ffd88a", "#ffb27d", "#ff9dbd", "#d5a6ff", "#ff9d9d", "#f0e08a"],
    densePanel: "#140d19",
    denseRow: rgba(255, 255, 255, 0.05),
    denseRowActive: rgba(255, 255, 255, 0.11),
  },
  light: {
    canvasStops: ["#e8ecfb", "#f2e9f8", "#e4f2f0"],
    blobs: [
      rgba(90, 210, 255, 0.45),
      rgba(178, 150, 255, 0.45),
      rgba(120, 245, 200, 0.42),
      rgba(255, 150, 205, 0.4),
    ],
    /** Hier hebt der Filter den Untergrund an, statt ihn zu dimmen. */
    backdropBrightness: 1.06,
    glass: rgba(255, 255, 255, 0.52),
    glassStrong: rgba(255, 255, 255, 0.72),
    glassOpaque: "#f4f7ff",
    field: rgba(255, 255, 255, 0.92),
    text: "#1b2436",
    textMuted: rgba(27, 36, 54, 0.7),
    accents: ["#0a7a55", "#0369a1"],
    accentContrast: "#ffffff",
    danger: "#8f3025",
    dangerSurface: "#8f3025",
    dangerContrast: "#ffffff",
    focusRing: "#0369a1",
    edgeStrong: rgba(27, 36, 54, 0.52),
    data: ["#0a7a55", "#0369a1", "#7c3aed", "#b45309", "#0d9488", "#be185d"],
    densePanel: "#f7f8fc",
    denseRow: rgba(27, 36, 54, 0.04),
    denseRowActive: rgba(27, 36, 54, 0.08),
  },
} as const;

type ThemeName = keyof typeof themes;
const themeNames = Object.keys(themes) as ThemeName[];

/**
 * Für helle Schrift auf dunklem Glas ist der hellste Untergrund der schlimmste
 * Fall, für dunkle Schrift auf hellem Glas der dunkelste.
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
 * Alle Flächen, auf denen in dieser Ansicht Text oder Grafik landen kann,
 * in derselben Reihenfolge geschichtet wie im Browser: Der Filter dimmt oder
 * hebt den Nebel unter der Karte, darüber liegt der weiße Schleier.
 *
 * `--glass-strong` erscheint ausschließlich innerhalb einer Karte und liegt
 * deshalb auf der bereits gefilterten Glasfläche, nicht auf dem rohen Nebel.
 *
 * Das dichte Panel ist deckend. Es steht deshalb ohne Nebelanteil in der
 * Liste, und genau das macht seinen Kontrast unabhängig von Blur, fehlender
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
  } = themes[theme];
  const filtered = scale(backdrop, backdropBrightness);
  const glassSurface = composite(glass, filtered);
  const densePanelSurface = parseHex(densePanel);

  return [
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
