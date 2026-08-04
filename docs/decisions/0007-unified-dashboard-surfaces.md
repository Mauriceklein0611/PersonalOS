# ADR 0007: Einheitliche, dark-first geprägte Flächenfamilie

- Status: akzeptiert
- Datum: 2026-08-04
- Bezug: Issue #47, aufbauend auf Issue #43

## Kontext

Issue #43 hat eine dunkel geprägte Dashboard-Sprache eingeführt: einen sehr dunklen, leicht blaustichigen Seitengrund, Karten eine Helligkeitsstufe darüber und eine Datenpalette. Die Tokens dafür stehen bewusst neben der bestehenden Flächenfamilie (`--surface`, `--surface-muted`, `--surface-strong`), damit #43 keine bestehende Seite verändert.

Damit existieren zwei Flächenfamilien nebeneinander:

- die bestehende, leicht grünstichige Familie für App-Shell, Karten und Formulare,
- die neue, leicht blaustichige Familie für Dashboard-Bausteine.

Sobald eine Domainseite die neuen Bausteine einsetzt, stehen beide Familien auf demselben Bildschirm. Das Ergebnis wirkt uneinheitlicher als der Zustand davor, weil zwei Grautöne mit unterschiedlichem Farbstich aneinandergrenzen.

Zusätzlich widerspricht die bestehende Dark-Variante der beschlossenen Tiefenlogik: Dort ist der Seitengrund (`--surface-muted`, `#202b24`) **heller** als die Karte (`--surface`, `#18211b`). Die Vorgabe aus #43 lautet umgekehrt, dass der Seitengrund am dunkelsten ist und Karten darüber liegen.

## Entscheidung

Die neutralen Flächen-, Rahmen- und Textfarben werden auf eine einzige, dark-first geprägte Familie zusammengeführt. Konkret:

1. `--surface-muted` ist der Seitengrund und entspricht `--dashboard-canvas`. In Dark ist er damit die **dunkelste** Fläche.
2. `--surface` entspricht `--dashboard-card` und liegt eine Helligkeitsstufe darüber.
3. `--surface-strong` entspricht `--dashboard-card-raised`.
4. Rahmen und Texte übernehmen den leicht kühlen Farbstich der Dashboard-Familie.
5. Die Dashboard-Tokens bleiben als eigene, sprechende Namen bestehen. Sie sind jetzt Synonyme derselben Werte, damit Bausteine weiterhin ihre Absicht benennen und eine spätere Trennung möglich bleibt.

**Nicht Teil dieser Entscheidung:** Der Markenakzent bleibt unverändert grün (`--accent`, Favicon, `theme_color`). Eine Änderung der Markenfarbe ist Markenarbeit und braucht eine eigene Entscheidung. Die kräftigen Farben der Referenzbilder liegen ausschließlich in der Datenpalette `--data-1` bis `--data-6`.

## Konsequenzen

- Alle bestehenden Seiten übernehmen das neue Erscheinungsbild ohne eigene Änderung, weil sie ausschließlich semantische Tokens verwenden. Das ist der beabsichtigte Nutzen der Token-Schicht.
- In Dark kehrt sich das Verhältnis von Seitengrund und Karte um. Flächen, die bisher als „leicht abgesetzt heller" gelesen wurden – Kartenfuß, Dialog-Aktionsleiste, Leerzustand – lesen sich jetzt als „leicht abgesetzt dunkler". Das entspricht der Tiefenlogik aus #43.
- Der Kontrasttest deckt die geänderten Paare ab. `--border-strong` musste in beiden Themes nachgezogen werden, um 3:1 gegen Karte und Seitengrund zu halten.
- `background_color` im Manifest und die Bootstrap-Farben in `tokens.css` folgen dem neuen Seitengrund. `theme_color` bleibt der Markenakzent.
- Eine spätere Rücknahme ist billig: Sie betrifft nur die Token-Werte, keine Komponente.
