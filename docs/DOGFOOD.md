# Dogfood-Protokoll

Stand: 11.08.2026, Issue #146. Dieses Dokument legt fest, wie der 14-tägige Versuch aus #30 abläuft. Es enthält keine Ergebnisse: Die entstehen im Versuch und werden als Kommentare in #30 festgehalten.

Der Zweck ist eng: Die sieben Erfolgskriterien aus [`PRODUCT.md`](PRODUCT.md), Abschnitt 11, sollen am Ende belegt oder widerlegt sein. Was das Protokoll nicht misst, entscheidet über den Release nicht mit.

## Die sieben Kriterien und ihre Messung

| Kriterium aus `PRODUCT.md` | Wie es gemessen wird | Wo es notiert wird |
| --- | --- | --- |
| 14 Tage ohne Datenverlust oder manuelle Reparatur | Jeder Tag trägt `Verlust: nein` oder eine Beschreibung. Ein `ja` beendet die Zählung und startet sie nach dem Fix neu | tägliche Notiz |
| Morgendlicher Check-in im Median unter zwei Minuten | Stoppuhr vom Öffnen der Tagesübersicht bis zum letzten Schritt des Morgenblocks, in Sekunden | tägliche Notiz |
| Abendliche Reflexion im Median unter drei Minuten | Stoppuhr vom Öffnen des Journals bis zum ausdrücklichen Speichern, in Sekunden | tägliche Notiz |
| Export/Reset/Import stellt vollständig wieder her | Die Wiederherstellungsübung weiter unten, einmal in der ersten und einmal in der zweiten Woche | eigener Kommentar in #30 |
| Mindestens 90 % der täglichen Nutzung ohne Netzwerk | An mindestens vier der 14 Tage läuft der gesamte Tag offline. Jeder Schritt, der ohne Netzwerk nicht ging, wird einzeln benannt | tägliche Notiz |
| Life Score in höchstens zwei Interaktionen erklärbar | Einmal je Woche: von der Zahl auf der Tagesübersicht bis zu ihrem Rechenweg zählen, wie viele Interaktionen nötig sind | Wochennotiz |
| Keine offenen P0/P1-Fehler, keine bekannten Datenschutzlecks | Am Ende des Versuchs: Liste der während des Versuchs eröffneten Issues mit Zustand | Abschluss in #30 |

Die beiden Zeitkriterien nennen einen **Median**, keinen Durchschnitt. Ein einzelner Tag mit einer Unterbrechung verzerrt ihn nicht, und genau darum steht er dort.

## Der Tag

### Morgen — Ziel: unter zwei Minuten

Stoppuhr an, bevor die Tagesübersicht (`/`) offen ist.

1. Aufgaben für heute lesen und entscheiden, was heute wirklich dran ist.
2. Fällige Routinen abhaken oder ausdrücklich überspringen.
3. Was heute noch fehlt, über die Schnellerfassung eintragen.

Stoppuhr aus, sobald der letzte Schritt getan ist. Nachdenken über den Tag zählt mit — es gehört zum Check-in.

### Tagsüber — nicht gemessen

Ausgaben und Aufgaben werden erfasst, wenn sie anfallen. Diese Nutzung wird nicht gestoppt; sie zeigt sich in den Funden, nicht in den Zeiten.

### Abend — Ziel: unter drei Minuten

Stoppuhr an, bevor das Journal offen ist.

1. Eintrag für heute schreiben und die Stimmungsstufe wählen.
2. Ausdrücklich speichern. Der Eintrag speichert nicht von selbst ([ADR 0006](decisions/0006-journal-saves-explicitly.md)).
3. Tagesübersicht ein zweites Mal öffnen und den Life Score zur Kenntnis nehmen.

Stoppuhr aus nach dem Speichern; der dritte Schritt zählt nicht mit.

### Wochenrückblick — einmal je Woche

Der Wochenrückblick (`/auswertung/wochenrueckblick`) wird einmal je Woche vollständig gelesen. Dabei entstehen zwei Angaben: die Zahl der Interaktionen von der Life-Score-Zahl bis zu ihrem Rechenweg, und ein Satz dazu, ob die Woche in der Ansicht wiedererkennbar ist.

## Die tägliche Notiz

Ein Kommentar je Tag in #30, in dieser Form. Sie trägt keine Journaltexte, keine Beträge, keine Namen und keine Aufgabentitel — nur Zahlen und Zustände:

