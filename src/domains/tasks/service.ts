import {
  createIsoInstant,
  systemClock,
  type Clock,
} from "../../lib/dates/date-values";
import { personalOsTaskRepository, type TaskRepository } from "./repository";
import { taskDetailsSchema, type Task, type TaskDetails } from "./model";

export interface TaskService {
  archive(id: string): Promise<Task>;
  cancel(id: string): Promise<Task>;
  complete(id: string): Promise<Task>;
  create(details: TaskDetails): Promise<Task>;
  list(): Promise<Task[]>;
  reopen(id: string): Promise<Task>;
  restore(id: string): Promise<Task>;
  updateDetails(id: string, details: TaskDetails): Promise<Task>;
}

export function createTaskService(
  repository: TaskRepository,
  clock: Clock = systemClock,
): TaskService {
  const normalizeDetails = (details: TaskDetails): TaskDetails => {
    const normalized = {
      ...details,
      notes: details.notes?.trim() || undefined,
      title: details.title.trim(),
    };
    return taskDetailsSchema.parse(normalized);
  };

  return {
    archive: (id) => repository.archive(id),
    async cancel(id) {
      return repository.update(id, {
        completedAt: undefined,
        status: "cancelled",
      });
    },
    async complete(id) {
      return repository.update(id, {
        completedAt: createIsoInstant(clock.now()),
        status: "completed",
      });
    },
    create: (details) => repository.create(normalizeDetails(details)),
    list: () => repository.list(),
    async reopen(id) {
      return repository.update(id, {
        completedAt: undefined,
        status: "open",
      });
    },
    restore: (id) => repository.restore(id),
    updateDetails: (id, details) =>
      repository.update(id, normalizeDetails(details)),
  };
}

export const personalOsTaskService = createTaskService(
  personalOsTaskRepository,
);
