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

- Der Import läuft ausschließlich über `echarts/core` mit ausdrücklicher Registrierung der benötigten Bausteine. Ein Import des Gesamtpakets ist nicht zulässig. Registriert sind `BarChart`, `LineChart`, `GridComponent`, `TooltipComponent` und `SVGRenderer`. Nicht registriert sind `PieChart`, weil keine Ansicht ihn braucht, und `LegendComponent`, weil die Legende als HTML-Liste neben der Grafik steht und dort auch ohne Farbe lesbar bleibt.
- Der SVG-Renderer wird bevorzugt: scharfe Darstellung ohne Geräteauflösungslogik, kleinerer Code, und in jsdom testbar ohne native Zeichenfläche.
- Farben kommen zur Laufzeit aus den CSS-Tokens. Die Bibliothek bekommt kein eigenes Farbschema; `chart-theme.ts` liest `--data-1` bis `--data-6`, Text- und Gitterfarben vom Wurzelelement und reagiert auf einen Theme-Wechsel.
- Jedes Diagramm bleibt `aria-hidden` und trägt dieselben Werte zusätzlich als Tabelle. Zeitraum und Datenbasis stehen als Text an der Grafik.
- `prefers-reduced-motion: reduce` schaltet die Animation ab.
- Zusätzliches Bundle-Budget: höchstens 180 KB gzip. Der Chunk wird im Build-Report ausgewiesen und über `React.lazy` erst geladen, wenn tatsächlich ein Diagramm erscheint. Rahmen, Wertetabelle und Leerzustand funktionieren ohne die Bibliothek.
- Der Build minifiziert mit Terser statt esbuild. Mit esbuild liegt der Diagramm-Chunk knapp über dem Budget; Terser bringt ihn darunter. Terser ist eine reine Build-Abhängigkeit ohne Laufzeitanteil.

## Konsequenzen

- Eine neue Laufzeitabhängigkeit. Sie ist Apache-2.0-lizenziert, hat keine Netzwerkzugriffe und keine Telemetrie; die Local-first-Zusage bleibt unberührt.
- Die Diagrammlogik der Anwendung schrumpft auf Datenaufbereitung; Achsen und Layout liegen in der Bibliothek.
- Wird das Bundle-Budget später gerissen, ist zuerst der `PieChart` zu entfernen, danach ist die Entscheidung neu zu prüfen.
- Die Farbpflege bleibt einquellig. Ein neues Token wirkt ohne Änderung an Diagrammcode.

## Nachtrag 2026-08-07 (Issue #67)

### Der Ausweg von oben hat nie existiert

Der vorletzte Konsequenzpunkt nennt als erste Notfallmaßnahme das Entfernen des `PieChart`. Dieselbe Entscheidung hält oben fest, dass `PieChart` **nicht registriert** ist. Der beschriebene Ausweg entfernt also etwas, das nie enthalten war. Er ist damit ersatzlos hinfällig — er war nie eine Reserve, sondern ein Denkfehler.

### Gemessener Stand

Messung am 07.08.2026 mit `pnpm build && pnpm check:bundle` (gzip Level 9; das Build-Log gibt mit anderer Kompressionseinstellung rund ein Prozent höhere Werte aus):

| Bereich | Gemessen | Budget |
| --- | --- | --- |
| Diagramm-Chunk (`ChartCanvas-*.js`) | 177,17 kB gzip | 190 kB gzip |
| Startroute (`index-*.js` + `index-*.css`) | 154,35 kB gzip | 165 kB gzip |

Gegen das ursprüngliche Budget von 180 kB blieben 2,83 kB Luft — 1,6 Prozent. Ein Budget, das zu 98 Prozent ausgeschöpft ist und keine belastbare Notfallmaßnahme hat, steuert nichts mehr; es dokumentiert nur noch einen Zustand.

### Entscheidung

**Das Diagramm-Budget wird auf 190 kB gzip angehoben.** ECharts wird nicht durch eigenes SVG ersetzt: Der Aufwand aus dem Kontextabschnitt ist unverändert hoch, und der Nutzen bliebe hinter der Bibliothek zurück. Der neue Wert lässt Raum für genau eine weitere Ausbaustufe — die Ausgabenentwicklung je Kategorie (Roadmap 4.4) braucht keinen neuen Diagrammtyp, sondern nutzt den bereits registrierten `LineChart`.

