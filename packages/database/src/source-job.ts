import { and, eq, isNull } from "drizzle-orm";
import type { createDatabase } from "./index.js";
import { monthlyUsageCounters, sourcesTable } from "./schema.js";

type Db = ReturnType<typeof createDatabase>;

export async function getSourceJobRow(db: Db, sourceId: string) {
  const row = (
    await db
      .select()
      .from(sourcesTable)
      .where(
        and(eq(sourcesTable.id, sourceId), isNull(sourcesTable.deletedAt)),
      )
      .limit(1)
  )[0];
  return row ?? null;
}

export async function markSourceProcessing(
  db: Db,
  input: { sourceId: string; bullmqJobId: string },
) {
  const now = new Date();
  const [updated] = await db
    .update(sourcesTable)
    .set({
      status: "processing",
      bullmqJobId: input.bullmqJobId,
      processingStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(sourcesTable.id, input.sourceId),
        eq(sourcesTable.status, "queued"),
        isNull(sourcesTable.deletedAt),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function markSourceReady(
  db: Db,
  input: {
    sourceId: string;
    parsedTextStorageKey: string;
    pageCount: number;
    parsedTextSizeBytes: number;
  },
) {
  return db.transaction(async (tx) => {
    const current = (
      await tx
        .select()
        .from(sourcesTable)
        .where(
          and(eq(sourcesTable.id, input.sourceId), isNull(sourcesTable.deletedAt)),
        )
        .limit(1)
    )[0];

    if (!current || current.status !== "processing") {
      return { ok: false as const, reason: "invalid_state" as const };
    }

    const now = new Date();

    await tx
      .update(sourcesTable)
      .set({
        status: "ready",
        parsedTextStorageKey: input.parsedTextStorageKey,
        parsedTextSizeBytes: input.parsedTextSizeBytes,
        pageCount: input.pageCount,
        readyAt: now,
        updatedAt: now,
        errorMessage: null,
        errorCode: null,
      })
      .where(eq(sourcesTable.id, input.sourceId));

    const counters = (
      await tx
        .select()
        .from(monthlyUsageCounters)
        .where(
          and(
            eq(monthlyUsageCounters.userId, current.userId),
            eq(monthlyUsageCounters.period, current.billingPeriod),
          ),
        )
        .limit(1)
    )[0];

    const storageDelta = input.parsedTextSizeBytes;

    if (counters) {
      await tx
        .update(monthlyUsageCounters)
        .set({
          sourceUploadsUsed: counters.sourceUploadsUsed + 1,
          storageUsedBytes: counters.storageUsedBytes + storageDelta,
          updatedAt: now,
        })
        .where(eq(monthlyUsageCounters.id, counters.id));
    } else {
      await tx.insert(monthlyUsageCounters).values({
        userId: current.userId,
        period: current.billingPeriod,
        sourceUploadsUsed: 1,
        storageUsedBytes: storageDelta,
      });
    }

    return { ok: true as const };
  });
}

export async function markSourceFailed(
  db: Db,
  input: {
    sourceId: string;
    errorMessage: string;
    errorCode: string;
  },
) {
  const now = new Date();
  const [updated] = await db
    .update(sourcesTable)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      errorCode: input.errorCode,
      updatedAt: now,
    })
    .where(
      and(
        eq(sourcesTable.id, input.sourceId),
        eq(sourcesTable.status, "processing"),
        isNull(sourcesTable.deletedAt),
      ),
    )
    .returning();

  if (updated) {
    return { ok: true as const };
  }

  const [anyRow] = await db
    .update(sourcesTable)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      errorCode: input.errorCode,
      updatedAt: now,
    })
    .where(
      and(
        eq(sourcesTable.id, input.sourceId),
        eq(sourcesTable.status, "queued"),
        isNull(sourcesTable.deletedAt),
      ),
    )
    .returning();

  return anyRow ? { ok: true as const } : { ok: false as const };
}
