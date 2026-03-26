/** Monthly AI actions cap for the current single-tier plan (see Sprint 2). */
export const PLAN_AI_ACTIONS_LIMIT = 10;

/** Successful DOCX exports per billing period for free tier. */
export const PLAN_EXPORTS_LIMIT = 3;

/** Max concurrent queued/processing exports per user per period (abuse guard). */
export const MAX_IN_FLIGHT_EXPORTS_PER_USER = 5;

/** Successful source parses (ready) per billing period for free tier. */
export const PLAN_SOURCE_UPLOADS_LIMIT = 10;

/** Max concurrent queued/processing sources per user per period (abuse guard). */
export const MAX_IN_FLIGHT_SOURCES_PER_USER = 5;
