export type ReaderSectionRecord = {
  id: string;
  parent_id: string | null;
  level: number;
  title: string;
  title_id: string | null;
  para_start: string | null;
  order_no: number;
};

export type ReaderParagraphRecord = {
  id: string;
  section_id: string | null;
  order_no: number;
  page_no: number;
  source_start: number | null;
  source_end: number | null;
  text_raw: string;
  text_raw_md: string;
  source_lang: 'en' | 'id' | 'unknown' | null;
  text_en: string | null;
  text_en_md: string | null;
  text_id: string | null;
  text_id_md: string | null;
  translation_status: string | null;
};

export type ReaderTranslationRecord = {
  paragraph_id: string;
  text_en: string | null;
  text_en_md: string | null;
  text_id: string | null;
  text_id_md: string | null;
  status: string;
  translated_at: Date | null;
  cache_hash: string | null;
};

export type ReaderTermRecord = {
  id: string;
  term_en: string;
  definition: string | null;
  definition_id: string | null;
  example: string | null;
  example_id: string | null;
  occurrence_count: number;
};

export type ReaderTermOccurrenceRecord = {
  paragraph_id: string;
  page_no: number;
  snippet_en: string;
};

export type ReaderMapNodeRecord = {
  id: string;
  parent_id: string | null;
  label: string;
  label_id: string | null;
  type: string;
  para_refs: string[];
  order_no: number;
};

export type ReaderWarningRecord = {
  code: string;
  message: string;
  pages: number[];
};

export type ReaderArtifactsBundle = {
  sections: Array<{
    id: string;
    parent_id: string | null;
    level: number;
    title: string;
    title_id: string | null;
    para_start: string | null;
    order_no: number;
  }>;
  paragraphs: Array<{
    id: string;
    section_id: string | null;
    order_no: number;
    page_no: number;
    source_start: number | null;
    source_end: number | null;
    text_raw: string;
    text_raw_md: string;
  }>;
  translations: Array<{
    paragraph_id: string;
    status: 'pending' | 'done' | 'error';
    text_en: string | null;
    text_en_md: string | null;
    text_id: string | null;
    text_id_md: string | null;
    cache_hash: string | null;
    translated_at: Date | null;
  }>;
  terms: Array<{
    id: string;
    term_en: string;
    definition: string | null;
    definition_id: string | null;
    example: string | null;
    example_id: string | null;
    occurrence_count: number;
  }>;
  term_occurrences: Array<{
    id: string;
    term_id: string;
    paragraph_id: string;
    page_no: number;
    snippet_en: string;
  }>;
  map_nodes: Array<{
    id: string;
    parent_id: string | null;
    label: string;
    label_id: string | null;
    type: string;
    para_refs: string[];
    order_no: number;
  }>;
  warnings: Array<{
    id: string;
    code: string;
    message: string;
    pages: number[];
  }>;
};

export type TranslationRetryContext = {
  paragraph_id: string;
  text_raw: string;
  text_raw_md: string;
  source_lang: 'en' | 'id' | 'unknown' | null;
  status: string | null;
};
