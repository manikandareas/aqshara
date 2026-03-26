import { z } from "@hono/zod-openapi";

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
});

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.literal("api"),
  timestamp: z.string(),
});

export const AppUserSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  planCode: z.literal("free"),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
});

export const UsageSchema = z.object({
  period: z.string(),
  aiActionsUsed: z.number(),
  aiActionsReserved: z.number(),
  aiActionsRemaining: z.number(),
  exportsRemaining: z.number(),
  sourceUploadsRemaining: z.number(),
});

export const PlanSummarySchema = z.object({
  code: z.literal("free"),
  label: z.literal("Free"),
});
