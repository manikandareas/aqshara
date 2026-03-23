import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DocumentEditor } from "../../../../components/document-editor";
import { ApiRequestError, fetchDocument } from "../../../../lib/api";

async function requireAccessToken() {
  const session = await auth();
  const token = await session.getToken();

  if (!session.userId || !token) {
    redirect("/sign-in");
  }

  return token;
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const token = await requireAccessToken();
  const { documentId } = await params;
  let document;

  try {
    document = await fetchDocument(token, documentId);
  } catch (error) {
    if (
      error instanceof ApiRequestError
      && (error.code === "account_provisioning" || error.code === "account_deleted")
    ) {
      redirect("/app");
    }

    throw error;
  }

  return <DocumentEditor initialDocument={document.document} />;
}
