# ADR 0003: Vorwärtsmigrationen mit sicherem Recovery-Zustand

- Status: Accepted
- Datum: 2026-08-04

## Kontext

PersonalOS speichert private Daten ausschließlich lokal in IndexedDB. Eine neue App-Version darf eine bestehende Datenbank weder stillschweigend verwerfen noch die normale Oberfläche anzeigen, wenn ein Schema-Upgrade fehlgeschlagen ist. Gleichzeitig müssen Migrationen reproduzierbar, testbar und von der späteren Exportformat-Version getrennt bleiben.

## Entscheidung

- Jede interne Dexie-Version ist eine aufsteigende ganze Zahl und wird zentral in `src/db/migrations/index.ts` registriert.
- Datenänderungen liegen in genau einer Datei `v<version>-<slug>.ts` und werden innerhalb der von Dexie bereitgestellten Upgrade-Transaktion ausgeführt.
- Eine Migration validiert ihre Eingabe und ihr Ergebnis mit Zod. Unbekannte oder inkompatible Daten brechen das Upgrade ab.
- Es gibt im Produkt keine Down-Migration. Ein bereits erfolgreich angewendetes Upgrade wird von IndexedDB nicht erneut ausgeführt.
- Die App öffnet die Datenbank vor dem Router. Erst nach einem erfolgreichen Open-/Upgrade-Ergebnis wird die normale Oberfläche angezeigt.
- Bei einem Fehler bleibt die bestehende Datenbank erhalten. Die Recovery-Oberfläche erklärt erneutes Laden, vorhandene Exporte und den ausdrücklich zu bestätigenden lokalen Reset, ohne Datensatzinhalte oder technische Fehlerdetails anzuzeigen.
- Interne Datenbankversion und Exportformat-Version werden unabhängig voneinander geführt.

## Konsequenzen

### Positiv

- fehlgeschlagene Upgrades hinterlassen durch die Upgrade-Transaktion keinen teilweise migrierten Zustand;
- alte Fixtures können gegen denselben Registrierungsweg wie die Produktdatenbank getestet werden;
- Nutzer sehen keinen fälschlich erfolgreichen App-Zustand;
- ein Reset ist bewusst, bestätigt und niemals automatische Fehlerbehandlung.

### Negativ

- jeder Schemawechsel benötigt eine neue Version, Fixture und Rückwärtskompatibilitätsprüfung;
- ein inkompatibler lokaler Datensatz kann den App-Start blockieren, bis erneut versucht oder bewusst zurückgesetzt wird;
- ein Export aus dem Recovery-Zustand ist erst möglich, wenn das Backup-Format implementiert ist.

## Verworfene Alternativen

- **Datenbank bei Fehler automatisch löschen:** nicht vertretbar, weil Browserdaten die einzige persistente Kopie sein können.
- **Fehler nur loggen und App weiter anzeigen:** könnte Schreibvorgänge gegen ein unbekanntes Schema zulassen und falsche Sicherheit vermitteln.
- **Down-Migrationen im Client:** erhöhen Komplexität und Risiko, ohne für den MVP einen sicheren Wiederherstellungsweg zu bieten.
