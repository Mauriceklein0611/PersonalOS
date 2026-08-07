# PersonalOS – Produkt-, UX/UI- und Wettbewerbs-Audit

**Prüfstand:** `main`, flacher Klon vom 07.08.2026
**Prüfumfang:** vollständiger Quellcode, Dokumentation, Build, Unit-/Komponententests, zwei eigens geschriebene Verifikationstests
**Verfasser:** Claude (Opus 4.6), beauftragt über Chat

> Diese Datei ist eine **datierte Momentaufnahme einer externen Prüfung**, keine normative Spezifikation. Verbindlich bleiben `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` und die ADRs.

---

## 0. Methodik und Grenzen dieses Audits

Vorab, weil davon abhängt, welchen Aussagen dieses Dokuments zu trauen ist.

### 0.1 Was tatsächlich ausgeführt wurde

| Schritt | Ergebnis |
| --- | --- |
| `pnpm install` | erfolgreich (Node 22 statt geforderter 24; Engine-Warnung, sonst folgenlos) |
| `pnpm typecheck` | fehlerfrei |
| `pnpm build` | erfolgreich, 13,3 s |
| `pnpm test` (Vitest) | **520 Tests in 76 Dateien, alle grün**, 114 s |
| Eigene Verifikationstests | 2 geschrieben, ausgeführt, danach wieder entfernt (siehe C-01, C-02) |
| Statische Analyse | vollständiger Durchgang durch `src/`, `docs/`, `e2e/`, `scripts/`, Konfiguration |

### 0.2 Was **nicht** möglich war – bitte beim Lesen mitdenken

Der Chromium-Download über Playwright wurde von der Netzwerk-Allowlist der Ausführungsumgebung blockiert (`Download failure, code=1`). Daraus folgt:

- **Die Anwendung wurde nie in einem Browser bedient.** Kein Klick, kein Screenshot, keine Messung im gerenderten DOM.
- **Die 14 Playwright-E2E-Suiten wurden nicht ausgeführt.** Sie existieren und decken laut Dateinamen die richtigen Flüsse ab (`daily-loop`, `finance`, `recovery`, `backup`, `privacy`, `pwa`, …), ihr tatsächlicher Status ist hier unbekannt.
- **Kontrastwerte sind nicht gemessen.** `color-contrast.test.ts` existiert und lief grün; das ist ein Indiz, kein Nachweis für die zusammengesetzten Glas-/Nebel-Flächen.
- **Wahrgenommene Geschwindigkeit, Scrollverhalten, Animationen, Touch-Bedienung und Dark-Mode-Optik sind nicht beurteilt.**

Alle UI-Aussagen dieses Dokuments sind daher aus Quellcode, CSS und Markup **abgeleitet**, nicht aus Benutzung beobachtet. Wo eine Aussage nur durch Bedienung zu bestätigen wäre, steht das ausdrücklich dabei.

### 0.3 Trennung von Beobachtung, Deutung und Empfehlung

Im UX/UI-Teil (Abschnitt C) ist jeder Befund dreigeteilt: **Beobachtung** (was im Code steht, überprüfbar), **Nutzerproblem** (meine Deutung), **Empfehlung** (mein Vorschlag). Annahmen sind mit *Annahme:* gekennzeichnet.

### 0.4 Umgang mit Wettbewerbsaussagen

Jede Aussage über ein fremdes Produkt hat Quelle und Abrufdatum (Abschnitt D). Primärquellen (Hersteller-Hilfebereiche, Produktseiten, offizielle Repositories) haben Vorrang. Ein Muster wird nur dann „Marktstandard" genannt, wenn es bei **mindestens zwei unabhängigen Anbietern** belegt ist (Abschnitt E). Nicht geprüft und deshalb hier **nicht** als Grundlage verwendet: Akiflow, Amazing Marvin, Fabulous, Way of Life, Productive, Streaks, Finanzguru, Finanzblick, Money Manager, Wallet, Spendee. Ihr Fehlen ist eine Lücke dieses Audits, keine Aussage über ihre Qualität.

---

## A. Executive Summary

### A.1 Reifegrad

**Technisch: v0.9-artig. Produktseitig: v0.4-artig.**

Diese Schere ist der zentrale Befund. Die Ingenieursarbeit liegt deutlich über dem, was persönliche Projekte üblicherweise zeigen: sauberer Domänenschnitt, Zod-Validierung an jeder Persistenzgrenze, getestete Vorwärtsmigrationen, versioniertes Backup-Format mit Integritätsprüfung, CSP im Dokument, eine Repository-Hygiene-Prüfung als npm-Skript, zehn ADRs, 520 grüne Tests. Das ist die Grundlage, auf der man jahrelang bauen kann.

Produktseitig sind es dagegen **sechs gute Module nebeneinander, noch kein System**. Die Verbindungen, aus denen ein „PersonalOS" erst entsteht, existieren technisch (`goalId` auf Task und Habit) aber kaum im Erlebnis. Das Dashboard verdichtet nicht, es listet. Und der Finanzbereich enthält die einzigen echten Korrektheitslücken des Projekts.

### A.2 Größte Stärken

1. **Datenhoheit ist gebaut, nicht behauptet.** Vollständiger versionierter Export, Zod-validierter Import mit Vorschau, automatischer Sicherungsexport vor dem Ersetzen, Nachprüfung der Datensatzzahlen nach dem Restore. Das ist mehr, als die meisten kommerziellen Anbieter liefern.
2. **Ehrliche Kennzahlen als durchgehaltenes Prinzip.** `ratio: null` statt einer erfundenen Null. `MonthComparison` als `available | unavailable` mit Begründung. `noDataText` statt „0 %". Der Life Score wird bei fehlenden Daten nicht abgewertet, sondern meldet Unvollständigkeit. Diese Disziplin ist selten und sollte unter keinen Umständen aufgegeben werden.
3. **Sprache ohne Schuldzuweisung.** `toSummary()` in `budget.ts` und `savings.ts` formuliert Überschreitungen als Information. Der Kommentar dazu – eine Überschreitung sei ein Hinweis, kein Vorwurf – ist im Code festgehalten. Das ist eine echte Produkthaltung.
4. **Fehlergrenzen pro Route.** Ein Absturz in `/finanzen` ersetzt nur den Inhaltsbereich; Navigation und Theme bleiben bedienbar. Getestet in `router.test.tsx`.
5. **Sauberer Domänenschnitt mit durchgesetzter Regel.** Keine Domain importiert die UI einer anderen. Auswertungen lesen ausschließlich.

### A.3 Die fünf wichtigsten Probleme

| # | Problem | Schweregrad |
| --- | --- | --- |
| 1 | **Die Settings-Tabelle wird nie beschrieben.** Jedes Backup meldet fehlende Einstellungen; `baseCurrency`, `timeZone`, `weekStartsOn` sind tote Felder; das Theme liegt außerhalb des Backups. | Kritisch |
| 2 | **Umbuchungen existieren nicht.** Sparen ist entweder Ausgabe *oder* Sparfortschritt, nie beides sauber – oder beides doppelt. Ohne Konto-Entity gibt es weder Kontostand noch „frei verfügbar". | Kritisch |
| 3 | **Das Dashboard verdichtet nicht.** Kein Finanzsignal, kein Life Score, kein Zielbezug; die Aufgabenliste bricht stumm bei fünf Einträgen ab, während die Kachel darüber die volle Zahl nennt. | Hoch |
| 4 | **Keinerlei Wiederholungen.** Weder wiederkehrende Aufgaben noch wiederkehrende Buchungen. Damit fehlt die Grundlage für Fixkosten, Monatsprognose und den größten Teil realer Alltagsplanung. | Hoch |
| 5 | **Die häufigste Finanzaktion liegt am weitesten unten.** „Buchung erfassen" steht auf einer 842-Zeilen-Seite hinter der kompletten Monatsübersicht; das Produktziel lautet unter zehn Sekunden. | Hoch |

### A.4 Die fünf größten Chancen

1. **Der Wochenrückblick ist zu 80 % fertig und unsichtbar.** `weekly-review.ts` existiert, ist getestet, deterministisch – und hat keine eigene Bühne. Das ist der billigste echte Mehrwert im ganzen Projekt.
2. **`estimatedMinutes` wird erfasst, angezeigt und nie summiert.** Eine einzige Summe über die heutigen Aufgaben ergibt eine Kapazitätsanzeige nach dem Muster von Sunsama – ohne neues Datenmodell, ohne Migration.
3. **`goalId` existiert auf Task und Habit und wird produktseitig kaum genutzt.** Die Klammer „Warum mache ich das?" ist datenseitig schon da.
4. **Local-first ist ein echtes Alleinstellungsmerkmal, nicht nur eine Einschränkung.** Actual Budget baut genau darauf eine ganze Produktidentität. PersonalOS versteckt sie in einer Fußzeile.
5. **Ein Umbuchungstyp löst mehrere Probleme auf einmal:** doppelte Zählung, „frei verfügbar", Sparfortschritt-Kopplung, ehrlicher Cashflow.

### A.5 Empfehlung zur Produktausrichtung

**Nicht mehr Module. Weniger, aber verbundene.**

PersonalOS sollte aufhören, in der Breite mit Todoist, Habitify und YNAB gleichzeitig konkurrieren zu wollen – dieser Wettbewerb ist als Einzelprojekt nicht zu gewinnen und für einen einzelnen Nutzer auch nicht nötig. Der verteidigbare Platz liegt woanders: **die einzige Anwendung, die Aufgaben, Routinen und Geld desselben Menschen in einer Tagesansicht zusammenführt, ohne Konto, ohne Cloud und ohne Bewertung.** Kein Wettbewerber tut das, weil kein Geschäftsmodell es trägt.

Konkret heißt das: Finanzen bleiben bewusst schmal (kein Buchhaltungssystem, keine Depotverwaltung), müssen aber **fachlich korrekt** sein – dort liegen die einzigen echten Fehler. Aufgaben und Habits brauchen keine Featureparität, sondern Wiederholungen und Suche. Und das Dashboard muss endlich die Frage beantworten, die im eigenen `PRODUCT.md` steht: *Was ist heute wichtig?* – nicht: *was liegt alles herum?*

---

## B. Ist-Zustand des Repositorys

### B.1 Technischer Stack (aus `package.json`, verifiziert)

**Laufzeit:** React 19.2, react-router 8.3, Dexie 4.4.4, Zod 4.4.3, ECharts 6.1 – sechs Laufzeitabhängigkeiten insgesamt. Das ist bemerkenswert schlank und sollte so bleiben.

**Build/Test:** Vite 8.2 mit Terser, `vite-plugin-pwa` 1.3, TypeScript 6, Vitest 4.1, Testing Library, Playwright 1.62, `fake-indexeddb`, ESLint 10, Prettier 3.9. Toolchain: Node 24, pnpm 11.20.0, `engine-strict=true`.

**Anmerkung zur Dokumentation:** `README.md` nennt unter „Geplanter Stack" Zustand für flüchtigen UI-Zustand. Zustand ist nicht installiert; UI-Zustand liegt durchgehend in lokalem `useState`. Da der Abschnitt ausdrücklich „geplant" heißt, ist das kein Fehler – aber die Formulierung sollte nachgezogen werden, sobald klar ist, dass es dabei bleibt. Für den aktuellen Umfang ist `useState` die richtige Wahl; die Zeile weckt unnötige Erwartungen.

### B.2 Umfang

- **33.321 Zeilen** in `src/` (TS/TSX/CSS)
- **76 Testdateien / 520 Tests**, 14 Playwright-Suiten
- **17 CSS-Dateien, 4.176 Zeilen** – Aufteilung siehe C-14
- **10 ADRs**, 8 Dokumentationsdateien, Issue- und PR-Vorlagen, CI-Workflow

### B.3 Architektur

Vier Schichten, konsequent eingehalten:

```text
React UI  →  Domain Services  →  Repositories  →  Dexie/IndexedDB
     └───── Queries / Insights (nur lesend) ─────┘
```

Geprüft und bestätigt: keine direkte Dexie-Nutzung aus Komponenten, keine domänenübergreifenden UI-Importe, Geschäftslogik ohne React-Abhängigkeit, Transaktionen für zusammengehörige Schreibvorgänge, typisierte Persistenzfehler ohne Inhaltsprotokollierung.

**Positiv hervorzuheben:** `runInTransaction` in `savings-service.ts` prüft die Währung des Sparziels *innerhalb* derselben Transaktion, in der der Beitrag geschrieben wird. Diese Sorgfalt ist die richtige – sie macht C-02 umso ärgerlicher, weil dort dieselbe Sorgfalt fehlt.

### B.4 Routen und Informationsarchitektur

| Route | Modul | Chunk (roh) |
| --- | --- | --- |
| `/` | Heute | 9,70 kB |
| `/aufgaben` | Aufgaben | 10,96 kB |
| `/gewohnheiten` | Gewohnheiten | 21,36 kB |
| `/journal` | Journal | 7,72 kB |
| `/ziele` | Ziele | 9,55 kB |
| `/finanzen` | Finanzen | 28,44 kB |
| `/insights` | Insights | 31,73 kB |
| `/einstellungen` | Einstellungen | 12,90 kB |
| `/komponenten` | Komponentenvorschau | 11,10 kB |

