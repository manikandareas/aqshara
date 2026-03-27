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
  action:
    | "continue"
    | "rewrite"
    | "paraphrase"
    | "expand"
    | "simplify"
    | "section_draft";
  targetBlockIds: string[];
  idempotencyKey: string;
  sectionPrompt?: string;
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
    if (
      body.action === "continue" ||
      body.action === "section_draft"
    ) {
      if (body.targetBlockIds.length !== 1) {
        return {
          ok: false,
          message: `${body.action} requires exactly 1 block`,
        };
      }
    } else if (body.targetBlockIds.length === 0) {
      return { ok: false, message: "Action requires at least 1 block" };
    }

    if (body.action === "section_draft" && !body.sectionPrompt?.trim()) {
      return {
        ok: false,
        message: "section_draft requires a sectionPrompt",
      };
    }
    return { ok: true };
  }

  async generateOutline(input: {
    userId: string;
    documentId: string;
    topic: string;
    idempotencyKey: string;
    templateCode?: "blank" | "general_paper" | "proposal" | "skripsi";
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
        requestHash: JSON.stringify({
          topic: input.topic,
          documentType: document.type,
          templateCode: input.templateCode ?? document.type,
        }),
      });

      if (!reservation.allowed) {
        if (reservation.reason === "quota_exceeded") {
          return { type: "quota_exceeded" };
        }
        if (reservation.reason === "idempotency_mismatch") {
          return { type: "duplicate_request" };
        }
        if (reservation.reason === "duplicate_in_flight") {
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
          documentType: document.type,
          templateCode: input.templateCode ?? document.type,
          context: document.title,
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
          sectionPrompt: body.sectionPrompt ?? null,
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
        if (reservation.reason === "duplicate_in_flight") {
          return {
            type: "duplicate_request",
            message: "A request with this idempotency key is already in flight",
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
          allowedApplyModes:
            body.action === "section_draft"
              ? ["insert_below"]
              : ["replace", "insert_below"],
        };
      }

      try {
        const targetBlocks = document.contentJson.filter((b: { id: string }) =>
          body.targetBlockIds.includes(b.id),
        );

        if (targetBlocks.length !== body.targetBlockIds.length) {
          return {
            type: "invalid_target",
            message: "One or more target blocks do not exist",
          };
        }

        if (
          (body.action === "continue" || body.action === "section_draft") &&
          targetBlocks.length !== 1
        ) {
          return {
            type: "invalid_target",
            message: `${body.action} requires exactly 1 target block`,
          };
        }

        const text = toPlainText(
          targetBlocks as Parameters<typeof toPlainText>[0],
        );
        const aiText =
          body.action === "section_draft"
            ? body.sectionPrompt?.trim() ?? text
            : text;

        const nodes = await this.aiService.generateWritingProposal({
          action: body.action,
          text: aiText,
          context:
            body.action === "section_draft"
              ? `${document.title}\n\nTarget text:\n${text}`.trim()
              : document.title,
          instructions:
            body.action === "section_draft" ? body.sectionPrompt : undefined,
          sectionPrompt:
            body.action === "section_draft" ? body.sectionPrompt : undefined,
        });

        const proposal = await this.repository.createDocumentChangeProposal({
          documentId,
          userId,
          proposalJson: {
            id: randomUUID(),
            targetBlockIds: body.targetBlockIds,
            action: body.action === "section_draft" ? "insert_below" : "replace",
            nodes,
          },
          actionType: body.action === "section_draft" ? "insert_below" : "replace",
          baseUpdatedAt: document.updatedAt,
          targetBlockIds: body.targetBlockIds,
        });

        await this.repository.finalizeAiAction(reservation.eventId!, {
          proposalId: proposal.id,
        });

        return {
          type: "success",
          proposal,
          allowedApplyModes:
            body.action === "section_draft"
              ? ["insert_below"]
              : ["replace", "insert_below"],
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
