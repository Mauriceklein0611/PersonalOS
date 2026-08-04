import { describe, expect, it } from "vitest";

const textPairs = [
  ["#16202e", "#ffffff"],
  ["#4d5a6c", "#ffffff"],
  ["#ffffff", "#285c3a"],
  ["#ffffff", "#1f492e"],
  ["#8f3025", "#ffffff"],
  ["#ffffff", "#70241c"],
  ["#285c3a", "#dcebe0"],
  ["#e7eef7", "#131a24"],
  ["#9fb0c3", "#131a24"],
  ["#06210f", "#8bc89c"],
  ["#06210f", "#a4d8b1"],
  ["#8bc89c", "#14301f"],
  ["#ffb1a5", "#131a24"],
  ["#ffb1a5", "#3d211d"],
  ["#24100d", "#ffb1a5"],
  ["#24100d", "#ffd0c8"],
] as const;

const focusPairs = [
  ["#176b87", "#ffffff"],
  ["#176b87", "#e8ecf2"],
  ["#75d5f2", "#131a24"],
  ["#75d5f2", "#0b0f16"],
] as const;

/** Rahmen tragen UI-Grenzen und erreichen deshalb mindestens 3:1. */
const borderPairs = [
  ["#6e7c90", "#ffffff"],
  ["#6e7c90", "#e8ecf2"],
  ["#63728c", "#131a24"],
  ["#63728c", "#0b0f16"],
] as const;

/** Text, gedämpfter Text und Fehlertext auf allen Dashboard-Flächen. */
const dashboardTextPairs = [
  ["#16202e", "#ffffff"],
  ["#4d5a6c", "#ffffff"],
  ["#8f3025", "#ffffff"],
  ["#16202e", "#f3f6fa"],
  ["#4d5a6c", "#f3f6fa"],
  ["#16202e", "#e8ecf2"],
  ["#4d5a6c", "#e8ecf2"],
  ["#16202e", "#d8f0e0"],
  ["#16202e", "#d7ecfb"],
  ["#e7eef7", "#131a24"],
  ["#9fb0c3", "#131a24"],
  ["#ffb1a5", "#131a24"],
  ["#e7eef7", "#1c2531"],
  ["#9fb0c3", "#1c2531"],
  ["#e7eef7", "#0b0f16"],
  ["#9fb0c3", "#0b0f16"],
  ["#e7eef7", "#16283c"],
  ["#e7eef7", "#241d3f"],
] as const;

/**
 * Die Datenpalette trägt keine Aussage allein, erreicht als grafisches
 * Element auf der Kartenfläche aber mindestens 3:1.
 */
const dataPalettePairs = [
  ["#1f7a3d", "#ffffff"],
  ["#0f6fbd", "#ffffff"],
  ["#6d3fd4", "#ffffff"],
  ["#8a5a12", "#ffffff"],
  ["#0d6d6a", "#ffffff"],
  ["#c02566", "#ffffff"],
  ["#1f7a3d", "#e8ecf2"],
  ["#0f6fbd", "#e8ecf2"],
  ["#6d3fd4", "#e8ecf2"],
  ["#8a5a12", "#e8ecf2"],
  ["#0d6d6a", "#e8ecf2"],
  ["#c02566", "#e8ecf2"],
  ["#4ade80", "#131a24"],
  ["#38bdf8", "#131a24"],
  ["#a78bfa", "#131a24"],
  ["#fbbf24", "#131a24"],
  ["#2dd4bf", "#131a24"],
  ["#f472b6", "#131a24"],
  ["#4ade80", "#0b0f16"],
  ["#38bdf8", "#0b0f16"],
  ["#a78bfa", "#0b0f16"],
  ["#fbbf24", "#0b0f16"],
  ["#2dd4bf", "#0b0f16"],
  ["#f472b6", "#0b0f16"],
] as const;

/** Zeichen in Tracker-Zellen stehen auf den weichen Flächen der Palette. */
const trackerCellPairs = [
  ["#16202e", "#d8f0e0"],
  ["#16202e", "#d7ecfb"],
  ["#16202e", "#e6dcfb"],
  ["#16202e", "#f8e7c8"],
  ["#16202e", "#d3eeed"],
  ["#16202e", "#fbdde9"],
  ["#e7eef7", "#10291a"],
  ["#e7eef7", "#0d2536"],
  ["#e7eef7", "#221a3d"],
  ["#e7eef7", "#33240a"],
  ["#e7eef7", "#0c2b2a"],
  ["#e7eef7", "#331327"],
] as const;

/** Die farbige Zellkante trennt die weiche Fläche sichtbar vom Umfeld. */
const trackerBorderPairs = [
  ["#4ade80", "#10291a"],
  ["#38bdf8", "#0d2536"],
  ["#a78bfa", "#221a3d"],
  ["#fbbf24", "#33240a"],
  ["#2dd4bf", "#0c2b2a"],
  ["#f472b6", "#331327"],
] as const;

describe("semantic color tokens", () => {
  it.each(textPairs)("keeps %s on %s above 4.5:1", (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(focusPairs)(
    "keeps focus %s on %s above 3:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(borderPairs)(
    "keeps border %s on %s above 3:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("dashboard visualisation tokens", () => {
  it.each(dashboardTextPairs)(
    "keeps dashboard text %s on %s above 4.5:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(dataPalettePairs)(
    "keeps data colour %s on %s above 3:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(trackerCellPairs)(
    "keeps tracker sign %s on %s above 4.5:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(trackerBorderPairs)(
    "keeps tracker border %s on %s above 3:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );
});

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string): number {
  const value = Number.parseInt(color.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
    (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    },
  );

  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
