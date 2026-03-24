import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it } from "node:test";
import * as appContextModule from "./lib/app-context.js";
import { createMemoryAppContext } from "./test-support/memory-app-context.js";

const execFileAsync = promisify(execFile);

type BackfillUser = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: Array<{
    id: string;
    email_address: string | null;
  }>;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
};

type BackfillClerkUsers = (input: {
  repository: typeof createMemoryAppContext extends () => infer T
    ? T extends { repository: infer R }
      ? R
      : never
    : never;
  listUsersPage: (input: {
    limit: number;
    offset: number;
  }) => Promise<{ users: BackfillUser[] }>;
  pageSize?: number;
}) => Promise<{
  pagesProcessed: number;
  usersSeen: number;
  usersSynced: number;
  duplicateUsersSkipped: number;
  usersSkippedDeleted: number;
  usersSkippedMissingEmail: number;
}>;

function createBackfillUser(
  overrides: Partial<BackfillUser> = {},
): BackfillUser {
  const id = overrides.id ?? "user_clerk_backfill_123";
  const primaryEmailId =
    overrides.primary_email_address_id ?? `${id}_primary_email`;
  const email =
    overrides.email_addresses?.[0]?.email_address ?? "backfill@example.com";

  return {
    id,
    primary_email_address_id: primaryEmailId,
    email_addresses: overrides.email_addresses ?? [
      {
        id: primaryEmailId,
        email_address: email,
      },
    ],
    first_name: overrides.first_name ?? "Backfill",
    last_name: overrides.last_name ?? "User",
    username: overrides.username ?? null,
    image_url: overrides.image_url ?? null,
  };
}

function getMemoryState(context: ReturnType<typeof createMemoryAppContext>) {
  return (
    context.repository as unknown as {
      state: {
        users: Array<{ id: string; deletedAt: string | null }>;
        workspaces: Array<{ userId: string }>;
      };
    }
  ).state;
}

function requireBackfillClerkUsers() {
  const backfillClerkUsers = Reflect.get(
    appContextModule,
    "backfillClerkUsers",
  ) as BackfillClerkUsers | undefined;

  assert.equal(typeof backfillClerkUsers, "function");
  return backfillClerkUsers as BackfillClerkUsers;
}

describe("clerk backfill", () => {
  it("accepts pnpm argument forwarding before help output", async () => {
    const scriptPath = fileURLToPath(
      new URL("../scripts/backfill-clerk-users.js", import.meta.url),
    );
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      scriptPath,
      "--",
      "--help",
    ]);

    assert.match(stdout, /Usage: pnpm --filter @aqshara\/api clerk:backfill/);
    assert.equal(stderr, "");
  });

  it("supports dry-run mode without requiring CLERK_SECRET_KEY", async () => {
    const scriptPath = fileURLToPath(
      new URL("../scripts/backfill-clerk-users.js", import.meta.url),
    );
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, "--", "--dry-run"],
      { env: { ...process.env, CLERK_SECRET_KEY: "" } },
    );

    assert.match(stdout, /dry-run mode/i);
    assert.match(stdout, /"pagesProcessed": 0/);
    assert.equal(stderr, "");
  });

  it("provisions a first-run Clerk user into a local user and workspace", async () => {
    const context = createMemoryAppContext();
    const backfillClerkUsers = requireBackfillClerkUsers();

    const result = await backfillClerkUsers({
      repository: context.repository,
      pageSize: 50,
      async listUsersPage({ offset }) {
        return {
          users: offset === 0 ? [createBackfillUser()] : [],
        };
      },
    });

    const user = await context.repository.getUserByClerkUserId(
      "user_clerk_backfill_123",
    );
    assert.ok(user);
    assert.equal(user.email, "backfill@example.com");
    assert.equal(user.name, "Backfill User");

    const workspace = await context.repository.getWorkspaceForUser(user.id);
    assert.ok(workspace);
    assert.equal(workspace.name, "My Workspace");

    const state = getMemoryState(context);
    assert.equal(state.users.length, 1);
    assert.equal(state.workspaces.length, 1);
    assert.deepEqual(result, {
      pagesProcessed: 1,
      usersSeen: 1,
      usersSynced: 1,
      duplicateUsersSkipped: 0,
      usersSkippedDeleted: 0,
      usersSkippedMissingEmail: 0,
    });
  });

  it("keeps reruns duplicate-safe across repeated executions", async () => {
    const context = createMemoryAppContext();
    const backfillClerkUsers = requireBackfillClerkUsers();

    const runBackfill = () =>
      backfillClerkUsers({
        repository: context.repository,
        pageSize: 1,
        async listUsersPage({ offset }) {
          if (offset === 0) {
            return {
              users: [createBackfillUser({ id: "user_duplicate_backfill" })],
            };
          }

          if (offset === 1) {
            return {
              users: [createBackfillUser({ id: "user_duplicate_backfill" })],
            };
          }

          return { users: [] };
        },
      });

    const firstRun = await runBackfill();
    const secondRun = await runBackfill();
    const state = getMemoryState(context);

    assert.equal(state.users.length, 1);
    assert.equal(state.workspaces.length, 1);
    assert.equal(firstRun.duplicateUsersSkipped, 1);
    assert.equal(secondRun.duplicateUsersSkipped, 1);

    const workspaceOwnerId = state.workspaces[0]?.userId;
    assert.equal(workspaceOwnerId, state.users[0]?.id);
  });

  it("does not resurrect a soft-deleted local user on rerun", async () => {
    const context = createMemoryAppContext();
    const backfillClerkUsers = requireBackfillClerkUsers();

    const listUsersPage = async ({
      offset,
    }: {
      limit: number;
      offset: number;
    }) => ({
      users:
        offset === 0
          ? [createBackfillUser({ id: "user_soft_deleted_backfill" })]
          : [],
    });

    await backfillClerkUsers({
      repository: context.repository,
      listUsersPage,
    });

    await context.repository.softDeleteUserByClerkUserId(
      "user_soft_deleted_backfill",
    );

    const rerun = await backfillClerkUsers({
      repository: context.repository,
      listUsersPage,
    });

    const user = await context.repository.getUserByClerkUserId(
      "user_soft_deleted_backfill",
    );
    assert.ok(user);
    assert.notEqual(user.deletedAt, null);

    const state = getMemoryState(context);
    assert.equal(state.users.length, 1);
    assert.equal(state.workspaces.length, 1);
    assert.equal(rerun.usersSynced, 0);
    assert.equal(rerun.usersSkippedDeleted, 1);
  });
});
