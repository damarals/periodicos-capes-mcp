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
import { RISExporter, RISExportResult } from './ris-exporter.js';

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
                include_metrics: {
                  type: 'boolean',
                  description: 'Include citation and journal quality metrics (OpenAlex + Qualis) (default: false)',
                  default: false,
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
                export_ris: {
                  type: 'boolean',
                  description: 'Export results to RIS bibliographic format file (default: false)',
                  default: false
                },
                ris_output_dir: {
                  type: 'string',
                  description: 'Output directory for RIS file when export_ris is true (default: current working directory)'
                },
                ris_return_content: {
                  type: 'boolean',
                  description: 'Include RIS content in response when export_ris is true (default: false)',
                  default: false
                },
                show_metadata_only: {
                  type: 'boolean',
                  description: 'Return only search metadata without articles content to save tokens (default: false)',
                  default: false
                }
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

          const exportRis = (args.export_ris as boolean) || false;
          const risOutputDir = args.ris_output_dir as string | undefined;
          const risReturnContent = (args.ris_return_content as boolean) || false;
          const showMetadataOnly = (args.show_metadata_only as boolean) || false;
          
          const options: SearchOptions = {
            query: args.query as string,
            max_pages: args.max_pages as number | undefined,
            max_results: args.max_results as number | undefined,
            // Force full_details if export_ris is true (needed for RIS export)
            // Force full_details if export_ris is true (needed for RIS export)
            full_details: (args.full_details as boolean) || exportRis,
            max_workers: (args.max_workers as number) || 5,
            timeout: (args.timeout as number) || 30000,
            advanced: (args.advanced as boolean) !== false,
            include_metrics: (args.include_metrics as boolean) || false,
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

          // Handle RIS export if requested
          if (exportRis && 'articles' in result && result.articles && result.articles.length > 0) {
            const risResult = RISExporter.exportToRISFile(result.articles, risOutputDir);
            
            // Create response object with both search results and RIS export info
            const responseData = {
              ...result,
              ris_export: {
                file_path: risResult.file_path,
                article_count: risResult.article_count,
                file_size_bytes: risResult.file_size_bytes,
                created_at: risResult.created_at,
                ...(risReturnContent && { content: RISExporter.exportToRIS(result.articles) })
              }
            };
            
            // If show_metadata_only, remove articles from response to save tokens
            if (showMetadataOnly) {
              const { articles, ...metadataResponse } = responseData;
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(metadataResponse, null, 2),
                  },
                ],
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          }

          // If show_metadata_only without export, return only metadata
          if (showMetadataOnly) {
            const { articles, ...metadataResult } = result;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(metadataResult, null, 2),
                },
              ],
            };
          }

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