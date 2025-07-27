# MCP Server - Periódicos CAPES

![NPM Version](https://img.shields.io/npm/v/mcp-periodicos-capes)

MCP server para consulta de periódicos científicos do Portal de Periódicos CAPES.

## 🚀 Instalação Rápida

```bash
# Instalar globalmente via NPM
npm install -g mcp-periodicos-capes

# Exemplo de configuração no Claude Code
claude mcp add capes mcp-capes
```

## 📖 Uso

O servidor fornece duas ferramentas principais:

### 🔍 search_capes

Busca artigos no Portal de Periódicos CAPES.

**Parâmetros:**
- `query` (obrigatório): String de busca
- `max_pages` (opcional): Número máximo de páginas para buscar
- `max_results` (opcional): Número máximo de artigos para retornar
- `full_details` (opcional): Se deve buscar metadados completos (default: false)
- `max_workers` (opcional): Número máximo de workers paralelos (default: 5)
- `timeout` (opcional): Timeout em milissegundos (default: 30000)
- `advanced` (opcional): Usar sintaxe avançada (default: true)

**Exemplos:**

Busca rápida:
```json
{
  "query": "machine learning",
  "max_results": 10
}
```

Busca completa:
```json
{
  "query": "artificial intelligence healthcare",
  "max_pages": 2,
  "full_details": true,
  "max_results": 5
}
```

### 📄 get_article_details

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

## 🛠️ Desenvolvimento

```bash
# Clonar repositório
git clone https://github.com/damarals/mcp-periodicos-capes.git
cd mcp-periodicos-capes

# Instalar dependências
npm install

# Compilar
npm run build

# Executar
npm start
```

## ✨ Recursos

- 🔄 **Busca paralela** para melhor performance
- 📊 **Metadados completos**: título, autores, DOI, abstract, ISSN, etc.
- 🔍 **Busca avançada** com sintaxe especializada
- ⚡ **Modo rápido** (só info básica) vs **completo** (todos os detalhes)
- 🎯 **Controle fino**: timeout, workers, número de resultados
- 🚀 **Fácil instalação** via NPM

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:

- Reportar bugs
- Sugerir melhorias
- Enviar pull requests

## 📄 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.
