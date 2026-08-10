import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { DomainErrorBoundary } from "../components/feedback/DomainErrorBoundary";
import { RouteErrorBoundary } from "../components/feedback/RouteErrorBoundary";
import { RouteLoadingState } from "../components/feedback/RouteLoadingState";
import { AppLayout } from "./layouts/AppLayout";
import { AreaLayout } from "./layouts/AreaLayout";

/**
 * Pfade aus der Zeit vor den vier Bereichen.
 *
 * Sie bleiben erreichbar, weil sie in Lesezeichen, im Verlauf und in
 * PWA-Verknüpfungen stehen. Eine Weiterleitung kostet nichts; ein toter Link
 * kostet Vertrauen in eine App, die sonst nie etwas verliert.
 */
export const legacyRouteRedirects: Record<string, string> = {
  "/aufgaben": "/planen/aufgaben",
  "/ziele": "/planen/ziele",
  "/gewohnheiten": "/routinen/uebersicht",
  "/journal": "/routinen/journal",
  "/finanzen": "/geld",
  "/insights": "/auswertung/ueberblick",
  "/wochenrueckblick": "/auswertung/wochenrueckblick",
};

const redirectRoutes: RouteObject[] = Object.entries(legacyRouteRedirects).map(
  ([from, to]) => ({
    // Die Weiterleitung ersetzt den Eintrag im Verlauf, statt ihn zu
    // verdoppeln: Ein „Zurück" landete sonst wieder auf dem alten Pfad.
    loader: () => redirect(to, { status: 301 }),
    path: from.slice(1),
  }),
);

const domainRoutes: RouteObject[] = [
  {
    index: true,
    lazy: () => import("../domains/today/pages/TodayPage"),
  },
  {
    Component: AreaLayout,
    children: [
      { index: true, loader: () => redirect("/planen/aufgaben") },
      {
        path: "aufgaben",
        lazy: () => import("../domains/tasks/pages/TasksPage"),
      },
      {
        path: "ziele",
        lazy: () => import("../domains/goals/pages/GoalsPage"),
      },
    ],
    path: "planen",
  },
  {
    Component: AreaLayout,
    children: [
      { index: true, loader: () => redirect("/routinen/uebersicht") },
      {
        path: "uebersicht",
        lazy: () => import("../domains/habits/pages/HabitsPage"),
      },
      {
        path: "journal",
        lazy: () => import("../domains/journal/pages/JournalPage"),
      },
    ],
    path: "routinen",
  },
  {
    path: "geld",
    lazy: () => import("../domains/finance/pages/FinancePage"),
  },
  {
    Component: AreaLayout,
    children: [
      { index: true, loader: () => redirect("/auswertung/ueberblick") },
      {
        path: "ueberblick",
        lazy: () => import("../domains/insights/pages/InsightsPage"),
      },
      {
        path: "wochenrueckblick",
        lazy: () => import("../domains/insights/pages/WeeklyReviewPage"),
      },
    ],
    path: "auswertung",
  },
  {
    path: "einstellungen",
    lazy: () => import("./pages/SettingsPage"),
  },
  {
    path: "komponenten",
    lazy: () => import("./pages/ComponentPreviewPage"),
  },
  ...redirectRoutes,
  {
    path: "*",
    lazy: () => import("./pages/NotFoundPage"),
  },
];

/**
 * Jede Domänenroute besitzt eine eigene Fehlergrenze. Ein Fehler ersetzt
 * dadurch nur den Inhaltsbereich; Navigation, Theme und alle übrigen Bereiche
 * bleiben bedienbar. Die Grenze am Layout selbst greift nur, wenn schon der
 * Rahmen nicht dargestellt werden kann.
 */
export const appRoutes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoadingState,
    children: domainRoutes.map((route) => ({
      ...route,
      ErrorBoundary: DomainErrorBoundary,
    })),
  },
];

export const appRouter = createBrowserRouter(appRoutes);
