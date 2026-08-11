# Datenschutz- und Sicherheitsbasis

## Geltungsbereich

PersonalOS ist im MVP eine backendfreie, local-first PWA für genau ein Browserprofil. Dieses Dokument beschreibt das tatsächliche technische Verhalten, keine Garantie absoluter Sicherheit und keine Rechtsberatung.

## Was lokal gespeichert wird

- Fachliche Datensätze liegen in der IndexedDB-Datenbank `personalos`.
- Die Theme-Präferenz liegt unter dem versionierten Schlüssel `personalos.theme.v1` in `localStorage`.
- Der Service Worker cached nur App-Shell, gehashte Build-Dateien, Manifest und Icons. Er cached keine IndexedDB-Inhalte, Importe oder JSON-Exporte.
- Ein manueller Export wird als JSON-Datei in den vom Browser gewählten Downloadordner geschrieben. Diese Datei liegt anschließend außerhalb von PersonalOS und wird durch eine Löschung in der App nicht entfernt.

Die App verwendet im MVP keine Cookies, Analytics, Telemetrie, externen Fonts, Konten oder Cloud-Synchronisation. Der Netzwerkstatus nutzt ausschließlich einen inhaltsfreien `HEAD`-Request an denselben Origin mit aktuellem Zeitpunkt als Cache-Buster. Es werden dabei keine Nutzereinträge übertragen.

## Was local-first schützt

Ohne optionale spätere Integration verlassen Fachinhalte das Gerät nicht automatisch. Ein Ausfall eines fremden Backends kann die Kernfunktionen nicht blockieren, und ein vollständiger Export bleibt unter Kontrolle des Nutzers.

Local-first schützt nicht vor:

- Personen, Browsererweiterungen oder Schadsoftware mit Zugriff auf Gerät oder Browserprofil;
- Verlust, Defekt oder Diebstahl des Geräts;
- Browserbereinigung, Profilverlust, Speicherdruck oder manuell gelöschten Website-Daten;
- dem üblichen Verhalten privater/Inkognito-Fenster, Daten beim Schließen zu verwerfen;
- einer kompromittierten ausgelieferten App-Version.

Die lokale Datenbank besitzt keine zusätzliche Anwendungsverschlüsselung. Gerätesperre, Betriebssystemverschlüsselung und sicher verwahrte Exporte bleiben deshalb wichtig. Die Speicheranzeige verwendet `StorageManager.estimate()` und kennzeichnet Nutzung und Quota als ungenaue Origin-Schätzung; Browser dürfen Werte aus Datenschutzgründen runden oder verschleiern.

## Export und vollständige Löschung

Unter „Einstellungen → Lokaler Speicher und Datenschutz“ zeigt PersonalOS Datensatzanzahl, ungefähren Origin-Speicher und den vom Browser gemeldeten Beständigkeitsstatus.

Meldet der Browser „Best effort“, bietet dieselbe Karte die Aktion „Dauerhaften Speicher anfordern“ an. Sie ruft `StorageManager.persist()` auf und liest den Status danach neu. Die Entscheidung liegt beim Browser: Er darf ablehnen, und die Oberfläche benennt das als Ablehnung statt als Fehler. PersonalOS fragt nicht von selbst beim Start — eine unerklärte Berechtigungsabfrage im ersten Moment der Anwendung wäre genau die stille Nebenwirkung, die diese Datei ausschließt. Ein aktueller Export bleibt der verlässlichere Schutz.

Die Aktion „Alle lokalen Daten löschen“:

1. öffnet einen eindeutigen Bestätigungsdialog;
2. erzeugt und lädt zuerst einen vollständigen Sicherheits-Export herunter;
3. bricht ohne Datenänderung ab, falls Export oder Download fehlschlagen;
4. löscht danach die IndexedDB-Datenbank und den lokalen Theme-Schlüssel;
5. lädt die App mit leerer Datenbank neu.

Der statische PWA-Cache bleibt bestehen, damit die App offline starten kann; er enthält keine Nutzerdaten. Heruntergeladene Exporte müssen bei Bedarf separat im Dateisystem gelöscht werden.

## Content Security Policy und Links

