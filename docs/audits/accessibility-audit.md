# Accessibility-Audit MVP

Stand: 11.08.2026, Issue #27. Geprüft wurde `main` mit den Änderungen dieses Issues.

Dieses Dokument ist die Prüfmatrix und der Befundbericht. Es ist keine WCAG-Konformitätserklärung: Eine formale externe Zertifizierung gehört ausdrücklich nicht zum Scope, und eine Prüfung mit echten Hilfsmittelnutzern hat nicht stattgefunden.

## Was geprüft wurde und womit

| Prüfung | Werkzeug | Wo sie dauerhaft läuft |
| --- | --- | --- |
| Automatisierte Regelprüfung, alle Kernseiten | axe-core 4 über `@axe-core/playwright`, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice` | `e2e/accessibility.spec.ts` |
| Beide Themes | dieselbe Regelprüfung nach Umschalten des Farbschemas | `e2e/accessibility.spec.ts` |
| Kontrast der Tokens im ungünstigsten Fall | eigene Rechnung über die tatsächliche Schichtung | `src/components/ui/color-contrast.test.ts` |
| Tastaturbedienung Tagesablauf, Finanzen, Backup | Playwright ohne Mauszeiger, nur `focus()` und `keyboard` | `e2e/accessibility.spec.ts` |
| Fokus im Dialog und nach Navigation | Playwright | `e2e/accessibility.spec.ts`, `e2e/app.spec.ts` |
| Reflow bei 200 Prozent Zoom | Viewport auf die halbe Breite bei gleicher Schriftgröße | `e2e/accessibility.spec.ts` |
| 320 px ohne waagerechten Überlauf | bestehende Prüfungen | `e2e/app.spec.ts`, `e2e/today.spec.ts`, `e2e/weekly-review.spec.ts` |
| 44 × 44 px Ziele in Kopfzeile und Band | bestehende Prüfung | `e2e/app.spec.ts` |
| Textalternative für Diagramme | bestehende Prüfung: jedes Diagramm trägt dieselben Werte als Tabelle | `src/components/ui/charts/Chart.test.tsx` |
| Tastaturbedienung der Ansichtsreiter | bestehende Prüfung: Pfeiltasten, `Pos1`/`Ende` und genau ein Tabstopp je Reiterreihe | `src/components/ui/ViewTabs.test.tsx` |

Die automatisierte Prüfung blockiert bei jedem Verstoß der Stufen `serious` und `critical`. Zwei Regeln unterhalb dieser Schwelle sind zusätzlich scharf geschaltet, weil das Audit sie behoben hat: `heading-order` und `landmark-unique`.

### Geprüfte Seiten

Tagesübersicht, Aufgaben, Ziele, Routinen, Journal, Geld, Auswertung, Wochenrückblick, Einstellungen — jeweils im Leerzustand. Zusätzlich Geld und Tagesübersicht mit erfassten Daten, weil Diagramme, Tabellen und Kennzahlen erst dann entstehen.

## Befunde

| Nr. | Fund | Stufe | Status |
| --- | --- | --- | --- |
| A-01 | Akzentfarbe als Schriftfarbe erreicht 4,5:1 nicht: aktiver Navigationslink, aktiver Ansichtsreiter, gewählte Journal-Skalenstufe, aktive Routinen- und Aufgabenzustände. Ungünstigster Fleck 3,6:1 (light) und 2,5:1 (dark) | P1, `serious` | behoben |
| A-02 | Im dunklen Theme hellt `--accent-soft` die Fläche so weit auf, dass **keine** Schriftfarbe 4,5:1 erreicht — auch reines Weiß bleibt bei 4,48:1 | P1, `serious` | behoben |
| A-03 | Ein Bereichswechsel ändert weder Dokumenttitel noch Fokus. Für Vorlesesoftware bleibt die Seite dieselbe | P1 | behoben |
| A-04 | Zwei Navigationsbereiche desselben Namens („Nebenbereiche") gleichzeitig auf Desktop, mit denselben Zielen doppelt in der Tabulatorreihenfolge | P2, `moderate` | behoben |
| A-05 | Übersprungene Überschriftenebene auf der Einstellungsseite: `h1` direkt auf `h3` | P2, `moderate` | behoben |

### A-01 und A-02: Akzentschrift

`--accent-1` ist eine Flächen- und Linienfarbe. Als Schrift auf Glas hält sie die Schwelle nicht, und auf der weichen Akzentfläche darunter erst recht nicht.

Behoben durch ein eigenes Token `--accent-text` (light `#075f42`, dark `#ffe8dc`), das überall dort steht, wo der Akzent Schrift färbt. `--accent-1` bleibt unverändert für Rahmen, Verläufe und Datenfarben.

