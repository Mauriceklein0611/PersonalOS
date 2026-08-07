# PersonalOS – Umsetzungs-Roadmap

Kompakte Fassung des Audits vom 07.08.2026. Vollständige Begründungen: [`personal-os-product-ux-audit.md`](personal-os-product-ux-audit.md).

> Diese Datei ist eine **datierte Momentaufnahme einer externen Prüfung**, keine normative Spezifikation. Verbindlich bleiben `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` und die ADRs. Wo dieses Dokument ihnen widerspricht, gilt zuerst die Spezifikation; der Widerspruch gehört ins jeweilige Issue.

**Aufwand:** S ≤ ½ Tag · M 1–2 Tage · L 3–5 Tage · XL > 1 Woche
**Risiko:** niedrig (lokal begrenzt) · mittel (mehrere Module) · hoch (Datenmodell/Migration)

---

## Phase 1 – Korrektheit

> **Vor allem anderen.** Solange die Sparziel-Summe falsch rechnen kann und jedes Backup eine Warnung erzeugt, ist jede Oberflächenverbesserung Kosmetik über einem Korrektheitsproblem.

### 1.1 Settings-Datensatz beim Erststart anlegen · `C-01`

- **Ziel:** Beim ersten erfolgreichen Öffnen der Datenbank entsteht genau ein Settings-Datensatz.
- **Nutzen:** Beendet die Falschwarnung bei jedem Backup; macht `baseCurrency`, `timeZone`, `weekStartsOn` und das Theme überhaupt erst nutzbar.
- **Dateien:** `src/db/lifecycle.ts`, `src/db/schemas/settings.ts`, `src/app/theme/ThemeProvider.tsx`, `src/app/theme/theme-preference.ts`
- **Abhängigkeiten:** keine
- **Risiko:** niedrig – Seed ist idempotent zu bauen
- **Aufwand:** M (S nur für den Seed ohne Theme-Umzug)
- **Akzeptanzkriterien:**
  - [ ] Nach dem Erststart existiert genau ein Settings-Datensatz mit `locale: "de-DE"`, erkannter Zeitzone, `theme: "system"`, `baseCurrency: "EUR"`, `weekStartsOn: 1`
  - [ ] Mehrfacher Start erzeugt keinen zweiten Datensatz (Test)
  - [ ] Ein Backup einer normal genutzten Datenbank erzeugt **keine** Warnung mehr (Test)
  - [ ] Das Theme ist nach Export → lokales Löschen → Import wiederhergestellt
  - [ ] Der Bootstrap-Spiegel aus ADR 0002 funktioniert weiter (kein ungestaltetes Aufblitzen)

### 1.2 Währungsprüfung in der Sparziel-Summe · `C-02`

- **Ziel:** `summariseSavings` addiert nur Ziele in der Übersichtswährung und weist ausgeschlossene Ziele aus.
- **Nutzen:** Beseitigt eine erfundene Zahl, die als Tatsache dargestellt wird. Der Doc-Kommentar behauptet dieses Verhalten bereits – der Code hält es nicht ein.
- **Dateien:** `src/domains/finance/overview.ts`, `src/domains/finance/pages/MonthOverview.tsx`
- **Abhängigkeiten:** keine
- **Risiko:** niedrig
- **Aufwand:** S
- **Akzeptanzkriterien:**
  - [ ] Ein Ziel in abweichender Währung fließt nicht in `savedMinor`/`targetMinor` ein
  - [ ] `SavingsSummary` enthält `excludedGoalCount`; die Oberfläche benennt den Ausschluss sichtbar (stilles Weglassen genügt nicht)
  - [ ] Regressionstest mit gemischten Währungen (EUR + JPY) ist vorhanden und grün
  - [ ] Der Doc-Kommentar stimmt mit dem Verhalten überein

### 1.3 Sparbeitrag mit Buchung verknüpfbar machen · `C-03` `E-04`

