# Pendo MCP Code Execution Implementation Guide

## Project Overview

This document outlines the implementation plan for improving the Pendo MCP (Model Context Protocol) server using code execution patterns, as part of the Pendo MCP Hackathon (November 12 - December 12, 2025).

### The Challenge

Current MCP implementations face significant inefficiencies:
- **Token Bloat**: All 11+ Pendo tool definitions load into AI context upfront
- **Context Pollution**: Intermediate query results pass through the AI's context window even when just moving data
- **Expensive Workflows**: Complex multi-tool Pendo analyses can consume 150K+ tokens

### The Solution

Transform the Pendo MCP from a direct tool-calling interface into a **code-first API** that AI agents can program against, reducing token usage by up to 98% while enabling more sophisticated data workflows.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent (Claude)                     │
│  - Writes TypeScript code to interact with Pendo            │
│  - Sees only filesystem structure and final results         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Sandboxed Execution Environment                 │
│  - Runs TypeScript code securely                            │
│  - Has access to Pendo wrapper modules                      │
│  - Processes/filters data before returning to AI            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   TypeScript Wrapper Layer                   │
│  servers/pendo/activityQuery.ts                             │
│  servers/pendo/guideMetrics.ts                              │
│  servers/pendo/accountQuery.ts                              │
│  etc...                                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pendo MCP Server                          │
│  - Original 11 tool implementations                          │
│  - Connects to actual Pendo API                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Pendo MCP Tools

The existing Pendo MCP server exposes these 11 tools:

1. **list_all_applications** - List subscriptions and applications
2. **accountMetadataSchema** - Get available account metadata fields
3. **accountQuery** - Query account data with metadata
4. **visitorMetadataSchema** - Get available visitor metadata fields
5. **visitorQuery** - Query visitor data with metadata
6. **activityQuery** - Query activity/usage data (events, pages, features, etc.)
7. **guideMetrics** - Get guide performance metrics
8. **productEngagementScore** - Calculate PES scores
9. **searchEntities** - Search for pages, features, guides, track types
10. **segmentList** - List available segments
11. **sessionReplayList** - Get session replay recordings

---

## Implementation Plan

### Phase 1: TypeScript Wrapper Generation

**Goal**: Create a filesystem-based interface where each Pendo tool becomes an importable TypeScript module.

#### Directory Structure

```
project-root/
├── src/
│   ├── server/
│   │   ├── index.ts                    # Main MCP server
│   │   └── pendo-client.ts             # Connection to actual Pendo MCP
│   ├── wrappers/
│   │   └── generate-wrappers.ts        # Auto-generates wrapper files
│   └── execution/
│       └── sandbox.ts                  # Code execution environment
├── servers/                             # Generated at runtime
│   └── pendo/
│       ├── listAllApplications.ts
│       ├── accountMetadataSchema.ts
│       ├── accountQuery.ts
│       ├── visitorMetadataSchema.ts
│       ├── visitorQuery.ts
│       ├── activityQuery.ts
│       ├── guideMetrics.ts
│       ├── productEngagementScore.ts
│       ├── searchEntities.ts
│       ├── segmentList.ts
│       └── sessionReplayList.ts
├── skills/                              # Reusable helper functions
│   └── pendo-helpers/
│       ├── adoption-analysis.ts
│       ├── engagement-scoring.ts
│       └── guide-optimization.ts
└── cache/                               # Query result caching
```

#### Wrapper Template

Each wrapper file should follow this pattern:

