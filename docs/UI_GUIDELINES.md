# UI- und Textleitlinien

## Design-Tokens

Die globalen Tokens stehen in `src/styles/tokens.css`. Komponenten verwenden ausschließlich semantische Variablen und keine eigenen Theme-Farben. Kontrastfarben wie `--accent-contrast` und `--danger-contrast` gehören ebenfalls in die Token-Schicht.

- Typografie: Größen, Gewichte und Zeilenhöhen;
- Abstände: Stufen von `--space-1` bis `--space-16`;
- Radien: `sm`, `md`, `lg`, `xl` und `round`;
- Schatten: `sm`, `md` und `lg`;
- Motion: kurze und normale Dauer sowie eine gemeinsame Easing-Kurve;
- Farben: Flächen, Kanten, Text, Akzentverlauf, Akzentschrift (`--accent-text`), Danger, Fokus und Skeleton jeweils für Light und Dark;
- Flächen: `--shell-glass`, `--glass`, `--glass-strong`, `--glass-opaque`, `--field`, `--edge`, `--hairline` und der Nebel `--canvas-*`, siehe „Neo Quiet Density“;
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
- native Elemente und Semantik werden vor nachgebauten ARIA-Widgets bevorzugt;
- Überschriften steigen um höchstens eine Ebene. `Card` nimmt dafür `headingLevel` entgegen: `3` innerhalb eines Abschnitts mit `h2`, `2` direkt unter der Seitenüberschrift;
- ein Bereichswechsel setzt den Dokumenttitel aus der `h1` der Seite und verschiebt den Fokus in den Inhaltsbereich;
- zwei Landmarken tragen nie denselben Namen gleichzeitig.

Der Stand dieser Regeln ist im [Accessibility-Audit](audits/accessibility-audit.md) belegt; `e2e/accessibility.spec.ts` hält ihn.

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

## Ersteinrichtung

- Die First-Run-Karte steht auf „Heute“ direkt nach der Erfassungsfläche. Sie
  verdrängt die erste Aufgabe und die schnelle Ausgabe nicht aus dem ersten
  mobilen Viewport.
- Der erste Absatz unterscheidet statisches Hosting ausdrücklich von
  Synchronisation. Es gibt kein Konto, keine Telemetrie und keine
  automatisch erzeugten Beispieldaten.
- Zwei Grundlagen sind erforderlich: mindestens eine Aufgabe und eine Routine.
  Eine Finanzkategorie ist sichtbar als optional markiert.
- Schrittzustände stammen aus Fachdatensätzen. Nur die bewusste
  Ausblendentscheidung wird im Settings-Datensatz gespeichert.
- „Überspringen“ bleibt jederzeit verfügbar. „Einrichtung abschließen“ wird
  erst nach beiden Grundlagen aktiv; die restliche App ist nie blockiert.
- Nach beiden Grundlagen nennt die Karte Export und Installation als nächsten
  freiwilligen Schritt. Eine Berechtigungs- oder Installationsaufforderung
  öffnet sie nicht selbst.
- Die Einstellungen bieten „Ersteinrichtung erneut anzeigen“.

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

Domainseiten bauen keine eigenen Seitenkopf-, Kennzahl-, Fortschritts-, Tracker-, Such-, Signal-, Reiter- oder Diagramm-Bausteine. Sie verwenden `PageToolbar`, `MetricTile`, `ProgressRing`, `ProgressBar`, `RankedBarList`, `TrackerCell`, `SearchField`, `SignalRow`, `ViewTabs` und `Chart` aus `src/components/ui`.

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

## Neo Quiet Density

Alle Ansichten folgen einer gemeinsamen dunklen, ruhigen Arbeitsfläche mit präzisen Neon-Akzenten. Quiet Density ist seit Issue #150 und [ADR 0015](decisions/0015-neo-quiet-density.md) die Grundsprache, nicht mehr nur eine additive Ausnahme. Die historischen Token- und Klassennamen der Glasfamilie bleiben kompatibel, bezeichnen außerhalb der Shell aber deckende Flächen.

### Seitengrund

- Der sehr dunkle Seitengrund liegt in `.app-canvas` hinter allem. Vier schwache Neonflecken geben Tiefe, ohne eine zweite Informationsebene zu erzeugen.
- Der Nebel ist statisch. Animierte Flecken gibt es nicht. `background-attachment: fixed` gilt erst ab 52 rem, weil ein fixierter Hintergrund auf iOS jeden Scroll-Repaint kostet.
- Die Seite selbst (`.route-page`) ist reines Layout ohne eigene Fläche. Die Karten liegen darin.

