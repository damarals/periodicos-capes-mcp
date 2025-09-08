#!/usr/bin/env tsx

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedData {
  title: string;
  authors: string[];
  year: number | null;
  volume: string | null;
  issue: string | null;
  abstract: string | null;
  doi: string | null;
  issn: string | null;
  language: string | null;
  publisher: string | null;
  journal: string | null;
  is_open_access: boolean;
  is_peer_reviewed: boolean;
  pages: { start: string | null; end: string | null };
}

class CAPESTestExtractor {
  private htmlsDir: string;

  constructor(htmlsDir: string = './htmls') {
    this.htmlsDir = htmlsDir;
  }

  /**
   * Extrai dados da página de listagem (JSON estruturado + HTML)
   */
  private extractFromListing(html: string): Record<string, ExtractedData> {
    const $ = cheerio.load(html);
    const results: Record<string, ExtractedData> = {};

    console.log('🔍 Procurando por dados JSON estruturados na listagem...');
    
    // Procura por JavaScript com dados estruturados
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      
      // Procura por objetos com estrutura de artigo
      const articleMatches = scriptContent.match(/\{[^}]*title[^}]*\}/g);
      if (articleMatches) {
        console.log(`📋 Encontrados ${articleMatches.length} possíveis artigos em JavaScript`);
      }

      // Procura por arrays com metadados
      if (scriptContent.includes('authors') && scriptContent.includes('doi')) {
        console.log('✅ Dados estruturados encontrados em JavaScript');
        
        // Tenta extrair dados estruturados - exemplo básico
        const titleMatch = scriptContent.match(/"title":\s*"([^"]+)"/g);
        const authorMatch = scriptContent.match(/"authors":\s*"([^"]+)"/g);
        const doiMatch = scriptContent.match(/"doi":\s*"([^"]+)"/g);
        const yearMatch = scriptContent.match(/"year":\s*"?(\d{4})"?/g);
        
        console.log(`Found titles: ${titleMatch?.length || 0}`);
        console.log(`Found authors: ${authorMatch?.length || 0}`);
        console.log(`Found DOIs: ${doiMatch?.length || 0}`);
        console.log(`Found years: ${yearMatch?.length || 0}`);
      }
    });

    return results;
  }

  /**
   * Extrai metadados completos de uma página individual de artigo
   */
  private extractFromArticlePage(html: string, filename: string): ExtractedData {
    const $ = cheerio.load(html);
    console.log(`\n📄 Extraindo dados de: ${filename}`);

    const data: ExtractedData = {
      title: '',
      authors: [],
      year: null,
      volume: null,
      issue: null,
      abstract: null,
      doi: null,
      issn: null,
      language: null,
      publisher: null,
      journal: null,
      is_open_access: false,
      is_peer_reviewed: false,
      pages: { start: null, end: null }
    };

    // 1. Título - múltiplas fontes
    data.title = $('meta[name="title"]').attr('content') || 
                 $('title').text().trim() || 
                 $('h1').first().text().trim();
    console.log(`📝 Título: ${data.title ? '✅' : '❌'} ${data.title.substring(0, 50)}...`);

    // 2. Abstract - múltiplas fontes
    data.abstract = $('meta[name="abstract"]').attr('content') || 
                   $('meta[name="description"]').attr('content') ||
                   $('#item-resumo').text().trim() ||
                   $('.resumo').text().trim();
    console.log(`📄 Abstract: ${data.abstract ? '✅' : '❌'} ${data.abstract ? data.abstract.substring(0, 100) + '...' : 'não encontrado'}`);

    // 3. DOI - múltiplas estratégias
    data.doi = this.extractDOI($);
    console.log(`🔗 DOI: ${data.doi ? '✅' : '❌'} ${data.doi || 'não encontrado'}`);

    // 4. Autores - múltiplas estratégias
    data.authors = this.extractAuthors($);
    console.log(`👥 Autores: ${data.authors.length ? '✅' : '❌'} ${data.authors.join(', ')}`);

    // 5. Ano - múltiplas estratégias
    data.year = this.extractYear($);
    console.log(`📅 Ano: ${data.year ? '✅' : '❌'} ${data.year || 'não encontrado'}`);

    // 6. Volume e Issue - múltiplas estratégias
    const volIssue = this.extractVolumeIssue($);
    data.volume = volIssue.volume;
    data.issue = volIssue.issue;
    console.log(`📚 Volume/Issue: ${data.volume || data.issue ? '✅' : '❌'} Vol:${data.volume || 'N/A'} Issue:${data.issue || 'N/A'}`);

    // 7. ISSN
    data.issn = this.extractISSN($);
    console.log(`🔢 ISSN: ${data.issn ? '✅' : '❌'} ${data.issn || 'não encontrado'}`);

    // 8. Journal
    data.journal = this.extractJournal($);
    console.log(`📑 Journal: ${data.journal ? '✅' : '❌'} ${data.journal || 'não encontrado'}`);

    // 9. Publisher
    data.publisher = this.extractPublisher($);
    console.log(`🏢 Publisher: ${data.publisher ? '✅' : '❌'} ${data.publisher || 'não encontrado'}`);

    // 10. Language
    data.language = this.extractLanguage($);
    console.log(`🌐 Idioma: ${data.language ? '✅' : '❌'} ${data.language || 'não encontrado'}`);

    // 11. Open Access & Peer Review
    data.is_open_access = this.extractOpenAccess($);
    data.is_peer_reviewed = this.extractPeerReview($);
    console.log(`🔓 Open Access: ${data.is_open_access ? '✅' : '❌'}`);
    console.log(`👨‍🔬 Peer Review: ${data.is_peer_reviewed ? '✅' : '❌'}`);

    return data;
  }

  private extractDOI($: cheerio.CheerioAPI): string | null {
    // Estratégia 1: Links diretos para DOI
    const doiLink = $('a[href*="doi.org"]').attr('href');
    if (doiLink) {
      const match = doiLink.match(/(?:doi\.org\/)?(10\.\d{4,}\/[^\s]+)/);
      return match ? match[1] : null;
    }

    // Estratégia 2: Texto contendo DOI
    const doiText = $('*').contents().filter(function() {
      return this.nodeType === 3; // Text node
    }).text();
    const doiMatch = doiText.match(/10\.\d{4,}\/[^\s\)]+/);
    return doiMatch ? doiMatch[0] : null;
  }

  private extractAuthors($: cheerio.CheerioAPI): string[] {
    const authors: string[] = [];
    
    // Estratégia 1: Links de autores
    $('.view-autor, a.view-autor').each((i, el) => {
      const author = $(el).text().trim();
      if (author && !authors.includes(author)) {
        authors.push(author);
      }
    });

    // Estratégia 2: Seção específica de autores
    $('.authors, .autor, .autores').find('a, span').each((i, el) => {
      const author = $(el).text().trim();
      if (author && !authors.includes(author)) {
        authors.push(author);
      }
    });

    // Estratégia 3: JavaScript data
    $('script').each((i, script) => {
      const content = $(script).html() || '';
      const authorMatches = content.match(/"authors?":\s*"([^"]+)"/g);
      if (authorMatches) {
        authorMatches.forEach(match => {
          const authorsStr = match.match(/"([^"]+)"$/)?.[1];
          if (authorsStr) {
            const scriptAuthors = authorsStr.split(/[,;]/).map(a => a.trim());
            scriptAuthors.forEach(author => {
              if (author && !authors.includes(author)) {
                authors.push(author);
              }
            });
          }
        });
      }
    });

    return authors;
  }

  private extractYear($: cheerio.CheerioAPI): number | null {
    // Estratégia 1: JavaScript data
    let year: number | null = null;
    $('script').each((i, script) => {
      const content = $(script).html() || '';
      const yearMatch = content.match(/"year":\s*"?(\d{4})"?/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
        return false; // break
      }
    });
    
    if (year) return year;

    // Estratégia 2: Elementos HTML
    const yearText = $('#item-ano, .ano, .year').text();
    const yearMatch = yearText.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
  }

  private extractVolumeIssue($: cheerio.CheerioAPI): { volume: string | null; issue: string | null } {
    let volume: string | null = null;
    let issue: string | null = null;

    // Estratégia 1: JavaScript data
    $('script').each((i, script) => {
      const content = $(script).html() || '';
      const volMatch = content.match(/"volume":\s*"?([^",]+)"?/);
      const issMatch = content.match(/"issue":\s*"?([^",]+)"?/);
      
      if (volMatch) volume = volMatch[1].trim();
      if (issMatch) issue = issMatch[1].trim();
    });

    if (volume || issue) return { volume, issue };

    // Estratégia 2: Texto descritivo
    const volIssueText = $('.small, .text-muted, p').text();
    const volMatch = volIssueText.match(/Volume:\s*([^;,\n]+)/i);
    const issMatch = volIssueText.match(/Issue:\s*(\d+)/i);
    
    if (volMatch) volume = volMatch[1].trim();
    if (issMatch) issue = issMatch[1].trim();

    return { volume, issue };
  }

  private extractISSN($: cheerio.CheerioAPI): string | null {
    // Estratégia 1: Label específico
    const issnElement = $('strong:contains("ISSN"), label:contains("ISSN")').next();
    if (issnElement.length) {
      return issnElement.text().trim() || null;
    }

    // Estratégia 2: JavaScript data
    let issn: string | null = null;
    $('script').each((i, script) => {
      const content = $(script).html() || '';
      const issnMatch = content.match(/"issn":\s*"([^"]+)"/);
      if (issnMatch) {
        issn = issnMatch[1];
        return false;
      }
    });

    return issn;
  }

  private extractJournal($: cheerio.CheerioAPI): string | null {
    return $('.journal, #journal').text().trim() || 
           $('meta[name="citation_journal_title"]').attr('content') ||
           null;
  }

  private extractPublisher($: cheerio.CheerioAPI): string | null {
    return $('#item-instituicao, .publisher, .editora').text().trim() || null;
  }

  private extractLanguage($: cheerio.CheerioAPI): string | null {
    const langText = $('.small, .text-muted, p').text();
    const langMatch = langText.match(/Linguagem:\s*([^\n\r;]+)/);
    return langMatch ? langMatch[1].trim() : null;
  }

  private extractOpenAccess($: cheerio.CheerioAPI): boolean {
    return $('.text-green-cool-vivid-50, .open-access').length > 0 ||
           $('*:contains("Acesso aberto")').length > 0;
  }

  private extractPeerReview($: cheerio.CheerioAPI): boolean {
    return $('.text-violet-50, .peer-review').length > 0 ||
           $('*:contains("Revisado por pares")').length > 0;
  }

  /**
   * Gera RIS corrigido com os dados extraídos
   */
  private generateRIS(data: ExtractedData, articleId: string): string {
    let ris = 'TY  - JOUR\n';
    
    if (data.title) {
      ris += `TI  - ${data.title}\n`;
    }
    
    data.authors.forEach(author => {
      ris += `AU  - ${author}\n`;
    });
    
    if (data.year) {
      ris += `PY  - ${data.year}\n`;
    }
    
    if (data.journal) {
      ris += `T2  - ${data.journal}\n`;
      ris += `JF  - ${data.journal}\n`;
    }
    
    if (data.volume) {
      ris += `VL  - ${data.volume}\n`;
    }
    
    if (data.issue) {
      ris += `IS  - ${data.issue}\n`;
    }
    
    if (data.abstract) {
      ris += `AB  - ${data.abstract}\n`;
    }
    
    if (data.doi) {
      ris += `DO  - ${data.doi}\n`;
    }
    
    if (data.issn) {
      ris += `SN  - ${data.issn}\n`;
    }
    
    if (data.publisher) {
      ris += `PB  - ${data.publisher}\n`;
    }
    
    if (data.language) {
      ris += `LA  - ${data.language}\n`;
    }
    
    ris += `UR  - https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=all&id=${articleId}\n`;
    ris += `KW  - bayesian wildfire spatial\n`;
    
    const notes = [];
    if (data.is_open_access) notes.push('Open Access');
    if (data.is_peer_reviewed) notes.push('Peer Reviewed');
    notes.push(`CAPES ID: ${articleId}`);
    
    ris += `N1  - ${notes.join('; ')}\n`;
    ris += `ER  - \n\n`;
    
    return ris;
  }

  /**
   * Testa a extração com os HTMLs salvos
   */
  async testExtraction(): Promise<void> {
    console.log('🧪 Iniciando teste de extração com HTMLs salvos...\n');
    
    const files = fs.readdirSync(this.htmlsDir).filter(f => f.endsWith('.html'));
    const results: ExtractedData[] = [];
    let risOutput = '';

    // Processa página de listagem se disponível
    const listingFile = files.find(f => f.includes('Buscar assunto'));
    if (listingFile) {
      console.log('📋 Processando página de listagem...');
      const listingHtml = fs.readFileSync(path.join(this.htmlsDir, listingFile), 'utf-8');
      this.extractFromListing(listingHtml);
    }

    // Processa páginas individuais
    const paperFiles = files.filter(f => !f.includes('Buscar assunto'));
    
    for (const file of paperFiles) {
      const filePath = path.join(this.htmlsDir, file);
      const html = fs.readFileSync(filePath, 'utf-8');
      
      const data = this.extractFromArticlePage(html, file);
      results.push(data);
      
      // Gera ID do artigo a partir do nome do arquivo (simulado)
      const articleId = file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
      risOutput += this.generateRIS(data, articleId);
    }

    // Salva RIS corrigido
    const outputFile = './corrected_export.ris';
    fs.writeFileSync(outputFile, risOutput);
    console.log(`\n✅ RIS corrigido salvo em: ${outputFile}`);
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL:');
    console.log(`Total de papers processados: ${results.length}`);
    console.log(`Papers com título: ${results.filter(r => r.title).length}`);
    console.log(`Papers com autores: ${results.filter(r => r.authors.length > 0).length}`);
    console.log(`Papers com abstract: ${results.filter(r => r.abstract).length}`);
    console.log(`Papers com DOI: ${results.filter(r => r.doi).length}`);
    console.log(`Papers com ano: ${results.filter(r => r.year).length}`);
    console.log(`Papers com volume: ${results.filter(r => r.volume).length}`);
    console.log(`Papers com ISSN: ${results.filter(r => r.issn).length}`);
  }
}

// Execução do teste
async function main() {
  try {
    const extractor = new CAPESTestExtractor('./htmls');
    await extractor.testExtraction();
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    process.exit(1);
  }
}

// Executa o teste
main();

export { CAPESTestExtractor };