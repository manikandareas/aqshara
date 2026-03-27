import {
  createTemplateDocument,
  outlineDraftToDocumentValue,
  toPlainText,
} from "@aqshara/documents";
import type { OutlineDraft } from "@aqshara/documents";
import type { DocumentValue } from "@aqshara/documents";
import type {
  AppDocument,
  AppDocumentVersion,
  AppRepository,
  DocumentPatch,
  DocumentStatus,
  DocumentType,
} from "../repositories/app-repository.types.js";
import { StaleDocumentSaveError } from "../repositories/app-repository.types.js";

const TEMPLATE_CODES = [
  "blank",
  "general_paper",
  "proposal",
  "skripsi",
] as const;

export class InvalidTemplateCombinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTemplateCombinationError";
  }
}

export class DocumentService {
  constructor(private readonly repository: AppRepository) {}

  listDocuments(userId: string, status: DocumentStatus): Promise<AppDocument[]> {
    return this.repository.listDocuments({ userId, status });
  }

  listRecentDocuments(userId: string, limit: number): Promise<AppDocument[]> {
    return this.repository.listRecentDocuments({ userId, limit });
  }

  createDocument(input: {
    userId: string;
    title: string;
    type: DocumentType;
  }): Promise<AppDocument> {
    return this.repository.createDocument(input);
  }

  getDocument(userId: string, documentId: string): Promise<AppDocument | null> {
    return this.repository.getDocumentById({ userId, documentId });
  }

  updateDocument(
    userId: string,
    documentId: string,
    patch: DocumentPatch,
  ): Promise<AppDocument | null> {
    return this.repository.updateDocument({ userId, documentId, patch });
  }

  async saveDocumentContent(input: {
    userId: string;
    documentId: string;
    contentJson: DocumentValue;
    baseUpdatedAt: string;
  }): Promise<
    | { ok: true; document: AppDocument }
    | { ok: false; error: "not_found" }
    | { ok: false; error: "stale_document_save" }
  > {
    try {
      const document = await this.repository.updateDocumentContent({
        userId: input.userId,
        documentId: input.documentId,
        contentJson: input.contentJson,
        plainText: toPlainText(input.contentJson),
        baseUpdatedAt: input.baseUpdatedAt,
      });
      if (!document) {
        return { ok: false, error: "not_found" };
      }
      return { ok: true, document };
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        return { ok: false, error: "stale_document_save" };
      }
      throw error;
    }
  }

  archiveDocument(
    userId: string,
    documentId: string,
  ): Promise<AppDocument | null> {
    return this.repository.archiveDocument({ userId, documentId });
  }

  touchDocumentLastOpened(userId: string, documentId: string): Promise<void> {
    return this.repository.touchDocumentLastOpened({ userId, documentId });
  }

  deleteDocument(userId: string, documentId: string): Promise<boolean> {
    return this.repository.deleteDocument({ userId, documentId });
  }

  listVersions(
    userId: string,
    documentId: string,
  ): Promise<AppDocumentVersion[]> {
    return this.repository.listDocumentVersions({ userId, documentId });
  }

  listTemplates(): string[] {
    return [...TEMPLATE_CODES];
  }

  async bootstrapFromTemplate(input: {
    userId: string;
    title: string;
    type: DocumentType;
    templateCode: (typeof TEMPLATE_CODES)[number];
  }): Promise<AppDocument> {
    if (
      input.templateCode !== "blank" &&
      input.templateCode !== input.type
    ) {
      throw new InvalidTemplateCombinationError(
        "Template code must match document type",
      );
    }

    const document = await this.repository.createDocument({
      userId: input.userId,
      title: input.title,
      type: input.type,
    });
    const contentJson = createTemplateDocument(input.templateCode);
    const updatedDocument = await this.repository.updateDocumentContent({
      userId: input.userId,
      documentId: document.id,
      contentJson,
      plainText: toPlainText(contentJson),
      baseUpdatedAt: document.updatedAt,
    });
    if (!updatedDocument) {
      throw new Error(
        `Failed to apply template content to document ${document.id}. Concurrent modification detected.`,
      );
    }
    await this.repository.createDocumentVersion({
      documentId: document.id,
      userId: input.userId,
      contentJson,
      plainText: toPlainText(contentJson),
      trigger: "initial_template",
      snapshotLabel: input.templateCode,
    });
    return updatedDocument;
  }

  async applyOutline(input: {
    userId: string;
    documentId: string;
    outline: OutlineDraft;
    baseUpdatedAt: string;
  }): Promise<
    | { ok: true; document: AppDocument }
    | { ok: false; error: "not_found" }
    | { ok: false; error: "stale_outline_apply" }
  > {
    const contentJson = outlineDraftToDocumentValue(input.outline);
    try {
      const document = await this.repository.updateDocumentContent({
        userId: input.userId,
        documentId: input.documentId,
        contentJson,
        plainText: toPlainText(contentJson),
        baseUpdatedAt: input.baseUpdatedAt,
      });
      if (!document) {
        return { ok: false, error: "not_found" };
      }
      await this.repository.createDocumentVersion({
        documentId: input.documentId,
        userId: input.userId,
        contentJson,
        plainText: toPlainText(contentJson),
        trigger: "outline_apply",
      });
      return { ok: true, document };
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        return { ok: false, error: "stale_outline_apply" };
      }
      throw error;
    }
  }
}
