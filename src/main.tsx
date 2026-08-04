import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { initializeTheme } from "./app/theme/theme-preference";
import "./styles.css";

initializeTheme();

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Der App-Container wurde nicht gefunden.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