```typescript
// servers/pendo/activityQuery.ts

import { callPendoTool } from '../../src/server/pendo-client';

export interface ActivityQueryParams {
  subId: string;
  appId: string;
  entityType: 'visitor' | 'account' | 'poll' | 'page' | 'feature' | 'guide' | 'trackType';
  startDate: string;
  endDate: string;
  period?: 'dayRange' | 'weekRange' | 'daily' | 'weekly';
  group?: string[];
  itemIds?: string[];
  accountId?: string;
  visitorId?: string;
  sort?: string[];
  limit?: number;
}

export interface ActivityQueryResult {
  // Type definition based on actual API response
  rows: Array<{
    [key: string]: any;
  }>;
  requestId?: string;
  time?: number;
  url?: string;
}

/**
 * Query activity data from Pendo with flexible filtering.
 * 
 * @example
 * ```typescript
 * const pageActivity = await activityQuery({
 *   subId: 'your-sub-id',
 *   appId: 'your-app-id',
 *   entityType: 'page',
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 *   period: 'daily',
 *   limit: 100
 * });
 * ```
 */
export async function activityQuery(
  params: ActivityQueryParams
): Promise<ActivityQueryResult> {
  return await callPendoTool('Pendo:activityQuery', params);
}
```

#### Auto-Generation Script

```typescript
// src/wrappers/generate-wrappers.ts

import { mcpClient } from '../server/pendo-client';
import fs from 'fs/promises';
import path from 'path';

interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    properties: Record<string, any>;
    required: string[];
  };
}

async function generateWrappers() {
  // Get all tool definitions from the Pendo MCP server
  const tools = await mcpClient.listTools();
  
  const outputDir = path.join(process.cwd(), 'servers', 'pendo');
  await fs.mkdir(outputDir, { recursive: true });
  
  for (const tool of tools) {
    const wrapperCode = generateWrapperCode(tool);
    const fileName = toFileName(tool.name);
    await fs.writeFile(
      path.join(outputDir, `${fileName}.ts`),
      wrapperCode
    );
  }
}

function generateWrapperCode(tool: ToolSchema): string {
  // Convert JSON schema to TypeScript interfaces
  const paramsInterface = schemaToTypeScript(
    tool.parameters,
    `${toPascalCase(tool.name)}Params`
  );
  
  // Generate JSDoc from description
  const docs = generateJSDoc(tool);
  
  return `
import { callPendoTool } from '../../src/server/pendo-client';

${paramsInterface}

${docs}
export async function ${toCamelCase(tool.name)}(
  params: ${toPascalCase(tool.name)}Params
): Promise<any> {
  return await callPendoTool('${tool.name}', params);
}
  `.trim();
}

// Utility functions for code generation...
```

---

### Phase 2: Sandboxed Execution Environment

**Goal**: Create a secure TypeScript runtime where AI-generated code can execute safely.

#### Technology Options

1. **Deno** (Recommended)
   - Built-in security with granular permissions
   - TypeScript support out of the box
   - Simple API for code execution
   
2. **Node.js + isolated-vm**
   - More complex but full-featured
   - Better for existing Node.js projects
   
3. **VM2** (Node.js)
   - Simpler than isolated-vm
   - Good balance of features and ease

#### Deno Implementation Example

