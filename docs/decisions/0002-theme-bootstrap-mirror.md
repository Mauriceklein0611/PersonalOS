# ADR 0002: Theme-Präferenz als begrenzter Bootstrap-Spiegel

- Status: akzeptiert
- Datum: 2026-08-04
- Bezug: Issue #2

## Kontext

Die App-Shell muss das gewählte Farbschema vor dem ersten sichtbaren Rendern anwenden. Die persistente Settings-Repository-Schicht entsteht jedoch erst mit dem späteren Datenbank-Issue. Würde React zunächst ein Standard-Theme rendern und die Präferenz anschließend aus IndexedDB laden, entstünde ein sichtbarer Theme-Wechsel.

IndexedDB bleibt die persistente Quelle für fachliche Einstellungen. Eine zweite allgemeine Einstellungsdatenbank in `localStorage` ist nicht zulässig.

## Entscheidung

`localStorage` enthält ausschließlich die bootkritische Theme-Präferenz unter einem versionierten Schlüssel. Die App liest diesen Wert synchron vor dem Rendern und wendet das aufgelöste Theme auf dem Wurzelelement an.

Bis die Settings-Repository-Schicht verfügbar ist, dient dieser Wert als eng begrenzter Fallback. Danach ist der Datensatz in IndexedDB kanonisch; der `localStorage`-Wert wird nur noch als synchron gehaltener Bootstrap-Spiegel verwendet. Ungültige oder nicht lesbare Werte werden neutral als `system` behandelt.

Der Theme-Code wird über einen kleinen Storage-Vertrag angesprochen. Seiten und Domains greifen weder auf `localStorage` noch auf die spätere Datenbank direkt zu.

## Konsequenzen

- Das gewählte Theme kann ohne sichtbaren Zwischenzustand angewendet werden.
- Es entsteht keine allgemeine zweite Persistenzschicht.
- Die spätere Settings-Implementierung muss IndexedDB und Bootstrap-Spiegel atomar aus Nutzersicht synchronisieren und den Fallback migrieren.
- Private Browsermodi oder blockierter Storage führen sicher zum System-Theme zurück.

## Nachtrag 2026-08-07 (Issue #63)

Die Settings-Repository-Schicht existiert. Der beschriebene Endzustand ist damit umgesetzt und der Fallback aufgelöst:

- Der Settings-Datensatz entsteht beim ersten erfolgreichen Öffnen der Datenbank und ist die kanonische Quelle der Theme-Präferenz.
- `localStorage` bleibt ausschließlich der bootkritische Spiegel. Er wird vor dem ersten Bild gelesen und danach beim Lesen und bei jeder Änderung mit dem Datensatz gleichgezogen.
- Weicht der gespeicherte Wert vom Spiegel ab – etwa nach einem Import oder einem geleerten `localStorage` –, gewinnt der Datensatz, sobald er gelesen ist. Vorher bleibt der Spiegel unangetastet, damit kein ungestalteter Zwischenzustand entsteht.
- Ohne lesbaren Datensatz bleibt die Oberfläche mit dem Spiegel bedienbar; gespeichert wird dann nichts.
