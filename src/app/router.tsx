import { createBrowserRouter, type RouteObject } from "react-router";

import { DomainErrorBoundary } from "../components/feedback/DomainErrorBoundary";
import { RouteErrorBoundary } from "../components/feedback/RouteErrorBoundary";
import { RouteLoadingState } from "../components/feedback/RouteLoadingState";
import { AppLayout } from "./layouts/AppLayout";

const domainRoutes: RouteObject[] = [
  {
    index: true,
    lazy: () => import("../domains/today/pages/TodayPage"),
  },
  {
    path: "aufgaben",
    lazy: () => import("../domains/tasks/pages/TasksPage"),
  },
  {
    path: "gewohnheiten",
    lazy: () => import("../domains/habits/pages/HabitsPage"),
  },
  {
    path: "journal",
    lazy: () => import("../domains/journal/pages/JournalPage"),
  },
  {
    path: "ziele",
    lazy: () => import("../domains/goals/pages/GoalsPage"),
  },
  {
    path: "finanzen",
    lazy: () => import("../domains/finance/pages/FinancePage"),
  },
  {
    path: "insights",
    lazy: () => import("../domains/insights/pages/InsightsPage"),
  },
  {
    path: "einstellungen",
    lazy: () => import("./pages/SettingsPage"),
  },
  {
    path: "komponenten",
    lazy: () => import("./pages/ComponentPreviewPage"),
  },
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
