# Entwicklungsablauf

## Voraussetzungen

Nach dem Bootstrap-Issue werden benötigt:

- eine aktuelle Node.js-LTS-Version;
- Corepack und die im Repository festgelegte pnpm-Version;
- Git;
- ein aktueller Chromium-, Firefox- oder WebKit-basierter Browser;
- optional GitHub CLI für Issue- und PR-Arbeit.

Die tatsächlich unterstützten Versionen stehen anschließend in `package.json`, Lockfile und CI. Keine global installierte Abhängigkeitsversion als implizite Voraussetzung verwenden.

## Lokales Setup nach dem Bootstrap

```bash
corepack enable
pnpm install
pnpm dev
```

Geplante Qualitätsbefehle:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Bis das Bootstrap-Issue umgesetzt ist, existieren diese Befehle absichtlich noch nicht.

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
2. begründete Dexie-Versionsänderung;
3. Migration von der vorherigen unterstützten Version;
4. Tests mit einer alten Fixture;
5. Import-/Export-Prüfung;
6. PR-Hinweis zu Datenrisiko und Recovery.

## Abhängigkeiten

Vor einer neuen Laufzeitabhängigkeit prüfen:

- Löst sie ein konkretes Issue-Kriterium?
- Funktioniert sie vollständig offline?
- Wie groß ist ihr Bundle-Anteil?
- Ist sie aktiv gewartet und passend lizenziert?
- Verarbeitet oder überträgt sie Nutzerdaten?
- Ist eine kleine interne Lösung verständlicher und sicherer?

Die Begründung gehört in den PR. Lockfile und Paketmanager-Metadaten werden immer gemeinsam committed.

## Release-Checkliste

- CI auf dem Release-Commit ist grün.
- Datenbankmigrationen und Exportfixtures sind getestet.
- Installierte PWA startet offline.
- Recovery-Test wurde auf einem frischen Browserprofil durchgeführt.
- Changelog nennt Datenformat- oder Migrationsänderungen.
- Keine P0/P1-Bugs offen.
- Tag und Version stimmen überein.
- Ein aktueller Export wurde vor dem Upgrade empfohlen.

