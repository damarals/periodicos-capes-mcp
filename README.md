<div align="center">
<h1>MCP Server - Periódicos CAPES</h1>
    <img src="https://img.shields.io/npm/v/periodicos-capes-mcp" alt="NPM Version" />
    <img src="https://img.shields.io/github/last-commit/damarals/periodicos-capes-mcp/main?path=README.md&label=%C3%BAltima%20atualiza%C3%A7%C3%A3o&color=blue" alt="Latest Update" >
</div>
<br />
<div align="center"><strong>Servidor MCP para Consulta de Periódicos Científicos</strong></div>
<div align="center">Uma ferramenta para buscar e analisar artigos científicos do Portal de Periódicos CAPES<br/> através do protocolo Model Context Protocol (MCP).</div>
<br />
<div align="center">
  <sub>Desenvolvido por <a href="https://github.com/damarals">Daniel Amaral</a> 👨‍💻</sub>
</div>
<br />

## Introdução

O MCP Server - Periódicos CAPES é uma aplicação que implementa o protocolo Model Context Protocol para permitir que modelos de linguagem consultem diretamente o Portal de Periódicos CAPES. Oferece busca paralela, metadados completos e diferentes modos de operação para otimizar performance e detalhamento conforme necessário.

## Instalação Rápida

```bash
# Instalar globalmente via NPM
npm install -g periodicos-capes-mcp

# Exemplo de configuração no Claude Code
claude mcp add capes periodicos-capes-mcp
```

## Como Usar

O servidor fornece três ferramentas principais:

### search_capes

Busca artigos no Portal de Periódicos CAPES com opções avançadas de filtragem.

**Parâmetros:**
- `query` (obrigatório): String de busca
- `max_pages` (opcional): Número máximo de páginas para buscar
- `max_results` (opcional): Número máximo de artigos para retornar
- `full_details` (opcional): Se deve buscar metadados completos (default: false)
- `max_workers` (opcional): Número máximo de workers paralelos (default: 5)
- `timeout` (opcional): Timeout em milissegundos (default: 30000)
- `advanced` (opcional): Usar sintaxe avançada (default: true)
- `document_types` (opcional): Filtrar por tipos de documento ('Artigo', 'Capítulo de livro', 'Carta', 'Errata', 'Revisão')
- `open_access_only` (opcional): Filtrar por acesso aberto (true/false/undefined)
- `peer_reviewed_only` (opcional): Filtrar por revisão por pares (true/false/undefined)
- `year_min` (opcional): Ano mínimo de publicação (1800-2030)
- `year_max` (opcional): Ano máximo de publicação (1800-2030)
- `languages` (opcional): Filtrar por idiomas ('Inglês', 'Português', 'Espanhol', 'Francês', 'Alemão', 'Italiano')

**Exemplos:**

Busca rápida:
```json
{
  "query": "machine learning",
  "max_results": 10
}
```

Busca completa com filtros:
```json
{
  "query": "artificial intelligence healthcare",
  "max_pages": 2,
  "full_details": true,
  "max_results": 5,
  "document_types": ["Artigo"],
  "open_access_only": true,
  "year_min": 2020,
  "languages": ["Inglês", "Português"]
}
```

### search_preview_capes

Obtém uma prévia dos resultados de busca sem baixar os artigos (ideal para testar queries).

**Parâmetros:**
- `query` (obrigatório): String de busca
- `timeout` (opcional): Timeout em milissegundos (default: 30000)
- `advanced` (opcional): Usar sintaxe avançada (default: true)
- `document_types` (opcional): Filtrar por tipos de documento
- `open_access_only` (opcional): Filtrar por acesso aberto
- `peer_reviewed_only` (opcional): Filtrar por revisão por pares
- `year_min` (opcional): Ano mínimo de publicação
- `year_max` (opcional): Ano máximo de publicação
- `languages` (opcional): Filtrar por idiomas

**Exemplo:**
```json
{
  "query": "machine learning",
  "document_types": ["Artigo"],
  "year_min": 2020
}
```

### get_article_details

Obtém detalhes completos de um artigo específico pelo ID.

**Parâmetros:**
- `article_id` (obrigatório): ID do artigo no CAPES
- `timeout` (opcional): Timeout em milissegundos (default: 30000)

**Exemplo:**
```json
{
  "article_id": "WB1000000000211010"
}
```

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

## Características

- Consulta automatizada de artigos científicos no Portal de Periódicos CAPES
- Busca paralela para melhor performance com controle de workers
- Sistema de busca com sintaxe avançada ou simples
- Preview de busca para testar queries rapidamente sem baixar dados
- Filtros avançados: tipo de documento, acesso aberto, revisão por pares, ano, idioma
- Extração de metadados completos: título, autores, DOI, abstract, ISSN, etc.
- Modo rápido (informações básicas) vs modo completo (detalhes extensos)
- Controle fino de parâmetros: timeout, número de resultados, páginas
- Integração nativa com o protocolo MCP para modelos de linguagem
- Fácil instalação e configuração via NPM

## Contribuindo

Contribuições são sempre bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests. Se encontrar algum problema ou quiser sugerir uma melhoria, não hesite em contribuir.

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
