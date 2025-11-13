import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Client for connecting to the actual Pendo MCP server
 */
class PendoMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  /**
   * Connect to the Pendo MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Get Pendo MCP server configuration from environment
    const pendoMCPCommand = process.env.PENDO_MCP_COMMAND || 'pendo-mcp';
    const pendoMCPArgs = process.env.PENDO_MCP_ARGS
      ? JSON.parse(process.env.PENDO_MCP_ARGS)
      : [];

    // Create transport for communication - it will spawn the process
    this.transport = new StdioClientTransport({
      command: pendoMCPCommand,
      args: pendoMCPArgs,
      env: process.env as Record<string, string>,
    });

    // Create MCP client
    this.client = new Client({
      name: 'pendo-code-execution-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    // Connect client to transport
    await this.client.connect(this.transport);
    this.connected = true;

    console.error('[PendoClient] Connected to Pendo MCP server');
  }

  /**
   * Call a tool on the Pendo MCP server
   */
  async callTool(toolName: string, parameters: any): Promise<any> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('Failed to connect to Pendo MCP server');
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters,
      });

      // Extract text content from result
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent) {
          try {
            return JSON.parse(textContent.text);
          } catch {
            return textContent.text;
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`[PendoClient] Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * List all available tools from the Pendo MCP server
   */
  async listTools(): Promise<any[]> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('Failed to connect to Pendo MCP server');
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * Disconnect from the Pendo MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
    }
  }
}

// Export singleton instance
export const pendoClient = new PendoMCPClient();

/**
 * Helper function for wrapper files to call Pendo tools
 */
export async function callPendoTool(toolName: string, parameters: any): Promise<any> {
  return pendoClient.callTool(toolName, parameters);
}
