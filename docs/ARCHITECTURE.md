# Architektur

## 1. Architekturziele

PersonalOS wird als local-first Progressive Web App entwickelt. Das technische Design optimiert für:

- verlässliche Offline-Nutzung;
- transparente Datenhoheit und Wiederherstellung;
- kleine, unabhängig testbare Domänen;
- eine schnelle mobile Oberfläche;
- spätere Erweiterbarkeit ohne frühes Backend;
- nachvollziehbare Berechnungen und Migrationen.

## 2. Systemkontext im MVP

```text
┌──────────────────────────────────────────────────────┐
│ Browser / installierte PWA                           │
│                                                      │
│ React UI → Domain Services → Repositories → IndexedDB│
│      │             │                    │            │
│      └──── Queries/Insights (read-only) ┘            │
│                                                      │
│ Service Worker: statische App-Dateien / Offline-Start│
└───────────────────────────┬──────────────────────────┘
                            │ explizite Nutzeraktion
                            ▼
                   JSON-Export / JSON-Import
```

Es gibt im MVP keinen Anwendungsserver. Der Service Worker cached nur die App-Shell und statische Assets. Nutzerdaten liegen in IndexedDB und werden nicht in den Cache geschrieben.

## 3. Schichten

### UI und App-Shell

- Routing, responsives Layout, Theme und globale Fehlerbehandlung;
- Top-Level-Seiten werden als unabhängige Route-Module lazy geladen;
- die Theme-Präferenz nutzt vor der Settings-Repository-Schicht den begrenzten Bootstrap-Spiegel aus [ADR 0002](decisions/0002-theme-bootstrap-mirror.md);
- domänenneutrale, typisierte Basiskomponenten liegen unter `src/components/ui/` und verwenden die semantischen Tokens aus `src/styles/tokens.css`;
- Seiten und Formulare pro Domain;
- keine direkte Dexie-Nutzung aus React-Komponenten;
- UI-Zustand wie offene Dialoge kann in Zustand liegen, persistente Domainobjekte nicht.

### Domain

- Typen, Invarianten und reine Berechnungen;
- Commands für Änderungen und Queries für Ansichten;
- keine Browser- oder React-Abhängigkeit in Geschäftslogik;
- domainübergreifende IDs statt eingebetteter Kopien.

### Persistenz

- Dexie-Tabellen und versionierte Migrationen;
- Repository-Interfaces für Domainzugriff;
- Transaktionen für zusammengehörende Änderungen;
- Zod-Schema-Validierung an jeder Repository-Schreib- und Lesegrenze sowie beim Import;
- typisierte Persistenzfehler (`validation`, `not-found`, `conflict`, `storage`, `transaction`) ohne Logging von Datensatzinhalten.

### Auswertung

- schreibgeschützte Query-Services;
- deterministische Score- und Insight-Funktionen;
- expliziter Zeitraum und Zeitzone;
- keine Änderung der Quelldaten durch berechnete Ergebnisse.

## 4. Geplante Ordnerstruktur

```text
src/
  app/
    App.tsx
    router.tsx
    providers/
    layouts/
  components/
    ui/
    feedback/
    forms/
  db/
    schema.ts
    migrations/
    repositories/
    backup/
  domains/
    tasks/
      model.ts
      repository.ts
      service.ts
      queries.ts
      components/
      pages/
      *.test.ts
    habits/
    journal/
    goals/
    finance/
    insights/
  lib/
    dates/
    money/
    validation/
  test/
    factories/
    setup.ts
e2e/
docs/
```

## 5. Datenfluss

### Schreiben

```text
Formular → Zod/Input-Validierung → Domain Command
         → Repository-Transaktion → IndexedDB
         → Live Query invalidiert/aktualisiert UI
```

### Lesen

```text
IndexedDB → Repository/Query Service → View Model → React UI
```

View Models dürfen formatierte Texte und aggregierte Werte enthalten. Persistierte Domainobjekte bleiben unabhängig von Darstellung und Sprache.

## 6. Local-first und Offline

