"use client";

import { Popover } from "@base-ui/react/popover";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft01Icon,
  ArrowUpDownIcon,
  BookOpen01Icon,
  HighlighterIcon,
  Share08Icon,
  TextAlignJustifyCenterIcon,
  TranslateIcon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  use,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

import { DocumentVideo } from "@/components/document-video";
import { ErrorState, StatusBadge } from "@/components/query-states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getErrorMessage } from "@aqshara/api";
import type {
  DocumentStatusStreamEvent,
  HighlightedTerm,
  ParagraphItem,
} from "@aqshara/api";
import {
  getDocument,
  getDocumentStatus,
  getOutline,
  listParagraphs,
} from "@aqshara/api";
import { createAuthorizedEventSource, parseSsePayload } from "@aqshara/api";
import { formatDate, titleCase, toStringOrNull } from "@/lib/format";
import { getStatusTone, isDocumentTerminal } from "@/lib/status";
import { cn } from "@/lib/utils";

type OutlineSection = {
  id: string;
  level: number;
  title: string;
  children: OutlineSection[];
};

function flattenOutlineSections(
  sections: OutlineSection[],
  flat: OutlineSection[] = [],
): OutlineSection[] {
  for (const section of sections) {
    flat.push(section);
    const children = Array.isArray(section.children)
      ? (section.children as OutlineSection[])
      : [];
    if (children.length > 0) {
      flattenOutlineSections(children, flat);
    }
  }
  return flat;
}

/** Collect section id and all descendant ids for scroll targeting */
function getSectionAndDescendantIds(
  sections: OutlineSection[],
  targetId: string,
): string[] {
  for (const section of sections) {
    if (section.id === targetId) {
      const children = Array.isArray(section.children)
        ? (section.children as OutlineSection[])
        : [];
      return [section.id, ...flattenOutlineSections(children).map((s) => s.id)];
    }
    const children = Array.isArray(section.children)
      ? (section.children as OutlineSection[])
      : [];
    const found = getSectionAndDescendantIds(children, targetId);
    if (found.length > 0) return found;
  }
  return [];
}

