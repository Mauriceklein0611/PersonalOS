import { Button } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  journalScaleKeys,
  journalScaleLabels,
  journalTextKeys,
  journalTextLabels,
  type JournalEntry,
} from "../model";

type JournalHistoryListProps = {
  entries: readonly JournalEntry[];
  onSelect: (localDate: CalendarDay) => void;
  selectedDate: CalendarDay;
};

export function JournalHistoryList({
  entries,
  onSelect,
  selectedDate,
}: JournalHistoryListProps) {
  return (
    <ul className="journal-history">
      {entries.map((entry) => {
        const filledScales = journalScaleKeys.filter(
          (key) => entry[key] !== undefined,
        );
        const filledTexts = journalTextKeys.filter(
          (key) => entry[key] !== undefined,
        );
        return (
          <li key={entry.id}>
            <div className="journal-history-copy">
              <h3>{formatHistoryDate(entry.localDate)}</h3>
              <p className="journal-history-summary">
                {filledScales.length === 0
                  ? "Ohne Skalenwerte"
                  : filledScales
                      .map(
                        (key) => `${journalScaleLabels[key]} ${entry[key]}/5`,
                      )
                      .join(" · ")}
              </p>
              <p className="journal-history-summary">
                {filledTexts.length === 0
                  ? "Ohne Text"
                  : filledTexts
                      .map((key) => journalTextLabels[key])
                      .join(" · ")}
              </p>
            </div>
            <Button
              aria-label={`Eintrag vom ${formatHistoryDate(entry.localDate)} bearbeiten`}
              disabled={entry.localDate === selectedDate}
              onClick={() => onSelect(entry.localDate)}
              variant="secondary"
            >
              {entry.localDate === selectedDate ? "Geöffnet" : "Bearbeiten"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function formatHistoryDate(day: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
