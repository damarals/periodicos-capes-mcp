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
  topics: string[];
  detail_url?: string;
  is_open_access: boolean;
  is_peer_reviewed: boolean;
}

export interface SearchOptions {
  query: string;
  max_pages?: number;
  max_results?: number;
  full_details?: boolean;
  max_workers?: number;
  timeout?: number;
  advanced?: boolean;
}

export interface BasicArticleInfo {
  title: string;
  article_id?: string;
  detail_url?: string;
  theme: string;
  search_term: string;
  journal?: string;
  publisher?: string;
}

export interface SearchResult {
  articles: Article[];
  total_found: number;
  pages_processed: number;
  query: string;
}