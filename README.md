# Pendo MCP Code Execution

Transform your Pendo MCP server into a **code-first API** that reduces token usage by up to 98% while enabling more sophisticated data workflows.

## The Problem

Current MCP implementations face significant inefficiencies:

- **Token Bloat**: All 11+ Pendo tool definitions load into AI context upfront
- **Context Pollution**: Intermediate query results pass through the AI's context window even when just moving data
- **Expensive Workflows**: Complex multi-tool Pendo analyses can consume 150K+ tokens

## The Solution

Instead of exposing Pendo tools directly to AI agents, this MCP server provides a **sandboxed code execution environment** where AI agents can:

1. Write TypeScript code to interact with Pendo APIs
2. Process and filter data in code (not in context)
3. Return only the final results to the AI

**Result**: Up to 98% reduction in token usage for complex Pendo workflows.

## Features

- 🔒 **Secure Sandboxed Execution** - Code runs in isolated Worker threads with timeout protection
- 📦 **Auto-Generated Wrappers** - TypeScript wrappers for all 11 Pendo MCP tools
- 🚀 **Parallel Query Execution** - Execute multiple Pendo queries concurrently
- 💾 **Query Caching** - File-based caching with configurable TTL
- 📚 **Reusable Skills** - Library of common Pendo analysis patterns
- 🎯 **Type-Safe** - Full TypeScript support with proper interfaces

## Installation

### Install from Source

```bash
git clone https://github.com/adamteece/pendo-mcp-code-exec.git
cd pendo-mcp-code-exec
npm install
npm run build
```

> **Note**: This package is not yet published to npm. Install from source as shown above.

## Configuration

### Claude Desktop Setup

Add this to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pendo-code-execution": {
      "command": "node",
      "args": ["/absolute/path/to/pendo-mcp-code-exec/dist/server/index.js"],
      "env": {
        "PENDO_API_KEY": "your-api-key-here",
        "PENDO_SUBSCRIPTION_ID": "your-sub-id",
        "PENDO_MCP_COMMAND": "pendo-mcp",
        "PENDO_MCP_ARGS": "[]"
      }
    }
  }
}
```

> **Important**: Replace `/absolute/path/to/pendo-mcp-code-exec` with the actual absolute path where you cloned the repository.

### Environment Variables

- `PENDO_API_KEY` - Your Pendo API key (required)
- `PENDO_SUBSCRIPTION_ID` - Your Pendo subscription ID (required)
- `PENDO_MCP_COMMAND` - Command to run the actual Pendo MCP server (default: `pendo-mcp`)
- `PENDO_MCP_ARGS` - JSON array of arguments for Pendo MCP server (default: `[]`)

## Usage

### Generate Wrapper Files

Before using the server, generate TypeScript wrappers for all Pendo tools:

```bash
npm run generate-wrappers
```

This creates wrapper files in `servers/pendo/` for all 11 Pendo tools.

### Available Tools

The MCP server exposes three main tools:

#### 1. `execute_pendo_code`

Execute TypeScript code that interacts with Pendo data.

**Example:**

```typescript
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
  period: 'dayRange'
});

// Process results in code
const summary = activity.rows
  .filter(row => row.numEvents > 100)
  .map(row => ({
    pageId: row.pageId,
    events: row.numEvents
  }));

console.log(JSON.stringify(summary, null, 2));
```

#### 2. `list_pendo_tools`

List all available Pendo tool wrappers with their TypeScript interfaces.

#### 3. `save_skill`

Save reusable TypeScript functions to the skills directory.

```typescript
// Example: Save a skill
save_skill({
  name: 'low-engagement-finder',
  category: 'pendo-helpers',
  code: `
    export async function findLowEngagementAccounts(config) {
      // ... implementation
    }
  `
});
```

## Available Pendo Tools

The following Pendo tools are available as TypeScript modules in `./servers/pendo/`:

1. **listAllApplications** - List subscriptions and applications
2. **accountMetadataSchema** - Get available account metadata fields
3. **accountQuery** - Query account data with metadata
4. **visitorMetadataSchema** - Get available visitor metadata fields
5. **visitorQuery** - Query visitor data with metadata
6. **activityQuery** - Query activity/usage data (events, pages, features)
7. **guideMetrics** - Get guide performance metrics
8. **productEngagementScore** - Calculate PES scores
9. **searchEntities** - Search for pages, features, guides, track types
10. **segmentList** - List available segments
11. **sessionReplayList** - Get session replay recordings

## Reusable Skills

The `skills/pendo-helpers/` directory contains pre-built analysis functions:

### Adoption Analysis

```typescript
import { analyzeFeatureAdoption } from './skills/pendo-helpers/adoption-analysis.js';

