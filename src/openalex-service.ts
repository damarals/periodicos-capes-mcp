import { ArticleMetrics } from './types.js';

export class OpenAlexService {
  private static readonly BASE_URL = 'https://api.openalex.org';

  /**
   * Get metrics for a single article by DOI
   */
  static async getMetricsByDOI(doi: string): Promise<ArticleMetrics | null> {
    try {
      const url = `${this.BASE_URL}/works/https://doi.org/${doi}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Article not found in OpenAlex
        }
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseOpenAlexWork(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get metrics for multiple articles by DOI (batch processing)
   */
  static async getMetricsByDOIs(dois: string[]): Promise<Map<string, ArticleMetrics>> {
    const results = new Map<string, ArticleMetrics>();
    
    
    // Process in batches of 50 (OpenAlex limit per request)
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < dois.length; i += BATCH_SIZE) {
      const batch = dois.slice(i, i + BATCH_SIZE);
      const batchResults = await this.processBatch(batch);
      
      // Merge results
      for (const [doi, metrics] of batchResults) {
        results.set(doi, metrics);
      }
      
      // Small delay between batches to be respectful
      if (i + BATCH_SIZE < dois.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Process a batch of DOIs using correct OpenAlex syntax
   */
  private static async processBatch(dois: string[]): Promise<Map<string, ArticleMetrics>> {
    const results = new Map<string, ArticleMetrics>();
    
    try {
      // Build filter with pipe-separated DOIs (correct OpenAlex syntax)
      const doiFilter = `doi:${dois.join('|')}`;
      const url = `${this.BASE_URL}/works?filter=${encodeURIComponent(doiFilter)}&per-page=${dois.length}`;
      
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        return results;
      }

      const data = await response.json();
      
      // Process each work in the response
      if (data.results && Array.isArray(data.results)) {
        
        for (const work of data.results) {
          const metrics = this.parseOpenAlexWork(work);
          if (metrics && work.doi) {
            // Extract DOI from OpenAlex format (https://doi.org/...)
            const doi = work.doi.replace('https://doi.org/', '');
            results.set(doi, metrics);
          }
        }
      }
    } catch (error) {
    }
    
    return results;
  }


  /**
   * Parse OpenAlex work object into ArticleMetrics
   */
  private static parseOpenAlexWork(work: any): ArticleMetrics | null {
    try {
      return {
        cited_by_count: work.cited_by_count || 0,
        fwci: work.fwci || undefined,
        publication_year: work.publication_year || new Date().getFullYear(),
        is_open_access: work.open_access?.is_oa || false,
        open_access_oa_date: work.open_access?.oa_date || undefined,
      };
    } catch (error) {
      return null;
    }
  }
}