# ADR 0009: Erklärbarer Life Score v1

- Status: akzeptiert, in der Komponente `habits` geändert durch [ADR 0012](0012-skip-keeps-the-streak.md)
- Datum: 2026-08-06
- Bezug: Issue #21
- Engine-Version: `life-score-v1`; seit ADR 0012 gilt `life-score-v2`

> **Nachtrag vom 07.08.2026.** [ADR 0012](0012-skip-keeps-the-streak.md) nimmt bewusst übersprungene Einheiten aus dem Nenner der Habits-Komponente und hebt die Engine-Version auf `life-score-v2`. Betroffen sind der Abschnitt „Gewohnheiten (`habits`)“ und dessen Mindestdaten. Alles Übrige in diesem Dokument gilt unverändert; Snapshots mit `life-score-v1` bleiben gültig und werden nicht nachgerechnet.

## Kontext

Der Life Score verdichtet fünf Bereiche zu einer Zahl. Genau das macht ihn gefährlich: Eine einzelne Zahl über das eigene Leben lädt dazu ein, sie für ein Urteil zu halten. Vor der Implementierung muss deshalb festliegen, was gemessen wird, was bei fehlenden Daten passiert und welche Aussagen ausgeschlossen sind.

`docs/PRODUCT.md` legt bereits fest: Teilwerte zeigen Eingaben, Zeitraum und Gewicht; fehlende Daten senken den Score nicht; Bereiche sind abschaltbar; historische Werte tragen ihre Berechnungsversion. Dieses ADR füllt diese Zusagen mit Zahlen.

Dieses Dokument beschreibt keine Implementierung. Es ist die Vorgabe, gegen die die Engine in einem eigenen Issue gebaut und getestet wird.

## Entscheidung

### Zeitfenster

Der Score wird für einen lokalen Kalendertag berechnet und betrachtet die **sieben Tage bis einschließlich dieses Tages**. Sieben Tage, weil jede Domäne bereits wöchentlich denkt: `timesPerWeek` bei Gewohnheiten, ISO-Wochen in der Auswertung, und ein einzelner Tag schwankt zu stark.

Ausnahme: **Finanzen** verwendet den laufenden Kalendermonat, weil Budgets monatlich definiert sind. Ein Sieben-Tage-Ausschnitt eines Monatsbudgets wäre keine Budgettreue. Diese Abweichung wird in der Oberfläche am Teilwert genannt.

Zeitzone ist die in den Settings hinterlegte; Kalendertage werden nie implizit umgerechnet.

### Wertebereich und fehlende Daten

Jeder Teilwert ist entweder eine Zahl von `0` bis `100` oder `null`.

`null` bedeutet **„keine Aussage möglich“** und ist nie dasselbe wie `0`. Ein Teilwert wird `null`, wenn die Mindestdaten seines Bereichs nicht erreicht sind. Ein `null`-Teilwert geht weder in den Gesamtwert noch in dessen Gewichtssumme ein; er senkt den Score also nicht.

Die Oberfläche zeigt für `null` den Text `Keine Angabe`, niemals `0 %`.

### Komponenten

#### Fokus (`focus`)

- **Eingaben:** Aufgaben mit `plannedDate` im Zeitfenster; `status`, `priority`, `completedAt`.
- **Gewichtung nach Priorität:** `high` = 3, `normal` = 2, `low` = 1.
- **Formel:** `100 × Σ gewicht(erledigt) / Σ gewicht(geplant)`.
- **Abgebrochene Aufgaben** (`cancelled`) zählen weder im Zähler noch im Nenner. Ein Abbruch ist eine Entscheidung, kein Versäumnis.
- **Wertebereich:** 0–100.
- **Mindestdaten:** mindestens **3 geplante Aufgaben** im Zeitfenster, sonst `null`.

Aufgaben ohne `plannedDate` bleiben außen vor. Sie sind eine Sammlung, keine Zusage für diese Woche.

