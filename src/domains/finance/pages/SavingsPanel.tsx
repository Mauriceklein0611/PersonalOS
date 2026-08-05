import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Button,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  Select,
  Toast,
} from "../../../components/ui";
import { calendarDayForInstant } from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { createMoney, formatMoney } from "../../../lib/money/money";
import { MixedCurrencyError } from "../mixed-currency";
import {
  savingsGoalStatusLabels,
  savingsGoalStatuses,
  type SavingsContribution,
  type SavingsGoal,
  type SavingsGoalStatus,
} from "../model";
import {
  calculateSavingsProgress,
  describeSavingsDeadline,
  type SavingsProgress,
} from "../savings";
import {
  createContributionFormValues,
  createSavingsGoalFormValues,
  toContributionDetails,
  toSavingsGoalDetails,
  type ContributionFormErrors,
  type ContributionFormValues,
  type SavingsGoalFormErrors,
  type SavingsGoalFormValues,
} from "../savings-form-values";
import {
  personalOsSavingsService,
  type SavingsService,
} from "../savings-service";
import "./savings-panel.css";

type SavingsUndoAction = {
  message: string;
  run: () => Promise<unknown>;
};

export type SavingsPanelProps = {
  currency?: string;
  now?: () => Date;
  service?: SavingsService;
  timeZone?: string;
};

