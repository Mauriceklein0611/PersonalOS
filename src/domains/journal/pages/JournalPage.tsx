import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useTimeZone } from "../../../app/settings/settings-context";
import { Button, EmptyState, Input, Textarea } from "../../../components/ui";
import {
  addCalendarDays,
  calendarDayForInstant,
} from "../../../lib/dates/calendar-days";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../../lib/dates/date-values";
import { JournalHistoryList } from "../components/JournalHistoryList";
import { JournalScaleField } from "../components/JournalScaleField";
import {
  isSameJournalFormValues,
  journalEntryToFormValues,
  parseJournalFormValues,
  type JournalFormErrors,
  type JournalFormValues,
} from "../journal-form-values";
import {
  journalScaleHints,
  journalScaleKeys,
  journalScaleLabels,
  journalTextKeys,
  journalTextLabels,
  type JournalEntry,
  type JournalScaleKey,
  type JournalTextKey,
} from "../model";
import { personalOsJournalService, type JournalService } from "../service";
import "./journal-page.css";

export type JournalPageProps = {
  now?: () => Date;
  service?: JournalService;
  timeZone?: string;
};

export function JournalPage({
  now = systemNow,
  service = personalOsJournalService,
  timeZone: timeZoneOverride,
}: JournalPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [baseline, setBaseline] = useState<JournalFormValues>(() =>
    journalEntryToFormValues(undefined, today),
  );
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entry, setEntry] = useState<JournalEntry>();
  const [errors, setErrors] = useState<JournalFormErrors>({});
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<CalendarDay>();
  const [reloadToken, setReloadToken] = useState(0);
  const [savedAt, setSavedAt] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<CalendarDay>(today);
  const [values, setValues] = useState<JournalFormValues>(() =>
    journalEntryToFormValues(undefined, today),
  );

  useEffect(() => {
    let isCurrent = true;
    void readJournalSnapshot(service, selectedDate).then(
      (snapshot) => {
        if (!isCurrent) return;
        const loadedValues = journalEntryToFormValues(
          snapshot.entry,
          selectedDate,
        );
        setEntries(snapshot.entries);
        setEntry(snapshot.entry);
        setValues(loadedValues);
        setBaseline(loadedValues);
        setErrors({});
        setLoadedFor(selectedDate);
      },
      () => {
        if (!isCurrent) return;
        setError("Der Journaleintrag konnte nicht geladen werden.");
        setLoadedFor(selectedDate);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [reloadToken, selectedDate, service]);

  const isLoading = loadedFor !== selectedDate;
  const isDirty = !isSameJournalFormValues(values, baseline);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  function updateScale(key: JournalScaleKey, value: string) {
    setValues((current) => ({
      ...current,
      scales: { ...current.scales, [key]: value },
    }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setSavedAt(undefined);
  }

  function updateText(key: JournalTextKey, value: string) {
    setValues((current) => ({
      ...current,
      texts: { ...current.texts, [key]: value },
    }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setSavedAt(undefined);
  }

  function selectDate(nextDate: string) {
    const parsed = calendarDaySchema.safeParse(nextDate);
    if (!parsed.success || parsed.data > today) {
      setErrors((current) => ({
        ...current,
        localDate: "Wähle heute oder einen vergangenen Tag.",
      }));
      return;
    }
    setErrors({});
    setError(undefined);
    setSavedAt(undefined);
    setSelectedDate(parsed.data);
  }

  function discardChanges() {
    setValues(baseline);
    setErrors({});
    setSavedAt(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseJournalFormValues(values, today);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      await service.saveForDate(result.data);
      setSavedAt(formatTime(now(), timeZone));
      setReloadToken((token) => token + 1);
    } catch {
      setError(
        "Der Eintrag konnte nicht gespeichert werden. Deine Eingaben bleiben im Formular.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="page-title" className="route-page journal-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Reflexion</p>
          <h1 id="page-title">Journal</h1>
          <p className="page-description">
            Halte deinen Tag in wenigen Minuten fest. Jedes Feld ist freiwillig,
            und ein ausgelassener Wert bedeutet nicht null.
          </p>
        </div>
      </header>

      <div className="journal-day-picker">
        <Button
          disabled={isDirty}
          onClick={() => selectDate(addCalendarDays(selectedDate, -1))}
          variant="secondary"
        >
          Vorheriger Tag
        </Button>
        <Input
          disabled={isDirty}
          error={errors.localDate}
          label="Tag der Reflexion"
          max={today}
          onChange={(event) => selectDate(event.currentTarget.value)}
          type="date"
          value={selectedDate}
        />
        <Button
          disabled={isDirty || selectedDate >= today}
          onClick={() => selectDate(addCalendarDays(selectedDate, 1))}
          variant="secondary"
        >
          Nächster Tag
        </Button>
      </div>

      {isDirty ? (
        <p className="journal-day-hint">
          Der Tag lässt sich wechseln, sobald du gespeichert oder die Änderungen
          verworfen hast.
        </p>
      ) : selectedDate >= today ? (
        <p className="journal-day-hint">
          Heute ist der letzte auswählbare Tag. Zukünftige Tage lassen sich
          nicht reflektieren.
        </p>
      ) : null}

      {error ? (
        <p className="page-alert journal-page-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="journal-status" role="status">
          Eintrag wird geladen …
        </p>
      ) : (
        <form
          className="journal-form"
          noValidate
          onSubmit={(event) => void save(event)}
        >
          <div className="journal-scale-grid">
            {journalScaleKeys.map((key) => (
              <JournalScaleField
                hint={journalScaleHints[key]}
                key={key}
                label={journalScaleLabels[key]}
                onChange={(value) => updateScale(key, value)}
                value={values.scales[key]}
              />
            ))}
          </div>

          {journalTextKeys.map((key) => (
            <Textarea
              error={errors[key]}
              key={key}
              label={journalTextLabels[key]}
              maxLength={50_001}
              onChange={(event) => updateText(key, event.currentTarget.value)}
              value={values.texts[key]}
            />
          ))}

          {errors.form ? (
            <p className="page-alert journal-page-error" role="alert">
              {errors.form}
            </p>
          ) : null}

          <div className="journal-form-actions">
            <Button
              isLoading={isSaving}
              loadingLabel="Eintrag wird gespeichert …"
              type="submit"
            >
              Eintrag speichern
            </Button>
            {isDirty ? (
              <Button
                disabled={isSaving}
                onClick={discardChanges}
                variant="ghost"
              >
                Änderungen verwerfen
              </Button>
            ) : null}
          </div>

          <p className="journal-status" role="status">
            {isDirty
              ? "Nicht gespeicherte Änderungen"
              : savedAt
                ? `Gespeichert um ${savedAt} Uhr`
                : entry
                  ? "Für diesen Tag ist ein Eintrag gespeichert."
                  : "Für diesen Tag ist noch nichts gespeichert."}
          </p>
        </form>
      )}

      <h2>Verlauf</h2>
      {entries.length === 0 ? (
        <EmptyState
          description="Sobald du einen Tag festhältst, erscheint er hier und bleibt lokal auf diesem Gerät."
          title="Noch kein Eintrag"
        />
      ) : (
        <JournalHistoryList
          entries={entries}
          onSelect={selectDate}
          selectedDate={selectedDate}
        />
      )}
    </section>
  );
}

async function readJournalSnapshot(
  service: JournalService,
  localDate: CalendarDay,
): Promise<{ entries: JournalEntry[]; entry: JournalEntry | undefined }> {
  const [entries, entry] = await Promise.all([
    service.list(),
    service.getForDate(localDate),
  ]);
  return { entries, entry };
}

function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(instant);
}

export function Component() {
  return <JournalPage />;
}

function systemNow() {
  return new Date();
}
