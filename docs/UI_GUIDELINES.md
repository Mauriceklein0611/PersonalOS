# UI- und Textleitlinien

## Design-Tokens

Die globalen Tokens stehen in `src/styles/tokens.css`. Komponenten verwenden ausschließlich semantische Variablen und keine eigenen Theme-Farben. Kontrastfarben wie `--accent-contrast` und `--danger-contrast` gehören ebenfalls in die Token-Schicht.

- Typografie: Größen, Gewichte und Zeilenhöhen;
- Abstände: Stufen von `--space-1` bis `--space-16`;
- Radien: `sm`, `md`, `lg`, `xl` und `round`;
- Schatten: `sm`, `md` und `lg`;
- Motion: kurze und normale Dauer sowie eine gemeinsame Easing-Kurve;
- Farben: Surface, Text, Border, Accent, Danger, Fokus und Skeleton jeweils für Light und Dark;
- Dashboard: Flächen, Datenpalette, Diagrammhilfslinien und Verlauf, siehe „Dashboard-Visualisierung“.

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

Domainseiten bauen keine eigenen Kennzahl-, Fortschritts-, Tracker- oder Diagramm-Bausteine. Sie verwenden `MetricTile`, `ProgressRing`, `ProgressBar`, `RankedBarList`, `TrackerCell`, `Sparkline` und `ChartFrame` aus `src/components/ui`.

Fehlt eine Variante, wird der gemeinsame Baustein erweitert. Ein lokaler Nachbau wirkt zunächst kleiner, entkoppelt die Seite aber von Tokens, Kontrasttests und Leerzuständen und muss später erneut angefasst werden.

## Dashboard-Visualisierung

Dashboard-, Fortschritts- und Tracker-Ansichten folgen einer gemeinsamen, dunkel geprägten Sprache. Sie ergänzt die bestehenden Tokens und ersetzt keine Accessibility-Regel.

### Flächen und Tiefe

- Der Seitengrund ist `--dashboard-canvas`, die Karte liegt mit `--dashboard-card` eine Helligkeitsstufe darüber, verschachtelte Flächen nutzen `--dashboard-card-raised`.
- Trennung entsteht über Flächenhelligkeit, Radius und weichen Schatten. `--dashboard-hairline` bleibt eine 1-px-Linie und ersetzt keine Fläche.
- Radien: Karte `--radius-lg` bis `--radius-xl`, Tile `--radius-md` bis `--radius-lg`, Pill `--radius-round`.
- Dark-first bedeutet nicht „nur dunkel“. Jedes Token existiert für Light und Dark und ist im Kontrasttest abgedeckt.

### Datenpalette

- `--data-1` bis `--data-6` sind die einzigen Serien- und Kategoriefarben; `--data-1-soft` bis `--data-6-soft` sind ihre weichen Flächen.
- Farbe ist immer Zusatz. Jede Serie trägt zusätzlich ein Label und ein Muster: `dataSeriesMarkers` liefert das Zeichen für Legenden, `dataSeriesDashes` das Strichmuster für Linien.
- Datenfarben erreichen als grafisches Element mindestens 3:1 gegen Karte und Seitengrund. Zeichen auf einer weichen Fläche erreichen 4,5:1.
- Verläufe sind ausschließlich Flächenschmuck, etwa `--gradient-hero`. Ein Verlauf codiert niemals eine Kategorie oder einen Status.
- Glow und Neon werden nicht eingesetzt.

### Zahlen und Zustände

- Kennzahl-Tiles zeigen kleines Label, große Zahl und kurzen Kontexthinweis; Ziffern stehen tabellarisch.
- Zahlen werden nicht gekürzt, solange die ausgeschriebene Entsprechung fehlt.
- Ohne Datenbasis steht überall `Keine Angabe` statt `0 %`. Der Ring bleibt dann leer, der Balken entfällt.
- Kennzahl-Tile, Ringfortschritt, Fortschrittsbalken, Ranglisten-Balken und Tracker-Zelle geben ihren Wert immer als Text aus. Ring, Balken und Sparkline sind Dekoration und `aria-hidden`.
- Ein Gegenzähler wie „107 offen“ bleibt neutral und suggeriert keine Zielvorgabe. Für unterbrochene Serien gibt es kein Warnrot und keine künstliche Dringlichkeit.

### Tracker-Raster

- Zeilen sind Einträge, Spalten sind Tage. Jede Zelle trägt ein Zeichen und ein Textlabel; Farbe kommt zusätzlich dazu.
- Eine Wochenfarbe aus der Datenpalette ist erlaubt. Die Wochengrenze bleibt zusätzlich über Abstand oder Spaltenkopf erkennbar.
- Das Raster scrollt in `.ui-tracker-scroller` und erzeugt keinen Dokumentüberlauf. Der Container ist fokussierbar, damit er ohne Zeigegerät scrollbar bleibt.
- Eine Zelle mit `onClick` wird zur Schaltfläche und hält als eigenständiges Ziel 44 × 44 CSS-Pixel. Ihr zugänglicher Name nennt Bezug, Zustand und Wirkung, zum Beispiel „Lesen am 3. August 2026: Offen. Als erledigt eintragen“.

### Diagramme

- Höchstens drei Serien je Diagramm, höchstens fünf Einträge je Ranglisten-Balkenliste.
- Das Gitternetz nutzt `--chart-grid` und bleibt zurückhaltend; Beschriftungen erreichen den normalen Textkontrast.
- Jedes Diagramm nennt Zeitraum und Datenbasis. `ChartFrame` erzwingt beides.
- Diagramme werden aus SVG-Primitiven gebaut. Eine externe Chart-Bibliothek benötigt eine Begründung und ein ADR.

### Motion

Neue Bewegung beschränkt sich auf ein kurzes Einblenden und den Fortschrittsübergang mit `--duration-fast`. `prefers-reduced-motion: reduce` schaltet beides vollständig ab.

## Komponentenübersicht

Die lokale Route `/komponenten` zeigt Normal-, simulierte Hover-/Fokus-, Fehler-, Disabled- und Loading-Zustände. Sie enthält ausschließlich synthetische Texte und verändert keine persistierten Daten.

## Datenschutz in der Oberfläche

- Datenschutztexte versprechen nicht „vollständig sicher“, sondern erklären lokale Speicherung und Grenzen.
- Nutzertexte bleiben Text und werden nicht als HTML oder Markdown interpretiert. Eine spätere formatierte Darstellung benötigt einen eigenen, geprüften Sanitizing-Vertrag.
- Externe Ziele werden nur über die gemeinsame `ExternalLink`-Komponente geöffnet; sie akzeptiert ausschließlich HTTPS ohne URL-Zugangsdaten und unterdrückt Opener sowie Referrer.
