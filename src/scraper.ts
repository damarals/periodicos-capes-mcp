import * as cheerio from 'cheerio';
import { Article, BasicArticleInfo, SearchOptions, SearchResult } from './types.js';

export class CAPESScraper {
  private static readonly BASE_URL = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html';
  private static readonly DETAIL_URL_PATTERN = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=all&id={}';

  private readonly defaultTimeout: number;
  private readonly defaultMaxWorkers: number;

  constructor(timeout = 30000, maxWorkers = 5) {
    this.defaultTimeout = timeout;
    this.defaultMaxWorkers = maxWorkers;
  }

  private constructSearchUrl(searchTerm: string, advanced: boolean = true, page: number = 1): string {
    const encodedTerm = encodeURIComponent(
      advanced ? `all:contains(${searchTerm})` : searchTerm
    );
    const mode = advanced ? '&mode=advanced' : '';
    return `${CAPESScraper.BASE_URL}?q=${encodedTerm}${mode}&source=all&page=${page}`;
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
        const totalItems = parseInt(totalSpan.text().trim());
        const perPage = 30; // Default items per page
        return Math.ceil(totalItems / perPage);
      }
      return 0;
    } catch (error) {
      console.warn('Error determining total pages:', error);
      return 1;
    }
  }

  private extractBasicArticleInfo($: cheerio.CheerioAPI, theme: string, searchTerm: string): BasicArticleInfo[] {
    const listings: BasicArticleInfo[] = [];
    const articleSections = $('#resultados .result-busca');

    articleSections.each((_, section) => {
      try {
        const $section = $(section);
        
        // Extract title
        const titleElem = $section.find('.titulo-busca');
        const title = titleElem.text().trim() || 'No title found';

        // Get article ID and detail URL
        let articleId: string | undefined;
        let detailUrl: string | undefined;
        
        const href = titleElem.attr('href');
        if (href) {
          detailUrl = href.startsWith('http') 
            ? href 
            : `https://www.periodicos.capes.gov.br${href}`;
          articleId = this.extractArticleIdFromUrl(detailUrl);
        }

        // Extract publisher and journal from text-down-01 paragraph
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
            return false; // break
          }
        });

        if (title && articleId) {
          listings.push({
            title,
            article_id: articleId,
            detail_url: detailUrl,
            theme,
            search_term: searchTerm,
            journal,
            publisher,
          });
        }
      } catch (error) {
        console.error('Error extracting basic article info:', error);
      }
    });

    return listings;
  }

  async scrapeArticleDetail(articleId: string, timeout?: number): Promise<Partial<Article>> {
    const detailUrl = CAPESScraper.DETAIL_URL_PATTERN.replace('{}', articleId);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout || this.defaultTimeout);

      const response = await fetch(detailUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const metadata: Partial<Article> = {
        detail_url: detailUrl,
      };

      // Extract abstract
      const abstractElem = $('#item-resumo');
      if (abstractElem.length) {
        metadata.abstract = abstractElem.text().trim();
      }

      // Extract ISSN
      $('*').each((_, elem) => {
        const text = $(elem).text();
        if (/ISSN/i.test(text)) {
          const nextSibling = $(elem).next();
          if (nextSibling.length) {
            metadata.issn = nextSibling.text().trim();
          }
        }
      });

      // Extract publication date (year)
      const yearElem = $('#item-ano');
      if (yearElem.length) {
        const yearMatch = yearElem.text().match(/(\d{4})/);
        if (yearMatch) {
          metadata.publication_date = yearMatch[1];
        }
      }

      // Extract volume, issue, language
      const pubInfo = $('p.small.text-muted');
      if (pubInfo.length) {
        const text = pubInfo.text();
        
        const volumeMatch = text.match(/Volume:\s*([^;]+)/);
        if (volumeMatch) {
          metadata.volume = volumeMatch[1].trim();
        }

        const issueMatch = text.match(/Issue:\s*(\d+)/);
        if (issueMatch) {
          metadata.issue = issueMatch[1].trim();
        }

        const langMatch = text.match(/Linguagem:\s*([^;]+)/);
        if (langMatch) {
          metadata.language = langMatch[1].trim();
        }
      }

      // Extract topics
      $('*').each((_, elem) => {
        const text = $(elem).text();
        if (/Tópico\(s\)/i.test(text)) {
          const nextSibling = $(elem).next();
          if (nextSibling.length) {
            const topicsText = nextSibling.text().trim();
            metadata.topics = topicsText.split(',').map(topic => topic.trim());
          }
        }
      });

      // Check if open access
      metadata.is_open_access = $('.text-green-cool-vivid-50').length > 0;

      // Check if peer-reviewed
      metadata.is_peer_reviewed = $('.text-violet-50').length > 0;

      // Extract authors
      const authors: string[] = [];
      $('.view-autor').each((_, elem) => {
        const authorText = $(elem).text().trim();
        if (authorText) {
          authors.push(authorText);
        }
      });
      if (authors.length > 0) {
        metadata.authors = authors;
      }

      // Extract DOI from links
      $('a[href^="http"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          const doi = this.extractDoi(href);
          if (doi) {
            metadata.doi = doi;
            return false; // break
          }
        }
      });

      return metadata;
    } catch (error) {
      console.error(`Error fetching details for ${articleId}:`, error);
      return {};
    }
  }

  private async getListingsForTerm(
    searchTerm: string, 
    theme: string, 
    options: SearchOptions
  ): Promise<BasicArticleInfo[]> {
    const listings: BasicArticleInfo[] = [];
    const url = this.constructSearchUrl(searchTerm, options.advanced, 1);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Determine total number of pages
      let totalPages = this.getTotalPages($);
      if (options.max_pages && options.max_pages > 0) {
        totalPages = Math.min(totalPages, options.max_pages);
      }

      // Process first page
      const pageListings = this.extractBasicArticleInfo($, theme, searchTerm);
      listings.push(...pageListings);

      // Process remaining pages in parallel if needed
      if (totalPages > 1) {
        const pagePromises: Promise<BasicArticleInfo[]>[] = [];
        const maxWorkers = options.max_workers || this.defaultMaxWorkers;
        
        for (let page = 2; page <= totalPages; page++) {
          const pagePromise = this.fetchPage(searchTerm, theme, page, options);
          pagePromises.push(pagePromise);

          // Process in batches to respect max_workers
          if (pagePromises.length >= maxWorkers || page === totalPages) {
            const batchResults = await Promise.all(pagePromises);
            batchResults.forEach(pageResults => listings.push(...pageResults));
            pagePromises.length = 0;
          }
        }
      }

      return listings;
    } catch (error) {
      console.error(`Error fetching listings for ${theme}:`, error);
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
      const pageUrl = this.constructSearchUrl(searchTerm, options.advanced, page);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

      const response = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      return this.extractBasicArticleInfo($, theme, searchTerm);
    } catch (error) {
      console.error(`Error fetching page ${page} for ${theme}:`, error);
      return [];
    }
  }

  private async fetchArticleDetails(
    articleListings: BasicArticleInfo[],
    options: SearchOptions
  ): Promise<Article[]> {
    const maxWorkers = options.max_workers || this.defaultMaxWorkers;
    const articles: Article[] = [];

    const processArticle = async (listing: BasicArticleInfo): Promise<Article | null> => {
      try {
        if (!listing.article_id) {
          console.warn(`Missing article ID for ${listing.title}`);
          return null;
        }

        const details = await this.scrapeArticleDetail(listing.article_id, options.timeout);

        const article: Article = {
          title: listing.title,
          authors: details.authors || [],
          search_term: listing.theme,
          article_id: listing.article_id,
          detail_url: listing.detail_url,
          journal: listing.journal,
          publisher: listing.publisher,
          topics: details.topics || [],
          is_open_access: details.is_open_access || false,
          is_peer_reviewed: details.is_peer_reviewed || false,
          ...details,
        };

        return article;
      } catch (error) {
        console.error(`Error processing article ${listing.article_id}:`, error);
        return null;
      }
    };

    // Process articles in batches to respect max_workers
    for (let i = 0; i < articleListings.length; i += maxWorkers) {
      const batch = articleListings.slice(i, i + maxWorkers);
      const batchPromises = batch.map(processArticle);
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(article => {
        if (article) articles.push(article);
      });
    }

    return articles;
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    console.log(`Starting search for: ${options.query}`);
    
    // Phase 1: Get all article listings
    const articleListings = await this.getListingsForTerm(
      options.query, 
      options.query, // Use query as theme for simplicity
      options
    );

    console.log(`Found ${articleListings.length} article listings`);

    let articles: Article[];

    if (options.full_details) {
      // Phase 2: Fetch detailed metadata
      console.log('Fetching detailed metadata for each article');
      articles = await this.fetchArticleDetails(articleListings, options);
    } else {
      // Convert basic listings to Article objects without detailed metadata
      articles = articleListings.map(listing => ({
        title: listing.title,
        authors: [],
        search_term: listing.theme,
        article_id: listing.article_id,
        detail_url: listing.detail_url,
        journal: listing.journal,
        publisher: listing.publisher,
        topics: [],
        is_open_access: false,
        is_peer_reviewed: false,
      }));
    }

    // Apply max_results limit if specified
    if (options.max_results && options.max_results > 0) {
      articles = articles.slice(0, options.max_results);
      console.log(`Limited results to ${articles.length} articles (max_results: ${options.max_results})`);
    }

    console.log(`Completed: Found ${articles.length} articles`);

    return {
      articles,
      total_found: articles.length,
      pages_processed: options.max_pages || 0,
      query: options.query,
    };
  }
}