Im dunklen Theme kam die Fläche dazu: `--accent-soft` dunkelt jetzt ab (`rgb(51 19 10 / 45%)`), statt aufzuhellen. Das ist keine Geschmacksfrage — bei einem aufhellenden Schleier über der hellsten Glasstelle gibt es keinen Textwert, der 4,5:1 erreicht.

Gemessene ungünstigste Werte nach der Änderung: 5,21:1 (light) und 4,84:1 (dark). Die Rechnung steht als Test in `src/components/ui/color-contrast.test.ts` und prüft jede Fläche zusätzlich mit `--accent-soft` darüber.

### A-03: Bereichswechsel

`useRouteAnnouncement` setzt nach jeder abgeschlossenen Navigation den Dokumenttitel aus der `h1` der Seite und verschiebt den Fokus in den Inhaltsbereich. Der Titel kommt aus der gerenderten Überschrift, damit keine zweite Liste aus Pfad und Titel entsteht, die veralten kann. Beim ersten Aufruf bewegt sich der Fokus nicht: Es hat niemand navigiert.

Nachtrag (#144): Die Überschrift wird beobachtet und nicht einmalig abgetastet. Wann eine Seite ihre `h1` aufbaut, hängt an ihrem eigenen Laden; ein einzelnes Lesen am Ende der Navigation traf die vorherige Überschrift, sobald sich die Ladereihenfolge verschob, und lief danach nicht erneut.

### A-04: Doppelte Landmarke

Die Kopfzeile trägt die Nebenbereiche auf schmalen Ansichten. Auf Desktop stehen dieselben Ziele in der Seitenleiste; die Kopfzeilen-Navigation ist dort jetzt ausgeblendet.

### A-05: Überschriftenebene

`Card` nimmt eine Überschriftenebene entgegen (`2` oder `3`, Standard `3`). Die drei Karten der Einstellungsseite stehen direkt unter der Seitenüberschrift und tragen deshalb `h2`; der Datenschutzhinweis darin rückt von `h4` auf `h3`.

## Manuelle Prüfschritte

Diese Schritte sind reproduzierbar und decken das ab, was eine Regelprüfung nicht sehen kann. Sie sind zusätzlich als automatisierte Tests hinterlegt, wo das möglich war.

1. **Tagesablauf ohne Maus.** `/` öffnen, mit der Tabulatortaste bis zur Ausgaben-Schnellerfassung, Betrag tippen, Kategorie über den Anfangsbuchstaben wählen, mit `Enter` buchen. Erwartung: Bestätigung erscheint, Fokus bleibt im Formularbereich.
2. **Finanzen ohne Maus.** `/geld`, Betrag, Kategorie, `Enter` auf „Buchung speichern". Erwartung: Die Buchung steht in der Liste.
3. **Backup ohne Maus.** `/einstellungen`, `Enter` auf „Vollständigen Export herunterladen". Danach `Enter` auf „Alle lokalen Daten löschen", im Dialog mit der Tabulatortaste zu „Abbrechen". Erwartung: Der Fokus bleibt im Dialog, `Escape` schließt ihn und gibt den Fokus an den Auslöser zurück.
4. **Bereichswechsel.** Von `/` nach `/planen/aufgaben` navigieren. Erwartung: Titel lautet „Aufgaben – PersonalOS", der Fokus steht im Inhaltsbereich.
5. **Zoom.** Browserzoom auf 200 Prozent bei 1280 px. Erwartung: kein waagerechtes Scrollen des Dokuments, keine abgeschnittenen Inhalte.
6. **Reduzierte Bewegung und Transparenz.** Systemeinstellung `prefers-reduced-motion: reduce` und `prefers-reduced-transparency: reduce` setzen. Erwartung: keine laufenden Animationen, deckende Flächen statt Glas.
7. **Nur-Text-Zustände.** Farbe prüfen, indem man sie ignoriert: Jeder Zustand — erledigt, übersprungen, aktiv, fehlend — trägt zusätzlich Text oder ein Zeichen.

## Bewusst offen

- Eine Prüfung mit echten Screenreadern (NVDA, VoiceOver, TalkBack) und mit Nutzern, die auf Hilfsmittel angewiesen sind, hat nicht stattgefunden. Automatisierte Regeln und Tastaturtests ersetzen das nicht.
- Getestet wird ausschließlich Chromium. Andere Browser-Engines und mobile Hilfsmittel sind nicht abgedeckt.
- Die dichten Raster erzeugen bei schmalen Ansichten waagerechten Überlauf **innerhalb** ihres eigenen Bereichs. Das ist beabsichtigt und fokussierbar, bleibt aber eine Bedienhürde gegenüber einer Darstellung ohne Scrollen.