### Flächenfamilie

- Shell, mobile Navigation und Hero dürfen `--shell-glass` mit genau einer Blur-Ebene verwenden. Sie sind die atmosphärische Ausnahme.
- Karten und Diagramme verwenden das deckende `--glass`; innere Flächen `--glass-strong`, Eingabefelder `--field` und datenreiche Panels `--dense-panel`.
- Lange Listen sind Zeilen in einem Panel, keine Karte je Datensatz. Schatten bleiben schwach, Radien klein und Kanten präzise.
- Reduced Transparency ändert nur Shell und Hero. Arbeitsflächen sehen mit und ohne Blur identisch aus.
- Genau ein starker Glow je Ansicht. Er liegt auf primärem Fortschritt oder der wichtigsten Kennzahl, nie auf einem ganzen Container.
- `--accent-gradient` markiert Primäraktion und Fortschritt. Datenkategorien verwenden die sechs einzelnen `--data-*`-Farben.

### Neon und Kontrast

- Neon-Lime und Cyan sind primäre Akzente; Magenta, Violett, Amber und Blau erweitern ausschließlich die Datenpalette.
- Knallige Farbe trägt große Zahlen, Fortschritt, Fokus, aktuelle Auswahl, Abschluss und Datenserie. Fließtext und Sekundäraktionen bleiben neutral.
- `--accent-1` ist eine Flächen- und Linienfarbe. Akzentuierte Schrift verwendet `--accent-text`; Buttons auf dem Verlauf verwenden `--accent-contrast`.
- `color-contrast.test.ts` prüft jede deckende Fläche direkt und berechnet für `--shell-glass` weiterhin den ungünstigsten Nebelfleck.
- Farbe bleibt Zusatz. Label, Zahl, Zeichen, Muster, Position und ARIA tragen jeden Zustand auch ohne Farbwahrnehmung.

Der Grundgedanke in einem Satz: **Die Fläche bleibt leise, die relevante Zahl darf leuchten.**

### Vier Flächentypen

Jede Kernroute benennt über `data-surface` genau einen Flächentyp aus
[ADR 0018](decisions/0018-full-surface-page-patterns.md):

- `work` für Listen, Tabellen, Tracker und Planungsraster; nutzt die volle
  verfügbare Inhaltsbreite;
- `overview` für wenige priorisierte Signale und Kennzahlen;
- `editor` für Journal und konzentrierte Eingaben mit begrenzter Textzeile;
- `settings` für Konfiguration und Stammdaten mit begrenzter Lesebreite.

`PageToolbar` ordnet Seitentitel, optionalen Zeitraum und wenige Aktionen. Sie
ist deckend und kompakt; sie ist kein zweiter Hero. Filter bleiben direkt bei
der zugehörigen Liste oder Arbeitsfläche. Auf Mobil brechen Zeitraum und
Aktionen um, bevor ein Ziel schmaler als 44 px wird.

Bestehende Routen ohne `data-surface` behalten bis zu ihrem zuständigen
Domainumbau die frühere Breite. Der Flächentyp ist eine Darstellungsentscheidung
und erzeugt weder eine neue Route noch persistierten Zustand.

### Die dichte Fläche

- `.ui-dense-panel` ist die Arbeitsfläche. Sie ist **deckend** und trägt kein `backdrop-filter`. Damit sieht sie mit Blur, ohne Blur-Unterstützung und bei `prefers-reduced-transparency: reduce` gleich aus und braucht keine Ausweichfassung.
- Ein Panel liegt in einer ruhigen Karte, nie über einem zweiten Panel. Verschachtelte dichte Flächen gibt es nicht.
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
- Karte je Datensatz ist ausgeschlossen, sobald eine Liste mehr als etwa fünf Einträge zeigen kann. Die bisherige Obergrenze von rund acht Karten im Viewport bleibt daneben bestehen.

### Listenzeilen

