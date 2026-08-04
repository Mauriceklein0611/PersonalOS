# UI- und Textleitlinien

## Design-Tokens

Die globalen Tokens stehen in `src/styles/tokens.css`. Komponenten verwenden ausschließlich semantische Variablen und keine eigenen Theme-Farben. Kontrastfarben wie `--accent-contrast` und `--danger-contrast` gehören ebenfalls in die Token-Schicht.

- Typografie: Größen, Gewichte und Zeilenhöhen;
- Abstände: Stufen von `--space-1` bis `--space-16`;
- Radien: `sm`, `md`, `lg`, `xl` und `round`;
- Schatten: `sm`, `md` und `lg`;
- Motion: kurze und normale Dauer sowie eine gemeinsame Easing-Kurve;
- Farben: Surface, Text, Border, Accent, Danger, Fokus und Skeleton jeweils für Light und Dark.

## Accessibility-Regeln

Die Komponenten orientieren sich an [WCAG 2.2](https://www.w3.org/TR/WCAG22/):

- normaler Text erreicht mindestens 4,5:1 Kontrast;
- große Schrift, UI-Grenzen und Zustandsindikatoren erreichen mindestens 3:1;
- der sichtbare Fokus nutzt einen drei CSS-Pixel breiten Ring mit mindestens 3:1 Zustandskontrast;
- eigenständige interaktive Ziele sind mindestens 44 × 44 CSS-Pixel groß und übertreffen damit das WCAG-AA-Minimum von 24 × 24 CSS-Pixel;
- kein Zustand wird ausschließlich über Farbe vermittelt;
- `prefers-reduced-motion: reduce` deaktiviert dekorative Übergänge, Spinner und Skeleton-Bewegung;
- native Elemente und Semantik werden vor nachgebauten ARIA-Widgets bevorzugt.

## Deutsche Labels

- Jedes Eingabefeld besitzt ein sichtbares, konkretes Label. Placeholder ersetzen kein Label.
- Buttons beschreiben die Aktion: „Speichern“, „Abbrechen“, „Eintrag löschen“ statt „OK“ oder „Weiter“ ohne Kontext.
- Icon Buttons benötigen immer ein zugängliches Textlabel, zum Beispiel „Dialog schließen“.
- Pflichtfelder werden technisch mit `required` und visuell mit einem Stern gekennzeichnet. Der Stern ist für Screenreader ausgeblendet.
- Loading-Texte beschreiben den aktuellen Vorgang, zum Beispiel „Wird gespeichert …“.
- Disabled-Zustände werden nur verwendet, wenn die Aktion aktuell nicht möglich ist. Eine verständliche Erklärung steht im umgebenden Kontext.

## Fehlermeldungsmuster

Fehler nennen zuerst das lösbare Problem und anschließend die erwartete Korrektur. Sie beschuldigen den Nutzer nicht.

```text
Gib einen Titel mit mindestens einem Zeichen ein.
Wähle ein Datum im Format TT.MM.JJJJ.
Der Import konnte nicht gelesen werden. Wähle einen gültigen PersonalOS-Export.
```

Formfehler sind über `aria-describedby` mit dem Feld verbunden und setzen `aria-invalid`. Kritische Laufzeitfehler verwenden `role="alert"`; neutrale Bestätigungen und Ladehinweise verwenden `role="status"`.

## Destruktive Aktionen, Bestätigung und Undo

Für den Tagesablauf gilt eine einheitliche Regel. Sie richtet sich danach, was eine Aktion mit den Daten tut, nicht danach, wie gefährlich sie klingt.

| Wirkung | Beispiel | Vorgabe |
|---|---|---|
| Zustand wechseln, jederzeit umkehrbar | Aufgabe abschließen, Habit überspringen, Tag wieder öffnen | Keine Bestätigung. Nach der Aktion erscheint ein Hinweis mit „Rückgängig“. |
| Aus der Ansicht entfernen, Datensatz bleibt | Aufgabe oder Gewohnheit archivieren | Keine Bestätigung, aber immer „Rückgängig“. |
| Datensatz unwiderruflich entfernen | Check-in entfernen, alle lokalen Daten löschen | Bestätigungsdialog **oder** ein „Rückgängig“, das den vorherigen Stand vollständig wiederherstellt. |

Konkret bedeutet das: „Wieder öffnen“ löscht den Tageseintrag samt Notiz und stellt ihn über „Rückgängig“ mit demselben Status und derselben Notiz wieder her. „Alle lokalen Daten löschen“ ist nicht umkehrbar und verlangt deshalb Bestätigung und einen vorherigen Sicherungsexport.

Ein Hinweis mit „Rückgängig“ verschwindet erst, wenn er geschlossen wird oder die nächste Aktion folgt. Er blockiert die Oberfläche nicht.

## Komponentenübersicht

Die lokale Route `/komponenten` zeigt Normal-, simulierte Hover-/Fokus-, Fehler-, Disabled- und Loading-Zustände. Sie enthält ausschließlich synthetische Texte und verändert keine persistierten Daten.

## Datenschutz in der Oberfläche

- Datenschutztexte versprechen nicht „vollständig sicher“, sondern erklären lokale Speicherung und Grenzen.
- Nutzertexte bleiben Text und werden nicht als HTML oder Markdown interpretiert. Eine spätere formatierte Darstellung benötigt einen eigenen, geprüften Sanitizing-Vertrag.
- Externe Ziele werden nur über die gemeinsame `ExternalLink`-Komponente geöffnet; sie akzeptiert ausschließlich HTTPS ohne URL-Zugangsdaten und unterdrückt Opener sowie Referrer.
