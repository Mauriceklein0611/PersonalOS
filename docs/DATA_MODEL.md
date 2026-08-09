# Datenmodell v0

Dieses Dokument beschreibt fachliche Kernobjekte vor der Implementierung. Es ist kein fertiges Dexie-Schema. Änderungen an persistierten Feldern müssen hier und gegebenenfalls in einem ADR dokumentiert werden.

## Gemeinsame Konventionen

```ts
type EntityMeta = {
  id: string;          // UUID, clientseitig erzeugt
  createdAt: string;   // ISO-8601-Zeitpunkt in UTC
  updatedAt: string;   // ISO-8601-Zeitpunkt in UTC
  archivedAt?: string; // Soft-Delete, wenn fachlich sinnvoll
};
```

- Texte werden beim Speichern auf fachlich sinnvolle Maximallängen geprüft.
- Kategorien sind stabile IDs; Anzeigenamen können geändert werden.
- Referenzen werden als IDs gespeichert und beim Löschen validiert.
- Abgeleitete Kennzahlen werden normalerweise berechnet statt als zweite Wahrheit gespeichert.

Die gemeinsamen Werte werden in `src/db/types.ts` und `src/lib/` mit Zod validiert. UUIDs sind Version 4, Zeitpunkte besitzen UTC- und Millisekundenpräzision (`YYYY-MM-DDTHH:mm:ss.sssZ`), und reine Kalendertage werden niemals implizit in eine Zeitzone umgerechnet.

## Persistenzvertrag v5

Die interne Dexie-Version `1` legt die folgenden Stores und die für bekannte Queries notwendigen Indizes an. Version `2` ergänzt für bestehende Settings-Datensätze deterministisch `weekStartsOn: 1`. Version `3` dedupliziert und sortiert bestehende Wochentagpläne; ein historisch akzeptiertes `endDate` vor `startDate` wird entfernt. Version `4` legt den Store `hiddenInsights` an. Version `5` ergänzt den eindeutigen Index `&sourceTransactionId` auf `savingsContributions`; bestehende Beiträge tragen kein Quellfeld und bleiben unverändert gültig. Alle Aufstiege sind vorwärtsgerichtet. Die Versionsnummer der Datenbank ist unabhängig von der Exportformat-Version.

| Store | Datensätze |
|---|---|
| `settings` | Settings |
| `tasks` | Tasks |
| `habits`, `habitEntries` | Habits und tägliche Check-ins |
| `journalEntries` | Journaleinträge |
| `goals`, `goalMilestones` | Ziele und Meilensteine |
| `financeCategories`, `transactions`, `monthlyBudgets` | Finanzkategorien, Buchungen und Budgets |
| `savingsGoals`, `savingsContributions` | Sparziele und Beiträge |
| `scoreSettings`, `scoreSnapshots` | versionierte Score-Konfiguration und optionale Snapshots |
| `hiddenInsights` | ausgeblendete Insights; die einzige persistierte Spur einer Regel |

Alle Stores verwenden die clientseitig erzeugte UUID `id` als Primärschlüssel. Fachlich eindeutige Kombinationen wie Habit/Tag, Journal/Tag und Budgetmonat/Kategorie besitzen zusätzlich einen eindeutigen Index. Domain-Repositories erweitern den gemeinsamen Metadatenvertrag um ihr eigenes Zod-Schema; rohe Dexie-Zugriffe bleiben auf `src/db/` beschränkt.

Der Voll-Export bildet alle Stores unter ihren unveränderten Namen ab. Die Record-Schemas stehen in `src/db/schemas/domain-records.ts`; Format, Counts und Metadaten in `src/db/backup/format.ts`. Ein Restore prüft IDs, eindeutige Kombinationen sowie Goal-, Habit-, Finanzkategorie-, Sparziel- und Buchungsreferenzen, bevor lokale Daten ersetzt werden.

Neue Exporte tragen die Formatversion `3`. Sie kann auf einem Sparbeitrag `sourceTransactionId` enthalten. Die Versionen `1` und `2` bleiben lesbar: Version `1` kennt `hiddenInsights` nicht, Version `2` keine verknüpften Beiträge.