- `.ui-dense-row` ist eine Zeile ohne eigene Fläche. Getrennt wird über eine Haarlinie zwischen den Einträgen, nicht über Abstand, Rahmen und Radius je Zeile.
- Eine Zeile ist mindestens `--dense-row-height` (44 px) hoch. Dichte spart Fläche, nicht Trefferfläche.
- Genau eine primäre Aktion je Zeile ist **sichtbar**. Weitere Aktionen liegen hinter einer Ausklappfläche; vier gleich schwere Aktionen sind keine Auswahl, sondern eine Suchaufgabe.
- Eine solche Ausklappfläche baut auf `<details>`/`<summary>`: Rolle, Tastaturbedienung und Umschalten bringt der Browser mit. Escape schließt sie zusätzlich, und nach einer Aktion kehrt der Fokus auf die Schaltfläche zurück — die Zeile darunter verschwindet mit der Aktion oft aus der Liste.
- Der Inhalt einer geschlossenen Ausklappfläche wird **nicht gerendert**. Auf das Verbergen durch `<details>` allein ist kein Verlass, sobald der Inhalt absolut positioniert ist.
- Jede Aktion nennt ihren Datensatz im eigenen zugänglichen Namen. Der Name der Ausklappfläche allein reicht nicht: Wer die Liste per Schaltfläche durchgeht, hört sonst dreimal „Bearbeiten“ ohne Bezug.
- Die aktuelle Auswahl trägt `--dense-row-active`, einen Akzentbalken links **und** `aria-current`. Die Fläche allein trägt den Zustand nie.
- Leere Platzhalterzeilen gibt es nicht. Eine Liste ohne Einträge zeigt ihren Leerzustand.

### Trackerzellen

- Zeilen sind Einträge, Spalten sind Tage — wie unter „Tracker-Raster“. Innerhalb eines dichten Panels gilt zusätzlich: keine Fläche je Zelle außer für Zustand, kein eigener Radius über `--radius-cell` hinaus.
- Fehlende oder zukünftige Tage bleiben `Keine Angabe`. Ein Nenner aus Kalendertagen erzeugt sonst ein `0 %`, das niemand erfasst hat.
- Das Raster scrollt in seinem eigenen Container. Auf Mobil stehen nie sieben schmale Spalten nebeneinander, nur weil die Woche sieben Tage hat.
- `TrackerCell` kennt `outside` für Tage außerhalb des Zeitraums eines Eintrags. Die Zelle bleibt dort ohne Zeichen und ohne Rahmen: Es gab nichts zu tun, und ein weiteres Zeichen würde eine Erwartung andeuten, die nie bestand. Der Text der Zelle nennt den Zustand trotzdem.

### Monatsraster

Ein Monatsraster zeigt Einträge × reale Kalendertage des gewählten Monats. Es ist die Ansicht selbst, nicht ihre Auswertung, und trägt deshalb kein Diagramm.

- Sechs Zustände je Zelle: erledigt, offen (vergangener fälliger Tag ohne Eintrag), übersprungen, nicht fällig, später fällig und außerhalb des Zeitraums. `offen` und `später fällig` bleiben getrennt — nur der vergangene Tag geht in eine Quote ein.
- Der Nenner bleibt `counted = max(done, target − skipped)` aus der Fachlogik. `Einträge × Kalendertage` gibt es nicht, und die Quote endet am heutigen Tag, nicht am Monatsende.
- Der Wochenanfang folgt `settings.weekStartsOn`. Die Woche ist zusätzlich strukturell markiert: ein Wochenkopf über den Spalten und eine Linie an der Grenze, nicht nur eine Farbe.
- Ein ganzer Monat passt auf keiner Breite ohne Scroller. Die stehende erste Spalte trägt deshalb Name **und** Quote, damit die Zahl ohne waagerechtes Scrollen lesbar bleibt.
- Die Tageszusammenfassung steht als Fußzeile unter ihren Spalten und nennt Zähler und Nenner. Ohne zählende Einheit steht dort `Keine Angabe`.
- Eine kompakte Legende steht **hinter** dem Raster: Sie erklärt, was dort schon zu sehen ist.

### Wochenplan

Eine Wochenplanung zeigt sieben Tagesbereiche aus **einer** Datenquelle — dem Plandatum des Datensatzes. Sie ersetzt keine Liste und speichert keine eigene Woche.

- Der Nenner eines Tages sind alle Datensätze mit diesem Plandatum, offene wie abgeschlossene. Ein Abschluss verschiebt zwischen den Zählern und lässt den Nenner unberührt; ein schrumpfender Nenner ließe den Fortschritt springen.
- Ein Tag ohne Plandatum zeigt `Keine Angabe`. Ein Datensatz ohne Plandatum bleibt in der Inbox und wird keinem Tag zugeordnet.
- Auf Mobil steht ein Wochentagsstreifen über **genau einem** Tagesbereich; die übrigen Tage sind nicht im Fluss. Sieben Spalten nebeneinander sind erst dort sinnvoll, wo eine Spalte zwei 44-px-Ziele neben einem Titel trägt — darunter bricht die Zeile um, statt die Ziele zu verkleinern.
- Umgeplant wird dort, wo das Datum gespeichert wird: in der Bearbeitung. Drag & Drop gibt es nicht; es hätte keine Tastaturentsprechung und keinen Zustand, den ein Screenreader ansagen könnte.

