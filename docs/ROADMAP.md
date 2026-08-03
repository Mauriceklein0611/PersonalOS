# Schritt-für-Schritt-Roadmap

## Arbeitsmodell

Die Roadmap ist in Releases mit klaren Exit-Kriterien gegliedert. Innerhalb eines Releases werden kleine vertikale Funktionen fertiggestellt, bevor die nächste Domain beginnt. GitHub-Meilensteine und Issues sind die operative Quelle; dieses Dokument beschreibt Reihenfolge und Entscheidungslogik.

Jede Implementierungsiteration folgt demselben Ablauf:

1. Issue und Akzeptanzkriterien präzisieren.
2. Betroffene Daten und Datenschutzrisiken prüfen.
3. Bei dauerhafter Architekturwirkung ADR ergänzen.
4. Kleinsten vollständigen Nutzerfluss implementieren.
5. Unit-/Komponenten- und bei Kernflüssen E2E-Tests ergänzen.
6. Offline-, Leer-, Lade- und Fehlerzustand prüfen.
7. Dokumentation aktualisieren und kleinen PR erstellen.

## Phase 0 – Repository-Basis

### Ziel

Menschen, Codex und Claude Code arbeiten mit identischen Regeln und reproduzierbaren Erwartungen.

### Schritte

1. Produkt-Scope, MVP und Nicht-Ziele dokumentieren.
2. Architektur, Datenkonventionen und Local-first-Entscheidung dokumentieren.
3. `AGENTS.md`, `CLAUDE.md`, PR- und Issue-Vorlagen anlegen.
4. Labels, Meilensteine und abhängige GitHub-Issues erstellen.
5. Branch-, Review- und Definition-of-Done-Regeln etablieren.

### Exit-Kriterien

- Dokumentation ist auf `main` verfügbar.
- Jedes geplante MVP-Arbeitspaket besitzt ein Issue, Milestone, Priorität und klare Akzeptanzkriterien.
- Keine widersprüchlichen Regeln zwischen Codex und Claude Code.

## `v0.1 – Foundation`

### Ziel

Eine installierbare, getestete App-Shell kann strukturierte Beispieldaten sicher lokal speichern, migrieren, exportieren und importieren.

### Reihenfolge

1. **Toolchain und CI:** Vite/React/TypeScript mit pnpm bootstrappen; Lint, Format, Unit-Tests, E2E-Smoke-Test und GitHub Actions einrichten.
2. **App-Shell:** Routing, Layout, Navigation, Theme, Error Boundary und leere Zustände umsetzen.
3. **Designsystem:** Tokens und zugängliche Basiskomponenten für Button, Input, Dialog, Card, Toast und Formfelder erstellen.
4. **Persistenz:** Dexie-Schema, Basistypen, Repository-Transaktionen und Testdatenbank implementieren.
5. **Migrationen:** Schema-Versionierung, Migrations-Runner und Rollback-/Fehlerstrategie testen.
6. **Backup:** versionierten JSON-Export, Zod-validierten Import, Vorschau, Konfliktstrategie und Wiederherstellung implementieren.
7. **Offline-PWA:** Manifest, Service Worker, Update-Hinweis und Offline-Smoke-Test ergänzen.
8. **Datenschutz-Basis:** CSP, Secret-/Daten-Checks und verständliche lokale Datenlöschung ergänzen.

### Exit-Kriterien

- App ist installierbar und startet online wie offline.
- CRUD-Beispieldaten überstehen Reload und Browserneustart.
- Export → Daten löschen → Import stellt denselben Zustand wieder her.
- CI führt Lint, Typecheck, Unit-Tests, Build und E2E-Smoke aus.
- Keine echte Nutzerdomain ist nötig, um das Fundament zu testen.

## `v0.2 – Daily Loop`

### Ziel

Die App ist täglich für Planung, Erledigung und Reflexion nutzbar.

### Reihenfolge

1. **Aufgabenmodell und CRUD:** Inbox, Titel, Status, Priorität, Fälligkeit, geschätzte Dauer und Notizen.
2. **Aufgabenansichten:** Heute, Inbox, Diese Woche und Erledigt mit schnellen Statusänderungen.
3. **Habit-Modell:** Frequenzregeln, aktive Zeiträume und Tages-Check-ins mit korrekter Zeitzonenbehandlung.
4. **Habit-Ansichten:** Heute, Woche, Streak und Erfüllungsquote ohne strafende Darstellung.
5. **Journal:** genau ein Eintrag pro lokalem Tag; Stimmung, Energie, Stress und optionale Texte.
6. **Heute-Dashboard:** fällige Elemente, wichtigstes Tagesergebnis, Quick Actions und Abendhinweis.
7. **Qualität:** Tastaturbedienung, mobile Tests, Undo für riskante Aktionen und E2E-Tagesablauf.

### Exit-Kriterien

- Ein kompletter Morgen-/Tag-/Abend-Ablauf funktioniert offline.
- Aufgaben, Habits und Journal bleiben nach Reload korrekt.
- Zeitzonen-, Tageswechsel- und DST-Fälle sind getestet.
- Dashboard kann bei leeren, teilweise gefüllten und alten Daten sinnvoll reagieren.

