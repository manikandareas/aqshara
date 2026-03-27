import { z } from "@hono/zod-openapi";

const TTextSchema = z.object({ text: z.string() });

export const DocumentNodeSchema = z.union([
  z.object({
    type: z.literal("heading"),
    id: z.string(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("paragraph"),
    id: z.string(),
    children: z.array(TTextSchema),
  }),
  z.object({
    type: z.literal("bullet-list"),
    id: z.string(),
    children: z.array(
      z.object({
        type: z.literal("list-item"),
        id: z.string(),
        children: z.array(TTextSchema),
      }),
    ),
  }),
]);

export const DocumentAstSchema = z.array(DocumentNodeSchema);

export const DocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  type: z.enum(["general_paper", "proposal", "skripsi"]),
  contentJson: DocumentAstSchema,
  plainText: z.string().nullable(),
  archivedAt: z.string().nullable(),
  lastOpenedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const documentParamsSchema = z.object({
  documentId: z.string(),
});

const OutlineDraftNodeSchema = z.union([
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bullet_list"), items: z.array(z.string()) }),
]);

export const OutlineDraftSchema = z.object({
  title: z.string(),
  nodes: z.array(OutlineDraftNodeSchema),
});

export const DocumentChangeProposalSchema = z.object({
  id: z.string(),
  targetBlockIds: z.array(z.string()),
  action: z.enum(["replace", "insert_below"]),
  nodes: z.array(DocumentNodeSchema),
});

export const ProposalSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  proposalJson: DocumentChangeProposalSchema,
  actionType: z.enum(["replace", "insert_below"]),
  status: z.enum([
    "pending",
    "applied",
    "dismissed",
    "invalidated",
  ]),
  baseUpdatedAt: z.string(),
  targetBlockIds: z.array(z.string()),
  appliedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
  invalidatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DocumentVersionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  contentJson: DocumentAstSchema,
  plainText: z.string().nullable(),
  trigger: z.enum(["initial_template", "outline_apply", "ai_proposal_apply"]),
  snapshotLabel: z.string().nullable(),
  createdAt: z.string(),
});
