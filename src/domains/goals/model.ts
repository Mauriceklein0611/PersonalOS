import { z } from "zod";

import {
  goalDetailsSchema,
  goalMilestoneDetailsSchema,
  goalMilestoneSchema,
  goalSchema,
} from "../../db/schemas/domain-records";

export {
  goalDetailsSchema,
  goalMilestoneDetailsSchema,
  goalMilestoneSchema,
  goalSchema,
};

export type Goal = z.infer<typeof goalSchema>;
export type GoalDetails = z.infer<typeof goalDetailsSchema>;
export type GoalMilestone = z.infer<typeof goalMilestoneSchema>;
export type GoalMilestoneDetails = z.infer<typeof goalMilestoneDetailsSchema>;
export type GoalStatus = Goal["status"];
export type GoalProgressMode = Goal["progressMode"];
export type GoalMilestoneStatus = GoalMilestone["status"];

export const goalStatuses = [
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

/** Beschreibt den Zustand, nicht den Wert des Menschen dahinter. */
export const goalStatusLabels: Record<GoalStatus, string> = {
  active: "Aktiv",
  cancelled: "Nicht weiterverfolgt",
  completed: "Abgeschlossen",
  paused: "Pausiert",
};

export const goalProgressModeLabels: Record<GoalProgressMode, string> = {
  manual: "Manuell",
  milestones: "Meilensteine",
};
