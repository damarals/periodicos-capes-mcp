import { Article } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ExportFileResult {
  file_path: string;
  article_count: number;
  file_size_bytes: number;
  created_at: string;
}

export class BibliographicExporter {
  private static readonly RIS_TYPE_MAPPING: Record<string, string> = {
    'Artigo': 'JOUR',
    'Capítulo de livro': 'CHAP',
    'Carta': 'NEWS',
    'Errata': 'JOUR',
    'Revisão': 'JOUR'
  };

  static exportToRIS(articles: Article[]): string {
    const risRecords: string[] = [];

    for (const article of articles) {
      const record = this.convertArticleToRIS(article);
      if (record) {
        risRecords.push(record);
      }
    }

    return risRecords.join('\n\n') + '\n';
  }

  static exportToRISFile(articles: Article[], outputDir?: string, filename?: string): ExportFileResult {
    const risContent = this.exportToRIS(articles);
    
    // Determine output directory (current directory by default)
    const targetDir = outputDir || process.cwd();
    
    // Generate filename if not provided
    let finalFilename = filename;
    if (!finalFilename) {
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
                       (now.getMonth() + 1).toString().padStart(2, '0') +
                       now.getDate().toString().padStart(2, '0') +
                       now.getHours().toString().padStart(2, '0') +
                       now.getMinutes().toString().padStart(2, '0') +
                       now.getSeconds().toString().padStart(2, '0');
      finalFilename = `capes_export_${timestamp}.ris`;
    }
    
    // Ensure .ris extension
    if (!finalFilename.endsWith('.ris')) {
      finalFilename += '.ris';
    }
    
    const filePath = path.join(targetDir, finalFilename);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, risContent, 'utf8');
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    return {
      file_path: filePath,
      article_count: articles.length,
      file_size_bytes: stats.size,
      created_at: new Date().toISOString()
    };
  }

  private static convertArticleToRIS(article: Article): string | null {
    const lines: string[] = [];

    // TY - Type (obrigatório e deve ser primeiro)
    const risType = this.getRISType(article.document_type);
    lines.push(`TY  - ${risType}`);

    // TI - Title (obrigatório)
    if (article.title) {
      lines.push(`TI  - ${article.title}`);
    } else {
      return null;
    }

    // AU - Authors (múltiplas linhas)
    if (article.authors && article.authors.length > 0) {
      article.authors.forEach(author => {
        lines.push(`AU  - ${author}`);
      });
    }

    // PY - Publication year
    if (article.publication_date) {
      const year = this.extractYear(article.publication_date);
      if (year) {
        lines.push(`PY  - ${year}`);
      }
    }

    // T2 - Secondary title (Journal)
    if (article.journal) {
      lines.push(`T2  - ${article.journal}`);
    }

    // JF - Full journal name (alias para T2)
    if (article.journal) {
      lines.push(`JF  - ${article.journal}`);
    }

    // VL - Volume
    if (article.volume) {
      lines.push(`VL  - ${article.volume}`);
    }

    // IS - Issue
    if (article.issue) {
      lines.push(`IS  - ${article.issue}`);
    }

    // AB - Abstract 
    if (article.abstract) {
      // Remove HTML tags se existirem e limpa o texto
      const cleanAbstract = article.abstract.replace(/<[^>]*>/g, '').trim();
      lines.push(`AB  - ${cleanAbstract}`);
    }

    // DO - DOI
    if (article.doi) {
      lines.push(`DO  - ${article.doi}`);
    }

    // SN - ISSN
    if (article.issn) {
      lines.push(`SN  - ${article.issn}`);
    }

    // PB - Publisher
    if (article.publisher) {
      lines.push(`PB  - ${article.publisher}`);
    }

    // LA - Language
    if (article.language) {
      lines.push(`LA  - ${article.language}`);
    }

    // UR - URL
    if (article.detail_url) {
      lines.push(`UR  - ${article.detail_url}`);
    }

    // KW - Keywords (usando search_term como keyword)
    if (article.search_term) {
      lines.push(`KW  - ${article.search_term}`);
    }

    // N1 - Notes (informações adicionais)
    const notes: string[] = [];
    if (article.is_open_access) {
      notes.push('Open Access');
    }
    if (article.is_peer_reviewed) {
      notes.push('Peer Reviewed');
    }
    if (article.article_id) {
      notes.push(`CAPES ID: ${article.article_id}`);
    }
    if (notes.length > 0) {
      lines.push(`N1  - ${notes.join('; ')}`);
    }

    // ER - End of record (obrigatório e deve ser último)
    lines.push('ER  - ');

    return lines.join('\r\n');
  }

  private static getRISType(documentType?: string): string {
    if (!documentType) {
      return 'JOUR'; // Default para artigo
    }

    return this.RIS_TYPE_MAPPING[documentType] || 'JOUR';
  }

  private static extractYear(dateString: string): string | null {
    const yearMatch = dateString.match(/(\d{4})/);
    return yearMatch ? yearMatch[1] : null;
  }

  // BibTeX export functions
  static exportToBibTeX(articles: Article[]): string {
    const bibTexEntries: string[] = [];

    for (const article of articles) {
      const entry = this.convertArticleToBibTeX(article);
      if (entry) {
        bibTexEntries.push(entry);
      }
    }

    return bibTexEntries.join('\n\n') + '\n';
  }

  static exportToBibTeXFile(articles: Article[], outputDir?: string, filename?: string): ExportFileResult {
    const bibTexContent = this.exportToBibTeX(articles);
    
    // Determine output directory (current directory by default)
    const targetDir = outputDir || process.cwd();
    
    // Generate filename if not provided
    let finalFilename = filename;
    if (!finalFilename) {
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
                       (now.getMonth() + 1).toString().padStart(2, '0') +
                       now.getDate().toString().padStart(2, '0') +
                       now.getHours().toString().padStart(2, '0') +
                       now.getMinutes().toString().padStart(2, '0') +
                       now.getSeconds().toString().padStart(2, '0');
      finalFilename = `capes_export_${timestamp}.bib`;
    }
    
    // Ensure .bib extension
    if (!finalFilename.endsWith('.bib')) {
      finalFilename += '.bib';
    }
    
    const filePath = path.join(targetDir, finalFilename);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, bibTexContent, 'utf8');
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    return {
      file_path: filePath,
      article_count: articles.length,
      file_size_bytes: stats.size,
      created_at: new Date().toISOString()
    };
  }

  private static convertArticleToBibTeX(article: Article): string | null {
    if (!article.title) {
      return null;
    }

    // Generate citation key from title and year
    const titleWords = article.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);
    
    const year = this.extractYear(article.publication_date || '') || 'unknown';
    const citationKey = titleWords.join('') + year;

    const lines: string[] = [];
    
    // Determine entry type
    const entryType = this.getBibTeXType(article.document_type);
    lines.push(`@${entryType}{${citationKey},`);

    // Title (required)
    lines.push(`  title = {${this.escapeBibTeXValue(article.title)}},`);

    // Authors
    if (article.authors && article.authors.length > 0) {
      const authors = article.authors.join(' and ');
      lines.push(`  author = {${this.escapeBibTeXValue(authors)}},`);
    }

    // Journal
    if (article.journal) {
      lines.push(`  journal = {${this.escapeBibTeXValue(article.journal)}},`);
    }

    // Year
    if (year !== 'unknown') {
      lines.push(`  year = {${year}},`);
    }

    // Volume
    if (article.volume) {
      lines.push(`  volume = {${this.escapeBibTeXValue(article.volume)}},`);
    }

    // Number (Issue)
    if (article.issue) {
      lines.push(`  number = {${this.escapeBibTeXValue(article.issue)}},`);
    }

    // Abstract
    if (article.abstract) {
      const cleanAbstract = article.abstract.replace(/<[^>]*>/g, '').trim();
      lines.push(`  abstract = {${this.escapeBibTeXValue(cleanAbstract)}},`);
    }

    // DOI
    if (article.doi) {
      lines.push(`  doi = {${article.doi}},`);
    }

    // URL
    if (article.detail_url) {
      lines.push(`  url = {${article.detail_url}},`);
    }

    // Publisher
    if (article.publisher) {
      lines.push(`  publisher = {${this.escapeBibTeXValue(article.publisher)}},`);
    }

    // Language
    if (article.language) {
      lines.push(`  language = {${this.escapeBibTeXValue(article.language)}},`);
    }

    // Notes
    const notes: string[] = [];
    if (article.is_open_access) {
      notes.push('Open Access');
    }
    if (article.is_peer_reviewed) {
      notes.push('Peer Reviewed');
    }
    if (article.article_id) {
      notes.push(`CAPES ID: ${article.article_id}`);
    }
    if (notes.length > 0) {
      lines.push(`  note = {${this.escapeBibTeXValue(notes.join('; '))}},`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  private static getBibTeXType(documentType?: string): string {
    const typeMapping: Record<string, string> = {
      'Artigo': 'article',
      'Capítulo de livro': 'inbook',
      'Carta': 'article',
      'Errata': 'article',
      'Revisão': 'article'
    };

    return typeMapping[documentType || ''] || 'article';
  }

  private static escapeBibTeXValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#');
  }
}