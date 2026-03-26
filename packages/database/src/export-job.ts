import { and, eq } from "drizzle-orm";
import { createDatabase } from "./index.js";
import { exportsTable, monthlyUsageCounters } from "./schema.js";

type Db = ReturnType<typeof createDatabase>;

export async function getExportJobRow(db: Db, exportId: string) {
  const row = (
    await db.select().from(exportsTable).where(eq(exportsTable.id, exportId)).limit(1)
  )[0];
  return row ?? null;
}

export async function markExportProcessing(
  db: Db,
  input: { exportId: string; bullmqJobId: string },
) {
  const now = new Date();
  const [updated] = await db
    .update(exportsTable)
    .set({
      status: "processing",
      bullmqJobId: input.bullmqJobId,
      processingStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(exportsTable.id, input.exportId), eq(exportsTable.status, "queued")),
    )
    .returning();
  return updated ?? null;
}

export async function markExportReady(
  db: Db,
  input: {
    exportId: string;
    storageKey: string;
    contentType: string;
    fileSizeBytes: number;
  },
) {
  return db.transaction(async (tx) => {
    const current = (
      await tx
        .select()
        .from(exportsTable)
        .where(eq(exportsTable.id, input.exportId))
        .limit(1)
    )[0];

    if (!current || current.status !== "processing") {
      return { ok: false as const, reason: "invalid_state" as const };
    }

    const now = new Date();

    await tx
      .update(exportsTable)
      .set({
        status: "ready",
        storageKey: input.storageKey,
        contentType: input.contentType,
        fileSizeBytes: input.fileSizeBytes,
        readyAt: now,
        updatedAt: now,
        errorMessage: null,
        errorCode: null,
      })
      .where(eq(exportsTable.id, input.exportId));

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

    if (counters) {
      await tx
        .update(monthlyUsageCounters)
        .set({
          exportsUsed: counters.exportsUsed + 1,
          updatedAt: now,
        })
        .where(eq(monthlyUsageCounters.id, counters.id));
    } else {
      await tx.insert(monthlyUsageCounters).values({
        userId: current.userId,
        period: current.billingPeriod,
        exportsUsed: 1,
      });
    }

    return { ok: true as const };
  });
}

export async function markExportFailed(
  db: Db,
  input: {
    exportId: string;
    errorMessage: string;
    errorCode: string;
  },
) {
  const now = new Date();
  const [updated] = await db
    .update(exportsTable)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      errorCode: input.errorCode,
      updatedAt: now,
    })
    .where(
      and(
        eq(exportsTable.id, input.exportId),
        eq(exportsTable.status, "processing"),
      ),
    )
    .returning();

  if (updated) {
    return { ok: true as const };
  }

  const [anyRow] = await db
    .update(exportsTable)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      errorCode: input.errorCode,
      updatedAt: now,
    })
    .where(
      and(eq(exportsTable.id, input.exportId), eq(exportsTable.status, "queued")),
    )
    .returning();

  return anyRow ? { ok: true as const } : { ok: false as const };
}
