# ADR 0005: Habits speichern nur den aktuellen Rhythmus

- Status: Accepted
- Datum: 2026-08-04

## Kontext

Ein Habit besitzt genau ein `schedule`-Feld. Fälligkeit, Streaks und Erfüllungsquote werden zur Laufzeit aus diesem Feld und den vorhandenen `HabitEntry`-Datensätzen berechnet; sie werden nicht persistiert.

Issue #11 fordert, dass eine Rhythmusänderung „künftige, nicht historische Tage“ betrifft. Ohne Schedule-Historie gilt das nur zur Hälfte:

- Erfasste Check-ins sind eigene Datensätze und bleiben bei einer Änderung unverändert.
- Ob ein vergangener Tag *geplant* war, wird jedoch neu berechnet. Nach einer Änderung nutzt auch die Rückschau den aktuellen Rhythmus, und die Erfüllungsquote vergangener Zeiträume kann sich dadurch verschieben.

Eine echte Historisierung würde einen versionierten Schedule-Verlauf, eine Migration, eine Erweiterung des Exportformats sowie Regeln für rückwirkende Korrekturen erfordern.

## Entscheidung

Der Habit behält vorerst genau einen Rhythmus. Statt eine Historisierung zu simulieren, macht die Oberfläche die tatsächliche Berechnung sichtbar:

- Der Editor erklärt am Rhythmusfeld, dass eine Änderung ab heute wirkt, erfasste Check-ins unverändert bleiben und die Rückschau mit dem aktuellen Rhythmus rechnet.
- Die Fortschrittsansicht nennt Zeitraum, Berechnungsbasis und denselben Vorbehalt.
- Die Wochenansicht zeigt einen vorhandenen Check-in auch dann als erledigt oder übersprungen an, wenn der Tag im aktuellen Rhythmus nicht mehr geplant ist, und kennzeichnet ihn als „Früherer Rhythmus“.

## Konsequenzen

- Kein Schemawechsel, keine Migration und keine Exportformatänderung in Issue #11.
- Nutzende verlieren keine Check-ins und lesen keine Zusicherung, die das Modell nicht einhält.
- Auswertungen weit zurückliegender Zeiträume sind nach einer Rhythmusänderung nicht stabil. Wer stabile Rückschau braucht, legt eine neue Gewohnheit an.
- Ein Check-in an einem heute nicht mehr geplanten Tag kann derzeit nicht entfernt werden, weil `checkIn` und `reopenCheckIn` die aktuelle Eignung prüfen. Eine spätere Korrekturmöglichkeit braucht eine eigene Entscheidung.
- Eine spätere Schedule-Historie bleibt möglich: Sie ergänzt Versionsdatensätze, statt bestehende Felder umzudeuten.