```text
Tag 04
Morgen: 78 s
Abend: 141 s
Offline: ja
Verlust: nein
Reibung: Routine mit Wochenplan brauchte drei Anläufe, bis der richtige Tag stand
Funde: #147 (P2)
```

`Reibung` ist der einzige Freitextplatz. Ein Satz, was gehakt hat — nicht was erfasst wurde. Wenn nichts hakte, steht dort `keine`.

Zwei Regeln dazu:

- Was ohne die eigenen Inhalte nicht beschreibbar ist, gehört nicht in das öffentliche Issue, sondern in ein privates Notat außerhalb des Repositories.
- Ein ausgefallener Tag wird als `Tag NN: ausgefallen` notiert, mit Grund. Weglassen würde den Median schöner machen, als er ist.

## Die Wiederherstellungsübung

Zweimal während des Versuchs, einmal je Woche. Sie beweist, was der Local-first-Ansatz verspricht: dass die Daten dem Gerät nicht ausgeliefert sind.

**Vorher.** Einen vollständigen Export außerhalb des Browserprofils ablegen — auf einem Datenträger oder in einem Ordner, den ein Zurücksetzen des Browsers nicht berührt. Ohne diese Kopie ist die Übung ein Risiko und kein Test.

1. In den Einstellungen `Vollständigen Export herunterladen`. Die Datei liegt danach im Downloadordner.
2. In der Karte „Lokaler Speicher und Datenschutz" die Zahl unter „Lokale Datensätze" notieren.
3. `Alle lokalen Daten löschen`, im Dialog `Backup herunterladen und endgültig löschen`. Die Anwendung lädt dabei selbst noch einmal einen Export herunter, bevor sie löscht — der aus Schritt 1 bleibt trotzdem die Kopie, auf die man sich verlässt.
4. Ein **frisches Browserprofil** öffnen und PersonalOS dort starten. Ein neues Fenster desselben Profils genügt nicht: Es teilt denselben Speicher und beweist nichts.
5. `Backup-Datei prüfen` und die Datei aus Schritt 1 wählen. Die Vorschau nennt Format, Datensatzzahl, Exportzeitpunkt und Zeitraum.
6. Vorschauzahlen mit der Notiz aus Schritt 2 vergleichen, dann `Lokale Daten durch Backup ersetzen` und im Dialog `Sicherheitsbackup laden und ersetzen`.
7. Stichprobe in der Anwendung: eine Aufgabe mit Zielbezug, ein Sparbeitrag mit der Buchung, die ihn deckt, und ein Journaleintrag mit Stimmungsstufe. Diese drei tragen die jüngsten Verweise des Datenmodells; kommen sie durch, kommt der Rest auch.

Die Übung gilt als bestanden, wenn die Datensatzzahl aus Schritt 2 wieder erreicht ist **und** die drei Stichproben ihre Verweise behalten haben. Notiert wird sie als eigener Kommentar in #30 mit beiden Zahlen und dem Ergebnis der Stichprobe.

Zusammenführen ist im MVP bewusst nicht vorgesehen: Ein Import ersetzt den lokalen Bestand vollständig.

## Umgang mit Funden

- **P0** — Datenverlust, Absturz ohne Weg zurück, ein Datenschutzleck: Der Versuch wird unterbrochen. Fund als Issue, beheben, danach die 14 Tage neu zählen.
- **P1** — ein Kernablauf ist unbenutzbar oder liefert Falsches, ohne Daten zu verlieren: sofort als Issue, Behebung vor dem Release. Der Versuch läuft weiter.
- **P2** — Reibung, Unschönes, Umwege: in der täglichen Notiz sammeln und am Ende gebündelt als Issues eröffnen. Nicht während des Versuchs beheben.

Während des Versuchs wird an der Anwendung nichts geändert, außer es ist ein P0 oder P1. Jede andere Änderung macht die Tage davor und danach unvergleichbar.

## Was den Versuch ungültig macht

- Mehr als zwei ausgefallene Tage in den 14.
- Eine Änderung an der Anwendung, die kein P0/P1-Fix ist.
- Eine Wiederherstellungsübung, die im selben Browserprofil stattfand.

## Abschluss

Am Ende entstehen in #30: die beiden Mediane, der Offline-Anteil mit Begründung jeder Ausnahme, die zwei Ergebnisse der Wiederherstellungsübung, die Liste der eröffneten Issues mit Zustand — und daraus eine Go/No-Go-Empfehlung für #31 mit einem Satz Begründung je Kriterium, das nicht erfüllt ist.
