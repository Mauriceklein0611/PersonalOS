# ADR 0001: Local-first PWA ohne Backend im MVP

- Status: Accepted
- Datum: 2026-08-03

## Kontext

PersonalOS verarbeitet private Journal-, Verhaltens-, Ziel- und Finanzinformationen. Der einzelne Nutzer benötigt schnelle Erfassung, Offline-Nutzung, transparente Datenhoheit und einfache Wiederherstellung. Benutzerkonten, Zusammenarbeit und öffentliche Freigaben gehören nicht zum Produktziel des MVP.

## Entscheidung

Der MVP wird als installierbare Progressive Web App umgesetzt.

- React/TypeScript bilden die UI.
- IndexedDB mit Dexie ist die primäre persistente Datenbank.
- Ein Service Worker cached nur die für den Offline-Start notwendigen App-Dateien.
- Kernfunktionen benötigen nach dem ersten Laden kein Netzwerk.
- Es gibt im MVP kein Backend, kein Benutzerkonto und keinen Cloud-Sync.
- Vollständiger versionierter Export und validierter Import sind Teil des Fundaments, nicht ein späteres Extra.
- Nutzerinhalte werden nicht für Analytics oder Telemetrie übertragen.

## Konsequenzen

### Positiv

- geringe Betriebs- und Datenschutzkomplexität;
- schnelle lokale Interaktionen;
- Nutzung ohne Netz und ohne Anbieterbindung;
- kein Authentifizierungs- oder Serverbetrieb im MVP;
- klare Möglichkeit, das Produkt zunächst an echten Tagesabläufen zu validieren.

### Negativ

- Browser-Speicher kann vom Nutzer oder Betriebssystem gelöscht werden;
- Gerätewechsel erfolgt zunächst manuell über Export/Import;
- parallele Änderungen auf mehreren Geräten werden nicht synchronisiert;
- IndexedDB-Debugging und Migrationen benötigen besondere Sorgfalt;
- die App darf keine Cloud-Sicherheit suggerieren, die nicht existiert.

## Schutzmaßnahmen

- Backup-Hinweis und regelmäßiger manueller Export;
- Importvorschau und transaktionale Wiederherstellung;
- getestete Schema-Migrationen;
- verständliche Hinweise zu Inkognito-Modus, Browserbereinigung und Speicherlimits;
- keine echten Nutzerdaten im Repository oder in CI.

## Spätere Neubewertung

Optionaler Sync erfordert ein eigenes ADR mit:

- Ende-zu-Ende-Verschlüsselungs- und Schlüsselmodell;
- Konfliktauflösung pro Domain;
- Authentifizierung und Recovery;
- Bedrohungsmodell und Datenschutzfolgen;
- Offline- und Anbieter-Ausfallverhalten;
- Migration bestehender rein lokaler Installationen.

Ein Sync-Backend darf die lokale Datenbank nicht nachträglich zu einem bloßen Cache degradieren.

