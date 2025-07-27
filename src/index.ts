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
import { SearchOptions } from './types.js';

class CAPESMCPServer {
  private server: Server;
  private scraper: CAPESScraper;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-periodicos-capes',
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
            advanced: (args.advanced as boolean) !== false, // default true
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