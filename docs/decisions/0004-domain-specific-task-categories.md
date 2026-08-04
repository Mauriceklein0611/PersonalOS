# ADR 0004: Domänenspezifische Aufgabenkategorien ohne eigenen Store

- Status: Accepted
- Datum: 2026-08-04

## Kontext

Tasks besitzen bereits eine optionale `categoryId`, während der MVP nur einen Store für Finanzkategorien hat. Eine gemeinsame Kategorie-Tabelle würde Aufgaben, Habits und Finanzen früh koppeln. Ein eigener TaskCategory-Store würde Schema-, Migrations- und Exportaufwand erzeugen, bevor anpassbare Aufgabenkategorien als eigener Anwendungsfall belegt sind.

## Entscheidung

Aufgabenkategorien bleiben domänenspezifisch. Issue #9 bietet zunächst einen kleinen, im Code versionierten Katalog mit stabilen UUIDs für „Privat“, „Arbeit“ und „Erledigungen“ sowie „Ohne Kategorie“ an. Persistiert wird ausschließlich die optionale stabile `categoryId`; Labels werden nicht in Tasks kopiert.

Finanzkategorien werden nicht wiederverwendet. Anpassbare Aufgabenkategorien benötigen später einen eigenen Store, eine Migration, Backup-/Restore-Anpassung und eine neue Entscheidung über Archivierungsregeln.

## Konsequenzen

- Tasks funktionieren vollständig ohne Kategorie.
- Kategorien verursachen in Issue #9 keine Schema- oder Exportformatänderung.
- Labels können in einer späteren App-Version geändert werden, ohne Task-Datensätze umzuschreiben.
- Nutzende können den initialen Katalog noch nicht anpassen; die UI behauptet diese Möglichkeit nicht.
- Habits erhalten nicht automatisch denselben Katalog.
