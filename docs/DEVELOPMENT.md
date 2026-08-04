# Entwicklungsablauf

## Voraussetzungen

Benötigt werden:

- Node.js 24 LTS (`>=24 <25`);
- Corepack und pnpm 11.20.0 aus dem `packageManager`-Eintrag;
- Git;
- Chromium für den browserbasierten Smoke-Test;
- optional GitHub CLI für Issue- und PR-Arbeit.

Die unterstützten Versionen stehen in `.nvmrc`, `package.json`, Lockfile und CI. Keine global installierte Abhängigkeitsversion als implizite Voraussetzung verwenden.

## Lokales Setup

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Qualitätsbefehle:

```bash
pnpm format:check
pnpm check:privacy
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm check:privacy` prüft getrackte und noch nicht ignorierte Dateien auf typische Provider-Secrets, private Schlüssel, vollständige PersonalOS-Exporte, rohe Konsolenausgaben in App-Code und ungeprüftes HTML-Rendering. Treffer nennen nur Datei und Regel, niemals den gefundenen Wert. `pnpm test` führt Unit- und Komponententests mit Vitest und Testing Library aus. `pnpm test:e2e` erstellt immer einen Produktions-Build, startet `vite preview` und prüft den Kern-Smoke-Test in Chromium. Nur so sind Manifest, CSP, Service Worker, Precache und der echte Offline-Start aktiv. Die GitHub-Action führt Privacy-Check, Formatprüfung, Lint, Typecheck, Tests, Build und E2E-Smoke auf Pull Requests sowie auf `main` aus.

Der PWA-Smoke lädt die App zunächst online, wartet auf den aktiven Service Worker und schaltet den Browser danach vollständig offline. Er prüft den erneuten Start, eine lokale Exportaktion und die Cache-Grenze. Ein Test darf deshalb keinen bereits laufenden Entwicklungsserver auf Port 4173 wiederverwenden.

Persistenztests erhalten mit `createTestDatabase()` jeweils einen zufälligen Datenbanknamen und räumen ihn nach dem Test vollständig auf. `fake-indexeddb` stellt dafür ausschließlich in Vitest die IndexedDB-Web-API bereit. Fixtures bleiben klein, deterministisch und synthetisch.

Backup-Tests verwenden ausschließlich die synthetische Fixture unter `src/test/fixtures/backup.ts`. Exportdateien werden weder committed noch als CI-Artefakt gespeichert. Ein Formatwechsel benötigt eine neue Exportformat-Version und Roundtrip-Tests; die interne Dexie-Version wird dadurch nicht automatisch erhöht.

## Von einem Issue zum Pull Request

1. Ein `status:ready`-Issue wählen und Abhängigkeiten prüfen.
2. Branch aus aktuellem `main` erstellen:

   ```bash
   git switch main
   git pull --ff-only
   git switch -c feat/123-short-description
   ```

3. Akzeptanzkriterien in einen kleinen Implementierungsplan übersetzen.
4. Tests möglichst zusammen mit der fachlichen Änderung schreiben.
5. Relevante Checks und `git diff --check` ausführen.
6. Keine persönlichen Testdaten, Exporte, Screenshots oder `.env`-Dateien committen.
7. PR-Vorlage ausfüllen, `Closes #123` hinzufügen und als Draft öffnen.
8. Nach erfolgreicher Prüfung und CI per Squash mergen.

## Zusammenarbeit mit Codex

Beispielauftrag:

```text
Bearbeite Issue #123. Lies zuerst AGENTS.md sowie die verlinkten Produkt- und
Architekturdokumente. Prüfe Abhängigkeiten und den aktuellen Arbeitsbaum.
Implementiere nur die Akzeptanzkriterien, ergänze Tests und aktualisiere die
Dokumentation. Erstelle keinen neuen Scope ohne Rückfrage im Issue.
```

Codex verwendet `AGENTS.md` automatisch als Repository-Leitlinie. Bei Aufgaben in einem Unterordner gilt zusätzlich jede dort später angelegte, spezifischere `AGENTS.md`.

## Zusammenarbeit mit Claude Code

Beispielauftrag:

```text
Bearbeite Issue #123. Befolge CLAUDE.md und AGENTS.md. Lies die verlinkten
Dokumente, nenne vorab den Scope und bewahre bestehende Änderungen. Implementiere
die Akzeptanzkriterien mit Tests und berichte alle tatsächlich ausgeführten Checks.
```

`CLAUDE.md` verweist bewusst auf dieselbe zentrale Regeldatei. Produkt- und Architekturwissen soll nicht in zwei Agenten-Dateien dupliziert und später widersprüchlich werden.

## Paralleles Arbeiten

- Pro Agent ein eigener Branch oder Git-Worktree.
- Keine zwei Agents bearbeiten gleichzeitig dieselben Dateien oder dasselbe Issue.
- Abhängige Issues werden nicht parallel begonnen, bevor der Vertrag des Vorgängers gemergt ist.
- Gemeinsame Typen und Datenbankschemaänderungen werden zuerst in einem kleinen Basis-PR abgeschlossen.
- Jeder Agent prüft vor Commit erneut `git status` und `git diff`.

