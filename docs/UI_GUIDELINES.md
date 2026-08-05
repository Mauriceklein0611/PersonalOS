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
| Aus der Ansicht entfernen, Datensatz bleibt | Aufgabe oder Gewohnheit archivieren | Keine Bestätigung, aber immer „Rückgängig“. |
| Datensatz unwiderruflich entfernen | Check-in entfernen, alle lokalen Daten löschen | Bestätigungsdialog **oder** ein „Rückgängig“, das den vorherigen Stand vollständig wiederherstellt. |

Konkret bedeutet das: „Wieder öffnen“ löscht den Tageseintrag samt Notiz und stellt ihn über „Rückgängig“ mit demselben Status und derselben Notiz wieder her. „Alle lokalen Daten löschen“ ist nicht umkehrbar und verlangt deshalb Bestätigung und einen vorherigen Sicherungsexport.

Ein Hinweis mit „Rückgängig“ verschwindet erst, wenn er geschlossen wird oder die nächste Aktion folgt. Er blockiert die Oberfläche nicht.

## Gemeinsame Bausteine sind verbindlich

Domainseiten bauen keine eigenen Kennzahl-, Fortschritts-, Tracker- oder Diagramm-Bausteine. Sie verwenden `MetricTile`, `ProgressRing`, `ProgressBar`, `RankedBarList`, `TrackerCell` und `Chart` aus `src/components/ui`.

Fehlt eine Variante, wird der gemeinsame Baustein erweitert. Ein lokaler Nachbau wirkt zunächst kleiner, entkoppelt die Seite aber von Tokens, Kontrasttests und Leerzuständen und muss später erneut angefasst werden.

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
- `@supports not (backdrop-filter: …)` und `prefers-reduced-transparency: reduce` liefern dieselbe Ansicht mit `--glass-opaque` statt Blur. Der Nebel bleibt in beiden Fällen erhalten.
- Genau ein Glow je Ansicht. In der Regel trägt ihn der primäre Fortschrittsring über `glow`.
- `--accent-gradient` ist Flächenschmuck für erledigte Zellen, Checkboxen, primäre Buttons, Ringfortschritt und Chart-Füllungen. Ein Verlauf codiert niemals eine Kategorie oder einen Status.

### Kontrast auf Glas

Durchscheinende Flächen haben keinen festen Hintergrund. `color-contrast.test.ts` rechnet deshalb die tatsächliche Schichtung nach — Nebelfleck über Grundverlauf, darüber die Helligkeitskorrektur des Filters, darüber das Glas-Alpha, darüber der Text — und prüft immer den ungünstigsten Fleck. Erreicht ein Wert die Schwelle nicht, wird das Token geändert, nicht die Schwelle.

Der Stellhebel ist `brightness()` in `--blur-glass`: Es dunkelt den Nebel **unter** der Karte ab und lässt dessen Farbe und Verlauf sichtbar. Ein deckender Grundton über der Karte würde denselben Kontrast erzeugen, aber genau das zerstören, was die Fläche als Glas lesbar macht. Mehr Glas-Alpha hilft im Dark-Theme nicht: Weißes Glas hellt die Karte weiter auf.

**Text steht immer auf einer Glasfläche, nie auf dem blanken Nebel.** Ausnahme sind Überschriften in `--text`; der Test deckt diesen Fall ausdrücklich ab. Gedämpfter Text, Fehlertext und Datenfarben erreichen ihre Schwelle nur auf Glas — dafür gibt es `.page-section` für Abschnitte und `.page-alert` für seitenweite Meldungen.

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
