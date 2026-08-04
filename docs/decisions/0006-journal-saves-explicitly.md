# ADR 0006: Das Journal speichert ausdrücklich statt automatisch

- Status: Accepted
- Datum: 2026-08-04

## Kontext

Issue #12 verlangt eine Entscheidung über Autosave für die Abendreflexion. Ein Journaleintrag ist der sensibelste Inhalt im MVP und besteht pro lokalem Tag aus genau einem Datensatz mit optionalen Skalen und Freitexten.

Autosave während der Eingabe hätte drei konkrete Nachteile:

- Jeder Tastendruck erzeugt eine Schreiboperation auf denselben Datensatz. Ein halb formulierter Satz wäre bereits gespeicherter Inhalt.
- „Gespeichert“ wäre nicht mehr eindeutig kommunizierbar, weil der zuletzt geschriebene Stand und der sichtbare Stand auseinanderlaufen können.
- Ein versehentlich geleertes Feld wäre ohne eigene Historie sofort dauerhaft weg.

Ausdrückliches Speichern hat den Nachteil, dass nicht gespeicherte Eingaben beim Verlassen der Seite verloren gehen können. Dieser Fall lässt sich sichtbar machen; der Autosave-Fall lässt sich nicht rückgängig machen.

## Entscheidung

Das Journal speichert ausschließlich auf ausdrückliche Aktion.

- Der Button „Eintrag speichern“ schreibt den vollständigen Tagesdatensatz in einer Transaktion.
- Ein Statusbereich mit `role="status"` nennt jederzeit den aktuellen Zustand: nicht gespeicherte Änderungen, gespeicherte Uhrzeit, vorhandener Eintrag oder noch kein Eintrag.
- Solange Änderungen offen sind, ist der Tageswechsel deaktiviert und im Kontext erklärt; „Änderungen verwerfen“ stellt den gespeicherten Stand wieder her.
- Ein `beforeunload`-Hinweis warnt vor dem Verlassen mit offenen Änderungen.
- Ein Eintrag ohne jeden Inhalt wird nicht gespeichert, sondern erklärt.

## Konsequenzen

- Der gespeicherte Zustand ist eindeutig und testbar; die Akzeptanzkriterien zu Sichtbarkeit und Reload lassen sich direkt prüfen.
- Es entstehen keine Teilfassungen eines Gedankens in der lokalen Datenbank.
- Nutzende müssen einen zusätzlichen Klick ausführen. Das ist bei einer abendlichen Reflexion vertretbar und bleibt innerhalb der Zielzeit aus `docs/PRODUCT.md`.
- Ein späterer lokaler Entwurfsspeicher außerhalb der Domänentabelle bleibt möglich, benötigt aber eine eigene Entscheidung über Ort, Verschlüsselung und Aufbewahrung.
- Für Tasks und Habits ändert sich nichts; dort schreibt jede einzelne Aktion bereits sofort und vollständig.
