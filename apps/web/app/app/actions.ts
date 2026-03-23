"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ApiRequestError, createDocument, saveDocumentContent } from "../../lib/api";
import { createStarterDocument } from "../../lib/editor";

async function requireAccessToken() {
  const session = await auth();
  const token = await session.getToken();

  if (!session.userId || !token) {
    redirect("/sign-in");
  }

  return token;
}

export async function createDocumentAction(formData: FormData) {
  const token = await requireAccessToken();
  const title = String(formData.get("title") ?? "Draft baru").trim() || "Draft baru";
  const type = String(formData.get("type") ?? "general_paper") as
    | "general_paper"
    | "proposal"
    | "skripsi";
  try {
    const created = await createDocument(token, { title, type });
    await saveDocumentContent(token, created.document.id, createStarterDocument(title));
    redirect(`/app/documents/${created.document.id}`);
  } catch (error) {
    if (
      error instanceof ApiRequestError
      && (error.code === "account_provisioning" || error.code === "account_deleted")
    ) {
      redirect("/app");
    }

    throw error;
  }
}
