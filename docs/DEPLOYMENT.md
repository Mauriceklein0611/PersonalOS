# Betrieb auf Cloudflare Pages

## Status und Grenzen

Die Produktions-PWA ist unter `https://me.exerivo.com` erreichbar. Der
öffentliche Auslieferungsstand wurde am 25.10.2026 gegen einen lokalen Build
der Quellrevision `acfda97` geprüft. Production-URL, direkte App-Routen,
Sicherheitsheader, Manifest und Service Worker antworteten über HTTPS. Die
gehashten Hauptdateien für JavaScript, React-Laufzeit und CSS sowie das Manifest
waren bytegleich mit dem lokalen Build. Der Service Worker enthielt dieselben
Precache-Einträge in anderer Reihenfolge.

Die Prüfung belegt den ausgelieferten statischen Stand. Eine Pull-Request-
Preview, Installation und Updatewechsel auf der echten Domain, ein manueller
Offline-Neustart sowie ein Rollback im Pages-Dashboard wurden dabei nicht
ausgeführt und bleiben eigene Betriebsnachweise.

Cloudflare liefert nur die App-Dateien aus. IndexedDB, Einstellungen, Journal,
Aufgaben und Finanzdaten bleiben im jeweiligen Browserprofil. Ein Aufruf auf
einem anderen Gerät beginnt daher mit einer eigenen leeren Datenbank. Analytics,
Pages Functions, Worker und serverseitige Speicherung werden nicht aktiviert.

## Geprüfter Produktionsstand vom 25.10.2026

- `https://me.exerivo.com/` und alle in der Abnahmeliste genannten direkten
  Routen lieferten HTTP 200 und die App-Shell.
- `manifest.webmanifest` und `sw.js` wurden erfolgreich ausgeliefert.
- CSP, Permissions Policy, Referrer Policy, HSTS, `nosniff` und
  `X-Frame-Options: DENY` entsprachen `public/_headers`.
- Der lokale Qualitätslauf auf Node 24 und pnpm 11.20.0 bestand
  Datenschutzprüfung, Formatierung, ESLint, TypeScript, 937 Unit- und
  Komponententests, Produktionsbuild, Bundle-Budgets und 99 E2E-Tests.
- Die E2E-Suite belegte mit synthetischen Daten unter anderem Offline-Start,
  lokale Aktionen ohne Fachinhaltsübertragung sowie Export, Löschen und Import.

Dies ist kein Restore-Nachweis für Maurices tatsächliches Browserprofil und
kein Nachweis einer unabhängig aufbewahrten Exportdatei. Der 14-tägige
Dogfood-Versuch, zwei manuelle Wiederherstellungsübungen im frischen Profil,
Preview-Abnahme, Updatewechsel und Rollback bleiben offen.

## Pages-Projekt anlegen

1. In Cloudflare unter „Workers & Pages“ eine Pages-Anwendung aus dem
   GitHub-Repository `Mauriceklein0611/PersonalOS` importieren.
2. `main` als Production-Branch wählen. Git-Preview-Deployments für Pull
   Requests aktiviert lassen.
3. Folgende Buildwerte setzen:

   | Einstellung | Wert |
   | --- | --- |
   | Root directory | `/` |
   | Build command | `corepack pnpm build` |
   | Build output directory | `dist` |
   | `NODE_VERSION` | `24` |
   | `PNPM_VERSION` | `11.20.0` |

   `.nvmrc` legt Node 24 zusätzlich im Repository fest. Die pnpm-Variable ist
   trotzdem erforderlich, weil das Pages-v3-Buildsystem die gewünschte
   pnpm-Version nicht aus `package.json` oder der Lockfile-Version ableitet.
4. Keine Analytics, Functions, Bindings, Secrets oder eigenen Cache Rules
   aktivieren. Das Standard-Caching von Pages ist für die gehashten Vite-Dateien
   und den Updatefluss der PWA die Ausgangsbasis.
5. Den ersten Build abwarten und im Buildprotokoll Node 24, pnpm 11.20.0, den
   erfolgreichen Befehl und den Ausgabeordner `dist` bestätigen.