- **Ziel:** Ein Sparbeitrag kann auf eine bestehende Ausgabe verweisen; verknüpfte Beträge zählen genau einmal.
- **Nutzen:** Beendet die Doppelzählung bei jedem Sparvorgang. Erster von zwei Schritten – Konten und echte Umbuchungen folgen in Phase 5.
- **Dateien:** `src/db/schemas/domain-records.ts` (Feld `sourceTransactionId?`), `src/db/migrations/v5-*.ts`, `src/domains/finance/savings-service.ts`, `src/domains/finance/overview.ts`, `SavingsPanel.tsx`
- **Abhängigkeiten:** keine
- **Risiko:** mittel – Schemaänderung, Backup-Format betroffen
- **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Beim Anlegen eines Beitrags lässt sich optional eine Ausgabe desselben Monats auswählen
  - [ ] Verknüpfte Beträge erscheinen im Monatssaldo genau einmal
  - [ ] Die Monatsübersicht weist gebundene Beträge getrennt von frei verfügbaren aus
  - [ ] Migration v5 ist vorwärtsgerichtet, mit Fixture der Vorversion getestet
  - [ ] Backups der Formatversion 1 bleiben lesbar

### 1.4 Dashboard-Aufgabenliste ohne stummen Abbruch · `C-05`

- **Ziel:** Bei Kürzung wird die Kürzung benannt und ein Weg zur vollständigen Liste angeboten.
- **Nutzen:** Beseitigt den sichtbaren Widerspruch zwischen „12 offen" in der Kachel und fünf Zeilen darunter.
- **Dateien:** `src/domains/today/pages/TodayPage.tsx`, `today-page.css`
- **Aufwand:** S · **Risiko:** niedrig
- **Akzeptanzkriterien:**
  - [ ] Ab sechs offenen Aufgaben erscheint „5 von N gezeigt" mit Link auf `/aufgaben`
  - [ ] Kachelzahl und Listenlänge widersprechen sich nie unerklärt
  - [ ] E2E-Test deckt den Fall ab

### 1.5 Dokumentation an vier Stellen nachziehen · `C-23`

- **Ziel:** `KNOWN_LIMITATIONS.md`, `DEVELOPMENT.md` und ADR 0008 entsprechen dem gemessenen Stand.
- **Nutzen:** ADR 0008 verspricht derzeit einen Puffer, der nicht existiert – der Diagramm-Chunk liegt bei 179,12 kB gegen ein 180-kB-Budget, und die dokumentierte Notfallmaßnahme (`PieChart` entfernen) ist längst verbraucht.
- **Dateien:** `docs/KNOWN_LIMITATIONS.md`, `docs/DEVELOPMENT.md`, `docs/decisions/0008-echarts-for-charts.md`, `.github/workflows/ci.yml`
- **Aufwand:** S (Doku) · M (mit CI-Prüfung) · **Risiko:** niedrig
- **Akzeptanzkriterien:**
  - [ ] Glas-Gestaltung nicht mehr als „ausstehend" geführt
  - [ ] Startup-Budget mit dem gemessenen Wert (150,56 kB gzip) angegeben
  - [ ] ADR 0008 enthält einen Nachtrag zum tatsächlichen Ausschöpfungsgrad und zur nächsten Ausbaustufe
  - [ ] CI bricht ab, wenn ein Chunk sein dokumentiertes Budget überschreitet

---

## Phase 2 – Kernabläufe

### 2.1 Finanzseite umsortieren und Ausgaben-Schnellerfassung · `C-07`

- **Ziel:** Erfassen kommt vor Auswerten; eine Ausgabe ist vom Dashboard aus in unter zehn Sekunden gebucht.
- **Nutzen:** Größter Alltagsgewinn pro Aufwand. Was unbequem ist, unterbleibt – und ohne erfasste Ausgaben ist jede Auswertung wertlos.
- **Dateien:** `FinancePage.tsx` (aufteilen), neu `QuickExpenseForm.tsx`, `TodayPage.tsx`
- **Abhängigkeiten:** keine · **Risiko:** mittel (Aufteilung berührt viele Zeilen) · **Aufwand:** M–L
- **Akzeptanzkriterien:**
  - [ ] Auf Mobil steht „Buchung erfassen" vor der Monatsübersicht
  - [ ] Dashboard-Schnellerfassung mit Betrag und Kategorie; Datum ist heute, Notiz optional
  - [ ] `FinancePage.tsx` unter 300 Zeilen
  - [ ] Bestehende Tests bleiben grün, E2E deckt die Dashboard-Erfassung ab

### 2.2 Suche in Listen · `C-08`

