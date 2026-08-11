# Leistungsbudgets

Stand: 11.08.2026, Issue #28. Die Budgets gelten für einen Bestand, wie er nach mehreren Jahren täglicher Nutzung entsteht.

## Der Bestand, gegen den gemessen wird

`src/test/fixtures/large-dataset.ts` erzeugt ihn deterministisch. Er ist synthetisch und kein Nutzerdatenexport: Jeder Wert entsteht aus dem Laufindex, jeder Text nennt sich selbst synthetisch. Standardgröße — drei Jahre:

| Datensätze | Anzahl |
| --- | --- |
| Aufgaben | 3.285 |
| Check-ins | 16.425 (20 Routinen, lückenhaft) |
| Journaleinträge | 1.095 |
| Buchungen | 3.285 |
| Monatsbudgets | 333 |

Die Lücken sind Absicht. Ein Bestand, in dem jede Routine an jedem Tag einen Eintrag hat, verbirgt genau die Abfragen, die über fehlende Tage stolpern.

## Was gemessen wird und warum

Zwei Größen, beide deterministisch:

- **Abfragen** — wie oft die Ansicht die Datenbank fragt. Diese Zahl findet die N+1-Abfrage: eine Ansicht, die je Routine einmal fragt, wächst hier mit der Zahl der Routinen.
- **Gelesene Datensätze** — wie viele Datensätze die Abfragen aus dem Speicher holen, **vor** jeder Filterung im Anwendungscode. Diese Zahl findet das Zuviel: eine Abfrage, die drei Jahre liest, um sieben Tage zu zeigen.

Eine Zeitmessung wäre die naheliegende dritte Größe und ist als alleiniges Budget untauglich: Sie schwankt auf einem geteilten Läufer so stark, dass ein zusätzlicher vollständiger Tabellendurchlauf darin untergeht. Sie steht deshalb nur als grober Fangzaun daneben.

Das Werkzeug ist `src/test/query-counter.ts`; die Budgets stehen in `src/db/performance-budgets.test.ts` und laufen mit `pnpm test`.

## Abfragebudgets

| Ansicht | Gemessen | Budget |
| --- | --- | --- |
| Tagesübersicht, vollständiger Ladeweg | 4 Abfragen, 4.430 Datensätze | ≤ 4 Abfragen |
| Check-ins der laufenden Woche | 1 Abfrage, 30 Datensätze | 1 Abfrage, ≤ 7 × Routinen |
| Eine Routine, eine Woche | 1 Abfrage, 2 Datensätze | 1 Abfrage, ≤ 7 Datensätze |
| Routinenseite, vollständige Historie | 1 Abfrage, 16.425 Datensätze | 1 Abfrage |
| Journal, eine Woche | 1 Abfrage, 2 Datensätze | 1 Abfrage, ≤ 7 Datensätze |
| Finanzmonat | 3 Abfragen, 54 Datensätze | ≤ 3 Abfragen, < 200 Datensätze |

Die Zahl der Abfragen ist an keiner Stelle mehr von der Zahl der Routinen abhängig.

### Was vorher galt

Derselbe Bestand, derselbe Ladeweg der Tagesübersicht, vor den Änderungen dieses Issues:

| | Vorher | Nachher |
| --- | --- | --- |
| Abfragen | 23 | 4 |
| Gelesene Datensätze | 20.825 | 4.430 |

Drei Ursachen, alle behoben:

1. **Eine Abfrage je Routine.** Tagesübersicht und Routinenseite fragten die Check-ins einzeln ab. Jetzt beantwortet `listEntriesByHabit` dieselbe Frage mit einer Abfrage über den Index auf `localDate`.
2. **Zeitraum erst im Anwendungscode.** `listForHabit` las die vollständige Historie einer Routine und warf sie anschließend weg. Jetzt grenzt der zusammengesetzte Index `[habitId+localDate]` den Zeitraum in der Datenbank ein — sieben statt rund 820 Datensätze.
3. **Monat erst im Anwendungscode.** Buchungen und Journaleinträge wurden vollständig gelesen und danach nach Monat oder Zeitraum gefiltert. Beide nutzen jetzt ihren Index.

Die 4.430 Datensätze der Tagesübersicht sind Aufgaben (3.285), Journaleinträge (1.095), Routinen (20) und die Check-ins der Woche (30). Aufgaben und Journal werden bewusst vollständig gelesen: Der Tagesfortschritt zählt über alle Aufgaben, und „zuletzt erfasste Stimmung" darf nicht an einer Zeitraumgrenze verschwinden. Beides sind kleine Datensätze; ein Zeitraum dafür wäre eine fachliche Änderung und gehört in ein eigenes Issue.

## Start- und Interaktionsbudgets im Browser

`e2e/performance.spec.ts` schreibt zwei Jahre synthetischen Bestand in die IndexedDB der laufenden App und misst danach. Lokal gemessen am 11.08.2026:

| Weg | Gemessen | Budget |
| --- | --- | --- |
| Tagesübersicht öffnen | 108 ms | < 3.000 ms |
| Check-in setzen | 95 ms | < 2.000 ms |
| Finanzbereich öffnen | 255 ms | < 3.000 ms |

Die Grenzen liegen rund zehnfach über dem gemessenen Wert. Sie sollen einen Einbruch um eine Größenordnung fangen und nicht eine Millisekunde bewerten.

## Übertragung und Startgewicht

Das Budget für die erste Übertragung ist das Bundlebudget aus `pnpm check:bundle`; es läuft in der CI und ist in [ADR 0008](decisions/0008-echarts-for-charts.md) begründet. Die Diagrammbibliothek liegt in einem eigenen Chunk und wird nur von Ansichten geladen, die tatsächlich zeichnen — geprüft im Quelltext (`echarts-boundary.test.ts`) und im Browser über den Netzverkehr von Tagesübersicht, Routinen und Aufgaben.

## Bewusst nicht getan

- **Keine Virtualisierung.** Die Listen zeigen gefilterte Ausschnitte, und die gemessenen Zeiten geben keinen Anlass. Virtualisierung kostet Tastaturbedienbarkeit und Auffindbarkeit im Text; sie kommt erst mit einer gemessenen Schwelle, nicht vorsorglich.
- **Keine Telemetrie.** Gemessen wird ausschließlich lokal in Tests. Ein externes Performance-Werkzeug wäre eine Datenweitergabe und widerspricht [ADR 0001](decisions/0001-local-first-pwa.md).
- **Keine Zwischenspeicher für berechnete Werte.** Eine zweite persistierte Wahrheit für Kennzahlen ist ausgeschlossen; die Verdichtung bleibt eine reine Funktion über den gelesenen Bestand.