```typescript
// src/execution/sandbox.ts

import { assert } from "https://deno.land/std/assert/mod.ts";

export interface ExecutionResult {
  success: boolean;
  output?: any;
  logs: string[];
  error?: string;
  stats: {
    duration: number;
    memoryUsed: number;
  };
}

export interface ExecutionOptions {
  timeout?: number;        // milliseconds
  maxMemory?: number;      // bytes
  allowNetwork?: boolean;
  allowRead?: string[];    // allowed read paths
  allowWrite?: string[];   // allowed write paths
}

export class CodeExecutor {
  private readonly defaultOptions: ExecutionOptions = {
    timeout: 30000,          // 30 seconds
    maxMemory: 512 * 1024 * 1024,  // 512MB
    allowNetwork: true,
    allowRead: ['./servers', './skills', './cache'],
    allowWrite: ['./cache', './skills']
  };

  async execute(
    code: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const logs: string[] = [];
    const startTime = Date.now();
    
    try {
      // Wrap code with logging capture
      const wrappedCode = this.wrapCode(code, logs);
      
      // Create temporary file for execution
      const tempFile = await Deno.makeTempFile({ suffix: '.ts' });
      await Deno.writeTextFile(tempFile, wrappedCode);
      
      // Execute with Deno subprocess with permissions
      const process = new Deno.Command('deno', {
        args: [
          'run',
          '--allow-net=' + (opts.allowNetwork ? 'api.pendo.io' : 'none'),
          '--allow-read=' + opts.allowRead?.join(','),
          '--allow-write=' + opts.allowWrite?.join(','),
          '--no-prompt',
          tempFile
        ],
        stdout: 'piped',
        stderr: 'piped'
      });

      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), opts.timeout);
      });

      const executionPromise = process.output();
      
      const result = await Promise.race([
        executionPromise,
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      // Clean up temp file
      await Deno.remove(tempFile);

      if (result.code === 0) {
        const output = new TextDecoder().decode(result.stdout);
        return {
          success: true,
          output: JSON.parse(output),
          logs,
          stats: {
            duration,
            memoryUsed: 0 // Could use Deno.memoryUsage() if needed
          }
        };
      } else {
        const error = new TextDecoder().decode(result.stderr);
        return {
          success: false,
          error,
          logs,
          stats: { duration, memoryUsed: 0 }
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        logs,
        stats: {
          duration: Date.now() - startTime,
          memoryUsed: 0
        }
      };
    }
  }

  private wrapCode(code: string, logs: string[]): string {
    return `
// Capture console.log for logging
const originalLog = console.log;
console.log = (...args: any[]) => {
  originalLog(...args);
  // Could send logs back to parent process
};

// User code
(async () => {
  ${code}
})();
    `.trim();
  }
}
```

---

### Phase 3: MCP Server Implementation

**Goal**: Create an MCP server that exposes code execution capabilities to AI agents.

#### Core MCP Server

