import { getAppTitle } from "../lib/get-app-title";

export function App() {
  return (
    <main className="app-shell">
      <section aria-labelledby="app-title" className="welcome-card">
        <p className="eyebrow">Local-first. Privat. Nachvollziehbar.</p>
        <h1 id="app-title">{getAppTitle()}</h1>
        <p>
          Das technische Fundament steht. Die persönlichen Alltagsfunktionen
          folgen Schritt für Schritt.
        </p>
      </section>
    </main>
  );
}
