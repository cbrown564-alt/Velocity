import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const dataDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : repoRoot;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', path.join(repoRoot, 'mcp-server', 'index.ts')],
    env: {
      ...process.env,
      VELOCITY_DATA_DIR: dataDir,
    },
    stderr: 'pipe',
  });

  const client = new Client({ name: 'velocity-mcp-setup', version: '1.0.0' }, { capabilities: {} });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();

    if (!toolNames.includes('velocity_load') || !toolNames.includes('velocity_export_session')) {
      throw new Error(`Expected core tools were missing. Found: ${toolNames.join(', ')}`);
    }

    console.log(`MCP initialize succeeded against ${dataDir}`);
    console.log(`Registered tools: ${toolNames.length}`);
    console.log(toolNames.join('\n'));
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error('[velocity-mcp-setup] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