function OutlineList({
  sections,
  selectedSectionId,
  onSelect,
}: {
  sections: { id: string; level: number; title: string; children: unknown[] }[];
  selectedSectionId: string | null;
  onSelect: (sectionId: string | null) => void;
}) {
  const flatSections = flattenOutlineSections(sections as OutlineSection[]);
  return (
    <div className="flex flex-col w-[320px] sm:w-[380px]">
      <div className="px-4 py-3 text-center font-semibold text-foreground border-b border-border/40">
        Table of Contents
      </div>
      <div className="flex flex-col p-2 max-h-[60vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`w-full rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors ${
            selectedSectionId === null
              ? "bg-secondary/60 text-foreground font-medium"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          All sections
        </button>
        {flatSections.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={`w-full rounded-xl py-2.5 pr-3 text-left text-[15px] transition-colors flex gap-2.5 ${
              selectedSectionId === section.id
                ? "bg-secondary/60 text-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
            style={{ paddingLeft: `${Math.max(1, section.level) * 12 + 12}px` }}
          >
            <span className="shrink-0">{index + 1}.</span>
            <span>{section.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const GLOSSARY_TAG_NAME = "glossary-term";
const GLOSSARY_SKIPPED_TAGS = new Set([
  "code",
  "pre",
  "script",
  "style",
  "kbd",
  GLOSSARY_TAG_NAME,
]);

type GlossaryTextNode = {
  type: "text";
  value: string;
};

type GlossaryElementNode = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: GlossaryNode[];
};

type GlossaryNode =
  | GlossaryTextNode
  | GlossaryElementNode
  | {
      type: string;
      children?: GlossaryNode[];
      value?: string;
      tagName?: string;
      properties?: Record<string, unknown>;
    };

type MarkdownCodeProps = ComponentProps<"code"> & {
  node?: unknown;
};

type GlossaryMarkdownTermProps = {
  node?: unknown;
  children?: ReactNode;
  "data-term-en"?: string;
  "data-definition"?: string;
  "data-example"?: string;
};

function getGlossaryLabel(term: HighlightedTerm) {
  return (term.label?.trim() ?? "") || term.term_en.trim();
}

function hasGlossaryChildren(node: GlossaryNode): node is Extract<
  GlossaryNode,
  { children?: GlossaryNode[] }
> & {
  children: GlossaryNode[];
} {
  return "children" in node && Array.isArray(node.children);
}

function getGlossaryTagName(node: GlossaryNode) {
  return "tagName" in node && typeof node.tagName === "string"
    ? node.tagName
    : "";
}

function isTermBoundary(value?: string) {
  if (!value) {
    return true;
  }

  return !/[\p{L}\p{N}_]/u.test(value);
}

function findGlossaryMatches(
  text: string,
  highlightedTerms: HighlightedTerm[],
) {
  const candidates = Array.from(
    new Map(
      highlightedTerms.map((term) => [
        `${term.term_id}:${getGlossaryLabel(term).toLocaleLowerCase()}`,
        term,
      ]),
    ).values(),
  )
    .filter((term) => getGlossaryLabel(term).length > 0)
    .sort((a, b) => {
      const aLabel = getGlossaryLabel(a);
      const bLabel = getGlossaryLabel(b);

      if (bLabel.length !== aLabel.length) {
        return bLabel.length - aLabel.length;
      }
      return aLabel.localeCompare(bLabel);
    });

  const matches: Array<{
    start_index: number;
    end_index: number;
    term: HighlightedTerm;
  }> = [];

  for (const term of candidates) {
    const label = getGlossaryLabel(term);
    const haystack = text.toLocaleLowerCase();
    const needle = label.toLocaleLowerCase();
    let cursor = 0;

    while (cursor < haystack.length) {
      const matchIndex = haystack.indexOf(needle, cursor);
      if (matchIndex === -1) {
        break;
      }

      const endIndex = matchIndex + label.length;
      const overlaps = matches.some(
        (match) => matchIndex < match.end_index && endIndex > match.start_index,
      );

      if (
        !overlaps &&
        isTermBoundary(text[matchIndex - 1]) &&
        isTermBoundary(text[endIndex])
      ) {
        matches.push({
          start_index: matchIndex,
          end_index: endIndex,
          term,
        });
      }

      cursor = matchIndex + needle.length;
    }
  }

  return matches.sort((a, b) => {
    if (a.start_index !== b.start_index) {
      return a.start_index - b.start_index;
    }
    return b.end_index - a.end_index;
  });
}

function splitTextNodeWithGlossaryTerms(
  value: string,
  highlightedTerms: HighlightedTerm[],
): GlossaryNode[] {
  const matches = findGlossaryMatches(value, highlightedTerms);
  if (matches.length === 0) {
    return [{ type: "text", value }];
  }

  const nodes: GlossaryNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start_index > cursor) {
      nodes.push({
        type: "text",
        value: value.slice(cursor, match.start_index),
      });
    }

    nodes.push({
      type: "element",
      tagName: GLOSSARY_TAG_NAME,
      properties: {
        "data-term-id": match.term.term_id,
        "data-label": getGlossaryLabel(match.term),
        "data-term-en": match.term.term_en,
        "data-definition": match.term.definition,
        "data-example": match.term.example,
      },
      children: [
        {
          type: "text",
          value: value.slice(match.start_index, match.end_index),
        },
      ],
    });

    cursor = match.end_index;
  }

  if (cursor < value.length) {
    nodes.push({
      type: "text",
      value: value.slice(cursor),
    });
  }

  return nodes;
}

function createGlossaryRehypePlugin(highlightedTerms: HighlightedTerm[]) {
  return () => (tree: GlossaryNode) => {
    const visit = (node: GlossaryNode) => {
      if (
        !hasGlossaryChildren(node) ||
        GLOSSARY_SKIPPED_TAGS.has(getGlossaryTagName(node))
      ) {
        return;
      }

      node.children = node.children.flatMap((child): GlossaryNode[] => {
        if (child.type === "text" && typeof child.value === "string") {
          return splitTextNodeWithGlossaryTerms(child.value, highlightedTerms);
        }

        visit(child);
        return [child];
      });
    };

    visit(tree);
  };
}

const MarkdownComponents: import("react-markdown").Components = {
  h1: ({ node: _node, ...props }) => (
    <h1
      className="mt-10 mb-5 text-4xl font-serif font-medium text-foreground"
      {...props}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2
      className="mt-10 mb-4 text-3xl font-serif font-medium text-foreground"
      {...props}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3
      className="mt-8 mb-3 text-2xl font-serif font-medium text-foreground"
      {...props}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4
      className="mt-6 mb-2 text-xl font-serif font-medium text-foreground"
      {...props}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <p
      className="mb-6 text-base font-serif leading-loose text-foreground/90 text-justify md:text-lg"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul
      className="mb-6 list-disc pl-8 text-base font-serif leading-loose text-foreground/90 space-y-2 md:text-lg"
      {...props}
    />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="mb-6 list-decimal pl-8 text-base font-serif leading-loose text-foreground/90 space-y-2 md:text-lg"
      {...props}
    />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-2" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-8 border-l-4 border-primary/30 bg-secondary/30 py-4 pr-4 pl-6 italic text-muted-foreground rounded-r-2xl"
      {...props}
    />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  code: ({ node: _node, className, children, ...props }: MarkdownCodeProps) => {
    const match = /language-(\w+)/.exec(className || "");
    return !match ? (
      <code
        className="bg-secondary/80 text-secondary-foreground rounded px-1.5 py-0.5 text-[0.9em] font-mono whitespace-pre-wrap wrap-break-word"
        {...props}
      >
        {children}
      </code>
    ) : (
      <pre className="bg-secondary/50 p-6 rounded-2xl overflow-x-auto my-6 text-sm font-mono border border-border/50">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },
};

const GlossaryMarkdownComponents = {
  ...MarkdownComponents,
  "glossary-term": ({
    node: _node,
    children,
    ...props
  }: GlossaryMarkdownTermProps) => {
    const term =
      typeof props["data-term-en"] === "string"
        ? props["data-term-en"]
        : "Glossary term";
    const definition =
      typeof props["data-definition"] === "string"
        ? props["data-definition"]
        : "";
    const example =
      typeof props["data-example"] === "string" ? props["data-example"] : "";

    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help rounded-sm bg-yellow-200/70 px-1 dark:bg-yellow-500/30 hover:bg-yellow-300/80 dark:hover:bg-yellow-500/50 transition-colors decoration-yellow-400/80 dark:decoration-yellow-500/50 underline decoration-2 underline-offset-4">
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2">
            <p>{definition || "Definition unavailable."}</p>
            {example ? (
              <p className="text-popover-foreground/70">Example: {example}</p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  },
} as import("react-markdown").Components;

type ReaderLanguageMode = "en" | "id" | "bilingual";
type ParagraphLanguage = "en" | "id";

const LANGUAGE_LABELS: Record<ParagraphLanguage, string> = {
  en: "English",
  id: "Indonesian",
};
const LANGUAGE_FLAGS: Record<ParagraphLanguage, string> = {
  en: "🇺🇸",
  id: "🇮🇩",
};

const READER_LANGUAGE_OPTIONS = ["id", "en", "bilingual"] as const;
const READER_LANGUAGE_PARSER = parseAsStringLiteral(READER_LANGUAGE_OPTIONS);
const READER_LANGUAGE_LABELS: Record<ReaderLanguageMode, string> = {
  id: "Indonesian",
  en: "English",
  bilingual: "Bilingual Mode",
};
const READER_LANGUAGE_ICONS: Record<ReaderLanguageMode, React.ReactNode> = {
  id: <span className="text-lg leading-none">🇮🇩</span>,
  en: <span className="text-lg leading-none">🇺🇸</span>,
  bilingual: (
    <HugeiconsIcon
      icon={TranslateIcon}
      size={18}
      className="text-muted-foreground"
      strokeWidth={1.5}
    />
  ),
};

function getDefaultReaderLanguageMode(
  sourceLang: ParagraphItem["source_lang"] | undefined,
): ReaderLanguageMode {
  return sourceLang === "id" ? "id" : "en";
}

function getParagraphLanguageMarkdown(
  paragraph: ParagraphItem,
  language: ParagraphLanguage,
): string {
  const fallbackContent = paragraph.text_raw_md || paragraph.text_raw;
  const shouldUseRawFallback =
    paragraph.source_lang === language || paragraph.source_lang === "unknown";

  if (language === "en") {
    return (
      paragraph.text_en_md ||
      paragraph.text_en ||
      (shouldUseRawFallback ? fallbackContent : "")
    );
  }

  return (
    paragraph.text_id_md ||
    paragraph.text_id ||
    (shouldUseRawFallback ? fallbackContent : "")
  );
}

function hasParagraphLanguageContent(
  paragraph: ParagraphItem,
  language: ParagraphLanguage,
) {
  return getParagraphLanguageMarkdown(paragraph, language).trim().length > 0;
}

export default function LibraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { getToken, isLoaded } = useAuth();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const articleRef = useRef<HTMLElement>(null);
  const [isOutlinePopoverOpen, setIsOutlinePopoverOpen] = useState(false);
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  const [readerLanguageMode, setReaderLanguageMode] = useQueryState(
    "lang",
    READER_LANGUAGE_PARSER,
  );
  const [isBilingualReversed, setIsBilingualReversed] = useState(false);

  const documentQuery = useQuery({
    queryKey: ["document", id],
    enabled: isLoaded,
    queryFn: () => getDocument(id, getToken),
  });

  const statusQuery = useQuery({
    queryKey: ["document-status", id],
    enabled: isLoaded,
    queryFn: () => getDocumentStatus(id, getToken),
    refetchInterval: (query) =>
      isDocumentTerminal(query.state.data?.data.status) ? false : 2000,
  });

  const documentData = documentQuery.data?.data;
  const documentStatus = statusQuery.data?.data;
  const isReady = documentStatus?.status === "ready";
  const activeLanguageMode =
    readerLanguageMode ??
    getDefaultReaderLanguageMode(documentData?.source_lang);

  const outlineQuery = useQuery({
    queryKey: ["outline", id],
    enabled: isLoaded && isReady,
    queryFn: () => getOutline(id, getToken),
  });

  const paragraphsQuery = useQuery({
    queryKey: ["paragraphs", id],
    enabled: isLoaded && isReady,
    queryFn: () =>
      listParagraphs(
        id,
        {
          page: 1,
          limit: 200,
        },
        getToken,
      ),
  });

  useEffect(() => {
    if (!isLoaded) return;
    let isActive = true;
    let eventSource: EventSource | null = null;
    createAuthorizedEventSource(`/documents/${id}/status/stream`, getToken)
      .then((source) => {
        if (!isActive) {
          source.close();
          return;
        }
        eventSource = source;
        source.onmessage = (event) => {
          const payload = parseSsePayload<DocumentStatusStreamEvent>(
            event.data,
          );
          if (payload?.data) {
            queryClient.setQueryData(["document-status", id], {
              data: payload.data,
            });
          }
        };
        source.onerror = () => source.close();
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
      eventSource?.close();
    };
  }, [getToken, id, isLoaded, queryClient]);

  const paragraphs = paragraphsQuery.data?.data ?? [];
  const outlineSections = outlineQuery.data?.data?.sections as
    | OutlineSection[]
    | undefined;

  useEffect(() => {
    if (!articleRef.current) return;

    if (selectedSectionId === null) {
      articleRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!outlineSections || paragraphs.length === 0) return;

    const targetIds = new Set(
      getSectionAndDescendantIds(outlineSections, selectedSectionId),
    );
    const firstMatch = paragraphs.find(
      (p) => typeof p.section_id === "string" && targetIds.has(p.section_id),
    );
    const sectionId =
      firstMatch && typeof firstMatch.section_id === "string"
        ? firstMatch.section_id
        : null;
    if (!sectionId) return;

    const el = articleRef.current.querySelector<HTMLElement>(
      `[data-section-id="${sectionId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedSectionId, outlineSections, paragraphs]);

  if (documentQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="mx-auto relative flex w-full max-w-[1240px] flex-col gap-12 px-6 py-10 pb-32">
        <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-64 rounded-full" />
        </div>
        <div className="flex-1 min-w-0 mx-auto w-full transition-all duration-300 max-w-4xl">
          <div className="mb-10">
            <div className="space-y-6">
              <Skeleton className="h-12 w-3/4 md:w-2/3" />
              <Skeleton className="h-12 w-1/2 md:w-1/3" />
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="space-y-3 pt-4">
                <Skeleton className="h-6 w-full max-w-4xl" />
                <Skeleton className="h-6 w-[90%] max-w-4xl" />
                <Skeleton className="h-6 w-[80%] max-w-4xl" />
              </div>
            </div>
          </div>
          <article className="mt-16 space-y-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-[95%]" />
                <Skeleton className="h-5 w-[98%]" />
                <Skeleton className="h-5 w-[85%]" />
                <Skeleton className="h-5 w-[92%]" />
              </div>
            ))}
          </article>
        </div>
      </div>
    );
  }

  if (documentQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <ErrorState
          description={getErrorMessage(documentQuery.error)}
          onRetry={() => documentQuery.refetch()}
        />
      </div>
    );
  }

  const title =
    toStringOrNull(documentData?.title) ??
    documentData?.filename ??
    "Untitled Document";
  const summary = toStringOrNull(documentData?.abstract);
  const englishViewAvailable =
    documentData?.source_lang === "en" ||
    paragraphs.some((paragraph) =>
      hasParagraphLanguageContent(paragraph, "en"),
    );
  const indonesianViewAvailable =
    documentData?.source_lang === "id" ||
    paragraphs.some((paragraph) =>
      hasParagraphLanguageContent(paragraph, "id"),
    );
  const bilingualViewAvailable =
    englishViewAvailable && indonesianViewAvailable;
  const bilingualLanguages: ParagraphLanguage[] = isBilingualReversed
    ? ["en", "id"]
    : ["id", "en"];
  const renderParagraphMarkdown = (
    paragraph: ParagraphItem,
    markdown: string,
    key: string,
  ) => (
    <ReactMarkdown
      key={key}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={
        paragraph.highlighted_terms.length > 0
          ? [
              rehypeRaw,
              createGlossaryRehypePlugin(
                paragraph.highlighted_terms as HighlightedTerm[],
              ),
            ]
          : [rehypeRaw]
      }
      components={GlossaryMarkdownComponents}
    >
      {markdown}
    </ReactMarkdown>
  );

  return (
    <div className="mx-auto relative flex w-full max-w-[1240px] flex-col gap-12 px-6 py-10 pb-32">
      <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          Back to home
        </Link>
        <div className="flex items-center gap-8 px-4 py-1 rounded-full border-dashed border  backdrop-blur">
          <Popover.Root
            open={isOutlinePopoverOpen}
            onOpenChange={setIsOutlinePopoverOpen}
          >
            <Popover.Trigger
              render={<button type="button" />}
              className="text-foreground/80 hover:text-foreground transition-colors"
              aria-label="Table of contents"
            >
              <HugeiconsIcon
                icon={TextAlignJustifyCenterIcon}
                size={18}
                strokeWidth={1.5}
              />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={12}>
                <Popover.Popup className="z-50 rounded-[18px] border border-border/40 bg-popover text-popover-foreground shadow-lg outline-none">
                  {outlineQuery.data?.data?.sections ? (
                    <OutlineList
                      sections={outlineQuery.data.data.sections}
                      selectedSectionId={selectedSectionId}
                      onSelect={(id) => {
                        setSelectedSectionId(id);
                        setIsOutlinePopoverOpen(false);
                      }}
                    />
                  ) : outlineQuery.isLoading ? (
                    <div className="p-8 flex items-center justify-center text-muted-foreground">
                      Loading outline...
                    </div>
                  ) : (
                    <div className="p-8 flex items-center justify-center text-muted-foreground">
                      No outline available.
                    </div>
                  )}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <button
            type="button"
            className="text-foreground/80 hover:text-foreground transition-colors"
            aria-label="Highlight"
          >
            <HugeiconsIcon icon={HighlighterIcon} size={18} strokeWidth={1.5} />
          </button>
          <Popover.Root
            open={isLanguagePopoverOpen}
            onOpenChange={setIsLanguagePopoverOpen}
          >
            <Popover.Trigger
              render={<button type="button" />}
              aria-label={`Reader language: ${READER_LANGUAGE_LABELS[activeLanguageMode]}`}
              className="hover:opacity-80 transition-opacity flex items-center justify-center h-6 w-6"
            >
              {READER_LANGUAGE_ICONS[activeLanguageMode]}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={12}>
                <Popover.Popup className="z-50 min-w-[200px] rounded-[18px] border border-border/40 bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
                  {[
                    {
                      value: "id" as const,
                      label: "Indonesian",
                      icon: <span className="text-lg leading-none">🇮🇩</span>,
                      disabled: !indonesianViewAvailable,
                    },
                    {
                      value: "en" as const,
                      label: "English",
                      icon: <span className="text-lg leading-none">🇺🇸</span>,
                      disabled: !englishViewAvailable,
                    },
                    {
                      value: "bilingual" as const,
                      label: "Bilingual Mode",
                      icon: (
                        <HugeiconsIcon
                          icon={TranslateIcon}
                          size={18}
                          className="text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      ),
                      disabled: !bilingualViewAvailable,
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        if (!option.disabled) {
                          setReaderLanguageMode(option.value);
                          setIsLanguagePopoverOpen(false);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors",
                        option.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-secondary/60",
                        activeLanguageMode === option.value &&
                          "bg-secondary/60 font-medium",
                      )}
                    >
                      <div className="flex w-6 items-center justify-center">
                        {option.icon}
                      </div>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <button
            type="button"
            className="text-foreground/80 hover:text-foreground transition-colors"
            aria-label="Share"
          >
            <HugeiconsIcon icon={Share08Icon} size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "flex-1 min-w-0 mx-auto w-full transition-all duration-300",
          activeLanguageMode === "bilingual" ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="space-y-6 flex flex-col items-center w-full">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={BookOpen01Icon} size={16} />
                {documentData?.source_lang.toUpperCase() ?? "EN"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={WorkflowCircle01Icon} size={16} />
                {titleCase(
                  documentStatus?.pipeline_stage ??
                    documentData?.pipeline_stage ??
                    "queued",
                )}
              </span>
              <span>•</span>
              <time dateTime={documentData?.created_at}>
                {formatDate(documentData?.created_at)}
              </time>
              <StatusBadge
                label={
                  documentStatus?.status ?? documentData?.status ?? "unknown"
                }
                tone={getStatusTone(
                  documentStatus?.status ?? documentData?.status ?? "unknown",
                )}
              />
            </div>

            <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground leading-[1.15] max-w-4xl">
              {title}
            </h1>

            {summary && (
              <p className="text-xl leading-relaxed text-muted-foreground max-w-3xl mx-auto">
                {summary}
              </p>
            )}

            {documentData?.video && (
              <div className="mt-10 w-[calc(100vw-3rem)] max-w-[calc(1240px-3rem)] transition-all duration-300">
                <DocumentVideo documentId={id} video={documentData.video} />
              </div>
            )}
          </div>
        </div>

        {/* Article Body */}
        <article ref={articleRef} className="mt-16">
          {(!isReady && paragraphs.length === 0) ||
          (paragraphsQuery.isPending && paragraphs.length === 0) ||
          (isReady && paragraphsQuery.isFetching && paragraphs.length === 0) ? (
            <div className="space-y-8 animate-pulse opacity-60">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-[95%]" />
                  <Skeleton className="h-5 w-[98%]" />
                  <Skeleton className="h-5 w-[92%]" />
                </div>
              ))}
            </div>
          ) : paragraphsQuery.isError ? (
            <div className="py-20">
              <ErrorState
                description={getErrorMessage(paragraphsQuery.error)}
                onRetry={() => paragraphsQuery.refetch()}
              />
            </div>
          ) : paragraphs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-muted-foreground">
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={48}
                className="opacity-20 mb-4"
              />
              <p>No content available for this document.</p>
            </div>
          ) : activeLanguageMode === "bilingual" ? (
            <div className="flex flex-col">
              <div className="relative mb-2 hidden border-b border-border/60 bg-background/95 py-4 backdrop-blur md:block">
                <div className="grid grid-cols-2 gap-16">
                  {bilingualLanguages.map((language) => (
                    <div
                      key={language}
                      className="flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <span className="text-lg leading-none">
                        {LANGUAGE_FLAGS[language]}
                      </span>
                      {LANGUAGE_LABELS[language]}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Swap bilingual panel order"
                  onClick={() =>
                    setIsBilingualReversed((previous) => !previous)
                  }
                  className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background px-2 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <HugeiconsIcon
                    icon={ArrowUpDownIcon}
                    className="rotate-90"
                    size={18}
                  />
                </button>
              </div>

              <div className="flex flex-col">
                {paragraphs.map((paragraph) => {
                  const markdownByLanguage: Record<ParagraphLanguage, string> =
                    {
                      id: getParagraphLanguageMarkdown(paragraph, "id"),
                      en: getParagraphLanguageMarkdown(paragraph, "en"),
                    };

                  return (
                    <div
                      key={paragraph.id}
                      data-section-id={
                        typeof paragraph.section_id === "string"
                          ? paragraph.section_id
                          : undefined
                      }
                      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border/60 bg-background/80 md:grid md:grid-cols-2 md:gap-16 md:rounded-none md:border-0 md:border-b md:border-border/40 md:bg-transparent md:py-6 md:last:border-0"
                    >
                      {bilingualLanguages.map((language, index) => {
                        const markdown = markdownByLanguage[language];
                        const isFirstPanel = index === 0;

                        return (
                          <div
                            key={`${paragraph.id}-${language}`}
                            className={cn(
                              "min-w-0 p-5 md:p-0 [&>*:last-child]:mb-0",
                              isFirstPanel &&
                                "border-b border-border/60 md:border-b-0",
                            )}
                          >
                            {markdown ? (
                              renderParagraphMarkdown(
                                paragraph,
                                markdown,
                                `${paragraph.id}-${language}`,
                              )
                            ) : (
                              <div className="text-sm italic text-muted-foreground">
                                {LANGUAGE_LABELS[language]} translation not
                                available.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {paragraphs.map((paragraph) => {
                const markdown = getParagraphLanguageMarkdown(
                  paragraph,
                  activeLanguageMode,
                );

                return markdown ? (
                  <div
                    key={paragraph.id}
                    data-section-id={
                      typeof paragraph.section_id === "string"
                        ? paragraph.section_id
                        : undefined
                    }
                    className="scroll-mt-24"
                  >
                    {renderParagraphMarkdown(paragraph, markdown, paragraph.id)}
                  </div>
                ) : (
                  <div
                    key={paragraph.id}
                    data-section-id={
                      typeof paragraph.section_id === "string"
                        ? paragraph.section_id
                        : undefined
                    }
                    className="scroll-mt-24 rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-4 py-5 text-sm leading-relaxed text-muted-foreground"
                  >
                    {LANGUAGE_LABELS[activeLanguageMode]} translation is not
                    available for this paragraph yet.
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
