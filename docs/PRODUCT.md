# Produktkonzept und Scope

## 1. Vision

PersonalOS ist ein persönliches, local-first System für Planung, Reflexion und verständliche Auswertung. Es ersetzt nicht jede Spezial-App. Es verbindet die wenigen Informationen, die für tägliche Entscheidungen wichtig sind, in einer konsistenten Oberfläche.

Die tägliche Nutzung soll zweimal natürlich stattfinden:

- morgens: Überblick gewinnen, Aufgaben und Habits priorisieren;
- abends: Tag abschließen, Stimmung und Erkenntnisse festhalten.

Das System sammelt nur Daten, die entweder eine aktuelle Entscheidung erleichtern, einen Fortschritt sichtbar machen oder eine nachvollziehbare Erkenntnis ermöglichen.

## 2. Zielperson

Ein einzelner Nutzer auf eigenen Geräten. Für den MVP gibt es:

- keine Registrierung und keine Mehrbenutzerfähigkeit;
- keine verpflichtende Cloud und keine soziale Funktion;
- keine Rollen-, Rechte- oder Organisationsverwaltung;
- keinen öffentlichen Profilbereich.

Diese bewusste Begrenzung erlaubt eine schnelle, fokussierte und private Anwendung.

## 3. Produktprinzipien

### Local-first und portabel

Alle Kernfunktionen arbeiten offline. Daten werden lokal gespeichert. Ein vollständiger, versionierter Export kann überprüft und wieder importiert werden.

### Schnell

Häufige Eingaben benötigen höchstens wenige Interaktionen. Quick Actions und gute Standardwerte sind wichtiger als maximale Konfigurierbarkeit.

### Ruhig und fokussiert

Das Dashboard zeigt Handlungsbedarf statt Datenmenge. Keine strafenden Streaks, künstliche Dringlichkeit oder manipulative Benachrichtigungen.

### Erklärbar

Life Score und Insights zeigen Datenbasis, Zeitraum und Berechnungsweg. Korrelationen werden nicht als Ursachen dargestellt.

### Erweiterbar

Domänen bleiben technisch getrennt und nutzen gemeinsame, stabile Grundtypen. Neue Module dürfen den täglichen Kern nicht verkomplizieren.

## 4. Kernschleifen

### Morgen: planen

1. Dashboard öffnen.
2. Fällige Aufgaben, Habits und Hinweise sehen.
3. Wichtigstes Ergebnis für heute festlegen.
4. Neue Aufgabe oder schnellen Eintrag erfassen.

Zielzeit: unter zwei Minuten.

### Tagsüber: erfassen

1. Aufgabe oder Habit abschließen.
2. Optional eine schnelle Ausgabe oder Notiz erfassen.
3. Änderungen werden sofort lokal gespeichert.

Zielzeit pro Aktion: unter zehn Sekunden.

### Abend: reflektieren

1. Stimmung, Energie und Stress bewerten.
2. Highlight, Dankbarkeit und Verbesserung festhalten.
3. Tagesstatus und offene Punkte sehen.

Zielzeit: unter drei Minuten.

### Woche: ausrichten

1. Fortschritt der Ziele und Kategorien sehen.
2. Abweichungen als neutrale Hinweise verstehen.
3. Prioritäten für die nächste Woche anpassen.

Die vier Wochenflächen haben dabei getrennte Aufgaben und bleiben getrennte
Datenansichten:

| Fläche | Nutzerfrage | Zweck |
| --- | --- | --- |
| Aufgaben – Wochenliste | Was muss ich diese Woche im Blick behalten? | Offene Aufgaben mit Plandatum oder Frist im sichtbaren Zeitraum finden. |
| Aufgaben – Wochenplan | Was habe ich an welchem Tag eingeplant? | Aufgaben ausschließlich über ihr Plandatum den sieben Tagen zuordnen. |
| Routinen – Wochenstatus | Was war geplant und was habe ich eingecheckt? | Soll, erledigte Check-ins und neutrale Übersprünge gegenüberstellen. |
| Auswertung – Wochenrückblick | Was ist in dieser Woche passiert? | Fünf Bereiche mit ihrer Vorwoche vergleichen, ohne neu zu planen oder zu bewerten. |

