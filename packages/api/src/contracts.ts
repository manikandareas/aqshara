import type { components } from "./generated/schema";

export type ApiErrorEnvelope = components["schemas"]["ApiErrorEnvelopeDto"];
export type ApiErrorDetail = components["schemas"]["ApiErrorDetailDto"];

export type PaginationMeta = components["schemas"]["PaginationMetaDto"];

export type DocumentItem = components["schemas"]["DocumentItemDto"];
export type DocumentVideoSummary =
  components["schemas"]["DocumentVideoSummaryDto"];
export type DocumentDetail = Omit<
  components["schemas"]["DocumentDetailDto"],
  "video"
> & {
  video: DocumentVideoSummary | null;
};
export type DocumentListEnvelope =
  components["schemas"]["DocumentListEnvelopeDto"];
export type DocumentDetailEnvelope = Omit<
  components["schemas"]["DocumentDetailEnvelopeDto"],
  "data"
> & {
  data: DocumentDetail;
};
export type DocumentItemEnvelope = components["schemas"]["DocumentItemEnvelopeDto"];
export type DocumentStatusPayload = components["schemas"]["DocumentStatusPayloadDto"];
export type DocumentStatusEnvelope = components["schemas"]["DocumentStatusEnvelopeDto"];
export type DocumentStatusStreamEvent =
  components["schemas"]["DocumentStatusStreamEventDto"];
export type OutlineEnvelope = components["schemas"]["OutlineEnvelopeDto"];
export type OutlineSection = components["schemas"]["OutlineSectionDto"];
/** Inline type - HighlightedTermDto not in generated schema; used by paragraph.highlighted_terms */
export type HighlightedTerm = {
  label?: string;
  term_en: string;
  term_id: string;
  definition?: string;
  definition_id?: string;
  example?: string;
  example_id?: string;
};
export type ParagraphItem = components["schemas"]["ParagraphItemDto"];
export type ParagraphListEnvelope = components["schemas"]["ParagraphListEnvelopeDto"];
export type SearchEnvelope = components["schemas"]["SearchEnvelopeDto"];
export type TranslationItem = components["schemas"]["TranslationItemDto"];
export type TranslationsListEnvelope =
  components["schemas"]["TranslationsListEnvelopeDto"];
export type TranslationRetryEnvelope =
  components["schemas"]["TranslationRetryEnvelopeDto"];
export type GlossaryItem = components["schemas"]["GlossaryItemDto"];
export type GlossaryListEnvelope = components["schemas"]["GlossaryListEnvelopeDto"];
export type GlossaryLookupEnvelope =
  components["schemas"]["GlossaryLookupEnvelopeDto"];
export type GlossaryDetailEnvelope =
  components["schemas"]["GlossaryDetailEnvelopeDto"];
export type MapTreeEnvelope = components["schemas"]["MapTreeEnvelopeDto"];
export type MapNodeTree = components["schemas"]["MapNodeTreeDto"];
export type MapNodeDetailEnvelope =
  components["schemas"]["MapNodeDetailEnvelopeDto"];

export type CreateVideoJobRequest =
  components["schemas"]["CreateVideoJobRequestDto"];
export type RetryVideoJobRequest =
  components["schemas"]["RetryVideoJobRequestDto"];
export type VideoJobItem = components["schemas"]["VideoJobItemDto"];
export type VideoJobEnvelope = components["schemas"]["VideoJobEnvelopeDto"];
export type VideoJobStatusPayload =
  components["schemas"]["VideoJobStatusPayloadDto"];
export type VideoJobStatusEnvelope =
  components["schemas"]["VideoJobStatusEnvelopeDto"];
export type VideoJobStatusStreamEvent =
  components["schemas"]["VideoJobStatusStreamEventDto"];
export type VideoJobResultEnvelope =
  components["schemas"]["VideoJobResultEnvelopeDto"];
export type VideoJobResult = components["schemas"]["VideoJobResultPayloadDto"];

/** Billing types (inline; server contract moved to Mayar invoice mode) */
export type BillingFeatureKey =
  | "upload"
  | "translation"
  | "video_generation";

export type BillingPlanQuotas = Record<BillingFeatureKey, number>;

export type BillingPlanItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_amount: number | null;
  price_currency: string;
  interval: string;
  checkout_enabled: boolean;
  is_free: boolean;
  quotas: BillingPlanQuotas;
};