#### Gewohnheiten (`habits`)

- **Eingaben:** im Zeitfenster aktive Gewohnheiten, ihr Rhythmus und ihre Check-ins.
- **Formel:** `100 × done / target`, mit `done` und `target` aus `calculateHabitFulfillment` (`src/domains/habits/metrics.ts`), summiert über alle aktiven Gewohnheiten.
- **Wertebereich:** 0–100.
- **Mindestdaten:** `target ≥ 3` im Zeitfenster, sonst `null`.

Die Definition wird bewusst aus der Habits-Domäne übernommen und nicht neu erfunden. Zwei Erfüllungsquoten mit unterschiedlichen Regeln wären für den Nutzer nicht erklärbar.

Übersprungene Tage bleiben dadurch im Nenner. Das ist eine bewusste Härte: Ein Überspringen ist erfasste Wirklichkeit, keine fehlende Angabe. Die Oberfläche weist übersprungene Tage getrennt aus, damit der Unterschied sichtbar bleibt.

> **Geändert durch [ADR 0012](0012-skip-keeps-the-streak.md), 07.08.2026.** Die Formel lautet seither `100 × done / counted` mit `counted = max(done, target − skipped)`; die Mindestdaten gelten für `counted`. Der Absatz oben beschreibt den Stand von `life-score-v1` und bleibt als Begründung der abgelösten Regel stehen.

#### Wohlbefinden (`wellbeing`)

- **Eingaben:** Journaleinträge im Zeitfenster, Skalen `mood`, `energy`, `stress` (jeweils 1–5).
- **Normalisierung:** `mood` und `energy` → `(wert − 1) / 4`. `stress` wird invertiert → `(5 − wert) / 4`, weil hoher Stress geringes Wohlbefinden bedeutet.
- **Formel:** `100 × Mittelwert aller vorhandenen normalisierten Werte` im Zeitfenster.
- **Wertebereich:** 0–100.
- **Mindestdaten:** mindestens **3 Tage** mit mindestens einem Skalenwert, sonst `null`.

`productivity` bleibt in v1 außen vor. Der Wert überlappt inhaltlich mit Fokus und würde dieselbe Aussage doppelt gewichten.

Eine ausgelassene Skala ist kein Wert. Sie fehlt im Mittelwert und wird nicht als 0 gelesen.

#### Ziele (`goals`)

- **Eingaben:** Ziele mit Status `active`, deren nicht archivierte Meilensteine bzw. `manualProgress`.
- **Formel:** `100 × Mittelwert der Fortschrittsquoten` über alle berücksichtigten Ziele, Quote je Ziel aus `calculateGoalProgress` (`src/domains/goals/progress.ts`).
- **Ausschluss:** Ziele, die **innerhalb des Zeitfensters angelegt** wurden, zählen nicht mit. Sie hatten keine Gelegenheit, Fortschritt zu zeigen; ohne diese Regel würde das Anlegen eines Ziels den Score senken.
- Ziele mit Fortschrittsquote `null` (Modus `milestones` ohne Meilenstein, Modus `manual` ohne Wert) zählen nicht mit.
- **Wertebereich:** 0–100.
- **Mindestdaten:** mindestens **1 berücksichtigtes Ziel** mit einer Quote, sonst `null`.

Dieser Teilwert beschreibt einen **Stand, keine Wochenleistung**: wie weit die aktiven Ziele fortgeschritten sind. Eine Woche ohne Zielfortschritt senkt ihn nicht, ein abgeschlossener Meilenstein hebt ihn dauerhaft. Die Oberfläche formuliert ihn deshalb als „Fortschritt deiner aktiven Ziele“ und nicht als Wochenwert.

#### Finanzen (`finance`)

Zeitraum: laufender Kalendermonat. Der Teilwert ist das Mittel der beiden Unterwerte, die vorliegen.

**Budgettreue** — je Budget des Monats mit `limit > 0`:

