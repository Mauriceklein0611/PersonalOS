import type { DataRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { GlobalErrorBoundary } from "../components/feedback/GlobalErrorBoundary";
import type { DatabaseLifecycle } from "../db/lifecycle";
import { DatabaseGate } from "./providers/DatabaseGate";
import { PwaStatus } from "./pwa/PwaStatus";
import { appRouter } from "./router";
import { SettingsProvider } from "./settings/SettingsProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

type AppProps = {
  databaseLifecycle?: DatabaseLifecycle;
  reloadAfterDatabaseReset?: () => void;
  router?: DataRouter;
};

export function App({
  databaseLifecycle,
  reloadAfterDatabaseReset,
  router = appRouter,
}: AppProps) {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <PwaStatus />
        <DatabaseGate
          lifecycle={databaseLifecycle}
          reloadAfterReset={reloadAfterDatabaseReset}
        >
          {/* Erst hinter der Datenbankprüfung: Der Settings-Datensatz
              existiert dann bereits. */}
          <SettingsProvider>
            <RouterProvider router={router} />
          </SettingsProvider>
        </DatabaseGate>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