## Settings

```ts
type Settings = EntityMeta & {
  locale: 'de-DE';
  timeZone: string; // IANA
  theme: 'system' | 'light' | 'dark';
  baseCurrency: string;
  weekStartsOn: 1;
  dailyCapacityMinutes?: number; // 1 bis 1440, ganzzahlig
};
```

`dailyCapacityMinutes` ist ein freiwilliges Tagesbudget. Fehlt das Feld, ist kein Budget gesetzt — das ist ausdrücklich nicht dasselbe wie null Minuten, und es gibt keine Vorgabe: Ein erfundenes Budget wäre eine Aussage über den Nutzer, die er nie getroffen hat. Weil das Feld optional ist, bleiben alle vor seiner Einführung geschriebenen Datensätze ohne Migration gültig; die Dexie-Version bleibt unverändert.

Es gibt genau einen Settings-Datensatz. Er entsteht beim ersten erfolgreichen Öffnen der Datenbank (`seedSettingsRecord` in `src/db/settings/repository.ts`) mit `locale: "de-DE"`, `theme: "system"`, `baseCurrency: "EUR"`, `weekStartsOn: 1` und der erkannten Zeitzone; ohne belastbare Angabe des Browsers ist das `UTC`. Der Seed ist idempotent und läuft in einer Transaktion, ein zweiter Start legt also keinen zweiten Datensatz an. Ein vorhandener, aber archivierter Datensatz zählt ebenfalls als vorhanden.

Der Datensatz ist Teil jedes Exports. Nach einem Import gelten seine Werte sofort; fehlt er im Backup, entsteht er beim nächsten Lesen neu.

## Tasks

```ts
type Task = EntityMeta & {
  title: string;
  notes?: string;
  status: 'open' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  dueAt?: string;
  plannedDate?: string; // YYYY-MM-DD
  estimatedMinutes?: number;
  categoryId?: string;
  goalId?: string;
  completedAt?: string;
};
```

Invarianten:

- `completedAt` ist nur bei `completed` gesetzt.
- `estimatedMinutes` ist positiv und begrenzt.
- Löschen eines Ziels löscht keine Aufgabe; die Referenz wird nach Bestätigung entfernt.

Im ersten Task-MVP verweist `categoryId` optional auf den kleinen, domänenspezifischen Standardkatalog „Privat“, „Arbeit“ und „Erledigungen“. Die UUIDs sind stabil; Labels werden nicht in Tasks kopiert. Anpassbare Aufgabenkategorien benötigen später einen eigenen Store und eine Migration. Siehe [ADR 0004](decisions/0004-domain-specific-task-categories.md).

## Habits

```ts
type Habit = EntityMeta & {
  name: string;
  description?: string;
  schedule:
    | { kind: 'daily' }
    | { kind: 'weekdays'; days: number[] }
    | { kind: 'timesPerWeek'; count: number };
  startDate: string;
  endDate?: string;
  categoryId?: string;
  goalId?: string;
  color?: string;
};

type HabitEntry = EntityMeta & {
  habitId: string;
  localDate: string;
  status: 'done' | 'skipped';
  note?: string;
};
```

Invarianten:

- Pro Habit und lokalem Tag existiert höchstens ein Entry.
- `skipped` wird nicht automatisch als erfüllt gewertet.
- Streaks werden aus Schedule und Entries berechnet, nicht dauerhaft gespeichert.
- `endDate` liegt nicht vor `startDate`; Wochentage sind eindeutige ISO-Wochentage von Montag (`1`) bis Sonntag (`7`).
- Bei `timesPerWeek` ist jeder aktive Tag für einen Check-in geeignet. Die Gewohnheit bleibt innerhalb der ISO-Woche fällig, bis die Zahl der `done`-Entries erreicht ist.
- „Wieder offen“ entfernt den vorhandenen Tages-Entry; ein dritter persistierter Status entsteht nicht.
- Erfüllungsquoten zählen `done` gegen die zählenden Einheiten — geplante Einheiten ohne die übersprungenen — und weisen `skipped` und die geplanten Einheiten weiterhin separat aus. Tages-Streaks folgen den geplanten Tagen, `timesPerWeek` verwendet Wochen-Streaks.
- Ein `skipped`-Eintrag ist neutral: Er bricht keine Serie und verlängert keine. Ein geplanter Tag ohne Eintrag bricht die Serie und bleibt im Nenner. Siehe [ADR 0012](decisions/0012-skip-keeps-the-streak.md).
- Archivieren verändert weder bestehende HabitEntries noch rückblickend berechnete Kennzahlen.
- Ein Habit speichert genau einen Rhythmus ohne Historie. Eine Änderung lässt erfasste Entries unverändert, verschiebt aber die berechnete Fälligkeit vergangener Tage. Siehe [ADR 0005](decisions/0005-habit-schedule-without-history.md).