Alle vier Flächen zeigen ihren Zeitraum ausdrücklich und leiten ihn aus
Zeitzone und konfiguriertem Wochenanfang ab. Sie teilen keine neue persistierte
„Woche“: Jede Ansicht liest weiterhin ihre fachliche Quelle.

### Erster Start: lokal einrichten

Eine neue Installation zeigt nach der ersten Erfassungsfläche eine
überspringbare Einrichtungskarte. Sie erklärt ausdrücklich, dass die
bereitgestellte Website keine Daten synchronisiert, und bietet drei Einstiege:
erste Aufgabe, erste Routine und eine optionale Finanzkategorie.

Der Fortschritt entsteht aus vorhandenen Datensätzen. Gespeichert wird nur der
Zeitpunkt, an dem die Karte abgeschlossen oder übersprungen wurde. Über die
Einstellungen kann sie erneut eingeblendet werden. Backup und PWA-Installation
werden erst erklärt, sobald Aufgabe und Routine vorhanden sind.

## 5. MVP-Scope

Der MVP ist nicht die komplette ursprüngliche Modulliste. Er ist ein stabiler, installierbarer Tagesbegleiter mit verlässlicher Datenhoheit.

### Im MVP (`v1.0`)

- App-Shell, Navigation, responsives Designsystem und Dark Mode;
- lokale Datenbank, Schema-Migrationen und Repository-Schicht;
- Offline-PWA und verständlicher Speicherstatus;
- versionierter Komplett-Export, validierter Import und Wiederherstellung;
- Dashboard/Heute mit offenen Aufgaben, Habits und Quick Actions;
- Aufgaben mit Inbox, Heute, Woche und Erledigt;
- Habits mit Tagesstatus, Frequenz, Streak und einfacher Wochenansicht;
- tägliches Journal mit Stimmung, Stress, Energie, Highlight und Freitext;
- Ziele mit Meilensteinen sowie Verknüpfungen zu Aufgaben und Habits;
- Einnahmen/Ausgaben, Kategorien, Monatsbudget und Sparziele;
- erklärbarer Life Score v1 mit konfigurierbaren Teilbereichen;
- regelbasierte Insights mit Datenbasis und neutraler Sprache;
- Barrierefreiheit, Fehlerzustände, Testabdeckung und Datenschutzprüfung.

### Explizit nicht im MVP

- Kontosynchronisation, Bank- oder Broker-APIs;
- Cloud-Sync, Benutzerkonto oder Multi-Device-Konfliktlösung;
- Dokument-Uploads, Beleg-OCR und Inventarfotos;
- Push-Benachrichtigungen und Kalenderintegration;
- generative KI, Prognosen oder automatische Empfehlungen;
- medizinische Bewertung oder Finanzberatung;
- native iOS-/Android-Apps.

## 6. Module nach dem MVP

### `v1.x – Erweiterungen`

- Lernen und Lernzeit;
- Schlaf und Gesundheit;
- Zeittracking;
- Vermögensverlauf mit manuellen Kontoständen;
- Erinnerungen und Ablaufdaten;
- Jahresrückblick;
- Dokumentmetadaten und Inventar ohne sensible Dateien als erster Schritt.

### `v2 – Synchronisation und Automatisierung`

- optionaler verschlüsselter Multi-Device-Sync;
- Kalender- und Benachrichtigungsintegration;
- Importadapter für ausgewählte Datenquellen;
- bewusst aktivierbare lokale oder externe KI-Funktionen;
- Monatszusammenfassung und Fragen über die eigenen Daten.

Für jede externe Integration sind ein eigenes Datenschutzmodell, Einwilligung, Fehlerkonzept und ADR erforderlich.

## 7. Dashboard

Das Dashboard ist eine priorisierte Tagesansicht, keine Sammlung aller verfügbaren Kennzahlen.

### Oberer Bereich