- **Ziel:** Aufgaben, Buchungen und Journaleinträge sind über Freitext auffindbar.
- **Nutzen:** Der Auftragstestfall „wiederfinden" ist derzeit nicht lösbar; das Problem wächst mit jeder Woche Nutzung.
- **Dateien:** neu `components/ui/SearchField.tsx`, `TasksPage.tsx`, `FinancePage.tsx`, `JournalPage.tsx`
- **Risiko:** niedrig · **Aufwand:** M (S pro Seite)
- **Akzeptanzkriterien:**
  - [ ] Filterung über Titel und Notiz, clientseitig, ohne Index
  - [ ] Trefferzahl wird genannt; Leerzustand bei null Treffern unterscheidet sich vom Leerzustand ohne Daten
  - [ ] Feld ist tastaturbedienbar und beschriftet
  - [ ] Bei 3.000 Aufgaben keine spürbare Verzögerung (Messung analog zur bestehenden Verdichtungsmessung)

### 2.3 Skip bricht die Serie nicht mehr · `C-09` `E-02`

- **Ziel:** Ein bewusst übersprungener Tag beendet die Serie nicht und fällt aus dem Nenner der Erfüllungsquote.
- **Nutzen:** Bringt das Produkt mit dem eigenen Prinzip („keine strafenden Streaks", `PRODUCT.md` §3) und dem belegten Marktstandard in Einklang.
- **Dateien:** `src/domains/habits/metrics.ts`, `src/domains/insights/score-engine.ts`, `score-view-model.ts`, `HabitProgressCard.tsx`, neues ADR
- **Abhängigkeiten:** **Erfordert ADR** – ändert eine dokumentierte Entscheidung
- **Risiko:** mittel (berührt Score-Berechnung; Snapshots tragen ihre Version, historische Werte bleiben gültig) · **Aufwand:** S–M
- **Akzeptanzkriterien:**
  - [ ] Übersprungener Tag zwischen zwei erledigten Tagen unterbricht die Serie nicht (Test)
  - [ ] Übersprungene Einheiten sind nicht mehr im Nenner, bleiben aber separat ausgewiesen
  - [ ] Die Oberfläche erklärt den Unterschied zwischen „übersprungen" und „nicht erfasst"
  - [ ] ADR dokumentiert Entscheidung und Auswirkung auf bestehende Snapshots

### 2.4 Finanzkennzahlen entwirren · `C-11` `C-12`

- **Ziel:** Die Monatsreihe zeigt nur monatsbezogene, gleichartige Zahlen.
- **Nutzen:** „Saldo −200 €" neben „Restbudget +300 €" ist ohne genaues Lesen widersprüchlich, obwohl beide korrekt sind.
- **Dateien:** `MonthOverview.tsx`, `SavingsPanel.tsx`, `finance-page.css`
- **Risiko:** niedrig · **Aufwand:** S
- **Akzeptanzkriterien:**
  - [ ] Monatsreihe dreispaltig: Einnahmen, Ausgaben, Saldo – alle über denselben Umfang
  - [ ] „Budget übrig" steht beim Budgetblock
  - [ ] Der Gesamt-Sparfortschritt steht im Sparzielblock; im Monatsblock stehen die Beiträge **dieses** Monats

### 2.5 Bedienbarkeit auf Mobil · `C-16` `C-17` `C-18` `C-21`

- **Ziel:** Kopfzeile, Überlaufmenü und Navigationsband entsprechen dem eigenen Standard.
- **Dateien:** `styles.css`, `MobileNavigation.tsx`, `navigation-items.ts`, neu `icons.tsx`
- **Risiko:** niedrig · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Alle Bedienelemente ≥ `--control-height` (44 px), auch in der Kopfzeile
  - [ ] Überlaufmenü schließt bei Tap außerhalb; Fokus kehrt auf den Auslöser zurück
  - [ ] Navigationsband mit Icons; Schriftgröße ≥ 0,7 rem
  - [ ] Ein Begriff je Bereich auf allen Größen

---

## Phase 3 – Verbindung der Module

### 3.1 Dashboard-Umbau · `C-04` – Konzept in Audit G

- **Ziel:** Das Dashboard beantwortet „Was ist heute wichtig?" statt „Was liegt alles herum?"
- **Nutzen:** Die Klammer, aus der überhaupt erst ein „OS" wird. Finanzen und Life Score bekommen Tagespräsenz.
- **Dateien:** `TodayPage.tsx`, `today-page.css`, neu `SignalRow.tsx`, `today/queries.ts`
- **Abhängigkeiten:** 1.4, 2.1 · **Risiko:** mittel · **Aufwand:** L
- **Akzeptanzkriterien:**
  - [ ] Vier Kennzahlen, nicht mehr
  - [ ] Signalbereich zeigt höchstens drei Zeilen und **bleibt leer**, wenn nichts auffällig ist
  - [ ] Life Score kompakt mit Datenvollständigkeit, verlinkt auf die Erklärung
  - [ ] **Kein ECharts-Chunk auf der Startroute** (im Build nachweisbar)
  - [ ] Tagesring misst Aufgaben und Gewohnheiten, nicht nur Gewohnheiten
  - [ ] Morgen-Check-in unter zwei Minuten (Ziel aus `PRODUCT.md` §11)

### 3.2 Wochenrückblick sichtbar machen

- **Ziel:** `weekly-review.ts` bekommt eine eigene Ansicht.
- **Nutzen:** Die Logik ist gebaut, getestet und deterministisch – sie hat nur keine Bühne. Bestes Verhältnis von Nutzen zu Aufwand im ganzen Projekt.
- **Dateien:** neu `WeeklyReviewPage.tsx`, `router.tsx`, `navigation-items.ts`
- **Risiko:** niedrig · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Zeigt Aufgaben-, Habit- und Zielentwicklung der Woche mit Datengrundlage
  - [ ] Vorwochenvergleich mit ausdrücklichem Hinweis, wenn keine Vergleichsbasis existiert
  - [ ] Neutrale Sprache ohne Bewertung; keine Kausalaussagen

### 3.3 Start und Frist unterscheiden · `E-08`

- **Ziel:** `plannedDate` und `dueAt` sind in der Oberfläche als unterschiedliche Dinge erkennbar.
- **Nutzen:** Beide Felder existieren, werden erfasst und gemeinsam ausgewertet – das Konzept dahinter wird nirgends sichtbar. Reiner Oberflächengewinn ohne Modelländerung.
- **Dateien:** `TaskCard.tsx`, `TodayPage.tsx` (`describeTask`), `tasks/queries.ts`
- **Risiko:** niedrig · **Aufwand:** S
- **Akzeptanzkriterien:**
  - [ ] Eine Aufgabe mit Frist, aber ohne Plandatum, ist als solche erkennbar
  - [ ] „Überfällig" unterscheidet zwischen verpasstem Plandatum und verpasster Frist
  - [ ] `describeTask` und die Beschreibungslogik in `TaskCard` sind zusammengeführt

### 3.4 Kapazitätsanzeige aus `estimatedMinutes` · `D-04`

- **Ziel:** Die Summe der geschätzten Minuten des heutigen Tages ist sichtbar.
- **Nutzen:** Das Feld wird erfasst, angezeigt und nirgends summiert. Eine Summe genügt für eine Überlastungswarnung nach Sunsama-Vorbild – ohne neues Datenmodell.
- **Dateien:** `today/queries.ts`, `TodayPage.tsx`, `SettingsPage.tsx` (Tagesbudget)
- **Risiko:** niedrig · **Aufwand:** S
- **Akzeptanzkriterien:**
  - [ ] Summe erscheint nur, wenn mindestens eine Aufgabe eine Schätzung hat
  - [ ] Aufgaben ohne Schätzung werden gezählt und benannt, nicht als null gewertet
  - [ ] Warnung ist sachlich formuliert, ohne Dringlichkeitsrhetorik

### 3.5 Ziele als Klammer sichtbar machen

- **Ziel:** Der Zielbezug von Aufgaben und Gewohnheiten wird in beiden Richtungen sichtbar.
- **Nutzen:** `goalId` existiert auf beiden Entitäten und wird kaum genutzt.
- **Dateien:** `GoalsPage.tsx`, `TaskCard.tsx`, `HabitProgressCard.tsx`, `goals/link-service.ts`
- **Risiko:** niedrig · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Die Zieldetailansicht listet verknüpfte Aufgaben und Gewohnheiten
  - [ ] Aufgaben- und Habitkarten zeigen ihr Ziel, wenn eines gesetzt ist
  - [ ] Ohne Verknüpfung bleibt alles wie bisher bedienbar

### 3.6 Informationsarchitektur auf vier Bereiche · Audit H

- **Ziel:** Heute · Planen · Routinen · Geld, plus Auswertung und Einstellungen in der Kopfzeile.
- **Nutzen:** Finanzen rücken aus dem mobilen Überlaufmenü heraus.
- **Dateien:** `navigation-items.ts`, `router.tsx`, beide Navigationskomponenten
- **Abhängigkeiten:** 2.5 · **Risiko:** mittel · **Aufwand:** L
- **Akzeptanzkriterien:**
  - [ ] Vier Einträge im mobilen Band, jeder mit Icon und Beschriftung
  - [ ] Alte Routen bleiben per Weiterleitung erreichbar (Lesezeichen, PWA-Verknüpfungen)
  - [ ] „Insights" heißt „Auswertung"

---

## Phase 4 – Auswertung und Finanzsubstanz

### 4.1 Wiederkehrende Buchungen als Vorlage · `C-06` `E-06`

- **Ziel:** Vorlagen mit Betrag, Kategorie, Art und Monatstag; fällige Vorlagen erscheinen als Vorschlag mit Bestätigung.
- **Nutzen:** Grundlage für Fixkosten, „frei verfügbar" und Monatsprognose – drei Auftragsanforderungen an derselben Wurzel.
- **Dateien:** neue Tabelle `recurringTransactions`, Migration v5/v6, neu `RecurringTemplateList.tsx`, `finance/service.ts`
- **Risiko:** hoch (Schema + Backup-Format) · **Aufwand:** L
- **Akzeptanzkriterien:**
  - [ ] Vorlagen buchen **nie** automatisch – jede Buchung bleibt eine bestätigte Handlung
  - [ ] Eine erledigte Vorlage erscheint im selben Monat nicht erneut
  - [ ] Aus einer Vorlage erzeugte Buchungen sind als solche erkennbar
  - [ ] Migration vorwärtsgerichtet und mit Fixture getestet; Backup-Format erhöht und rückwärtskompatibel

### 4.2 Fixkosten und frei verfügbares Geld · `E-05`

- **Ziel:** Der Monatsbereich unterscheidet Fixkosten, variable Kosten, gebundene Sparbeträge und frei verfügbaren Rest.
- **Nutzen:** Beantwortet die eigentliche Alltagsfrage: *Was kann ich diesen Monat noch ausgeben?*
- **Dateien:** `overview.ts`, `MonthOverview.tsx`, Kategorien-Flag `isFixedCost`
- **Abhängigkeiten:** 1.3, 4.1 · **Risiko:** mittel · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] „Frei verfügbar" ist als Einnahmen − Fixkosten − geplante Sparbeträge − bereits getätigte variable Ausgaben definiert und in der Oberfläche erklärt
  - [ ] Die Berechnung ist reproduzierbar dokumentiert (welche Buchungen zählen, welche nicht)
  - [ ] Umbuchungen und verknüpfte Sparbeiträge werden **nicht** doppelt gezählt (Test)
  - [ ] Ohne gepflegte Fixkosten erscheint die Zahl nicht, statt eine falsche zu zeigen

