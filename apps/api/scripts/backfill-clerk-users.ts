import { createClerkClient } from "@clerk/backend";
import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import {
  backfillClerkUsers,
  createProductionAppContext,
  type ClerkProvisioningUser,
} from "../src/lib/app-context.js";

loadWorkspaceEnv();

const usage = `Usage: pnpm --filter @aqshara/api clerk:backfill -- [options]

Options:
  --help, -h                 Show this help message
  --page-size <number>       Number of Clerk users to fetch per page (default: 100)
  --dry-run                  Run a safe test pass without requiring Clerk credentials
`;

type ParsedArgs = {
  help: boolean;
  pageSize: number;
  dryRun: boolean;
};

type ClerkListUser = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string | null;
    emailAddress: string | null;
  }>;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  let help = false;
  let pageSize = 100;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    if (argument === "--") {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }

    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (argument === "--page-size") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --page-size");
      }

      pageSize = Number(value);
      index += 1;
      continue;
    }

    if (argument.startsWith("--page-size=")) {
      pageSize = Number(argument.slice("--page-size=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("--page-size must be a positive integer");
  }

  return {
    help,
    pageSize,
    dryRun,
  };
}

function toProvisioningUser(user: ClerkListUser): ClerkProvisioningUser {
  return {
    id: user.id,
    primary_email_address_id: user.primaryEmailAddressId,
    email_addresses: user.emailAddresses.map((emailAddress) => ({
      id: emailAddress.id,
      email_address: emailAddress.emailAddress,
    })),
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
    image_url: user.imageUrl,
  };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
      console.log(usage);
      return;
    }

    if (args.dryRun) {
      console.log("Running in dry-run mode. No live Clerk access required.");
      const summary = {
        pagesProcessed: 0,
        usersSeen: 0,
        usersSynced: 0,
        duplicateUsersSkipped: 0,
        usersSkippedDeleted: 0,
        usersSkippedMissingEmail: 0,
      };
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is required to backfill Clerk users");
    }

    const clerkClient = createClerkClient({ secretKey });
    const context = createProductionAppContext();
    const summary = await backfillClerkUsers({
      repository: context.repository,
      logger: context.logger,
      pageSize: args.pageSize,
      async listUsersPage({ limit, offset }) {
        const response = await clerkClient.users.getUserList({
          limit,
          offset,
          orderBy: "-created_at",
        });

        return {
          users: response.data.map((user) =>
            toProvisioningUser(user as ClerkListUser),
          ),
        };
      },
    });

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Clerk backfill failed", error);
    process.exitCode = 1;
  }
}

void main();
