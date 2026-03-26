import type { AuthIdentity } from "../repositories/app-repository.types.js";

export type ClerkUserEmailAddress = {
  id: string | null;
  email_address: string | null;
};

export type ClerkProvisioningUser = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: ClerkUserEmailAddress[];
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
};

export function toProvisioningIdentity(
  user: ClerkProvisioningUser,
): AuthIdentity | null {
  const primaryEmail =
    user.email_addresses.find(
      (entry) => entry.id === user.primary_email_address_id,
    ) ?? user.email_addresses[0];

  if (!primaryEmail?.email_address) {
    return null;
  }

  return {
    clerkUserId: user.id,
    email: primaryEmail.email_address,
    name:
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      null,
    avatarUrl: user.image_url ?? null,
  };
}