- Datum und kurze Begrüßung;
- wichtigstes Tagesergebnis;
- Life Score mit Datenvollständigkeit und Link zur Erklärung;
- zuletzt erfasste Stimmung, ohne sie als aktuellen Zustand auszugeben, wenn sie veraltet ist.

### Heute

- überfällige und heutige Aufgaben;
- heute fällige Habits;
- offene Abendreflexion;
- Hinweise, die eine konkrete Aktion erlauben.

### Fortschritt

- Wochenziele;
- Habit-Erfüllung;
- Monatsbudget und Sparziel;
- maximal drei priorisierte Kennzahlen.

### Quick Actions

- Aufgabe;
- Habit abhaken;
- Journal;
- Ausgabe;
- Ziel-Meilenstein.

## 8. Life Score

Der Life Score ist eine optionale, persönliche Orientierung – keine objektive Bewertung eines Lebens.

### Anforderungen

- Gesamtwert und Teilwerte werden aus dokumentierten, versionierten Regeln berechnet.
- Jeder Teilwert zeigt Eingaben, Zeitraum, Gewicht und Veränderung.
- Fehlende Daten senken den Score nicht; stattdessen wird Datenvollständigkeit angezeigt.
- Der Nutzer kann Teilbereiche deaktivieren und Gewichte anpassen.
- Ein Score darf keine medizinische, psychologische oder finanzielle Diagnose suggerieren.
- Historische Scores speichern ihre Berechnungsversion, damit Änderungen nachvollziehbar bleiben.

### Startbereiche

- Fokus: abgeschlossene priorisierte Aufgaben;
- Routinen: Erfüllungsquote fälliger Habits;
- Wohlbefinden: freiwillige Journalwerte, geglättet über mehrere Tage;
- Ziele: Fortschritt aktiver Meilensteine;
- Finanzen: Budgettreue und Sparfortschritt, niemals Vermögenshöhe.

Eingaben, Formeln, Wertebereiche, Mindestdaten, Standardgewichte, Nicht-Ziele und Copy-Leitplanken stehen verbindlich in [ADR 0009](decisions/0009-life-score-v1.md).

## 9. Insights

Im MVP sind Insights deterministische Regeln, keine generative KI.

Ein Insight enthält:

- Beobachtung in neutraler Sprache;
- Datenbasis und Zeitraum;
- Mindestanzahl von Beobachtungen;
- Stärke bzw. Unsicherheit;
- optional eine direkte Aktion;
- Möglichkeit zum Ausblenden.

Beispiele:

- „In 4 der letzten 6 Wochen war deine Habit-Erfüllung an Werktagen höher als am Wochenende.“
- „Deine Restaurant-Ausgaben liegen nach 20 Tagen über deinem selbst gesetzten Monatsanteil.“
- „Für einen Vergleich zwischen Schlaf und Stimmung fehlen noch ausreichend Daten.“

## 10. Qualitätsziele

- Kernaktionen funktionieren nach dem ersten erfolgreichen Laden offline.
- Export und Import verlieren keine unterstützten Daten oder IDs.
- Keine stillen Schemafehler; Migrationen werden getestet.
- Häufige Interaktionen reagieren wahrnehmbar sofort.
- Alle Kernflüsse sind per Tastatur und mit Screenreader-Beschriftungen nutzbar.
- Die Oberfläche funktioniert ab 320 px Breite und in aktuellen Desktop-Browsern.
- Ein Fehler in einem Insight verändert niemals Quelldaten.

## 11. Erfolgskriterien für `v1.0`

- 14 Tage Nutzung ohne Datenverlust oder manuelle Reparatur;
- morgendlicher Check-in im Median unter zwei Minuten;
- abendliche Reflexion im Median unter drei Minuten;
- erfolgreicher Export/Reset/Import-Test mit vollständiger Wiederherstellung;
- mindestens 90 % der täglichen Nutzung ohne Netzwerk möglich;
- Life Score ist für jeden Teilwert in höchstens zwei Interaktionen erklärbar;
- keine offenen P0-/P1-Fehler und keine bekannten Datenschutzlecks.
