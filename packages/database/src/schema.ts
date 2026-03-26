import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    planCode: varchar("plan_code", { length: 32 }).notNull().default("free"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("users_clerk_user_id_idx").on(
      table.clerkUserId,
    ),
  }),
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 32 }).notNull().default("general_paper"),
  contentJson: jsonb("content_json").notNull(),
  plainText: text("plain_text"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    documentId: uuid("document_id"),
    billingPeriod: varchar("billing_period", { length: 7 }).notNull(),
    featureKey: varchar("feature_key", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("succeeded"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    requestHash: varchar("request_hash", { length: 128 }),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    units: integer("units").notNull().default(1),
    metadataJson: jsonb("metadata_json"),
    completedAt: timestamp("completed_at"),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdempotencyKeyIdx: uniqueIndex(
      "usage_events_user_id_idempotency_key_idx",
    ).on(table.userId, table.idempotencyKey),
  }),
);

export const monthlyUsageCounters = pgTable(
  "monthly_usage_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    aiActionsUsed: integer("ai_actions_used").notNull().default(0),
    sourceUploadsUsed: integer("source_uploads_used").notNull().default(0),
    exportsUsed: integer("exports_used").notNull().default(0),
    storageUsedBytes: integer("storage_used_bytes").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userPeriodIdx: uniqueIndex("monthly_usage_counters_user_id_period_idx").on(
      table.userId,
      table.period,
    ),
  }),
);

export const aiActionsReserved = pgTable(
  "ai_actions_reserved",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    aiActionsReserved: integer("ai_actions_reserved").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userPeriodIdx: uniqueIndex("ai_actions_reserved_user_id_period_idx").on(
      table.userId,
      table.period,
    ),
  }),
);

export const documentChangeProposals = pgTable("document_change_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull(),
  userId: uuid("user_id").notNull(),
  proposalJson: jsonb("proposal_json").notNull(),
  actionType: varchar("action_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  baseUpdatedAt: timestamp("base_updated_at").notNull(),
  targetBlockIds: text("target_block_ids").array().notNull(),
  appliedAt: timestamp("applied_at"),
  dismissedAt: timestamp("dismissed_at"),
  invalidatedAt: timestamp("invalidated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const exportsTable = pgTable(
  "exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull(),
    userId: uuid("user_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    billingPeriod: varchar("billing_period", { length: 7 }).notNull(),
    format: varchar("format", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    bullmqJobId: text("bullmq_job_id"),
    preflightWarnings: jsonb("preflight_warnings"),
    retryCount: integer("retry_count").notNull().default(0),
    storageKey: text("storage_key"),
    contentType: varchar("content_type", { length: 128 }),
    fileSizeBytes: integer("file_size_bytes"),
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 64 }),
    processingStartedAt: timestamp("processing_started_at"),
    readyAt: timestamp("ready_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdempotencyIdx: uniqueIndex("exports_user_id_idempotency_key_idx").on(
      table.userId,
      table.idempotencyKey,
    ),
  }),
);
