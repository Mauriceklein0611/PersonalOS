# ADR 0016: Die Ersteinrichtung speichert nur ihre Sichtbarkeit

- Status: akzeptiert
- Datum: 2026-08-11
- Bezug: Issue #152

## Kontext

Eine öffentlich erreichbare PersonalOS-Installation muss neuen Nutzern
erklären, dass Hosting keine Synchronisation ist, und zu einem ersten
nutzbaren Tagesablauf führen. Die Karte braucht einen dauerhaft
überspringbaren Zustand. Gleichzeitig darf keine zweite Checkliste speichern,
ob Aufgabe, Routine oder Finanzkategorie existieren: Nach Import, Archivierung
oder Löschung könnte sie den Fachdatensätzen widersprechen.

## Entscheidung

- Der Settings-Datensatz erhält das optionale ISO-Zeitfeld
  `onboardingDismissedAt`.
- Fehlt der Wert, ist die First-Run-Karte auf „Heute“ sichtbar.
- „Überspringen“ und „Einrichtung abschließen“ speichern ausschließlich diesen
  Zeitpunkt. Sie speichern weder Schritte noch Nutzungsereignisse.
- Aufgabe, Routine und optionale Finanzkategorie werden bei jedem Laden aus
  den bestehenden, validierten Fachdatensätzen abgeleitet.
- Die Karte kann in den Einstellungen wieder eingeblendet werden; dabei wird
  `onboardingDismissedAt` entfernt.
- Version 7 der IndexedDB ändert keine Stores oder Indizes. Das neue Feld ist
  optional, damit Version-6-Datensätze unverändert gültig bleiben.
- Der Zustand ist Teil von Export und Import, verlässt das Gerät aber nicht
  automatisch.

## Konsequenzen

- Der Fortschritt kann nach einer Datenänderung nicht veralten.
- Ein Import stellt sowohl Fachdatensätze als auch die bewusste
  Ausblendentscheidung wieder her.
- Es gibt keine Telemetrie darüber, ob die Einrichtung abgeschlossen oder
  übersprungen wurde; beide Aktionen haben absichtlich denselben
  Persistenzeffekt.
- Eine spätere verpflichtende Tour, ein Konto oder geräteübergreifender
  Onboardingstatus benötigen eine neue Produkt- und Datenschutzentscheidung.
