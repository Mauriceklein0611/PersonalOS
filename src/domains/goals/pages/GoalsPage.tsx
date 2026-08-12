import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useTimeZone } from "../../../app/settings/settings-context";
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  PageToolbar,
  ProgressBar,
  Select,
  Textarea,
  Toast,
} from "../../../components/ui";
import {
  personalOsGoalLinkService,
  type GoalLinkService,
} from "../link-service";
import { describeGoalLinks, type GoalLinkSummary } from "../links";
import { calendarDayForInstant } from "../../../lib/dates/calendar-days";
import {
  goalProgressModeLabels,
  goalStatusLabels,
  goalStatuses,
  type Goal,
  type GoalMilestone,
  type GoalProgressMode,
  type GoalStatus,
} from "../model";
import {
  calculateGoalProgress,
  canChangeGoalStatus,
  describeDeadline,
  sortMilestones,
} from "../progress";
import { personalOsGoalService, type GoalService } from "../service";
import "./goals-page.css";

type GoalUndoAction = {
  message: string;
  run: () => Promise<unknown>;
};

export type GoalsPageProps = {
  goalLinks?: GoalLinkService;
  now?: () => Date;
  service?: GoalService;
  timeZone?: string;
};

export function GoalsPage({
  goalLinks = personalOsGoalLinkService,
  now = () => new Date(),
  service = personalOsGoalService,
  timeZone: timeZoneOverride,
}: GoalsPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<GoalUndoAction>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [progressMode, setProgressMode] =
    useState<GoalProgressMode>("milestones");
  const [titleError, setTitleError] = useState<string>();
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneError, setMilestoneError] = useState<string>();
  const [links, setLinks] = useState<GoalLinkSummary>();
  const [deletion, setDeletion] = useState<{
    goal: Goal;
    habits: number;
    tasks: number;
  }>();

  const selected = goals.find((goal) => goal.id === selectedId);

  const loadMilestones = useCallback(
    async (goalId: string) => {
      setMilestones(await service.listMilestones(goalId));
    },
    [service],
  );

  // Verknüpfte Elemente werden nur gelesen; die Zielseite kennt keine UI der
  // Aufgaben- oder Routinendomain.
  useEffect(() => {
    if (!selected) return;
    let isCurrent = true;
    void goalLinks
      .summarize(selected)
      .then((summary) => {
        if (isCurrent) setLinks(summary);
      })
      .catch(() => {
        if (isCurrent) setLinks(undefined);
      });
    return () => {
      isCurrent = false;
    };
  }, [goalLinks, selected]);

  const reload = useCallback(
    async (keepId?: string) => {
      const stored = await service.list();
      setGoals(stored);
      const nextId = keepId ?? stored[0]?.id;
      setSelectedId(nextId);
      setMilestones(nextId ? await service.listMilestones(nextId) : []);
    },
    [service],
  );

  useEffect(() => {
    let isCurrent = true;
    void service
      .list()
      .then(async (stored) => {
        if (!isCurrent) return;
        setGoals(stored);
        setIsCreateOpen(stored.length === 0);
        const firstId = stored[0]?.id;
        setSelectedId(firstId);
        if (firstId) setMilestones(await service.listMilestones(firstId));
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setError("Die Ziele konnten nicht geladen werden.");
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [service]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setError(undefined);
    try {
      await action();
      return true;
    } catch {
      setError(failure);
      return false;
    }
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setTitleError("Gib einen Titel mit mindestens einem Zeichen ein.");
      return;
    }

    setTitleError(undefined);
    const created = await run(async () => {
      const goal = await service.create({
        progressMode,
        status: "active",
        title: trimmed,
        ...(description.trim().length > 0
          ? { description: description.trim() }
          : {}),
        ...(targetDate.length > 0 ? { targetDate } : {}),
      });
      await reload(goal.id);
    }, "Das Ziel konnte nicht gespeichert werden.");

    if (created) {
      setTitle("");
      setDescription("");
      setTargetDate("");
      setIsCreateOpen(false);
      setNotice("Das Ziel wurde angelegt.");
      setUndo(undefined);
    }
  }

  async function changeStatus(goal: Goal, status: GoalStatus) {
    const previous = goal.status;
    const changed = await run(async () => {
      await service.changeStatus(goal.id, status);
      await reload(goal.id);
    }, "Der Status konnte nicht geändert werden.");

    if (changed) {
      setNotice(`Der Status ist jetzt „${goalStatusLabels[status]}“.`);
      setUndo({
        message: `Der Status ist wieder „${goalStatusLabels[previous]}“.`,
        run: async () => {
          await service.changeStatus(goal.id, previous);
          await reload(goal.id);
        },
      });
    }
  }

  async function archiveGoal(goal: Goal) {
    const archived = await run(async () => {
      await service.archive(goal.id);
      await reload();
    }, "Das Ziel konnte nicht archiviert werden.");

    if (archived) {
      setNotice(
        "Das Ziel wurde archiviert. Die Meilensteine bleiben erhalten.",
      );
      setUndo({
        message: "Das Ziel ist wieder sichtbar.",
        run: async () => {
          await service.restore(goal.id);
          await reload(goal.id);
        },
      });
    }
  }

  async function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    const trimmed = milestoneTitle.trim();
    if (trimmed.length === 0) {
      setMilestoneError("Gib einen Titel mit mindestens einem Zeichen ein.");
      return;
    }

    setMilestoneError(undefined);
    const added = await run(async () => {
      await service.addMilestone(selected.id, trimmed);
      await loadMilestones(selected.id);
    }, "Der Meilenstein konnte nicht gespeichert werden.");

    if (added) {
      setMilestoneTitle("");
      setNotice("Der Meilenstein wurde angelegt.");
      setUndo(undefined);
    }
  }

  async function toggleMilestone(milestone: GoalMilestone, done: boolean) {
    if (!selected) return;
    await run(async () => {
      await service.setMilestoneStatus(
        milestone.id,
        done ? "completed" : "open",
      );
      await loadMilestones(selected.id);
    }, "Der Meilenstein konnte nicht aktualisiert werden.");
  }

  async function removeMilestone(milestone: GoalMilestone) {
    if (!selected) return;
    const removed = await run(async () => {
      await service.removeMilestone(milestone.id);
      await loadMilestones(selected.id);
    }, "Der Meilenstein konnte nicht entfernt werden.");

    if (removed) {
      setNotice("Der Meilenstein wurde entfernt.");
      setUndo({
        message: "Der Meilenstein ist wieder da.",
        run: async () => {
          await service.restoreMilestone(milestone.id);
          await loadMilestones(selected.id);
        },
      });
    }
  }

  async function updateManualProgress(goal: Goal, value: string) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    await run(async () => {
      await service.setManualProgress(goal.id, parsed);
      await reload(goal.id);
    }, "Der Fortschritt konnte nicht gespeichert werden.");
  }

  async function askForDeletion(goal: Goal) {
    setError(undefined);
    try {
      const counts = await goalLinks.countReferences(goal);
      setDeletion({ goal, habits: counts.habits, tasks: counts.tasks });
    } catch {
      setError("Die Verknüpfungen konnten nicht geprüft werden.");
    }
  }

  async function confirmDeletion() {
    if (!deletion) return;
    const { goal } = deletion;
    setDeletion(undefined);

    const removed = await run(async () => {
      await goalLinks.deleteGoalPermanently(goal);
      await reload();
    }, "Das Ziel konnte nicht gelöscht werden.");

    if (removed) {
      // Endgültiges Löschen ist nicht umkehrbar, deshalb kein Undo-Angebot.
      setNotice(
        "Das Ziel wurde endgültig gelöscht. Aufgaben und Routinen sind erhalten geblieben.",
      );
      setUndo(undefined);
    }
  }

  async function runUndo(action: GoalUndoAction) {
    setUndo(undefined);
    const done = await run(
      action.run,
      "Die Aktion konnte nicht rückgängig gemacht werden.",
    );
    if (done) setNotice(action.message);
  }

  const visibleMilestones = sortMilestones(
    milestones.filter((milestone) => milestone.archivedAt === undefined),
  );
  const progress = selected
    ? calculateGoalProgress(selected, milestones)
    : undefined;
  const deadline = selected ? describeDeadline(selected, today) : undefined;

  return (
    <section
      aria-labelledby="page-title"
      className="route-page goals-page"
      data-surface="work"
    >
      <PageToolbar
        actions={
          <Button
            aria-expanded={isCreateOpen}
            onClick={() => setIsCreateOpen((open) => !open)}
          >
            {isCreateOpen ? "Erfassung schließen" : "Neues Ziel"}
          </Button>
        }
        description="Ziele und Meilensteine bilden eine scanbare Hierarchie mit Fortschritt direkt am ausgewählten Vorhaben."
        eyebrow="Ausrichtung"
        surface="work"
        title="Ziele"
      />

      {error ? (
        <p className="page-alert goal-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="goal-status" role="status">
          Ziele werden geladen …
        </p>
      ) : (
        <>
          {isCreateOpen ? (
            <section aria-labelledby="new-goal-title" className="goal-create">
              <h2 id="new-goal-title">Neues Ziel</h2>
              <form
                className="goal-form"
                noValidate
                onSubmit={(event) => void submitGoal(event)}
              >
                <Input
                  error={titleError}
                  label="Titel"
                  onChange={(event) => {
                    setTitle(event.currentTarget.value);
                    setTitleError(undefined);
                  }}
                  required
                  value={title}
                />
                <Input
                  hint="Optional. Ohne Datum bleibt das Ziel offen."
                  label="Zieldatum"
                  onChange={(event) => setTargetDate(event.currentTarget.value)}
                  type="date"
                  value={targetDate}
                />
                <Select
                  hint="Meilensteine rechnen aus Schritten, manuell erfasst du selbst."
                  label="Fortschritt"
                  onChange={(event) =>
                    setProgressMode(
                      event.currentTarget.value as GoalProgressMode,
                    )
                  }
                  value={progressMode}
                >
                  {(["milestones", "manual"] as const).map((mode) => (
                    <option key={mode} value={mode}>
                      {goalProgressModeLabels[mode]}
                    </option>
                  ))}
                </Select>
                <Textarea
                  hint="Optional, zum Beispiel warum dir das wichtig ist."
                  label="Beschreibung"
                  onChange={(event) =>
                    setDescription(event.currentTarget.value)
                  }
                  value={description}
                />
                <Button type="submit">Ziel anlegen</Button>
              </form>
            </section>
          ) : null}

          <h2>Deine Ziele</h2>
          {goals.length === 0 ? (
            <EmptyState
              description="Lege ein erstes Ziel an, um es in Schritte zu zerlegen."
              title="Noch kein Ziel"
            />
          ) : (
            <ul className="goal-list ui-dense-panel ui-dense-list">
              {goals.map((goal) => {
                const goalDeadline = describeDeadline(goal, today);
                return (
                  <li
                    className="goal-card ui-dense-row"
                    data-selected={goal.id === selectedId}
                    key={goal.id}
                  >
                    <div className="goal-card-head">
                      <h3>{goal.title}</h3>
                      <p className="goal-chip">
                        {goalStatusLabels[goal.status]}
                      </p>
                    </div>
                    <p className="goal-meta">
                      {goalProgressModeLabels[goal.progressMode]} ·{" "}
                      {goalDeadline.text}
                    </p>
                    {goal.id === selectedId ? null : (
                      <Button
                        onClick={() => {
                          setSelectedId(goal.id);
                          void loadMilestones(goal.id);
                        }}
                        variant="secondary"
                      >
                        Schritte zu „{goal.title}“ zeigen
                      </Button>
                    )}
                    {/* Nur der manuelle Wert steht ohne geladene Meilensteine
                        fest; die Meilensteinquote zeigt das Detail. */}
                    {goal.progressMode === "manual" ? (
                      <p className="goal-meta">
                        {calculateGoalProgress(goal, []).basis}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {selected && progress && deadline ? (
            <section
              aria-labelledby="goal-detail-title"
              className="goal-detail"
            >
              <h2 id="goal-detail-title">{selected.title}</h2>
              {selected.description ? (
                <p className="goal-description">{selected.description}</p>
              ) : null}

              <ProgressBar
                caption={progress.basis}
                label="Fortschritt"
                value={progress.ratio}
              />
              <p className="goal-meta">{deadline.text}</p>
              {/* Nur anzeigen, wenn die Auswertung zum gewählten Ziel gehört. */}
              {links && links.goalId === selected.id ? (
                <div className="goal-links">
                  <p className="goal-meta">{describeGoalLinks(links)}</p>
                  {links.taskTitles.length > 0 ? (
                    <p className="goal-meta">
                      Aufgaben: {links.taskTitles.join(", ")}
                    </p>
                  ) : null}
                  {links.habitNames.length > 0 ? (
                    <p className="goal-meta">
                      Routinen: {links.habitNames.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selected.progressMode === "manual" ? (
                <Input
                  hint="Ganze Zahl zwischen 0 und 100."
                  label="Fortschritt in Prozent"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    void updateManualProgress(
                      selected,
                      event.currentTarget.value,
                    )
                  }
                  type="number"
                  value={String(selected.manualProgress ?? 0)}
                />
              ) : (
                <>
                  <h3>Meilensteine</h3>
                  {visibleMilestones.length === 0 ? (
                    <p className="goal-status">
                      Noch kein Meilenstein. Ein leeres Ziel ist in Ordnung.
                    </p>
                  ) : (
                    <ul className="goal-milestones">
                      {visibleMilestones.map((milestone) => (
                        <li key={milestone.id}>
                          <Checkbox
                            checked={milestone.status === "completed"}
                            label={milestone.title}
                            onChange={(event) =>
                              void toggleMilestone(
                                milestone,
                                event.currentTarget.checked,
                              )
                            }
                          />
                          <IconButton
                            label={`Meilenstein „${milestone.title}“ entfernen`}
                            onClick={() => void removeMilestone(milestone)}
                          >
                            ×
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form
                    className="goal-milestone-form"
                    noValidate
                    onSubmit={(event) => void submitMilestone(event)}
                  >
                    <Input
                      error={milestoneError}
                      label="Neuer Meilenstein"
                      onChange={(event) => {
                        setMilestoneTitle(event.currentTarget.value);
                        setMilestoneError(undefined);
                      }}
                      value={milestoneTitle}
                    />
                    <Button type="submit" variant="secondary">
                      Meilenstein hinzufügen
                    </Button>
                  </form>
                </>
              )}

              <div className="goal-actions">
                {goalStatuses
                  .filter(
                    (status) =>
                      status !== selected.status &&
                      canChangeGoalStatus(selected.status, status),
                  )
                  .map((status) => (
                    <Button
                      key={status}
                      onClick={() => void changeStatus(selected, status)}
                      variant="secondary"
                    >
                      {goalStatusLabels[status]}
                    </Button>
                  ))}
                <Button
                  onClick={() => void archiveGoal(selected)}
                  variant="ghost"
                >
                  Ziel archivieren
                </Button>
                <Button
                  onClick={() => void askForDeletion(selected)}
                  variant="danger"
                >
                  Ziel endgültig löschen
                </Button>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* Endgültiges Löschen ist nicht umkehrbar und nennt vorher, was es
          anfasst und was erhalten bleibt. */}
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
        title="Ziel endgültig löschen"
      >
        {deletion ? (
          <p>
            „{deletion.goal.title}“ und seine Meilensteine werden entfernt.{" "}
            {deletion.tasks + deletion.habits === 0
              ? "Es ist nichts mit diesem Ziel verknüpft."
              : `${deletion.tasks} Aufgaben und ${deletion.habits} Routinen verlieren nur die Verknüpfung; die Einträge selbst bleiben erhalten.`}
          </p>
        ) : null}
      </Dialog>

      {notice ? (
        <div className="goal-toast-region">
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

export function Component() {
  return <GoalsPage />;
}
