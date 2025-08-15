<div align="center">
<h1>MCP Server - Periódicos CAPES</h1>
    <a href="https://www.npmjs.com/package/periodicos-capes-mcp"><img src="https://img.shields.io/npm/v/periodicos-capes-mcp" alt="NPM Version" /></a>
    <img src="https://img.shields.io/github/last-commit/damarals/periodicos-capes-mcp/main?path=README.md&label=%C3%BAltima%20atualiza%C3%A7%C3%A3o&color=blue" alt="Latest Update" >
</div>
<br />
<div align="center"><strong>Servidor MCP para Consulta de Periódicos Científicos</strong></div>
<div align="center">Ferramenta otimizada para buscar e analisar artigos científicos do Portal de Periódicos CAPES<br/> através do protocolo Model Context Protocol (MCP).</div>
<br />
<div align="center">
  <sub>Desenvolvido por <a href="https://github.com/damarals">Daniel Amaral</a> 👨‍💻</sub>
</div>
<br />

## ✨ Novidades v3.0.0

**Arquitetura completamente refatorada** para melhor usabilidade com LLMs:

- 🎯 **3 funções especializadas** ao invés de uma monolítica
- 🧠 **Cognitivamente otimizada** para LLMs (máximo 4 parâmetros por função)
- 📊 **Export estruturado** com pasta + metadados para reprodutibilidade
- 📚 **Suporte BibTeX** além do RIS
- ⚡ **Performance otimizada** com preview rápido e paginação eficiente
- 🔄 **Sorting por data** (mais recentes/antigos primeiro)

## Introdução

O MCP Server - Periódicos CAPES implementa o protocolo Model Context Protocol para permitir que modelos de linguagem consultem diretamente o Portal de Periódicos CAPES. Especialmente otimizado para **revisões sistemáticas de literatura (RSL)** e **mapeamentos sistemáticos (MSL)**.

## Características

- 🔍 **Busca no Portal CAPES** (IEEE, ACM, Elsevier, WoS, Scopus, etc.)
- 📈 **Métricas integradas**: OpenAlex (citações, FWCI) + Qualis (classificação brasileira)
- 🎛️ **Filtros avançados**: tipo, acesso aberto, revisão por pares, ano, idioma
- 📤 **Export bibliográfico**: RIS e BibTeX com pasta estruturada
- 🔬 **Reprodutibilidade acadêmica**: metadados completos para compliance
- ⚡ **Otimizada para LLMs**: interfaces cognitivamente simples

## Instalação

```bash
npm install -g periodicos-capes-mcp
```

**Configuração:**

```bash
# Claude Code - adicionar automaticamente
claude mcp add capes periodicos-capes-mcp
```

**Ou configurar manualmente (Claude Code/Desktop):**
```json
{
  "mcpServers": {
    "capes": {
      "command": "periodicos-capes-mcp"
    }
  }
}
```

## Como Usar

O servidor fornece **3 funções especializadas** otimizadas para diferentes workflows acadêmicos:

### 1. `preview_search` - Preview Rápido

Visualização rápida dos resultados para decidir se vale a pena refinar a busca.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `query` | string | ✓ | String de busca |
| `filters` | object | ✗ | Filtros a aplicar (veja seção Filtros) |

**Exemplo:**
```json
{
  "query": "machine learning healthcare",
  "filters": {
    "year_range": [2020, 2024],
    "document_types": ["Artigo"],
    "open_access_only": true
  }
}
```

**Resposta:**
```json
{
  "query": "machine learning healthcare",
  "total_found": 2847,
  "sample_titles": [
    "Machine Learning Applications in Healthcare...",
    "Deep Learning for Medical Diagnosis...",
    "AI in Clinical Decision Support Systems..."
  ],
  "filters_applied": { ... }
}
```

### 2. `get_articles` - Busca Paginada com Sorting

Obtenha lotes específicos de artigos com metadados completos para análise detalhada.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `query` | string | ✓ | - | String de busca |
| `start_index` | number | ✗ | `0` | Índice inicial (0-based) |
| `count` | number | ✗ | `10` | Número de artigos (máx 50) |
| `filters` | object | ✗ | - | Filtros a aplicar |
| `sort_by` | string | ✗ | `"relevance"` | Ordenação: `"relevance"`, `"date_desc"`, `"date_asc"` |

**Exemplo:**
```json
{
  "query": "artificial intelligence medical",
  "start_index": 0,
  "count": 20,
  "sort_by": "date_desc",
  "filters": {
    "year_range": [2023, 2024],
    "open_access_only": true
  }
}
```

