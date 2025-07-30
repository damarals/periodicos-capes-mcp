import * as cheerio from 'cheerio';
import { Article, BasicArticleInfo, SearchOptions, SearchResult, SearchPreviewResult } from './types.js';
import { QualisService } from './qualis-service.js';
import { OpenAlexService } from './openalex-service.js';

export class CAPESScraper {
  private static readonly BASE_URL = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html';
  private static readonly DETAIL_URL_PATTERN = 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=all&id={}';
  
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private static readonly DEFAULT_HEADERS = {
    'User-Agent': CAPESScraper.USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
  };

  private readonly defaultTimeout: number;
  private readonly defaultMaxWorkers: number;

  constructor(timeout = 30000, maxWorkers = 5) {
    this.defaultTimeout = timeout;
    this.defaultMaxWorkers = maxWorkers;
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
        headers: CAPESScraper.DEFAULT_HEADERS,
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

      const abstractElem = $('#item-resumo');
      if (abstractElem.length) {
        metadata.abstract = abstractElem.text().trim();
      }
      // Look for ISSN in specific patterns
      const issnStrong = $('strong:contains("ISSN")').first();
      if (issnStrong.length) {
        const nextP = issnStrong.next('p');
        if (nextP.length) {
          metadata.issn = nextP.text().trim();
        }
      }

      const publisherElem = $('#item-instituicao');
      if (publisherElem.length) {
        metadata.publisher = publisherElem.text().replace(/;$/, '').trim();
      }

      const yearElem = $('#item-ano');
      if (yearElem.length) {
        const yearMatch = yearElem.text().match(/(\d{4})/);
        if (yearMatch) {
          metadata.publication_date = yearMatch[1];
        }
      }

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


      metadata.is_open_access = $('.text-green-cool-vivid-50').length > 0;

      metadata.is_peer_reviewed = $('.text-violet-50').length > 0;

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

      $('a[href^="http"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          const doi = this.extractDoi(href);
          if (doi) {
            metadata.doi = doi;
            return false; // Stop at first match
          }
        }
      });

      return metadata;
    } catch (error) {
      return {};
    }
  }

  private async getListingsForTerm(
    searchTerm: string, 
    theme: string, 
    options: SearchOptions
  ): Promise<BasicArticleInfo[]> {
    const listings: BasicArticleInfo[] = [];
    const url = this.constructSearchUrl(searchTerm, options, 1);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: CAPESScraper.DEFAULT_HEADERS,
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

      const response = await fetch(pageUrl, {
        signal: controller.signal,
        headers: CAPESScraper.DEFAULT_HEADERS,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      return this.extractBasicArticleInfo($, theme, searchTerm);
    } catch (error) {
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
          document_type: listing.document_type,
          is_open_access: details.is_open_access || false,
          is_peer_reviewed: details.is_peer_reviewed || false,
          ...details,
        };


        return article;
      } catch (error) {
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
    }
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    
    // Phase 1: Get all article listings
    const articleListings = await this.getListingsForTerm(
      options.query, 
      options.query, // Use query as theme for consistency
      options
    );


    // Apply max_results limit to listings first (before expensive operations)
    let limitedListings = articleListings;
    if (options.max_results && options.max_results > 0) {
      limitedListings = articleListings.slice(0, options.max_results);
    }

    let articles: Article[];

    if (options.full_details) {
      // Phase 2: Fetch detailed metadata (only for limited set)
      articles = await this.fetchArticleDetails(limitedListings, options);
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
      total_found: articles.length,
      pages_processed: options.max_pages || 0,
      query: options.query,
    };
  }

  async searchPreview(options: SearchOptions): Promise<SearchPreviewResult> {
    
    const url = this.constructSearchUrl(options.query, options, 1);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: CAPESScraper.DEFAULT_HEADERS,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Get total pages and items
      const totalPages = this.getTotalPages($);
      const totalSpan = $('div.pagination-information span.total');
      const totalFound = totalSpan.length ? parseInt(totalSpan.text().trim().replace(/\./g, '')) : 0;

      // Estimate time based on total pages (assuming ~2 seconds per page with current workers)
      const maxWorkers = options.max_workers || this.defaultMaxWorkers;
      const estimatedTimeSeconds = Math.ceil((totalPages * 2) / maxWorkers);


      return {
        query: options.query,
        total_found: totalFound,
        estimated_time_seconds: estimatedTimeSeconds,
        search_url: url,
        filters_applied: {
          document_types: options.document_types,
          open_access_only: options.open_access_only,
          peer_reviewed_only: options.peer_reviewed_only,
          year_min: options.year_min,
          year_max: options.year_max,
          languages: options.languages,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}