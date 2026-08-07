import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError } from "../../db/errors";
import type { ListOptions } from "../../db/repositories/contracts";
import {
  runInTransaction,
  type TransactionTableNames,
} from "../../db/transactions";
import type {
  SavingsContribution,
  SavingsContributionDetails,
  SavingsGoal,
  SavingsGoalDetails,
  SavingsGoalStatus,
} from "./model";
import {
  personalOsSavingsContributionRepository,
  personalOsSavingsGoalRepository,
  personalOsTransactionRepository,
  type SavingsContributionRepository,
  type SavingsGoalRepository,
  type TransactionRepository,
} from "./repository";
import { sortContributions } from "./savings";
import {
  checkSavingsLink,
  describeSavingsLinkRejection,
  SavingsLinkError,
  type SavingsLinkRejection,
  type SavingsLinkSubject,
} from "./savings-link";

/** Ein Beitrag gehört dauerhaft zu seinem Sparziel; ein Umhängen ist nicht vorgesehen. */
export type SavingsContributionPatch = Partial<
  Omit<SavingsContributionDetails, "savingsGoalId">
>;

export type SavingsGoalDeletion = {
  removedContributionCount: number;
  savingsGoalId: string;
};

export interface SavingsService {
  addContribution(
    details: SavingsContributionDetails,
  ): Promise<SavingsContribution>;
  archiveGoal(id: string): Promise<SavingsGoal>;
  changeStatus(id: string, status: SavingsGoalStatus): Promise<SavingsGoal>;
  /** Zählt auch zurückgenommene Beiträge, weil das Löschen alle entfernt. */
  countContributions(savingsGoalId: string): Promise<number>;
  createGoal(details: SavingsGoalDetails): Promise<SavingsGoal>;
  deleteGoalPermanently(id: string): Promise<SavingsGoalDeletion>;
  listContributions(savingsGoalId?: string): Promise<SavingsContribution[]>;
  listGoals(options?: ListOptions): Promise<SavingsGoal[]>;
  /** Nimmt einen Beitrag zurück; er zählt nicht mehr, bleibt aber im Verlauf. */
  removeContribution(id: string): Promise<SavingsContribution>;
  restoreContribution(id: string): Promise<SavingsContribution>;
  restoreGoal(id: string): Promise<SavingsGoal>;
  updateContribution(
    id: string,
    patch: SavingsContributionPatch,
  ): Promise<SavingsContribution>;
  updateGoal(id: string, details: SavingsGoalDetails): Promise<SavingsGoal>;
}

const savingsTables: TransactionTableNames = [
  "savingsGoals",
  "savingsContributions",
];

/** Eine Verknüpfung wird gegen die Buchungen geprüft; sie gehören dazu. */
const savingsLinkTables: TransactionTableNames = [
  ...savingsTables,
  "transactions",
];

