import { randomUUID } from "node:crypto";
import { toPlainText } from "@aqshara/documents";
import type { OutlineDraft } from "@aqshara/documents";
import type { AiService } from "../lib/ai/service.js";
import type { AppRepository } from "../repositories/app-repository.types.js";

export type GenerateOutlineResult =
  | { type: "success"; outline: OutlineDraft; usage: Record<string, never> }
  | { type: "not_found" }
  | { type: "quota_exceeded" }
  | { type: "duplicate_request" }
  | { type: "replay"; outline: OutlineDraft; usage: Record<string, never> };

export type GenerateProposalBody = {
  action: "continue" | "rewrite" | "paraphrase" | "expand" | "simplify";
  targetBlockIds: string[];
  idempotencyKey: string;
};

export type GenerateProposalResult =
  | {
      type: "success";
      proposal: NonNullable<
        Awaited<ReturnType<AppRepository["getDocumentChangeProposal"]>>
      >;
      allowedApplyModes: string[];
    }
  | { type: "not_found" }
  | { type: "invalid_target"; message: string }
  | { type: "quota_exceeded" }
  | { type: "duplicate_request"; message: string }
  | {
      type: "replay";
      proposal: NonNullable<
        Awaited<ReturnType<AppRepository["getDocumentChangeProposal"]>>
      >;
      allowedApplyModes: string[];
    };

export class WritingService {
  constructor(
    private readonly repository: AppRepository,
    private readonly aiService: AiService,
  ) {}

  validateProposalBody(body: GenerateProposalBody):
    | { ok: true }
    | { ok: false; message: string } {
    if (body.action === "continue" && body.targetBlockIds.length !== 1) {
      return { ok: false, message: "Continue requires exactly 1 block" };
    }
    if (
      ["rewrite", "paraphrase", "expand", "simplify"].includes(body.action) &&
      body.targetBlockIds.length === 0
    ) {
      return { ok: false, message: "Action requires at least 1 block" };
    }
    return { ok: true };
  }

  async generateOutline(input: {
    userId: string;
    documentId: string;
    topic: string;
    idempotencyKey: string;
  }): Promise<GenerateOutlineResult> {
    const document = await this.repository.getDocumentById({
      userId: input.userId,
      documentId: input.documentId,
    });
    if (!document) {
      return { type: "not_found" };
    }

    try {
      const reservation = await this.repository.reserveAiAction({
        userId: input.userId,
        featureKey: "outline",
        idempotencyKey: input.idempotencyKey,
        requestHash: input.topic,
      });

      if (!reservation.allowed) {
        if (reservation.reason === "quota_exceeded") {
          return { type: "quota_exceeded" };
        }
        if (reservation.reason === "idempotency_mismatch") {
          return { type: "duplicate_request" };
        }
      }

      if (reservation.isReplay) {
        return {
          type: "replay",
          outline: reservation.metadataJson as OutlineDraft,
          usage: {},
        };
      }

      try {
        const outline = await this.aiService.generateOutlineDraft({
          action: "outline",
          topic: input.topic,
        });

        await this.repository.finalizeAiAction(
          reservation.eventId!,
          outline as unknown as Record<string, unknown>,
        );
        return { type: "success", outline, usage: {} };
      } catch (error) {
        if (reservation.eventId) {
          await this.repository.releaseAiAction(reservation.eventId);
        }
        throw error;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("Quota exceeded")) {
        return { type: "quota_exceeded" };
      }
      throw error;
    }
  }

  async generateProposal(
    userId: string,
    documentId: string,
    body: GenerateProposalBody,
  ): Promise<GenerateProposalResult> {
    const validation = this.validateProposalBody(body);
    if (!validation.ok) {
      return { type: "invalid_target", message: validation.message };
    }

    const document = await this.repository.getDocumentById({
      userId,
      documentId,
    });
    if (!document) {
      return { type: "not_found" };
    }

    try {
      const reservation = await this.repository.reserveAiAction({
        userId,
        featureKey: "writing_proposal",
        idempotencyKey: body.idempotencyKey,
        requestHash: JSON.stringify({
          action: body.action,
          targetBlockIds: body.targetBlockIds,
        }),
      });

      if (!reservation.allowed) {
        if (reservation.reason === "quota_exceeded") {
          return { type: "quota_exceeded" };
        }
        if (reservation.reason === "idempotency_mismatch") {
          return {
            type: "duplicate_request",
            message: "Reused idempotency key with different payload",
          };
        }
      }

      if (reservation.isReplay) {
        const metadata = reservation.metadataJson as { proposalId: string };
        const existing = await this.repository.getDocumentChangeProposal(
          metadata.proposalId,
        );
        return {
          type: "replay",
          proposal: existing!,
          allowedApplyModes: ["replace", "insert_below"],
        };
      }

      try {
        const targetBlocks = document.contentJson.filter((b: { id: string }) =>
          body.targetBlockIds.includes(b.id),
        );
        const text = toPlainText(
          targetBlocks as Parameters<typeof toPlainText>[0],
        );

        const nodes = await this.aiService.generateWritingProposal({
          action: body.action,
          text,
          context: document.title,
        });

        const proposal = await this.repository.createDocumentChangeProposal({
          documentId,
          userId,
          proposalJson: {
            id: randomUUID(),
            targetBlockIds: body.targetBlockIds,
            action: "replace",
            nodes,
          },
          actionType: "replace",
          baseUpdatedAt: document.updatedAt,
          targetBlockIds: body.targetBlockIds,
        });

        await this.repository.finalizeAiAction(reservation.eventId!, {
          proposalId: proposal.id,
        });

        return {
          type: "success",
          proposal,
          allowedApplyModes: ["replace", "insert_below"],
        };
      } catch (error) {
        if (reservation.eventId) {
          await this.repository.releaseAiAction(reservation.eventId);
        }
        throw error;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("Quota exceeded")) {
        return { type: "quota_exceeded" };
      }
      throw error;
    }
  }
}