export function SavingsPanel({
  currency = "EUR",
  now = () => new Date(),
  service = personalOsSavingsService,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: SavingsPanelProps) {
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<SavingsUndoAction>();

  const [goalValues, setGoalValues] = useState<SavingsGoalFormValues>(
    createSavingsGoalFormValues,
  );
  const [goalErrors, setGoalErrors] = useState<SavingsGoalFormErrors>({});

  const [contributionValues, setContributionValues] =
    useState<ContributionFormValues>(() => createContributionFormValues(today));
  const [contributionErrors, setContributionErrors] =
    useState<ContributionFormErrors>({});
  const [editedContributionId, setEditedContributionId] = useState<string>();

  const [deletion, setDeletion] = useState<{
    contributionCount: number;
    goal: SavingsGoal;
  }>();

  const reload = useCallback(async () => {
    const [storedGoals, storedContributions] = await Promise.all([
      service.listGoals(),
      service.listContributions(),
    ]);
    setGoals(storedGoals);
    setContributions(storedContributions);
  }, [service]);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [storedGoals, storedContributions] = await Promise.all([
        service.listGoals(),
        service.listContributions(),
      ]);
      if (!isCurrent) return;
      setGoals(storedGoals);
      setContributions(storedContributions);
      setIsLoading(false);
    };

    void load().catch(() => {
      if (!isCurrent) return;
      setError("Die Sparziele konnten nicht geladen werden.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [service]);

  // Gemischte Währungen werden nicht umgerechnet, sondern benannt.
  const progressByGoal = useMemo(() => {
    const entries = new Map<
      string,
      { error?: string; progress?: SavingsProgress }
    >();
    for (const goal of goals) {
      try {
        entries.set(goal.id, {
          progress: calculateSavingsProgress(goal, contributions),
        });
      } catch (thrown) {
        entries.set(goal.id, {
          error:
            thrown instanceof MixedCurrencyError
              ? thrown.message
              : "Der Sparfortschritt konnte nicht berechnet werden.",
        });
      }
    }
    return entries;
  }, [contributions, goals]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      setError(undefined);
      try {
        await action();
        await reload();
        return true;
      } catch {
        setError(failure);
        return false;
      }
    },
    [reload],
  );

  function resetContributionForm() {
    setContributionValues(createContributionFormValues(today));
    setContributionErrors({});
    setEditedContributionId(undefined);
  }

  function toggleGoal(goal: SavingsGoal) {
    resetContributionForm();
    setSelectedId((current) => (current === goal.id ? undefined : goal.id));
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toSavingsGoalDetails(goalValues, currency);
    if (!result.ok) {
      setGoalErrors(result.errors);
      return;
    }

    setGoalErrors({});
    const created = await runAction(
      () => service.createGoal(result.details),
      "Das Sparziel konnte nicht gespeichert werden.",
    );
    if (created) {
      setGoalValues(createSavingsGoalFormValues());
      setNotice("Das Sparziel wurde angelegt.");
      setUndo(undefined);
    }
  }

  async function changeStatus(goal: SavingsGoal, status: SavingsGoalStatus) {
    const previous = goal.status;
    const changed = await runAction(
      () => service.changeStatus(goal.id, status),
      "Der Status konnte nicht geändert werden.",
    );
    if (changed) {
      setNotice(`Der Status ist jetzt „${savingsGoalStatusLabels[status]}“.`);
      setUndo({
        message: `Der Status ist wieder „${savingsGoalStatusLabels[previous]}“.`,
        run: () => service.changeStatus(goal.id, previous),
      });
    }
  }

  async function archiveGoal(goal: SavingsGoal) {
    const archived = await runAction(
      () => service.archiveGoal(goal.id),
      "Das Sparziel konnte nicht archiviert werden.",
    );
    if (archived) {
      setSelectedId(undefined);
      setNotice(
        "Das Sparziel wurde archiviert. Die Beiträge bleiben erhalten.",
      );
      setUndo({
        message: "Das Sparziel ist wieder sichtbar.",
        run: () => service.restoreGoal(goal.id),
      });
    }
  }

  async function submitContribution(
    event: FormEvent<HTMLFormElement>,
    goal: SavingsGoal,
  ) {
    event.preventDefault();
    const result = toContributionDetails(
      contributionValues,
      goal.id,
      goal.target.currency,
    );
    if (!result.ok) {
      setContributionErrors(result.errors);
      return;
    }

    setContributionErrors({});
    const editedId = editedContributionId;
    const saved = await runAction(
      () =>
        editedId === undefined
          ? service.addContribution(result.details)
          : service.updateContribution(editedId, {
              bookedOn: result.details.bookedOn,
              money: result.details.money,
              note: result.details.note,
            }),
      editedId === undefined
        ? "Der Beitrag konnte nicht gespeichert werden."
        : "Der Beitrag konnte nicht aktualisiert werden.",
    );
    if (saved) {
      resetContributionForm();
      setNotice(
        editedId === undefined
          ? "Der Beitrag wurde gespeichert."
          : "Der Beitrag wurde aktualisiert.",
      );
      setUndo(undefined);
    }
  }

  function startEditing(contribution: SavingsContribution) {
    setContributionErrors({});
    setEditedContributionId(contribution.id);
    setContributionValues({
      amount: toAmountInput(contribution),
      bookedOn: contribution.bookedOn,
      note: contribution.note ?? "",
    });
  }

  async function removeContribution(contribution: SavingsContribution) {
    if (editedContributionId === contribution.id) resetContributionForm();
    const removed = await runAction(
      () => service.removeContribution(contribution.id),
      "Der Beitrag konnte nicht zurückgenommen werden.",
    );
    if (removed) {
      setNotice(
        "Der Beitrag wurde zurückgenommen und zählt nicht mehr zum Stand.",
      );
      setUndo({
        message: "Der Beitrag zählt wieder mit.",
        run: () => service.restoreContribution(contribution.id),
      });
    }
  }

  async function askForDeletion(goal: SavingsGoal) {
    setError(undefined);
    try {
      const contributionCount = await service.countContributions(goal.id);
      setDeletion({ contributionCount, goal });
    } catch {
      setError("Die Beiträge des Sparziels konnten nicht geprüft werden.");
    }
  }

  async function confirmDeletion() {
    if (!deletion) return;
    const { goal } = deletion;
    setDeletion(undefined);

    const removed = await runAction(
      () => service.deleteGoalPermanently(goal.id),
      "Das Sparziel konnte nicht gelöscht werden.",
    );
    if (removed) {
      setSelectedId(undefined);
      resetContributionForm();
      // Endgültiges Löschen ist nicht umkehrbar, deshalb kein Undo-Angebot.
      setNotice("Das Sparziel und seine Beiträge wurden endgültig gelöscht.");
      setUndo(undefined);
    }
  }

  async function runUndo(action: SavingsUndoAction) {
    setUndo(undefined);
    const done = await runAction(
      action.run,
      "Die Aktion konnte nicht rückgängig gemacht werden.",
    );
    if (done) setNotice(action.message);
  }

  return (
    <section aria-labelledby="savings-heading" className="savings-panel">
      <h2 id="savings-heading">Sparziele</h2>
      <p className="savings-hint">
        Der Stand ergibt sich ausschließlich aus den erfassten Beiträgen. Ein
        Sparziel ist eine Planungshilfe und sagt nichts über den Wert einer
        Person oder ihre finanzielle Lage aus.
      </p>

      {error ? (
        <p className="savings-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="savings-hint" role="status">
          Sparziele werden geladen …
        </p>
      ) : (
        <>
          {/* Die eigene Prüfung nennt Problem und Korrektur; die native
              Browsermeldung würde sie nur verdecken. */}
          <form
            className="savings-form"
            noValidate
            onSubmit={(event) => void submitGoal(event)}
          >
            <Input
              error={goalErrors.name}
              label="Name des Sparziels"
              onChange={(event) => {
                const name = event.currentTarget.value;
                setGoalValues((current) => ({ ...current, name }));
              }}
              required
              value={goalValues.name}
            />
            <Input
              error={goalErrors.target}
              hint="Zum Beispiel 1.200,00."
              inputMode="decimal"
              label="Zielbetrag in Euro"
              onChange={(event) => {
                const target = event.currentTarget.value;
                setGoalValues((current) => ({ ...current, target }));
              }}
              required
              value={goalValues.target}
            />
            <Input
              error={goalErrors.targetDate}
              hint="Optional. Ohne Frist bleibt das Feld leer."
              label="Frist"
              onChange={(event) => {
                const targetDate = event.currentTarget.value;
                setGoalValues((current) => ({ ...current, targetDate }));
              }}
              type="date"
              value={goalValues.targetDate}
            />
            <Button type="submit" variant="secondary">
              Sparziel anlegen
            </Button>
          </form>

          {goals.length === 0 ? (
            <EmptyState
              description="Lege ein Sparziel an, um Beiträge nachvollziehbar festzuhalten."
              title="Kein Sparziel"
            />
          ) : (
            <ul className="savings-list">
              {goals.map((goal) => {
                const entry = progressByGoal.get(goal.id);
                const deadline = describeSavingsDeadline(goal, today);
                const isSelected = goal.id === selectedId;

                return (
                  <li key={goal.id}>
                    <div className="savings-head">
                      <h3>{goal.name}</h3>
                      <span className="savings-status">
                        {savingsGoalStatusLabels[goal.status]}
                      </span>
                    </div>

                    {entry?.error ? (
                      <p className="savings-error">{entry.error}</p>
                    ) : entry?.progress ? (
                      <>
                        <ProgressBar
                          caption={entry.progress.summary}
                          label="Gespart"
                          value={entry.progress.ratio}
                          valueText={`${formatMoney(
                            createMoney(
                              entry.progress.savedMinor,
                              entry.progress.currency,
                            ),
                          )} von ${formatMoney(goal.target)}`}
                        />
                        <p className="savings-hint">
                          {describeOpenAmount(entry.progress)} ·{" "}
                          {entry.progress.contributionCount}{" "}
                          {entry.progress.contributionCount === 1
                            ? "Beitrag"
                            : "Beiträge"}{" "}
                          · {deadline.text}
                        </p>
                      </>
                    ) : null}

                    <Button
                      aria-expanded={isSelected}
                      onClick={() => toggleGoal(goal)}
                      variant="ghost"
                    >
                      {isSelected
                        ? `Verlauf von „${goal.name}“ verbergen`
                        : `Verlauf von „${goal.name}“ anzeigen`}
                    </Button>

                    {isSelected ? (
                      <div className="savings-detail">
                        <Select
                          label={`Status von „${goal.name}“`}
                          onChange={(event) =>
                            void changeStatus(
                              goal,
                              event.currentTarget.value as SavingsGoalStatus,
                            )
                          }
                          value={goal.status}
                        >
                          {savingsGoalStatuses.map((status) => (
                            <option key={status} value={status}>
                              {savingsGoalStatusLabels[status]}
                            </option>
                          ))}
                        </Select>

                        <form
                          className="savings-form"
                          noValidate
                          onSubmit={(event) =>
                            void submitContribution(event, goal)
                          }
                        >
                          <Input
                            error={contributionErrors.amount}
                            hint="Zum Beispiel 50,00."
                            inputMode="decimal"
                            label="Beitrag in Euro"
                            onChange={(event) => {
                              const amount = event.currentTarget.value;
                              setContributionValues((current) => ({
                                ...current,
                                amount,
                              }));
                            }}
                            required
                            value={contributionValues.amount}
                          />
                          <Input
                            error={contributionErrors.bookedOn}
                            label="Datum des Beitrags"
                            onChange={(event) => {
                              const bookedOn = event.currentTarget.value;
                              setContributionValues((current) => ({
                                ...current,
                                bookedOn,
                              }));
                            }}
                            required
                            type="date"
                            value={contributionValues.bookedOn}
                          />
                          <Input
                            hint="Optional, zum Beispiel ein kurzer Hinweis."
                            label="Notiz zum Beitrag"
                            onChange={(event) => {
                              const note = event.currentTarget.value;
                              setContributionValues((current) => ({
                                ...current,
                                note,
                              }));
                            }}
                            value={contributionValues.note}
                          />
                          <Button type="submit" variant="secondary">
                            {editedContributionId === undefined
                              ? "Beitrag hinzufügen"
                              : "Beitrag aktualisieren"}
                          </Button>
                          {editedContributionId === undefined ? null : (
                            <Button
                              onClick={() => resetContributionForm()}
                              variant="ghost"
                            >
                              Bearbeiten abbrechen
                            </Button>
                          )}
                        </form>

                        {contributions.filter(
                          (contribution) =>
                            contribution.savingsGoalId === goal.id,
                        ).length === 0 ? (
                          <EmptyState
                            description="Für dieses Sparziel ist noch kein Beitrag erfasst."
                            title="Kein Beitrag"
                          />
                        ) : (
                          <ul className="savings-history">
                            {contributions
                              .filter(
                                (contribution) =>
                                  contribution.savingsGoalId === goal.id,
                              )
                              .map((contribution) => (
                                <li key={contribution.id}>
                                  <div className="savings-history-copy">
                                    <p className="savings-history-day">
                                      {formatDay(contribution.bookedOn)}
                                    </p>
                                    {contribution.note ? (
                                      <p>{contribution.note}</p>
                                    ) : null}
                                  </div>
                                  <p className="savings-history-amount">
                                    {formatMoney(contribution.money)}
                                  </p>
                                  <Button
                                    onClick={() => startEditing(contribution)}
                                    variant="ghost"
                                  >
                                    {`Beitrag vom ${formatDay(
                                      contribution.bookedOn,
                                    )} über ${formatMoney(
                                      contribution.money,
                                    )} bearbeiten`}
                                  </Button>
                                  <IconButton
                                    label={`Beitrag vom ${formatDay(
                                      contribution.bookedOn,
                                    )} über ${formatMoney(
                                      contribution.money,
                                    )} zurücknehmen`}
                                    onClick={() =>
                                      void removeContribution(contribution)
                                    }
                                  >
                                    ×
                                  </IconButton>
                                </li>
                              ))}
                          </ul>
                        )}

                        <div className="savings-actions">
                          <Button
                            onClick={() => void archiveGoal(goal)}
                            variant="ghost"
                          >
                            Sparziel archivieren
                          </Button>
                          <Button
                            onClick={() => void askForDeletion(goal)}
                            variant="danger"
                          >
                            Sparziel endgültig löschen
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Endgültiges Löschen ist nicht umkehrbar und nennt vorher, wie viele
          Beiträge mit verschwinden. */}
      <Dialog
        actions={
          <>
            <Button onClick={() => setDeletion(undefined)} variant="secondary">
              Abbrechen
            </Button>
            <Button onClick={() => void confirmDeletion()} variant="danger">
              Endgültig löschen
            </Button>
          </>
        }
        description="Diese Aktion lässt sich nicht rückgängig machen."
        onClose={() => setDeletion(undefined)}
        open={deletion !== undefined}
        title="Sparziel endgültig löschen"
      >
        {deletion ? (
          <p>
            „{deletion.goal.name}“ wird entfernt.{" "}
            {deletion.contributionCount === 0
              ? "Für dieses Sparziel ist kein Beitrag erfasst."
              : deletion.contributionCount === 1
                ? "1 Beitrag wird mitgelöscht und lässt sich danach nicht wiederherstellen."
                : `${deletion.contributionCount} Beiträge werden mitgelöscht und lassen sich danach nicht wiederherstellen.`}
          </p>
        ) : null}
      </Dialog>

      {notice ? (
        <div className="savings-toast-region">
          <Toast
            action={
              undo
                ? { label: "Rückgängig", onClick: () => void runUndo(undo) }
                : undefined
            }
            message={notice}
            onDismiss={() => {
              setNotice(undefined);
              setUndo(undefined);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function describeOpenAmount(progress: SavingsProgress): string {
  if (progress.openMinor > 0) {
    return `Noch offen: ${formatMoney(
      createMoney(progress.openMinor, progress.currency),
    )}`;
  }
  if (progress.openMinor === 0) {
    return "Nichts mehr offen";
  }
  return `Darüber hinaus: ${formatMoney(
    createMoney(Math.abs(progress.openMinor), progress.currency),
  )}`;
}

/** Füllt das Formular mit dem gespeicherten Betrag in deutscher Schreibweise. */
function toAmountInput(contribution: SavingsContribution): string {
  return formatMoney(contribution.money)
    .replace(/[^\d,.]/g, "")
    .trim();
}

function formatDay(day: CalendarDay): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
