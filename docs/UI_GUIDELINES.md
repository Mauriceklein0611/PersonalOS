# UI- und Textleitlinien

## Design-Tokens

Die globalen Tokens stehen in `src/styles/tokens.css`. Komponenten verwenden ausschließlich semantische Variablen und keine eigenen Theme-Farben. Kontrastfarben wie `--accent-contrast` und `--danger-contrast` gehören ebenfalls in die Token-Schicht.

- Typografie: Größen, Gewichte und Zeilenhöhen;
- Abstände: Stufen von `--space-1` bis `--space-16`;
- Radien: `sm`, `md`, `lg`, `xl` und `round`;
- Schatten: `sm`, `md` und `lg`;
- Motion: kurze und normale Dauer sowie eine gemeinsame Easing-Kurve;
- Farben: Glas, Kanten, Text, Akzentverlauf, Danger, Fokus und Skeleton jeweils für Light und Dark;
- Glas: `--glass`, `--glass-strong`, `--glass-opaque`, `--field`, `--edge`, `--hairline` und der Nebel `--canvas-*`, siehe „Glas-Ästhetik“;
- Dichte: `--dense-panel`, `--dense-row`, `--dense-row-active`, `--dense-edge`, `--radius-dense` und `--dense-row-height`, siehe „Quiet Density“;
- Dashboard: Datenpalette, Diagrammhilfslinien und Verlauf, siehe „Dashboard-Visualisierung“.

## Accessibility-Regeln