### Vier Rollen der Woche

„Woche“ ist ein Zeitraum, keine eigenständige Funktion. Jede Wochenfläche
beginnt deshalb mit einer sichtbaren Nutzerfrage, einem Ein-Satz-Zweck und dem
vollständigen Zeitraum:

- **Wochenliste:** offene Aufgaben mit Plan- oder Fristdatum finden; keine
  Tagesaufteilung;
- **Wochenplan:** Aufgaben mit Plandatum auf sieben Tage verteilen; Fristen
  allein planen keinen Tag;
- **Wochenstatus:** geplante Routinen und Check-ins gegenüberstellen;
  Überspringen bleibt neutral;
- **Wochenrückblick:** Geschehenes mit der Vorwoche vergleichen; keine neue
  Planung und keine Bewertung.

Die Berechnung liest `settings.weekStartsOn` und die gespeicherte Zeitzone.
Leerzustände nennen die jeweilige fehlende Grundlage statt des allgemeinen
„Keine Einträge“. Pfade bleiben unverändert; eine neue persistierte
Wochenentität gibt es nicht.

### Tabs

`ViewTabs` stehen nur zwischen fachlich verschiedenen Aufgaben derselben
Domainseite. Ein anderer Zeitraum, Filter oder eine Aggregation desselben
Bestands begründet allein keinen Reiter; diese Steuerung steht in der
`PageToolbar` oder direkt an der Arbeitsfläche. Die Bereichsreiter der
Kopfzeile bleiben davon unberührt: Sie sind Navigation (`AreaLayout`), keine
Reiter im ARIA-Sinn.

- Reiter laufen nicht waagerecht aus dem Viewport. Die Reihe bricht um: bis 34 rem höchstens zwei nebeneinander, darüber alle in einer Zeile. Eine seitlich scrollende Reihe versteckt genau die Ansichten, die hinten stehen.
- Ein Reiter darf schmaler werden als seine Beschriftung; `hyphens: auto` trennt sie. Ein langes Wort schiebt die Reihe sonst wieder über den Rand.
- Der aktive Reiter ist an Text, Position, `aria-selected` und Akzent erkennbar, nicht allein am Farbton.
- Tastatur nach ARIA-Tab-Pattern: ein Tabulatorschritt in die Reihe, Links und Rechts wechseln darin, Pos1 und Ende springen an die Ränder. Die Auswahl folgt dem Fokus, weil die Panels bereits geladene lokale Daten zeigen.
- Der Zähler eines Reiters steht ausdrücklich im zugänglichen Namen („Inbox: 3 Aufgaben“). Aus benachbarten Elementen zusammengesetzt wird daraus je nach Umsetzung „Inbox3 Aufgaben“ — der Zähler ist eine Aussage und darf nicht am Zusammenfügen hängen.
- Das Panel verweist mit `aria-labelledby` über `viewTabId` auf den ausgewählten Reiter zurück.

### Diagramme

- In einer Ansicht mit Check-in-Raster steht das Raster **vor** der Auswertung. Das Diagramm erklärt, was bereits erfasst wurde; es ist nie der Einstieg.
- Ein Diagramm hinter einer Ausklappfläche wird erst **gerendert**, wenn sie offen ist. `React.lazy` allein genügt nicht: Sobald die Fläche im Baum steht, lädt der Chunk. Nur der nicht gerenderte Zweig hält eine Route frei von der Diagrammbibliothek.
- Textwerte, die eine Kurve begleiten, stehen vor dem Raster, das Diagramm dahinter. Sie kosten nichts nachzuladen und tragen dieselbe Aussage.
- In einem waagerecht scrollenden Raster bleibt die erste Spalte über `position: sticky` stehen. Oben klebende Kopfzeilen bleiben aus: Der Scroller scrollt nur waagerecht, ein oben klebender Kopf hinge an der Seitenscrollung und verdeckte dort Zellen und Fokusring.
- Innerhalb dichter Flächen bleibt das Diagramm zurückhaltend: Gitternetz `--chart-grid`, keine Verlaufsfüllung als Blickfang, kein Glow.
- Die Grenzen aus „Diagramme“ gelten unverändert: höchstens drei Serien, Zeitraum und Datenbasis als Text, dieselben Werte zusätzlich als Tabelle.

