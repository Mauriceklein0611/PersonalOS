# ADR 0018: Flächentypen steuern Breite und Seitenhierarchie

- Status: akzeptiert
- Datum: 2026-08-11
- Bezug: Issue #160, Epic #159; ergänzt ADR 0015

## Kontext

ADR 0015 vereinheitlicht Farben, Flächen und Neonrollen. Domainseiten lösen
ihren Einstieg trotzdem unterschiedlich: große Hero-Karten, lokale
Aktionsreihen, Zeitraumhinweise und Ansichtsreiter stehen in wechselnder
Reihenfolge. Datenreiche Seiten verlieren dadurch besonders mobil den ersten
Viewport, während breite Desktopflächen ungenutzt bleiben.

Nicht jede Seite braucht dieselbe Dichte. Ein Tracker ist eine Arbeitsfläche,
ein Journal ein Editor und Einstellungen sind Konfiguration. Gleich aussehen
dürfen sie nicht; gleich lesbar und bedienbar müssen sie sein.

## Entscheidung

Jede Kernroute gehört zu genau einem Flächentyp:

1. **Arbeitsfläche (`work`)** für Listen, Tabellen, Tracker und Planungsraster.
   Sie nutzt die verfügbare Breite innerhalb der Shell und kapselt
   horizontalen Überlauf im zuständigen Raster.
2. **Übersicht (`overview`)** für priorisierte Signale und höchstens wenige
   Kennzahlen. Sie bleibt fokussiert und ist keine Sammlung aller Daten.
3. **Editor (`editor`)** für Journal und konzentrierte Eingaben. Seine Breite
   begrenzt die Textzeile und schützt die Schreibaufgabe vor Dashboardlärm.
4. **Konfiguration (`settings`)** für Einstellungen und Stammdaten. Sie nutzt
   klar getrennte Abschnitte bei derselben begrenzten Lesebreite.

Die Route markiert den Typ über `data-surface`. `work` darf die auf 96 rem
erweiterte Inhaltsfläche vollständig verwenden. Seiten ohne Kennzeichnung
behalten bis zu ihrem zuständigen Domainumbau die bisherige Breite von 78 rem;
`editor` und `settings` sind auf 64 rem begrenzt.

`PageToolbar` ist der gemeinsame kompakte Seiteneinstieg. Sie ordnet
Einordnung, Seitentitel, optionale Beschreibung, sichtbaren Zeitraum und wenige
Seitenaktionen. Fachliche Filter bleiben beim Inhalt. Der frühere große Hero
bleibt nur erlaubt, wenn er eine priorisierte Aussage oder Aktion trägt.

Ansichtsreiter bleiben für fachlich verschiedene Aufgaben erlaubt. Zeitraum,
Filter oder eine andere Aggregation desselben Bestands begründen allein keinen
Reiter. Solche Wechsel stehen in der Werkzeugleiste oder direkt an der
Arbeitsfläche.

## Konsequenzen

- Domainumbauten beginnen mit der Nutzerfrage und wählen danach den Flächentyp.
- Arbeitsflächen wachsen auf Desktop, ohne Navigation oder Shell zu überdecken.
- Mobile Werkzeugleisten brechen um; eigenständige Ziele bleiben 44 × 44 px.
- Neon liegt auf Zeitraum, Wert, Fortschritt, Auswahl und Primäraktion, nicht
  auf dem gesamten Container.
- Die Komponentenroute zeigt alle vier Typen mit synthetischen Daten.
- Es gibt keine Änderung an Routen, Persistenz, Export oder Domainlogik.

## Verworfen

- **Jede Seite als Dashboard:** Das würde Journal und Einstellungen ihrer
  eigentlichen Aufgabe unterordnen.
- **Jede Perspektive als Tab:** Das verdoppelt denselben Datenbestand und
  verschiebt die erste Aktion nach unten.
- **Globale unbegrenzte Breite:** Text- und Formularseiten würden auf großen
  Displays unlesbar lange Zeilen erhalten.
