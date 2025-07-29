<div align="center">
<h1>MCP Server - Periódicos CAPES</h1>
    <a href="https://www.npmjs.com/package/periodicos-capes-mcp"><img src="https://img.shields.io/npm/v/periodicos-capes-mcp" alt="NPM Version" /></a>
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

O MCP Server - Periódicos CAPES implementa o protocolo Model Context Protocol para permitir que modelos de linguagem consultem diretamente o Portal de Periódicos CAPES. Oferece busca paralela, metadados completos, métricas de citação integradas e diferentes modos de operação para otimizar performance conforme necessário.

## Características

- Busca automatizada no Portal CAPES com processamento paralelo
- Métricas integradas: OpenAlex (citações, FWCI) + Qualis (classificação brasileira)
- Filtros por qualidade, ano, tipo de documento, idioma
- Export RIS para gerenciadores de referência
- Preview de busca para testar queries sem baixar dados

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

O servidor fornece quatro ferramentas principais:

### search_capes

Busca artigos no Portal de Periódicos CAPES com opções avançadas de filtragem.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `query` | string | ✓ | - | String de busca |
| `max_pages` | number | ✗ | - | Número máximo de páginas para buscar |
| `max_results` | number | ✗ | - | Número máximo de artigos para retornar |
| `full_details` | boolean | ✗ | `false` | Se deve buscar metadados completos |
| `max_workers` | number | ✗ | `5` | Número máximo de workers paralelos |
| `timeout` | number | ✗ | `30000` | Timeout em milissegundos |
| `advanced` | boolean | ✗ | `true` | Usar sintaxe avançada |
| `document_types` | array | ✗ | - | Filtrar por tipos: 'Artigo', 'Capítulo de livro', 'Carta', 'Errata', 'Revisão' |
| `open_access_only` | boolean | ✗ | - | Filtrar por acesso aberto (true/false/undefined) |
| `peer_reviewed_only` | boolean | ✗ | - | Filtrar por revisão por pares (true/false/undefined) |
| `year_min` | number | ✗ | - | Ano mínimo de publicação (1800-2030) |
| `year_max` | number | ✗ | - | Ano máximo de publicação (1800-2030) |
| `languages` | array | ✗ | - | Filtrar por idiomas: 'Inglês', 'Português', 'Espanhol', 'Francês', 'Alemão', 'Italiano' |
| `include_metrics` | boolean | ✗ | `false` | Incluir métricas OpenAlex e Qualis |

Use `include_metrics: true` para obter métricas de citação (OpenAlex) e classificação Qualis integradas aos resultados.

### search_preview_capes

Obtém uma prévia dos resultados de busca sem baixar os artigos (ideal para testar queries).

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `query` | string | ✓ | - | String de busca |
| `timeout` | number | ✗ | `30000` | Timeout em milissegundos |
| `advanced` | boolean | ✗ | `true` | Usar sintaxe avançada |
| `document_types` | array | ✗ | - | Filtrar por tipos de documento |
| `open_access_only` | boolean | ✗ | - | Filtrar por acesso aberto |
| `peer_reviewed_only` | boolean | ✗ | - | Filtrar por revisão por pares |
| `year_min` | number | ✗ | - | Ano mínimo de publicação |
| `year_max` | number | ✗ | - | Ano máximo de publicação |
| `languages` | array | ✗ | - | Filtrar por idiomas |

### get_article_details

Obtém metadados completos de um artigo específico usando seu ID.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `article_id` | string | ✓ | - | ID do artigo no CAPES |
| `timeout` | number | ✗ | `30000` | Timeout em milissegundos |

### export_to_ris

Exporta resultados para formato RIS compatível com gerenciadores de referência (Zotero, Mendeley) e ferramentas de revisão sistemática (Rayyan).

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `articles` | array | ✓ | - | Array de artigos (resultado do search_capes com full_details: true) |
| `filename` | string | ✗ | auto-gerado | Nome customizado do arquivo |
| `output_dir` | string | ✗ | diretório atual | Diretório de saída |
| `return_content` | boolean | ✗ | `false` | Retornar conteúdo como string |
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

## Contribuindo

Contribuições são sempre bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests. Se encontrar algum problema ou quiser sugerir uma melhoria, não hesite em contribuir.

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