### Nicht übernommen

Aus dem Vorbild ausdrücklich **nicht** übernommen: `0 %` für fehlende oder zukünftige Daten, `Habits × Kalendertage` als pauschaler Nenner, Pflicht-Emojis, Ampelfarben oder Regenbogen als einzige Zustandsquelle, feste leere Taskzeilen und ein vereinfachter Mindset-Score.

## Dashboard-Visualisierung

Dashboard-, Fortschritts- und Tracker-Ansichten folgen einer gemeinsamen, dunkel geprägten Sprache. Sie ergänzt die bestehenden Tokens und ersetzt keine Accessibility-Regel.

### Flächen und Tiefe

- Der Seitengrund ist nahezu schwarz, die deckende Karte liegt mit `--glass` darüber, verschachtelte Flächen nutzen `--glass-strong`.
- Trennung entsteht über Flächenhelligkeit, kleine Radien und präzise Haarlinien. Schatten bleiben schwach.
- Radien: Karte `--radius-xl`, Tile `--radius-tile`, Zelle `--radius-cell`, Pill `--radius-round`.
- Dark-first bedeutet nicht „nur dunkel“. Jedes Token existiert für Light und Dark und ist im Kontrasttest abgedeckt.

### Datenpalette

- `--data-1` bis `--data-6` sind die einzigen Serien- und Kategoriefarben; `--data-1-soft` bis `--data-6-soft` sind ihre weichen Flächen.
- Farbe ist immer Zusatz. Jede Serie trägt zusätzlich ein Label und ein Muster: `dataSeriesMarkers` liefert das Zeichen für Legenden, `dataSeriesDashes` das Strichmuster für Linien.
- Datenfarben erreichen als grafisches Element mindestens 3:1 gegen Karte und Seitengrund. Zeichen auf einer weichen Fläche erreichen 4,5:1.
- Verläufe sind ausschließlich Flächenschmuck, etwa `--accent-gradient`. Ein Verlauf codiert niemals eine Kategorie oder einen Status.
- Glow ist auf genau ein Element je Ansicht begrenzt und trägt nie allein eine Aussage. Neon ist semantischer Akzent, keine Containerdekoration.

### Zahlen und Zustände

- Kennzahl-Tiles zeigen kleines Label, große Zahl und kurzen Kontexthinweis; Ziffern stehen tabellarisch.
- Zahlen werden nicht gekürzt, solange die ausgeschriebene Entsprechung fehlt.
- Ohne Datenbasis steht überall `Keine Angabe` statt `0 %`. Der Ring bleibt dann leer, der Balken entfällt.
- Kennzahl-Tile, Ringfortschritt, Fortschrittsbalken, Ranglisten-Balken und Tracker-Zelle geben ihren Wert immer als Text aus. Ring, Balken und Diagrammfläche sind Dekoration und `aria-hidden`.
- Beschriftungen und Datenbasen dieser Bausteine tragen `overflow-wrap: anywhere`. Ein einzelnes langes Wort wie „Tagesfortschritt“ ist rund 133 px breit und bestimmt sonst als Mindestbreite das umgebende Raster — sichtbar erst als waagerechter Dokumentüberlauf, oft nur auf dem breiter rendernden Linux-Runner.
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

Karten und Kennzahlen erscheinen ohne Einblendanimation: Eine teilweise transparente Karte schwächt Kontrast genau im Moment der Orientierung. Bewegung beschränkt sich auf kurze Fortschrittsübergänge mit `--duration-fast`; `prefers-reduced-motion: reduce` schaltet sie vollständig ab.

## Komponentenübersicht

Die lokale Route `/komponenten` zeigt Normal-, simulierte Hover-/Fokus-, Fehler-, Disabled- und Loading-Zustände sowie den Fallback ohne Blur. Sie enthält ausschließlich synthetische Texte und verändert keine persistierten Daten.

## Datenschutz in der Oberfläche

- Datenschutztexte versprechen nicht „vollständig sicher“, sondern erklären lokale Speicherung und Grenzen.
- Nutzertexte bleiben Text und werden nicht als HTML oder Markdown interpretiert. Eine spätere formatierte Darstellung benötigt einen eigenen, geprüften Sanitizing-Vertrag.
- Externe Ziele werden nur über die gemeinsame `ExternalLink`-Komponente geöffnet; sie akzeptiert ausschließlich HTTPS ohne URL-Zugangsdaten und unterdrückt Opener sowie Referrer.