## Journal

```ts
type JournalEntry = EntityMeta & {
  localDate: string;
  mood?: number;        // 1..5
  energy?: number;      // 1..5
  stress?: number;      // 1..5
  productivity?: number;// 1..5, optional und subjektiv
  highlight?: string;
  improvement?: string;
  gratitude?: string;
  body?: string;
};
```

Pro lokalem Tag existiert höchstens ein JournalEntry. Alle Skalen sind optional; ein ausgelassenes Feld ist kein negativer Wert.

Invarianten:

- `localDate` ist der fachliche Schlüssel und besitzt einen eindeutigen Index. Ein erneutes Speichern desselben Tages aktualisiert den vorhandenen Datensatz in einer Transaktion.
- Ein entfernter Wert wird auf `undefined` gesetzt und nicht auf einem alten Stand belassen; leere oder nur aus Leerzeichen bestehende Texte werden nicht gespeichert.
- Ein Eintrag ohne jeden Skalen- oder Textwert wird nicht angelegt.
- Der Eintrag wird ausdrücklich gespeichert, nicht automatisch. Siehe [ADR 0006](decisions/0006-journal-saves-explicitly.md).

## Goals und Milestones

```ts
type Goal = EntityMeta & {
  title: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  targetDate?: string;
  progressMode: 'milestones' | 'manual';
  manualProgress?: number; // 0..100
  completedAt?: string;
};

type GoalMilestone = EntityMeta & {
  goalId: string;
  title: string;
  targetDate?: string;
  status: 'open' | 'completed';
  completedAt?: string;
  order: number;
};
```

Bei `milestones` ergibt sich Fortschritt aus abgeschlossenen, nicht archivierten Meilensteinen. Gewichtete Meilensteine sind erst eine spätere Erweiterung.

Invarianten:

- `completedAt` existiert genau dann, wenn der Status `completed` ist. Das gilt für Ziele und Meilensteine und wird im Schema geprüft.
- `manualProgress` gehört ausschließlich zum Modus `manual`. Ein Wechsel auf `milestones` entfernt den Wert, statt ihn unsichtbar mitzuführen.
- Fortschritt wird immer berechnet und nie gespeichert. Archivierte Meilensteine zählen weder im Zähler noch im Nenner, damit Aufräumen die Quote nicht rückwirkend verschlechtert.
- Ein Ziel ohne Meilenstein und ein Ziel ohne Zieldatum sind gültige Zustände. Ohne Grundlage lautet der Fortschritt „Keine Angabe“ und nicht null Prozent.
- Endzustände werden nicht direkt getauscht: Von `completed` oder `cancelled` führt der Weg zuerst zurück nach `active`.
- Archivieren verändert weder Titel, Status noch Meilensteine eines Ziels.
- `goalId` in Task und Habit ist optional und opt-in. Beide funktionieren vollständig ohne Zielbezug; die schnelle Erfassung bekommt kein zusätzliches Pflichtfeld.
- Ein archiviertes Ziel behält seine Verknüpfungen. Erst das endgültige Löschen löst sie auf: In einer Transaktion wird `goalId` bei Tasks und Habits entfernt, die Meilensteine werden gelöscht und danach das Ziel. Aufgaben und Gewohnheiten selbst bleiben erhalten.
- Beim Import wird jede `goalId` gegen die enthaltenen Ziele geprüft, bevor geschrieben wird. Eine unbekannte Referenz bricht die Wiederherstellung ab.