### 4.3 Monatsprognose – ausdrücklich als Schätzung · `E-07`

- **Ziel:** Auf Basis von Vorlagen und bisherigem Verbrauch ein erwarteter Monatsabschluss.
- **Nutzen:** Warnt, bevor der Monat zu Ende ist, statt hinterher zu berichten.
- **Dateien:** neu `finance/forecast.ts`, `MonthOverview.tsx`
- **Abhängigkeiten:** 4.1, 4.2 · **Risiko:** mittel · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Die Prognose ist als solche gekennzeichnet und optisch von Ist-Werten unterschieden
  - [ ] Berechnungsweg und Datengrundlage sind in der Oberfläche abrufbar
  - [ ] Bei weniger als zwei Monaten Historie erscheint keine Prognose, sondern ein Hinweis auf die fehlende Grundlage
  - [ ] Kein Prozentwert ohne Bezugsgröße, keine Zahl ohne Zeitraum

### 4.4 Ausgabenentwicklung je Kategorie

- **Ziel:** Verlauf einer Kategorie über bis zu zwölf Monate.
- **Nutzen:** Beantwortet „wird es mehr oder weniger?" – die einzige Trendfrage mit Entscheidungswert.
- **Dateien:** `overview.ts`, `finance/pages/`
- **Risiko:** niedrig · **Aufwand:** M
- **Akzeptanzkriterien:**
  - [ ] Linie, kein Kreis, keine Fläche ohne Grund
  - [ ] Monate ohne Daten werden als Lücke dargestellt, nicht als Null
  - [ ] Textzusammenfassung neben der Grafik (bestehende Regel)
  - [ ] Diagramm-Chunk bleibt innerhalb des ADR-0008-Budgets

