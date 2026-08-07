# ADR 0011: Ein Sparbeitrag verweist auf seine Ausgabe

- Status: akzeptiert
- Datum: 2026-08-07
- Bezug: Issue #65, Audit-Befund C-03, Roadmap 1.3

## Kontext

`transactions` kennt nur `income` und `expense`. Es gibt kein Konto-Entity und keine Umbuchung. `savingsContributions` steht in einer eigenen Tabelle ohne Verbindung zu den Buchungen. Wer 250 € zur Seite legt, hatte damit drei Möglichkeiten, alle falsch:

| Vorgehen | Folge |
| --- | --- |
| Nur als Ausgabe buchen | Saldo stimmt, der Sparfortschritt bleibt bei null |
| Nur als Sparbeitrag erfassen | Sparfortschritt stimmt, der Monatssaldo behauptet 250 € mehr übrig |
| Beides erfassen | Derselbe Betrag steckt zweimal im System |

Das betrifft jede Sparbewegung, also den Kernvorgang des Sparziel-Moduls.

Die vollständige Lösung sind Konten als Entity und ein Buchungstyp „Umbuchung" mit `fromAccountId`/`toAccountId`. Das verändert das Datenmodell dauerhaft, braucht einen eigenen Migrationsplan und ist im MVP nicht vorgesehen.

## Entscheidung

Ein Sparbeitrag erhält das optionale Feld `sourceTransactionId`. Es verweist auf die Ausgabe, die denselben Betrag bereits abgebildet hat. Der verknüpfte Beitrag ist **dieselbe** Bewegung aus Sicht des Sparziels, nicht eine zweite.

Damit das nachweisbar bleibt, wird eine Verknüpfung nur angenommen, wenn die Buchung

1. vorhanden und nicht archiviert ist,
2. `kind: "expense"` trägt,
3. dieselbe Währung hat,
4. denselben `amountMinor` hat,
5. im selben Kalendermonat wie der Beitrag liegt und
6. noch keinen Beitrag belegt.

Die Gleichheit von Betrag und Monat ist bewusst streng. Eine teilweise Verknüpfung wäre ohne Konten nicht eindeutig auflösbar: Aus „300 € Beitrag zu einer Ausgabe über 500 €" ließe sich nicht ableiten, welcher Teil des Saldos noch frei ist. Geprüft und geschrieben wird in derselben Transaktion; zusätzlich sichert der eindeutige Index `&sourceTransactionId` (Schema v5) die Eins-zu-eins-Beziehung datenbankweit ab.

Auch ein zurückgenommener, also archivierter, Beitrag behält seinen Verweis und hält die Ausgabe belegt. Sonst entstünden zwei Beiträge auf derselben Buchung.

Die Monatsübersicht trennt daraufhin die Beiträge des Monats:

- **belegt** (`linkedMinor`) — steckt bereits in den Ausgaben und wird nicht erneut abgezogen,
- **unbelegt** (`unlinkedMinor`) — ist abgeflossen, ohne als Ausgabe erfasst zu sein, und wird zusätzlich abgezogen.

`balanceAfterSavingsMinor` ist der Saldo abzüglich `unlinkedMinor`. Ein Beitrag gilt nur als belegt, wenn seine Ausgabe in genau diesem Monat aktiv ist; eine archivierte Buchung deckt ihn nicht länger.

Das Backup-Format steigt auf `3`. Die Versionen `1` und `2` bleiben lesbar; ihre Beiträge sind schlicht mit keiner Buchung verknüpft.

## Konsequenzen

- Der Kernvorgang „sparen" ist ohne Doppelzählung abbildbar, ohne das Datenmodell um Konten zu erweitern.
- Die Monatsübersicht kann gebundene von verbleibenden Beträgen trennen und beides begründen.
- Die strenge Betragsgleichheit schließt Teilbeträge aus. Wer einen Teil einer Ausgabe spart, erfasst den Beitrag ohne Verknüpfung; die Oberfläche weist ihn dann als unbelegt aus. Das ist eine bewusste Lücke, keine Nachlässigkeit.
- Ein Export im Format 3 ist für ältere App-Stände nicht lesbar. Das ist bei vorwärtsgerichteten Migrationen erwartet.
- Konten und echte Umbuchungen bleiben Schritt 2. Sie brauchen ein eigenes ADR und werden erst begonnen, wenn sich diese Lösung im Alltag als unzureichend erweist — etwa sobald ein Kontostand oder Nettovermögen verlangt wird.
