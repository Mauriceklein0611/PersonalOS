import { useMemo, useState, type ChangeEvent, type FocusEvent } from "react";

import { Card, Input, Select } from "../../components/ui";
import { useAppSettings } from "./settings-context";
import "./app-preferences-panel.css";

/**
 * Bewusst kurz: Das MVP rechnet in einer Währung. Die Liste nennt Währungen
 * des Alltags; der gespeicherte Wert kommt immer hinzu.
 */
const offeredCurrencies = ["EUR", "CHF", "USD", "GBP", "DKK", "SEK", "PLN"];

const currencyNames = new Intl.DisplayNames("de-DE", { type: "currency" });

export function AppPreferencesPanel() {
  const { isStored, settings, update } = useAppSettings();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [capacityError, setCapacityError] = useState<string>();

  const storedCapacity = settings.dailyCapacityMinutes;

  const currencies = useMemo(
    () => withStoredValue(offeredCurrencies, settings.baseCurrency),
    [settings.baseCurrency],
  );
  const timeZones = useMemo(
    () =>
      withStoredValue(Intl.supportedValuesOf("timeZone"), settings.timeZone),
    [settings.timeZone],
  );

  async function save(
    patch: Parameters<typeof update>[0],
    successMessage: string,
  ) {
    setError(undefined);
    setMessage(undefined);
    try {
      await update(patch);
      setMessage(successMessage);
    } catch {
      setError(
        "Die Einstellung wurde nicht gespeichert. Es gilt weiter der zuletzt gespeicherte Wert.",
      );
    }
  }

  const handleCurrencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void save(
      { baseCurrency: event.target.value },
      "Die Übersichtswährung wurde gespeichert.",
    );
  };

  const handleTimeZoneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void save(
      { timeZone: event.target.value },
      "Die Zeitzone wurde gespeichert.",
    );
  };

  /**
   * Ein leeres Feld heißt „kein Budget", nicht „null Minuten". Deshalb wird
   * der Wert entfernt statt auf 0 gesetzt; 0 wäre eine Aussage, die niemand
   * getroffen hat.
   */
  const handleCapacityBlur = (event: FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value.trim();

    if (raw === "") {
      if (settings.dailyCapacityMinutes === undefined) return;
      setCapacityError(undefined);
      void save(
        { dailyCapacityMinutes: undefined },
        "Das Tagesbudget wurde entfernt.",
      );
      return;
    }

    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1_440) {
      setCapacityError(
        "Gib eine ganze Zahl zwischen 1 und 1440 Minuten ein, oder lass das Feld leer.",
      );
      return;
    }

    setCapacityError(undefined);
    if (minutes === settings.dailyCapacityMinutes) return;
    void save(
      { dailyCapacityMinutes: minutes },
      "Das Tagesbudget wurde gespeichert.",
    );
  };

  return (
    <Card
      description="Diese Werte gelten in allen Bereichen und liegen im lokalen Datensatz. Sie sind Teil jedes Exports."
      title="App-Einstellungen"
    >
      {!isStored ? (
        <p className="app-preferences-note" role="status">
          Die gespeicherten Einstellungen werden geladen. Bis dahin gelten die
          erkannten Vorgaben.
        </p>
      ) : null}

      <div className="app-preferences-fields">
        <Select
          hint="Bereits erfasste Buchungen behalten ihre eigene Währung; sie werden nicht umgerechnet."
          label="Übersichtswährung"
          onChange={handleCurrencyChange}
          value={settings.baseCurrency}
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {formatCurrencyOption(currency)}
            </option>
          ))}
        </Select>

        <Select
          hint="Bestimmt, welchem Kalendertag ein Zeitpunkt zugeordnet wird."
          label="Zeitzone"
          onChange={handleTimeZoneChange}
          value={settings.timeZone}
        >
          {timeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {timeZone}
            </option>
          ))}
        </Select>

        {/*
          Der Datensatz kommt asynchron. Statt den gespeicherten Wert in einen
          eigenen Zustand zu spiegeln, mountet der `key` das Feld neu, sobald
          er sich ändert — ein eingetippter, noch nicht gespeicherter Wert
          bleibt dadurch stehen, bis er wirklich gespeichert wurde.
        */}
        <Input
          defaultValue={
            storedCapacity === undefined ? "" : String(storedCapacity)
          }
          error={capacityError}
          hint="Freiwillig. Ohne Angabe wird die geplante Zeit des Tages nur summiert, nicht eingeordnet. Die Summe ist eine Planungshilfe und keine Aussage über deine Leistungsfähigkeit."
          inputMode="numeric"
          key={storedCapacity ?? "kein Budget"}
          label="Tagesbudget in Minuten"
          max={1440}
          min={1}
          onBlur={handleCapacityBlur}
          step={5}
          type="number"
        />
      </div>

      <dl className="app-preferences-summary">
        <div>
          <dt>Wochenstart</dt>
          <dd>
            Montag – im MVP fest, damit Wochenwerte über die gesamte Historie
            vergleichbar bleiben
          </dd>
        </div>
        <div>
          <dt>Sprache</dt>
          <dd>Deutsch (de-DE)</dd>
        </div>
        <div>
          <dt>Farbschema</dt>
          <dd>
            Wird in der Kopfzeile umgeschaltet und in diesem Datensatz
            gespeichert
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="app-preferences-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="app-preferences-note" role="status">
          {message}
        </p>
      ) : null}
    </Card>
  );
}

function withStoredValue(values: string[], stored: string): string[] {
  return values.includes(stored) ? values : [stored, ...values];
}

function formatCurrencyOption(currency: string): string {
  const name = currencyNames.of(currency);
  return name && name !== currency ? `${currency} – ${name}` : currency;
}
