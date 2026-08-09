# ADR 0013: Wiederkehrende Buchungen sind Vorlagen, keine Automatik

- Status: akzeptiert
- Datum: 2026-08-10
- Bezug: Issue #79, Audit-Befund C-06, Marktstandard E-06, Roadmap 4.1

## Kontext

Miete, Versicherung, Abos: Ein erheblicher Teil der Ausgaben wiederholt sich Monat für Monat mit gleichem Betrag, gleicher Kategorie und gleichem Monatstag. Bisher muss jede dieser Buchungen von Hand neu erfasst werden. Das ist die häufigste wiederkehrende Handlung im Finanzbereich und zugleich die langweiligste — genau die Kombination, an der die Erfassungsdisziplin scheitert.

Der naheliegende Weg ist eine Automatik: Am Stichtag legt die App die Buchung selbst an. Andere Anwendungen machen das so.

Für PersonalOS ist dieser Weg falsch, und zwar aus einem inhaltlichen und nicht aus einem technischen Grund.

**Eine automatisch angelegte Buchung ist eine Behauptung über die Wirklichkeit, die niemand geprüft hat.** Die Miete wurde vielleicht nicht abgebucht, der Betrag hat sich geändert, das Abo wurde gekündigt. Steht die Buchung trotzdem im Saldo, rechnet der Nutzer ab diesem Moment mit einer Zahl, die er nie bestätigt hat — und er merkt es nicht, weil nichts danach fragt. Das widerspricht der Linie, die sich durch das ganze Produkt zieht: Der Life Score bleibt bei fehlenden Daten neutral statt null anzunehmen, die Wochenzahlen sagen „Keine Angabe" statt eine Null zu erfinden, eine verstrichene Frist ist ein Hinweis und kein Urteil. Eine stille Automatik wäre der einzige Ort, an dem die App ungefragt Daten über den Nutzer erzeugt.

Hinzu kommt die Offline-Realität: Ohne Server gibt es keinen zuverlässigen Stichtag. Eine App, die zwei Wochen nicht geöffnet wurde, müsste beim Start nachträglich buchen. Wieviele Monate rückwirkend? Mit welchem Datum? Jede Antwort darauf ist geraten.

## Entscheidung

Eine wiederkehrende Buchung ist eine **Vorlage**, keine geplante Ausführung.

Die neue Tabelle `recurringTransactions` speichert Betrag, Kategorie, Art und Monatstag. Sie erzeugt von sich aus **nie** einen Datensatz in `transactions`. Stattdessen:

1. Der Finanzbereich zeigt die im laufenden Monat fälligen Vorlagen als Liste von Vorschlägen.
2. Der Nutzer bestätigt einzeln. Erst die Bestätigung schreibt eine Buchung.
3. Die erzeugte Buchung trägt `recurringTransactionId` und bleibt damit als aus einer Vorlage entstanden erkennbar.
4. Eine im laufenden Monat bereits bestätigte Vorlage erscheint in diesem Monat nicht erneut.

Punkt 4 wird **aus den Buchungen abgeleitet**, nicht in der Vorlage vermerkt: Eine Vorlage gilt für einen Monat als erledigt, wenn eine nicht archivierte Buchung mit ihrer `recurringTransactionId` in diesem Monat liegt. Ein separates Feld `lastConfirmedMonth` wäre ein zweiter Wahrheitsträger, der bei jedem Rückgängigmachen einer Buchung nachgezogen werden müsste und dabei irgendwann falsch stünde. Die Buchung selbst ist der Beleg.

Aus derselben Überlegung folgt: Wird eine aus einer Vorlage erzeugte Buchung archiviert, gilt die Vorlage wieder als offen und erscheint erneut. Das ist gewollt — die Rücknahme war eine Aussage des Nutzers, dass diese Buchung so nicht stattgefunden hat.

**Keine Automatik heißt auch keine Benachrichtigung.** Die Vorschläge stehen dort, wo man Finanzen erfasst, und warten. Sie drängen nicht.

### Der Monatstag

Der Monatstag ist auf 1 bis 28 begrenzt. Jeder Monat hat einen 28. Tag; ein 31. hätte in vier Monaten des Jahres keine Entsprechung, und jede Ausweichregel („dann eben der letzte Tag") wäre eine stille Annahme über die Absicht des Nutzers. Wer den Monatsletzten meint, wählt den 28. und korrigiert die einzelne Buchung bei Bedarf beim Bestätigen — eine sichtbare Handlung statt einer unsichtbaren Regel.

Eine Vorlage ist fällig, sobald der Monatstag im laufenden Monat erreicht ist. Sie bleibt bis zum Monatsende sichtbar; ein verpasster Tag lässt den Vorschlag nicht verschwinden.

## Folgen

**Datenmodell.** Neue Tabelle `recurringTransactions` in Dexie-Schema 6, rein additiv und ohne Datenumbau. `transactions` erhält das optionale Feld `recurringTransactionId`; bestehende Buchungen bleiben ohne Migration gültig, weil das Fehlen des Feldes „von Hand erfasst" bedeutet.

**Backup.** Das Backup-Format steigt von 3 auf 4. Die Versionen 1 bis 3 bleiben lesbar; ihre Exporte kennen die Tabelle nicht und werden als leere Vorlagenliste gelesen — dieselbe Regel, nach der Format 1 bereits `hiddenInsights` behandelt.

**Was diese Entscheidung nicht tut.** Keine wiederkehrenden Aufgaben, keine RRULE, keine Wochen- oder Jahresrhythmen. Der Monatstag deckt den belegten Anwendungsfall ab; alles Weitere braucht einen eigenen Beleg, bevor es Komplexität rechtfertigt.

**Rücknahme.** Die Entscheidung ist umkehrbar: Eine spätere Automatik könnte auf derselben Tabelle aufsetzen. Der umgekehrte Weg — erst automatisch buchen und später zurückrudern — wäre es nicht, weil dann bereits unbestätigte Buchungen im Bestand stünden.