```typescript
// src/server/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { CodeExecutor } from '../execution/sandbox.js';
import fs from 'fs/promises';
import path from 'path';

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
          resources: {}
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
- accountQuery: Query account data
- visitorQuery: Query visitor data
- activityQuery: Query usage events
- guideMetrics: Get guide performance metrics
- productEngagementScore: Calculate PES
- searchEntities: Search pages, features, guides
- segmentList: List segments
- sessionReplayList: Get session replays

Example usage:
\`\`\`typescript
import { activityQuery } from './servers/pendo/activityQuery';
import { searchEntities } from './servers/pendo/searchEntities';

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

The code should always log the final result using console.log() with JSON.stringify().
`,
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'TypeScript code to execute'
                },
                timeout: {
                  type: 'number',
                  description: 'Execution timeout in milliseconds (default: 30000)'
                }
              },
              required: ['code']
            }
          },
          {
            name: 'list_pendo_tools',
            description: 'List all available Pendo tool wrappers with their interfaces',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'save_skill',
            description: 'Save a reusable TypeScript function to the skills directory',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name for the skill file (without .ts extension)'
                },
                code: {
                  type: 'string',
                  description: 'TypeScript code for the skill'
                },
                category: {
                  type: 'string',
                  description: 'Category subdirectory (e.g., "pendo-helpers")'
                }
              },
              required: ['name', 'code']
            }
          }
        ]
      };
    });

    // Execute code
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'execute_pendo_code') {
        const { code, timeout } = request.params.arguments;
        
        const result = await this.executor.execute(code, {
          timeout: timeout || 30000
        });
        
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  output: result.output,
                  logs: result.logs,
                  stats: result.stats
                }, null, 2)
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Execution failed:\n${result.error}\n\nLogs:\n${result.logs.join('\n')}`
              }
            ],
            isError: true
          };
        }
      }
      
      if (request.params.name === 'list_pendo_tools') {
        const tools = await this.listPendoTools();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tools, null, 2)
            }
          ]
        };
      }
      
      if (request.params.name === 'save_skill') {
        const { name, code, category } = request.params.arguments;
        await this.saveSkill(name, code, category);
        return {
          content: [
            {
              type: 'text',
              text: `Skill saved to ./skills/${category || 'custom'}/${name}.ts`
            }
          ]
        };
      }
      
      throw new Error(`Unknown tool: ${request.params.name}`);
    });

    // List resources (filesystem structure)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [];
      
      // List Pendo tool wrappers
      const pendoFiles = await fs.readdir('./servers/pendo');
      for (const file of pendoFiles) {
        resources.push({
          uri: `file://servers/pendo/${file}`,
          name: `Pendo Tool: ${file.replace('.ts', '')}`,
          mimeType: 'text/typescript'
        });
      }
      
      // List skills
      const skillsExist = await fs.access('./skills').then(() => true).catch(() => false);
      if (skillsExist) {
        const skillFiles = await this.walkDirectory('./skills');
        for (const file of skillFiles) {
          resources.push({
            uri: `file://${file}`,
            name: `Skill: ${file}`,
            mimeType: 'text/typescript'
          });
        }
      }
      
      return { resources };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const filePath = uri.replace('file://', './');
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        contents: [
          {
            uri,
            mimeType: 'text/typescript',
            text: content
          }
        ]
      };
    });
  }

  private async listPendoTools(): Promise<any[]> {
    const pendoDir = './servers/pendo';
    const files = await fs.readdir(pendoDir);
    
    const tools = [];
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const content = await fs.readFile(
          path.join(pendoDir, file),
          'utf-8'
        );
        
        // Extract function signature and JSDoc
        tools.push({
          name: file.replace('.ts', ''),
          file: `./servers/pendo/${file}`,
          // Could parse TypeScript to extract full interface
        });
      }
    }
    
    return tools;
  }

  private async saveSkill(
    name: string,
    code: string,
    category?: string
  ): Promise<void> {
    const skillDir = path.join(
      './skills',
      category || 'custom'
    );
    
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, `${name}.ts`),
      code
    );
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.walkDirectory(fullPath));
      } else if (entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start the server
const server = new PendoCodeExecutionServer();
server.run().catch(console.error);
```

---

### Phase 4: Optimization & Advanced Features

#### Query Result Caching

```typescript
// src/cache/query-cache.ts

import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class QueryCache {
  private cacheDir: string;
  private ttl: number; // Time to live in milliseconds
  
  constructor(cacheDir = './cache', ttl = 3600000) { // 1 hour default
    this.cacheDir = cacheDir;
    this.ttl = ttl;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.hashKey(key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const stats = await fs.stat(cachePath);
      const age = Date.now() - stats.mtimeMs;
      
      if (age > this.ttl) {
        await fs.unlink(cachePath);
        return null;
      }
      
      const content = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  async set(key: string, value: any): Promise<void> {
    const cacheKey = this.hashKey(key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(value));
  }
  
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
```

#### Parallel Query Execution

```typescript
// skills/pendo-helpers/parallel-queries.ts

import { activityQuery } from '../../servers/pendo/activityQuery';

export async function getMultiPageActivity(
  config: {
    subId: string;
    appId: string;
    pageIds: string[];
    startDate: string;
    endDate: string;
  }
): Promise<any[]> {
  // Execute queries in parallel
  const promises = config.pageIds.map(pageId =>
    activityQuery({
      ...config,
      entityType: 'page',
      itemIds: [pageId],
      period: 'dayRange'
    })
  );
  
  return await Promise.all(promises);
}
```

#### Common Analysis Patterns

```typescript
// skills/pendo-helpers/adoption-analysis.ts

import { activityQuery } from '../../servers/pendo/activityQuery';
import { searchEntities } from '../../servers/pendo/searchEntities';
import { accountQuery } from '../../servers/pendo/accountQuery';

export interface AdoptionMetrics {
  featureName: string;
  totalUsers: number;
  activeUsers: number;
  adoptionRate: number;
  avgEventsPerUser: number;
}

export async function analyzeFeatureAdoption(
  config: {
    subId: string;
    appId: string;
    featureName: string;
    startDate: string;
    endDate: string;
    segmentId?: string;
  }
): Promise<AdoptionMetrics> {
  // Find the feature
  const features = await searchEntities({
    subId: config.subId,
    appId: config.appId,
    itemType: 'feature',
    substring: config.featureName
  });
  
  if (features.length === 0) {
    throw new Error(`Feature not found: ${config.featureName}`);
  }
  
  const feature = features[0];
  
  // Get activity data
  const activity = await activityQuery({
    subId: config.subId,
    appId: config.appId,
    entityType: 'feature',
    itemIds: [feature.id],
    startDate: config.startDate,
    endDate: config.endDate,
    period: 'dayRange'
  });
  
  // Get total users in segment (if specified)
  const accountCount = await accountQuery({
    subId: config.subId,
    segmentId: config.segmentId,
    count: true
  });
  
  const activeUsers = activity.rows[0]?.uniqueVisitorCount || 0;
  const totalEvents = activity.rows[0]?.numEvents || 0;
  
  return {
    featureName: feature.name,
    totalUsers: accountCount.count,
    activeUsers,
    adoptionRate: (activeUsers / accountCount.count) * 100,
    avgEventsPerUser: activeUsers > 0 ? totalEvents / activeUsers : 0
  };
}
```

---

## Example Use Cases & Demos

### Demo 1: Low Engagement Account Finder

```typescript
// Example AI-generated code
import { accountQuery } from './servers/pendo/accountQuery';
import { activityQuery } from './servers/pendo/activityQuery';

// Get all accounts
const accounts = await accountQuery({
  subId: 'your-sub-id',
  select: ['metadata.auto.lastvisit', 'metadata.custom.ARR']
});

// Get activity for last 30 days
const activity = await activityQuery({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  entityType: 'account',
  startDate: '2025-10-01',
  endDate: '2025-10-31',
  period: 'dayRange'
});

// Find high-value, low-engagement accounts
const lowEngagement = accounts
  .filter(acc => {
    const arr = acc.metadata?.custom?.ARR || 0;
    const activityData = activity.rows.find(a => a.accountId === acc.accountId);
    const events = activityData?.numEvents || 0;
    
    return arr > 50000 && events < 100; // High ARR, low activity
  })
  .map(acc => ({
    accountId: acc.accountId,
    ARR: acc.metadata.custom.ARR,
    lastVisit: acc.metadata.auto.lastvisit,
    eventCount: activity.rows.find(a => a.accountId === acc.accountId)?.numEvents || 0
  }))
  .sort((a, b) => b.ARR - a.ARR);

console.log(JSON.stringify({ lowEngagementAccounts: lowEngagement }, null, 2));
```

### Demo 2: Guide Performance Comparison

```typescript
import { searchEntities } from './servers/pendo/searchEntities';
import { guideMetrics } from './servers/pendo/guideMetrics';

// Find all onboarding guides
const guides = await searchEntities({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  itemType: 'guide',
  substring: 'onboarding'
});

// Get metrics for each guide
const metricsPromises = guides.map(guide =>
  guideMetrics({
    subId: 'your-sub-id',
    guideId: guide.id,
    startDate: '2025-10-01',
    endDate: '2025-10-31',
    period: 'dayRange'
  })
);

const allMetrics = await Promise.all(metricsPromises);

// Calculate completion rates and rank
const comparison = guides.map((guide, idx) => {
  const metrics = allMetrics[idx];
  const completions = metrics.completionRate || 0;
  const dismissals = metrics.dismissalRate || 0;
  const views = metrics.totalViews || 0;
  
  return {
    guideName: guide.name,
    views,
    completionRate: completions,
    dismissalRate: dismissals,
    effectivenessScore: completions - dismissals
  };
}).sort((a, b) => b.effectivenessScore - a.effectivenessScore);

console.log(JSON.stringify({ guideComparison: comparison }, null, 2));
```

### Demo 3: Session Replay Intelligent Filter

```typescript
import { sessionReplayList } from './servers/pendo/sessionReplayList';
import { searchEntities } from './servers/pendo/searchEntities';

// Find the checkout page
const pages = await searchEntities({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  itemType: 'page',
  substring: 'checkout'
});

const checkoutPage = pages[0];

// Get replays with high frustration on checkout
const replays = await sessionReplayList({
  subId: 'your-sub-id',
  pageId: checkoutPage.id,
  startDate: '2025-10-01',
  endDate: '2025-10-31',
  minDuration: 180000, // 3+ minutes
  minActivityPercentage: 20
});

// Filter for high frustration signals
const problematicSessions = replays
  .filter(replay => {
    // Look for frustration indicators
    const hasRageClicks = (replay.frustrationEvents?.rageClicks || 0) > 5;
    const hasDeadClicks = (replay.frustrationEvents?.deadClicks || 0) > 3;
    const longDuration = replay.duration > 300000; // 5+ minutes
    
    return (hasRageClicks || hasDeadClicks) && longDuration;
  })
  .sort((a, b) => b.frustrationScore - a.frustrationScore)
  .slice(0, 10) // Top 10 most frustrated sessions
  .map(replay => ({
    url: replay.replayUrl,
    duration: `${(replay.duration / 1000).toFixed(0)}s`,
    rageClicks: replay.frustrationEvents?.rageClicks,
    deadClicks: replay.frustrationEvents?.deadClicks,
    activityScore: replay.activityPercentage
  }));

console.log(JSON.stringify({ 
  message: `Found ${problematicSessions.length} highly frustrated checkout sessions`,
  sessions: problematicSessions 
}, null, 2));
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/wrappers.test.ts

import { describe, it, expect } from 'vitest';
import { activityQuery } from '../servers/pendo/activityQuery';

describe('Pendo Wrappers', () => {
  it('should call activityQuery with correct parameters', async () => {
    const result = await activityQuery({
      subId: 'test-sub',
      appId: 'test-app',
      entityType: 'page',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      period: 'dayRange'
    });
    
    expect(result).toBeDefined();
    expect(result.rows).toBeInstanceOf(Array);
  });
});
```

### Integration Tests

```typescript
// tests/execution.test.ts

import { describe, it, expect } from 'vitest';
import { CodeExecutor } from '../src/execution/sandbox';

describe('Code Execution', () => {
  const executor = new CodeExecutor();
  
  it('should execute simple code', async () => {
    const code = `
      const result = { message: 'Hello' };
      console.log(JSON.stringify(result));
    `;
    
    const result = await executor.execute(code);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ message: 'Hello' });
  });
  
  it('should enforce timeout', async () => {
    const code = `
      while (true) {
        // Infinite loop
      }
    `;
    
    const result = await executor.execute(code, { timeout: 1000 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });
});
```

---

## Security Considerations

### Sandboxing Requirements

1. **Network Access**: Restrict to only Pendo API endpoints
2. **File System**: 
   - Read-only access to `./servers/` and `./skills/`
   - Write access only to `./cache/`
3. **Resource Limits**:
   - CPU: 30 second timeout per execution
   - Memory: 512MB maximum
   - No subprocess spawning
4. **Code Review**: Consider static analysis on AI-generated code before execution

### Data Privacy

```typescript
// Example: Tokenize sensitive data

function tokenizePII(data: any[]): any[] {
  const tokenMap = new Map<string, string>();
  let tokenCounter = 0;
  
  return data.map(item => {
    if (item.email) {
      if (!tokenMap.has(item.email)) {
        tokenMap.set(item.email, `USER_${tokenCounter++}`);
      }
      item.email = tokenMap.get(item.email);
    }
    return item;
  });
}
```

---

## Performance Optimization

### Caching Strategy

- Cache Pendo API responses for 1 hour
- Use query parameters as cache key
- Implement cache warming for common queries

### Rate Limiting

```typescript
// src/utils/rate-limiter.ts

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limit: number;
  private window: number; // milliseconds
  
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }
  
  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.window
    );
    
    if (validTimestamps.length >= this.limit) {
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }
}
```

---

## Deployment & Distribution

### Package Structure

```json
{
  "name": "pendo-mcp-code-execution",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server/index.js",
  "bin": {
    "pendo-mcp": "./dist/server/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/server/index.js",
    "dev": "tsx watch src/server/index.ts",
    "generate-wrappers": "tsx src/wrappers/generate-wrappers.ts",
    "test": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  }
}
```

### MCP Configuration

Users add this to their Claude Desktop config:

```json
{
  "mcpServers": {
    "pendo-code-execution": {
      "command": "npx",
      "args": ["pendo-mcp-code-execution"],
      "env": {
        "PENDO_API_KEY": "your-api-key-here",
        "PENDO_SUBSCRIPTION_ID": "your-sub-id"
      }
    }
  }
}
```

---

## Hackathon Submission Checklist

### Required Deliverables

- [ ] Working MCP server implementation
- [ ] Auto-generated TypeScript wrappers for all 11 Pendo tools
- [ ] Sandboxed code execution environment
- [ ] At least 3 reusable skills in `./skills/`
- [ ] Demo video (5-10 minutes) showing:
  - Installation process
  - Example AI interaction using code execution
  - Token savings comparison (before/after)
  - Real-world use case
- [ ] One-page overview document
- [ ] README with setup instructions
- [ ] Published to npm (optional but recommended)

### Evaluation Criteria Focus

1. **Technical Execution**: Solid sandboxing, proper error handling, clean architecture
2. **Pendo Integration**: All 11 tools wrapped, proper typing, good examples
3. **Creativity**: Unique skills, clever optimizations, novel use cases
4. **Practical Impact**: Show real token savings, performance improvements, better UX

---

## Additional Resources

### Documentation to Review

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Anthropic Code Execution Blog](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Pendo API Documentation](https://docs.pendo.io/)
- [Deno Security Guide](https://deno.land/manual/basics/permissions)

### Example Projects

- Cloudflare's "Code Mode" implementation
- Anthropic's MCP reference implementations
- Other MCP servers with code execution

### Community

- Pendo Community: [Join the hackathon group](https://community.pendo.io/home/clubs/pendos-mcp-hackathon-btyny)
- MCP Discord/Forums
- Office hours with Pendo team

---

## Next Steps

1. **Set up development environment**
   - Install Deno or Node.js
   - Clone MCP SDK
   - Set up Pendo API credentials

2. **Start with wrapper generation**
   - Get list of Pendo MCP tools
   - Build auto-generation script
   - Test a few wrappers manually

3. **Implement basic sandbox**
   - Start with simple Deno execution
   - Add timeout and memory limits
   - Test with sample code

4. **Build MCP server**
   - Implement basic tool handlers
   - Connect to Pendo backend
   - Test with Claude Desktop

5. **Develop example skills**
   - Build 3-5 useful analysis functions
   - Document patterns
   - Create demo scenarios

6. **Polish and document**
   - Write comprehensive README
   - Record demo video
   - Prepare submission materials

---

## Questions to Consider

- **Authentication**: How will users provide Pendo credentials securely?
- **Error Recovery**: How should the system handle Pendo API errors in generated code?
- **Tool Discovery**: Should there be a better search/recommendation system for tools?
- **Skill Sharing**: Could there be a community marketplace for skills?
- **Monitoring**: What telemetry would help users understand token savings?

---

## Contact & Support

For hackathon questions:
- Pendo Community Group
- Mentor office hours
- Pendo team support channels

---

**Good luck with your hackathon submission! This code-execution pattern has the potential to dramatically improve how AI agents interact with Pendo data.**
