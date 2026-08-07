# ADR 0010: Deterministische Insights v1

- Status: akzeptiert
- Datum: 2026-08-06
- Bezug: Issue #24
- Regelversionen: `habit-weekday-rhythm-v2` (seit [ADR 0012](0012-skip-keeps-the-streak.md); zuvor `-v1`), `budget-pace-v1`, `task-weekday-pattern-v1`

## Kontext

Ein Insight ist eine Behauptung über das Leben des Nutzers, die er nicht selbst formuliert hat. Genau das macht ihn gefährlicher als den Life Score: Der Score verdichtet sichtbar, ein Insight *interpretiert*. „An Tagen mit wenig Schlaf bist du unproduktiver" klingt wie eine Erkenntnis und ist doch nur eine Korrelation aus wenigen Punkten.

`docs/PRODUCT.md` legt fest: deterministische Regeln, keine generative KI, Beobachtung in neutraler Sprache, Datenbasis und Zeitraum, Mindestanzahl an Beobachtungen, Stärke, optionale Aktion, Ausblenden. `docs/ARCHITECTURE.md` ergänzt: „gemeinsam aufgetreten" statt „verursacht".

Dieses ADR füllt diese Zusagen mit einem Vertrag und drei Regeln. Es beschreibt keine Implementierung.

## Entscheidung

### Vertrag

```ts
type Insight = {
  id: string;
  ruleId: string;
  ruleVersion: string;
  period: { from: string; to: string };
  evidence: Array<{ metric: string; value: number; sourceCount: number }>;
  strength: 'low' | 'medium' | 'high';
  message: string;
  action?: { kind: string; targetId?: string };
};
```

`message` ist ein fertiger deutscher Satz aus der Regel, kein Schlüssel für eine spätere Übersetzung. Die App ist einsprachig; ein Schlüssel würde die Aussage von ihrer Herleitung trennen und wäre beim Prüfen einer Regel nicht mehr lesbar.

### Stabile IDs

```
id = `${ruleId}:${ruleVersion}:${period.from}:${period.to}:${subject}`
```

`subject` ist der Gegenstand der Beobachtung, etwa eine Kategorie-ID, oder leer. Die ID ist absichtlich lesbar und nicht gehasht: Ein ausgeblendeter Datensatz bleibt so auch in einem Export nachvollziehbar.

Gleiche Daten, gleicher Zeitraum und gleiche Regelversion ergeben dieselbe ID. Eine neue Regelversion erzeugt eine neue ID und damit einen neuen Insight — ein Ausblenden aus der alten Version wirkt nicht weiter.

### Stärke und Mindestdaten

| Stärke | Bedeutung |
|---|---|
| `low` | Es liegt zu wenig vor. Der Insight benennt ausschließlich, was fehlt. |
| `medium` | Mindestdaten erreicht, Unterschied über der Schwelle der Regel. |
| `high` | Mindestdaten deutlich übertroffen, Unterschied über der oberen Schwelle. |

**Unterhalb der Mindestdaten entsteht niemals `medium` oder `high`.** Eine Regel darf dann nur einen `low`-Insight erzeugen, der die fehlende Grundlage benennt, oder gar keinen. Das ist der Unterschied zu einer Aussage, die aus drei Datenpunkten eine Regelmäßigkeit macht.

### Die drei Regeln

#### `habit-weekday-rhythm-v1`

- **Zeitraum:** die sechs vollständigen ISO-Wochen vor der Woche des bewerteten Tages.
- **Eingaben:** nicht archivierte Gewohnheiten und ihre Check-ins, über `calculateHabitFulfillment` je Woche getrennt nach Werktagen (Mo–Fr) und Wochenende (Sa–So).
- **Beobachtung:** in wie vielen Wochen die Erfüllungsquote der Werktage über der des Wochenendes lag, und umgekehrt.
- **Mindestdaten:** mindestens **4 Wochen**, in denen beide Gruppen ein Ziel größer null haben, und insgesamt mindestens **20 geplante Einheiten**.
- **Schwellen:** `medium` ab 4 von 6 Wochen in dieselbe Richtung, `high` ab 5 von 6.
- **Satz:** „In 4 der letzten 6 Wochen lag deine Erfüllung an Werktagen höher als am Wochenende."

Wochen ohne Ziel in einer der beiden Gruppen zählen weder im Zähler noch im Nenner. Eine Gewohnheit, die nur samstags fällig ist, erzeugt sonst einen Unterschied, der keiner ist.

Gewohnheiten mit `timesPerWeek` bleiben **außen vor**. Ihr Ziel gilt für die Woche und ist nicht auf Tage verteilt; eine Aufteilung in Werktage und Wochenende würde ein Ziel erfinden, das der Nutzer nie gesetzt hat.

#### `budget-pace-v1`

- **Zeitraum:** der laufende Kalendermonat bis einschließlich des bewerteten Tages.
- **Eingaben:** Budgets des Monats mit `limit > 0` und die Ausgaben derselben Kategorie, über `calculateBudgetUsage`.
- **Beobachtung:** `verbrauchsanteil = spent / limit` im Vergleich zu `zeitanteil = vergangeneTage / TageImMonat`.
- **Auslöser:** `verbrauchsanteil > zeitanteil + 0,15`. Die Marge verhindert, dass ein Wocheneinkauf am Zweiten des Monats schon eine Beobachtung erzeugt.
- **Mindestdaten:** mindestens **8 vergangene Tage** im Monat und mindestens **3 Buchungen** in der Kategorie.
- **Schwellen:** `medium` beim Auslöser, `high` ab `verbrauchsanteil ≥ 1`.
- **Aktion:** `{ kind: 'open-budget', targetId: <categoryId> }`.
- **Satz:** „Nach 20 von 31 Tagen sind 82 % deines Budgets für Lebensmittel gebucht."

