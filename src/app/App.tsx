import type { DataRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { GlobalErrorBoundary } from "../components/feedback/GlobalErrorBoundary";
import { appRouter } from "./router";
import { ThemeProvider } from "./theme/ThemeProvider";

type AppProps = {
  router?: DataRouter;
};

export function App({ router = appRouter }: AppProps) {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
