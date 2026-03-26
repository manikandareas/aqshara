import type { WebhookEvent } from "@clerk/backend/webhooks";
import { toProvisioningIdentity } from "../lib/clerk-provisioning.js";
import type { ClerkProvisioningUser } from "../lib/clerk-provisioning.js";
import type { AppRepository } from "../repositories/app-repository.types.js";

export class WebhookUserService {
  constructor(private readonly repository: AppRepository) {}

  async handleClerkEvent(event: WebhookEvent): Promise<void> {
    if (event.type === "user.deleted") {
      if (event.data.id) {
        await this.repository.softDeleteUserByClerkUserId(event.data.id);
      }
      return;
    }

    const identity =
      event.type === "user.created" || event.type === "user.updated"
        ? toProvisioningIdentity(event.data as ClerkProvisioningUser)
        : null;

    if (!identity) {
      return;
    }

    const existingUser = await this.repository.getUserByClerkUserId(
      identity.clerkUserId,
    );

    if (existingUser?.deletedAt) {
      return;
    }

    await this.repository.upsertUserFromWebhook(identity);
  }
}
