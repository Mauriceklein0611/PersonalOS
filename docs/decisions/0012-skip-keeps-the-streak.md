# ADR 0012: Ein Überspringen bricht die Serie nicht und zählt nicht im Nenner

- Status: akzeptiert
- Datum: 2026-08-07
- Bezug: Issue #70, Audit-Befund C-09, Marktbeleg E-02
- Ändert: [ADR 0009](0009-life-score-v1.md) in der Komponente `habits`; Engine-Version steigt auf `life-score-v2`
- Ändert: [ADR 0010](0010-deterministic-insights-v1.md) in der Regel `habit-weekday-rhythm`; Regelversion steigt auf `habit-weekday-rhythm-v2`

## Kontext

Eine Gewohnheit kennt zwei erfasste Zustände: `done` und `skipped`. Bisher wirkte `skipped` in jeder Auswertung wie ein Fehltag:

- `calculateDailyStreak` setzte die Serie bei allem außer `done` zurück,
- `calculateHabitFulfillment` ließ übersprungene Einheiten im Nenner der Erfüllungsquote,
- die Habits-Komponente des Life Score übernahm diesen Nenner.

Der einzige praktische Unterschied zwischen „übersprungen“ und „gar nicht erfasst“ war, dass der Tag aus der Fälligkeitsliste verschwand. Wer den Status ehrlich pflegte, stand damit schlechter da als jemand, der den Tag einfach liegen ließ.

Diese Härte war dokumentiert und gewollt: `score-view-model.ts` begründete sie mit „Übersprungene Tage bleiben im Nenner, weil sie eine erfasste Entscheidung sind“, ADR 0009 nannte sie „eine bewusste Härte“. Sie widerspricht jedoch `docs/PRODUCT.md` §3, wonach das Produkt keine strafenden Serien führt, und sie steht gegen den belegten Marktstandard, in dem ein Überspringen die Serie erhält.

Die Produktentscheidung wurde am 07.08.2026 in Issue #70 getroffen: **beide** Änderungen, nicht nur die Serie. Die Zwischenlösung — Serie korrigieren, Nenner behalten — wurde ausdrücklich verworfen, weil sie zwei unterschiedliche Bedeutungen desselben Status erzeugt hätte.

## Entscheidung

### Bedeutung der Zustände

| Zustand | Bedeutung | Wirkung auf die Serie | Wirkung auf den Nenner |
|---|---|---|---|
| `done` | erledigt | verlängert sie | zählt |
| `skipped` | bewusst ausgelassen | neutral: weder Bruch noch Verlängerung | zählt **nicht** |
| kein Eintrag an einem geplanten Tag | nicht erfasst | bricht sie | zählt |

Ein Überspringen ist damit keine schwächere Form des Scheiterns, sondern eine eigene Aussage: *Diese Einheit war nicht vorgesehen.* Nicht erfasst bleibt dagegen das, was es ist — eine offene, verstrichene Einheit.

### Erfüllungsquote

`calculateHabitFulfillment` liefert zusätzlich `counted`:

```
counted = max(done, target - skipped)
rate    = counted === 0 ? null : done / counted
```

`target` bleibt unverändert die Zahl der geplanten Einheiten und wird weiterhin ausgewiesen. `skipped` bleibt getrennt sichtbar. Neu ist allein, dass die Quote gegen `counted` rechnet.

Die Untergrenze `max(done, …)` ist bei `daily` und `weekdays` wirkungslos, weil ein Tag entweder erledigt oder übersprungen ist. Sie greift bei `timesPerWeek`: Dort können in derselben Woche Einheiten erledigt und Tage übersprungen sein, und ohne diese Grenze käme eine Quote über 100 % heraus.

Sind alle geplanten Einheiten übersprungen, ist `counted` gleich `0` und die Quote `null` — „Keine Angabe“, niemals `0 %`. Das ist derselbe Umgang mit fehlender Grundlage wie überall sonst.

### Serien

**Tages-Serie.** Ein übersprungener geplanter Tag wird übergangen: Die laufende Serie bleibt bestehen, wird aber nicht länger. Nur ein geplanter Tag ohne Eintrag setzt sie zurück. Die Karenz für den heutigen Tag bleibt unverändert.

**Wochen-Serie (`timesPerWeek`).** Übersprungene Einheiten senken das Wochenziel:

```
required = max(0, ziel − übersprungen)
Erfolg   = required > 0 und erledigt ≥ required
neutral  = required === 0
```

Eine neutrale Woche zählt weder als Erfolg noch als Bruch. Ohne diese Unterscheidung würde eine vollständig übersprungene Woche die Serie **verlängern** — ein Überspringen darf eine Serie erhalten, aber nie aufbauen.

### Life Score

Die Habits-Komponente rechnet `100 × done / counted` und wendet ihre Mindestdaten (drei Einheiten) auf `counted` an, nicht mehr auf `target`. Eine fast vollständig übersprungene Woche trägt den Teilwert damit nicht, statt ihn zu verzerren.