const metrics = await analyzeFeatureAdoption({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  featureName: 'Export Button',
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

console.log(metrics);
// {
//   featureName: 'Export Button',
//   totalUsers: 1000,
//   activeUsers: 450,
//   adoptionRate: 45,
//   avgEventsPerUser: 3.2
// }
```

### Parallel Queries

```typescript
import { getMultiPageActivity } from './skills/pendo-helpers/parallel-queries.js';

const results = await getMultiPageActivity({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  pageIds: ['page1', 'page2', 'page3'],
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
```

### Engagement Scoring

```typescript
import { calculateEngagementScores } from './skills/pendo-helpers/engagement-scoring.js';

const scores = await calculateEngagementScores({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

console.log(scores);
// [{
//   accountId: 'acc123',
//   score: 75,
//   factors: { frequency: 80, breadth: 70, depth: 75, recency: 100 },
//   risk: 'low'
// }]
```

## Example Use Cases

### Find High-Value, Low-Engagement Accounts

```typescript
import { accountQuery } from './servers/pendo/accountQuery.js';
import { activityQuery } from './servers/pendo/activityQuery.js';

const accounts = await accountQuery({
  subId: 'your-sub-id',
  select: ['metadata.auto.lastvisit', 'metadata.custom.ARR']
});

const activity = await activityQuery({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  entityType: 'account',
  startDate: '2025-10-01',
  endDate: '2025-10-31'
});

const lowEngagement = accounts
  .filter(acc => {
    const arr = acc.metadata?.custom?.ARR || 0;
    const events = activity.rows.find(a => a.accountId === acc.accountId)?.numEvents || 0;
    return arr > 50000 && events < 100;
  })
  .sort((a, b) => b.metadata.custom.ARR - a.metadata.custom.ARR);

console.log(JSON.stringify({ lowEngagementAccounts: lowEngagement }, null, 2));
```

### Compare Guide Performance

```typescript
import { searchEntities } from './servers/pendo/searchEntities.js';
import { guideMetrics } from './servers/pendo/guideMetrics.js';

const guides = await searchEntities({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  itemType: 'guide',
  substring: 'onboarding'
});

const metricsPromises = guides.map(guide =>
  guideMetrics({
    subId: 'your-sub-id',
    guideId: guide.id,
    startDate: '2025-10-01',
    endDate: '2025-10-31'
  })
);

const allMetrics = await Promise.all(metricsPromises);

const comparison = guides.map((guide, idx) => ({
  guideName: guide.name,
  completionRate: allMetrics[idx].completionRate || 0,
  dismissalRate: allMetrics[idx].dismissalRate || 0
})).sort((a, b) => b.completionRate - a.completionRate);

console.log(JSON.stringify({ guideComparison: comparison }, null, 2));
```

## Development

### Building

```bash
npm run build
```

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## Architecture

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
│  - Runs TypeScript code securely in Worker threads         │
│  - Has access to Pendo wrapper modules                      │
│  - Processes/filters data before returning to AI            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   TypeScript Wrapper Layer                   │
│  servers/pendo/*.ts (auto-generated wrappers)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pendo MCP Server                          │
│  - Original 11 tool implementations                          │
│  - Connects to actual Pendo API                             │
└─────────────────────────────────────────────────────────────┘
```

## Security

The sandbox environment provides multiple layers of security:

- **Worker Thread Isolation** - Code runs in isolated Worker threads
- **Timeout Protection** - 30-second default timeout (configurable)
- **Memory Limits** - 512MB default memory limit
- **File System Restrictions** - Read-only access to `servers/` and `skills/`, write access only to `cache/`
- **No Subprocess Spawning** - Prevents execution of arbitrary commands

## Performance

- **Query Caching** - Results cached for 1 hour (configurable TTL)
- **Parallel Execution** - Multiple Pendo queries run concurrently
- **Rate Limiting** - Built-in rate limiter (100 requests/minute default)

## Token Savings

Example comparison for "Find high-value, low-engagement accounts":

**Traditional MCP Approach:**
- Load 11 tool definitions: ~2,000 tokens
- Query accounts: ~50,000 tokens (full dataset)
- Query activity: ~50,000 tokens (full dataset)
- Filter in context: ~5,000 tokens
- **Total: ~107,000 tokens**

**Code Execution Approach:**
- Execute code with filtering: ~2,000 tokens
- Return only filtered results: ~500 tokens
- **Total: ~2,500 tokens**

**Savings: 98% reduction** 🎉

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [github.com/adamteece/pendo-mcp-code-exec/issues](https://github.com/adamteece/pendo-mcp-code-exec/issues)
- Pendo Community: [community.pendo.io](https://community.pendo.io)

## Acknowledgments

Built for the Pendo MCP Hackathon (November 12 - December 12, 2025).

Inspired by Anthropic's blog post on code execution with MCP and Cloudflare's "Code Mode" implementation.
