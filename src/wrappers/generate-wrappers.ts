import { pendoClient } from '../server/pendo-client.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Convert tool name to PascalCase
 */
function toPascalCase(str: string): string {
  // Remove 'Pendo:' prefix if present
  str = str.replace(/^Pendo:/, '');

  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Convert tool name to camelCase
 */
function toCamelCase(str: string): string {
  // Remove 'Pendo:' prefix if present
  str = str.replace(/^Pendo:/, '');

  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert tool name to filename (kebab-case)
 */
function toFileName(str: string): string {
  // Remove 'Pendo:' prefix if present
  str = str.replace(/^Pendo:/, '');

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert JSON schema type to TypeScript type
 */
function jsonTypeToTS(type: string | string[], property: any): string {
  if (Array.isArray(type)) {
    return type.map(t => jsonTypeToTS(t, property)).join(' | ');
  }

  switch (type) {
    case 'string':
      return property.enum ? property.enum.map((e: string) => `'${e}'`).join(' | ') : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      if (property.items) {
        const itemType = jsonTypeToTS(property.items.type, property.items);
        return `${itemType}[]`;
      }
      return 'any[]';
    case 'object':
      return 'Record<string, any>';
    case 'null':
      return 'null';
    default:
      return 'any';
  }
}

/**
 * Convert JSON schema to TypeScript interface
 */
function schemaToTypeScript(schema: any, interfaceName: string): string {
  if (!schema || !schema.properties) {
    return `export interface ${interfaceName} {\n  [key: string]: any;\n}`;
  }

  const properties = Object.entries(schema.properties)
    .map(([key, prop]: [string, any]) => {
      const isRequired = schema.required?.includes(key);
      const optionalMark = isRequired ? '' : '?';
      const type = jsonTypeToTS(prop.type, prop);
      const description = prop.description ? `  /** ${prop.description} */\n` : '';

      return `${description}  ${key}${optionalMark}: ${type};`;
    })
    .join('\n');

  return `export interface ${interfaceName} {\n${properties}\n}`;
}

/**
 * Generate JSDoc comment from tool schema
 */
function generateJSDoc(tool: ToolSchema): string {
  const description = tool.description || `Call the ${tool.name} tool`;

  let doc = `/**\n * ${description}\n`;

  // Add examples if we have common patterns
  if (tool.name.includes('Query') || tool.name.includes('query')) {
    doc += ` * \n * @example\n * \`\`\`typescript\n * const result = await ${toCamelCase(tool.name)}({\n *   // ... parameters\n * });\n * \`\`\`\n`;
  }

  doc += ` */`;

  return doc;
}

/**
 * Generate wrapper code for a single tool
 */
function generateWrapperCode(tool: ToolSchema): string {
  const functionName = toCamelCase(tool.name);
  const paramsInterface = `${toPascalCase(tool.name)}Params`;
  const resultInterface = `${toPascalCase(tool.name)}Result`;

  const paramsTypeCode = schemaToTypeScript(tool.inputSchema, paramsInterface);
  const docs = generateJSDoc(tool);

  return `import { callPendoTool } from '../../src/server/pendo-client.js';

${paramsTypeCode}

export interface ${resultInterface} {
  [key: string]: any;
}

${docs}
export async function ${functionName}(
  params: ${paramsInterface}
): Promise<${resultInterface}> {
  return await callPendoTool('${tool.name}', params);
}
`;
}

/**
 * Generate all wrapper files
 */
async function generateWrappers(): Promise<void> {
  console.log('Connecting to Pendo MCP server...');

  try {
    // Connect to Pendo MCP server
    await pendoClient.connect();

    console.log('Fetching tool definitions...');

    // Get all tool definitions
    const tools = await pendoClient.listTools();

    console.log(`Found ${tools.length} tools`);

    // Create output directory
    const outputDir = path.join(process.cwd(), 'servers', 'pendo');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate wrapper for each tool
    for (const tool of tools) {
      const wrapperCode = generateWrapperCode(tool);
      const fileName = toFileName(tool.name);
      const filePath = path.join(outputDir, `${fileName}.ts`);

      await fs.writeFile(filePath, wrapperCode);
      console.log(`Generated: ${fileName}.ts`);
    }

    // Generate index file for easier imports
    const indexCode = tools
      .map(tool => {
        const fileName = toFileName(tool.name);
        const functionName = toCamelCase(tool.name);
        return `export { ${functionName} } from './${fileName}.js';`;
      })
      .join('\n');

    await fs.writeFile(path.join(outputDir, 'index.ts'), indexCode + '\n');
    console.log('Generated: index.ts');

    console.log(`\n✅ Successfully generated ${tools.length} wrapper files`);

  } catch (error) {
    console.error('Error generating wrappers:', error);
    throw error;
  } finally {
    await pendoClient.disconnect();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateWrappers().catch(error => {
    console.error('Failed to generate wrappers:', error);
    process.exit(1);
  });
}

export { generateWrappers };
