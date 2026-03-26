import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as database from "@aqshara/database";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

type TableLike = Parameters<typeof getTableConfig>[0];

function getExport(name: string): unknown {
  const exportsMap = database as Record<string, unknown>;
  return exportsMap[name];
}

function assertUniqueIndex(table: TableLike, columns: string[]) {
  const config = getTableConfig(table);
  const match = config.indexes.find(
    (index) =>
      index.config.unique &&
      index.config.columns
        .map((column) => ("name" in column ? column.name : ""))
        .join(",") === columns.join(","),
  );

  assert.ok(match, `expected unique index on ${columns.join(", ")}`);
}

describe("database schema foundations", () => {
  it("tracks retry-safe AI quota reservations in the schema", () => {
    const usageEventColumns = getTableColumns(database.usageEvents);

    assert.ok("billingPeriod" in usageEventColumns);
    assert.ok("featureKey" in usageEventColumns);
    assert.ok("status" in usageEventColumns);
    assert.ok("idempotencyKey" in usageEventColumns);
    assert.ok("requestHash" in usageEventColumns);
    assert.ok("completedAt" in usageEventColumns);
    assert.ok("releasedAt" in usageEventColumns);
    assert.equal(usageEventColumns.billingPeriod.notNull, true);
    assert.equal(usageEventColumns.featureKey.notNull, true);
    assert.equal(usageEventColumns.status.notNull, true);

    assertUniqueIndex(database.usageEvents as TableLike, [
      "user_id",
      "idempotency_key",
    ]);

    assertUniqueIndex(database.monthlyUsageCounters, ["user_id", "period"]);

    const aiActionsReserved = getExport("aiActionsReserved");
    assert.ok(aiActionsReserved, "expected aiActionsReserved export");

    const reservedColumns = getTableColumns(aiActionsReserved as TableLike);
    assert.ok("aiActionsReserved" in reservedColumns);

    assertUniqueIndex(aiActionsReserved as TableLike, ["user_id", "period"]);
  });

  it("persists proposal lifecycle metadata in a dedicated table", () => {
    const documentChangeProposals = getExport("documentChangeProposals");
    assert.ok(
      documentChangeProposals,
      "expected documentChangeProposals export",
    );

    const proposalColumns = getTableColumns(
      documentChangeProposals as TableLike,
    );

    assert.ok("proposalJson" in proposalColumns);
    assert.ok("actionType" in proposalColumns);
    assert.ok("status" in proposalColumns);
    assert.ok("documentId" in proposalColumns);
    assert.ok("userId" in proposalColumns);
    assert.ok("baseUpdatedAt" in proposalColumns);
    assert.ok("targetBlockIds" in proposalColumns);
    assert.ok("appliedAt" in proposalColumns);
    assert.ok("dismissedAt" in proposalColumns);
    assert.ok("invalidatedAt" in proposalColumns);
    assert.ok("createdAt" in proposalColumns);
    assert.ok("updatedAt" in proposalColumns);
  });

  it("persists async export lifecycle metadata", () => {
    const table = database.exportsTable;
    assert.ok(table, "expected exportsTable export");
    const cols = getTableColumns(table);

    assert.ok("workspaceId" in cols);
    assert.ok("billingPeriod" in cols);
    assert.ok("idempotencyKey" in cols);
    assert.ok("bullmqJobId" in cols);
    assert.ok("preflightWarnings" in cols);
    assert.ok("retryCount" in cols);
    assert.ok("contentType" in cols);
    assert.ok("fileSizeBytes" in cols);
    assert.ok("errorCode" in cols);
    assert.ok("processingStartedAt" in cols);
    assert.ok("readyAt" in cols);

    assertUniqueIndex(table as TableLike, ["user_id", "idempotency_key"]);
  });

  it("persists source ingestion lifecycle and document links", () => {
    const sources = database.sourcesTable;
    assert.ok(sources, "expected sourcesTable export");
    const sourceCols = getTableColumns(sources);
    assert.ok("workspaceId" in sourceCols);
    assert.ok("checksum" in sourceCols);
    assert.ok("parsedTextStorageKey" in sourceCols);
    assert.ok("parsedTextSizeBytes" in sourceCols);
    assert.ok("deletedAt" in sourceCols);

    const links = database.documentSourceLinks;
    assert.ok(links, "expected documentSourceLinks export");
    const linkCols = getTableColumns(links);
    assert.ok("documentId" in linkCols);
    assert.ok("sourceId" in linkCols);

    assertUniqueIndex(links as TableLike, ["document_id", "source_id"]);
    assertUniqueIndex(sources as TableLike, ["user_id", "idempotency_key"]);
  });
});