`public/_headers` wird von Vite nach `dist/_headers` kopiert. Cloudflare wertet
diese Datei aus, statt sie auszuliefern. Ein `_redirects`-Fallback ist nicht
vorhanden: Ohne oberstes `404.html` behandelt Pages das Projekt standardmäßig
als SPA und liefert direkte Routen an `index.html` aus.

## Exerivo-Subdomain verbinden

1. Die endgültige Subdomain im Pages-Projekt unter „Custom domains“ zuerst
   hinzufügen und die Prüfung starten.
2. Wird `exerivo.de` in derselben Cloudflare-Zone verwaltet, den angebotenen
   DNS-Eintrag bestätigen. Andernfalls beim DNS-Anbieter einen CNAME von der
   gewählten Subdomain auf `<pages-projekt>.pages.dev` setzen.
3. Nicht nur manuell einen CNAME anlegen: Ohne vorherige Zuordnung im
   Pages-Projekt kann die Domain mit einem 522-Fehler antworten.
4. Warten, bis Pages die Domain als aktiv und das Zertifikat als gültig zeigt.
5. Optional nach der Produktionsabnahme die kanonische Domain festlegen und
   entscheiden, ob die öffentliche `pages.dev`-Adresse dorthin umgeleitet wird.

## Abnahme nach dem Deployment

Die Abnahme erfolgt mit ausschließlich synthetischen Daten:

- Production-URL und eine Pull-Request-Preview über HTTPS öffnen.
- `/`, `/planen/aufgaben`, `/planen/ziele`, `/routinen/uebersicht`,
  `/routinen/journal`, `/geld`, `/auswertung/ueberblick`,
  `/auswertung/wochenrueckblick` und `/einstellungen` jeweils direkt aufrufen
  und neu laden; keine Route darf einen Hosting-404 liefern.
- In den Response-Headern CSP mit `frame-ancestors 'none'`,
  `Permissions-Policy`, `Referrer-Policy`, HSTS, `nosniff` und
  `X-Frame-Options: DENY` prüfen.
- Prüfen, dass Preview-Antworten `X-Robots-Tag: noindex` tragen.
- Die PWA installieren, einmal online vollständig laden, den Browser danach
  offline schalten und App-Start, Navigation, Erfassung sowie Export prüfen.
- Auf einem zweiten Browserprofil bestätigen, dass keine Daten des ersten
  Profils erscheinen.
- Im Netzwerkprotokoll sicherstellen, dass beim Erfassen keine Requests mit
  Fachinhalten entstehen und nur derselbe Origin verwendet wird.
- Nach einem neuen Deployment prüfen, dass der Updatehinweis erscheint und
  nach Bestätigung die neue Version lädt. Erst bei einem reproduzierbaren
  Stale-Asset-Fehler werden Cache-Regeln erwogen.

## Rollback

1. Im Pages-Projekt „Deployments“ öffnen.
2. Im Menü eines zuvor erfolgreichen Production-Deployments „Rollback to this
   deployment“ wählen und bestätigen. Preview-Deployments sind keine
   Rollback-Ziele.
3. Danach Production-URL, direkte Route, Sicherheitsheader, Installation und
   Offline-Neustart erneut prüfen.
4. Ein Rollback betrifft ausschließlich statische App-Dateien. Die lokale
   IndexedDB wird nicht zurückgesetzt. Falls die alte App-Version eine bereits
   migrierte Datenbank nicht lesen kann, muss stattdessen vorwärts korrigiert
   werden; Datenbankmigrationen sind bewusst nur vorwärts kompatibel.

## Repository-Prüfung

Vor einem Deployment laufen mindestens:

```bash
pnpm check:deployment
pnpm check:privacy
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm test:e2e
```

Der erste echte Production-Lauf und jede Änderung an Domain, Headern oder
Caching werden mit Datum und Ergebnis im zugehörigen GitHub-Issue dokumentiert.

## Offizielle Referenzen

- [Vite auf Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- [Build Image und Versionsvariablen](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Standard-SPA und Caching](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Custom Headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Preview Deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
