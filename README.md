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
- Export RIS integrado com economia de tokens
- Modo de metadados apenas para otimização de performance

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

O servidor fornece duas ferramentas principais:

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
| `export_ris` | boolean | ✗ | `false` | Exportar resultados para arquivo RIS |
| `ris_output_dir` | string | ✗ | diretório atual | Diretório de saída do arquivo RIS |
| `ris_return_content` | boolean | ✗ | `false` | Incluir conteúdo RIS na resposta |
| `show_metadata_only` | boolean | ✗ | `false` | Retornar apenas metadados para economizar tokens |

**Funcionalidades Integradas:**

- **Export RIS Integrado**: Use `export_ris: true` para exportar automaticamente os resultados para formato RIS durante a busca
- **Economia de Tokens**: Use `show_metadata_only: true` para retornar apenas metadados (total_found, query, etc.) sem os artigos completos
- **Combinação Perfeita**: `export_ris: true` + `show_metadata_only: true` = exporta arquivo RIS + retorna apenas metadados da operação

Use `include_metrics: true` para obter métricas de citação (OpenAlex) e classificação Qualis integradas aos resultados.

**Exemplo Completo:**
```json
{
  "query": "machine learning wildfires",
  "max_results": 10,
  "full_details": true,
  "export_ris": true,
  "show_metadata_only": true,
  "year_min": 2020,
  "document_types": ["Artigo"],
  "open_access_only": true
}
```

**💡 Dica:** Para preview rápido dos resultados sem baixar artigos completos, use `show_metadata_only: true`.

### get_article_details

Obtém metadados completos de um artigo específico usando seu ID.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `article_id` | string | ✓ | - | ID do artigo no CAPES |
| `timeout` | number | ✗ | `30000` | Timeout em milissegundos |

**💡 Exportação RIS:** A funcionalidade de export RIS foi integrada diretamente ao `search_capes`. Use `export_ris: true` para exportar automaticamente durante a busca.
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