export function createSavingsService(
  dependencies: {
    contributions?: SavingsContributionRepository;
    database?: PersonalOsDatabase;
    goals?: SavingsGoalRepository;
    transactions?: TransactionRepository;
  } = {},
): SavingsService {
  const database = dependencies.database ?? personalOsDatabase;
  const contributions =
    dependencies.contributions ?? personalOsSavingsContributionRepository;
  const goals = dependencies.goals ?? personalOsSavingsGoalRepository;
  const transactions =
    dependencies.transactions ?? personalOsTransactionRepository;

  /**
   * Die Prüfung liegt in derselben Transaktion wie das Schreiben. Zwischen
   * „geprüft" und „gespeichert" kann deshalb keine zweite Verknüpfung auf
   * dieselbe Ausgabe entstehen.
   */
  async function checkLink(
    sourceTransactionId: string,
    subject: SavingsLinkSubject,
    editedContributionId?: string,
  ): Promise<SavingsLinkRejection | undefined> {
    const result = checkSavingsLink(
      await transactions.get(sourceTransactionId),
      subject,
      // Auch ein zurückgenommener Beitrag belegt seine Ausgabe weiter.
      await contributions.list({ includeArchived: true }),
      editedContributionId,
    );
    return result.ok ? undefined : result.reason;
  }

  return {
    // Prüfung und Schreiben liegen in derselben Transaktion, damit kein
    // Beitrag in einer fremden Währung an einem Ziel landen kann.
    async addContribution(details) {
      const outcome = await runInTransaction(
        database,
        savingsLinkTables,
        async () => {
          const goal = await goals.require(details.savingsGoalId);
          assertSameCurrency(goal, details.money.currency);
          if (details.sourceTransactionId !== undefined) {
            const rejection = await checkLink(details.sourceTransactionId, {
              amountMinor: details.money.amountMinor,
              bookedOn: details.bookedOn,
              currency: details.money.currency,
            });
            // Die abgelehnte Verknüpfung verlässt die Transaktion als Ergebnis
            // und nicht als Ausnahme: Sonst würde sie unterwegs zu einem
            // allgemeinen Speicherfehler und verlöre ihren Grund.
            if (rejection !== undefined) return { rejection };
          }
          return { contribution: await contributions.create(details) };
        },
      );

      return unwrapLink(outcome);
    },
    archiveGoal: (id) => goals.archive(id),
    changeStatus: (id, status) => goals.update(id, { status }),
    async countContributions(savingsGoalId) {
      const stored = await contributions.listForGoal(savingsGoalId, {
        includeArchived: true,
      });
      return stored.length;
    },
    createGoal: (details) => goals.create(details),
    deleteGoalPermanently(id) {
      return runInTransaction(database, savingsTables, async () => {
        await goals.require(id);
        const stored = await contributions.listForGoal(id, {
          includeArchived: true,
        });
        // Beiträge ohne ihr Sparziel wären verwaiste Datensätze; beides geht
        // deshalb gemeinsam oder gar nicht.
        for (const contribution of stored) {
          await contributions.deletePermanently(contribution.id);
        }
        await goals.deletePermanently(id);

        return { removedContributionCount: stored.length, savingsGoalId: id };
      });
    },
    async listContributions(savingsGoalId) {
      if (savingsGoalId !== undefined) {
        return contributions.listForGoal(savingsGoalId);
      }
      return sortContributions(await contributions.list());
    },
    listGoals: (options) => goals.list(options),
    removeContribution: (id) => contributions.archive(id),
    restoreContribution: (id) => contributions.restore(id),
    restoreGoal: (id) => goals.restore(id),
    async updateContribution(id, patch) {
      const outcome = await runInTransaction(
        database,
        savingsLinkTables,
        async () => {
          const current = await contributions.require(id);
          if (patch.money !== undefined) {
            const goal = await goals.require(current.savingsGoalId);
            assertSameCurrency(goal, patch.money.currency);
          }

          // Geprüft wird der Beitrag, wie er nach der Änderung aussieht.
          const next = { ...current, ...patch };
          if (next.sourceTransactionId !== undefined) {
            const rejection = await checkLink(
              next.sourceTransactionId,
              {
                amountMinor: next.money.amountMinor,
                bookedOn: next.bookedOn,
                currency: next.money.currency,
              },
              id,
            );
            if (rejection !== undefined) return { rejection };
          }

          return { contribution: await contributions.update(id, patch) };
        },
      );

      return unwrapLink(outcome);
    },
    updateGoal(id, details) {
      return runInTransaction(database, savingsTables, async () => {
        const current = await goals.require(id);
        // Eine andere Währung würde vorhandene Beiträge unvergleichbar machen.
        if (details.target.currency !== current.target.currency) {
          const stored = await contributions.listForGoal(id, {
            includeArchived: true,
          });
          if (stored.length > 0) {
            throw new PersistenceError("validation");
          }
        }
        return goals.update(id, {
          ...details,
          targetDate: details.targetDate,
        });
      });
    },
  };
}

type LinkOutcome =
  { contribution: SavingsContribution } | { rejection: SavingsLinkRejection };

function unwrapLink(outcome: LinkOutcome): SavingsContribution {
  if ("rejection" in outcome) {
    throw new SavingsLinkError(describeSavingsLinkRejection(outcome.rejection));
  }
  return outcome.contribution;
}

function assertSameCurrency(goal: SavingsGoal, currency: string): void {
  if (goal.target.currency !== currency) {
    throw new PersistenceError("validation");
  }
}

export const personalOsSavingsService = createSavingsService();
