import type { PlanCode } from "../repositories/app-repository.types.js";

export type PlanLimits = {
  aiActionsLimit: number;
  exportsLimit: number;
  sourceUploadsLimit: number;
};

export const PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  free: {
    aiActionsLimit: 10,
    exportsLimit: 3,
    sourceUploadsLimit: 10,
  },
  pro: {
    aiActionsLimit: 50,
    exportsLimit: 25,
    sourceUploadsLimit: 25,
  },
};

export const MAX_IN_FLIGHT_EXPORTS_PER_USER = 5;
export const MAX_IN_FLIGHT_SOURCES_PER_USER = 5;
