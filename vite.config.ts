/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    /*
     * Terser statt esbuild: Der Diagramm-Chunk muss unter dem in ADR 0008
     * festgelegten Budget von 180 KB gzip bleiben, und esbuild kommt hier
     * knapp darüber heraus.
     */
    minify: "terser",
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "PersonalOS – Privater Alltagsbegleiter",
        short_name: "PersonalOS",
        description:
          "Deine private, lokale Übersicht für Aufgaben, Gewohnheiten und Alltag.",
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#e8ecf2",
        theme_color: "#285c3a",
        categories: ["productivity", "lifestyle"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{css,html,ico,js,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