Navigation: vier primäre Punkte (Heute, Aufgaben, Gewohnheiten→„Routinen", Journal), vier sekundäre (Ziele, Finanzen, Insights, Einstellungen). Desktop zeigt alle acht flach untereinander; Mobil zeigt vier plus „Mehr"-Panel.

### B.5 Datenmodell (Schema-Version 4, 15 Tabellen)

Gemeinsame Basis für jeden Datensatz: `id`, `createdAt`, `updatedAt`, optional `archivedAt`. Zeitpunkte als ISO-8601-UTC, Kalendertage als `YYYY-MM-DD`, Geld als ganzzahlige Minor Units plus ISO-Währung. Diese Konventionen sind **überall** eingehalten – auch das ist keine Selbstverständlichkeit.

**Aufgaben:** Titel, Notiz, Priorität (`low|normal|high`), `dueAt`, `plannedDate`, `estimatedMinutes`, `categoryId` (drei fest verdrahtete UUIDs: Privat, Arbeit, Erledigungen – bewusst so, ADR 0004), `goalId`.
→ *Nicht vorhanden:* Wiederholung, Teilaufgaben, Tags, Freitextsuche.

**Gewohnheiten:** Rhythmus als `daily | weekdays | timesPerWeek`, Start-/Enddatum, `categoryId`, `goalId`. Einträge mit `done | skipped`, eindeutig je `[habitId+localDate]`.
→ *Nicht vorhanden:* Rhythmus-Historie (bewusst, ADR 0005), Mengenziele („3 Liter"), Erinnerungen.

**Finanzen:** Buchung mit `kind: income | expense`, Betrag, Kategorie, `bookedOn`, Notiz. Monatsbudget eindeutig je `[month+categoryId]`. Sparziele mit Beiträgen in **getrennten** Tabellen ohne Bezug zu Buchungen.
→ *Nicht vorhanden:* **Konto, Umbuchung, Wiederholung, Fixkosten-/Variabel-Unterscheidung, Vermögen, Verbindlichkeit, geplante Buchung.**

**Ziele:** Status, `progressMode: milestones | manual`, Meilensteine mit fester Reihenfolge.

**Auswertung:** `scoreSettings` (fünf Bereiche mit Gewichten), `scoreSnapshots` mit gespeicherter Berechnungsversion, `hiddenInsights`.

### B.6 Designsystem

Semantische Tokens in `tokens.css` (297 Zeilen), zwei Paletten: **Abendrot** (dunkel) und **Tageslicht** (hell). Glas-Ästhetik mit `backdrop-filter`, dekorativer Farbnebel hinter der App-Shell.

Die Kommentare in `tokens.css` dokumentieren die Kontrastentscheidungen im Detail – welcher Wert warum abgedunkelt wurde, wo weißes Glas eine Karte zu stark aufhellt. Das ist vorbildliche Designsystem-Dokumentation und deutlich besser als das, was man normalerweise antrifft.

Basiskomponenten in `src/components/ui/`: Button, Card, Checkbox, Dialog, EmptyState, FormField, IconButton, Input, MetricTile, ProgressBar, ProgressRing, RankedBarList, Select, Skeleton, Textarea, Toast, TrackerCell, Chart. `AGENTS.md` verbietet ausdrücklich, dass Domainseiten eigene Kennzahl-, Fortschritts- oder Diagramm-Bausteine nachbauen – die Regel wird eingehalten.

### B.7 Bekannte funktionale Grenzen

Aus `KNOWN_LIMITATIONS.md` und Code bestätigt: Import ersetzt vollständig (kein Merge), Journaltage nicht löschbar, Check-in an nicht mehr geplantem Tag nicht entfernbar, Tab-Leisten ohne Pfeiltastennavigation, Habit-Wochenansicht scrollt horizontal, keine Listenvirtualisierung, E2E nur gegen Chromium.

---

## C. UX/UI-Audit

23 Befunde, nach Schweregrad sortiert. Aufwandsschätzung: **S** ≤ ½ Tag, **M** 1–2 Tage, **L** 3–5 Tage, **XL** > 1 Woche.

---

### 🔴 Kritisch

---

#### C-01 · Die Settings-Tabelle wird nie beschrieben

**Betroffen:** `src/db/schemas/settings.ts`, `src/db/backup/service.ts`, alle Domainseiten

**Beobachtung (empirisch verifiziert):** Kein Code in `src/` legt jemals einen Settings-Datensatz an. Migration `v2-add-week-start.ts` patcht vorhandene Zeilen – es gibt keine. Ich habe das mit einem eigenen Vitest-Lauf gegen eine Testdatenbank mit einer Aufgabe geprüft:

```text
SETTINGS ROWS: 0
WARNINGS: ["Das Backup enthält keine Einstellungen."]
```

Daraus folgt eine Kette:

1. **Jedes** Backup enthält `settings: []`, und **jede** Import-Vorschau zeigt eine Warnung, die wie Datenverlust aussieht – bei völlig intakten Daten.
2. `baseCurrency` steht im Schema und wird **nirgends gelesen**; `FinancePage.tsx` hat `const currency = "EUR"` fest verdrahtet.
3. `timeZone` steht im Schema und wird nirgends gelesen; acht Komponenten rufen stattdessen `Intl.DateTimeFormat().resolvedOptions().timeZone` direkt auf.
4. `weekStartsOn` ist `z.literal(1)` – das Feld kann nur einen Wert annehmen. Migration v2 hat ein Feld eingeführt, das nichts entscheidet.
5. Das Theme liegt ausschließlich in `localStorage` und ist damit **nicht Teil des Backups**. Nach „Lokale Daten löschen" oder auf einem neuen Gerät ist die Einstellung weg, obwohl ein vollständiges Backup eingespielt wurde.

**Nutzerproblem:** Der wichtigste Vertrauensmoment des Produkts – die Wiederherstellung – beginnt mit einer Warnung. Wer Datenhoheit als Kernversprechen ausgibt, darf ausgerechnet hier keine falsche Alarmmeldung erzeugen. Zusätzlich ist „Einstellungen" faktisch keine Funktion: es gibt Backup, lokale Daten und ein Theme, sonst nichts.

**Häufigkeit:** Bei jedem Export und jedem Import. Die Folgefehler (2)–(4) wirken dauerhaft im Hintergrund.

**Empfohlene Lösung:** Beim ersten erfolgreichen Öffnen der Datenbank einen Settings-Datensatz mit sinnvollen Vorgaben anlegen (`locale: "de-DE"`, erkannte Zeitzone, `theme: "system"`, `baseCurrency: "EUR"`, `weekStartsOn: 1`). Danach: Theme aus Settings statt aus `localStorage` lesen (der Bootstrap-Spiegel aus ADR 0002 bleibt als Vorabanzeige bestehen), `baseCurrency` in `FinancePage` verwenden, gespeicherte Zeitzone statt `Intl`-Aufruf. Einstellungsseite um Währung, Zeitzone und Wochenstart ergänzen.

**Alternative (kleiner):** Nur den Seed-Datensatz und die Backup-Warnung reparieren, die toten Felder bewusst als „reserviert" dokumentieren. Behebt den sichtbaren Schaden, lässt die Architekturlüge stehen.

**Aufwand:** M (Seed + Theme-Umzug + Einstellungs-UI). Der reine Seed ist S.

---

#### C-02 · Sparziel-Summe addiert über Währungsgrenzen

**Betroffen:** `src/domains/finance/overview.ts`, Funktion `summariseSavings`

**Beobachtung (empirisch verifiziert):** Der Doc-Kommentar über der Funktion sagt, Ziele in anderer Währung blieben außen vor, damit die Summe nicht unbemerkt verfälscht wird. **Der Code tut das nicht.** Er summiert `savedMinor` und `targetMinor` über alle aktiven Ziele ohne jede Währungsprüfung. `calculateSavingsProgress` prüft nur Beitrag gegen Ziel, nicht Ziel gegen Übersichtswährung.

Reproduziert mit einem EUR-Ziel (500 von 1.000) und einem JPY-Ziel (50.000 von 100.000 Minor Units):

```text
SAVINGS SUMMARY: {"activeGoalCount":2,"ratio":0.5,"savedMinor":100000,"targetMinor":200000}
```

`MonthOverview.tsx` rendert das anschließend als Fortschrittsbalken mit `formatMoney(createMoney(savedMinor, overview.currency))` – also als Euro-Betrag. Erfundene Zahl, präsentiert als Tatsache.

**Nutzerproblem:** Genau die Fehlerklasse, die das Projekt an anderer Stelle mit großem Aufwand vermeidet. Der Widerspruch zwischen Kommentar und Code ist zusätzlich gefährlich: Wer den Kommentar liest, hält die Stelle für geprüft.

**Häufigkeit:** Derzeit **niedrig** – die Oberfläche verdrahtet EUR überall fest, der Fall ist nur über einen importierten Backup auslösbar (der Import validiert das Schema, nicht die Währungseinheitlichkeit). Die Schwere ergibt sich aus der Fehlerklasse, nicht aus der Häufigkeit. Sobald `baseCurrency` aus C-01 nutzbar wird, steigt die Häufigkeit sofort.

**Empfohlene Lösung:** `summariseSavings` erhält die Übersichtswährung als Parameter und ignoriert abweichende Ziele nachweislich – plus Rückgabefeld `excludedGoalCount`, das die Oberfläche benennt („2 von 3 Zielen; 1 Ziel in anderer Währung nicht enthalten"). Stilles Weglassen wäre nur die halbe Ehrlichkeit. Regressionstest mit gemischten Währungen.

**Alternative:** `MixedCurrencyError` werfen wie an den anderen Stellen. Konsistenter, aber härter: ein einzelnes fremdwährungs-Ziel legt dann die ganze Monatsübersicht lahm.

**Aufwand:** S

---

#### C-03 · Umbuchungen gibt es nicht – Sparen ist entweder unsichtbar oder doppelt

**Betroffen:** `src/db/schemas/domain-records.ts`, gesamte Finanzdomäne

**Beobachtung:** `financeKinds = ["income", "expense"]`. Es gibt kein Konto-Entity, keinen Buchungstyp „Umbuchung", und `savingsContributions` steht in einer separaten Tabelle **ohne jede Verbindung** zu `transactions`.

Wer 500 € aufs Sparkonto legt, hat drei Möglichkeiten, alle falsch:

| Vorgehen | Folge |
| --- | --- |
| Nur als Ausgabe buchen | Saldo stimmt, Sparfortschritt bleibt bei null |
| Nur als Sparbeitrag erfassen | Sparfortschritt stimmt, der Monatssaldo behauptet 500 € mehr übrig |
| Beides erfassen | Die 500 € sind zweimal im System |

**Nutzerproblem:** Sparen ist der Kern des Sparziel-Moduls. Dass ausgerechnet dieser Vorgang nicht korrekt abbildbar ist, entwertet beide Bereiche. Zusätzlich verhindert das fehlende Konto-Entity jede Aussage über Kontostand oder frei verfügbares Geld – beides steht als Anforderung im Auftrag.

**Häufigkeit:** Bei jeder Sparbewegung, also monatlich bis wöchentlich bei bestimmungsgemäßer Nutzung.

**Empfohlene Lösung:** Zwei Schritte, in dieser Reihenfolge.

*Schritt 1 (klein, sofort möglich):* Ein Sparbeitrag erhält ein optionales Feld `sourceTransactionId`. Wer eine Ausgabe der Kategorie „Sparen" bucht, kann sie beim Anlegen des Beitrags verknüpfen. Die Monatsübersicht rechnet verknüpfte Beträge genau einmal und weist sie als „gebunden" statt als frei verfügbar aus.

*Schritt 2 (richtig, später):* Konten als Entity, `kind: "transfer"` mit `fromAccountId`/`toAccountId`, ausgeschlossen aus Einnahmen und Ausgaben. Das ist der belegte Marktstandard (D-08, D-09).

**Alternative (Minimallösung):** Kategorien ein Flag `excludeFromCashflow` geben. Löst die Doppelzählung, liefert aber keinen Kontostand und keinen echten Umbuchungsbegriff.

**Aufwand:** Schritt 1: M · Schritt 2: L (mit Migration)

---

### 🟠 Hoch

---

#### C-04 · Das Dashboard beantwortet die eigene Leitfrage nicht

**Betroffen:** `src/domains/today/pages/TodayPage.tsx`

**Beobachtung:** `PRODUCT.md` §7 legt fest, was das Dashboard zeigt: wichtigstes Tagesergebnis, Life Score mit Datenvollständigkeit, zuletzt erfasste Stimmung, heutige Aufgaben und Habits, offene Abendreflexion, Wochenziele, **Monatsbudget und Sparziel**, sowie fünf Quick Actions (Aufgabe, Habit, Journal, **Ausgabe**, Ziel-Meilenstein).

Tatsächlich vorhanden: drei Kacheln (Aufgaben, Gewohnheiten, Abendreflexion), ein Tagesring über die Habit-Quote, Schnellerfassung **nur** für Aufgaben, Aufgabenliste, Habitliste, Journalkarte.

Nicht vorhanden: Life Score, jedes Finanzsignal, jeder Zielbezug, vier der fünf Quick Actions.

**Nutzerproblem:** Wer wissen will, ob das Monatsbudget hält, muss auf `/finanzen`; wer den Life Score sehen will, auf `/insights`; wer den Zielfortschritt sucht, auf `/ziele`. Das Dashboard ist damit ein viertes Modul statt der Klammer über allen. Das eigene Produktversprechen – drei Fragen beantworten – wird nur bei der ersten eingelöst.

**Häufigkeit:** Bei jedem Öffnen der App. Es ist die Startroute.

**Empfohlene Lösung:** Konzept in Abschnitt G. Kern: Finanzsignal und Life Score aufnehmen, aber **nur als Signal, nicht als Kachelparade** – eine Zeile, die schweigt, solange nichts auffällig ist.

**Alternative:** Dashboard so lassen und `PRODUCT.md` §7 auf den Ist-Zustand kürzen. Legitim, wenn die Entscheidung bewusst fällt – aber dann ist die Klammer dauerhaft aufgegeben.

**Aufwand:** L

---

#### C-05 · Die Tagesliste bricht stumm bei fünf Aufgaben ab

**Betroffen:** `TodayPage.tsx`, Zeile 332

**Beobachtung:** `overview.openTasks.slice(0, 5)`. Die Kachel darüber zeigt `${overview.openTasks.length} offen`. Bei zwölf offenen Aufgaben steht dort „12 offen", darunter stehen fünf. Der Link „Zu den Aufgaben" existiert **ausschließlich** im Leerzustand – also genau dann, wenn er nicht gebraucht wird.

**Nutzerproblem:** Sichtbarer Widerspruch zwischen zwei Elementen derselben Karte, ohne Auflösung und ohne Weg zum Rest. Das untergräbt die Glaubwürdigkeit einer App, die sonst penibel darauf achtet, keine falschen Zahlen zu zeigen.

**Häufigkeit:** Ab sechs offenen Aufgaben, also im Alltag ständig.

**Empfohlene Lösung:** Fußzeile bei Kürzung: „5 von 12 gezeigt – alle Aufgaben ansehen" als Link auf `/aufgaben`.

**Alternative:** Statt Kürzung die Priorisierung schärfen – höchstens drei Aufgaben, ausdrücklich als „Fokus für heute" beschriftet, Rest bewusst weggelassen. Näher an der Produktidee (Handlungsbedarf statt Datenmenge), aber die inkonsistente Zahl in der Kachel muss trotzdem weg.

**Aufwand:** S

---

#### C-06 · Keine Wiederholungen – weder bei Aufgaben noch bei Buchungen

**Betroffen:** gesamtes Datenmodell (`grep -i "recurr\|wiederhol\|rrule"` → **null Treffer** in `src/`)

**Beobachtung:** Habits haben Rhythmen, Aufgaben und Buchungen nicht. Miete, Versicherung, Abos, Gehalt, „Müll rausbringen", „Steuererklärung" – alles muss jeden Monat neu getippt werden.

**Nutzerproblem:** Doppelt.

*Aufgabenseite:* Wiederkehrende Verpflichtungen sind ein Großteil realer Alltagsplanung. Wer sie nicht abbilden kann, muss sie im Kopf behalten – genau das, was die App abnehmen soll. Todoist und Things bilden beide Wiederholungen ab (D-01, D-03).

*Finanzseite:* Ohne wiederkehrende Buchungen gibt es keine Fixkosten, keinen prognostizierten Monatsabschluss und kein „frei verfügbar nach Fixkosten und Sparzielen". Das sind vier Anforderungen aus dem Auftrag, die alle an derselben Wurzel hängen.

**Häufigkeit:** Täglich spürbar.

**Empfohlene Lösung:** Zwei getrennte, jeweils kleine Schritte statt eines großen.

*Buchungen zuerst* (höherer Nutzen, einfacher): Eine Vorlage mit Betrag, Kategorie, Art und Monatstag. Beim Öffnen des Finanzbereichs erscheinen fällige Vorlagen als Vorschlag mit einem Bestätigungs-Tap – **nicht** automatisch gebucht. So bleibt jede Buchung eine bewusste Handlung, und die Unterscheidung geplant/tatsächlich ergibt sich von selbst.

*Aufgaben danach:* Bewusst nur die einfachen Fälle – täglich, wöchentlich an bestimmten Wochentagen, monatlich am Tag N. Kein RRULE. Beim Abschließen entsteht die nächste Instanz.

**Alternative:** Nur Buchungsvorlagen bauen und wiederkehrende Aufgaben ausdrücklich als Habit-Fall erklären. Deckt „Müll rausbringen" ab, nicht „Steuererklärung im Mai".

**Aufwand:** Buchungsvorlagen M · Aufgabenwiederholung L (Abschlusslogik, Zeitzonen, Nachholfälle)

---

#### C-07 · Die häufigste Finanzaktion liegt am weitesten unten

**Betroffen:** `src/domains/finance/pages/FinancePage.tsx` (842 Zeilen)

**Beobachtung:** Reihenfolge auf `/finanzen`: **Monatsübersicht** (vier Kacheln, Vergleichszeile, Balkendiagramm, Sparfortschritt) → **Buchung erfassen** → Buchungen → Budgets → Sparziele → Kategorien. Eine Datei erledigt fünf Aufgaben.

`PRODUCT.md` §4 nennt als Ziel für Erfassungsaktionen: unter zehn Sekunden. Auf einem 320-px-Gerät steht vor dem Formular ein kompletter Auswertungsblock. Das Dashboard bietet keine Ausgaben-Schnellerfassung (C-04), es gibt also keinen Umweg.

*Annahme:* Der Scrollweg dürfte auf einem typischen Telefon eine bis anderthalb Bildschirmhöhen betragen. Ohne Browser konnte ich das nicht messen.

**Nutzerproblem:** Erfassen ist häufig, Auswerten selten. Die Seite ist genau andersherum sortiert. Ausgabenerfassung scheitert im Alltag an Sekunden – wenn es unbequem ist, unterbleibt es, und dann sind alle Auswertungen wertlos.

**Häufigkeit:** Mehrmals wöchentlich.

**Empfohlene Lösung:** Reihenfolge auf Mobil umdrehen (Erfassen zuerst, Übersicht danach) **und** eine Ausgaben-Schnellerfassung aufs Dashboard nehmen: Betrag, Kategorie, fertig – Datum ist heute, Notiz optional. Zusätzlich `FinancePage.tsx` in vier Komponenten zerlegen (Erfassung, Liste, Budgets, Kategorien); `MonthOverview` und `SavingsPanel` sind bereits getrennt und zeigen, dass der Schnitt funktioniert.

**Alternative:** Unterseiten `/finanzen/uebersicht`, `/finanzen/buchungen`, `/finanzen/budgets`. Sauberer, aber mehr Navigationsaufwand für einen Einzelnutzer.

**Aufwand:** M (Umsortierung + Schnellerfassung) · L (mit Dateiaufteilung)

---

#### C-08 · Keine Suche, kein Wiederfinden

**Betroffen:** `TasksPage.tsx`, `queries.ts`, alle Listenansichten

**Beobachtung:** Vier Aufgabenansichten (Inbox, Heute, Woche, Erledigt), sortiert nach Priorität bzw. Abschlusszeitpunkt. **Keine Freitextsuche in der gesamten Anwendung.** Erledigte Aufgaben sind nach Abschlussdatum absteigend sortiert; eine Aufgabe von vor drei Monaten ist nur durch Scrollen auffindbar. Auch Buchungen (nur Monat/Art/Kategorie filterbar), Journaleinträge und Sparbeiträge haben keine Suche.

**Nutzerproblem:** Der Auftrag nennt „Aufgabe erstellen, bearbeiten, abschließen und **wiederfinden**" als Testfall 1. Der letzte Teil ist derzeit nicht lösbar. Nach mehreren Monaten Nutzung – Testfall 10 – wird das zum Hauptproblem: Daten sammeln sich an, ohne dass man an sie herankommt.

**Häufigkeit:** Steigt monoton mit der Nutzungsdauer. In Woche 1 kein Problem, in Monat 6 das größte.

**Empfohlene Lösung:** Ein Suchfeld pro Listenseite, das über Titel und Notiz filtert. Rein clientseitig auf bereits geladenen Daten – bei den gemessenen Größenordnungen (siehe C-19) genügt das ohne Index.

**Alternative:** Globale Suche über alle Domänen. Deutlich mehr Wert, deutlich mehr Aufwand, und sie braucht ein Konzept für gemischte Ergebnistypen. Später sinnvoll, nicht als Erstes.

**Aufwand:** S pro Seite · L für globale Suche

---

#### C-09 · „Überspringen" kostet einen Tap und ändert rechnerisch fast nichts

**Betroffen:** `metrics.ts`, `score-engine.ts`, `HabitTodayCard.tsx`

**Beobachtung:** Ein übersprungener Tag zählt nicht als erledigt, bleibt aber im Nenner der Erfüllungsquote, und er **bricht die Streak** (`calculateDailyStreak` setzt die Serie bei allem außer `done` zurück). Der einzige Unterschied zwischen „übersprungen" und „gar nicht erfasst": der Tag verschwindet aus der Fälligkeitsliste.

Die Entscheidung ist konsistent dokumentiert – „Übersprungene Tage bleiben im Nenner, weil sie eine erfasste Entscheidung sind" steht in `score-view-model.ts`. Sie ist also gewollt, nicht versehentlich.

Der Markt macht es anders. Habitify: Skip signalisiert, dass man die Gewohnheit heute nicht ausführt, ohne zu scheitern – die Streak bleibt erhalten (D-05). Loop verzichtet ganz auf Alles-oder-Nichts und nutzt einen geglätteten Stärkewert (D-06).

**Nutzerproblem:** Wer bewusst eine Pause einträgt, wird genauso behandelt wie jemand, der die Gewohnheit vergisst. Das ist die „strafende Streak", die `PRODUCT.md` §3 ausdrücklich ablehnt. Und der zweite Button wirkt folgenlos – was Nutzer ihn schnell ignorieren lässt.

**Häufigkeit:** Bei jeder Krankheit, Reise oder Ausnahme; realistisch mehrmals im Monat.

**Empfohlene Lösung:** Übersprungene Tage brechen die Streak nicht mehr und fallen aus dem Nenner der Erfüllungsquote. Die Zahl der Übersprünge bleibt separat sichtbar (das ist schon so). Falls die Nenner-Entscheidung bleiben soll, dann mindestens die Streak-Behandlung ändern und in der Oberfläche erklären, was der Unterschied ist – derzeit steht das nirgends.

**Alternative (weitergehend):** Zusätzlich zur Streak einen geglätteten Stärkewert nach Loop-Vorbild zeigen und die Streak visuell zurücknehmen. Ehrlicher gegenüber der Realität von Gewohnheiten, aber ein neues Konzept, das erklärt werden muss.

**Aufwand:** S für die Streak-Korrektur · M mit Stärkewert · **Erfordert ADR** (ändert eine dokumentierte Entscheidung)

---

#### C-10 · Kein Onboarding, kein erster Schritt

**Betroffen:** `SettingsPage.tsx`, alle Leerzustände

**Beobachtung:** Kein Willkommensbildschirm, keine Beispieldaten, keine Erklärung. Beim ersten Start: leeres Dashboard, drei Kacheln mit Nullen, ein Eingabefeld. Die Einstellungsseite enthält Backup, lokale Daten – und einen Link zur **Komponentenvorschau**, betitelt „Lokale Entwicklungsübersicht". Ein Entwicklerwerkzeug in der Endnutzer-Navigation.

Die einzelnen Leerzustände sind gut geschrieben (`EmptyState` mit Titel, Beschreibung, Aktion) – aber sie erklären ein Modul, nicht das Produkt.

**Nutzerproblem:** Ein System mit sechs verbundenen Modulen und einem erklärbaren Score erschließt sich nicht von selbst. Ohne Einstieg bleibt unklar, in welcher Reihenfolge man anfängt. Wenn PersonalOS je über den Autor hinaus genutzt werden soll – und das Stellwerk-OS-Umfeld legt nahe, dass es auch als Referenzprojekt dient – ist die erste Minute entscheidend.

**Häufigkeit:** Einmal pro Nutzer. Aber es ist die Minute, die über Weiternutzung entscheidet.

**Empfohlene Lösung:** Drei Schritte, kein Assistent: (1) Willkommenskarte auf dem leeren Dashboard, die in zwei Sätzen erklärt, was die App tut und dass Daten das Gerät nicht verlassen; (2) drei Startaktionen („Erste Aufgabe", „Erste Gewohnheit", „Erste Buchung"); (3) Komponentenvorschau hinter eine Entwicklungs-Flag oder in einen ausklappbaren Bereich „Für Entwicklung".

**Alternative:** Optionale synthetische Beispieldaten mit einem Klick löschbar. Zeigt die Verknüpfungen sofort, erzeugt aber Vermischungsrisiko mit echten Daten und widerspricht der strikten Datenschutzhaltung.

**Aufwand:** M

---

### 🟡 Mittel

---

#### C-11 · Vier Kennzahlen nebeneinander, drei über den Monat und eine über Teilkategorien

**Betroffen:** `MonthOverview.tsx`

**Beobachtung:** Die Kacheln Einnahmen, Ausgaben, Saldo beziehen sich auf **alle** Buchungen des Monats. Die vierte, Restbudget, bezieht sich **nur** auf Kategorien mit gesetztem Budget. Der Kontexttext nennt die Zahl der budgetierten Kategorien – aber er steht klein unter der Kachel, in derselben Zeile wie Monat und Währung.

**Nutzerproblem:** Vier gleich aussehende Kacheln suggerieren vier vergleichbare Zahlen. „Saldo −200 €" neben „Restbudget +300 €" ist ohne genaues Lesen widersprüchlich, obwohl beide korrekt sind.

**Häufigkeit:** Bei jedem Blick auf den Finanzbereich, sobald ein Budget existiert.

**Empfohlene Lösung:** Restbudget aus der Viererreihe herausnehmen und zum Budgetblock verschieben, wo es hingehört. Die Monatsreihe wird dreispaltig und in sich konsistent.

**Alternative:** Beschriftung schärfen („Restbudget · 3 Kategorien") und optisch abgrenzen. Billiger, löst die Vermischung aber nur halb.

**Aufwand:** S

---

#### C-12 · Sparfortschritt im Monatsblock ist ein Gesamtstand

**Betroffen:** `MonthOverview.tsx`, Funktion `describeSavings`

**Beobachtung:** Der Fortschrittsbalken „Sparziele" steht im Block „Monatsübersicht", zeigt aber alle Beiträge seit jeher. Die Bildunterschrift sagt das ausdrücklich – dass der Stand alle Beiträge zählt, nicht nur die des Monats. Das ist ehrlich und korrekt.

**Nutzerproblem:** Trotz korrekter Beschriftung arbeitet die Platzierung gegen den Text. Eine Überschrift ist ein stärkeres Signal als eine Bildunterschrift; wer scannt, liest „Monatsübersicht" und ordnet alles darunter dem Monat zu.

**Häufigkeit:** Bei jedem Besuch des Finanzbereichs.

**Empfohlene Lösung:** Sparfortschritt in den Sparziel-Block verschieben. Im Monatsblock stattdessen die **in diesem Monat geleisteten** Beiträge zeigen – das ist die monatsbezogene Zahl und passt zur Überschrift. Beides ist aus vorhandenen Daten berechenbar (`bookedOn` liegt auf jedem Beitrag).

**Aufwand:** S

---

#### C-13 · Der Life Score ist nirgends sichtbar, wo er wirken könnte

**Betroffen:** `InsightsPage.tsx`, `TodayPage.tsx`

**Beobachtung:** Score-Engine, Gewichtungen, Erklärungen und Snapshots sind vollständig gebaut und ausführlich getestet – und ausschließlich auf `/insights` erreichbar, dem am seltensten besuchten Bereich (Position 7 von 8 in der Navigation, auf Mobil hinter „Mehr" versteckt).

**Nutzerproblem:** Die aufwendigste Auswertungsarbeit des Projekts erreicht den Nutzer im Alltag nicht. `PRODUCT.md` §7 sieht den Score ausdrücklich im oberen Dashboardbereich vor.

**Häufigkeit:** Dauerhaft ungenutztes Potenzial.

**Empfohlene Lösung:** Kompakter Score im Dashboard-Kopf mit Datenvollständigkeit und Link zur Erklärung. Genau eine Zahl plus Veränderung – keine Teilwerte, die bleiben auf `/insights`.

**Alternative:** Statt des Zahlenwerts nur den auffälligsten Teilwert als Satz („Gewohnheiten liegen diese Woche unter deinem Schnitt"). Näher an „Handlungsbedarf statt Datenmenge", verliert aber die Vergleichbarkeit über Zeit.

**Aufwand:** M

---

#### C-14 · Inter ist gesetzt, aber nicht ausgeliefert

**Betroffen:** `tokens.css`, `public/`

**Beobachtung:** `font-family: Inter, ui-sans-serif, system-ui, …` in `:root`. Es gibt **kein** `@font-face`, keine Schriftdatei in `public/`, keinen externen Font-Verweis (letzteres bewusst – die CSP erlaubt `font-src 'self'`). Auf Geräten ohne installiertes Inter rendert die App also system-ui.

Verschärfend: `font-synthesis: none` und Gewichte 750 (`--font-weight-bold`) und 800 (`--font-weight-kpi`). Ohne variable Schrift fallen diese auf den nächstliegenden vorhandenen Schnitt zurück – die typografische Hierarchie zwischen 600, 750 und 800 verflacht.

**Nutzerproblem:** Das Erscheinungsbild unterscheidet sich systematisch zwischen Entwicklungsrechner (Inter meist installiert) und Zielgeräten. Feinabstimmungen am Buchstabenabstand (`--letter-spacing-label: 0.09em`) sind auf eine Schrift abgestimmt, die dort nicht ankommt.

*Annahme:* Ich konnte den tatsächlichen Renderunterschied nicht sehen. Der Mechanismus ist aber eindeutig.

**Häufigkeit:** Auf jedem Gerät ohne Inter, also den meisten.

**Empfohlene Lösung:** Entscheiden und dann konsequent sein. Entweder Inter als variable WOFF2-Datei selbst ausliefern (`font-display: swap`, Latin-Subset, ~15–25 kB – das passt neben dem Startbudget) – oder Inter aus dem Stack streichen und die Gewichte auf 400/600/700 normalisieren, also auf Werte, die Systemschriften wirklich haben.

**Aufwand:** S (beide Wege)

---

#### C-15 · `theme-color` passt zu keiner der beiden Paletten

**Betroffen:** `index.html`, `vite.config.ts` (Manifest)

**Beobachtung:** `<meta name="theme-color" content="#285c3a">` – ein Dunkelgrün. Manifest: `theme_color: "#285c3a"`, `background_color: "#e8ecf2"`. Die aktuellen Paletten sind Abendrot (`#2a1030`, ein tiefes Violett) und Tageslicht (`#e8ecfb`). Das Grün stammt erkennbar aus einer früheren Farbwelt; das Manifest-Grau `#e8ecf2` ist dem hellen Tageslicht-Ton `#e8ecfb` ähnlich, aber nicht gleich.

**Nutzerproblem:** In der installierten PWA färben sich Statusleiste und Startbildschirm in einer Farbe, die im Produkt nicht mehr vorkommt. Zusätzlich fehlt eine palettenabhängige Angabe (`media="(prefers-color-scheme: dark)"`), sodass die Statusleiste in einem der beiden Themes zwangsläufig danebenliegt.

**Häufigkeit:** Bei jedem Start der installierten App.

**Empfohlene Lösung:** Zwei `theme-color`-Angaben mit `media`-Bedingung auf die tatsächlichen Palettenwerte, Manifest-Farben angleichen. Als Absicherung eine Prüfung in `check-repository-hygiene.mjs`, die Manifest-Farben gegen die Token vergleicht – das Skript ist der richtige Ort, weil es solche Driftfälle bereits systematisch abfängt.

**Aufwand:** S

---

#### C-16 · Bedienelemente unter der empfohlenen Mindestgröße

**Betroffen:** `styles.css`

**Beobachtung:** Der Theme-Wechsler in der klebenden Kopfzeile hat `min-height: 2.2rem` (35,2 px), die Offline-Anzeige `min-height: 2rem` (32 px). Das Designsystem definiert `--control-height: 2.75rem` (44 px), und die Basiskomponenten halten das ein. Die Kopfzeile weicht ab.

WCAG 2.5.8 (AA) fordert 24 × 24 px – das ist erfüllt. WCAG 2.5.5 (AAA) und die verbreitete Praxis für Touch nennen 44 px – das ist nicht erfüllt.

**Nutzerproblem:** Zwei Elemente in der obersten, klebenden Leiste sind kleiner als der eigene Standard. Die Offline-Anzeige ist reine Information und damit unkritisch; der Theme-Wechsler ist ein Bedienelement.

**Häufigkeit:** Selten benutzt, aber dauerhaft sichtbar.

**Empfohlene Lösung:** `--control-height` auch in der Kopfzeile verwenden. Ergänzend: Der Theme-Wechsler ist als beschriftetes `select` in der obersten Leiste sehr präsent für eine Einstellung, die man dreimal im Leben ändert – er gehört eher in die Einstellungen, mit optionalem Icon-Umschalter oben.

**Aufwand:** S

---

#### C-17 · Das „Mehr"-Panel schließt nicht beim Tippen daneben

**Betroffen:** `MobileNavigation.tsx`

**Beobachtung:** Das Überlaufmenü schließt bei Escape, bei Auswahl eines Eintrags und bei Routenwechsel (über den Pfadnamen-Vergleich). Es schließt **nicht** bei einem Tap außerhalb. Semantisch ist es ein `div` mit `aria-label`, ohne `role="menu"` oder Dialogrolle, ohne Fokusfalle und ohne Fokusrückgabe auf den Auslöser.

Die Escape-Behandlung und `aria-expanded`/`aria-current` sind vorhanden und korrekt – die Grundlagen stimmen, die Vervollständigung fehlt.

**Nutzerproblem:** Auf Mobilgeräten ist der Tap daneben die erwartete Geste zum Schließen. Das Panel überdeckt Inhalt und bleibt stehen. Für Tastatur- und Screenreader-Nutzung fehlt die Fokusführung.

**Häufigkeit:** Bei jeder Nutzung der sekundären Navigation auf Mobil – also bei jedem Besuch von Finanzen, Zielen, Insights oder Einstellungen.

**Empfohlene Lösung:** Ein `pointerdown`-Listener auf `document`, der bei Klick außerhalb schließt, plus Fokusrückgabe auf den „Mehr"-Button beim Schließen und Fokus auf den ersten Eintrag beim Öffnen.

**Aufwand:** S

---

#### C-18 · Fünf Textbeschriftungen im mobilen Navigationsband, ohne Icons

**Betroffen:** `MobileNavigation.tsx`, `styles.css`

**Beobachtung:** Fünf gleich breite Spalten (`repeat(5, minmax(0, 1fr))`) mit reinen Textbeschriftungen, Schriftgröße `clamp(0.63rem, 2.8vw, 0.76rem)` – bei 320 px ergibt das rund 10 px auf 64 px Breite. „Gewohnheiten" ist bereits zu „Routinen" gekürzt.

Die Trefferfläche selbst ist ausreichend (`--mobile-nav-height: 4.5rem`).

**Nutzerproblem:** 10-px-Text ohne visuellen Anker ist schwer zu scannen. Alle etablierten mobilen Apps setzen hier Icon plus Beschriftung, weil das Icon beim wiederholten Gebrauch die eigentliche Orientierung liefert. Zusätzlich schafft die Kürzung „Gewohnheiten" → „Routinen" zwei Namen für denselben Bereich (siehe C-21).

*Annahme:* Die Lesbarkeit bei 320 px konnte ich nicht prüfen.

**Häufigkeit:** Bei jedem Navigationsvorgang auf Mobil.

**Empfohlene Lösung:** Icons ergänzen (inline-SVG, keine Bibliothek – bei fünf Symbolen sind das wenige hundert Byte). Schriftgröße auf mindestens 0,7 rem anheben.

**Alternative:** Auf vier Einträge reduzieren und „Mehr" als fünften belassen – bei Icons ist das nicht nötig.

**Aufwand:** S

---

#### C-19 · Verhalten bei realistischen Datenmengen ist nur teilweise abgesichert

**Betroffen:** alle Listenansichten

**Beobachtung:** `KNOWN_LIMITATIONS.md` dokumentiert eine Messung: rund 3.000 Aufgaben, 40 Gewohnheiten, 730 Journaleinträge, Verdichtung in etwa 33 Millisekunden. Das ist eine echte Messung, und sie ist beruhigend – für die **Berechnung**.

Nicht abgesichert ist das **Rendern**: keine Virtualisierung (bewusst zurückgestellt, ADR-konform), und die Habit-Wochenansicht scrollt bei vielen Gewohnheiten horizontal in ihrem eigenen Bereich.

Ebenfalls ungeprüft: sehr lange Aufgabentitel. Das Schema erlaubt 500 Zeichen; `.today-list-copy` setzt `min-width: 0` (verhindert Grid-Überlauf), aber ob der Titel umbricht oder abgeschnitten wird, ist ohne Browser nicht feststellbar.

**Nutzerproblem:** Nach Monaten wächst die Erledigt-Liste unbegrenzt und ohne Suche (C-08). Die Kombination aus „keine Suche" und „keine Virtualisierung" trifft genau denselben Zeitpunkt.

**Häufigkeit:** Erst nach längerer Nutzung – dann aber dauerhaft.

**Empfohlene Lösung:** Vor der Virtualisierung die Suche bauen (C-08) und die Erledigt-Ansicht auf einen Zeitraum begrenzen (Standard: 30 Tage, erweiterbar). Beides zusammen macht Virtualisierung wahrscheinlich überflüssig. Zusätzlich einen Playwright-Test mit einem 200-Zeichen-Titel – das schließt die einzige Lücke, die ich hier nicht selbst schließen konnte.

**Aufwand:** M

---

### 🟢 Niedrig

---

#### C-20 · Tote Kompatibilitäts-Aliase im Token-System

**Beobachtung:** `tokens.css` definiert am Ende zwölf Aliase (`--surface`, `--surface-muted`, `--border`, `--accent`, `--dashboard-card`, `--dashboard-canvas`, `--gradient-hero`, …) für „noch nicht migrierte Flächen". Verifiziert per grep über alle CSS-Dateien: **null Verwendungen**. Die Migration ist abgeschlossen, die Brücke steht noch.

**Nutzerproblem:** Kein Nutzerproblem – ein Wartungsproblem. Beim nächsten Lesen des Token-Systems ist unklar, welche Variable die richtige ist.

**Empfohlene Lösung:** Löschen.

**Aufwand:** S

---

#### C-21 · Zwei Namen für denselben Bereich

**Beobachtung:** `label: "Gewohnheiten"` (Desktop), `shortLabel: "Routinen"` (Mobil). Alle Seitentexte, Überschriften und die Route sagen „Gewohnheiten".

**Nutzerproblem:** Wer zwischen Telefon und Rechner wechselt, sieht zwei Bezeichnungen für dieselbe Sache. Klein, aber vermeidbar.

**Empfohlene Lösung:** Mit Icons (C-18) passt „Routinen" auch auf Desktop, oder „Gewohnheiten" passt auch auf Mobil. Ein Begriff, überall.

**Aufwand:** S

---

#### C-22 · Ad-hoc-Breakpoints ohne Token

**Beobachtung:** Fünf verschiedene Umbruchpunkte: 34, 40, 48, 52, 64 rem – keiner davon benannt. `finance-page.css` nutzt 40 und 52, `dataviz.css` nutzt 48, `styles.css` nutzt 64, `ui.css` einen `max-width: 34rem`.

Positiv anzumerken: `prefers-reduced-transparency` wird an elf Stellen berücksichtigt, `prefers-reduced-motion` an vier. Das ist überdurchschnittlich sorgfältig – die Breakpoint-Unordnung sticht gerade deshalb hervor.

**Nutzerproblem:** Kein direktes. Aber unterschiedliche Umbruchpunkte in benachbarten Bereichen führen zu Layoutsprüngen an verschiedenen Breiten.

**Empfohlene Lösung:** Drei benannte Stufen festlegen (etwa 40 rem = breites Telefon, 52 rem = Tablet, 64 rem = Desktop) und die Ausreißer angleichen. CSS-Variablen funktionieren in Media Queries nicht – daher als Konvention in `UI_GUIDELINES.md` festhalten und per Lint-Regel oder Hygiene-Skript prüfen.

**Aufwand:** M

---

#### C-23 · Dokumentation ist an vier Stellen überholt

**Beobachtung:** Vier verifizierte Abweichungen:

| Dokument | Aussage | Tatsächlich |
| --- | --- | --- |
| `KNOWN_LIMITATIONS.md` | Die dunkle Dashboard-Gestaltung sei noch nicht umgesetzt | Abendrot/Tageslicht sind vollständig da |
| `DEVELOPMENT.md` | Startup-Build rund 145 kB gzip | Gemessen: **150,56 kB** |
| ADR 0008 | Bei Budgetüberschreitung zuerst `PieChart` entfernen | `PieChart` ist längst nicht importiert – die Notfallmaßnahme ist bereits verbraucht |
| ADR 0008 | Budget 180 kB gzip für den Diagramm-Chunk | Gemessen: **179,12 kB** – 99,5 % ausgeschöpft |

Der letzte Punkt ist der wichtigste: **Der Diagramm-Chunk hat 0,88 kB Luft, und der dokumentierte Ausweg existiert nicht mehr.** Jede zusätzliche ECharts-Komponente – ein Kreisdiagramm, eine Legende, ein Datums-Zoom – reißt das Budget sofort.

**Nutzerproblem:** Kein direktes. Aber ADR 0008 gibt eine falsche Sicherheit: Wer die Entscheidung liest, hält einen Puffer für vorhanden, der nicht existiert.

**Empfohlene Lösung:** Die vier Stellen nachziehen. ADR 0008 um einen Nachtrag ergänzen, der den tatsächlichen Stand nennt und die nächste Ausbaustufe benennt – nach meiner Einschätzung: für die vier vorhandenen einfachen Diagramme (Balken, Linie) ist ECharts überdimensioniert; handgeschriebene SVG-Balken wären ein Bruchteil der Größe. Das ist aber eine eigene Entscheidung und kein Auftrag dieses Audits.

Ergänzend: die gemessenen Werte in die CI aufnehmen, damit die Zahlen nicht wieder auseinanderlaufen.

**Aufwand:** S (Doku) · M (mit CI-Prüfung)

---

### C.24 Zusammenfassung nach Schweregrad

| Schweregrad | Anzahl | Befunde |
| --- | --- | --- |
| Kritisch | 3 | C-01, C-02, C-03 |
| Hoch | 7 | C-04 … C-10 |
| Mittel | 9 | C-11 … C-19 |
| Niedrig | 4 | C-20 … C-23 |

---

## D. Wettbewerbsvergleich

Alle Quellen am **07.08.2026** abgerufen. Primärquellen sind mit **[P]** gekennzeichnet, Sekundärquellen mit **[S]**. Wo nur Sekundärquellen vorlagen, steht das bei der jeweiligen Aussage.

---

### D-01 · Todoist

- **Zielgruppe:** Breite Anwenderschaft, Einzelpersonen bis Teams
- **Zentrales Konzept:** Schnelle Erfassung in natürlicher Sprache, Aufgaben fließen in „Heute" und „Demnächst" zusammen
- **Gut gelöst:** Priorität ist keine Dekoration, sondern Sortierschlüssel. In den Ansichten „Heute" und „Demnächst" erscheinen die höchstpriorisierten Aufgaben oben, unterhalb terminierter Aufgaben mit Uhrzeit. Vier Stufen P1–P4, P4 als Vorgabe ohne Farbe. Prioritäten lassen sich beim Tippen direkt im Titelfeld setzen (`p1`).
- **Grenzen:** Kein Habit-Modul, keine Finanzen. Kalenderdarstellung von Filtern nur in bezahlten Tarifen.
- **Relevantes Muster:** Priorität muss die Reihenfolge bestimmen, nicht nur die Farbe. Bei PersonalOS ist das im Kern schon so (`priorityRank` in `queries.ts`) – aber auf dem Dashboard wird nach Rang sortiert und dann bei fünf abgeschnitten (C-05), womit der Nutzen halb verpufft.
- **Nicht übertragbar:** Filterabfragesprache. Für einen Einzelnutzer ohne Projekthierarchie ein Werkzeug ohne Aufgabe.
- **Quellen [P]:** https://www.todoist.com/help/articles/set-a-priority-in-todoist-Wy82Jp · https://www.todoist.com/help/articles/introduction-to-filters-V98wIH

---

### D-02 · TickTick

- **Zielgruppe:** Anwender, die mehrere Werkzeuge in einer App wollen
- **Zentrales Konzept:** Module unter einem Dach – Aufgaben, Kalender, Eisenhower-Matrix, Pomodoro, Gewohnheiten
- **Gut gelöst:** Zwei Dinge. Erstens sind die Zusatzmodule **standardmäßig aus** und werden einzeln in den Einstellungen aktiviert; wer nur Aufgaben will, sieht nur Aufgaben. Zweitens werden Gewohnheiten in der Heute-Ansicht in einem **eigenen Abschnitt unterhalb** der offenen Aufgaben geführt [S] – getrennt, aber am selben Ort.
- **Grenzen:** Gewohnheiten sind erkennbar das Nebenmodul; die tieferen Habit-Auswertungen liegen im Bezahltarif [S].
- **Relevantes Muster:** Das ist der direkteste Vergleichsfall für PersonalOS, weil TickTick dasselbe Grundproblem hat – Aufgaben und Gewohnheiten in einer Ansicht, ohne sie zu vermischen. Die Antwort ist Trennung durch Abschnitte, nicht durch Seiten. PersonalOS macht das auf `/` bereits richtig.
- **Übernehmenswert und noch nicht vorhanden:** Abschaltbare Module. Wer keine Ziele führt, sollte `/ziele` ausblenden können – das entlastet die Navigation stärker als jede Umsortierung.
- **Nicht übertragbar:** Pomodoro und Eisenhower-Matrix. Beide setzen eine Arbeitsweise voraus, die man haben muss, damit sie nützen.
- **Quellen [P]:** https://help.ticktick.com/articles/7054286604315131904 · https://ticktick.com/features · **[S]:** https://tidbits.com/2025/08/14/ticktick-provides-a-focused-daily-task-list-and-more/

---

### D-03 · Things 3

- **Zielgruppe:** Apple-Nutzer mit Anspruch an Ruhe und Gestaltung
- **Zentrales Konzept:** Zeitliche Zonen statt Prioritätsstufen – Heute, Demnächst, Jederzeit, Irgendwann
- **Gut gelöst:** Die Trennung zwischen *wann kann ich anfangen* und *wann muss es fertig sein*. Aufgaben mit künftigem Startdatum verschwinden aus der Sicht und tauchen am Starttag automatisch in „Heute" auf; Projekte mit Startdatum verschwinden solange aus der Seitenleiste. Aufgaben mit Frist bleiben dagegen in „Jederzeit" sichtbar, weil man sie jederzeit angehen kann. „Heute Abend" ist ein eigener Abschnitt am Ende der Heute-Liste.
- **Grenzen:** Nur Apple. Keine Gewohnheiten, keine Finanzen. Einmalkauf je Plattform.
- **Relevantes Muster:** **Das ist der stärkste einzelne Befund dieses Vergleichs für PersonalOS.** Das Datenmodell hat bereits `plannedDate` (wann geplant) und `dueAt` (wann fällig) – beide Felder existieren, werden im Editor erfasst und in `getTaskCalendarDays` sogar gemeinsam ausgewertet. Aber die Oberfläche macht aus der Unterscheidung nichts: `describeTask` sagt „Überfällig", „Hohe Priorität" oder „Für heute geplant" und lässt die Frist unerwähnt. Der konzeptionelle Gewinn liegt schon im Repository und wird nicht gehoben.
- **Nicht übertragbar:** „Irgendwann" als eigene Zone würde neben der bestehenden Inbox eine zweite Halde erzeugen.
- **Quellen [P]:** https://culturedcode.com/things/support/articles/4001304/ · https://culturedcode.com/things/support/articles/2803579/

---

### D-04 · Sunsama

- **Zielgruppe:** Wissensarbeiter mit Überlastungsproblem
- **Zentrales Konzept:** Geführte Tagesplanung am Morgen, geführter Abschluss am Abend
- **Gut gelöst:** Die Kapazitätsprüfung. Jede Aufgabe bekommt eine Zeitschätzung; die App summiert die geplanten Zeiten der Arbeitsaufgaben und vergleicht sie mit einer selbst gesetzten Auslastungsgrenze. Wer sich zu viel vornimmt, sieht es **vor** dem Tag, nicht danach. Der Abendabschluss geht dann die geplanten Aufgaben durch und lässt Unerledigtes verschieben oder verwerfen.
- **Grenzen:** 25 $/Monat, stark auf Berufsarbeit ausgerichtet, Planung nur zwei Wochen im Voraus [S].
- **Relevantes Muster:** PersonalOS erfasst `estimatedMinutes` im Aufgabeneditor, zeigt es auf der Aufgabenkarte – und summiert es nirgends. Eine einzige Summe über die heutigen Aufgaben, verglichen mit einem selbst gesetzten Tagesbudget, ergäbe dieselbe Wirkung ohne jede Modelländerung. Das ist die günstigste hochwertige Verbesserung im ganzen Audit.
- **Nicht übertragbar:** Der geführte Ritualablauf mit Pflichtstationen. `PRODUCT.md` nennt als Ziel: morgens unter zwei Minuten. Ein mehrstufiger Assistent widerspricht dem.
- **Quellen [P]:** https://help.sunsama.com/docs/daily-planning · https://help.sunsama.com/docs/user-settings

---

### D-05 · Habitify

- **Zielgruppe:** Menschen mit mehreren parallelen Gewohnheiten
- **Zentrales Konzept:** Check-in mit klarer Unterscheidung zwischen ausgelassen und gescheitert
- **Gut gelöst:** Drei abgestufte Pausen-Mechanismen statt eines. **Skip** für einen einzelnen Tag – es bedeutet ausdrücklich „ich mache das heute nicht, scheitere aber auch nicht", und die Serie bleibt erhalten. **Off Mode** für geplante längere Pausen wie Urlaub, ebenfalls ohne Serienverlust. **Archivieren** für unbestimmte Zeit unter Erhalt der Historie. Ergänzend gibt es neben der Serie einen **Consistency Index**, der die Abschlussquote über 30/60/90/180 Tage mittelt und ausdrücklich als nachsichtigere Betrachtung beschrieben wird.
- **Grenzen:** Wochen- und Monatsserien nur auf iOS.
- **Relevantes Muster:** Die Abstufung ausgelassen ≠ gescheitert. Bei PersonalOS existiert der Status `skipped`, aber er wirkt wie ein Fehltag (C-09).
- **Nicht übertragbar:** Automatisches Markieren nicht erfasster Gewohnheiten. Wer nichts einträgt, hat nichts entschieden – das automatisch zu deuten, widerspricht der Erklärbarkeitsregel.
- **Quellen [P]:** https://intercom.help/habitify-app/en/articles/11597864-how-to-pause-or-cut-off-your-habits · https://intercom.help/habitify-app/en/articles/6113621-learn-about-streak · https://intercom.help/habitify-app/en/articles/6113616-see-the-progress-of-a-good-habit

---

### D-06 · Loop Habit Tracker

- **Zielgruppe:** Android-Nutzer mit Wunsch nach Datenhoheit
- **Zentrales Konzept:** Statt Serie ein geglätteter Stärkewert
- **Gut gelöst:** Jede Ausführung stärkt den Wert, jeder Fehltag schwächt ihn – aber einzelne Fehltage nach einer langen Phase zerstören den Fortschritt nicht, anders als bei reinen Ketten-Apps. Aus der FAQ des Projekts geht die Kurvenform hervor: Bei niedrigem Stand heben wenige Wiederholungen den Wert schnell, bei hohem Stand bringt jede einzelne weniger. Loop arbeitet vollständig offline, ohne Konto, und exportiert nach CSV und in eine Datenbankdatei.
- **Grenzen:** Nur Android. Oberfläche ist erkennbar von Technikern gestaltet.
- **Relevantes Muster:** Ein geglätteter Wert ist die ehrlichere Darstellung von Gewohnheitsstärke, weil er dem tatsächlichen Verlauf folgt statt einer Alles-oder-Nichts-Regel. Für PersonalOS ist das doppelt naheliegend: Der Life Score arbeitet bereits mit Glättung über mehrere Tage (Wohlbefinden), die Denkweise ist also schon im Haus.
- **Zweite Beobachtung:** Loop besetzt exakt die Nische, die PersonalOS für sich beanspruchen könnte – offline, ohne Konto, exportierbar, werbefrei – und hat damit über 62.000 Bewertungen gesammelt [S]. Das ist ein Beleg dafür, dass Datenhoheit ein Verkaufsargument ist und nicht nur eine Einschränkung.
- **Nicht übertragbar:** Widgets und Benachrichtigungen (bewusst außerhalb des MVP).
- **Quellen [P]:** https://play.google.com/store/apps/details?id=org.isoron.uhabits · https://github.com/iSoron/uhabits · https://github.com/iSoron/uhabits/discussions/689 · **[S]:** Bewertungszahl aus https://medium.com/@wardtylerd/i-tested-10-habit-trackers-in-30-days-8-broke-me-the-same-way-9803ea20b228

---

### D-07 · YNAB

- **Zielgruppe:** Menschen, die aktiv planen statt nachträglich auswerten
- **Zentrales Konzept:** Nullbasiert – jeder Betrag bekommt eine Aufgabe, bevor er ausgegeben wird
- **Gut gelöst:** Die konsequente Trennung von **Kontostand** und **verfügbarem Betrag**. Der Hilfebereich erklärt ausdrücklich, dass Kategoriesalden sagen, was das Geld tun soll, während Kontostände nur sagen, wo es liegt – und dass der Versuch, beides zur Deckung zu bringen, schnell kompliziert wird. Konsequenterweise braucht eine Umbuchung zwischen zwei Konten **keine Kategorie**, weil das Geld beim ersten Eingang bereits einer Kategorie zugewiesen wurde; die Kategoriesalden ändern sich dadurch nicht.
- **Grenzen:** 109 $/Jahr. Deutliche Lernkurve. Umfang weit über dem, was PersonalOS sein will.
- **Relevantes Muster:** Zwei Punkte, beide für Abschnitt C-03 einschlägig. Erstens: „verfügbar" ist eine eigene Größe und niemals der Kontostand. Zweitens: Eine Umbuchung ist weder Einnahme noch Ausgabe – dieselbe Regel, die Actual Budget technisch umsetzt (D-08).
- **Nicht übertragbar:** Der vollständige Umschlagansatz. Wer nur Ausgaben im Blick behalten will, wird von der Zuweisungspflicht überfordert. PersonalOS ist ausdrücklich kein Buchhaltungssystem.
- **Quellen [P]:** https://support.ynab.com/en_us/category-balances-versus-account-balances-an-overview-ryvnKB_Ac · https://www.ynab.com/blog/do-i-have-to-give-every-dollar-a-job · https://support.ynab.com/en_us/auto-assign-a-guide-r1gBNbBJo

---

### D-08 · Actual Budget

- **Zielgruppe:** Technisch versierte Anwender mit Datenschutzanspruch
- **Zentrales Konzept:** Local-first, quelloffen, Umschlagbudgetierung; Daten liegen lokal, Synchronisation ist optional und Ende-zu-Ende-verschlüsselt
- **Gut gelöst:** Die Umbuchung als **verknüpftes Buchungspaar**. Die Dokumentation begründet das ausdrücklich: Zwei getrennte Buchungen könnte die App nicht als eine Umbuchung erkennen und daher auch nicht aus den Auswertungen heraushalten. Deshalb entsteht beim Anlegen einer Umbuchung automatisch die Gegenbuchung im anderen Konto, beide bleiben verbunden, und die Änderung einer Seite wirkt auf die andere. Die Auswertungen behandeln Umbuchungen anschließend als eigene Kategorie, die sich gezielt ein- oder ausschließen lässt.
- **Grenzen:** Rein Finanzen. Selbst zu betreiben, wenn synchronisiert werden soll.
- **Relevantes Muster:** **Der wichtigste Einzelbefund für den Finanzbereich.** Actual ist zugleich der direkteste Architekturvergleich: dieselbe Grundhaltung, dieselben Beschränkungen, dieselbe Zielgruppe – und ein durchdachter Umgang mit genau dem Problem, das PersonalOS derzeit ungelöst lässt.
- **Zweiter relevanter Punkt:** Der Projektname für die eigene Kategorie lautet *local-first*, nicht „offline" oder „ohne Cloud". Die positive Formulierung trägt eine Produktidentität; PersonalOS versteckt dieselbe Eigenschaft in der Fußzeile „Privat auf diesem Gerät".
- **Nicht übertragbar:** Regelmaschine, Bankanbindung, Mehrbenutzerbetrieb.
- **Quellen [P]:** https://actualbudget.org/docs/transactions/transfers/ · https://actualbudget.org/docs/reports/custom-reports/ · https://github.com/actualbudget/actual

---

### D-09 · Monarch Money

- **Zielgruppe:** Haushalte mit mehreren Konten
- **Zentrales Konzept:** Verbundene Konten, automatische Kategorisierung, Vorausschau
- **Gut gelöst:** Wiederkehrendes ist ein **eigener Bereich**, nicht eine Eigenschaft einzelner Buchungen. Der Einstiegsleitfaden ordnet die Bereiche klar zu: Buchungen zeigen das Tagesgeschehen, Berichte und Cashflow zeigen Verläufe, Budgets und Wiederkehrendes dienen der Planung. Auf dieser Grundlage entsteht die Vorausschau, die den Kontostand einige Wochen bis Monate voraus schätzt. Das Dashboard besteht aus Kacheln, die der Nutzer umsortieren und ausblenden kann.
- **Grenzen:** Kostenpflichtig, auf Kontoanbindung angewiesen, Vorausschau nur so gut wie die Vollständigkeit der Konten.
- **Relevantes Muster:** Zwei. Erstens die Trennung von Ist und Plan als **eigener Navigationsbereich** – das ist die saubere Antwort auf C-06. Zweitens: Prognosen werden ausdrücklich als Schätzung geführt und hängen erkennbar an der Datenqualität. Genau diese Kennzeichnung fordert der Auftrag in §7.
- **Nicht übertragbar:** Bankanbindung, Depotverwaltung, Haushaltsfreigabe, Sankey-Diagramme. Und ausdrücklich: die anpassbaren Dashboard-Kacheln. Für einen Einzelnutzer ist eine gut begründete feste Reihenfolge besser als ein Baukasten – Anpassbarkeit ist hier ein Ersatz für eine Entscheidung, die das Produkt selbst treffen sollte.
- **Quellen [P]:** https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch · https://www.monarch.com/features/tracking · **[S]:** https://www.thepennyhoarder.com/budgeting/monarch-money-review/

---

### D-10 · Übersichtsmatrix

| Anbieter | Zielgruppe | Zentrales Konzept | Besonders gut | Grenze | Muster für PersonalOS | Nicht übertragbar |
| --- | --- | --- | --- | --- | --- | --- |
| Todoist | breit | Schnellerfassung, Heute-Ansicht | Priorität sortiert | keine Habits/Finanzen | Priorität als Reihenfolge | Filtersprache |
| TickTick | Alles-in-einem | abschaltbare Module | Habits als Abschnitt unter Aufgaben | Habits nachrangig | Module abschaltbar | Pomodoro, Matrix |
| Things 3 | Apple, Ruhe | Zeitzonen statt Prioritäten | Start ≠ Frist | nur Apple | Start/Frist trennen | „Irgendwann" |
| Sunsama | Wissensarbeit | geführte Tagesplanung | Kapazitätswarnung | teuer, arbeitslastig | Minutensumme heute | Pflichtritual |
| Habitify | Habit-Nutzer | Skip ≠ Fail | drei Pausenarten | iOS-Beschränkungen | Skip erhält Serie | Auto-Markierung |
| Loop | Android, Datenhoheit | Stärkewert | Fehltag ≠ Rücksetzung | nur Android | geglätteter Wert | Widgets |
| YNAB | Planer | nullbasiert | verfügbar ≠ Kontostand | teuer, steile Kurve | Begriffstrennung | Zuweisungspflicht |
| Actual | Technik + Datenschutz | local-first Umschläge | verknüpfte Umbuchung | nur Finanzen | **Umbuchungsmodell** | Regeln, Bankanbindung |
| Monarch | Haushalte | verbundene Konten | Wiederkehrendes als Bereich | kostenpflichtig | Ist/Plan trennen | Bankanbindung, Kachelbaukasten |

---

## E. Gemeinsame Marktstandards

Nur Muster, die bei **mindestens zwei** der oben geprüften Anbieter belegt sind.

### E-01 · Ein „Heute" führt aus allen Quellen zusammen

**Belegt bei:** Todoist [D-01], Things [D-03], TickTick [D-02], Sunsama [D-04]
**Bei PersonalOS:** vorhanden, aber unvollständig (C-04). Es fehlen Finanzen und Ziele.

### E-02 · Ausgelassen ist nicht gescheitert

**Belegt bei:** Habitify (Skip erhält die Serie, Off Mode für längere Pausen) [D-05], Loop (Fehltage senken den Wert, setzen ihn nicht zurück) [D-06]
**Bei PersonalOS:** verletzt (C-09). Der Status existiert, verhält sich aber wie ein Fehltag.

### E-03 · Neben der Serie eine nachsichtigere Kennzahl

**Belegt bei:** Loop (Stärkewert) [D-06], Habitify (Consistency Index über 30–180 Tage) [D-05]
**Bei PersonalOS:** teilweise – die Erfüllungsquote existiert, wird aber nicht als Gegengewicht zur Serie inszeniert.

### E-04 · Eine Umbuchung ist weder Einnahme noch Ausgabe

**Belegt bei:** Actual (verknüpftes Buchungspaar, in Auswertungen ausschließbar) [D-08], YNAB (Umbuchung ohne Kategorie, Kategoriesalden bleiben unverändert) [D-09/D-07]
**Bei PersonalOS:** vollständig abwesend (C-03). **Der klarste Marktstandard, den das Projekt derzeit verfehlt.**

### E-05 · Verfügbar ist eine eigene Größe, nicht der Kontostand

**Belegt bei:** YNAB (Kategoriesalden vs. Kontosalden) [D-07], Actual (Umschläge über tatsächlich vorhandenem Geld) [D-08]
**Bei PersonalOS:** nicht abgebildet – es gibt weder Kontostand noch Verfügbarkeit, nur den Monatssaldo.

### E-06 · Wiederkehrendes wird als eigene Ebene geführt

**Belegt bei:** Monarch (eigener Bereich, Grundlage der Vorausschau) [D-09], Actual (Terminplanungen für wiederkehrende Buchungen) [D-08], Todoist und Things für Aufgaben [D-01, D-03]
**Bei PersonalOS:** nicht vorhanden (C-06).

### E-07 · Prognose wird als Prognose gekennzeichnet

**Belegt bei:** Monarch (Vorausschau erkennbar an Datenvollständigkeit gebunden) [D-09], Actual (Umschläge über vorhandenem statt erwartetem Geld) [D-08]
**Bei PersonalOS:** die Haltung ist vorbildlich vorhanden (`MonthComparison` als `available | unavailable`), es gibt nur noch keine Prognose, auf die sie angewandt würde.

### E-08 · Wann kann ich anfangen ≠ wann muss es fertig sein

**Belegt bei:** Things (Startdatum vs. Frist, mit unterschiedlichem Sichtbarkeitsverhalten) [D-03], Todoist (Datum und Deadline als getrennte Felder, in Filtern unterschiedlich behandelt) [D-01]
**Bei PersonalOS:** **im Datenmodell vorhanden, in der Oberfläche ungenutzt** (D-03). Der günstigste Gewinn im Aufgabenbereich.

---

### E-09 · Was hier ausdrücklich **kein** Standard ist

Zur Abgrenzung – Muster, die nur bei einem Anbieter vorkommen oder deren Nutzen ich nicht belegen kann:

- **Eisenhower-Matrix** (nur TickTick unter den Geprüften) – produktspezifisch
- **Automatische Terminplanung** (Motion; nicht geprüft) – setzt Kalenderanbindung voraus, außerhalb des MVP
- **Anpassbare Dashboard-Kacheln** (nur Monarch) – für einen Einzelnutzer ein Ersatz für eine Produktentscheidung
- **Sankey-Diagramme** (nur Monarch) – sehen beeindruckend aus, beantworten keine Alltagsfrage
- **Serien-Benachrichtigungen** („Du bist bei X Tagen!", Habitify) – genau die künstliche Dringlichkeit, die `PRODUCT.md` §3 ablehnt

---

## F. Gap-Analyse

### F.1 Unbedingt notwendig

| Lücke | Begründung | Bezug |
| --- | --- | --- |
| Settings-Datensatz beim Erststart | Falsche Backup-Warnung, drei tote Felder, Theme außerhalb des Backups | C-01 |
| Währungsprüfung in der Sparziel-Summe | Erfundene Zahl als Tatsache dargestellt | C-02 |
| Umbuchung oder mindestens Verknüpfung Beitrag ↔ Buchung | Doppelzählung bei jedem Sparvorgang | C-03, E-04 |
| Suche in Listen | Testfall „wiederfinden" ist nicht lösbar | C-08 |
| Dashboard-Aufgabenliste ohne stummen Abbruch | Widersprüchliche Zahlen auf derselben Karte | C-05 |

### F.2 Hoher Mehrwert

| Lücke | Begründung | Aufwand |
| --- | --- | --- |
| Wiederkehrende Buchungen als Vorlage mit Bestätigung | Grundlage für Fixkosten, Prognose, „frei verfügbar" | M |
| Ausgaben-Schnellerfassung auf dem Dashboard | Häufigste Aktion, derzeit am weitesten entfernt | S |
| Minutensumme der heutigen Aufgaben | Kapazität aus vorhandenen Daten, keine Modelländerung | S |
| Wochenrückblick als eigene Ansicht | Logik existiert und ist getestet, nur ohne Bühne | M |
| Start-/Fristunterscheidung sichtbar machen | Beide Felder existieren, Konzept ungenutzt | S |
| Skip bricht die Serie nicht mehr | Verletzt eigenes Produktprinzip und Marktstandard | S |
| Finanzsignal im Dashboard | Einziger Bereich ohne jede Tagespräsenz | M |
| Onboarding-Karte im Leerzustand | Erste Minute entscheidet | M |

### F.3 Später sinnvoll

- Wiederkehrende Aufgaben (nach den Buchungsvorlagen – dieselbe Denkweise, mehr Sonderfälle)
- Geglätteter Habit-Stärkewert neben der Serie
- Konten als Entity, echter Kontostand, Nettovermögen aus manuell gepflegten Ständen
- Abschaltbare Module nach TickTick-Vorbild
- Monatsprognose auf Basis von Vorlagen, ausdrücklich als Schätzung
- Erledigt-Ansicht mit Zeitraumbegrenzung
- Pfeiltastennavigation in den Tab-Leisten

### F.4 Nicht empfehlenswert – und warum

| Idee | Warum nicht |
| --- | --- |
| **Automatische Terminplanung** (Motion-Muster) | Ohne Kalenderanbindung raten, ohne Kalender kein Nutzen. Kalender ist ausdrücklich nicht im MVP. |
| **Generative KI über eigenen Daten** | Widerspricht der Erklärbarkeitsregel und dem Local-first-Versprechen. Die deterministischen Insights sind hier die bessere Antwort. |
| **Serien-Benachrichtigungen** | Genau die künstliche Dringlichkeit, die `PRODUCT.md` §3 ablehnt. |
| **Gamification (Punkte, Abzeichen, Level)** | Der Life Score erfüllt den motivierenden Zweck bereits – und zwar erklärbar. Ein zweites Belohnungssystem daneben entwertet ihn. |
| **Sankey- und Kreisdiagramme** | Kreisdiagramme sind bei mehr als drei Kategorien schlecht ablesbar; die vorhandene Rangliste ist überlegen. Zusätzlich: `PieChart` ist in ECharts nicht registriert, und das Chunk-Budget hat 0,88 kB Luft (C-23). Technisch derzeit ohnehin ausgeschlossen. |
| **Drag & Drop zur Tagesplanung** | Auf Touchgeräten fehleranfällig, schlecht mit Tastatur bedienbar, hoher Aufwand. Eine Sortierung nach Priorität leistet dasselbe. |
| **Belege, Dokumente, OCR** | Ausdrücklich außerhalb des MVP; erzeugt Speicher- und Datenschutzfragen, die den ganzen Datenschutzansatz neu aufwerfen würden. |
| **Produktivitäts-Score neben dem Life Score** | Zwei konkurrierende Gesamtwerte. Der Life Score hat bereits einen Fokus-Teilwert. |
| **Cloud-Sync im aktuellen Zustand** | Braucht Konfliktauflösung je Domäne. Vor `v1.0` eine Ablenkung; ADR 0001 hat das richtig entschieden. |
| **Mehrwährungsfähigkeit ausbauen** | Der Umrechnungskurs ist ein Datum, das lokal nicht verfügbar ist. Besser: eine Währung sauber, mit ehrlicher Fehlermeldung bei Abweichung (das ist bereits der Ansatz – er muss nur in C-02 vollständig werden). |

---

## G. Verbesserung des Dashboards

### G.1 Leitgedanke

Das Dashboard beantwortet **eine** Frage: *Was ist heute wichtig?* Alles, was diese Frage nicht beantwortet, gehört in einen Detailbereich. Das bedeutet ausdrücklich: **Kennzahlen, die schweigen, wenn nichts los ist.** Eine Karte, die jeden Tag dasselbe zeigt, wird nach zwei Wochen nicht mehr gelesen.

### G.2 Informationshierarchie

**Ebene 1 – Orientierung (immer sichtbar)**
Datum, Begrüßung, wichtigstes Tagesergebnis. Bleibt wie gehabt; der Hero ist gelungen.
*Ergänzung:* Tagesring erweitern – nicht nur Habit-Quote, sondern erledigte von geplanten Einheiten insgesamt (Aufgaben + Habits). Der Ring ist das prominenteste Element und misst derzeit nur ein Drittel des Tages.

**Ebene 2 – Handeln (immer sichtbar)**
Die drei bis fünf wichtigsten offenen Aufgaben mit Erledigt-Schaltfläche. Bei Kürzung ausdrücklich beschriftet mit Link auf `/aufgaben` (C-05).
Darunter die heute fälligen Gewohnheiten – als eigener Abschnitt, wie bei TickTick (D-02), nicht vermischt.

**Ebene 3 – Erfassen (immer sichtbar)**
Schnellerfassung für **Aufgabe** und **Ausgabe**. Zwei Felder, nicht fünf. Die Ausgabenerfassung braucht Betrag und Kategorie; Datum ist heute, Notiz optional.

**Ebene 4 – Signale (nur bei Auffälligkeit)**
Hier liegt die eigentliche Verbesserung. Eine Zeile pro Signal, höchstens drei, **nur wenn es etwas zu melden gibt**:

| Signal | Erscheint, wenn | Beispieltext |
| --- | --- | --- |
| Budget | eine Kategorie über 80 % oder überschritten | „Restaurant: 82 % des Monatsbudgets nach 12 Tagen" |
| Sparziel | Frist in unter 30 Tagen und Fortschritt unter 80 % | „Notgroschen: Frist in 3 Wochen, 60 % erreicht" |
| Reflexion | nach 18 Uhr und heute kein Journaleintrag | „Der Abend ist ein guter Moment für die Reflexion" |
| Überfällig | mindestens eine überfällige Aufgabe | „3 Aufgaben aus den Vortagen" |
| Kapazität | Minutensumme über dem Tagesbudget | „Heute geplant: 6 h 40 min" |

Wenn nichts zutrifft, ist der Bereich **leer** – und das ist die Botschaft: alles im Rahmen.

**Ebene 5 – Einordnung (kompakt, immer sichtbar)**
Life Score als eine Zahl mit Veränderung und Datenvollständigkeit, verlinkt auf `/insights`. Keine Teilwerte.

### G.3 Notwendige Kennzahlen

Genau vier, mehr nicht:

1. Offene Aufgaben heute (davon überfällig)
2. Fällige Gewohnheiten (davon erfasst)
3. Life Score mit Vollständigkeit
4. Restbudget des Monats – **nur wenn ein Budget gesetzt ist**

### G.4 Bewusst **nicht** angezeigt

| Weggelassen | Begründung |
| --- | --- |
| Einnahmen und Ausgaben des Monats | keine Handlungsrelevanz am Vormittag |
| Sparfortschritt gesamt | ändert sich zu langsam für eine Tagesansicht |
| Ausgaben je Kategorie | Auswertung, keine Entscheidung |
| Teilwerte des Life Score | gehören zur Erklärung, nicht zur Übersicht |
| Zielfortschritt aller Ziele | Wochenrhythmus, nicht Tagesrhythmus |
| Jedes Diagramm | ein Diagramm beantwortet keine Tagesfrage – und spart 179 kB Nachladung |

**Der letzte Punkt ist wichtig:** Das Dashboard darf bewusst **kein** ECharts laden. Es ist die meistbesuchte Route; sie ohne Diagrammbibliothek zu halten, ist der beste Leistungshebel des Projekts.

### G.5 Mobil

Eine Spalte, Reihenfolge wie oben. Schnellerfassung nach der Aufgabenliste, damit der Daumen sie im unteren Drittel erreicht. Signale als kompakte Zeilen mit farbigem Rand links, nicht als Karten – Karten kosten vertikalen Raum, den mobil niemand hat.

### G.6 Desktop

Zweispaltig ab 52 rem:

```text
┌──────────────────────────┬─────────────────┐
│ Hero: Datum, Fokus, Ring │ Kennzahlen (4)  │
├──────────────────────────┼─────────────────┤
│ Aufgaben heute           │ Signale         │
│ Gewohnheiten heute       │ Life Score      │
│ Schnellerfassung         │ Reflexion       │
└──────────────────────────┴─────────────────┘
```

Links das Handeln, rechts das Einordnen. Die rechte Spalte ist schmaler und darf leer laufen – ein ruhiger Tag sieht dann auch ruhig aus.

### G.7 Verhalten bei wenigen Daten

Erster Start: Willkommenskarte statt drei Kacheln mit Nullen (C-10). Zwei Sätze, was die App tut und dass Daten das Gerät nicht verlassen, darunter drei Startaktionen.

Bei ein bis zwei Wochen Nutzung: Kacheln erscheinen, Signale bleiben stumm, der Life Score meldet Unvollständigkeit statt eines niedrigen Werts (das ist bereits richtig gebaut).

### G.8 Verhalten bei vielen Daten

Alle Listen mit klarer Obergrenze und ausdrücklicher Kürzungsangabe. Signale hart auf drei begrenzt, priorisiert nach Dringlichkeit (überschrittenes Budget vor 80-%-Warnung, Frist in 3 Tagen vor Frist in 30 Tagen). Das Dashboard darf niemals mit der Datenmenge wachsen – das ist der Unterschied zwischen einer Übersicht und einem Bericht.

---

## H. Verbesserte Informationsarchitektur

### H.1 Problem

Acht gleichrangige Navigationspunkte, auf Mobil vier plus Überlaufmenü. Vier der acht (Ziele, Finanzen, Insights, Einstellungen) sind auf Mobil nur über zwei Taps erreichbar. Ausgerechnet Finanzen – der Bereich mit einer der häufigsten Erfassungsaktionen – liegt dahinter.

### H.2 Vorschlag

**Vier Hauptbereiche:**

| Bereich | Enthält | Begründung |
| --- | --- | --- |
| **Heute** | Dashboard (Abschnitt G) | Einstieg, meistbesucht |
| **Planen** | Aufgaben, Ziele | Beide beantworten „was tue ich und wofür" |
| **Routinen** | Gewohnheiten, Journal | Beide sind tägliche Selbsterfassung im festen Rhythmus |
| **Geld** | Buchungen, Budgets, Sparziele | Ein zusammenhängender Bereich |

**Zwei Nebenbereiche**, über ein Symbol in der Kopfzeile erreichbar, nicht im Hauptband:

- **Auswertung** (Insights, Life Score, Wochenrückblick) – wird wöchentlich besucht, nicht täglich
- **Einstellungen** (inklusive Backup und lokale Daten)

Damit hat das mobile Band vier Einträge statt fünf, jeder mit Icon und ausgeschriebener Beschriftung – und der Finanzbereich rückt aus dem Überlaufmenü heraus.

### H.3 Was auf welche Ebene gehört

**Aufs Dashboard:** was heute eine Entscheidung auslöst.
**In den Bereich:** was zur Bearbeitung eines Themas nötig ist.
**In die Detailansicht:** was nur einen einzelnen Datensatz betrifft.
**In die Auswertung:** alles, was einen Zeitraum von mehr als einer Woche betrachtet.

### H.4 Zusammenführungen

| Zusammenführung | Begründung |
| --- | --- |
| Ziele → in „Planen" | Ein Ziel ohne Aufgaben ist ein Wunsch; die Verbindung wird sichtbar |
| Journal → in „Routinen" | Der Abendeintrag ist selbst eine tägliche Routine |
| Life Score + Insights + Wochenrückblick → „Auswertung" | Drei Sichten auf dieselbe Frage |
| Komponentenvorschau → aus der Nutzernavigation entfernen | Entwicklerwerkzeug (C-10) |

### H.5 Begriffe

| Bisher | Vorschlag | Grund |
| --- | --- | --- |
| „Gewohnheiten" / „Routinen" | **„Routinen"**, überall gleich | Ein Begriff statt zwei (C-21); kürzer und im Deutschen weniger wertend |
| „Insights" | **„Auswertung"** | Einziger englischer Begriff in einer sonst deutschen Oberfläche |
| „Saldo" | **„Saldo"** – beibehalten | Fachlich korrekt, Kontexttext erklärt ihn bereits |
| „Restbudget" | **„Budget übrig"** | Verständlicher, sobald es beim Budgetblock steht (C-11) |
| „Life Score" | beibehalten | Etabliert, in ADR 0009 definiert, gut erklärt |

---

## I. Designsystem-Empfehlung

**Grundsatz: Das bestehende System bleibt.** Es hat keine grundlegenden Probleme – die Tokens sind semantisch, die Kontrastentscheidungen sind dokumentiert und begründet, die Basiskomponenten decken den Bedarf ab, und die Regel gegen lokale Nachbauten wird eingehalten. Die folgenden Punkte sind Präzisierungen, keine Ersetzung.

### I.1 Typografie

Entscheidung zu Inter treffen und durchziehen (C-14). Bei Selbstauslieferung: variable WOFF2, Latin-Subset, `font-display: swap`, im Precache. Bei Verzicht: Gewichte auf 400/600/700 normalisieren.

Die Skala selbst (xs 0,75 → display `clamp(2rem, 4.5vw, 2.75rem)`) ist gut abgestuft und bleibt.

### I.2 Abstände

Die Leiter `--space-1` bis `--space-16` ist vollständig. Ergänzen: eine kurze Konvention in `UI_GUIDELINES.md`, welche Stufe wofür gilt (innerhalb einer Karte / zwischen Karten / zwischen Abschnitten). Derzeit entscheidet das jede Datei neu.

### I.3 Karten

Drei Stufen festlegen und benennen: `--glass` (Standard), `--glass-strong` (hervorgehoben), `--glass-opaque` (überlagernd, etwa das Überlaufmenü). Diese drei existieren bereits – sie sind nur nirgends als Stufenkonzept dokumentiert.

### I.4 Buttons und Eingabefelder

`--control-height: 2.75rem` gilt **ausnahmslos**, auch in der Kopfzeile (C-16). Varianten bleiben wie gehabt (primär, sekundär, ghost, destruktiv).

### I.5 Farben

Die Datenpalette (`--data-1` bis `--data-6`) hat sechs Werte. Empfehlung: Diagramme auf höchstens **vier** gleichzeitig begrenzen – darüber ist Farbunterscheidung ohnehin unzuverlässig, und die vorhandene Praxis (Beschriftungen neben der Grafik statt Farblegende) ist ohnehin der bessere Weg.

Statusfarben: `--accent-1` für positiv, `--danger` für Überschreitung, `--text-muted` für neutral. Neutral ist der Standardfall – Farbe nur dort, wo sie eine Bedeutung trägt.

### I.6 Statusanzeigen

Jede Anzeige braucht neben der Farbe ein zweites Signal (Text oder Symbol). Das ist derzeit erfüllt (`toSummary()` liefert überall Text) und sollte als Regel festgeschrieben werden.

### I.7 Diagramme

**Vier Regeln:**

1. Kein Diagramm auf dem Dashboard (G.4).
2. Jedes Diagramm hat eine Textzusammenfassung und eine Datengrundlage-Angabe – bereits umgesetzt, beibehalten.
3. Nur Balken und Linie. Kein Kreis, kein 3D, keine Fläche ohne Grund.
4. Vor jedem neuen Diagrammtyp prüfen: Beantwortet eine Zahl oder eine Liste dieselbe Frage? Wenn ja, dann diese.

Zusätzlich: Das Chunk-Budget ist zu 99,5 % ausgeschöpft (C-23). Vor jeder Erweiterung der Diagrammfähigkeiten muss ADR 0008 neu bewertet werden.

### I.8 Icons

Derzeit gibt es keine. Empfehlung: ein kleiner Satz inline-SVG für die Navigation (H.2) – keine Bibliothek. Vier bis sechs Symbole sind wenige hundert Byte und vermeiden eine neue Abhängigkeit, was `AGENTS.md` §4 ohnehin verlangt.

### I.9 Dark Mode

Beide Paletten sind vollständig getrennt definiert; es gibt keine Stellen mit hartkodierten Farben außerhalb von `tokens.css` (geprüft). Nachzuziehen ist nur `theme-color` (C-15).

### I.10 Breakpoints

Drei benannte Stufen statt fünf ad hoc (C-22): 40 rem (breites Telefon), 52 rem (Tablet), 64 rem (Desktop). Als Konvention dokumentieren und im Hygiene-Skript prüfen.

### I.11 Barrierefreiheit

Vorhanden und gut: Skip-Link, `aria-labelledby` auf jeder Seite, `role="tablist"`, Fokusring-Token, `prefers-reduced-transparency` an elf Stellen, `prefers-reduced-motion` an vier, Live-Regionen für Statusmeldungen.

Nachzuziehen: Pfeiltastennavigation in den Tab-Leisten (bereits dokumentiert), Fokusführung im Überlaufmenü (C-17), Bedienelementgröße in der Kopfzeile (C-16).

---

## J. Priorisierte Roadmap

Die vollständige Roadmap mit Akzeptanzkriterien steht in [`personal-os-improvement-roadmap.md`](personal-os-improvement-roadmap.md). Hier die Struktur:

| Phase | Inhalt | Aufwand gesamt |
| --- | --- | --- |
| **1 – Korrektheit** | C-01, C-02, C-03 (Schritt 1), C-05, C-23 | ~1 Woche |
| **2 – Kernabläufe** | C-07, C-08, C-09, C-11, C-12, C-16, C-17 | ~1,5 Wochen |
| **3 – Verbindung** | Dashboard (G), Wochenrückblick, Start/Frist, Kapazität, IA (H) | ~2,5 Wochen |
| **4 – Auswertung** | Wiederkehrende Buchungen, Fixkosten, „frei verfügbar", Prognose | ~2 Wochen |
| **5 – Optional** | Wiederkehrende Aufgaben, Stärkewert, Konten, abschaltbare Module | offen |

**Wichtig zur Reihenfolge:** Phase 1 vor allem anderen. Solange die Sparziel-Summe falsch rechnen kann und jedes Backup eine Warnung erzeugt, ist jede Verbesserung an der Oberfläche Kosmetik über einem Korrektheitsproblem.

---

## K. Konkreter Umsetzungsplan

### K.1 Anzupassende Komponenten

| Datei | Änderung | Befund |
| --- | --- | --- |
| `src/db/lifecycle.ts` | Settings-Seed beim Erststart | C-01 |
| `src/domains/finance/overview.ts` | Währungsprüfung in `summariseSavings` | C-02 |
| `src/app/theme/ThemeProvider.tsx` | Theme aus Settings lesen, localStorage nur als Bootstrap-Spiegel | C-01 |
| `src/app/pages/SettingsPage.tsx` | Währung, Zeitzone, Wochenstart; Komponentenlink entfernen | C-01, C-10 |
| `src/domains/today/pages/TodayPage.tsx` | Kürzungshinweis, Ausgaben-Schnellerfassung, Signale, Life Score | C-04, C-05 |
| `src/domains/finance/pages/FinancePage.tsx` | Aufteilen; Erfassung nach oben | C-07 |
| `src/domains/finance/pages/MonthOverview.tsx` | Restbudget heraus, Sparfortschritt heraus | C-11, C-12 |
| `src/domains/habits/metrics.ts` | Skip bricht die Serie nicht mehr | C-09 |
| `src/app/navigation/*` | Vier Bereiche, Icons, Fokusführung | C-17, C-18, H |
| `src/styles/tokens.css` | Aliase löschen, Inter entscheiden | C-14, C-20 |
| `index.html`, `vite.config.ts` | `theme-color` je Palette | C-15 |
| `src/domains/tasks/components/TaskCard.tsx` | Frist getrennt von Plandatum anzeigen | E-08 |

### K.2 Neue Komponenten

| Komponente | Zweck |
| --- | --- |
| `components/ui/SignalRow.tsx` | Einzeiliges Signal mit Ton und Aktion (G.2 Ebene 4) |
| `domains/finance/components/QuickExpenseForm.tsx` | Zweifeld-Erfassung fürs Dashboard |
| `domains/finance/components/RecurringTemplateList.tsx` | Fällige Vorlagen mit Bestätigung |
| `domains/insights/pages/WeeklyReviewPage.tsx` | Bühne für die vorhandene `weekly-review.ts` |
| `components/ui/SearchField.tsx` | Gemeinsames Suchfeld für alle Listen |
| `domains/today/components/WelcomeCard.tsx` | Erststart-Erklärung |
| `app/navigation/icons.tsx` | Vier bis sechs inline-SVG |

### K.3 Zusammenzuführen oder zu entfernen

- `FinancePage.tsx` aufteilen in Erfassung, Liste, Budgets, Kategorien
- Kompatibilitäts-Aliase in `tokens.css` entfernen (C-20)
- Komponentenvorschau hinter Entwicklungs-Flag
- `describeTask` in `TodayPage.tsx` und die Beschreibungslogik in `TaskCard.tsx` zusammenführen – beide beschreiben denselben Zustand unterschiedlich

### K.4 Datenmodelländerungen

| Änderung | Version | Migration |
| --- | --- | --- |
| Settings-Seed | keine Schemaänderung | nein – Seed zur Laufzeit |
| `savingsContributions.sourceTransactionId?` | v5 | vorwärts, optionales Feld |
| Neue Tabelle `recurringTransactions` | v5 | vorwärts, neue Tabelle |
| `weekStartsOn` auf `1 \| 7` erweitern | v6 | nur falls Wochenstart wirklich einstellbar wird |
| Konten als Entity + `kind: "transfer"` | v7 | **umfangreich** – eigenes ADR, eigener Migrationsplan |

### K.5 Datenerhalt

Alle Migrationen bis v6 sind reine Erweiterungen: neue optionale Felder, neue Tabellen. Bestehende Datensätze bleiben unverändert gültig.

**Für v7 (Konten) gilt gesondert:** Bestehende Buchungen brauchen ein Standardkonto. Die Migration legt ein Konto „Hauptkonto" an und weist alle vorhandenen Buchungen zu. Das ist verlustfrei, aber semantisch eine Annahme – sie gehört ins ADR und muss im Änderungsprotokoll für den Nutzer erklärt werden.

Das Backup-Format braucht bei jeder neuen Tabelle eine Erhöhung von `formatVersion` **und** einen Lesepfad für Version 1 – sonst werden bestehende Backups unlesbar, was dem Kernversprechen widerspräche. `format-compatibility.test.ts` ist der richtige Ort dafür und existiert bereits.

### K.6 Zu ergänzende Tests

| Test | Deckt ab |
| --- | --- |
| `overview.test.ts`: gemischte Währungen in `summariseSavings` | C-02 – **Regressionstest für einen echten Fehler** |
| `lifecycle.test.ts`: Seed legt genau einen Settings-Datensatz an, auch bei Mehrfachstart | C-01 |
| `backup/service.test.ts`: Backup einer normal genutzten Datenbank erzeugt **keine** Warnung | C-01 |
| `metrics.test.ts`: übersprungener Tag bricht die Serie nicht | C-09 |
| E2E `today.spec.ts`: Kürzungshinweis ab sechs Aufgaben | C-05 |
| E2E `finance.spec.ts`: Ausgabe vom Dashboard erfassen | C-07 |
| E2E: Aufgabentitel mit 200 Zeichen bricht kein Layout | C-19 |
| E2E `app.spec.ts`: Überlaufmenü schließt bei Klick außerhalb | C-17 |

### K.7 Umsetzungsreihenfolge

1. **Settings-Seed** – blockiert nichts, entblockt vieles (Theme im Backup, Währung, Zeitzone)
2. **Währungsprüfung** mit Regressionstest – kleinster Aufwand, höchste Korrektheitswirkung
3. **Beitrag-↔-Buchung-Verknüpfung** – beendet die Doppelzählung
4. **Dashboard-Kürzungshinweis** und Dokumentationskorrekturen – Kleinkram, sofort erledigt
5. **Suche** – entschärft das größte Langzeitproblem
6. **Finanzseite umsortieren + Schnellerfassung** – größter Alltagsgewinn pro Aufwand
7. **Skip-Semantik** (mit ADR) – bringt das Produkt mit seinem eigenen Prinzip in Einklang
8. **Dashboard-Umbau** – braucht 1–7 als Grundlage
9. **Wiederkehrende Buchungen** – Grundlage für alles Weitere im Finanzbereich
10. **Navigation** – zuletzt, weil sie am meisten Einarbeitung kostet und am wenigsten dringend ist

---

## Anhang: Quellenverzeichnis

Alle Quellen abgerufen am **07.08.2026**.

**Aufgaben und Produktivität**

- Todoist Hilfe – Prioritäten: https://www.todoist.com/help/articles/set-a-priority-in-todoist-Wy82Jp
- Todoist Hilfe – Filter: https://www.todoist.com/help/articles/introduction-to-filters-V98wIH
- TickTick Hilfe – Einstiegsleitfaden: https://help.ticktick.com/articles/7054286604315131904
- TickTick – Funktionen: https://ticktick.com/features
- TidBITS zu TickTick (Sekundärquelle): https://tidbits.com/2025/08/14/ticktick-provides-a-focused-daily-task-list-and-more/
- Things Support – Today/Upcoming/Anytime/Someday: https://culturedcode.com/things/support/articles/4001304/
- Things Support – Terminierung: https://culturedcode.com/things/support/articles/2803579/
- Sunsama Handbuch – Tagesplanung: https://help.sunsama.com/docs/daily-planning
- Sunsama Handbuch – Einstellungen: https://help.sunsama.com/docs/user-settings

**Gewohnheiten**

- Habitify – Pausieren und Aussetzen: https://intercom.help/habitify-app/en/articles/11597864-how-to-pause-or-cut-off-your-habits
- Habitify – Serien: https://intercom.help/habitify-app/en/articles/6113621-learn-about-streak
- Habitify – Fortschritt: https://intercom.help/habitify-app/en/articles/6113616-see-the-progress-of-a-good-habit
- Loop Habit Tracker – Play Store: https://play.google.com/store/apps/details?id=org.isoron.uhabits
- Loop Habit Tracker – Repository: https://github.com/iSoron/uhabits
- Loop Habit Tracker – FAQ: https://github.com/iSoron/uhabits/discussions/689

**Finanzen**

- YNAB Support – Kategoriesalden vs. Kontosalden: https://support.ynab.com/en_us/category-balances-versus-account-balances-an-overview-ryvnKB_Ac
- YNAB Blog – Regel 1: https://www.ynab.com/blog/do-i-have-to-give-every-dollar-a-job
- YNAB Support – Auto-Assign: https://support.ynab.com/en_us/auto-assign-a-guide-r1gBNbBJo
- Actual Budget – Umbuchungen: https://actualbudget.org/docs/transactions/transfers/
- Actual Budget – Berichte: https://actualbudget.org/docs/reports/custom-reports/
- Actual Budget – Repository: https://github.com/actualbudget/actual
- Monarch – Einstieg: https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch
- Monarch – Funktionen: https://www.monarch.com/features/tracking

**Nicht geprüft und daher nicht als Grundlage verwendet:** Akiflow, Amazing Marvin, Motion, Microsoft To Do, Notion, Streaks, Productive, Fabulous, Way of Life, Finanzguru, Finanzblick, Money Manager, Copilot Money, Wallet, Spendee.
