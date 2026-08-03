# Claude Code – Projektkontext

Lies zuerst und befolge vollständig `AGENTS.md`. Diese Datei ergänzt die gemeinsamen Regeln nur um den Einstieg für Claude Code.

## Einstieg pro Session

1. Lies `README.md`, `AGENTS.md`, das zugewiesene GitHub-Issue und die relevanten Dateien in `docs/`.
2. Zeige vor Änderungen kurz den beabsichtigten Scope und die betroffenen Dateien.
3. Prüfe den Arbeitsbaum und bewahre Änderungen anderer Agents.
4. Implementiere ausschließlich die Akzeptanzkriterien des Issues.
5. Führe die in `AGENTS.md` definierten Checks aus und berichte echte Ergebnisse.

## Wichtige Leitplanken

- Offlinefähigkeit, Datenportabilität und Datenschutz sind Produktanforderungen, keine spätere Optimierung.
- Lege keine Cloud-, Auth- oder Backend-Abhängigkeit an, solange ein freigegebenes ADR dies nicht ändert.
- Nutze keine echten persönlichen Daten als Beispiel oder Testfixture.
- Aktualisiere `docs/DATA_MODEL.md` und ein ADR, bevor du ein persistiertes Schema oder eine zentrale Architekturannahme änderst.
- Wenn Issue und Dokumentation widersprechen, stoppe an der kleinsten reversiblen Stelle und benenne den Widerspruch im Issue/PR.

