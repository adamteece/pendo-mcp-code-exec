#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CodeExecutor } from '../execution/sandbox.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Pendo Code Execution MCP Server
 *
 * Transforms the Pendo MCP from a direct tool-calling interface into a code-first API
 * that AI agents can program against, reducing token usage by up to 98%.
 */
class PendoCodeExecutionServer {
  private server: Server;
  private executor: CodeExecutor;

  constructor() {
    this.server = new Server(
      {
        name: 'pendo-code-execution',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.executor = new CodeExecutor();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_pendo_code',
            description: `Execute TypeScript code that interacts with Pendo data.

Available Pendo modules in ./servers/pendo/:
- listAllApplications: Get subscriptions and applications
- accountMetadataSchema: Get available account metadata fields
- accountQuery: Query account data with metadata
- visitorMetadataSchema: Get available visitor metadata fields
- visitorQuery: Query visitor data with metadata
- activityQuery: Query activity/usage data (events, pages, features)
- guideMetrics: Get guide performance metrics
- productEngagementScore: Calculate PES scores
- searchEntities: Search for pages, features, guides, track types
- segmentList: List available segments
- sessionReplayList: Get session replay recordings

Example usage:
\`\`\`typescript
import { activityQuery } from './servers/pendo/activityQuery.js';
import { searchEntities } from './servers/pendo/searchEntities.js';

// Search for pages
const pages = await searchEntities({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  itemType: 'page',
  substring: 'dashboard'
});

// Get activity for top pages
const topPageIds = pages.slice(0, 5).map(p => p.id);
const activity = await activityQuery({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  entityType: 'page',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  itemIds: topPageIds,
  period: 'dayRange',
  sort: ['-numEvents']
});

// Process and filter results in code
const summary = activity.rows
  .filter(row => row.numEvents > 100)
  .map(row => ({
    pageId: row.pageId,
    events: row.numEvents,
    uniqueVisitors: row.uniqueVisitorCount
  }));

console.log(JSON.stringify(summary, null, 2));
\`\`\`

The code should always log the final result using console.log().
`,
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'TypeScript code to execute',
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 30000)',
                },
              },
              required: ['code'],
            },
          },
          {
            name: 'list_pendo_tools',
            description: 'List all available Pendo tool wrappers with their TypeScript interfaces',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'save_skill',
            description: 'Save a reusable TypeScript function to the skills directory for future use',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name for the skill file (without .ts extension)',
                },
                code: {
                  type: 'string',
                  description: 'TypeScript code for the skill',
                },
                category: {
                  type: 'string',
                  description: 'Category subdirectory (e.g., "pendo-helpers")',
                },
              },
              required: ['name', 'code'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute_pendo_code':
          return await this.handleExecuteCode(args);

        case 'list_pendo_tools':
          return await this.handleListTools();

        case 'save_skill':
          return await this.handleSaveSkill(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List resources (filesystem structure)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [];

      try {
        // List Pendo tool wrappers
        const pendoDir = path.join(process.cwd(), 'servers', 'pendo');
        const pendoFiles = await fs.readdir(pendoDir).catch(() => []);

        for (const file of pendoFiles) {
          if (file.endsWith('.ts') || file.endsWith('.js')) {
            resources.push({
              uri: `file://servers/pendo/${file}`,
              name: `Pendo Tool: ${file.replace(/\.(ts|js)$/, '')}`,
              mimeType: 'text/typescript',
            });
          }
        }

        // List skills
        const skillsDir = path.join(process.cwd(), 'skills');
        const skillFiles = await this.walkDirectory(skillsDir).catch(() => []);

        for (const file of skillFiles) {
          const relativePath = path.relative(process.cwd(), file);
          resources.push({
            uri: `file://${relativePath}`,
            name: `Skill: ${relativePath}`,
            mimeType: 'text/typescript',
          });
        }
      } catch (error) {
        console.error('Error listing resources:', error);
      }

      return { resources };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const filePath = uri.replace('file://', '');
      const fullPath = path.join(process.cwd(), filePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');

        return {
          contents: [
            {
              uri,
              mimeType: 'text/typescript',
              text: content,
            },
          ],
        };
      } catch (error: any) {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    });
  }

  /**
   * Handle execute_pendo_code tool
   */
  private async handleExecuteCode(args: any) {
    const { code, timeout } = args;

    if (!code) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No code provided',
          },
        ],
        isError: true,
      };
    }

    const result = await this.executor.execute(code, {
      timeout: timeout || 30000,
    });

    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                logs: result.logs,
                stats: result.stats,
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `Execution failed:\n${result.error}\n\nLogs:\n${result.logs.join('\n')}\n\nStats:\n${JSON.stringify(result.stats, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle list_pendo_tools tool
   */
  private async handleListTools() {
    try {
      const pendoDir = path.join(process.cwd(), 'servers', 'pendo');
      const files = await fs.readdir(pendoDir).catch(() => []);

      const tools = [];

      for (const file of files) {
        if ((file.endsWith('.ts') || file.endsWith('.js')) && file !== 'index.ts' && file !== 'index.js') {
          const content = await fs.readFile(path.join(pendoDir, file), 'utf-8');

          // Extract function name and interface
          const functionMatch = content.match(/export async function (\w+)/);
          const interfaceMatch = content.match(/export interface (\w+Params)/);

          tools.push({
            name: functionMatch ? functionMatch[1] : file.replace(/\.(ts|js)$/, ''),
            file: `./servers/pendo/${file}`,
            paramsInterface: interfaceMatch ? interfaceMatch[1] : null,
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                tools,
                message: `Found ${tools.length} Pendo tool wrappers`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing tools: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle save_skill tool
   */
  private async handleSaveSkill(args: any) {
    const { name, code, category } = args;

    if (!name || !code) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: name and code are required',
          },
        ],
        isError: true,
      };
    }

    try {
      const skillDir = path.join(process.cwd(), 'skills', category || 'custom');
      await fs.mkdir(skillDir, { recursive: true });

      const filePath = path.join(skillDir, `${name}.ts`);
      await fs.writeFile(filePath, code);

      return {
        content: [
          {
            type: 'text',
            text: `Skill saved successfully to ${path.relative(process.cwd(), filePath)}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error saving skill: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Recursively walk directory
   */
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Start the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Pendo Code Execution MCP Server running on stdio');
  }
}

// Start the server
const server = new PendoCodeExecutionServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
