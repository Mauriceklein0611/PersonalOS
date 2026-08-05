# ADR 0008: Apache ECharts für Diagramme, eigene Bausteine für Fortschritt

- Status: akzeptiert
- Datum: 2026-08-05
- Bezug: Issue #55, ersetzt die Diagrammteile von Issue #43

## Kontext

Die Designvorschrift „Glas“ verlangt Linien- und Flächendiagramme mit weicher Glättung, Verlaufsfüllung nach unten, Tooltips und kurzer Einblendanimation. Die bisherigen SVG-Primitive (`Sparkline`, `ChartFrame`) zeichnen Pfade ohne Achsen, ohne Skalenbeschriftung, ohne Tooltip und ohne Layoutlogik.

Nach der Regel aus #43 wurde zuerst geprüft, ob die eigenen Primitive ausreichen. Für den beschlossenen Look müssten Achsenberechnung, Beschriftungskollisionen, Tooltip-Positionierung, Glättung und responsives Neuzeichnen selbst entstehen. Das ist reichlich Code für ein gelöstes Problem, und das Ergebnis blieb im Vergleich sichtbar zurück.

Gleichzeitig sind `ProgressRing`, `ProgressBar`, `RankedBarList` und `TrackerCell` keine Diagramme im eigentlichen Sinn. Sie sind kleine, feste Formen mit klaren Zuständen, vollständig getestet, und eine Bibliothek würde sie weder kleiner noch zugänglicher machen.

## Entscheidung

Apache ECharts übernimmt Linien-, Flächen- und Balkendiagramme. `Sparkline` und `ChartFrame` entfallen und werden durch die Komponente `Chart` ersetzt.

`ProgressRing`, `ProgressBar`, `RankedBarList` und `TrackerCell` bleiben eigene Komponenten.

Bedingungen dieser Entscheidung:

- Der Import läuft ausschließlich über `echarts/core` mit ausdrücklicher Registrierung der benötigten Bausteine (`BarChart`, `LineChart`, `PieChart`, `GridComponent`, `TooltipComponent`, `LegendComponent`, `SVGRenderer`). Ein Import des Gesamtpakets ist nicht zulässig.
- Der SVG-Renderer wird bevorzugt: scharfe Darstellung ohne Geräteauflösungslogik, kleinerer Code, und in jsdom testbar ohne native Zeichenfläche.
- Farben kommen zur Laufzeit aus den CSS-Tokens. Die Bibliothek bekommt kein eigenes Farbschema; `chart-theme.ts` liest `--data-1` bis `--data-6`, Text- und Gitterfarben vom Wurzelelement und reagiert auf einen Theme-Wechsel.
- Jedes Diagramm bleibt `aria-hidden` und trägt dieselben Werte zusätzlich als Tabelle. Zeitraum und Datenbasis stehen als Text an der Grafik.
- `prefers-reduced-motion: reduce` schaltet die Animation ab.
- Zusätzliches Bundle-Budget: höchstens 180 KB gzip. Der Chunk wird im Build-Report ausgewiesen und ist über den Router lazy geladen, damit er den Erststart nicht belastet.

## Konsequenzen

- Eine neue Laufzeitabhängigkeit. Sie ist Apache-2.0-lizenziert, hat keine Netzwerkzugriffe und keine Telemetrie; die Local-first-Zusage bleibt unberührt.
- Die Diagrammlogik der Anwendung schrumpft auf Datenaufbereitung; Achsen und Layout liegen in der Bibliothek.
- Wird das Bundle-Budget später gerissen, ist zuerst der `PieChart` zu entfernen, danach ist die Entscheidung neu zu prüfen.
- Die Farbpflege bleibt einquellig. Ein neues Token wirkt ohne Änderung an Diagrammcode.
