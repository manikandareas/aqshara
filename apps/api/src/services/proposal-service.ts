import {
  applyDocumentChangeProposal,
  toPlainText,
} from "@aqshara/documents";
import type { AppRepository } from "../repositories/app-repository.types.js";
import { StaleDocumentSaveError } from "../repositories/app-repository.types.js";

export class ProposalService {
  constructor(private readonly repository: AppRepository) {}

  async applyProposal(input: {
    userId: string;
    proposalId: string;
    baseUpdatedAt: string;
    mode: "replace" | "insert_below";
  }): Promise<
    | {
        type: "success";
        document: NonNullable<
          Awaited<ReturnType<AppRepository["getDocumentById"]>>
        >;
        proposal: NonNullable<
          Awaited<ReturnType<AppRepository["updateDocumentChangeProposalStatus"]>>
        >;
      }
    | { type: "not_found" }
    | { type: "stale_ai_proposal"; message: string }
    | { type: "stale_document_save" }
  > {
    const proposal = await this.repository.getDocumentChangeProposal(
      input.proposalId,
    );
    if (!proposal || proposal.userId !== input.userId) {
      return { type: "not_found" };
    }

    if (proposal.status !== "pending" && proposal.status !== "previewed") {
      return {
        type: "stale_ai_proposal",
        message: "Proposal is in terminal state",
      };
    }

    const documentRecord = await this.repository.getDocumentById({
      userId: input.userId,
      documentId: proposal.documentId,
    });

    const proposalBaseTime = new Date(proposal.baseUpdatedAt).getTime();
    const docTime = new Date(documentRecord?.updatedAt || 0).getTime();
    const reqTime = new Date(input.baseUpdatedAt).getTime();

    if (
      !documentRecord ||
      docTime !== reqTime ||
      proposalBaseTime !== reqTime
    ) {
      await this.repository.updateDocumentChangeProposalStatus({
        id: input.proposalId,
        userId: input.userId,
        status: "invalidated",
      });
      return { type: "stale_ai_proposal", message: "Stale base apply" };
    }

    const appliedProposalJson = {
      ...proposal.proposalJson,
      action: input.mode,
    };
    const updatedContent = applyDocumentChangeProposal(
      documentRecord.contentJson,
      appliedProposalJson as Parameters<typeof applyDocumentChangeProposal>[1],
    );

    try {
      const document = await this.repository.updateDocumentContent({
        userId: input.userId,
        documentId: proposal.documentId,
        contentJson: updatedContent,
        plainText: toPlainText(updatedContent),
        baseUpdatedAt: input.baseUpdatedAt,
      });

      if (!document) {
        return { type: "not_found" };
      }

      const updatedProposal =
        await this.repository.updateDocumentChangeProposalStatus({
          id: input.proposalId,
          userId: input.userId,
          status: "applied",
        });

      return {
        type: "success",
        document,
        proposal: updatedProposal!,
      };
    } catch (error) {
      if (error instanceof StaleDocumentSaveError) {
        await this.repository.updateDocumentChangeProposalStatus({
          id: input.proposalId,
          userId: input.userId,
          status: "invalidated",
        });
        return { type: "stale_document_save" };
      }
      throw error;
    }
  }

  async dismissProposal(
    userId: string,
    proposalId: string,
  ): Promise<
    | {
        type: "success";
        proposal: NonNullable<
          Awaited<ReturnType<AppRepository["getDocumentChangeProposal"]>>
        >;
      }
    | { type: "not_found" }
  > {
    const proposal = await this.repository.getDocumentChangeProposal(
      proposalId,
    );
    if (!proposal || proposal.userId !== userId) {
      return { type: "not_found" };
    }

    if (
      proposal.status === "dismissed" ||
      proposal.status === "invalidated" ||
      proposal.status === "applied"
    ) {
      return { type: "success", proposal };
    }

    const updatedProposal =
      await this.repository.updateDocumentChangeProposalStatus({
        id: proposalId,
        userId,
        status: "dismissed",
      });

    return { type: "success", proposal: updatedProposal! };
  }
}