## Finance

```ts
type Money = {
  amountMinor: number;
  currency: string;
};

type FinanceCategory = EntityMeta & {
  name: string;
  kind: 'income' | 'expense';
  color?: string;
};

type Transaction = EntityMeta & {
  kind: 'income' | 'expense';
  money: Money;
  categoryId: string;
  bookedOn: string; // YYYY-MM-DD
  description?: string;
};

type MonthlyBudget = EntityMeta & {
  month: string; // YYYY-MM
  categoryId: string;
  limit: Money;
};

type SavingsGoal = EntityMeta & {
  name: string;
  target: Money;
  targetDate?: string;
  status: 'active' | 'completed' | 'cancelled';
};

type SavingsContribution = EntityMeta & {
  savingsGoalId: string;
  money: Money;
  bookedOn: string;
  note?: string;
  sourceTransactionId?: string; // belegende Ausgabe, siehe ADR 0011
};
```

Invarianten:

- `amountMinor` und Budgetlimits sind nicht negativ; Richtung kommt aus `kind`.
- Alle in einer Aggregation enthaltenen Werte besitzen dieselbe Währung.
- Kategorien mit verwendeten Transaktionen werden archiviert statt hart gelöscht.
- Beträge werden ausschließlich als ganzzahlige Minor Units gerechnet. Die Anzahl der Nachkommastellen wird aus der Währung abgeleitet, nicht auf zwei festgelegt. Ein Saldo ist die ganzzahlige Differenz zweier Summen und niemals ein Gleitkommawert.
- `financeCategories` und `transactions` existieren seit Schema v1. Der erste Umsetzungsstand in #17 brauchte deshalb keine Migration.
- Ohne vorhandene Kategorie legt die Oberfläche einen synthetischen, vollständig editierbaren Startsatz an. Diese Namen sind Beispiele und keine Annahme über die Lebensumstände.
- `monthlyBudgets` besitzt den eindeutigen Index `[month+categoryId]`. Er gilt **datenbankweit**, nicht nur für nicht archivierte Datensätze. Ein Budget wird deshalb endgültig entfernt statt archiviert; ein archivierter Datensatz würde die Kombination dauerhaft blockieren. Die Historie liegt in den Buchungen, nicht im Budget. Das Entfernen bietet ein „Rückgängig“, das denselben Stand wieder setzt.
- Der Budgetverbrauch zählt ausschließlich nicht archivierte Ausgaben derselben Kategorie im gewählten lokalen Monat. Er wird berechnet und nie gespeichert.
- Weicht die Währung einer Buchung vom Budgetlimit ab, wird die Aggregation verweigert und benannt, statt umzurechnen.
- Ein Limit von null ist zulässig; die Quote bleibt dann ohne Angabe statt durch null zu teilen.
- Sparbeiträge sind eigene Datensätze und keine normalen Ausgaben, sofern der Nutzer dies nicht ausdrücklich anders modelliert.
- `sourceTransactionId` verweist auf die Ausgabe, die denselben Betrag bereits abgebildet hat ([ADR 0011](decisions/0011-savings-contribution-links-a-transaction.md)). Die Verknüpfung ist optional; ein Beitrag ohne Verweis bleibt gültig.
- Eine Verknüpfung wird nur angenommen, wenn die Buchung nicht archiviert ist, `kind: "expense"` trägt, dieselbe Währung und denselben `amountMinor` hat, im selben Kalendermonat wie der Beitrag liegt und noch keinen Beitrag belegt. Geprüft und geschrieben wird in derselben Transaktion.
- Der Index `&sourceTransactionId` (Schema v5) ist eindeutig und gilt **datenbankweit**: Auch ein zurückgenommener Beitrag hält seine Ausgabe belegt. Beiträge ohne Verweis tragen den Schlüssel nicht und stehen deshalb nicht im Index.
- Der Restore prüft zusätzlich, dass jede `sourceTransactionId` auf eine enthaltene Buchung zeigt und keine Buchung zweimal belegt ist.
- Der aktuelle Betrag eines Sparziels wird ausschließlich aus seinen Beiträgen berechnet und nie gespeichert. Ein zurückgenommener, also archivierter, Beitrag zählt nicht mehr mit, bleibt aber wiederherstellbar.
- Sparziel und Beiträge verwenden dieselbe Währung. Prüfung und Schreiben laufen in derselben Transaktion; eine Währungsänderung am Ziel wird abgelehnt, solange Beiträge existieren. Weicht ein importierter Beitrag trotzdem ab, wird die Aggregation verweigert und benannt, statt umzurechnen.
- Ein Zielbetrag von null ist zulässig; die Quote bleibt dann ohne Angabe statt durch null zu teilen. Über 100 Prozent wird nicht gekappt: Der offene Betrag ist die ganzzahlige Differenz und wird negativ.
- `targetDate` ist optional. Ein Sparziel ohne Frist ist ein gültiger Zustand und keine unvollständige Eingabe.
- `savingsGoals` und `savingsContributions` existieren seit Schema v1. Der Umsetzungsstand in #19 brauchte deshalb keine Migration.
- Das endgültige Löschen eines Sparziels entfernt seine Beiträge in derselben Transaktion und nennt vorher deren Anzahl. Verwaiste Beiträge entstehen dadurch nicht; der Restore prüft diese Referenz zusätzlich.
- Die Monatsübersicht (`src/domains/finance/overview.ts`) ist eine reine Leseauswertung. Sie wird bei jeder Änderung neu berechnet und niemals gespeichert; keine Buchung wird dabei verändert.
- Sie zählt ausschließlich nicht archivierte Buchungen des gewählten Kalendermonats. Der Sparstand ist dagegen kumulativ und nicht auf den Monat begrenzt, weil ein Sparziel über Monate hinweg wächst.
- `savingsThisMonth` trennt die Beiträge des Monats in `linkedMinor` und `unlinkedMinor`. Ein Beitrag gilt nur als belegt, wenn seine Ausgabe in genau diesem Monat aktiv ist; eine archivierte Buchung steckt nicht mehr in der Monatssumme und deckt den Beitrag deshalb nicht länger. `balanceAfterSavingsMinor` ist der Saldo abzüglich `unlinkedMinor` — belegte Beträge werden nicht erneut abgezogen, weil sie bereits in den Ausgaben stehen.
- Weicht die Währung einer Buchung oder eines Budgets ab, wird die Auswertung verweigert und benannt, statt umzurechnen.
- Fehlen Vormonatsdaten, meldet der Vergleich `unavailable` mit einer Begründung. Eine erfundene Null wäre eine Aussage über einen Monat, für den nichts vorliegt. Liegen die Ausgaben des Vormonats bei null, bleibt die relative Änderung ohne Angabe; die absolute Differenz bleibt gültig.

