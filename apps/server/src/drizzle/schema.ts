import {
  bigint,
  boolean,
  jsonb,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    filename: text('filename').notNull(),
    status: text('status').notNull(),
    pipelineStage: text('pipeline_stage').notNull(),
    requireTranslate: boolean('require_translate').notNull().default(false),
    requireVideoGeneration: boolean('require_video_generation')
      .notNull()
      .default(false),
    sourceLang: text('source_lang'),
    pageCount: integer('page_count'),
    title: text('title'),
    abstract: text('abstract'),
    pdfType: text('pdf_type'),
    ocrQuality: real('ocr_quality'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('documents_owner_created_idx').on(table.ownerId, table.createdAt),
    index('documents_owner_status_created_idx').on(
      table.ownerId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const documentMetadata = pgTable(
  'document_metadata',
  {
    documentId: text('document_id')
      .primaryKey()
      .references(() => documents.id, { onDelete: 'cascade' }),
    sourceObjectKey: text('source_object_key').notNull(),
    contentType: text('content_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('document_metadata_source_object_key_idx').on(table.sourceObjectKey),
  ],
);

export const stageRuns = pgTable(
  'stage_runs',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull(),
    progressPct: integer('progress_pct'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('stage_runs_document_created_idx').on(
      table.documentId,
      table.createdAt,
    ),
    uniqueIndex('stage_runs_document_name_uidx').on(
      table.documentId,
      table.name,
    ),
  ],
);

export const sections = pgTable(
  'sections',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    level: integer('level').notNull().default(1),
    title: text('title').notNull(),
    titleId: text('title_id'),
    paraStart: text('para_start'),
    orderNo: integer('order_no').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sections_document_order_idx').on(table.documentId, table.orderNo),
    uniqueIndex('sections_document_section_uidx').on(
      table.documentId,
      table.id,
    ),
  ],
);

export const paragraphs = pgTable(
  'paragraphs',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    sectionId: text('section_id'),
    orderNo: integer('order_no').notNull(),
    pageNo: integer('page_no').notNull(),
    sourceStart: integer('source_start'),
    sourceEnd: integer('source_end'),
    textRaw: text('text_raw').notNull(),
    textRawMd: text('text_raw_md').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('paragraphs_document_order_idx').on(table.documentId, table.orderNo),
    index('paragraphs_document_section_order_idx').on(
      table.documentId,
      table.sectionId,
      table.orderNo,
    ),
    index('paragraphs_document_page_idx').on(table.documentId, table.pageNo),
    uniqueIndex('paragraphs_document_paragraph_uidx').on(
      table.documentId,
      table.id,
    ),
  ],
);

export const paragraphTranslations = pgTable(
  'paragraph_translations',
  {
    paragraphId: text('paragraph_id')
      .primaryKey()
      .references(() => paragraphs.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    textEn: text('text_en'),
    textEnMd: text('text_en_md'),
    textId: text('text_id'),
    textIdMd: text('text_id_md'),
    cacheHash: text('cache_hash'),
    translatedAt: timestamp('translated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('paragraph_translations_document_status_idx').on(
      table.documentId,
      table.status,
      table.paragraphId,
    ),
  ],
);

export const terms = pgTable(
  'terms',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    termEn: text('term_en').notNull(),
    definition: text('definition'),
    definitionId: text('definition_id'),
    example: text('example'),
    exampleId: text('example_id'),
    occurrenceCount: integer('occurrence_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('terms_document_term_idx').on(table.documentId, table.termEn),
    uniqueIndex('terms_document_term_uidx').on(table.documentId, table.id),
  ],
);

export const termOccurrences = pgTable(
  'term_occurrences',
  {
    id: text('id').primaryKey(),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
    paragraphId: text('paragraph_id')
      .notNull()
      .references(() => paragraphs.id, { onDelete: 'cascade' }),
    pageNo: integer('page_no').notNull(),
    snippetEn: text('snippet_en').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('term_occurrences_term_page_idx').on(table.termId, table.pageNo),
  ],
);

export const videoJobs = pgTable(
  'video_jobs',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    status: text('status').notNull(),
    pipelineStage: text('pipeline_stage').notNull(),
    progressPct: integer('progress_pct').notNull().default(0),
    targetDurationSec: integer('target_duration_sec').notNull().default(60),
    voice: text('voice').notNull(),
    language: text('language').notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    currentAttempt: integer('current_attempt').notNull().default(1),
    currentSceneIndex: integer('current_scene_index'),
    fallbackUsedCount: integer('fallback_used_count').notNull().default(0),
    renderProfile: text('render_profile').notNull().default('720p'),
    workerId: text('worker_id'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    terminalEventId: text('terminal_event_id'),
    qualityGate: jsonb('quality_gate').notNull().default({}),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    finalVideoObjectKey: text('final_video_object_key'),
    finalThumbnailObjectKey: text('final_thumbnail_object_key'),
    bunnyLibraryId: text('bunny_library_id'),
    bunnyVideoId: text('bunny_video_id'),
    bunnyStatus: integer('bunny_status'),
    durationSec: real('duration_sec'),
    resolution: text('resolution'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('video_jobs_owner_status_created_idx').on(
      table.ownerId,
      table.status,
      table.createdAt,
    ),
    index('video_jobs_document_created_idx').on(
      table.documentId,
      table.createdAt,
    ),
  ],
);

export const videoJobOutbox = pgTable(
  'video_job_outbox',
  {
    id: text('id').primaryKey(),
    videoJobId: text('video_job_id')
      .notNull()
      .references(() => videoJobs.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text('last_error'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('video_job_outbox_publish_idx').on(
      table.publishedAt,
      table.nextAttemptAt,
      table.createdAt,
    ),
    index('video_job_outbox_job_created_idx').on(
      table.videoJobId,
      table.createdAt,
    ),
  ],
);

export const videoJobEvents = pgTable(
  'video_job_events',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    videoJobId: text('video_job_id')
      .notNull()
      .references(() => videoJobs.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    attempt: integer('attempt').notNull(),
    workerId: text('worker_id'),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('video_job_events_event_id_uidx').on(table.eventId),
    index('video_job_events_job_created_idx').on(
      table.videoJobId,
      table.createdAt,
    ),
  ],
);

export const videoJobScenes = pgTable(
  'video_job_scenes',
  {
    id: text('id').primaryKey(),
    videoJobId: text('video_job_id')
      .notNull()
      .references(() => videoJobs.id, { onDelete: 'cascade' }),
    sceneIndex: integer('scene_index').notNull(),
    title: text('title'),
    narrationText: text('narration_text'),
    templateType: text('template_type'),
    plannedDurationMs: integer('planned_duration_ms'),
    actualAudioDurationMs: integer('actual_audio_duration_ms'),
    renderStatus: text('render_status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    manimCodeObjectKey: text('manim_code_object_key'),
    audioObjectKey: text('audio_object_key'),
    videoObjectKey: text('video_object_key'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('video_job_scenes_job_scene_uidx').on(
      table.videoJobId,
      table.sceneIndex,
    ),
    index('video_job_scenes_job_status_idx').on(
      table.videoJobId,
      table.renderStatus,
    ),
  ],
);

export const videoJobArtifacts = pgTable(
  'video_job_artifacts',
  {
    id: text('id').primaryKey(),
    videoJobId: text('video_job_id')
      .notNull()
      .references(() => videoJobs.id, { onDelete: 'cascade' }),
    artifactType: text('artifact_type').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('video_job_artifacts_job_created_idx').on(
      table.videoJobId,
      table.createdAt,
    ),
  ],
);

export const mapNodes = pgTable(
  'map_nodes',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    label: text('label').notNull(),
    labelId: text('label_id'),
    type: text('type').notNull(),
    paraRefs: text('para_refs').array().notNull().default([]),
    orderNo: integer('order_no').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('map_nodes_document_parent_order_idx').on(
      table.documentId,
      table.parentId,
      table.orderNo,
    ),
    uniqueIndex('map_nodes_document_node_uidx').on(table.documentId, table.id),
  ],
);

export const warnings = pgTable(
  'warnings',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    message: text('message').notNull(),
    pages: integer('pages').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('warnings_document_code_idx').on(table.documentId, table.code),
  ],
);

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    priceAmount: integer('price_amount'),
    priceCurrency: text('price_currency'),
    interval: text('interval'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('subscription_plans_code_uidx').on(table.code),
    index('subscription_plans_is_active_idx').on(table.isActive),
  ],
);

export const billingCustomers = pgTable(
  'billing_customers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    polarCustomerId: text('polar_customer_id'),
    email: text('email'),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('billing_customers_user_uidx').on(table.userId),
    uniqueIndex('billing_customers_polar_customer_uidx').on(
      table.polarCustomerId,
    ),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => billingCustomers.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    planId: text('plan_id').references(() => subscriptionPlans.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('subscriptions_user_status_idx').on(table.userId, table.status),
    index('subscriptions_customer_idx').on(table.customerId),
    index('subscriptions_plan_idx').on(table.planId),
  ],
);

export const usageHolds = pgTable(
  'usage_holds',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => billingCustomers.id, { onDelete: 'cascade' }),
    holdKey: text('hold_key').notNull(),
    units: integer('units').notNull().default(0),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('usage_holds_hold_key_uidx').on(table.holdKey),
    index('usage_holds_customer_status_idx').on(table.customerId, table.status),
  ],
);

export const usageLedger = pgTable(
  'usage_ledger',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => billingCustomers.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    entryType: text('entry_type').notNull(),
    unitsDelta: integer('units_delta').notNull(),
    sourceType: text('source_type').notNull(),
    sourceRef: text('source_ref'),
    idempotencyKey: text('idempotency_key'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('usage_ledger_idempotency_uidx').on(table.idempotencyKey),
    index('usage_ledger_user_created_idx').on(table.userId, table.createdAt),
    index('usage_ledger_customer_created_idx').on(
      table.customerId,
      table.createdAt,
    ),
  ],
);

export const usageCounters = pgTable(
  'usage_counters',
  {
    customerId: text('customer_id')
      .notNull()
      .references(() => billingCustomers.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    periodKey: text('period_key').notNull(),
    usedUnits: integer('used_units').notNull().default(0),
    heldUnits: integer('held_units').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('usage_counters_customer_period_uidx').on(
      table.customerId,
      table.periodKey,
    ),
    index('usage_counters_user_period_idx').on(table.userId, table.periodKey),
  ],
);

export const billingEvents = pgTable(
  'billing_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull().default('processing'),
    attemptCount: integer('attempt_count').notNull().default(0),
    payload: jsonb('payload').notNull().default({}),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('billing_events_type_received_idx').on(
      table.eventType,
      table.receivedAt,
    ),
    index('billing_events_status_received_idx').on(
      table.status,
      table.receivedAt,
    ),
  ],
);

export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    rating: integer('rating'),
    comment: text('comment'),
    issueType: text('issue_type'),
    description: text('description'),
    paragraphId: text('paragraph_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('feedback_document_created_idx').on(
      table.documentId,
      table.createdAt,
    ),
    index('feedback_actor_created_idx').on(table.actorId, table.createdAt),
  ],
);

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    documentId: text('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('events_actor_created_idx').on(table.actorId, table.createdAt),
    index('events_document_created_idx').on(table.documentId, table.createdAt),
    index('events_type_created_idx').on(table.type, table.createdAt),
  ],
);

export const schema = {
  documents,
  documentMetadata,
  stageRuns,
  sections,
  paragraphs,
  paragraphTranslations,
  terms,
  termOccurrences,
  videoJobs,
  videoJobScenes,
  videoJobArtifacts,
  mapNodes,
  warnings,
  subscriptionPlans,
  billingCustomers,
  subscriptions,
  usageHolds,
  usageLedger,
  usageCounters,
  billingEvents,
  feedback,
  events,
};
