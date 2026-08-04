# Bekannte Einschränkungen

Stand: Abschluss von `v0.2 – Daily Loop`. Diese Liste beschreibt bewusst akzeptierte Grenzen des aktuellen Standes. Sie ersetzt weder das spätere `v1.0`-Audit noch die Datenschutzgrenzen aus [Datenschutz und Sicherheit](PRIVACY_AND_SECURITY.md).

## Daten und Modell

- Ein Habit speichert genau einen Rhythmus ohne Historie. Nach einer Änderung rechnet auch die Rückschau mit dem aktuellen Rhythmus; erfasste Check-ins bleiben unverändert. Siehe [ADR 0005](decisions/0005-habit-schedule-without-history.md).
- Ein Check-in an einem Tag, der im aktuellen Rhythmus nicht mehr geplant ist, lässt sich nicht entfernen, weil `checkIn` und `reopenCheckIn` die aktuelle Eignung prüfen.
- Das Journal kennt kein Löschen eines Tages. Ein Eintrag lässt sich leeren, aber nicht entfernen.
- Das wichtigste Tagesergebnis auf dem Dashboard wird aus der höchstpriorisierten offenen Aufgabe abgeleitet. Ein frei formuliertes Tagesziel ist noch kein persistiertes Feld.
- Der Import ersetzt lokale Daten vollständig. Zusammenführen ist nicht implementiert.

## Oberfläche

- Die Ansichtswechsel in Aufgaben und Gewohnheiten sind als `tablist` ausgezeichnet, unterstützen aber noch keine Pfeiltastennavigation zwischen den Tabs. Jeder Tab ist einzeln über die Tabulatortaste erreichbar.
- Die Wochenansicht der Gewohnheiten scrollt bei schmalen Ansichten horizontal in ihrem eigenen Bereich.
- Zukünftige Wochen lassen sich in der Wochenansicht nicht öffnen; die laufende Woche ist die letzte auswertbare.
- Die dunkle Dashboard-Gestaltung aus dem Design-Issue ist noch nicht umgesetzt. Die aktuelle Oberfläche nutzt die bestehende Token-Ebene.

## Offline und Plattform

- Der Service Worker cached ausschließlich App-Shell und statische Dateien. Nutzerdaten liegen nur in IndexedDB und werden nie gecacht.
- Die Offline-Anzeige kombiniert Browserereignisse mit einem inhaltsfreien Same-Origin-`HEAD`-Check. Sie ist ein Hinweis, keine Zusicherung.
- Private und Inkognito-Fenster verwerfen lokale Daten beim Schließen.
- Die automatisierten Browsertests laufen gegen Chromium. Andere Browser und Geräte sind noch nicht abgedeckt.

## Leistung

- Die Verdichtung des Tagesablaufs wurde mit rund 3.000 Aufgaben, 40 Gewohnheiten und 730 Journaleinträgen gemessen und liegt bei etwa 33 Millisekunden. Der zugehörige Test sichert nur die Größenordnung ab.
- Listen werden noch nicht virtualisiert. Das ist erst ab einer nachgewiesenen Schwelle vorgesehen.

## Offene Punkte

Für `v0.2` sind keine P0-Probleme offen. Die oben genannten Punkte sind entweder bewusst außerhalb des MVP-Scopes oder in späteren Issues eingeplant.