Die Evidenz nennt weiterhin `target`, `done` und `skipped` und zusätzlich `counted`. Alle vier stehen in der Oberfläche.

Damit ändern sich die Eingaben und die Formel einer Komponente. Nach der Versionsregel aus ADR 0009 ist ein neuer Bezeichner Pflicht: **`life-score-v2`**.

### Deterministische Insights

Die Regel `habit-weekday-rhythm` vergleicht Erfüllungsquoten von Werktagen und Wochenende. Sie rechnet ebenfalls gegen `counted` und vergleicht eine Hälfte der Woche nur dann, wenn dort zählende Einheiten vorliegen. Nach der Versionsregel aus ADR 0010 steigt die Regelversion auf **`habit-weekday-rhythm-v2`**; bestehende Ausblendungen der v1-Insights laufen ins Leere. Das ist die dort ausdrücklich vorgesehene Folge einer Regeländerung.

### Auswirkung auf bestehende Daten

- **Keine Migration.** Es ändert sich keine persistierte Form; `HabitEntry` bleibt unverändert.
- **Bestehende Score-Snapshots bleiben gültig und werden nie nachgerechnet** (ADR 0009). Sie tragen `life-score-v1` und behalten den Wert, der am jeweiligen Tag angezeigt wurde.
- Ein Verlauf, der Snapshots beider Versionen zeigt, muss den Versionswechsel sichtbar machen. Diese Zusage aus ADR 0009 gilt unverändert und wird mit dieser Entscheidung erstmals praktisch relevant.
- Serien und Quoten werden ohnehin bei jedem Aufruf neu gerechnet. Sie ändern sich für vergangene Zeiträume rückwirkend — das ist beabsichtigt und für den Nutzer die Korrektur einer Benachteiligung, nicht der Verlust eines Werts.

## Golden-Beispiele in `life-score-v2`

Die Beispiele aus ADR 0009 gelten unverändert für `life-score-v1`. Für `life-score-v2` ändern sich alle Werte, an denen die Habits-Komponente beteiligt ist. Das Fixture aus Beispiel 1 enthält 14 geplante Einheiten, 11 erledigte und eine übersprungene; `counted` ist damit 13.

```
habits = 100 × 11 / 13 = 84,615384…      (zuvor 100 × 11 / 14 = 78,571428…)
```

| Beispiel | `total` v1 | `total` v2 | angezeigt v2 |
|---|---|---|---|
| 1 — vollständige Woche | 65,557330… | 67,068319… | 67 |
| 2 — kein Journal geführt | 64,446663… | 66,335399… | 66 |
| 4 — Finanzen abgeschaltet | 64,773330… | 66,550964… | 67 |
| 5 — Randfall Mindestdaten | 66,357142… | 68,371794… | 68 |

Die Beispiele 3, 6 und 7 bleiben unverändert: Sie enthalten keine übersprungenen Einheiten. Beispiel 7 bleibt auch inhaltlich gültig — `done` 0 bei `counted` 7 ist weiterhin eine echte Null und keine fehlende Angabe.

Zusätzlich gilt: Sind alle geplanten Einheiten übersprungen, ist `counted` gleich `0` und der Teilwert `null` — die Mindestdaten sind dann nicht erreicht.

## Verworfene Alternativen

**Nur die Serie korrigieren, den Nenner behalten.** Dann bedeutete derselbe Status an zwei Stellen Unterschiedliches: für die Serie neutral, für die Quote ein Fehltag. Genau diese Doppeldeutigkeit ist der Grund, warum die bisherige Regel als Härte auffiel.

**Ein Überspringen als erledigt werten.** Das erfände Erfüllung, die es nicht gab, und widerspräche der Invariante in `docs/DATA_MODEL.md`, dass `skipped` nicht automatisch als erfüllt gilt.

**Ein Überspringen die Serie verlängern lassen.** Eine Serie wäre dann durch Nichtstun aufbaubar und verlöre jede Aussage.

**Ein geglätteter Stärkewert statt der Serie.** Bleibt eine eigene, optionale Entscheidung (Roadmap Phase 5) und braucht ein eigenes ADR. Er ersetzt die Serie nicht.

## Konsequenzen

- `HabitFulfillment` trägt ein zusätzliches Feld `counted`. Jede Auswertung, die eine Erfüllungsquote bildet, verwendet es — Habits-Karte, Wochenrückblick, Life Score und Insight-Regel rechnen dieselbe Quote.
- Die Oberfläche muss den Unterschied zwischen „übersprungen“ und „nicht erfasst“ benennen. Ohne diese Erklärung wäre eine Quote, die weniger Einheiten zählt als geplant waren, nicht nachvollziehbar.
- Ein Überspringen ist damit ein nützliches Werkzeug statt einer stillen Strafe. Das erhöht die Wahrscheinlichkeit, dass der Status überhaupt gepflegt wird — und damit die Datenqualität.
- Diese Entscheidung ersetzt ADR 0009 nicht. Alles dort Festgelegte gilt weiter, mit Ausnahme der Habits-Komponente und der Engine-Version.
