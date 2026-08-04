import type { DataRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { GlobalErrorBoundary } from "../components/feedback/GlobalErrorBoundary";
import type { DatabaseLifecycle } from "../db/lifecycle";
import { DatabaseGate } from "./providers/DatabaseGate";
import { PwaStatus } from "./pwa/PwaStatus";
import { appRouter } from "./router";
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
          <RouterProvider router={router} />
        </DatabaseGate>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
