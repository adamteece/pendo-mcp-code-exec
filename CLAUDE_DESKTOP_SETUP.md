# Claude Desktop Setup Guide

This guide will help you configure Pendo MCP Code Execution with Claude Desktop.

## Step 1: Install from Source

First, make sure you have Node.js 18+ installed, then clone and build the project:

```bash
git clone https://github.com/adamteece/pendo-mcp-code-exec.git
cd pendo-mcp-code-exec
npm install
npm run build
```

> **Note**: This package is not yet published to npm. You must install from source.

## Step 2: Get Pendo Credentials

You'll need:
- **Pendo API Key**: Get this from your Pendo account settings
- **Pendo Subscription ID**: Find this in your Pendo dashboard URL

## Step 3: Configure Claude Desktop

### macOS

1. Open the Claude Desktop configuration file:

```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. Add the Pendo Code Execution server configuration:

```json
{
  "mcpServers": {
    "pendo-code-execution": {
      "command": "node",
      "args": ["/absolute/path/to/pendo-mcp-code-exec/dist/server/index.js"],
      "env": {
        "PENDO_API_KEY": "your-api-key-here",
        "PENDO_SUBSCRIPTION_ID": "your-subscription-id",
        "PENDO_MCP_COMMAND": "npx",
        "PENDO_MCP_ARGS": "[\"@pendo/mcp-server\"]"
      }
    }
  }
}
```

> **Important**: Replace `/absolute/path/to/pendo-mcp-code-exec` with the actual absolute path where you cloned the repository (e.g., `/Users/yourname/projects/pendo-mcp-code-exec`).

### Windows

1. Open the configuration file at:

```
%APPDATA%\Claude\claude_desktop_config.json
```

2. Add the same configuration as above, adjusting the path:

```json
{
  "mcpServers": {
    "pendo-code-execution": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\pendo-mcp-code-exec\\dist\\server\\index.js"],
      "env": {
        "PENDO_API_KEY": "your-api-key-here",
        "PENDO_SUBSCRIPTION_ID": "your-subscription-id",
        "PENDO_MCP_COMMAND": "npx",
        "PENDO_MCP_ARGS": "[\"@pendo/mcp-server\"]"
      }
    }
  }
}
```

> **Important**: Replace `C:\absolute\path\to\pendo-mcp-code-exec` with the actual absolute path where you cloned the repository.

### Linux

1. Open the configuration file at:

```
~/.config/Claude/claude_desktop_config.json
```

2. Add the same configuration as macOS.

## Step 4: Generate Pendo Tool Wrappers

Before using the server, generate the TypeScript wrappers:

```bash
cd pendo-mcp-code-exec
npm run generate-wrappers
```

This will create wrapper files in `servers/pendo/` for all Pendo tools.

> **Note**: You must have the actual Pendo MCP server installed and configured for this step to work. The wrapper generator connects to your Pendo MCP server to introspect the available tools.

## Step 5: Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration.

## Step 6: Verify Installation

In Claude Desktop, try asking:

> "Can you list the available Pendo tools?"

Claude should respond with a list of available Pendo tool wrappers.

## Example Usage

Try asking Claude:

> "Can you find all pages with 'dashboard' in the name and show me their activity for January 2025?"

Claude will write code using the Pendo MCP Code Execution server:

```typescript
import { searchEntities } from './servers/pendo/searchEntities.js';
import { activityQuery } from './servers/pendo/activityQuery.js';

const pages = await searchEntities({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  itemType: 'page',
  substring: 'dashboard'
});

const activity = await activityQuery({
  subId: 'your-sub-id',
  appId: 'your-app-id',
  entityType: 'page',
  itemIds: pages.map(p => p.id),
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  period: 'dayRange'
});

console.log(JSON.stringify(activity, null, 2));
```

## Troubleshooting

### Server Not Starting

1. Check that Node.js is installed: `node --version`
2. Verify the path to `index.js` is correct
3. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/mcp.log`
   - Windows: `%APPDATA%\Claude\logs\mcp.log`
   - Linux: `~/.config/Claude/logs/mcp.log`

### Pendo API Errors

1. Verify your API key is correct
2. Check your subscription ID
3. Ensure the Pendo MCP server is installed: `npm list -g @pendo/mcp-server`

### Wrapper Generation Fails

1. Make sure the Pendo MCP server is accessible
2. Check environment variables are set correctly
3. Try running manually: `npm run generate-wrappers`

### Code Execution Timeouts

If code is timing out, you can increase the timeout in your requests:

```typescript
// In your code execution request
{
  code: "...",
  timeout: 60000  // 60 seconds
}
```

## Advanced Configuration

### Custom Cache Directory

Add to your environment variables:

```json
"env": {
  "CACHE_DIR": "/path/to/custom/cache"
}
```

### Rate Limiting

Adjust rate limits:

```json
"env": {
  "RATE_LIMIT_MAX_REQUESTS": "200",
  "RATE_LIMIT_WINDOW_MS": "60000"
}
```

### Cache TTL

Adjust cache expiration:

```json
"env": {
  "CACHE_TTL": "7200000"  // 2 hours in milliseconds
}
```

## Support

For help:
- GitHub Issues: [Link to issues]
- Pendo Community: [community.pendo.io](https://community.pendo.io)
- Documentation: [README.md](./README.md)