```
treue = spent ≤ limit ? 1 : limit / spent
```

Mittelwert über alle Budgets des Monats. Ein Budget von `0` bleibt außen vor, weil eine Quote dort keine Bedeutung hat.

**Sparfortschritt** — je aktivem Sparziel mit `target > 0`:

```
fortschritt = min(1, gespart / ziel)
```

Mittelwert über diese Ziele. Der Sparstand ist kumulativ, siehe `docs/DATA_MODEL.md`.

- **Formel:** `100 × Mittelwert der vorhandenen Unterwerte`. Liegt nur einer vor, zählt nur dieser.
- **Wertebereich:** 0–100.
- **Mindestdaten:** mindestens **ein Budget mit `limit > 0`** oder **ein aktives Sparziel mit `target > 0`**, sonst `null`.

**Der Teilwert bewertet ausschließlich Budgettreue und Sparfortschritt.** Kontostand, Vermögen, Einkommenshöhe und Saldo gehen nicht ein. Wer wenig verdient und sein Budget einhält, erreicht denselben Wert wie jemand mit hohem Einkommen. Weicht eine Währung ab, wird der Teilwert `null` und die Oberfläche benennt den Grund, statt umzurechnen.

### Gewichte und Normalisierung

Standardgewichte:

| Komponente | Gewicht |
|---|---|
| `focus` | 25 |
| `habits` | 25 |
| `wellbeing` | 20 |
| `goals` | 15 |
| `finance` | 15 |

Der Nutzer kann jede Komponente deaktivieren und jedes Gewicht auf eine nicht negative Zahl setzen. Die Summe muss nicht 100 ergeben.

**Gesamtwert:**

```
beitragende = aktivierte Komponenten mit Wert ≠ null und Gewicht > 0
total = Σ (gewicht × wert) / Σ gewicht        über beitragende
```

Ist die Menge der beitragenden Komponenten leer, ist `total` **`null`**, nicht `0`.

Die Normalisierung ist damit implizit und transparent: Der Nenner enthält genau die Gewichte, die auch im Zähler stehen. Eine fehlende Komponente verschiebt das Verhältnis der übrigen nicht.

**Datenvollständigkeit:**

```
completeness = Anzahl beitragender Komponenten / Anzahl aktivierter Komponenten mit Gewicht > 0
```

Deaktivierte Komponenten zählen in keinem der beiden Werte. Wer Finanzen abschaltet, hat deshalb keine Lücke, sondern eine kleinere Grundlage. Sind keine Komponenten aktiviert, ist `completeness` `0` und `total` `null`.

`completeness` steht immer neben dem Gesamtwert. Ein Score aus zwei von fünf Bereichen ist eine andere Aussage als einer aus fünf von fünf.

### Rundung

Teilwerte und Gesamtwert werden erst für die Anzeige auf ganze Zahlen gerundet, kaufmännisch. Gerechnet wird ungerundet, damit die Rundung nicht mehrfach in dieselbe Summe eingeht.

### Versionierung

Jeder Snapshot speichert `engineVersion`. Diese Version ist `life-score-v1`.

Ein **neuer Versionsbezeichner** ist Pflicht, sobald sich eines davon ändert: Eingaben einer Komponente, Formel, Normalisierung, Zeitfenster, Mindestdaten, die Menge der Komponenten oder die Standardgewichte.

Historische Snapshots werden **niemals nachgerechnet**. Ein Wert von gestern bleibt der Wert, der gestern angezeigt wurde. Eine Darstellung, die Snapshots verschiedener Versionen in einem Verlauf zeigt, muss den Versionswechsel sichtbar machen; ohne diese Kennzeichnung ist sie nicht zulässig.

Vom Nutzer geänderte Gewichte sind **keine** Versionsänderung. Der Snapshot speichert die tatsächlich verwendeten Gewichte je Komponente, damit ein alter Wert auch nach einer Umgewichtung nachvollziehbar bleibt.