### 3. `export_search` - Export para Gerenciadores de Referência

Exporte resultados para pasta estruturada com arquivo bibliográfico + metadados.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `query` | string | ✓ | - | String de busca |
| `format` | string | ✓ | - | Formato: `"ris"` ou `"bibtex"` |
| `filters` | object | ✗ | - | Filtros a aplicar |
| `max_results` | number | ✗ | - | Máximo de artigos a exportar |

**Exemplo:**
```json
{
  "query": "systematic review machine learning",
  "format": "ris",
  "max_results": 500,
  "filters": {
    "year_range": [2020, 2024],
    "document_types": ["Artigo", "Revisão"]
  }
}
```

**Resultado:**
```
capes_export_2025-01-15T14-30-52/
├── metadata.json          ← Metadados completos para reprodutibilidade
└── capes_export_143052.ris ← Arquivo para import no Zotero/Mendeley
```

## Filtros Disponíveis

Todos os filtros são opcionais e podem ser combinados:

```json
{
  "filters": {
    "document_types": ["Artigo", "Capítulo de livro", "Carta", "Errata", "Revisão"],
    "open_access_only": true,  // true=só aberto, false=só fechado, undefined=todos
    "peer_reviewed_only": true, // true=só revisado, false=só não-revisado, undefined=todos
    "year_range": [2020, 2024], // [ano_min, ano_max]
    "languages": ["Inglês", "Português", "Espanhol", "Francês", "Alemão", "Italiano"]
  }
}
```

## Workflows Acadêmicos

### Revisão Sistemática de Literatura (RSL)

```bash
# 1. Exploração inicial
preview_search("machine learning AND healthcare")
# → "Encontrado 15.000 artigos. Precisa refinar?"

# 2. Refinamento com filtros
preview_search("machine learning AND healthcare", {
  "year_range": [2020, 2024],
  "open_access_only": true,
  "document_types": ["Artigo"]
})
# → "Agora são 2.500 artigos. Melhor!"

# 3. Análise de amostra
get_articles("machine learning AND healthcare", 0, 20, filters, "date_desc")
# → Analisa os 20 mais recentes

# 4. Export completo para Zotero
export_search("machine learning AND healthcare", "ris", filters, 500)
# → Pasta estruturada com 500 artigos + metadados
```

### Mapeamento Sistemático (MSL)

```bash
# 1. Vários previews para múltiplos termos
preview_search("blockchain AND supply chain")
preview_search("distributed ledger AND logistics") 
# → Entende escopo de diferentes termos

# 2. Export agregado
export_search("(blockchain OR distributed ledger) AND (supply chain OR logistics)", 
              "bibtex", filters, 1000)
# → Grande dataset para análise quantitativa
```

## Reprodutibilidade Acadêmica

Cada export gera `metadata.json` com informações completas:

```json
{
  "search_metadata": {
    "query": "(machine learning) AND (healthcare)",
    "total_found": 2847,
    "search_date": "2025-01-15T14:30:52.000Z",
    "filters_applied": { ... },
    "capes_portal_info": "Portal de Periódicos CAPES (IEEE, ACM, Elsevier, WoS, Scopus, etc.)",
    "tool_version": "3.0.0"
  },
  "usage_notes": {
    "import_to_zotero": "Import the .ris file directly into Zotero",
    "reproducibility": "This metadata.json contains all search parameters for exact reproduction"
  }
}
```

**Ideal para protocolos PROSPERO e compliance de journals!**

## Desenvolvimento

```bash
# Clonar repositório
git clone https://github.com/damarals/periodicos-capes-mcp.git
cd periodicos-capes-mcp

# Instalar dependências
npm install

# Compilar
npm run build

# Executar
npm start
```

## Migração da v2.x

A v3.0.0 introduz **breaking changes** com arquitetura completamente nova:

| v2.x | v3.0.0 | Benefício |
|------|--------|-----------|
| `search_capes` (16 parâmetros) | `preview_search` + `get_articles` + `export_search` | Simplicidade cognitiva para LLMs |
| Filtros como parâmetros separados | Objeto `filters` consolidado | Menos confusão de parâmetros |
| Export inline (tokens) | Export para pasta estruturada | Zero consumo de tokens |
| Só RIS | RIS + BibTeX | Compatibilidade LaTeX |

## Contribuindo

Contribuições são sempre bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests. Se encontrar algum problema ou quiser sugerir uma melhoria, não hesite em contribuir.

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.