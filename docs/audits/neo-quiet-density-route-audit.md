# Neo Quiet Density: Routen- und Konsistenzaudit

Stand: 12.08.2026. Diese Matrix beschreibt die fertige Oberflächenhierarchie
aus #159 bis #165. Sie ist eine prüfbare Ergänzung zu den normativen
[UI-Leitlinien](../UI_GUIDELINES.md), keine neue Produktanforderung.

## Konsistenzmatrix

| Route | Flächentyp | Primäre Nutzerfrage | Primäre Aktion | Neonrollen | Desktop und Mobil | Zustände und kritische Prüfung |
| --- | --- | --- | --- | --- | --- | --- |
| Heute `/` | Übersicht | Was braucht heute Aufmerksamkeit? | Aufgabe schnell erfassen | höchstens drei Kennzahlen, Fortschritt, Fokus | ruhige Übersicht; mobil einspaltig | Ersteinrichtung, leer, Fehler, offline; `today`, `onboarding`, `pwa` |
| Aufgaben `/planen/aufgaben` | Arbeitsfläche | Was ist offen oder für einen Tag geplant? | Aufgabe anlegen | Auswahl, Fristbezug, Fokus | dichte Liste; Wochenplan mobil mit einem Tag | Filter, leer, Fehler, Tastatur; `tasks`, `daily-loop` |
| Ziele `/planen/ziele` | Arbeitsfläche | Woran arbeite ich und was ist der nächste Meilenstein? | Ziel anlegen | Auswahl und Fortschritt | Hierarchiezeilen; Detail mobil darunter | leer, Fehler, Löschen/Recovery; `goals`, `goal-links` |
| Routinen `/routinen/uebersicht` | Arbeitsfläche | Was war geplant und was habe ich eingecheckt? | Routine anlegen oder Check-in setzen | Trackerzellen, Rate, Serie, Auswahl | voller Monat; mobil eigener horizontaler Raster-Scroller | aktiv/archiviert, leer, Fehler, offline; `habits`, `daily-loop` |
| Journal `/routinen/journal` | Editor | Was möchte ich für diesen Tag festhalten? | Eintrag speichern | Skalauswahl, Fokus, Speicherstatus | begrenzte Textzeile; mobil einspaltig | leer, Laden, Fehler, ungespeichert; `journal` |
| Geld `/geld` | Arbeitsfläche | Was ist geflossen und wie steht der Plan? | Buchung erfassen | Beträge, Budget- und Sparbalken | dichte Bestände; Formulare brechen mobil um | leer, gemischte Währung, Fehler, Recovery; `finance`, `backup` |
| Auswertung `/auswertung/ueberblick` | Übersicht | Was lässt sich aus meinen Einträgen nachvollziehbar ableiten? | Wochenrückblick oder Datenbasis öffnen | große Werte und Balken | Text/Tabelle vor Diagramm; mobil gestapelt | unvollständig, ausgeblendet, Fehler; `insights` |
| Wochenrückblick `/auswertung/wochenrueckblick` | Übersicht | Was ist in dieser Woche passiert? | Woche wechseln | Vergleichswerte und Balken | fünf dichte Vergleichszeilen; mobil gestapelt | fehlende Grundlage, laufende Woche, Fehler; `weekly-review` |
| Einstellungen `/einstellungen` | Konfiguration | Wie bleiben lokale Einstellungen und Daten kontrollierbar? | Export erstellen | Fokus, Erfolg, Gefahraktion | gemeinsame Abschnittsfläche; mobil einspaltig | Laden, Importfehler, Bestätigung, Recovery; `settings`, `backup`, `recovery` |
| Ersteinrichtung auf Heute | unterstützende Fläche | Welche lokale Grundlage fehlt noch? | ersten Datensatz erfassen oder überspringen | Fortschritt und erledigter Schritt | kompakte dichte Liste vor dem Fachinhalt | lokal speicherbar, Fehler, erneut einblendbar; `onboarding` |

## Geprüfte Regeln

- Reine Filter und Zeiträume erzeugen keine Reiter. Nur fachlich verschiedene
  Arbeitsmodi bleiben getrennt; der Routinen-Tracker hat keine Unteransichten.
- Listen verwenden gemeinsame dichte Flächen statt einer Karte pro Datensatz.
- Die Dokumentbreite bleibt bei 320, 375, 390, 768, 1280 und 1440 Pixeln
  stabil. Breite Tracker scrollen ausschließlich in ihrem eigenen Bereich.
- Eigenständige Schaltflächen bleiben mindestens 44 mal 44 CSS-Pixel groß;
  Fokusrahmen und Sticky-Spalten werden nicht abgeschnitten.
- Farbe, Glow, Balken und Diagramme ergänzen immer Text, Zeichen oder Tabellen.
- Dark und Light, Reduced Motion sowie die deckenden Fallbacks für Reduced
  Transparency sind in Komponenten- und Routentests abgedeckt.
- Offline-Start, Reload, Export und lokale Aktionen bleiben ohne Backend
  verfügbar. Hosting unter einer Domain ändert daran nichts und ist keine
  Synchronisation.
- Startroute, Diagramm-Chunk und Routen-Chunks bleiben innerhalb der in
  [Leistungsbudgets](../PERFORMANCE.md) dokumentierten Grenzen.

## Verbleibende manuelle Grenzen

Die automatisierten Prüfungen verwenden Chromium und synthetische Datensätze.
Echte Screenreader-, Browser- und Gerätetests bleiben wie in
[Bekannte Einschränkungen](../KNOWN_LIMITATIONS.md) dokumentiert eine manuelle
Freigabeaufgabe.