## Score-Konfiguration und Snapshots

```ts
type ScoreSettings = EntityMeta & {
  enabled: boolean;
  components: Array<{
    key: 'focus' | 'habits' | 'wellbeing' | 'goals' | 'finance';
    enabled: boolean;
    weight: number;
  }>;
};

type ScoreSnapshot = EntityMeta & {
  localDate: string;
  engineVersion: string;
  total?: number;
  completeness: number;
  components: Array<{
    key: string;
    value?: number;
    weight: number;
    sourceCount: number;
  }>;
};
```

Snapshots dienen der Nachvollziehbarkeit, nicht als Quelle für Domainberechnungen. Die Formel steht in [ADR 0009](decisions/0009-life-score-v1.md).

Invarianten:

- Ein Teilwert ist eine Zahl von 0 bis 100 oder `null`. `null` heißt „keine Aussage möglich“ und ist nie dasselbe wie `0`; es senkt den Gesamtwert nicht.
- `total` ist `null`, wenn keine aktivierte Komponente einen Wert liefert. Eine Null würde eine Aussage über einen Zeitraum treffen, für den nichts vorliegt.
- `engineVersion` ist Pflicht. Historische Snapshots werden niemals nachgerechnet; eine Formeländerung erzeugt eine neue Version.
- Der Snapshot speichert die tatsächlich verwendeten Gewichte, damit ein alter Wert auch nach einer Umgewichtung erklärbar bleibt. Eine Gewichtsänderung durch den Nutzer ist keine Versionsänderung.