---

## Phase 5 – Optional

Nur bei nachvollziehbarem Mehrwert; jeder Punkt ist einzeln verzichtbar.

| Vorhaben | Nutzen | Aufwand | Risiko | Bedingung |
| --- | --- | --- | --- | --- |
| Wiederkehrende Aufgaben | Alltagsverpflichtungen abbildbar | L | mittel | erst nach 4.1 – dieselbe Denkweise, mehr Sonderfälle |
| Geglätteter Habit-Stärkewert | ehrlichere Darstellung als reine Serie | M | niedrig | ADR; nur zusätzlich zur Serie, nicht als Ersatz |
| Konten und echte Umbuchungen | Kontostand, Nettovermögen | XL | hoch | eigenes ADR + Migrationsplan; erst wenn 1.3 sich als unzureichend erweist |
| Abschaltbare Module | entlastet die Navigation | M | niedrig | erst nach 3.6 |
| Erledigt-Ansicht mit Zeitraum | begrenzt unbegrenztes Wachstum | S | niedrig | – |
| Pfeiltasten in Tab-Leisten | Barrierefreiheit | S | niedrig | bereits dokumentierte Lücke |
| Onboarding-Karte | erste Minute entscheidet | M | niedrig | vor jeder Weitergabe an Dritte |

---

