# ADR 0015: Neo Quiet Density ist die visuelle Grundsprache

- Status: akzeptiert
- Datum: 2026-08-11
- Bezug: Issue #150; entwickelt ADR 0014 weiter

## Kontext

ADR 0014 führte deckende Quiet-Density-Panels additiv zur durchscheinenden „Abendrot“-Glasästhetik ein. Das löste die Dichte- und Kontrastprobleme in Listen, Trackern und Planungsrastern. Im vollständigen Produkt stehen dadurch jedoch zwei gleich starke Sprachen nebeneinander: große, weiche Glaskarten für Shell, Formulare und Übersichten sowie nahezu schwarze, kompakte Panels für Arbeitsflächen.

Der Produktcheck vom 11. August 2026 bestätigt, dass Quiet Density schneller scanbar und angenehmer für die tägliche Nutzung ist. Gewünscht ist eine Weiterentwicklung mit sehr dunklen neutralen Flächen und knalligen Neonfarben für Balken, Zahlen und Hervorhebungen.

## Entscheidung

Quiet Density wird zur visuellen Grundsprache. ADR 0014 bleibt für die Detailregeln dichter Panels gültig; seine Aussage, Quiet Density sei nur additiv und ändere Flächen außerhalb dichter Bereiche nicht, wird durch diese Entscheidung ersetzt.

- Arbeitskarten, Dialoge, Formulare, Kennzahl-Tiles und Diagramme sind deckend.
- Blur bleibt auf Shell, mobile Navigation und höchstens einen Hero je Ansicht begrenzt.
- Das Dark Theme ist die Leitpalette: nahezu schwarzer Grund, dunkle neutrale Flächen, helle neutrale Schrift.
- Neon-Lime und Cyan tragen Primäraktion, Fokus, Auswahl und Fortschritt. Magenta, Violett, Amber und Blau ergänzen die Datenpalette.
- Große Zahlen und Fortschrittswerte dürfen Neonfarbe tragen. Fließtext und Container bleiben neutral.
- Ein starker Glow ist je Ansicht erlaubt und muss eine fachliche Priorität markieren. Reduced Motion entfernt ihn.
- Farbe bleibt Zusatz. Jeder Zustand besitzt weiterhin Text, Zeichen, Muster, Struktur oder ARIA-Semantik.
- Light bleibt ein vollwertiges Theme mit denselben semantischen Rollen und Kontrastgrenzen.
- Die historischen Namen `--glass`, `.glass` und `.ui-card` bleiben kompatibel. Außerhalb der Shell bezeichnen sie jetzt deckende Flächen; eine mechanische Umbenennung ohne Nutzerwert findet nicht statt.
- Browser-Chrome, Manifest und Favicon folgen dem dunklen Grund und dem Lime-Cyan-Akzent; der alte grüne Markenwert aus ADR 0007 ist damit ersetzt.
- Es gibt keine neue Laufzeitabhängigkeit und keine Änderung an Persistenz oder Domainlogik.

## Konsequenzen

- `--shell-glass` trennt die seltene transparente Ebene von den deckenden `--glass`-, `--glass-strong`- und `--dense-*`-Flächen.
- Kontrasttests berechnen Transparenz nur noch für die Shell und prüfen Arbeitsflächen gegen feste Farben.
- Domainseiten erhalten keine Rohfarben. Die zentrale Token-, Komponenten- und Chartschicht trägt die Umstellung.
- Die Komponentenroute zeigt die gemeinsame Sprache für beide Themes und bleibt die lokale Referenz.
- Neue durchscheinende Arbeitskarten, Daueranimationen oder dekorative Glows benötigen eine neue Entscheidung.
