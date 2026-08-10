# ADR 0014: Dichte Arbeitsflächen sind deckend und additiv zur Glasregel

- Status: akzeptiert
- Datum: 2026-08-10
- Bezug: Issue #117, Epic #116, ergänzt Issue #55 und ADR 0007

## Kontext

Die Glasregel aus Issue #55 gilt bisher ohne Ausnahme: Jede Fläche ist durchscheinend, die oberste Ebene trägt `backdrop-filter`, innere Flächen sind eine hellere Abstufung desselben Schleiers. Das trägt Übersichten und Formulare gut.

Auf datenreichen Seiten trägt es nicht mehr. `docs/UI_GUIDELINES.md` verlangt schon heute, dass lange Listen Zeilen in einer Karte sind statt einer Karte je Zeile — Aufgaben und Routinen erfüllen das nicht. Die Folge ist auf 375 px messbar: Die Reiter der Aufgabenseite legen 500 px Inhalt auf 343 px sichtbare Breite, die erste Eingabe der Tagesübersicht beginnt bei etwa 854 px in einem 844-px-Viewport.

Der Schleier selbst kostet dabei doppelt. Er verbraucht senkrechten Raum, weil jede Fläche Rahmen, Radius und Schatten mitbringt, und er verbraucht Kontrastreserve, weil sein Untergrund der Nebel ist. Genau diese Reserve braucht eine dichte Zeile für gedämpften Zweittext, Ziffern und Zustandszeichen auf engem Raum.

Zwei Auswege wurden verworfen:

- **Glas weiter verdichten.** Mehr Glas-Alpha hellt die Karte im Dark-Theme zusätzlich auf; der Kontrast sinkt, statt zu steigen. Das steht bereits im Kopf von `src/styles/tokens.css`.
- **„Abendrot“ ersetzen.** Die Identität ist konsistent und trägt alle bestehenden Ansichten. Eine dichte Liste ist ein Sonderfall, kein Anlass für ein neues Theme.

## Entscheidung

Neben der Glasfamilie steht eine zweite, **additive** Flächenfamilie für dichte Arbeitsflächen: `--dense-panel`, `--dense-row`, `--dense-row-active` und `--dense-edge`, jeweils in „Abendrot“ und „Tageslicht“. Bestehende Flächen außerhalb dichter Bereiche bleiben unverändert.

Bedingungen dieser Entscheidung:

- **Das dichte Panel ist deckend und trägt kein `backdrop-filter`.** Das ist der Kern. Eine deckende Fläche sieht mit Blur, ohne Blur-Unterstützung und bei `prefers-reduced-transparency: reduce` identisch aus; sie braucht keine Ausweichfassung, und ihr Kontrast hängt nicht mehr am hellsten Nebelfleck. Die drei Zustände, die bei Glas auseinanderlaufen können, fallen hier zusammen.
- **Glas bleibt der Rahmen, nicht der Inhalt.** Schale, Kopfzeile, Hero und wenige oberste Karten tragen Glas. Ein dichtes Panel liegt darin. Ein Panel in einem Panel gibt es nicht.
- **Ein Panel, nicht eine Karte je Datensatz.** Zeilen werden über eine Haarlinie getrennt, nicht über Abstand, Rahmen und Radius je Zeile.
- **Der Fokusring liegt innerhalb dichter Flächen innen** (`outline-offset: -3px`). Die Panelfläche ist beschnitten, damit Zeilen bis an die Kante laufen; ein außen gezeichneter Ring wäre dort abgeschnitten. Breite und Kontrast des Rings bleiben unverändert.
- **Die Akzentfarbe bleibt knapp.** Innerhalb dichter Flächen trägt sie primäre Aktion, aktuelle Auswahl, Fokus, Abschluss und Fortschritt — sonst nichts. Ampelfarben, Regenbogen und Verläufe als Statusträger sind weiter ausgeschlossen.
- **Farbe bleibt Zusatz.** Die aktuelle Auswahl trägt zusätzlich `aria-current` und einen Akzentbalken; ein Zustand hängt nie allein an der Fläche.
- **Ziffern stehen tabellarisch.** Das Panel setzt `font-variant-numeric: tabular-nums`, damit Zahlenspalten ohne zusätzliche Klasse ausgerichtet bleiben.
- **Keine neue Laufzeitabhängigkeit, kein neues Theme, keine neue Chartbibliothek.**

## Konsequenzen

- Der Kontrasttest prüft dieselben Text-, Fehler-, Fokus- und Datenfarben zusätzlich auf Panel, Zeile und ausgewählter Zeile. Weil diese Flächen deckend sind, ist ihr Ergebnis exakt statt Worst-Case-geschätzt.
- Die Farbtabelle in `color-contrast.test.ts` bleibt wie bei der Glasfamilie eine Abschrift aus `tokens.css`. Was sie voraussetzt — deckende Fläche, kein Blur — misst `e2e/components.spec.ts` im echten Browser über `getComputedStyle`. Ein Panel, das doch Alpha oder einen Filter bekäme, fiele dort auf, statt einen Kontrastwert stillschweigend ungültig zu machen.
- Der Nebel bleibt rings um das Panel sichtbar, unter dem Panel nicht. Das ist gewollt: Die Arbeitsfläche wird ruhig, die App bleibt erkennbar.
- Wer eine dichte Fläche später doch durchscheinend haben möchte, ändert nicht das Token, sondern schreibt ein neues ADR. Mit Alpha kehrt die Abhängigkeit vom Nebel zurück, und mit ihr die Ausweichfassung für drei Transparenzzustände.
- Domainseiten bauen die Bausteine nicht nach. Fehlt eine Variante, wächst `.ui-dense-*`, wie es Abschnitt 4 in `AGENTS.md` für gemeinsame Bausteine verlangt.
