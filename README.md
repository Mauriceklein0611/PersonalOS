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
- Semantische CSS-Tokens und zugängliche, typisierte Basiskomponenten für das Designsystem
- Vitest, Testing Library und Playwright für Unit-, Komponenten- und End-to-End-Tests
- pnpm als Paketmanager

Node.js 24 LTS und pnpm 11.20.0 sind die aktuell unterstützte Toolchain. Abhängigkeiten werden über `package.json` und `pnpm-lock.yaml` reproduzierbar gehalten.

## Dokumentation

- [GitHub-Backlog und Meilensteine](https://github.com/Mauriceklein0611/PersonalOS/issues)
- [Produkt und Scope](docs/PRODUCT.md)
- [Schritt-für-Schritt-Roadmap](docs/ROADMAP.md)
- [Architektur](docs/ARCHITECTURE.md)
- [Datenmodell](docs/DATA_MODEL.md)
- [UI- und Textleitlinien](docs/UI_GUIDELINES.md)
- [Entwicklungsablauf](docs/DEVELOPMENT.md)
- [Datenschutz- und Sicherheitsbasis](docs/PRIVACY_AND_SECURITY.md)
- [Leistungsbudgets](docs/PERFORMANCE.md)
- [Dogfood-Protokoll](docs/DOGFOOD.md)
- [Bekannte Einschränkungen](docs/KNOWN_LIMITATIONS.md)
- [Local-first-Entscheidung](docs/decisions/0001-local-first-pwa.md)
- [Theme-Bootstrap-Spiegel](docs/decisions/0002-theme-bootstrap-mirror.md)
- [Datenbankmigrationen und Recovery](docs/decisions/0003-forward-database-migrations-and-recovery.md)
- [Domänenspezifische Aufgabenkategorien](docs/decisions/0004-domain-specific-task-categories.md)
- [Habits ohne Schedule-Historie](docs/decisions/0005-habit-schedule-without-history.md)
- [Journal speichert ausdrücklich](docs/decisions/0006-journal-saves-explicitly.md)
- [Einheitliche Dashboard-Flächen](docs/decisions/0007-unified-dashboard-surfaces.md)
- [Apache ECharts für Diagramme](docs/decisions/0008-echarts-for-charts.md)
- [Erklärbarer Life Score v1](docs/decisions/0009-life-score-v1.md)
- [Deterministische Insights v1](docs/decisions/0010-deterministic-insights-v1.md)
- [Sparbeitrag verweist auf seine Ausgabe](docs/decisions/0011-savings-contribution-links-a-transaction.md)
- [Überspringen bricht die Serie nicht](docs/decisions/0012-skip-keeps-the-streak.md)
- [Ersteinrichtungsfortschritt wird abgeleitet](docs/decisions/0016-first-run-progress-is-derived.md)

### Externe Prüfungen

Datierte Momentaufnahmen, keine normativen Spezifikationen. Bei Widerspruch gelten zuerst `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` und die ADRs.

- [Produkt-, UX/UI- und Wettbewerbs-Audit (07.08.2026)](docs/audits/personal-os-product-ux-audit.md)
- [Umsetzungs-Roadmap zum Audit (07.08.2026)](docs/audits/personal-os-improvement-roadmap.md)
- [Accessibility-Audit MVP (11.08.2026)](docs/audits/accessibility-audit.md)
- [Datenschutz- und Sicherheitsreview MVP (11.08.2026)](docs/audits/privacy-security-review.md)

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
pnpm check:privacy
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Datenschutz

Dieses Repository enthält Quellcode und synthetische Testdaten. Keine echten Journaltexte, Finanzwerte, Gesundheitsdaten, Dokumente, Seriennummern, Fotos, Backups oder `.env`-Dateien committen. Für lokale Beispiele ausschließlich offensichtlich fiktive Daten verwenden.