Die früh im HTML gesetzte CSP begrenzt standardmäßig alle Ressourcen auf den eigenen Origin. `connect-src 'self'` sperrt unerwartete Fetch-, Beacon-, EventSource- und WebSocket-Ziele; Worker und Manifest bleiben für die Offline-PWA vom eigenen Origin erlaubt. Frames, Medien und Objekte sind gesperrt. Inline-Skripte sind nicht erlaubt. Inline-Styles bleiben vorerst für dynamische UI-Maße und die Vite-Entwicklung erlaubt.

Eine Meta-CSP wirkt erst ab ihrer Position im Dokument und unterstützt laut CSP-Spezifikation weder `frame-ancestors` noch Report-Only. Ein späteres Produktionshosting soll dieselbe Policy zusätzlich als HTTP-Header und `frame-ancestors 'none'` ausliefern. Externe Links laufen ausschließlich über `ExternalLink`: HTTPS, keine eingebetteten Zugangsdaten, neues Fenster ohne Opener und ohne Referrer.

## Nicht vertrauenswürdige Daten und Logs

- Importdateien werden vor jedem Schreiben größenbegrenzt, geparst und vollständig mit Zod sowie Referenzprüfungen validiert.
- Ein Datensatz mit einem Feld, das das Datenmodell nicht kennt, lässt den Import scheitern. Das gilt ausdrücklich auch für den Schlüssel `__proto__`: Die strikte Feldprüfung von Zod erkennt ihn nicht, weil `"__proto__" in shape` wegen der geerbten Eigenschaft immer wahr ist. Eine eigene Prüfung weist die Datei deshalb ab, bevor irgendetwas geschrieben ist.
- React rendert Nutzertext als Text. HTML-/Markdown-Rendering ist nicht implementiert; `dangerouslySetInnerHTML` ist im App-Code untersagt.
- Fehlerzustände zeigen stabile, allgemeine Nutzertexte. Fehlerobjekte, Journaltexte, Notizen, Finanzwerte und vollständige Records gelangen weder in UI-Fehlertexte noch in Logs.
- Globale und Routen-Fehlergrenzen senden keine Telemetrie.

## Repository- und CI-Schutz

`pnpm check:privacy` läuft lokal und in CI ohne zusätzliche Abhängigkeit. Der Check erkennt typische GitHub-, AWS-, Google-, Slack- und Provider-Token, private Schlüsseldateien/-inhalte, `.env`-Dateien, PersonalOS-Exportnamen und Export-Envelopes. Zusätzlich blockiert er rohe `console.*`-Ausgaben und ungeprüftes HTML-Rendering unter `src/`. Ein Treffer gibt nie den gefundenen Wert aus.

Die Regeln ergänzen GitHubs Push Protection, ersetzen aber keine aktivierte Plattformprüfung. GitHub dokumentiert unterstützte Provider- und generische Muster in der [Secret-Scanning-Referenz](https://docs.github.com/en/code-security/reference/secret-security/supported-secret-scanning-patterns).

Die Historie wurde am 11.08.2026 einmalig vollständig gegen dieselben Muster geprüft; das Ergebnis steht im [Datenschutz- und Sicherheitsreview](audits/privacy-security-review.md). Der CI-Workflow lädt keine Artefakte hoch.

## Abhängigkeiten

`pnpm audit` läuft nicht in der CI, weil es eine Netzabfrage gegen die Registry ist und einen ansonsten reproduzierbaren Lauf von einem fremden Dienst abhängig machen würde. Er gehört stattdessen zur Prüfung vor einer Freigabe. Stand 11.08.2026: keine bekannten Schwachstellen. Ein Override in `pnpm-workspace.yaml` hebt `nanoid` auf eine Patchversion an; die Begründung steht dort und im Review.

## Datierte Prüfung

Der [Datenschutz- und Sicherheitsreview vom 11.08.2026](audits/privacy-security-review.md) hält Datenfluss, Bedrohungsmodell, Prüfschritte und Funde fest.

## Technische Referenzen

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP/)
- [StorageManager-Schätzungen](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
- [Browser-Speicher, Quotas und Löschung](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