`scoreSettings` enthält genau einen Datensatz. Er entsteht beim ersten Zugriff mit den Standardgewichten und wird immer vollständig gespeichert, damit eine Teilliste nicht später stillschweigend aus den Standards ergänzt wird. `enabled` ist eine reine Anzeigeentscheidung: Ein ausgeblendeter Score wird weiter berechnet und es wird kein Eintrag verändert.

Die Berechnung liegt in `src/domains/insights/score-engine.ts`, die Verträge in `src/domains/insights/score-model.ts`. Die Oberfläche liest die Quelldaten über `src/domains/insights/score-input.ts`; dieser Vertrag nennt ausschließlich Lesefunktionen der Domänen. Sie ist eine reine Leseauswertung: Sie liest über die Domainfunktionen der Quellbereiche, verändert keinen Datensatz und kennt keine Uhrzeit außerhalb des übergebenen Tages und der übergebenen Zeitzone. `toScoreSnapshotDetails` schreibt den ungerundeten Gesamtwert; gerundet wird ausschließlich für die Anzeige, damit ein alter Snapshot später genauso gerundet wird wie heute.

## Insight-Präsentation

```ts
type Insight = {
  id: string; // `${ruleId}:${ruleVersion}:${from}:${to}:${subject}`
  ruleId: string;
  ruleVersion: string;
  period: { from: string; to: string };
  evidence: Array<{ metric: string; value: number; sourceCount: number }>;
  strength: 'low' | 'medium' | 'high';
  message: string;
  action?: { kind: string; targetId?: string };
};

type HiddenInsight = EntityMeta & {
  insightId: string;
  ruleId: string;
  hiddenAt: string;
};
```

Insights werden bei jedem Aufruf neu gerechnet und nie gespeichert. Nur das Ausblenden braucht einen Datensatz; `hiddenInsights` ist die einzige persistierte Spur. Formeln, Mindestdaten und Schwellen der Regeln stehen in [ADR 0010](decisions/0010-deterministic-insights-v1.md).

Invarianten:

- `strength` ist `low`, wenn die Mindestdaten einer Regel nicht erreicht sind. Unterhalb der Mindestdaten entsteht nie `medium` oder `high`.
- Die ID ist stabil aus Regel, Regelversion, Zeitraum und Gegenstand abgeleitet. Eine neue Regelversion erzeugt neue IDs; eine alte Ausblendung wirkt dann nicht weiter.
- `insightId` ist eindeutig. Ausblenden ist idempotent, und „wieder anzeigen“ entfernt den Datensatz endgültig, damit der Index nicht dauerhaft belegt bleibt.
- Ausblenden entfernt ausschließlich die Darstellung. Es verändert keine Aufgabe, keinen Check-in und keine Buchung.

Ein Regellauf liest ausschließlich. Eine Regel, die fehlschlägt, nimmt die übrigen nicht mit; ihr Bezeichner wird im Ergebnis genannt, statt als „keine Beobachtung“ durchzugehen.

## Referenzen und Löschregeln

| Quelle | Referenz | Beim Archivieren/Löschen |
|---|---|---|
| Task | Goal | Task behalten, Referenz nach Bestätigung lösen |
| Habit | Goal | Habit behalten, Referenz nach Bestätigung lösen |
| HabitEntry | Habit | Entries mit Habit exportierbar halten; Hard-Delete nur bewusst kaskadierend |
| GoalMilestone | Goal | zusammen archivieren |
| Transaction | FinanceCategory | Kategorie archivieren, Referenz behalten |
| MonthlyBudget | FinanceCategory | Budget archivieren oder neu zuordnen |
| SavingsContribution | SavingsGoal | zusammen exportieren; Hard-Delete nur bewusst kaskadierend |

## Offene Entscheidungen
- Ob ScoreSnapshots täglich persistiert oder bei Bedarf reproduziert werden. Entscheidung vor `v0.4`.
- Ob Exporte später als verschlüsseltes Archiv angeboten werden. Nicht Teil von `v1.0` ohne separates Bedrohungsmodell.
