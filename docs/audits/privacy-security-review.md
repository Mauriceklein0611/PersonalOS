# Datenschutz- und Sicherheitsreview MVP

Stand: 11.08.2026, Issue #29. Geprüft wurde `main` mit den Änderungen dieses Issues.

Dieses Dokument hält fest, was geprüft wurde, womit, und was dabei herauskam. Es ist kein Rechtsgutachten, kein Penetrationstest und keine Zusicherung absoluter Sicherheit. Die normative Beschreibung des Verhaltens steht in [Datenschutz und Sicherheit](../PRIVACY_AND_SECURITY.md); dieses Dokument ist die datierte Prüfung dazu.

## Datenfluss

Vier Wege, auf denen Daten die App erreichen oder verlassen:

| Weg | Richtung | Auslöser | Ziel |
| --- | --- | --- | --- |
| Erfassen und Auswerten | innerhalb des Geräts | Nutzeraktion | IndexedDB `personalos` |
| Theme-Spiegel | innerhalb des Geräts | Themewechsel | `localStorage`, Schlüssel `personalos.theme.v1` |
| Export | aus der App heraus | ausdrückliche Nutzeraktion | Downloadordner des Browsers |
| Import | in die App hinein | ausdrückliche Nutzeraktion, mit Sicherheitsbackup davor | IndexedDB, vollständig ersetzend |

Kein fünfter Weg führt nach außen. Der Service Worker legt ausschließlich Build-Dateien ab (`globPatterns` über `css,html,ico,js,png,svg,webmanifest`, `runtimeCaching: []`); Fachdaten berührt er nicht. Die einzige Netzanfrage der Anwendung ist der inhaltsfreie Erreichbarkeitstest gegen den eigenen Origin.

## Bedrohungsmodell

Was in der Reichweite dieser Prüfung liegt:

| Bedrohung | Gegenmaßnahme | Geprüft durch |
| --- | --- | --- |
| Unbeabsichtigte Übertragung von Fachdaten | keine Netzwege außer dem eigenen Origin; CSP `connect-src 'self'` | `e2e/privacy.spec.ts` |
| Code oder Markup aus einer Importdatei | Größengrenze, `JSON.parse`, strikte Zod-Prüfung, Referenz- und Zählprüfung vor jedem Schreiben; React rendert Text als Text | `src/db/backup/untrusted-import.test.tsx` |
| Fremde Skripte oder Ressourcen in der ausgelieferten Seite | CSP `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'` | `e2e/privacy.spec.ts` |
| Datenverlust durch die Löschaktion | Sicherheitsbackup zwingend vor der Löschung; Abbruch ohne Datenänderung, wenn der Export scheitert | `e2e/privacy.spec.ts`, `e2e/backup.spec.ts` |
| Geheimnisse oder Echtdaten im Repository | `pnpm check:privacy` auf jedem Lauf; zusätzlich einmalige Historienprüfung | siehe unten |
| Verwundbare Abhängigkeiten | `pnpm audit`, Lockfile, `minimumReleaseAge` | siehe unten |

Was außerhalb liegt und außerhalb bleibt: Zugriff auf Gerät oder Browserprofil, Schadsoftware, Browsererweiterungen, Geräteverlust, eine kompromittierte ausgelieferte Version, sowie alles, was mit den heruntergeladenen Exportdateien nach dem Download geschieht.

## Befunde

| Nr. | Fund | Stufe | Status |
| --- | --- | --- | --- |
| S-01 | `__proto__` als Schlüssel überlebt die strikte Feldprüfung eines Importdatensatzes | P2 | behoben |
| S-02 | Entwicklungsabhängigkeit `nanoid < 3.3.17` mit einem als `high` bewerteten Advisory | P3 | behoben |

### S-01 — `__proto__` im Import

Die Backup-Schemata sind strikt: Ein unbekanntes Feld lässt den Import scheitern. Für den Schlüssel `__proto__` griff das nicht. Zod prüft die Feldliste mit einer `in`-Abfrage, und `"__proto__" in shape` ist wegen der geerbten Eigenschaft auf `Object.prototype` immer wahr; der Schlüssel galt damit als bekannt.

**Keine Prototype Pollution.** `JSON.parse` legt `__proto__` als eigene Eigenschaft an und verschiebt den Prototyp nicht; der Test belegt, dass `Object.prototype` unberührt bleibt. Der eigentliche Fund ist ein anderer: Ein Feld, das das Datenmodell nicht kennt, hätte Import, Datenbank und jeden späteren Export überlebt — genau das, was die strikte Prüfung verhindern soll.

Behoben: `parse` weist eine Datei ab, sobald irgendein Objekt darin einen eigenen `__proto__`-Schlüssel trägt — vor jedem Schreiben, wie alle anderen Prüfungen auch.