Je Kategorie entsteht höchstens ein Insight. Der Satz nennt Zahlen und keine Empfehlung: Er sagt nicht, dass weniger ausgegeben werden soll.

#### `task-weekday-pattern-v1`

- **Zeitraum:** die 28 Tage bis einschließlich des bewerteten Tages.
- **Eingaben:** Aufgaben mit `plannedDate` im Zeitraum, nach ISO-Wochentag gruppiert. Abgebrochene Aufgaben zählen nicht.
- **Beobachtung:** Abschlussquote je Wochentag; genannt werden der stärkste und der schwächste Tag.
- **Mindestdaten:** mindestens **20 geplante Aufgaben** im Zeitraum und mindestens **3 geplante Aufgaben** an beiden genannten Wochentagen.
- **Schwellen:** `medium` ab 0,25 Unterschied, `high` ab 0,5.
- **Satz:** „Von deinen geplanten Aufgaben hast du dienstags 80 % abgeschlossen, freitags 40 %."

Der Satz nennt zwei Wochentage nebeneinander. Er behauptet nicht, dass der Wochentag die Ursache ist.

### Ausblenden

Ausgeblendet wird ein **einzelner Insight über seine ID**, nicht eine Regel. Ein dauerhaftes Stummschalten wäre eine versteckte Einstellung: Der Nutzer würde nach Monaten nicht mehr wissen, warum eine Beobachtung nie erscheint. Ein neuer Zeitraum erzeugt deshalb einen neuen Insight, auch wenn der vorherige ausgeblendet wurde.

Der Datensatz speichert zusätzlich `ruleId`, damit ein späteres Stummschalten je Regel ohne Migration möglich bleibt.

**Ausblenden entfernt ausschließlich die Darstellung.** Es verändert keine Aufgabe, keinen Check-in, keine Buchung. Die Regel läuft weiter und ihr Ergebnis bleibt reproduzierbar.

### Read-only

Ein Regellauf liest ausschließlich. Er kennt keine Uhrzeit außerhalb des übergebenen Tages und der übergebenen Zeitzone, erzeugt keine Benachrichtigung und schreibt nichts — auch keinen Cache. Ein Fehler in einer Regel darf nie eine Quelldatei berühren; er fällt auf die Anzeige zurück und lässt die übrigen Regeln laufen.

### Versionierung

Eine Regel trägt ihre eigene Version. Ein neuer Bezeichner ist Pflicht, sobald sich Eingaben, Zeitraum, Schwellen, Mindestdaten oder der Satz ändern. Regeln werden unabhängig voneinander versioniert; eine Änderung an `budget-pace` lässt `habit-weekday-rhythm` unberührt.

### Backup-Format

Die neue Tabelle `hiddenInsights` erweitert den Export. Das **Backup-Format steigt auf Version 2**.

Ein Import akzeptiert weiterhin Version 1: Dort fehlt `hiddenInsights`, und der Datensatz wird als leere Liste gelesen. Für die in Version 1 bekannten Tabellen bleibt die Prüfung der Datensatzzahlen unverändert streng.

Die Alternative — Version 1 beizubehalten und das fehlende Feld stillschweigend zu ergänzen — wurde verworfen. Zwei verschiedene Formen unter derselben Versionsnummer sind genau der stille Schemafehler, den `docs/PRODUCT.md` ausschließt.

## Nicht-Ziele

- **Keine Kausalität.** Keine Regel formuliert „weil", „führt zu" oder „liegt an". Zwei Werte treten gemeinsam auf, mehr wird nicht behauptet.
- **Keine Prognose.** Keine Hochrechnung, kein „so wirst du den Monat beenden".
- **Keine Empfehlung.** Insbesondere keine finanzielle, medizinische oder psychologische.
- **Keine generativen Texte.** Jeder Satz steht im Quelltext und ist gegen seine Zahlen prüfbar.
- **Kein Druck.** Keine Benachrichtigung, keine Serie, kein Zielwert, keine Dringlichkeitsfarbe.
- **Keine Journalfreitexte.** Regeln lesen keine Reflexionstexte.

## Copy-Leitplanken

Zulässig:

- „In 4 der letzten 6 Wochen lag deine Erfüllung an Werktagen höher als am Wochenende."
- „Für einen Vergleich fehlen noch Daten: Es liegen 2 von mindestens 4 vergleichbaren Wochen vor."
- „Grundlage: 6 Wochen, 34 geplante Einheiten."

Nicht zulässig:

- „Du bist am Wochenende weniger diszipliniert." — eine Eigenschaftszuschreibung.
- „Weil du schlecht geschlafen hast, …" — eine Ursachenbehauptung.
- „Du solltest …" — eine Empfehlung.
- „Achtung" oder ein Warnrot für eine reine Beobachtung.

## Konsequenzen

- Die Regeln sind einzeln testbar und werden gegen durchgerechnete Fixtures geprüft.
- Ein `low`-Insight ist ein regulärer Zustand und muss in der Oberfläche als fehlende Grundlage lesbar sein, nicht als schwaches Ergebnis.
- `hiddenInsights` ist die einzige persistierte Spur eines Insights. Alles andere wird bei jedem Aufruf neu gerechnet.
- Eine Regeländerung ist billig, aber sichtbar: neue Version, neue IDs, alte Ausblendungen laufen ins Leere. Das ist beabsichtigt.
