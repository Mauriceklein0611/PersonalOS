# Schnittstellen und Systemgrenzen

Dieses Verzeichnis beschreibt die technischen Übergänge des MVP. Es ergänzt
die ausführlichen Regeln in [Architektur](ARCHITECTURE.md),
[Datenmodell](DATA_MODEL.md), [Datenschutz und Sicherheit](PRIVACY_AND_SECURITY.md)
und [Deployment](DEPLOYMENT.md), ohne deren Inhalte zu duplizieren.

## Überblick

PersonalOS besitzt im MVP keine fachliche Netzwerk-API, kein Backend, kein
Benutzerkonto und keinen Cloud-Sync. Fachinhalte wechseln ausschließlich über
lokale Repository-Aufrufe und den ausdrücklich ausgelösten JSON-Export oder
-Import die jeweilige Systemgrenze. Cloudflare Pages liefert nur statische
App-Dateien.

## UI und Domain → IndexedDB

| Merkmal | Beschreibung |
| --- | --- |
| Fachlicher Zweck | Aufgaben, Routinen, Journal, Ziele, Finanzen, Einstellungen und Auswertungsgrundlagen dauerhaft im Browserprofil speichern |
| Auslöser und Richtung | synchrone Nutzeraktion → asynchroner Repository-Aufruf → Dexie/IndexedDB; Reads in Gegenrichtung über Repositories und Query-Services |
| Mechanismus | Dexie-Transaktionen auf der IndexedDB-Datenbank `personalos` |
| Datenformat | strikt typisierte Datensätze nach `src/db/schemas/domain-records.ts`; gemeinsame IDs und Zeitstempel gemäß `DATA_MODEL.md` |
| Authentifizierung und Rechte | keine App-Authentifizierung; Zugriff ist an Browserprofil, Origin und Geräteschutz gebunden |
| Fehlerweg | Validierungs-, Quota-, Transaktions- und Migrationsfehler werden als lokale Persistenzfehler behandelt; fehlgeschlagene Upgrades zeigen den Recovery-Zustand statt der normalen App |
| Retry und Timeout | kein automatischer Retry und kein eigener Timeout; Nutzer kann nach erklärtem Fehler erneut versuchen |
| Versionierung | interne Dexie-Version und Exportformat werden unabhängig vorwärts versioniert |
| Monitoring | keine Telemetrie; Unit-, Migrations-, Repository- und E2E-Tests prüfen Verhalten mit synthetischen Daten |
| Owner und Begründung | PersonalOS/Maurice; Local-first hält private Inhalte ohne Backend verfügbar und reduziert Auth-/Cloud-Komplexität |

Alternativen mit Backend oder Cloud-Sync sind für den MVP verworfen. Eine
spätere Synchronisation benötigt ein eigenes ADR einschließlich Verschlüsselung,
Konfliktlösung, Authentifizierung und Recovery.

## PersonalOS ↔ JSON-Datei

| Merkmal | Beschreibung |
| --- | --- |
| Fachlicher Zweck | vollständige, portable Sicherung sowie manueller Gerätewechsel und Recovery |
| Auslöser und Richtung | Nutzer startet Export: IndexedDB → JSON-Download; Nutzer wählt Importdatei: JSON → Vorschau → bestätigtes Ersetzen der IndexedDB |
| Mechanismus | Browser-Dateidownload über Blob/Object-URL; Einlesen als UTF-8-JSON |
| Datenformat | versionierter Export-Envelope mit `formatVersion`, `exportedAt`, Counts und allen unterstützten Stores; maximale Importgröße und kompatible Versionen sind im Code festgelegt |
| Authentifizierung und Rechte | keine; Dateizugriff erfolgt über die vom Nutzer ausgelöste Browseraktion und das lokale Dateisystem |
| Fehlerweg | Größenlimit, JSON-Parsing, strikte Zod-Schemas, verbotene Prototyp-Schlüssel, Counts und Referenzintegrität werden vor dem Schreiben geprüft; Fehler lassen den lokalen Stand unverändert |
| Retry und Timeout | kein automatischer Retry oder eigener Timeout; korrigierte Datei kann erneut gewählt werden |
| Transaktion und Rückweg | vor dem Ersetzen wird ein Sicherheits-Export erzeugt und zum Download übergeben; anschließend werden alle Stores in einer Transaktion ersetzt und nochmals verglichen |
| Versionierung | aktuelle Exporte verwenden Format 4; ältere unterstützte Formate werden kompatibel eingelesen und gegen ihren bekannten Umfang geprüft |
| Monitoring | keine Übertragung oder Telemetrie; Backup-Service-, Integritäts-, Kompatibilitäts- und E2E-Tests |
| Owner und Begründung | Nutzer besitzt Datei und Ablage; expliziter Export schützt Datenhoheit ohne Serverbetrieb |

Der Download belegt noch keine sichere Aufbewahrung. Speicherort,
Verschlüsselung, Kopien, Aufbewahrung und erfolgreiche Wiederherstellung liegen
außerhalb der App und müssen vom Nutzer gesondert sichergestellt werden.

## App → Service Worker und Cache

