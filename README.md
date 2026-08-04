# PersonalOS

PersonalOS ist eine private, local-first Progressive Web App für den eigenen Alltag. Sie bündelt Aufgaben, Gewohnheiten, Journal, Ziele und Finanzen in einem schnellen Tagesablauf und macht Zusammenhänge nachvollziehbar – ohne Konto und ohne verpflichtende Cloud.

> Status: `v0.1 – Foundation`. Die reproduzierbare Toolchain und CI bilden das Fundament für die nächsten Issues.

## Produktversprechen

PersonalOS beantwortet drei Fragen:

1. Was ist heute wichtig?
2. Wie entwickle ich mich?
3. Welche konkrete Änderung hilft mir als Nächstes?

Die App bleibt offline nutzbar, speichert Daten standardmäßig nur lokal und bietet einen überprüfbaren Export/Import. Personenbezogene Echtdaten, Exporte, Belege und lokale Datenbanken gehören niemals ins Git-Repository.

## Geplanter Stack

- TypeScript, React und Vite als installierbare Web-App (PWA)
- IndexedDB mit Dexie als lokale Datenbank
- Zod an allen Import-, Persistenz- und Einstellungsgrenzen
- Zustand für flüchtigen UI-Zustand; Domainlogik bleibt in Services und reinen Funktionen
- Tailwind CSS und zugängliche Headless-Komponenten für das Designsystem
- Vitest, Testing Library und Playwright für Unit-, Komponenten- und End-to-End-Tests
- pnpm als Paketmanager

Node.js 24 LTS und pnpm 11.20.0 sind die aktuell unterstützte Toolchain. Abhängigkeiten werden über `package.json` und `pnpm-lock.yaml` reproduzierbar gehalten.

## Dokumentation

- [GitHub-Backlog und Meilensteine](https://github.com/Mauriceklein0611/PersonalOS/issues)
- [Produkt und Scope](docs/PRODUCT.md)
- [Schritt-für-Schritt-Roadmap](docs/ROADMAP.md)
- [Architektur](docs/ARCHITECTURE.md)
- [Datenmodell](docs/DATA_MODEL.md)
- [Entwicklungsablauf](docs/DEVELOPMENT.md)
- [Local-first-Entscheidung](docs/decisions/0001-local-first-pwa.md)

## Mit Codex und Claude Code arbeiten

- Codex liest die Arbeitsregeln in [AGENTS.md](AGENTS.md).
- Claude Code startet über [CLAUDE.md](CLAUDE.md) und verwendet dieselben Regeln.
- Vor jeder Umsetzung wird genau ein GitHub-Issue gewählt.
- Kleine, überprüfbare Pull Requests sind der Standard; Scope-Änderungen werden zuerst im Issue festgehalten.
- Entscheidungen mit langfristiger Wirkung werden als ADR unter `docs/decisions/` dokumentiert.

## Entwicklungsstart

Vorausgesetzt werden Node.js 24 LTS und Corepack. Für den ersten browserbasierten Test wird Chromium einmalig über Playwright installiert:

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Die vollständigen Qualitätsprüfungen sind:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Datenschutz

Dieses Repository enthält Quellcode und synthetische Testdaten. Keine echten Journaltexte, Finanzwerte, Gesundheitsdaten, Dokumente, Seriennummern, Fotos, Backups oder `.env`-Dateien committen. Für lokale Beispiele ausschließlich offensichtlich fiktive Daten verwenden.