- Nach dem ersten Laden müssen alle MVP-Kernflüsse ohne Netzwerk funktionieren.
- Die App zeigt keine irreführende Cloud-Synchronisation an.
- Aktualisierungen des Service Workers werden kontrolliert aktiviert, damit eine laufende Eingabe nicht verloren geht.
- Der Build erzeugt Manifest und Service Worker. In den Precache gelangen ausschließlich die App-Shell, gehashte JavaScript-/CSS-Bundles sowie statische Icons; Runtime-Caching ist deaktiviert.
- IndexedDB-Datensätze, Journalinhalte, JSON-Exporte, Imports und mögliche spätere API-Antworten werden niemals in den Service-Worker-Cache geschrieben.
- Ein Navigations-Fallback auf die gecachte `index.html` macht auch lazy geladene Routen nach dem ersten vollständigen Laden offline startbar.
- Eine wartende Version übernimmt erst nach „Jetzt aktualisieren“ per `SKIP_WAITING` und anschließendem Neuladen. „Später“ lässt die laufende Version und ungespeicherte Eingaben unangetastet.
- Der sichtbare Netzwerkstatus kombiniert Browserereignisse mit einem inhaltsfreien, nicht gecachten Same-Origin-HEAD-Check. Sein Ergebnis beeinflusst keine lokale Aktion und überträgt keine Nutzerdaten.
- Persistente Änderungen werden bestätigt, nachdem die lokale Transaktion erfolgreich war.
- Bei Quota- oder IndexedDB-Fehlern erhält der Nutzer eine klare, nicht beschönigende Meldung mit Export-/Recovery-Hinweis.
- Private/Inkognito-Modi und Browser-Speicherlöschung werden in der Hilfe als Datenrisiko erklärt.

## 7. Backup- und Importformat

Ein Export ist ein UTF-8-JSON-Dokument mit:

```ts
type PersonalOsExport = {
  format: 'personalos';
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  data: {
    settings: Settings[];
    tasks: Task[];
    habits: Habit[];
    habitEntries: HabitEntry[];
    journalEntries: JournalEntry[];
    goals: Goal[];
    goalMilestones: GoalMilestone[];
    financeCategories: FinanceCategory[];
    transactions: Transaction[];
    monthlyBudgets: MonthlyBudget[];
    savingsGoals: SavingsGoal[];
    savingsContributions: SavingsContribution[];
    scoreSettings: ScoreSettings[];
    scoreSnapshots: ScoreSnapshot[];
  };
};
```

Importablauf:

1. Datei einlesen, aber noch nichts schreiben.
2. Dateigröße und JSON-Struktur prüfen.
3. `format`, Version und alle Records mit Zod validieren.
4. Vorschau mit Anzahl, Zeitraum und Konflikten anzeigen.
5. Nutzer wählt Ersetzen oder – erst wenn implementiert – Zusammenführen.
6. Nach der Bestätigung und vor dem Ersetzen automatisch einen Sicherungsexport herunterladen.
7. In einer Transaktion importieren.
8. Counts und referenzielle Integrität erneut prüfen.

Im ersten MVP unterstützt der Import nur „bestehende lokale Daten vollständig ersetzen“. Merge wird nicht nebenbei implementiert, da Konfliktsemantik pro Domain festgelegt werden muss.

Formatversion `1` wird vollständig mit Zod validiert und ist auf 10 MB begrenzt. Counts, eindeutige Schlüssel und bekannte Referenzen müssen vor und nach dem Restore übereinstimmen. Der Dateiname folgt `personalos-backup-<UTC-Zeitstempel>.json` und enthält keine Record-Inhalte.

## 8. Schema-Migrationen

- Versionen werden zentral in `src/db/migrations/index.ts` registriert; jede Datenänderung liegt in `v<version>-<slug>.ts`.
- Jede Schemaänderung erhöht die Dexie-Version.
- Migrationen sind vorwärtsgerichtet und deterministisch.
- Eingabe und Ergebnis einer Migration werden mit Zod validiert; ein Fehler bricht die Upgrade-Transaktion vollständig ab.
- Vor einer Migration wird kein automatischer Upload ausgelöst.
- Fixtures mindestens der vorherigen unterstützten Version werden in Tests migriert.
- Bei einem Fehler bleibt die vorherige Datenbank nach Möglichkeit unverändert; die UI erklärt Recovery-Schritte.
- Der Router wird erst nach erfolgreichem Öffnen der aktuellen Datenbank angezeigt. Ein Reset erfolgt nie automatisch und benötigt eine ausdrückliche Bestätigung.
- Exportformate und interne Datenbankversionen sind getrennt versioniert.

Die Entscheidung und ihre Konsequenzen sind in [ADR 0003](decisions/0003-forward-database-migrations-and-recovery.md) festgehalten.

## 9. Zeit, Tage und Zeitzonen