### S-02 — Abhängigkeit

`pnpm audit` meldete GHSA-2v37-7h3g-55p8 (`nanoid` unter 3.3.17, Endlosschleife bei eigenen Generatoren, `high`). Die Abhängigkeit kommt ausschließlich über die Build-Werkzeuge (`vite` → `postcss` → `nanoid`) und wird nicht ausgeliefert; `pnpm audit --prod` war schon vorher ohne Fund. Behoben über ein Override in `pnpm-workspace.yaml`, weil der Aufstieg auf eine Patchversion nichts kostet.

Nach der Änderung: `pnpm audit` meldet keine bekannten Schwachstellen.

## Was geprüft wurde und dabei hielt

**Netzwerkanalyse.** Ein vollständiger Tagesablauf — Aufgabe anlegen, Journal speichern, Buchung erfassen, Auswertung öffnen — mit einem Mitschnitt jeder Anfrage. Ergebnis: ausschließlich Anfragen an den eigenen Origin, ausschließlich `GET` und `HEAD`, kein einziger Request mit Rumpf. Die einzige Anfrage, die keine Datei holt, ist `/__personalos-online-check__`.

**Content Security Policy.** Die Meta-CSP setzt `default-src 'self'`, `connect-src 'self'`, `script-src 'self'`, `worker-src 'self'`, `object-src 'none'`, `media-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`. Der Test beobachtet eine echte Verletzung: Ein `fetch` auf einen fremden Origin löst `securitypolicyviolation` mit `connect-src` aus.

`style-src 'unsafe-inline'` bleibt offen — React setzt dynamische Maße als Inline-Stil. Eine Meta-CSP kann außerdem laut Spezifikation weder `frame-ancestors` noch Report-Only. Beides ist in [Datenschutz und Sicherheit](../PRIVACY_AND_SECURITY.md) als Grenze benannt und gehört zu einem späteren Produktionshosting mit HTTP-Headern.

**Importgrenze.** Größengrenze 10 MB vor dem Parsen; `JSON.parse`; strikte Schemata; Zähl-, Referenz- und Eindeutigkeitsprüfungen. Ein Import, der Markup in einem Textfeld trägt, wird als Text gespeichert und als Text gerendert — kein Element entsteht, kein Handler läuft. Eine ungültige Datei ändert den Bestand nicht.

**Kein ungeprüftes HTML, kein `eval`.** Im gesamten `src/` steht weder `dangerouslySetInnerHTML` noch `innerHTML`, `eval` oder `new Function`. `pnpm check:privacy` blockiert die Wiedereinführung. Externe Links laufen über `ExternalLink`: nur HTTPS, keine eingebetteten Zugangsdaten, `noopener`, kein Referrer.

**Repository und Historie.** Alle 125 Commits wurden gegen die Muster für GitHub-, AWS-, Slack- und generische Provider-Token, private Schlüssel und PersonalOS-Exportnamen durchsucht. Treffer gab es in drei Dateien: zweimal die Prüfskripte selbst, die diese Muster enthalten müssen, und einmal eine Zusicherung auf das Dateinamensformat eines Exports in `src/db/backup/service.test.ts`. Keine `.env`-, Schlüssel- oder Exportdatei wurde jemals hinzugefügt.

**CI-Artefakte.** Der Workflow lädt nichts hoch: Es gibt keinen `upload-artifact`-Schritt. Playwright-Traces und Berichte bleiben auf dem Läufer und sind zusätzlich in `.gitignore`.

**Löschen, Export, Recovery gegen die Oberflächentexte.** Der Ablauf entspricht der Zusage: Bestätigungsdialog, dann Sicherheitsbackup als Download, dann Löschung von Datenbank und Theme-Schlüssel, dann Neuladen mit neu angelegten Einstellungen. Der statische PWA-Cache bleibt bestehen und enthält keine Fachdaten.

## Bewusst offen

- **Die lokale Datenbank ist nicht zusätzlich verschlüsselt.** Wer Zugriff auf das entsperrte Browserprofil hat, liest sie. Gerätesperre und Betriebssystemverschlüsselung bleiben die Grenze.
- **Heruntergeladene Exporte liegen unverschlüsselt** im Downloadordner und werden von einer Löschung in der App nicht erfasst. Die Oberfläche sagt das ausdrücklich.
- **Die Commit-Historie enthält Name und E-Mail-Adresse des Autors.** Das ist die übliche Git-Identität und keine Anwendungsdatenweitergabe.
- **Der Erreichbarkeitstest verrät dem eigenen Server, dass die App läuft.** Er trägt keinen Inhalt und geht an keinen fremden Origin.
- **Kein externer Penetrationstest, keine Prüfung der Browser-Engine selbst.** Beides ist ausdrücklich nicht im Scope.