Empfohlene Aufteilung:

- Agent A: Foundation/Toolchain;
- Agent B: Designsystem, nachdem die App-Shell steht;
- Agent C: Domainfunktion auf Basis des gemergten Datenvertrags;
- Agent D: unabhängige Tests/Dokumentation, sofern keine gleichen Dateien betroffen sind.

## Branch- und Commit-Konvention

Branches:

- `feat/<issue>-<slug>`
- `fix/<issue>-<slug>`
- `chore/<issue>-<slug>`
- `docs/<issue>-<slug>`

Commits sind kurz, imperativ und englisch, zum Beispiel:

- `add task repository contract`
- `validate backup format`
- `test habit schedule across DST`

## Testdaten

- Nur synthetische Personen, Texte und Zahlen verwenden.
- Fixtures müssen klein, deterministisch und ohne Bezug zu echten Konten sein.
- Finanzfixtures verwenden offensichtliche Beispielwerte und keine echten IBANs.
- Journalfixtures enthalten neutrale Dummytexte.
- Screenshots vor dem Commit visuell auf persönliche Browserdaten prüfen.

## Schemaänderungen

Eine persistente Schemaänderung benötigt:

1. Aktualisierung von `docs/DATA_MODEL.md`;
2. eine neue ganzzahlige Dexie-Version in `src/db/migrations/index.ts`;
3. genau eine Migrationsdatei `v<version>-<slug>.ts`;
4. eine validierte Migration von der vorherigen unterstützten Version;
5. Tests mit einer unveränderten alten Fixture sowie ein simulierter Fehler;
6. Prüfung, dass ein erneutes Öffnen die Migration nicht wiederholt;
7. Import-/Export-Prüfung;
8. PR-Hinweis zu Datenrisiko und Recovery.

Migrationen laufen ausschließlich vorwärts innerhalb der Dexie-Upgrade-Transaktion. Fehler nicht innerhalb der Migration abfangen und als Erfolg behandeln: Ein inkompatibler Record muss das Upgrade abbrechen, damit die vorherige Datenbankversion erhalten bleibt und die App den Recovery-Zustand anzeigt.

## Abhängigkeiten

Vor einer neuen Laufzeitabhängigkeit prüfen:

- Löst sie ein konkretes Issue-Kriterium?
- Funktioniert sie vollständig offline?
- Wie groß ist ihr Bundle-Anteil?
- Ist sie aktiv gewartet und passend lizenziert?
- Verarbeitet oder überträgt sie Nutzerdaten?
- Ist eine kleine interne Lösung verständlicher und sicherer?

Die Begründung gehört in den PR. Lockfile und Paketmanager-Metadaten werden immer gemeinsam committed.

### Aktuelle Abhängigkeiten

- React, React DOM und React Router bilden UI sowie clientseitiges Lazy-Routing.
- Dexie (Apache-2.0) kapselt die browserseitige IndexedDB-API; Zod (MIT) validiert IDs, Datums-/Geldwerte und persistierte Records an den Repository-Grenzen. Beide arbeiten vollständig lokal und übertragen keine Daten. Weil die App die Datenbank vor dem Router öffnet, umfasst der aktuelle Startup-Build inklusive App-Code und Persistenzschicht rund 145 kB gzip.
- Vite und das React-Plugin übernehmen Entwicklung und Build; TypeScript erzwingt den strikten Typvertrag.
- `vite-plugin-pwa` und sein MIT-lizenziertes Workbox-Buildwerkzeug erzeugen ausschließlich beim Produktions-Build Manifest und Service Worker. Es gibt keine Laufzeit-Telemetrie und kein Cache-Routing für Nutzerdaten. Die statischen Icons unter `public/` werden bewusst ohne den optionalen, nativen Asset-Generator gepflegt.
- ESLint, typescript-eslint und die React-Regeln prüfen Codefehler; Prettier stellt ein konsistentes Format sicher.
- Vitest, Testing Library und jsdom decken Unit- und Komponententests ab; `fake-indexeddb` (Apache-2.0) isoliert die Datenbanktests; Playwright stellt den echten Browser-Smoke-Test bereit.
- Alle übrigen Werkzeuge sind reine Entwicklungsabhängigkeiten und erhöhen das ausgelieferte Browser-Bundle nicht. Die Toolchain überträgt zur Laufzeit keine Nutzerdaten und fügt keine Telemetrie hinzu.

## Release-Checkliste

- CI auf dem Release-Commit ist grün.
- Datenbankmigrationen und Exportfixtures sind getestet.
- Installierte PWA startet offline.
- Recovery-Test wurde auf einem frischen Browserprofil durchgeführt.
- Changelog nennt Datenformat- oder Migrationsänderungen.
- Keine P0/P1-Bugs offen.
- Tag und Version stimmen überein.
- Ein aktueller Export wurde vor dem Upgrade empfohlen.
