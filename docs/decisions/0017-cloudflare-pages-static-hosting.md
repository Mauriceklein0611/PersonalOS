# ADR 0017: Cloudflare Pages liefert nur die statische PWA aus

- Status: akzeptiert
- Datum: 2026-08-11
- Bezug: Issue #153

## Kontext

PersonalOS soll über eine Exerivo-Subdomain erreichbar sein, ohne die
Local-first-Grenzen des MVP aufzuweichen. Das Hosting muss direkte App-Routen,
Installierbarkeit und Offline-Neustarts unterstützen. Gleichzeitig darf die
öffentliche Bereitstellung nicht den Eindruck einer Synchronisation erzeugen
oder unbemerkt Analytics, serverseitige Funktionen und neue Datenflüsse
einführen.

## Entscheidung

- PersonalOS wird als statische Vite-PWA über Cloudflare Pages ausgeliefert.
- GitHub `main` ist der Produktionsbranch; Pull Requests erhalten
  Preview-Deployments über die Pages-Git-Integration.
- Pages baut mit `corepack pnpm build` und veröffentlicht ausschließlich
  `dist`. Node 24 und pnpm 11.20.0 entsprechen `.nvmrc`, `package.json` und
  `packageManager`.
- Das standardmäßige SPA-Verhalten von Pages wird verwendet. Das Repository
  liefert kein oberstes `404.html` und zunächst keine `_redirects`-Regel aus.
- `public/_headers` setzt die Produktions-CSP und ergänzende
  Sicherheitsheader für alle statischen Antworten. Es werden keine Pages
  Functions oder Worker benötigt.
- Das Standard-Caching von Pages bleibt unverändert. Zusätzliche Cache-Regeln
  setzen einen reproduzierbaren Updatefehler voraus.
- Die Exerivo-Subdomain wird zuerst im Pages-Projekt registriert und danach per
  CNAME beziehungsweise durch die verwaltete Cloudflare-Zone verbunden.
- Analytics, Telemetrie, Konten, serverseitige Speicherung und
  Cloud-Synchronisation bleiben deaktiviert.

## Konsequenzen

- Der Host sieht übliche HTTP-Metadaten, erhält aber keine Fachdatensätze aus
  IndexedDB. Ein anderes Gerät startet mit einer eigenen leeren Datenbank.
- Sicherheitsheader sind versioniert, testbar und Teil jedes Builds.
- Routing und Offline-Verhalten bleiben Aufgaben der SPA und ihres Service
  Workers; Cloudflare stellt nur statische Dateien bereit.
- Projektanlage, Domainfreigabe, HTTPS- und Produktionsprüfung benötigen
  Zugriff auf Cloudflare sowie die endgültig gewählte Subdomain und können
  nicht allein durch einen Repository-Commit abgeschlossen werden.
- Eine spätere Function, Analytics-Lösung, Synchronisation oder eigene
  Cache-Strategie benötigt eine neue Architektur- und Datenschutzentscheidung.
