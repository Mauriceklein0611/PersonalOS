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

## Persistenzvertrag v3

Die interne Dexie-Version `1` legt die folgenden Stores und die für bekannte Queries notwendigen Indizes an. Version `2` ergänzt für bestehende Settings-Datensätze deterministisch `weekStartsOn: 1`. Version `3` dedupliziert und sortiert bestehende Wochentagpläne; ein historisch akzeptiertes `endDate` vor `startDate` wird entfernt. Die Store- und Indexstruktur bleibt dabei unverändert. Die Versionsnummer der Datenbank ist unabhängig von der späteren Exportformat-Version.

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

Alle Stores verwenden die clientseitig erzeugte UUID `id` als Primärschlüssel. Fachlich eindeutige Kombinationen wie Habit/Tag, Journal/Tag und Budgetmonat/Kategorie besitzen zusätzlich einen eindeutigen Index. Domain-Repositories erweitern den gemeinsamen Metadatenvertrag um ihr eigenes Zod-Schema; rohe Dexie-Zugriffe bleiben auf `src/db/` beschränkt.

Der Voll-Export bildet alle Stores unter ihren unveränderten Namen ab. Die Record-Schemas stehen in `src/db/schemas/domain-records.ts`; Format, Counts und Metadaten in `src/db/backup/format.ts`. Ein Restore prüft IDs, eindeutige Kombinationen sowie Goal-, Habit-, Finanzkategorie- und Sparziel-Referenzen, bevor lokale Daten ersetzt werden.

## Settings

```ts
type Settings = EntityMeta & {
  locale: 'de-DE';
  timeZone: string; // IANA
  theme: 'system' | 'light' | 'dark';
  baseCurrency: string;
  weekStartsOn: 1;
};
```

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
- Erfüllungsquoten zählen `done` gegen die geplanten Tages- oder Wocheneinheiten und weisen `skipped` separat aus. Tages-Streaks folgen den geplanten Tagen, `timesPerWeek` verwendet Wochen-Streaks.
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

Snapshots dienen der Nachvollziehbarkeit, nicht als Quelle für Domainberechnungen. Die genaue Formel wird vor `v0.4` in einem eigenen ADR festgelegt.

## Insight-Präsentation

```ts
type Insight = {
  id: string; // stabil aus Regel + Zeitraum ableitbar
  ruleVersion: string;
  kind: string;
  period: { from: string; to: string };
  evidence: Array<{ metric: string; value: number; sourceCount: number }>;
  strength: 'low' | 'medium' | 'high';
  messageKey: string;
  action?: { kind: string; targetId?: string };
};
```

Insights können überwiegend zur Laufzeit berechnet werden. Nur Nutzeraktionen wie „ausblenden“ benötigen einen persistierten Datensatz.

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
