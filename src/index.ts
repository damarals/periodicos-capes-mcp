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
import { SearchOptions, DOCUMENT_TYPES, LANGUAGES } from './types.js';

class CAPESMCPServer {
  private server: Server;
  private scraper: CAPESScraper;

  constructor() {
    this.server = new Server(
      {
        name: 'periodicos-capes-mcp',
        version: '1.0.0',
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
          {
            name: 'search_capes',
            description: 'Search for articles in the CAPES Periodicals Portal',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                max_pages: {
                  type: 'number',
                  description: 'Maximum number of pages to search (default: all)',
                  minimum: 1,
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: all found)',
                  minimum: 1,
                },
                full_details: {
                  type: 'boolean',
                  description: 'Whether to fetch full article details (default: false)',
                  default: false,
                },
                max_workers: {
                  type: 'number',
                  description: 'Maximum number of concurrent workers (default: 5)',
                  minimum: 1,
                  maximum: 20,
                  default: 5,
                },
                timeout: {
                  type: 'number',
                  description: 'Request timeout in milliseconds (default: 30000)',
                  minimum: 5000,
                  default: 30000,
                },
                advanced: {
                  type: 'boolean',
                  description: 'Use advanced search syntax (default: true)',
                  default: true,
                },
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
                  description: 'Filter by open access (true = only open access, false = only non-open access, undefined = all)'
                },
                peer_reviewed_only: {
                  type: 'boolean',
                  description: 'Filter by peer review status (true = only peer reviewed, false = only non-peer reviewed, undefined = all)'
                },
                year_min: {
                  type: 'number',
                  description: 'Minimum publication year',
                  minimum: 1800,
                  maximum: 2030
                },
                year_max: {
                  type: 'number',
                  description: 'Maximum publication year',
                  minimum: 1800,
                  maximum: 2030
                },
                languages: {
                  type: 'array',
                  description: 'Filter by languages',
                  items: {
                    type: 'string',
                    enum: LANGUAGES
                  }
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_preview_capes',
            description: 'Get a quick preview of search results without downloading articles (for testing queries)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                timeout: {
                  type: 'number',
                  description: 'Request timeout in milliseconds (default: 30000)',
                  minimum: 5000,
                  default: 30000,
                },
                advanced: {
                  type: 'boolean',
                  description: 'Use advanced search syntax (default: true)',
                  default: true,
                },
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
                  description: 'Filter by open access (true = only open access, false = only non-open access, undefined = all)'
                },
                peer_reviewed_only: {
                  type: 'boolean',
                  description: 'Filter by peer review status (true = only peer reviewed, false = only non-peer reviewed, undefined = all)'
                },
                year_min: {
                  type: 'number',
                  description: 'Minimum publication year',
                  minimum: 1800,
                  maximum: 2030
                },
                year_max: {
                  type: 'number',
                  description: 'Maximum publication year',
                  minimum: 1800,
                  maximum: 2030
                },
                languages: {
                  type: 'array',
                  description: 'Filter by languages',
                  items: {
                    type: 'string',
                    enum: LANGUAGES
                  }
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_article_details',
            description: 'Get detailed metadata for a specific article by ID',
            inputSchema: {
              type: 'object',
              properties: {
                article_id: {
                  type: 'string',
                  description: 'CAPES article ID',
                },
                timeout: {
                  type: 'number',
                  description: 'Request timeout in milliseconds (default: 30000)',
                  minimum: 5000,
                  default: 30000,
                },
              },
              required: ['article_id'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'search_capes') {
          if (!args) {
            throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
          }

          const options: SearchOptions = {
            query: args.query as string,
            max_pages: args.max_pages as number | undefined,
            max_results: args.max_results as number | undefined,
            full_details: (args.full_details as boolean) || false,
            max_workers: (args.max_workers as number) || 5,
            timeout: (args.timeout as number) || 30000,
            advanced: (args.advanced as boolean) !== false,
            document_types: args.document_types as string[] | undefined,
            open_access_only: args.open_access_only as boolean | undefined,
            peer_reviewed_only: args.peer_reviewed_only as boolean | undefined,
            year_min: args.year_min as number | undefined,
            year_max: args.year_max as number | undefined,
            languages: args.languages as string[] | undefined,
          };
          

          if (!options.query || typeof options.query !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Query parameter is required and must be a string'
            );
          }

          const result = await this.scraper.search(options);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        if (name === 'search_preview_capes') {
          if (!args) {
            throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
          }

          const options: SearchOptions = {
            query: args.query as string,
            timeout: (args.timeout as number) || 30000,
            advanced: (args.advanced as boolean) !== false,
            document_types: args.document_types as string[] | undefined,
            open_access_only: args.open_access_only as boolean | undefined,
            peer_reviewed_only: args.peer_reviewed_only as boolean | undefined,
            year_min: args.year_min as number | undefined,
            year_max: args.year_max as number | undefined,
            languages: args.languages as string[] | undefined,
          };

          if (!options.query || typeof options.query !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Query parameter is required and must be a string'
            );
          }

          const result = await this.scraper.searchPreview(options);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        if (name === 'get_article_details') {
          if (!args) {
            throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
          }

          const articleId = args.article_id as string;
          const timeout = (args.timeout as number) || 30000;

          if (!articleId || typeof articleId !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'article_id parameter is required and must be a string'
            );
          }

          const details = await this.scraper.scrapeArticleDetail(articleId, timeout);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(details, null, 2),
              },
            ],
          };
        }

        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        console.error(`Error in ${name}:`, error);
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
    console.error('CAPES MCP server running on stdio');
  }
}

const server = new CAPESMCPServer();
server.run().catch(console.error);