import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  contentJson: jsonb("content_json").notNull(),
  plainText: text("plain_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  documentId: uuid("document_id"),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  units: integer("units").notNull().default(1),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monthlyUsageCounters = pgTable("monthly_usage_counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  period: varchar("period", { length: 7 }).notNull(),
  aiActionsUsed: integer("ai_actions_used").notNull().default(0),
  sourceUploadsUsed: integer("source_uploads_used").notNull().default(0),
  exportsUsed: integer("exports_used").notNull().default(0),
  storageUsedBytes: integer("storage_used_bytes").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const exportsTable = pgTable("exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull(),
  userId: uuid("user_id").notNull(),
  format: varchar("format", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  storageKey: text("storage_key"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