Eine Änderung an diesem ADR erfolgt als neues ADR, das dieses ablöst.

## Golden-Beispiele

Alle Zahlen sind erfunden. Sie sind die Vorlage für die Fixtures der Engine-Tests.

### 1 — Vollständige Woche

| Komponente | Eingaben | Wert | Gewicht |
|---|---|---|---|
| `focus` | 10 geplant (2 × high, 5 × normal, 3 × low), erledigt: 2 × high, 3 × normal | (6+6)/(6+10+3) = 0,632 | 25 |
| `habits` | `target` 14, `done` 11 | 0,786 | 25 |
| `wellbeing` | 6 Tage, Mittel der normalisierten Werte 0,70 | 0,700 | 20 |
| `goals` | 2 Ziele mit 0,50 und 0,25 | 0,375 | 15 |
| `finance` | Budgettreue 1,0; Sparfortschritt 0,40 | 0,700 | 15 |

```
Zähler = 25×63,158 + 25×78,571 + 20×70,0 + 15×37,5 + 15×70,0
       = 1 578,95 + 1 964,29 + 1 400,00 + 562,50 + 1 050,00 = 6 555,73
Nenner = 25 + 25 + 20 + 15 + 15 = 100
total = 65,56 → angezeigt 66
completeness = 5/5 = 1,0
```

### 2 — Kein Journal geführt

Wie Beispiel 1, aber keine Journaleinträge im Zeitfenster.

```
wellbeing = null                       (Mindestdaten 3 Tage nicht erreicht)
Zähler = 6 555,73 − 1 400,00 = 5 155,73
Nenner = 25 + 25 + 15 + 15 = 80
total = 64,45 → angezeigt 64
completeness = 4/5 = 0,8
```

Der Wert sinkt nur um zwei Punkte, und zwar allein deshalb, weil das Wohlbefinden mit 70 leicht über dem Mittel der übrigen Bereiche lag — **nicht**, weil das Journal fehlt. Ohne die Normalisierung hätte die Lücke wie eine Null gewirkt und den Wert auf 51,56 gedrückt.

### 3 — Erste Nutzung, keine Daten

Alle Komponenten aktiviert, keine Aufgaben, keine Gewohnheiten, kein Journal, keine Ziele, keine Budgets.

```
alle Teilwerte = null
beitragende = {}
total = null
completeness = 0/5 = 0,0
```

Die Oberfläche zeigt `Keine Angabe` und erklärt, welche Daten fehlen. Sie zeigt **nicht** `0` und formuliert keinen Rückstand.

### 4 — Finanzen abgeschaltet

Wie Beispiel 1, aber `finance` ist vom Nutzer deaktiviert.

```
Zähler = 6 555,73 − 1 050,00 = 5 505,73
Nenner = 25 + 25 + 20 + 15 = 85
total = 64,77 → angezeigt 65
completeness = 4/4 = 1,0
```

Die Vollständigkeit bleibt bei 1,0: Eine abgeschaltete Komponente ist keine Lücke, sondern eine Entscheidung.

### 5 — Randfall Mindestdaten

Zwei geplante Aufgaben, beide erledigt; sonst wie Beispiel 1.

```
focus = null                           (2 < 3 geplante Aufgaben)
Zähler = 6 555,73 − 1 578,95 = 4 976,78
Nenner = 25 + 20 + 15 + 15 = 75
total = 66,36 → angezeigt 66
completeness = 4/5 = 0,8
```

Zwei von zwei wären 100 gewesen und hätten den Score auf 74,8 gehoben. Die Mindestdaten verhindern, dass eine dünne Woche den Wert trägt — auch dann, wenn sie ihn verbessert hätte.

### 6 — Randfall Finanzen

Budget 300,00 €, ausgegeben 450,00 €. Ein Sparziel mit 1.000,00 € Ziel, 1.200,00 € gespart.