Zusätzlich erhält die Startroute ein eigenes, bisher nirgends festgehaltenes Budget von 165 kB gzip.

`pnpm check:bundle` misst beide Werte nach jedem Build und bricht ab, wenn ein Budget überschritten wird oder eine erwartete Datei fehlt. Die CI führt die Prüfung direkt nach dem Build aus. Ein angehobenes Budget ohne Prüfung driftet genauso wie das alte — das vorherige wurde ja gerade um 2,83 kB unterschritten, ohne dass es jemandem auffiel.

### Nächste Ausbaustufe

Reißt auch das neue Budget, gibt es keinen Trick mehr, sondern nur noch echte Entscheidungen — in dieser Reihenfolge zu prüfen:

1. Registrierte Bausteine reduzieren, falls eine Ansicht ihren Diagrammtyp nicht mehr braucht.
2. Den Diagramm-Chunk je Diagrammtyp aufteilen, damit eine Route nur lädt, was sie zeigt.
3. Die Bibliotheksentscheidung neu bewerten. Erst an dieser Stelle steht eigenes SVG wieder zur Debatte, und dann mit eigenem ADR.

## Nachtrag 2026-08-10 (Issue #107)

### Zwei Diagramme auf einer Seite waren nie das Problem

Bei der Umsetzung von #82 wurde die Finanzseite unbedienbar, sobald ein zweites Diagramm erschien: Ein Knopf blieb dreißig Sekunden lang „nicht stabil", Klicks gingen ins Leere. Die naheliegende Erklärung — zwei Zeichenflächen, die sich über konkurrierende `ResizeObserver` gegenseitig neu vermessen — war falsch. Sie ist gemessen widerlegt: Zwei Zeichenflächen kommen bei 320 px auf 220 × 144 Pixel und ändern sich danach kein einziges Mal mehr.

Die Ursache lag woanders. `formatValue` beschriftet nicht nur die erfassten Werte, sondern auch die von der Bibliothek **berechneten Achsen-Teilstriche**. Die liegen zwischen zwei Cent oder unter null. Der damalige Formatter lehnte beides ab und warf. Der Wurf fiel in `setOption` innerhalb eines Effekts an, stieg bis zur Routengrenze auf und ersetzte die **ganze Finanzseite** durch den Fehlerzustand. Playwright sah einen Knopf, der im selben Moment aus dem Dokument verschwand — das las sich wie ein wanderndes Layout, war aber ein Totalausfall der Ansicht.

Der Formatter selbst ist mit #108 behoben (`formatMoneyScale`). Offen blieb die eigentliche Schwäche: **Der Ausfall einer Darstellung riss die Datenansicht mit.**

### Entscheidung

Ein Diagramm ist eine Darstellung, keine Datenquelle. Sein Ausfall bleibt deshalb lokal:

- `Chart` umgibt die Zeichenfläche mit `ChartErrorBoundary`. Scheitert die Bibliothek beim Zeichnen oder lässt sich ihr Chunk offline nicht nachladen, tritt an die Stelle der Grafik ein Satz. Überschrift, Zeitraum, Datenbasis, Legende und die Wertetabelle bleiben stehen, die übrige Seite bleibt bedienbar.
- `ChartCanvas` leitet auch Fehler von außerhalb des React-Ablaufs dorthin — vor allem aus dem `ResizeObserver`, denn ein Neuzeichnen ruft `formatValue` erneut. Ohne diese Weiche bliebe ein solcher Fehler unbehandelt.
- Die Zusicherung aus dem Hauptteil, dass Rahmen, Wertetabelle und Leerzustand ohne die Bibliothek funktionieren, gilt damit auch dann, wenn die Bibliothek zwar geladen ist, aber scheitert.

Diese Entscheidung ändert nichts an der Wahl der Bibliothek, an den registrierten Bausteinen oder an den Budgets.
