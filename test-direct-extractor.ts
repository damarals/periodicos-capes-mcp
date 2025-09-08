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
}

class CAPESDirectExtractor {
  private htmlsDir: string;

  constructor(htmlsDir: string = './htmls') {
    this.htmlsDir = htmlsDir;
  }

  /**
   * Extração DIRETA - sem fallbacks, baseada na estrutura real das páginas
   */
  private extractFromArticlePage(html: string, filename: string): ExtractedData {
    const $ = cheerio.load(html);
    console.log(`\n📄 Extraindo dados DIRETOS de: ${filename}`);

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
    };

    // 1. Título - meta tag direta
    data.title = $('meta[name="title"]').attr('content') || $('title').text().trim();
    console.log(`📝 Título: ${data.title ? '✅' : '❌'} ${data.title.substring(0, 50)}...`);

    // 2. Abstract - meta tag direta (SEM fallbacks)
    data.abstract = $('meta[name="abstract"]').attr('content') || null;
    console.log(`📄 Abstract: ${data.abstract ? '✅' : '❌'} ${data.abstract ? 'Encontrado (' + data.abstract.length + ' chars)' : 'não encontrado'}`);

    // 3. DOI - primeiro parágrafo específico (SEM fallbacks)
    data.doi = $('p.small.text-muted.mb-3.block').first().text().trim() || null;
    // Limpa o DOI se necessário
    if (data.doi && data.doi.startsWith('10.')) {
      // Mantém apenas a parte do DOI
      const doiMatch = data.doi.match(/(10\.\d{4,}\/[^\s]+)/);
      data.doi = doiMatch ? doiMatch[1] : data.doi;
    }
    console.log(`🔗 DOI: ${data.doi ? '✅' : '❌'} ${data.doi || 'não encontrado'}`);

    // 4. Autores - seletor específico (SEM fallbacks)
    $('a.view-autor.fst-italic').each((i, el) => {
      const author = $(el).text().trim();
      if (author) {
        data.authors.push(author);
      }
    });
    console.log(`👥 Autores: ${data.authors.length ? '✅' : '❌'} ${data.authors.join(', ')}`);

    // 5. Ano - ID específico (SEM fallbacks)
    const yearText = $('#item-ano').text();
    const yearMatch = yearText.match(/(\d{4})/);
    data.year = yearMatch ? parseInt(yearMatch[1]) : null;
    console.log(`📅 Ano: ${data.year ? '✅' : '❌'} ${data.year || 'não encontrado'}`);

    // 6. Volume - ID específico (SEM fallbacks)
    const volumeText = $('#item-volume').text();
    data.volume = volumeText.replace(/Volume:\s*/, '').replace(/[;\s]*$/, '').trim() || null;
    console.log(`📚 Volume: ${data.volume ? '✅' : '❌'} ${data.volume || 'não encontrado'}`);

    // 7. Issue - ID específico (SEM fallbacks)  
    const issueText = $('#item-issue').text();
    data.issue = issueText.replace(/Issue:\s*/, '').replace(/[;\s]*$/, '').trim() || null;
    console.log(`📖 Issue: ${data.issue ? '✅' : '❌'} ${data.issue || 'não encontrado'}`);

    // 8. ISSN - estrutura específica (SEM fallbacks)
    const issnElement = $('strong:contains("ISSN")').next('p.text-muted.mb-3.block');
    data.issn = issnElement.text().trim() || null;
    console.log(`🔢 ISSN: ${data.issn ? '✅' : '❌'} ${data.issn || 'não encontrado'}`);

    // 9. Language - ID específico (SEM fallbacks)
    const languageText = $('#item-language').text();
    data.language = languageText.replace(/Linguagem:\s*/, '').replace(/[;\s]*$/, '').trim() || null;
    console.log(`🌐 Idioma: ${data.language ? '✅' : '❌'} ${data.language || 'não encontrado'}`);

    // 10. Publisher - ID específico (SEM fallbacks)
    const publisherText = $('#item-instituicao').text();
    data.publisher = publisherText.replace(/[;\s]*$/, '').trim() || null;
    console.log(`🏢 Publisher: ${data.publisher ? '✅' : '❌'} ${data.publisher || 'não encontrado'}`);

    // 11. Journal - não tem seletor específico nas páginas individuais
    data.journal = null; // Será obtido da listagem
    console.log(`📑 Journal: ❌ (obtido da listagem)`);

    // 12. Open Access & Peer Review - texto específico
    data.is_open_access = $('*:contains("Acesso aberto")').length > 0;
    data.is_peer_reviewed = $('*:contains("Revisado por pares")').length > 0;
    console.log(`🔓 Open Access: ${data.is_open_access ? '✅' : '❌'}`);
    console.log(`👨‍🔬 Peer Review: ${data.is_peer_reviewed ? '✅' : '❌'}`);

    return data;
  }

  /**
   * Gera RIS com dados extraídos de forma direta
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
   * Testa extração direta
   */
  async testDirectExtraction(): Promise<void> {
    console.log('🎯 Iniciando teste de extração DIRETA (sem fallbacks)...\n');
    
    const files = fs.readdirSync(this.htmlsDir)
      .filter(f => f.endsWith('.html') && !f.includes('Buscar assunto'));
    
    const results: ExtractedData[] = [];
    let risOutput = '';

    for (const file of files) {
      const filePath = path.join(this.htmlsDir, file);
      const html = fs.readFileSync(filePath, 'utf-8');
      
      const data = this.extractFromArticlePage(html, file);
      results.push(data);
      
      // Gera ID do artigo a partir do nome do arquivo
      const articleId = file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
      risOutput += this.generateRIS(data, articleId);
    }

    // Salva RIS direto
    const outputFile = './direct_corrected_export.ris';
    fs.writeFileSync(outputFile, risOutput);
    console.log(`\n✅ RIS DIRETO salvo em: ${outputFile}`);
    
    // Relatório de eficácia dos seletores diretos
    console.log('\n📊 RELATÓRIO SELETORES DIRETOS:');
    console.log(`Total de papers processados: ${results.length}`);
    
    const stats = {
      titulo: results.filter(r => r.title).length,
      autores: results.filter(r => r.authors.length > 0).length,
      abstract: results.filter(r => r.abstract).length,
      doi: results.filter(r => r.doi).length,
      ano: results.filter(r => r.year).length,
      volume: results.filter(r => r.volume).length,
      issue: results.filter(r => r.issue).length,
      issn: results.filter(r => r.issn).length,
      language: results.filter(r => r.language).length,
      publisher: results.filter(r => r.publisher).length
    };
    
    Object.entries(stats).forEach(([field, count]) => {
      const percentage = ((count / results.length) * 100).toFixed(1);
      const status = count === results.length ? '✅' : count > 0 ? '⚠️' : '❌';
      console.log(`${status} ${field}: ${count}/${results.length} (${percentage}%)`);
    });
    
    // Identifica problemas específicos
    const problemas = results.filter(r => !r.abstract || !r.doi || !r.authors.length);
    if (problemas.length > 0) {
      console.log(`\n⚠️  ${problemas.length} papers com problemas nos seletores diretos`);
    } else {
      console.log(`\n🎉 Todos os seletores diretos funcionaram perfeitamente!`);
    }
  }
}

// Execução do teste direto
async function main() {
  try {
    const extractor = new CAPESDirectExtractor('./htmls');
    await extractor.testDirectExtraction();
  } catch (error) {
    console.error('❌ Erro durante o teste direto:', error);
    process.exit(1);
  }
}

main();