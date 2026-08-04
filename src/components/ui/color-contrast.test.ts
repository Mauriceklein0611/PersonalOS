import { describe, expect, it } from "vitest";

const textPairs = [
  ["#1c241f", "#ffffff"],
  ["#5b675f", "#ffffff"],
  ["#ffffff", "#285c3a"],
  ["#ffffff", "#1f492e"],
  ["#8f3025", "#ffffff"],
  ["#ffffff", "#70241c"],
  ["#e7eee9", "#18211b"],
  ["#aab8ae", "#18211b"],
  ["#102016", "#8bc89c"],
  ["#102016", "#a4d8b1"],
  ["#ffb1a5", "#18211b"],
  ["#24100d", "#ffb1a5"],
  ["#24100d", "#ffd0c8"],
] as const;

const focusPairs = [
  ["#176b87", "#ffffff"],
  ["#75d5f2", "#18211b"],
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