- Zeitpunkte: ISO 8601 in UTC, z. B. `2026-08-03T08:30:00.000Z`.
- Lokale Kalendertage: `YYYY-MM-DD`, z. B. für Journal und Habit-Check-in.
- Einträge speichern bei Bedarf die damals verwendete IANA-Zeitzone.
- Wiederholungsregeln werden in der Nutzerzeitzone ausgewertet.
- Tageswechsel, Sommerzeit und Reisen benötigen explizite Tests.

## 10. Geld

- Beträge als Integer in Minor Units, z. B. `1099` für 10,99 EUR.
- unterstützter ISO-4217-Währungscode in Großbuchstaben je Datensatz bzw. klar definierter Basiswährung.
- Keine Gleitkommaarithmetik für Summen.
- Im MVP keine automatische Währungsumrechnung.
- Korrekturen werden nachvollziehbar geändert; spätere Audit-Anforderungen können ein Ledger erforderlich machen, sind aber nicht Teil des MVP.

## 11. Life Score und Insights

Scoreberechnung ist eine pure Funktion:

```ts
type ScoreResult = {
  version: string;
  period: { from: string; to: string };
  total: number | null;
  completeness: number;
  components: Array<{
    key: string;
    value: number | null;
    weight: number;
    inputs: Array<{ metric: string; value: number; sourceCount: number }>;
  }>;
};
```

- `null` bedeutet nicht genug Daten und wird nicht als Null-Leistung behandelt.
- Gewichte werden nur über Komponenten mit ausreichenden Daten normalisiert.
- Historische Snapshots speichern die Berechnungsversion.
- Insight-Regeln erhalten nur notwendige, aggregierte Daten.
- UI formuliert „gemeinsam aufgetreten“ statt „verursacht“, solange keine kausale Evidenz existiert.

## 12. Sicherheit und Datenschutz

- Keine Analytics, Telemetrie oder externen Fonts im MVP.
- Eine früh im Dokument gesetzte CSP erlaubt Skripte, Worker, Manifest, Bilder und Verbindungen nur vom eigenen Origin. Frames, Medien und Objekte sind gesperrt. Inline-Skripte sind nicht erlaubt; `style-src 'unsafe-inline'` bleibt vorerst die eng begrenzte Ausnahme für dynamische UI-Maße und die Vite-Entwicklung.
- Keine unbereinigte HTML-Ausgabe aus Notizen oder Importen.
- Nutzertext wird ausschließlich als React-Text gerendert. `dangerouslySetInnerHTML` und rohe Konsolenausgaben unter `src/` werden vom Repository-Check abgewiesen.
- Externe Links verwenden ausschließlich HTTPS ohne eingebettete Zugangsdaten sowie `noopener`, `noreferrer` und `no-referrer` über die gemeinsame `ExternalLink`-Komponente.
- Importdateien gelten als nicht vertrauenswürdig.
- Externe Links nutzen sichere Attribute und verständliche Ziele.
- Secrets gehören nicht in einen rein clientseitigen Build.
- Beispieldaten sind synthetisch und deutlich als solche erkennbar.
- Dokumente und Belege werden im MVP nicht gespeichert.

Verhalten, Grenzen und Löschablauf sind in [Datenschutz und Sicherheit](PRIVACY_AND_SECURITY.md) dokumentiert.

## 13. Teststrategie

### Unit-Tests

- Datums-/Frequenzlogik;
- Geldberechnung;
- Score- und Insight-Regeln;
- Validierung und Migrationen.

### Komponenten-Tests

- Formvalidierung;
- Tastaturnavigation;
- Leer-, Fehler- und Bestätigungszustände;
- View-Model-Darstellung.

### E2E-Tests

- App offline öffnen;
- Morgen-/Abend-Tagesablauf;
- Aufgabe/Habit/Journal persistieren;
- Export, lokale Löschung und Import;
- Schema-Upgrade;
- Kernnavigation auf Mobile und Desktop.

## 14. Nichtfunktionale Leitplanken

- Initialer komprimierter JavaScript-Transfer erhält im Bootstrap ein messbares Budget.
- Listen werden ab einer nachgewiesenen Schwelle virtualisiert, nicht vorsorglich.
- Diagramme werden lazy geladen und besitzen textuelle Zusammenfassungen.
- Keine Domain darf den gesamten Export direkt manipulieren.
- Jede neue externe Abhängigkeit wird auf Wartung, Bundlegröße, Lizenz und Offlinewirkung geprüft.