## `v0.3 – Goals & Finance`

### Ziel

Langfristiger Fortschritt und ein einfacher manueller Finanzüberblick ergänzen den täglichen Kern.

### Reihenfolge

1. **Ziele:** CRUD, Status, Deadline, Fortschrittsmodus und Meilensteine.
2. **Verknüpfungen:** Aufgaben und Habits optional mit einem Ziel verbinden; verwaiste Referenzen verhindern.
3. **Transaktionen:** Einnahme/Ausgabe, Betrag in Minor Units, Währung, Kategorie, Datum und Notiz.
4. **Budget:** Monatsbudget je Kategorie, Restbetrag und transparente Berechnung.
5. **Sparziele:** Zielbetrag, Beiträge, Deadline und Verlauf.
6. **Finanz-Dashboard:** Monatszusammenfassung, größte Kategorien und Vergleich zum Vormonat.
7. **Qualität:** Rundung, Zeitzonen, Monatsgrenzen, negative Werte, Import und Löschung testen.

### Exit-Kriterien

- Aufgaben/Habits zeigen Zielbezug konsistent.
- Finanzsummen sind mit ganzzahliger Arithmetik reproduzierbar.
- Ein vollständiger Export enthält alle neuen Daten und lässt sich verlustfrei importieren.
- Die App behauptet keine Bankgenauigkeit und gibt keine Finanzberatung.

## `v0.4 – Explainable Intelligence`

### Ziel

PersonalOS verdichtet vorhandene Daten zu nachvollziehbaren Teilwerten und vorsichtigen Beobachtungen.

### Reihenfolge

1. **Score-Spezifikation:** Bereiche, Normalisierung, Mindestdaten, Gewichte und Versionierung als ADR festlegen.
2. **Score Engine:** reine Funktionen mit Golden Tests implementieren.
3. **Score UI:** Gesamtwert, Teilwerte, Datenvollständigkeit und „Warum?“-Ansicht.
4. **Insight Contract:** Beobachtung, Evidenz, Zeitraum, Stärke, Aktion und Ausblendstatus modellieren.
5. **Regelbasierte Insights:** zunächst drei robuste Regeln für Habits, Budget und Tagesmuster.
6. **Wochenübersicht:** relevante Veränderungen und offene Ziele zusammenführen.
7. **Ethik-/Copy-Review:** keine Diagnose, Schuldzuweisung oder falsche Kausalität.

### Exit-Kriterien

- Jede angezeigte Zahl kann auf Eingabedaten und Formel zurückgeführt werden.
- Fehlende Daten erzeugen keine negative Bewertung.
- Änderung der Score-Version verändert keine historischen Quelldaten.
- Insights laufen deterministisch und schreibgeschützt.

## `v1.0 – MVP Hardening`

### Ziel

Der MVP ist für langfristige persönliche Nutzung verlässlich.

### Reihenfolge

1. End-to-End-Testmatrix für alle Kernflüsse abschließen.
2. Export-/Import-Kompatibilität und Migrationspfade mit mehreren Fixtures testen.
3. WCAG-orientiertes Accessibility-Audit und Tastaturprüfung durchführen.
4. Performancebudget für Start, Interaktionen und größere lokale Datenmengen prüfen.
5. Datenschutz- und Sicherheitsreview durchführen.
6. 14-tägigen Dogfood-Test mit täglichem Backup absolvieren.
7. Fehler priorisieren, P0/P1 schließen und Release-Checkliste abarbeiten.

### Exit-Kriterien

- Erfolgskriterien aus `docs/PRODUCT.md` sind belegt.
- Recovery-Test ist dokumentiert und erfolgreich.
- Keine offenen P0/P1-Bugs.
- Release ist getaggt und enthält verständliche Backup-/Upgrade-Hinweise.

## Nach `v1.0`

Neue Module werden einzeln als vertikale Erweiterung umgesetzt:

1. Nutzerproblem und benötigte Daten definieren.
2. Prüfen, ob vorhandene Grundtypen genügen.
3. Datenmodell/ADR ergänzen.
4. Erfassung, Ansicht, Auswertung und Export als ein vollständiges Paket liefern.
5. Erst danach das nächste Modul beginnen.

Empfohlene Reihenfolge: Lernen → Schlaf → Gesundheit → Zeittracking → Vermögen → Erinnerungen → Jahresrückblick → Dokumentmetadaten → Inventar. Synchronisation und KI bleiben separate Programme mit eigener Bedrohungs- und Datenschutzanalyse.

## Abhängigkeitsübersicht

```text
Toolchain + CI
       ↓
App-Shell + Designsystem
       ↓
Persistenz + Migrationen ──→ Backup/Import ──→ Offline-PWA
       ↓
Tasks ─────┐
Habits ────┼──→ Heute-Dashboard ──→ Ziele/Verknüpfungen
Journal ───┘                              ↓
                                      Finanzen/Sparen
                                             ↓
                             Life Score + regelbasierte Insights
                                             ↓
                                      v1.0 Hardening
```