| Merkmal | Beschreibung |
| --- | --- |
| Fachlicher Zweck | App-Shell nach dem ersten erfolgreichen Laden offline starten und Updates kontrolliert aktivieren |
| Auslöser und Richtung | App registriert `/sw.js`; installierter Worker meldet Offlinebereitschaft oder wartende Aktualisierung; Nutzer bestätigt das Update |
| Mechanismus | Browser-Service-Worker-API und `postMessage({ type: "SKIP_WAITING" })` |
| Datenformat | statische HTML-, JavaScript-, CSS-, Manifest-, Icon- und Webmanifest-Dateien; keine Fachdatensätze |
| Authentifizierung und Rechte | Same-Origin- und Browser-Sicherheitsmodell; keine zusätzlichen App-Rechte |
| Fehlerweg | fehlende API oder fehlgeschlagene Registrierung blockieren die lokale Datenbank nicht; Update bleibt bei ausbleibendem Controllerwechsel offen |
| Retry und Timeout | Browser steuert Abruf und Wiederholung; PersonalOS definiert keinen eigenen Timeout oder Hintergrund-Retry |
| Versionierung und Kompatibilität | gehashte Build-Assets; Update wird per Prompt aktiviert; Datenbankmigrationen bleiben vorwärtsgerichtet |
| Monitoring | PWA-Status in der UI sowie Offline-, Update- und E2E-Tests; keine externe Telemetrie |
| Owner und Begründung | PersonalOS/Maurice für App-Logik, Browser für Cache-Lebenszyklus; kontrollierter Wechsel schützt laufende Eingaben |

## Browser → StorageManager

| Merkmal | Beschreibung |
| --- | --- |
| Fachlicher Zweck | lokale Nutzung, Quota und Beständigkeit transparent anzeigen und auf Wunsch dauerhaften Speicher anfragen |
| Auslöser und Richtung | Nutzer öffnet Speicherstatus oder fordert Beständigkeit ausdrücklich an; Browser liefert gerundete Schätzwerte oder eine Entscheidung |
| Mechanismus | `navigator.storage.estimate()`, `persisted()` und `persist()` |
| Datenformat | `usage`, `quota` und optionaler boolescher Persistenzstatus |
| Authentifizierung und Rechte | Browserentscheidung; keine App-Rolle und kein serverseitiges Konto |
| Fehlerweg | nicht unterstützte oder abgelehnte Aufrufe werden als unbekannt beziehungsweise abgelehnt erklärt, nicht als Datenverlust ausgegeben |
| Retry und Timeout | kein automatischer Retry oder eigener Timeout |
| Monitoring | nur lokale Anzeige; keine Übertragung |
| Owner und Begründung | Browser besitzt die Speicherentscheidung; explizite Nutzeraktion vermeidet überraschende Berechtigungsabfragen |

## GitHub → Cloudflare Pages → Browser

| Merkmal | Beschreibung |
| --- | --- |
| Fachlicher Zweck | geprüfte statische PWA-Dateien über eine Exerivo-Subdomain ausliefern |
| Auslöser und Richtung | Commit auf `main` → Pages-Build → statische Assets; Pull Requests → Preview-Deployment |
| Mechanismus | GitHub-Integration, `corepack pnpm build`, Ausgabeordner `dist`, HTTPS/CDN |
| Datenformat | statische Build-Dateien und versionierte Sicherheitsheader; keine IndexedDB-Inhalte |
| Authentifizierung und Rechte | GitHub-/Cloudflare-Projektberechtigungen außerhalb der App; öffentlich ausgelieferte PWA ohne Nutzerkonto |
| Fehlerweg | Buildfehler verhindern Deployment; Hosting- und direkte Routen werden nach Deployment geprüft; Rollback kann nur statische Assets zurücksetzen |
| Retry und Timeout | durch GitHub/Cloudflare gesteuert und im Repository nicht festgelegt |
| Versionierung und Kompatibilität | `main` ist laut ADR Produktionsbranch; ältere statische Versionen dürfen eine bereits migrierte Datenbank nicht per Down-Migration zurücksetzen |
| Monitoring | CI-Prüfungen und manuelle Production-/Preview-Abnahme; kein belegtes externes Laufzeitmonitoring |
| Owner und Begründung | Maurice; statisches Hosting wahrt die Local-first-Grenze ohne Functions, Analytics oder serverseitige Fachdatenspeicherung |

Die Produktions-Domain `https://me.exerivo.com` und der statische Stand wurden
am 25.10.2026 gegen einen lokalen Build der Quellrevision `acfda97` geprüft.
Direkte Routen, Sicherheitsheader, Manifest und Service Worker wurden
ausgeliefert; die gehashten Hauptdateien und das Manifest waren bytegleich.
Preview-Abnahme, Installation und Updatewechsel auf der echten Domain sowie ein
Rollback im Pages-Dashboard bleiben laut `DEPLOYMENT.md` offen.

## Änderungsregel

Eine neue externe API, Function, Analytics-Lösung, Cloud-Synchronisation,
Dateischnittstelle oder Hintergrundübertragung erfordert vor der Umsetzung:

1. fachlichen Zweck und Datenklassen;
2. eigenes Datenschutz- und Fehlerkonzept;
3. Authentifizierung, Berechtigungen, Retry, Timeout und Monitoring;
4. Versionierungs- und Kompatibilitätsregel;
5. ADR mit Alternativen, Risiken und Konsequenzen;
6. Aktualisierung dieses Registers und der betroffenen Betriebsdokumentation.