Die Komponenten orientieren sich an [WCAG 2.2](https://www.w3.org/TR/WCAG22/):

- normaler Text erreicht mindestens 4,5:1 Kontrast;
- große Schrift, UI-Grenzen und Zustandsindikatoren erreichen mindestens 3:1;
- der sichtbare Fokus nutzt einen drei CSS-Pixel breiten Ring mit mindestens 3:1 Zustandskontrast;
- eigenständige interaktive Ziele sind mindestens 44 × 44 CSS-Pixel groß und übertreffen damit das WCAG-AA-Minimum von 24 × 24 CSS-Pixel;
- kein Zustand wird ausschließlich über Farbe vermittelt;
- `prefers-reduced-motion: reduce` deaktiviert dekorative Übergänge, Spinner und Skeleton-Bewegung;
- native Elemente und Semantik werden vor nachgebauten ARIA-Widgets bevorzugt.

## Deutsche Labels

- Jedes Eingabefeld besitzt ein sichtbares, konkretes Label. Placeholder ersetzen kein Label.
- Buttons beschreiben die Aktion: „Speichern“, „Abbrechen“, „Eintrag löschen“ statt „OK“ oder „Weiter“ ohne Kontext.
- Icon Buttons benötigen immer ein zugängliches Textlabel, zum Beispiel „Dialog schließen“.
- Pflichtfelder werden technisch mit `required` und visuell mit einem Stern gekennzeichnet. Der Stern ist für Screenreader ausgeblendet.
- Loading-Texte beschreiben den aktuellen Vorgang, zum Beispiel „Wird gespeichert …“.
- Disabled-Zustände werden nur verwendet, wenn die Aktion aktuell nicht möglich ist. Eine verständliche Erklärung steht im umgebenden Kontext.

## Navigation

Vier Hauptbereiche, mehr nicht:

| Bereich | Pfad | Enthält |
| --- | --- | --- |
| Heute | `/` | Das Dashboard |
| Planen | `/planen` | Aufgaben, Ziele |
| Routinen | `/routinen` | Routinen, Journal |
| Geld | `/geld` | Buchungen, Budgets, Sparziele |

Zwei Nebenbereiche stehen in der Kopfzeile, nicht im Band: **Auswertung** (`/auswertung` mit Überblick und Wochenrückblick) und **Einstellungen**. Beide werden wöchentlich gebraucht, nicht stündlich.

- **Ein Begriff je Bereich**, auf jeder Größe und in jeder Überschrift. Eine gekürzte Zweitbezeichnung für dieselbe Route gibt es nicht; passt ein Wort nicht in seine Spalte, trennt die Silbentrennung es (`hyphens: auto`, das Dokument trägt `lang="de"`).
- Das mobile Band trägt **Icon und Beschriftung**. Das Icon ist Orientierungshilfe, `aria-hidden` und nie ein Ersatz für den Text. Die Beschriftung bleibt mindestens 0,7 rem groß.
- Icons sind inline-SVG in `src/app/navigation/icons.tsx`. Eine Icon-Bibliothek wäre eine neue Laufzeitabhängigkeit und braucht eine Begründung im PR.
- Alle Bedienelemente der Kopfzeile und des Bandes halten `--control-height` (44 px).
- **Kein Bereich liegt hinter einem Menü.** Das mobile Überlaufmenü ist entfallen: Es lag zwischen dem Daumen und der Hälfte der App, darunter die Finanzen mit einer der häufigsten Erfassungsaktionen.
- Ein Hauptbereich mit mehreren Ansichten stellt sie als Reiter über den Inhalt (`AreaLayout`). Der Bereichspfad selbst leitet auf den ersten Reiter weiter.
- **Ein einmal veröffentlichter Pfad bleibt erreichbar.** Ändert sich die Struktur, kommt der alte Pfad in `legacyRouteRedirects` in `src/app/router.tsx` und leitet dauerhaft weiter. Lesezeichen, Verlauf und PWA-Verknüpfungen tragen ihn; ein toter Link kostet Vertrauen in eine App, die sonst nie etwas verliert.

## Fehlermeldungsmuster

Fehler nennen zuerst das lösbare Problem und anschließend die erwartete Korrektur. Sie beschuldigen den Nutzer nicht.

```text
Gib einen Titel mit mindestens einem Zeichen ein.
Wähle ein Datum im Format TT.MM.JJJJ.
Der Import konnte nicht gelesen werden. Wähle einen gültigen PersonalOS-Export.
```

Formfehler sind über `aria-describedby` mit dem Feld verbunden und setzen `aria-invalid`. Kritische Laufzeitfehler verwenden `role="alert"`; neutrale Bestätigungen und Ladehinweise verwenden `role="status"`.

## Destruktive Aktionen, Bestätigung und Undo

Für den Tagesablauf gilt eine einheitliche Regel. Sie richtet sich danach, was eine Aktion mit den Daten tut, nicht danach, wie gefährlich sie klingt.

| Wirkung | Beispiel | Vorgabe |
|---|---|---|
| Zustand wechseln, jederzeit umkehrbar | Aufgabe abschließen, Habit überspringen, Tag wieder öffnen | Keine Bestätigung. Nach der Aktion erscheint ein Hinweis mit „Rückgängig“. |
| Aus der Ansicht entfernen, Datensatz bleibt | Aufgabe oder Routine archivieren | Keine Bestätigung, aber immer „Rückgängig“. |
| Datensatz unwiderruflich entfernen | Check-in entfernen, alle lokalen Daten löschen | Bestätigungsdialog **oder** ein „Rückgängig“, das den vorherigen Stand vollständig wiederherstellt. |

Konkret bedeutet das: „Wieder öffnen“ löscht den Tageseintrag samt Notiz und stellt ihn über „Rückgängig“ mit demselben Status und derselben Notiz wieder her. „Alle lokalen Daten löschen“ ist nicht umkehrbar und verlangt deshalb Bestätigung und einen vorherigen Sicherungsexport.

Ein Hinweis mit „Rückgängig“ verschwindet erst, wenn er geschlossen wird oder die nächste Aktion folgt. Er blockiert die Oberfläche nicht.

## Gemeinsame Bausteine sind verbindlich

Domainseiten bauen keine eigenen Kennzahl-, Fortschritts-, Tracker-, Such-, Signal-, Reiter- oder Diagramm-Bausteine. Sie verwenden `MetricTile`, `ProgressRing`, `ProgressBar`, `RankedBarList`, `TrackerCell`, `SearchField`, `SignalRow`, `ViewTabs` und `Chart` aus `src/components/ui`.

Fehlt eine Variante, wird der gemeinsame Baustein erweitert. Ein lokaler Nachbau wirkt zunächst kleiner, entkoppelt die Seite aber von Tokens, Kontrasttests und Leerzuständen und muss später erneut angefasst werden.

## Signale sind Beobachtungen

`SignalRow` meldet, dass etwas eine Schwelle überschritten hat. Eine Zeile, kein Kasten: Kästen kosten senkrechten Raum, den mobil niemand hat.

Zwei Stufen, mehr nicht. `attention` heißt, dass etwas über eine Schwelle gegangen ist; `info` heißt, dass es etwas zu wissen gibt. Ein Warnrot gibt es nicht — `--danger` bleibt zerstörenden Aktionen vorbehalten. Der farbige Rand links trägt die Stufe, der Text trägt die Aussage; die Farbe ist damit nie die einzige Quelle.

Der Text ist eine Feststellung, kein Imperativ: „3 Aufgaben aus den Vortagen", nicht „Erledige deine Rückstände". Trifft nichts zu, erscheint kein Signalbereich — der leere Zustand ist die Aussage und braucht keine eigene Zeile.

## Freitextsuche in Listen

`SearchField` filtert eine bereits geladene Liste. Es gibt keinen Index und keine domänenübergreifende Suche.

- Der Vergleich läuft über `createSearchMatcher` aus `src/lib/text/search-terms.ts`. Er ignoriert Groß- und Kleinschreibung und Diakritika, sodass „Muller“ auch „Müller“ findet.
- Das Feld nennt die Trefferzahl im Verhältnis zur Grundmenge, zum Beispiel „3 von 12 Aufgaben in dieser Ansicht“. Die Ansage steht in einem `role="status"`-Bereich.
- Zähler in der Umgebung — etwa die Reiter der Aufgabenseite — zeigen dieselbe gefilterte Auswahl wie die Liste darunter. Ein Zähler darf der sichtbaren Länge nie unerklärt widersprechen.
- Der Leerzustand „Kein Treffer“ nennt den Suchbegriff und unterscheidet sich vom Leerzustand ohne Daten.
- Der Suchbegriff wird nicht gespeichert und nicht protokolliert; `autoComplete="off"` verhindert die Formularhistorie des Browsers. Das Journal zeigt auch bei einem Treffer keinen Textauszug über die übliche Verlaufszeile hinaus.

## Glas-Ästhetik

Alle Ansichten folgen einer gemeinsamen Glas-Sprache: durchscheinende Karten mit Blur über einem mehrfarbigen Nebel-Hintergrund. Dark-first mit der Palette „Abendrot“, gleichwertiges Light-Theme mit „Tageslicht“. Siehe Issue #55.

### Seitengrund

- Der Nebel liegt in `.app-canvas` hinter allem und ist rein dekorativ. Er besteht aus `--canvas-base` und vier Flecken `--canvas-blob-1` bis `--canvas-blob-4`.
- Der Nebel ist statisch. Animierte Flecken gibt es nicht. `background-attachment: fixed` gilt erst ab 52 rem, weil ein fixierter Hintergrund auf iOS jeden Scroll-Repaint kostet.
- Die Seite selbst (`.route-page`) ist reines Layout ohne eigene Fläche. Die Karten liegen darin.

### Glas-Flächen

- Eine Karte ist `background: var(--glass)`, `border: 1px solid var(--edge)`, `backdrop-filter: var(--blur-glass)` und ein oberes Inset-Highlight über `--glass-highlight`.
- **Blur nur auf oberster Ebene.** Verschachtelte `backdrop-filter` sind verboten. Flächen innerhalb einer Karte nutzen `--glass-strong` ohne eigenen Blur; Eingabefelder nutzen das deckende `--field`.
- Höchstens etwa acht Glas-Karten gleichzeitig im Viewport. Lange Listen sind Zeilen in einer Karte, keine Karte je Zeile.
- Datenreiche Arbeitsflächen liegen als deckendes Panel **in** der Glasschale und tragen selbst kein Glas, siehe „Quiet Density“.
- `@supports not (backdrop-filter: …)` und `prefers-reduced-transparency: reduce` liefern dieselbe Ansicht mit `--glass-opaque` statt Blur. Der Nebel bleibt in beiden Fällen erhalten.
- Genau ein Glow je Ansicht. In der Regel trägt ihn der primäre Fortschrittsring über `glow`.
- `--accent-gradient` ist Flächenschmuck für erledigte Zellen, Checkboxen, primäre Buttons, Ringfortschritt und Chart-Füllungen. Ein Verlauf codiert niemals eine Kategorie oder einen Status.

### Kontrast auf Glas

Durchscheinende Flächen haben keinen festen Hintergrund. `color-contrast.test.ts` rechnet deshalb die tatsächliche Schichtung nach — Nebelfleck über Grundverlauf, darüber die Helligkeitskorrektur des Filters, darüber das Glas-Alpha, darüber der Text — und prüft immer den ungünstigsten Fleck. Erreicht ein Wert die Schwelle nicht, wird das Token geändert, nicht die Schwelle.

Der Stellhebel ist `brightness()` in `--blur-glass`: Es dunkelt den Nebel **unter** der Karte ab und lässt dessen Farbe und Verlauf sichtbar. Ein deckender Grundton über der Karte würde denselben Kontrast erzeugen, aber genau das zerstören, was die Fläche als Glas lesbar macht. Mehr Glas-Alpha hilft im Dark-Theme nicht: Weißes Glas hellt die Karte weiter auf.

**Text steht immer auf einer Glasfläche, nie auf dem blanken Nebel.** Ausnahme sind Überschriften in `--text`; der Test deckt diesen Fall ausdrücklich ab. Gedämpfter Text, Fehlertext und Datenfarben erreichen ihre Schwelle nur auf Glas — dafür gibt es `.page-section` für Abschnitte und `.page-alert` für seitenweite Meldungen.

## Quiet Density

Datenreiche Arbeitsflächen — lange Listen, Tracker, Tabellen und Planungsraster — werden kompakter und ruhiger als der Rest der App. Die Regeln hier sind **additiv**: Sie gelten innerhalb dichter Flächen und ändern nichts an Ansichten außerhalb davon. Siehe [ADR 0014](decisions/0014-quiet-density-dense-surfaces.md).

Der Grundgedanke in einem Satz: **Glas ist der Rahmen, das dichte Panel ist der Inhalt.**

### Die dichte Fläche

- `.ui-dense-panel` ist die Arbeitsfläche. Sie ist **deckend** und trägt kein `backdrop-filter`. Damit sieht sie mit Blur, ohne Blur-Unterstützung und bei `prefers-reduced-transparency: reduce` gleich aus und braucht keine Ausweichfassung.
- Ein Panel liegt in der Glasschale, nie über einem zweiten Panel. Verschachtelte dichte Flächen gibt es nicht.
- Innerhalb des Panels gilt `--radius-dense` statt `--radius-xl`. Schatten entfallen; Rahmen sind `--dense-edge` und bleiben 1 px.
- Ziffern stehen tabellarisch. Das Panel setzt `font-variant-numeric: tabular-nums`, KPIs, Datumsraster und Fortschrittswerte brauchen deshalb keine eigene Regel mehr.
- Der Fokusring liegt innerhalb dichter Flächen **innen** (`outline-offset: -3px`), weil die Panelfläche beschnitten ist. Breite und Kontrast bleiben unverändert.

### Hero

- Höchstens eine Herofläche je Ansicht, und nur dort, wo sie eine Aussage trägt. Auf einer Liste trägt sie keine.
- Der Hero verdrängt die erste Erfassungsaktion nicht aus dem ersten mobilen Viewport. Passt beides nicht, weicht der Hero.
- **Erfassen steht vor Auswerten.** Kennzahlen, Ring und Signale beschreiben, was war; sie sind das Ergebnis, nicht der Einstieg. Auf der Tagesübersicht und im Bereich Geld steht die Erfassung deshalb direkt hinter dem Hero.
- Ein langer Fließtext gehört nicht neben ein Element fester Breite. Bei 320 px bleibt neben einem 7,5-rem-Ring keine 150 px breite Spalte, in der ein Satz noch lesbar umbricht — er wächst dort auf ein Vielfaches seiner Höhe.

### Überlagernde Hinweise

- Ein fixierter Hinweis darf weder die Kopfzeile noch eine primäre Aktion überdecken. Die Kopfzeile klebt selbst am oberen Rand; ein Hinweis mit voller Breite liegt dort dauerhaft über ihr.
- Auf Mobil steht ein selten erscheinender Hinweis — etwa der PWA-Status — deshalb im Fluss und schiebt den Inhalt, statt ihn zu verdecken. Ab 52 rem ist daneben Platz für die fixierte Fassung.

### Karten

- Eine Karte gruppiert **verschiedenartige** Inhalte. Gleichartige Datensätze gruppiert ein Panel.
- Karte je Datensatz ist ausgeschlossen, sobald eine Liste mehr als etwa fünf Einträge zeigen kann. Die bisherige Obergrenze von rund acht Glaskarten im Viewport bleibt daneben bestehen.

### Listenzeilen

- `.ui-dense-row` ist eine Zeile ohne eigene Fläche. Getrennt wird über eine Haarlinie zwischen den Einträgen, nicht über Abstand, Rahmen und Radius je Zeile.
- Eine Zeile ist mindestens `--dense-row-height` (44 px) hoch. Dichte spart Fläche, nicht Trefferfläche.
- Genau eine primäre Aktion je Zeile ist sichtbar hervorgehoben. Weitere Aktionen bleiben erreichbar, aber ruhig; vier gleich schwere Aktionen sind keine Auswahl, sondern eine Suchaufgabe.
- Die aktuelle Auswahl trägt `--dense-row-active`, einen Akzentbalken links **und** `aria-current`. Die Fläche allein trägt den Zustand nie.
- Leere Platzhalterzeilen gibt es nicht. Eine Liste ohne Einträge zeigt ihren Leerzustand.

### Trackerzellen

- Zeilen sind Einträge, Spalten sind Tage — wie unter „Tracker-Raster“. Innerhalb eines dichten Panels gilt zusätzlich: keine Fläche je Zelle außer für Zustand, kein eigener Radius über `--radius-cell` hinaus.
- Fehlende oder zukünftige Tage bleiben `Keine Angabe`. Ein Nenner aus Kalendertagen erzeugt sonst ein `0 %`, das niemand erfasst hat.
- Das Raster scrollt in seinem eigenen Container. Auf Mobil stehen nie sieben schmale Spalten nebeneinander, nur weil die Woche sieben Tage hat.

### Tabs

Die Ansichten einer Domainseite stehen in `ViewTabs`. Die Bereichsreiter der Kopfzeile bleiben davon unberührt; sie sind Navigation (`AreaLayout`), keine Reiter im ARIA-Sinn.

- Reiter laufen nicht waagerecht aus dem Viewport. Die Reihe bricht um: bis 34 rem höchstens zwei nebeneinander, darüber alle in einer Zeile. Eine seitlich scrollende Reihe versteckt genau die Ansichten, die hinten stehen.
- Ein Reiter darf schmaler werden als seine Beschriftung; `hyphens: auto` trennt sie. Ein langes Wort schiebt die Reihe sonst wieder über den Rand.
- Der aktive Reiter ist an Text, Position, `aria-selected` und Akzent erkennbar, nicht allein am Farbton.
- Tastatur nach ARIA-Tab-Pattern: ein Tabulatorschritt in die Reihe, Links und Rechts wechseln darin, Pos1 und Ende springen an die Ränder. Die Auswahl folgt dem Fokus, weil die Panels bereits geladene lokale Daten zeigen.
- Der Zähler eines Reiters steht ausdrücklich im zugänglichen Namen („Inbox: 3 Aufgaben“). Aus benachbarten Elementen zusammengesetzt wird daraus je nach Umsetzung „Inbox3 Aufgaben“ — der Zähler ist eine Aussage und darf nicht am Zusammenfügen hängen.
- Das Panel verweist mit `aria-labelledby` über `viewTabId` auf den ausgewählten Reiter zurück.

### Diagramme

- In einer Ansicht mit Check-in-Raster steht das Raster **vor** der Auswertung. Das Diagramm erklärt, was bereits erfasst wurde; es ist nie der Einstieg.
- Innerhalb dichter Flächen bleibt das Diagramm zurückhaltend: Gitternetz `--chart-grid`, keine Verlaufsfüllung als Blickfang, kein Glow.
- Die Grenzen aus „Diagramme“ gelten unverändert: höchstens drei Serien, Zeitraum und Datenbasis als Text, dieselben Werte zusätzlich als Tabelle.

### Nicht übernommen

Aus dem Vorbild ausdrücklich **nicht** übernommen: `0 %` für fehlende oder zukünftige Daten, `Habits × Kalendertage` als pauschaler Nenner, Pflicht-Emojis, Ampelfarben oder Regenbogen als einzige Zustandsquelle, feste leere Taskzeilen und ein vereinfachter Mindset-Score.

## Dashboard-Visualisierung

Dashboard-, Fortschritts- und Tracker-Ansichten folgen einer gemeinsamen, dunkel geprägten Sprache. Sie ergänzt die bestehenden Tokens und ersetzt keine Accessibility-Regel.

### Flächen und Tiefe

- Der Seitengrund ist der Nebel, die Karte liegt mit `--glass` darüber, verschachtelte Flächen nutzen `--glass-strong`.
- Trennung entsteht über Flächenhelligkeit, Radius und weichen Schatten. `--hairline` bleibt eine 1-px-Linie und ersetzt keine Fläche.
- Radien: Karte `--radius-xl`, Tile `--radius-tile`, Zelle `--radius-cell`, Pill `--radius-round`.
- Dark-first bedeutet nicht „nur dunkel“. Jedes Token existiert für Light und Dark und ist im Kontrasttest abgedeckt.

### Datenpalette

- `--data-1` bis `--data-6` sind die einzigen Serien- und Kategoriefarben; `--data-1-soft` bis `--data-6-soft` sind ihre weichen Flächen.
- Farbe ist immer Zusatz. Jede Serie trägt zusätzlich ein Label und ein Muster: `dataSeriesMarkers` liefert das Zeichen für Legenden, `dataSeriesDashes` das Strichmuster für Linien.
- Datenfarben erreichen als grafisches Element mindestens 3:1 gegen Karte und Seitengrund. Zeichen auf einer weichen Fläche erreichen 4,5:1.
- Verläufe sind ausschließlich Flächenschmuck, etwa `--accent-gradient`. Ein Verlauf codiert niemals eine Kategorie oder einen Status.
- Glow ist auf genau ein Element je Ansicht begrenzt und trägt nie allein eine Aussage. Neon wird nicht eingesetzt.

### Zahlen und Zustände

- Kennzahl-Tiles zeigen kleines Label, große Zahl und kurzen Kontexthinweis; Ziffern stehen tabellarisch.
- Zahlen werden nicht gekürzt, solange die ausgeschriebene Entsprechung fehlt.
- Ohne Datenbasis steht überall `Keine Angabe` statt `0 %`. Der Ring bleibt dann leer, der Balken entfällt.
- Kennzahl-Tile, Ringfortschritt, Fortschrittsbalken, Ranglisten-Balken und Tracker-Zelle geben ihren Wert immer als Text aus. Ring, Balken und Diagrammfläche sind Dekoration und `aria-hidden`.
- Ein Gegenzähler wie „107 offen“ bleibt neutral und suggeriert keine Zielvorgabe. Für unterbrochene Serien gibt es kein Warnrot und keine künstliche Dringlichkeit.

### Tracker-Raster

- Zeilen sind Einträge, Spalten sind Tage. Jede Zelle trägt ein Zeichen und ein Textlabel; Farbe kommt zusätzlich dazu.
- Eine Wochenfarbe aus der Datenpalette ist erlaubt. Die Wochengrenze bleibt zusätzlich über Abstand oder Spaltenkopf erkennbar.
- Das Raster scrollt in `.ui-tracker-scroller` und erzeugt keinen Dokumentüberlauf. Der Container ist fokussierbar, damit er ohne Zeigegerät scrollbar bleibt.
- Eine Zelle mit `onClick` wird zur Schaltfläche und hält als eigenständiges Ziel 44 × 44 CSS-Pixel. Ihr zugänglicher Name nennt Bezug, Zustand und Wirkung, zum Beispiel „Lesen am 3. August 2026: Offen. Als erledigt eintragen“.

### Diagramme

- Höchstens drei Serien je Diagramm, höchstens fünf Einträge je Ranglisten-Balkenliste.
- Das Gitternetz nutzt `--chart-grid` und bleibt zurückhaltend; Beschriftungen erreichen den normalen Textkontrast.
- Jedes Diagramm nennt Zeitraum und Datenbasis. `Chart` erzwingt beides und stellt dieselben Werte zusätzlich als Tabelle bereit.
- Linien-, Flächen- und Balkendiagramme laufen über Apache ECharts, siehe [ADR 0008](decisions/0008-echarts-for-charts.md). Die Bibliothek wird tree-shaken und lazy geladen und bekommt ihre Farben zur Laufzeit aus den CSS-Tokens.
- `ProgressRing`, `ProgressBar`, `RankedBarList` und `TrackerCell` bleiben eigene Komponenten. Eine weitere Chart-Bibliothek benötigt eine Begründung und ein ADR.
- `prefers-reduced-motion: reduce` schaltet auch die Diagramm-Animation ab.

### Motion

Neue Bewegung beschränkt sich auf ein kurzes Einblenden und den Fortschrittsübergang mit `--duration-fast`. `prefers-reduced-motion: reduce` schaltet beides vollständig ab.

## Komponentenübersicht

Die lokale Route `/komponenten` zeigt Normal-, simulierte Hover-/Fokus-, Fehler-, Disabled- und Loading-Zustände sowie den Fallback ohne Blur. Sie enthält ausschließlich synthetische Texte und verändert keine persistierten Daten.

## Datenschutz in der Oberfläche

- Datenschutztexte versprechen nicht „vollständig sicher“, sondern erklären lokale Speicherung und Grenzen.
- Nutzertexte bleiben Text und werden nicht als HTML oder Markdown interpretiert. Eine spätere formatierte Darstellung benötigt einen eigenen, geprüften Sanitizing-Vertrag.
- Externe Ziele werden nur über die gemeinsame `ExternalLink`-Komponente geöffnet; sie akzeptiert ausschließlich HTTPS ohne URL-Zugangsdaten und unterdrückt Opener sowie Referrer.
