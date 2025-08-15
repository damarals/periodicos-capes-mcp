#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { CAPESScraper } from './scraper.js';
import { SearchOptions, DOCUMENT_TYPES, LANGUAGES, SearchFilters, SortBy, ExportFormat } from './types.js';
import { BibliographicExporter, ExportFileResult } from './bibliographic-exporter.js';

class CAPESMCPServer {
  private server: Server;
  private scraper: CAPESScraper;

  constructor() {
    this.server = new Server(
      {
        name: 'periodicos-capes-mcp',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.scraper = new CAPESScraper();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // NEW FUNCTION 1: Quick preview search
          {
            name: 'preview_search',
            description: 'Quick preview of search results to see total count and sample titles',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                filters: {
                  type: 'object',
                  description: 'Optional filters to apply',
                  properties: {
                    document_types: {
                      type: 'array',
                      description: 'Filter by document types',
                      items: {
                        type: 'string',
                        enum: DOCUMENT_TYPES
                      }
                    },
                    open_access_only: {
                      type: 'boolean',
                      description: 'Filter by open access status'
                    },
                    peer_reviewed_only: {
                      type: 'boolean',
                      description: 'Filter by peer review status'
                    },
                    year_range: {
                      type: 'array',
                      description: 'Year range [min, max]',
                      items: { type: 'number', minimum: 1800, maximum: 2030 },
                      minItems: 2,
                      maxItems: 2
                    },
                    languages: {
                      type: 'array',
                      description: 'Filter by languages',
                      items: {
                        type: 'string',
                        enum: LANGUAGES
                      }
                    }
                  }
                }
              },
              required: ['query'],
            },
          },
          
          // NEW FUNCTION 2: Get articles with pagination and sorting  
          {
            name: 'get_articles',
            description: 'Get a specific batch of articles with full details, pagination, and sorting',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                start_index: {
                  type: 'number',
                  description: 'Starting index for pagination (0-based)',
                  minimum: 0,
                  default: 0
                },
                count: {
                  type: 'number',
                  description: 'Number of articles to return',
                  minimum: 1,
                  maximum: 50,
                  default: 10
                },
                filters: {
                  type: 'object',
                  description: 'Optional filters to apply',
                  properties: {
                    document_types: {
                      type: 'array',
                      description: 'Filter by document types',
                      items: {
                        type: 'string',
                        enum: DOCUMENT_TYPES
                      }
                    },
                    open_access_only: {
                      type: 'boolean',
                      description: 'Filter by open access status'
                    },
                    peer_reviewed_only: {
                      type: 'boolean',
                      description: 'Filter by peer review status'
                    },
                    year_range: {
                      type: 'array',
                      description: 'Year range [min, max]',
                      items: { type: 'number', minimum: 1800, maximum: 2030 },
                      minItems: 2,
                      maxItems: 2
                    },
                    languages: {
                      type: 'array',
                      description: 'Filter by languages',
                      items: {
                        type: 'string',
                        enum: LANGUAGES
                      }
                    }
                  }
                },
                sort_by: {
                  type: 'string',
                  description: 'Sort articles by criteria',
                  enum: ['relevance', 'date_desc', 'date_asc'],
                  default: 'relevance'
                }
              },
              required: ['query'],
            },
          },
          
          // NEW FUNCTION 3: Export search results
          {
            name: 'export_search',
            description: 'Export search results to structured folder with RIS or BibTeX format',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                format: {
                  type: 'string',
                  description: 'Export format',
                  enum: ['ris', 'bibtex'],
                  default: 'ris'
                },
                filters: {
                  type: 'object',
                  description: 'Optional filters to apply',
                  properties: {
                    document_types: {
                      type: 'array',
                      description: 'Filter by document types',
                      items: {
                        type: 'string',
                        enum: DOCUMENT_TYPES
                      }
                    },
                    open_access_only: {
                      type: 'boolean',
                      description: 'Filter by open access status'
                    },
                    peer_reviewed_only: {
                      type: 'boolean',
                      description: 'Filter by peer review status'
                    },
                    year_range: {
                      type: 'array',
                      description: 'Year range [min, max]',
                      items: { type: 'number', minimum: 1800, maximum: 2030 },
                      minItems: 2,
                      maxItems: 2
                    },
                    languages: {
                      type: 'array',
                      description: 'Filter by languages',
                      items: {
                        type: 'string',
                        enum: LANGUAGES
                      }
                    }
                  }
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of articles to export',
                  minimum: 1,
                  maximum: 10000
                }
              },
              required: ['query', 'format'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // NEW FUNCTION 1: Preview Search
        if (name === 'preview_search') {
          if (!args || !args.query) {
            throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
          }

          const query = args.query as string;
          const filters = args.filters as SearchFilters | undefined;

          const result = await this.scraper.searchPreview(query, filters);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // NEW FUNCTION 2: Get Articles
        if (name === 'get_articles') {
          if (!args || !args.query) {
            throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
          }

          const query = args.query as string;
          const startIndex = (args.start_index as number) || 0;
          const count = (args.count as number) || 10;
          const filters = args.filters as SearchFilters | undefined;
          const sortBy = (args.sort_by as SortBy) || 'relevance';

          // Validate parameters
          if (count > 50) {
            throw new McpError(ErrorCode.InvalidParams, 'Count cannot exceed 50 articles per request');
          }

          const result = await this.scraper.getArticles(query, startIndex, count, filters, sortBy);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // NEW FUNCTION 3: Export Search
        if (name === 'export_search') {
          if (!args || !args.query || !args.format) {
            throw new McpError(ErrorCode.InvalidParams, 'Query and format parameters are required');
          }

          const query = args.query as string;
          const format = args.format as ExportFormat;
          const filters = args.filters as SearchFilters | undefined;
          const maxResults = args.max_results as number | undefined;

          // Validate format
          if (format !== 'ris' && format !== 'bibtex') {
            throw new McpError(ErrorCode.InvalidParams, 'Format must be either "ris" or "bibtex"');
          }

          const result = await this.scraper.exportSearch(query, format, filters, maxResults);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new CAPESMCPServer();
server.run().catch(console.error);