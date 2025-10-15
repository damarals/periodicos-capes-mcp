import * as cheerio from 'cheerio';
import {
  Article,
  BasicArticleInfo,
  SearchOptions,
  SearchResult,
  SearchPreviewResult,
  SearchFilters,
  SortBy,
  ArticlesBatchResult,
  ExportFormat,
  ExportResult,
  SearchArticlesResult,
} from './types.js';
import { QualisService } from './qualis-service.js';
import { OpenAlexService } from './openalex-service.js';
import { BibliographicExporter } from './bibliographic-exporter.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

export class CAPESScraper {
  private static readonly BASE_URL = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html';
  private static readonly DETAIL_URL_PATTERN = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=all&id={}';
  private readonly zyteApiKey: string;

  constructor() {
    this.zyteApiKey = process.env.ZYTE_API_KEY || '';
  }

  /**
   * Fetches HTML content using the Zyte API with automatic retry for HTTP 520 errors.
   * @param targetUrl The URL of the CAPES portal page to scrape.
   * @param maxRetries Maximum number of retries for 520 errors (default: 3)
   * @returns A promise that resolves to the HTML content of the page.
   */
  private async _fetchWithZyte(targetUrl: string, maxRetries: number = 3): Promise<string> {
    if (!this.zyteApiKey) {
      throw new Error("ZYTE_API_KEY environment variable is required. Please set it in your .env file.");
    }

    const request = {
      url: targetUrl,
      httpResponseBody: true
    };

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await fetch('https://api.zyte.com/v1/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(this.zyteApiKey + ':').toString('base64')}`
          },
          body: JSON.stringify(request)
        });

        // Handle HTTP 520 (temporary ban) - retry with backoff
        if (response.status === 520) {
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
            const logInfo = this.getLogInfo(targetUrl);
            console.warn(`⏳ HTTP 520 (temporary ban) - Retry ${attempt}/${maxRetries} after ${backoffMs}ms - ${logInfo}`);
            await this.sleep(backoffMs);
            continue;
          } else {
            throw new Error(`Zyte API persistent 520 error after ${maxRetries} retries: ${response.statusText}`);
          }
        }

        if (!response.ok) {
          throw new Error(`Zyte API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return Buffer.from(data.httpResponseBody, 'base64').toString('utf-8');
        
      } catch (error) {
        // If it's our last attempt, throw the error
        if (attempt > maxRetries) {
          console.error(`❌ Zyte failed permanently for ${targetUrl}:`, error instanceof Error ? error.message : String(error));
          throw new Error(`Failed to fetch from Zyte for URL ${targetUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // For network errors or other issues, also retry with backoff
        if (!(error instanceof Error) || !error.message.includes('520')) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          const logInfo = this.getLogInfo(targetUrl);
          console.warn(`⏳ Network error - Retry ${attempt}/${maxRetries} after ${backoffMs}ms - ${logInfo}`);
          await this.sleep(backoffMs);
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`Unexpected error in _fetchWithZyte for ${targetUrl}`);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract clean info from URL for logging
   */
  private getLogInfo(url: string): string {
    // Check for article details page
    const articleMatch = url.match(/id=([A-Z0-9]+)/);
    if (articleMatch) {
      return `Article ${articleMatch[1]} (details)`;
    }
    
    // Check for search page
    const pageMatch = url.match(/page=(\d+)/);
    if (pageMatch) {
      return `Page ${pageMatch[1]} (search)`;
    }
    
    // Default to search page 1
    if (url.includes('buscador.html')) {
      return 'Page 1 (search)';
    }
    
    return 'Unknown page';
  }

  private constructSearchUrl(searchTerm: string, options: SearchOptions, page: number = 1): string {
    // Encode search term with parentheses and spaces as expected by portal
    const searchQuery = options.advanced ? `all:contains(${searchTerm})` : searchTerm;
    const encodedTerm = encodeURIComponent(searchQuery).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/%20/g, '+');
    
    let url = `${CAPESScraper.BASE_URL}?q=${encodedTerm}`;
    
    // Source (always use all)
    url += '&source=all';
    
    if (options.advanced) {
      url += '&mode=advanced';
    }
    
    if (page > 1) {
      url += `&page=${page}`;
    }
    if (options.document_types && options.document_types.length > 0) {
      options.document_types.forEach(type => {
        const encodedType = encodeURIComponent(type).replace(/%20/g, '+');
        url += `&type%5B%5D=type%3D%3D${encodedType}`;
      });
    }
    
    if (options.open_access_only === true) {
      url += '&open_access%5B%5D=open_access%3D%3D1';
    } else if (options.open_access_only === false) {
      url += '&open_access%5B%5D=open_access%3D%3D0';
    }
    
    if (options.peer_reviewed_only === true) {
      url += '&peer_reviewed%5B%5D=peer_reviewed%3D%3D1';
    } else if (options.peer_reviewed_only === false) {
      url += '&peer_reviewed%5B%5D=peer_reviewed%3D%3D0';
    }
    
    if (options.year_min) {
      url += `&publishyear_min%5B%5D=${options.year_min}`;
    }
    if (options.year_max) {
      url += `&publishyear_max%5B%5D=${options.year_max}`;
    }
    if (options.languages && options.languages.length > 0) {
      options.languages.forEach(lang => {
        const encodedLang = encodeURIComponent(lang).replace(/%20/g, '+');
        url += `&language%5B%5D=language%3D%3D${encodedLang}`;
      });
    }
    
    return url;
  }

  private extractDoi(url: string): string | undefined {
    const doiPattern = /(?:doi\.org\/|doi=|\/doi\/)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
    const match = url.match(doiPattern);
    return match ? match[1] : undefined;
  }

  private extractArticleIdFromUrl(url: string): string | undefined {
    const idPattern = /id=([A-Z0-9]+)/;
    const match = url.match(idPattern);
    return match ? match[1] : undefined;
  }

  private getTotalPages($: cheerio.CheerioAPI): number {
    try {
      const totalSpan = $('div.pagination-information span.total');
      if (totalSpan.length && totalSpan.text().trim()) {
        const totalItems = parseInt(totalSpan.text().trim().replace(/\./g, ''));
        const perPage = 30; // CAPES default items per page
        return Math.ceil(totalItems / perPage);
      }
      return 0;
    } catch (error) {
      return 1;
    }
  }

  private extractBasicArticleInfo($: cheerio.CheerioAPI, theme: string, searchTerm: string): BasicArticleInfo[] {
    const listings: BasicArticleInfo[] = [];
    const articleSections = $('.result-busca');

    articleSections.each((_, section) => {
      try {
        const $section = $(section);
        
        const titleElem = $section.find('.titulo-busca');
        const title = titleElem.text().trim() || 'No title found';
        let articleId: string | undefined;
        let detailUrl: string | undefined;
        
        const href = titleElem.attr('href');
        if (href) {
          detailUrl = href.startsWith('http') 
            ? href 
            : `https://www.periodicos.capes.gov.br${href}`;
          articleId = this.extractArticleIdFromUrl(detailUrl);
        }

        let publisher: string | undefined;
        let journal: string | undefined;
        
        const journalParagraphs = $section.find('p.text-down-01');
        journalParagraphs.each((_, p) => {
          const text = $(p).text();
          if (text.includes('| ')) {
            const parts = text.split('|');
            if (parts.length >= 2) {
              journal = parts[1].trim();
              const leftSide = parts[0];
              if (leftSide.includes('-')) {
                const publisherPart = leftSide.split('-', 2)[1];
                publisher = publisherPart?.trim();
              }
            }
            return false; // Stop at first match
          }
        });

        const authors: string[] = [];
        $section.find('a.view-autor').each((_, authorLink) => {
          const authorName = $(authorLink).text().trim();
          if (authorName && !authors.includes(authorName)) {
            authors.push(authorName);
          }
        });

        const isOpenAccess = $section.find('.text-green-cool-vivid-50, .open-access, [title*="open access"], [alt*="open access"]').length > 0 ||
                               $section.text().toLowerCase().includes('open access');

        const isPeerReviewed = $section.find('.text-violet-50, .peer-reviewed, [title*="peer"], [alt*="peer"]').length > 0 ||
                                 $section.text().toLowerCase().includes('peer') ||
                                 $section.text().toLowerCase().includes('reviewed');

        const documentTypeElement = $section.find('.fw-semibold').first();
        const documentType = documentTypeElement.length ? documentTypeElement.text().trim() : undefined;

        if (title && articleId) {
          listings.push({
            title,
            article_id: articleId,
            detail_url: detailUrl,
            theme,
            search_term: searchTerm,
            journal,
            publisher,
            authors,
            document_type: documentType,
            is_open_access: isOpenAccess,
            is_peer_reviewed: isPeerReviewed,
          });
        }
      } catch (error) {
        console.error('Failed to extract article info:', error instanceof Error ? error.message : String(error));
      }
    });

    return listings;
  }

  async scrapeArticleDetail(articleId: string): Promise<Partial<Article>> {
    const detailUrl = CAPESScraper.DETAIL_URL_PATTERN.replace('{}', articleId);
    
    try {
      const html = await this._fetchWithZyte(detailUrl);
      const $ = cheerio.load(html);

      const metadata: Partial<Article> = {
        detail_url: detailUrl,
      };

      // CORRECTED: Abstract from meta tag (more reliable)
      metadata.abstract = $('meta[name="abstract"]').attr('content') || 
                         $('#item-resumo').text().trim() || undefined;

      // CORRECTED: ISSN with direct selector
      const issnElement = $('strong').filter((i, el) => $(el).text().trim() === 'ISSN').next('p.text-muted.mb-3.block');
      metadata.issn = issnElement.text().trim() || undefined;

      // CORRECTED: Publisher with direct ID selector
      const publisherText = $('#item-instituicao').text();
      metadata.publisher = publisherText.replace(/[;\s]*$/, '').trim() || undefined;

      // CORRECTED: Year with direct ID selector
      const yearText = $('#item-ano').text();
      const yearMatch = yearText.match(/(\d{4})/);
      metadata.publication_date = yearMatch ? yearMatch[1] : undefined;

      // CORRECTED: Volume with direct ID selector
      const volumeText = $('#item-volume').text();
      metadata.volume = volumeText.replace(/Volume:\s*/, '').replace(/[;\s]*$/, '').trim() || undefined;

      // CORRECTED: Issue with direct ID selector
      const issueText = $('#item-issue').text();
      metadata.issue = issueText.replace(/Issue:\s*/, '').replace(/[;\s]*$/, '').trim() || undefined;

      // CORRECTED: Language with direct ID selector
      const languageText = $('#item-language').text();
      metadata.language = languageText.replace(/Linguagem:\s*/, '').replace(/[;\s]*$/, '').trim() || undefined;

      // CORRECTED: DOI from first paragraph with specific class
      const doiText = $('p.small.text-muted.mb-3.block').first().text().trim();
      if (doiText && doiText.match(/10\.\d{4,}/)) {
        const doiMatch = doiText.match(/(10\.\d{4,}\/[^\s]+)/);
        metadata.doi = doiMatch ? doiMatch[1] : undefined;
      }

      // CORRECTED: Open Access with text search
      metadata.is_open_access = $('*:contains("Acesso aberto")').length > 0 ||
                                $('.text-green-cool-vivid-50').length > 0;

      // CORRECTED: Peer Review with text search  
      metadata.is_peer_reviewed = $('*:contains("Revisado por pares")').length > 0 ||
                                  $('.text-violet-50').length > 0;

      // CORRECTED: Authors with specific class selector
      const authors: string[] = [];
      $('a.view-autor.fst-italic').each((_, elem) => {
        const authorText = $(elem).text().trim();
        if (authorText) {
          authors.push(authorText);
        }
      });
      metadata.authors = authors.length > 0 ? authors : undefined;

      return metadata;
    } catch (error) {
      console.error(`❌ Failed to scrape article details for ${articleId}:`, error instanceof Error ? error.message : String(error));
      return {};
    }
  }

  private async getListingsForTerm(
    searchTerm: string,
    theme: string,
    options: SearchOptions,
    maxWorkers?: number
  ): Promise<BasicArticleInfo[]> {
    const listings: BasicArticleInfo[] = [];
    const url = this.constructSearchUrl(searchTerm, options, 1);

    try {
      const html = await this._fetchWithZyte(url);
      const $ = cheerio.load(html);

      // Determine total number of pages
      let totalPages = this.getTotalPages($);
      if (options.max_pages && options.max_pages > 0) {
        totalPages = Math.min(totalPages, options.max_pages);
      }

      // Calculate pages needed based on max_results (30 items per page)
      if (options.max_results && options.max_results > 0) {
        const itemsPerPage = 30;
        const pagesNeeded = Math.ceil(options.max_results / itemsPerPage);
        totalPages = Math.min(totalPages, pagesNeeded);
      }

      // Process first page
      const pageListings = this.extractBasicArticleInfo($, theme, searchTerm);
      listings.push(...pageListings);

      // Early return if we already have enough results
      if (options.max_results && listings.length >= options.max_results) {
        return listings.slice(0, options.max_results);
      }

      // Process remaining pages in parallel if needed
      if (totalPages > 1) {
        const pagePromises: Promise<BasicArticleInfo[]>[] = [];
        const workers = maxWorkers || 4; // Use provided workers or default to 4

        for (let page = 2; page <= totalPages; page++) {
          const pagePromise = this.fetchPage(searchTerm, theme, page, options);
          pagePromises.push(pagePromise);

          // Process in batches to respect max_workers
          if (pagePromises.length >= workers || page === totalPages) {
            const batchResults = await Promise.all(pagePromises);
            batchResults.forEach(pageResults => listings.push(...pageResults));
            pagePromises.length = 0;

            // Early return if we already have enough results
            if (options.max_results && listings.length >= options.max_results) {
              return listings.slice(0, options.max_results);
            }
          }
        }
      }

      return listings;
    } catch (error) {
      console.error(`Failed to get listings for term "${searchTerm}":`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private async fetchPage(
    searchTerm: string,
    theme: string,
    page: number,
    options: SearchOptions
  ): Promise<BasicArticleInfo[]> {
    try {
      const pageUrl = this.constructSearchUrl(searchTerm, options, page);
      const html = await this._fetchWithZyte(pageUrl);
      const $ = cheerio.load(html);
      
      const results = this.extractBasicArticleInfo($, theme, searchTerm);
      
      
      return results;
    } catch (error) {
      console.error(`Failed to fetch page ${page} for term "${searchTerm}":`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private async fetchArticleDetails(
    articleListings: BasicArticleInfo[],
    options: SearchOptions,
    maxWorkers?: number
  ): Promise<Article[]> {
    const workers = maxWorkers || 4; // Use provided workers or default to 4
    const articles: Article[] = [];

    const processArticle = async (listing: BasicArticleInfo): Promise<Article | null> => {
      try {
        if (!listing.article_id) {
          return null;
        }

        const details = await this.scrapeArticleDetail(listing.article_id);

        const article: Article = {
          title: listing.title,
          search_term: listing.theme,
          article_id: listing.article_id,
          detail_url: listing.detail_url,
          journal: listing.journal,
          publisher: listing.publisher,
          document_type: listing.document_type,
          ...details, // Apply details first
          // Then override with fallbacks to ensure no undefined values
          authors: details.authors || [],
          is_open_access: details.is_open_access || false,
          is_peer_reviewed: details.is_peer_reviewed || false,
        };


        return article;
      } catch (error) {
        console.error(`Failed to process article ${listing.article_id}:`, error instanceof Error ? error.message : String(error));
        return null;
      }
    };

    // Process articles in batches to respect max_workers
    for (let i = 0; i < articleListings.length; i += workers) {
      const batch = articleListings.slice(i, i + workers);
      const batchPromises = batch.map(processArticle);
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(article => {
        if (article) articles.push(article);
      });
    }

    // Add metrics (OpenAlex + Qualis) if requested
    if (options.include_metrics) {
      await this.enrichWithMetrics(articles);
    }

    return articles;
  }

  private async enrichWithMetrics(articles: Article[]): Promise<void> {
    
    // First, add Qualis data for articles with ISSN
    const qualisService = QualisService.getInstance();
    let qualisEnrichedCount = 0;
    
    for (const article of articles) {
      if (article.issn) {
        const qualisInfo = qualisService.getQualisByISSN(article.issn);
        if (qualisInfo) {
          if (!article.metrics) {
            article.metrics = {
              cited_by_count: 0,
              publication_year: new Date().getFullYear(),
              is_open_access: false,
            };
          }
          article.metrics.qualis = {
            classification: qualisInfo.classification,
            area: qualisInfo.area,
          };
          qualisEnrichedCount++;
        }
      }
    }
    
    
    // Then, add OpenAlex citation metrics for articles with DOI
    const articlesWithDOI = articles.filter(article => article.doi);
    if (articlesWithDOI.length === 0) {
      return;
    }

    const dois = articlesWithDOI.map(article => article.doi!);

    try {
      // Fetch OpenAlex metrics in batches
      const openAlexMetricsMap = await OpenAlexService.getMetricsByDOIs(dois);
      
      // Apply OpenAlex metrics to articles
      let openAlexEnrichedCount = 0;
      for (const article of articlesWithDOI) {
        if (article.doi) {
          const openAlexMetrics = openAlexMetricsMap.get(article.doi);
          if (openAlexMetrics) {
            if (!article.metrics) {
              article.metrics = openAlexMetrics;
            } else {
              // Merge OpenAlex metrics with existing metrics (keeping Qualis)
              article.metrics = {
                ...openAlexMetrics,
                qualis: article.metrics.qualis, // Preserve Qualis data
              };
            }
            openAlexEnrichedCount++;
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to enrich articles with OpenAlex metrics:', error instanceof Error ? error.message : String(error));
    }
  }

  async search(options: SearchOptions, maxWorkers?: number): Promise<SearchResult> {
    
    // Phase 1: Get all article listings
    const articleListings = await this.getListingsForTerm(
      options.query, 
      options.query, // Use query as theme for consistency
      options,
      maxWorkers
    );


    // Apply max_results limit to listings first (before expensive operations)
    let limitedListings = articleListings;
    if (options.max_results && options.max_results > 0) {
      limitedListings = articleListings.slice(0, options.max_results);
    }

    let articles: Article[];

    if (options.full_details) {
      // Phase 2: Fetch detailed metadata (only for limited set)
      articles = await this.fetchArticleDetails(limitedListings, options, maxWorkers);
    } else {
      // Convert basic listings to Article objects without detailed metadata
      articles = limitedListings.map(listing => ({
        title: listing.title,
        authors: listing.authors || [],
        search_term: listing.theme,
        article_id: listing.article_id,
        detail_url: listing.detail_url,
        journal: listing.journal,
        publisher: listing.publisher,
        document_type: listing.document_type,
        is_open_access: listing.is_open_access || false,
        is_peer_reviewed: listing.is_peer_reviewed || false,
      }));
    }


    return {
      articles,
      total_found: articleListings.length, // Use original listings count, not limited articles
      pages_processed: options.max_pages || 0,
      query: options.query,
    };
  }


  // Helper function to convert SearchFilters to SearchOptions
  private convertFiltersToOptions(query: string, filters?: SearchFilters): SearchOptions {
    return {
      query,
      document_types: filters?.document_types,
      open_access_only: filters?.open_access_only,
      peer_reviewed_only: filters?.peer_reviewed_only,
      year_min: filters?.year_range?.[0],
      year_max: filters?.year_range?.[1],
      languages: filters?.languages,
      advanced: true, // Always use advanced search
      include_metrics: false, // Default to false for performance
    };
  }

  // Helper function to sort articles
  private sortArticles(articles: Article[], sortBy: SortBy): Article[] {
    if (sortBy === 'relevance') {
      return articles; // Keep original order (CAPES relevance)
    }
    
    return [...articles].sort((a, b) => {
      const yearA = parseInt(a.publication_date || "0");
      const yearB = parseInt(b.publication_date || "0");
      
      if (sortBy === 'date_desc') {
        return yearB - yearA; // Newest first
      } else { // date_asc
        return yearA - yearB; // Oldest first
      }
    });
  }

  // NEW FUNCTION 1: Quick preview search
  async searchPreview(query: string, filters?: SearchFilters): Promise<SearchPreviewResult> {
    const options = this.convertFiltersToOptions(query, filters);
    const url = this.constructSearchUrl(query, options, 1);

    try {
      const html = await this._fetchWithZyte(url);
      const $ = cheerio.load(html);

      // Get total found
      const totalSpan = $('div.pagination-information span.total');
      const totalFound = totalSpan.length ? parseInt(totalSpan.text().trim().replace(/\./g, '')) : 0;

      // Extract sample titles from first page
      const sampleTitles: string[] = [];
      $('.result-busca .titulo-busca').slice(0, 5).each((_, elem) => {
        const title = $(elem).text().trim();
        if (title) {
          sampleTitles.push(title);
        }
      });

      const result = {
        query,
        total_found: totalFound,
        sample_titles: sampleTitles,
        filters_applied: filters,
      };


      return result;
    } catch (error) {
      throw new Error(`Preview search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // NEW FUNCTION 2: Get articles with pagination and sorting
  async getArticles(
    query: string, 
    startIndex: number, 
    count: number, 
    filters?: SearchFilters, 
    sortBy: SortBy = 'relevance'
  ): Promise<ArticlesBatchResult> {
    const options = this.convertFiltersToOptions(query, filters);
    options.full_details = true; // Always get full details for article batches
    options.include_metrics = true; // Include metrics for better quality

    // Calculate which pages we need based on startIndex and count
    const itemsPerPage = 30; // CAPES default
    const startPage = Math.floor(startIndex / itemsPerPage) + 1;
    const endIndex = startIndex + count;
    const endPage = Math.ceil(endIndex / itemsPerPage);

    let allArticles: Article[] = [];

    // Fetch only the pages we need
    for (let page = startPage; page <= endPage; page++) {
      try {
        const pageListings = await this.fetchPage(query, query, page, options);
        const pageArticles = await this.fetchArticleDetails(pageListings, options);
        allArticles.push(...pageArticles);
      } catch (error) {
        console.error(`Failed to fetch batch page ${page}:`, error instanceof Error ? error.message : String(error));
        // Continue with other pages if one fails
        continue;
      }
    }

    // Get total count (we need this for metadata)
    const previewResult = await this.searchPreview(query, filters);
    
    // Sort articles
    const sortedArticles = this.sortArticles(allArticles, sortBy);
    
    // Extract the specific slice we want
    const localStartIndex = startIndex % itemsPerPage;
    const requestedArticles = sortedArticles.slice(localStartIndex, localStartIndex + count);

    return {
      articles: requestedArticles,
      total_found: previewResult.total_found,
      start_index: startIndex,
      count_returned: requestedArticles.length,
      query,
      sort_by: sortBy,
      filters_applied: filters,
    };
  }

  // NEW FUNCTION 3: Export search with structured folder
  async exportSearch(
    query: string,
    format: ExportFormat,
    filters?: SearchFilters,
    maxResults?: number,
    maxWorkers?: number
  ): Promise<ExportResult> {
    // First get all articles
    const options = this.convertFiltersToOptions(query, filters);
    options.full_details = true; // Always get full details for export
    options.include_metrics = true; // Include metrics for academic quality
    
    if (maxResults) {
      options.max_results = maxResults;
    }

    // Use the existing search function to get all articles
    const searchResult = await this.search(options, maxWorkers);
    
    if (!searchResult.articles || searchResult.articles.length === 0) {
      throw new Error('No articles found for export');
    }

    // Create structured directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dirName = `capes_export_${timestamp}`;
    const exportDir = path.join(process.cwd(), dirName);
    
    // Create directory
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Export articles to file
    let exportFileResult;
    let exportFileName;
    
    if (format === 'ris') {
      exportFileResult = BibliographicExporter.exportToRISFile(searchResult.articles, exportDir);
      exportFileName = path.basename(exportFileResult.file_path);
    } else if (format === 'bibtex') {
      exportFileResult = BibliographicExporter.exportToBibTeXFile(searchResult.articles, exportDir);
      exportFileName = path.basename(exportFileResult.file_path);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Create metadata.json
    const metadata = {
      search_metadata: {
        query,
        total_found: searchResult.total_found,
        articles_exported: searchResult.articles.length,
        search_date: new Date().toISOString(),
        filters_applied: filters,
        format,
        capes_portal_info: "Portal de Periódicos CAPES (IEEE, ACM, Elsevier, WoS, Scopus, etc.)",
        tool_version: "4.4.7",
        export_timestamp: timestamp
      },
      export_info: {
        directory: exportDir,
        files: [
          {
            name: exportFileName,
            type: format,
            size_bytes: exportFileResult.file_size_bytes,
            article_count: exportFileResult.article_count
          },
          {
            name: "metadata.json",
            type: "metadata",
            description: "Search and export metadata for reproducibility"
          }
        ]
      },
      usage_notes: {
        import_to_zotero: format === 'ris' ? "Import the .ris file directly into Zotero" : "Use 'Import from BibTeX' option in Zotero",
        import_to_mendeley: format === 'ris' ? "Use 'Import RIS' option" : "Use 'Import BibTeX' option", 
        reproducibility: "This metadata.json contains all search parameters for exact reproduction"
      }
    };

    const metadataPath = path.join(exportDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    return {
      export_completed: true,
      output_directory: exportDir,
      files_created: [exportFileName, 'metadata.json'],
      articles_exported: searchResult.articles.length,
      format,
      search_metadata: {
        query,
        total_found: searchResult.total_found,
        search_date: new Date().toISOString(),
        filters_applied: filters,
      }
    };
  }

  // NEW UNIFIED FUNCTION: Search and export articles
  async searchArticles(
    query: string,
    format: ExportFormat,
    filters?: SearchFilters,
    maxResults?: number,
    maxWorkers?: number
  ): Promise<SearchArticlesResult> {
    // Step 1: Get preview for the search summary (5 articles sample)
    const previewResult = await this.searchPreview(query, filters);

    // Step 2: Get all articles for export
    const options = this.convertFiltersToOptions(query, filters);
    options.full_details = true; // Always get full details for export
    options.include_metrics = true; // Include metrics for academic quality
    
    if (maxResults) {
      options.max_results = maxResults;
    }

    // Use the existing search function to get all articles with custom workers
    const searchResult = await this.search(options, maxWorkers);
    
    if (!searchResult.articles || searchResult.articles.length === 0) {
      throw new Error('No articles found for export');
    }

    // Step 3: Create structured directory and export files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dirName = `capes_export_${timestamp}`;
    const exportDir = path.join(process.cwd(), dirName);
    
    // Create directory
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Export articles to file
    let exportFileResult;
    let exportFileName;
    
    if (format === 'ris') {
      exportFileResult = BibliographicExporter.exportToRISFile(searchResult.articles, exportDir);
      exportFileName = path.basename(exportFileResult.file_path);
    } else if (format === 'bibtex') {
      exportFileResult = BibliographicExporter.exportToBibTeXFile(searchResult.articles, exportDir);
      exportFileName = path.basename(exportFileResult.file_path);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Create metadata.json
    const metadata = {
      search_metadata: {
        query,
        total_found: searchResult.total_found,
        articles_exported: searchResult.articles.length,
        search_date: new Date().toISOString(),
        filters_applied: filters,
        format,
        capes_portal_info: "Portal de Periódicos CAPES (IEEE, ACM, Elsevier, WoS, Scopus, etc.)",
        tool_version: "4.4.7",
        export_timestamp: timestamp
      },
      export_info: {
        directory: exportDir,
        files: [
          {
            name: exportFileName,
            type: format,
            size_bytes: exportFileResult.file_size_bytes,
            article_count: exportFileResult.article_count
          },
          {
            name: "metadata.json",
            type: "metadata",
            description: "Search and export metadata for reproducibility"
          }
        ]
      },
      usage_notes: {
        import_to_zotero: format === 'ris' ? "Import the .ris file directly into Zotero" : "Use 'Import from BibTeX' option in Zotero",
        import_to_mendeley: format === 'ris' ? "Use 'Import RIS' option" : "Use 'Import BibTeX' option", 
        reproducibility: "This metadata.json contains all search parameters for exact reproduction"
      }
    };

    const metadataPath = path.join(exportDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Step 4: Create sample articles for display (from first 5 articles)
    const sampleArticles = searchResult.articles.slice(0, 5).map(article => ({
      title: article.title,
      authors: article.authors,
      journal: article.journal,
      year: article.publication_date,
      is_open_access: article.is_open_access,
      is_peer_reviewed: article.is_peer_reviewed,
    }));

    return {
      search_summary: {
        query,
        total_found: previewResult.total_found,
        sample_articles: sampleArticles,
        filters_applied: filters,
      },
      export_result: {
        files_created: [exportFileName, 'metadata.json'],
        output_directory: exportDir,
        articles_exported: searchResult.articles.length,
        format,
      }
    };
  }
}