// Constants for CAPES portal options
export const DOCUMENT_TYPES = ['Artigo', 'Capítulo de livro', 'Carta', 'Errata', 'Revisão'] as const;
export const LANGUAGES = ['Inglês', 'Português', 'Espanhol', 'Francês', 'Alemão', 'Italiano'] as const;

export interface ArticleMetrics {
  // Citation metrics (OpenAlex)
  cited_by_count: number;
  fwci?: number;
  publication_year: number;
  is_open_access: boolean;
  open_access_oa_date?: string;
  
  // Journal quality metrics (Qualis)
  qualis?: {
    classification: string;
    area: string;
  };
}

export interface Article {
  title: string;
  authors: string[];
  publication_date?: string;
  doi?: string;
  journal?: string;
  abstract?: string;
  search_term: string;
  article_id?: string;
  issn?: string;
  volume?: string;
  issue?: string;
  language?: string;
  publisher?: string;
  detail_url?: string;
  document_type?: string;
  is_open_access: boolean;
  is_peer_reviewed: boolean;
  metrics?: ArticleMetrics;
}

export interface SearchOptions {
  query: string;
  max_pages?: number;
  max_results?: number;
  full_details?: boolean;
  max_workers?: number;
  timeout?: number;
  advanced?: boolean;
  include_metrics?: boolean;
  // Search filters
  document_types?: string[];
  open_access_only?: boolean;
  peer_reviewed_only?: boolean;
  year_min?: number;
  year_max?: number;
  languages?: string[];
}

export interface BasicArticleInfo {
  title: string;
  article_id?: string;
  detail_url?: string;
  theme: string;
  search_term: string;
  journal?: string;
  publisher?: string;
  authors?: string[];
  document_type?: string;
  is_open_access?: boolean;
  is_peer_reviewed?: boolean;
}

export interface SearchResult {
  articles: Article[];
  total_found: number;
  pages_processed: number;
  query: string;
}

export interface SearchPreviewResult {
  query: string;
  total_found: number;
  estimated_time_seconds: number;
  search_url: string;
  filters_applied: {
    document_types?: string[];
    open_access_only?: boolean;
    peer_reviewed_only?: boolean;
    year_min?: number;
    year_max?: number;
    languages?: string[];
  };
}