## Ausdrücklich abgelehnt

| Idee | Grund |
| --- | --- |
| Automatische Terminplanung | braucht Kalenderanbindung, die nicht im MVP ist |
| Generative KI über eigenen Daten | widerspricht Erklärbarkeit und Local-first |
| Serien-Benachrichtigungen | künstliche Dringlichkeit, `PRODUCT.md` §3 |
| Gamification | der Life Score erfüllt den Zweck bereits, und zwar erklärbar |
| Kreis- und Sankey-Diagramme | schlecht ablesbar; zusätzlich `PieChart` nicht registriert und Chunk-Budget zu 99,5 % ausgeschöpft |
| Drag & Drop zur Tagesplanung | touch-fehleranfällig, tastaturfeindlich, hoher Aufwand |
| Belege und OCR | außerhalb des MVP, wirft den Datenschutzansatz neu auf |
| Zweiter Gesamt-Score | konkurriert mit dem Life Score |
| Cloud-Sync vor `v1.0` | braucht Konfliktauflösung je Domäne |
| Mehrwährungsfähigkeit ausbauen | Kurse sind lokal nicht verfügbar; eine Währung sauber ist besser |

---

## Reihenfolge in einem Satz

**Erst rechnen die Zahlen richtig (1), dann geht die tägliche Bedienung schnell (2), dann greifen die Module ineinander (3), dann trägt der Finanzbereich Substanz (4) – alles andere ist optional (5).**

---

## Offene Punkte für den Autor

Diese Fragen kann das Audit nicht beantworten:

1. **Zielgruppe.** Bleibt PersonalOS ein Werkzeug für eine Person, oder soll es auch als Referenzprojekt Dritten vorgeführt werden? Das entscheidet über die Priorität von Onboarding (Phase 5) und Navigation (3.6).
2. **Finanztiefe.** Wie weit soll der Finanzbereich gehen? Konten und Nettovermögen sind eine Grundsatzentscheidung, keine Ausbaustufe – sie verändern das Datenmodell dauerhaft.
3. **Skip-Semantik.** Ist die aktuelle Nenner-Entscheidung eine bewusste Abweichung vom Markt oder ein ungeprüfter Nebeneffekt? Beides ist vertretbar, aber die Antwort gehört ins ADR.
4. **ECharts.** Lohnt eine 179-kB-Bibliothek für zwei Diagrammtypen? Das Budget ist zu 99,5 % ausgeschöpft; die Frage stellt sich spätestens beim nächsten Diagramm.
5. **Ungeprüfte Bereiche.** E2E-Suiten, Kontrastwerte im gerenderten Zustand, Verhalten bei sehr langen Titeln und die tatsächliche Bedienbarkeit auf einem echten Gerät konnten in diesem Audit nicht überprüft werden (siehe Audit §0.2). Diese Lücken sollten vor `v1.0` von Hand geschlossen werden.