export type BillingPlansEnvelope = {
  data: BillingPlanItem[];
};

export type BillingPlanSummary = {
  id: string;
  code: string;
  name: string;
  price_amount: number | null;
  price_currency: string;
  interval: string;
  checkout_enabled: boolean;
  is_free: boolean;
  quotas: BillingPlanQuotas;
};

export type BillingSubscription = {
  id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  plan: BillingPlanSummary | null;
};

export type BillingEffectivePlan = {
  code: string;
  name: string;
  is_free: boolean;
};

export type BillingFeatureUsage = {
  feature_key: BillingFeatureKey;
  limit: number;
  used: number;
  held: number;
  remaining: number;
};

export type BillingUsage = {
  period_key: string;
  features: BillingFeatureUsage[];
};

export type BillingSnapshot = {
  customer_id: string;
  effective_plan: BillingEffectivePlan;
  subscription: BillingSubscription | null;
  usage: BillingUsage;
};

export type BillingSnapshotEnvelope = {
  data: BillingSnapshot;
};

export type BillingCheckoutRequest = {
  plan_code: string;
  success_url: string;
  return_url?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
};

export type BillingCheckoutResponse = {
  checkout_id: string;
  checkout_url: string;
  expires_at: string | null;
};

export type BillingCheckoutEnvelope = {
  data: BillingCheckoutResponse;
};

/** Catalog types (inline; schema may not include catalog until regenerate) */
export type CatalogSource = "crossref" | "semantic_scholar" | "arxiv";

export type CatalogAuthor = { name: string };

export type CatalogProviderRef = { source_id: string };

export type CatalogProviderIds = {
  crossref?: CatalogProviderRef;
  semantic_scholar?: CatalogProviderRef;
  arxiv?: CatalogProviderRef;
};

export type CatalogDetailRef = {
  source: CatalogSource;
  source_id: string;
};

export type CatalogSearchItem = {
  title: string;
  abstract_snippet: string | null;
  authors: CatalogAuthor[];
  doi: string | null;
  arxiv_id: string | null;
  published_at: string | null;
  publication_type: string | null;
  citation_count: number | null;
  reference_count: number | null;
  open_access_pdf_url: string | null;
  landing_page_url: string | null;
  canonical_source: CatalogSource;
  sources: CatalogSource[];
  provider_ids: CatalogProviderIds;
  detail_ref: CatalogDetailRef;
};

export type CatalogProviderStatus = {
  provider: CatalogSource;
  status: "ok" | "disabled" | "unavailable";
  message?: string | null;
};

export type CatalogSearchMeta = {
  limit: number;
  returned: number;
  partial: boolean;
  provider_statuses: CatalogProviderStatus[];
};

export type CatalogSearchEnvelope = {
  data: CatalogSearchItem[];
  meta: CatalogSearchMeta;
};

export type CatalogDetail = {
  title: string;
  abstract: string | null;
  authors: CatalogAuthor[];
  doi: string | null;
  arxiv_id: string | null;
  journal_name: string | null;
  publisher: string | null;
  published_at: string | null;
  updated_at: string | null;
  publication_type: string | null;
  topics: string[];
  citation_count: number | null;
  reference_count: number | null;
  open_access_pdf_url: string | null;
  landing_page_url: string | null;
  canonical_source: CatalogSource;
  sources: CatalogSource[];
  provider_ids: CatalogProviderIds;
};

export type CatalogDetailMeta = {
  partial: boolean;
  provider_statuses: CatalogProviderStatus[];
};

export type CatalogDetailEnvelope = {
  data: CatalogDetail;
  meta: CatalogDetailMeta;
};

export type ListDocumentsParams = {
  page?: number;
  limit?: number;
  status?: string;
};

export type ListParagraphsParams = {
  page?: number;
  limit?: number;
  section_id?: string;
};

export type SearchParagraphsParams = {
  q: string;
  lang?: "en" | "id";
};

export type ListTranslationsParams = {
  page?: number;
  limit?: number;
  status?: "pending" | "done" | "error";
};

export type ListGlossaryParams = {
  page?: number;
  limit?: number;
  sort?: "frequency" | "alphabetical";
};

export type GlossaryLookupParams = {
  term: string;
  lang?: "en" | "id";
};

export type UploadDocumentInput = {
  file: File;
  require_translate: boolean;
  require_video_generation: boolean;
};