```
Budgettreue    = 300 / 450 = 0,667
Sparfortschritt = min(1; 1200/1000) = 1,000
finance = (0,667 + 1,000) / 2 = 0,833 → 83,3
```

Die Überschreitung senkt den Wert, ohne ihn auf null zu ziehen. Das Übererfüllen des Sparziels wird bei 1,0 gekappt; sonst könnte ein einzelnes übererfülltes Ziel eine Budgetüberschreitung rechnerisch aufwiegen.

### 7 — Randfall Nullwerte

Alle Aufgaben geplant und keine erledigt, Gewohnheiten `done` 0 bei `target` 7.

```
focus = 0, habits = 0
```

`0` ist hier eine echte Aussage und nicht dasselbe wie `null`: Es lagen Daten vor, und sie sagen aus, dass nichts abgeschlossen wurde. Der Unterschied zu `null` muss in der Oberfläche sichtbar bleiben.

## Nicht-Ziele

- **Keine Diagnose.** Der Score sagt nichts über Gesundheit, psychisches Befinden oder finanzielle Lage aus. Er misst ausschließlich die Nutzung der eigenen Einträge.
- **Keine Kausalität.** Aus einem Zusammenhang zweier Teilwerte wird keine Ursache abgeleitet und keine Empfehlung erzeugt.
- **Kein Vergleich.** Es gibt keine Vergleichswerte anderer Personen, keine Referenzwerte, keine Einordnung wie „gut“ oder „unterdurchschnittlich“.
- **Kein Druck.** Der Score erzeugt keine Benachrichtigung, keine Serie, keine Erinnerung und keinen Zielwert.
- **Keine Vermögensbewertung.** Siehe Finanzkomponente.
- **Keine versteckte Bewertung.** Jeder Teilwert nennt Eingaben, Zeitraum, Gewicht und Datenbasis. Ein Wert ohne Erklärung wird nicht angezeigt.

## Copy-Leitplanken

Der Score ist ein **subjektives Hilfsmittel**, kein Urteil. Die Sprache muss das tragen.

Zulässig:

- „Dein Score für die Woche bis 6. August: 56 von 100.“
- „Grundlage: 4 von 5 Bereichen. Für Wohlbefinden liegen weniger als drei Tage vor.“
- „Fokus 63 — Grundlage: 10 geplante Aufgaben, nach Priorität gewichtet.“
- „Keine Angabe“ für jeden `null`-Wert.

Nicht zulässig:

- „Deine Leistung“, „Deine Bilanz“, „Du liegst zurück“, „Nur 56“.
- Noten, Ampelfarben oder Emoji als alleinige Aussage.
- „Weil dein Schlaf schlecht war, ist dein Fokus gesunken.“ — eine Ursachenbehauptung.
- „0 %“ oder ein leerer Balken für fehlende Daten.
- Eine Aufforderung, den Score zu steigern.

Farbe folgt `docs/UI_GUIDELINES.md`: Sie ergänzt Text und Zahl, trägt keine Aussage allein, und ein niedriger Wert bekommt kein Warnrot.

## Konsequenzen

- Die Engine kann gegen dieses Dokument gebaut und geprüft werden; die Golden-Beispiele werden zu Fixtures.
- Ein Teilwert `null` ist ein regulärer Zustand und muss durch jede Schicht getragen werden — Berechnung, Snapshot, Oberfläche.
- `scoreSnapshots` speichert je Komponente Wert, Gewicht und `sourceCount`, damit ein alter Wert auch nach Konfigurationsänderungen erklärbar bleibt. Das bestehende Schema in `docs/DATA_MODEL.md` reicht dafür aus; eine Migration ist nicht nötig.
- Die Abweichung des Finanz-Zeitfensters muss in der Oberfläche sichtbar sein, sonst widerspricht sie der Zusage, dass jeder Teilwert seinen Zeitraum nennt.
- Formeländerungen sind teuer: Sie verlangen eine neue Version und lassen alte Snapshots unberührt. Das ist beabsichtigt.
