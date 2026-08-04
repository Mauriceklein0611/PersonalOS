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

## Persistenzvertrag v2

Die interne Dexie-Version `1` legt die folgenden Stores und die für bekannte Queries notwendigen Indizes an. Version `2` ergänzt für bestehende Settings-Datensätze deterministisch `weekStartsOn: 1`; die Store- und Indexstruktur bleibt dabei unverändert. Die Versionsnummer der Datenbank ist unabhängig von der späteren Exportformat-Version.

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

- Ob „Kategorie“ domänenübergreifend oder pro Domain geführt wird. Empfehlung für den MVP: pro Domain, um unpassende Kopplung zu vermeiden.
- Ob ScoreSnapshots täglich persistiert oder bei Bedarf reproduziert werden. Entscheidung vor `v0.4`.
- Ob Exporte später als verschlüsseltes Archiv angeboten werden. Nicht Teil von `v1.0` ohne separates Bedrohungsmodell.
