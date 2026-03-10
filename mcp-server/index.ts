#!/usr/bin/env node
/**
 * Velocity MCP Server — Entry Point
 *
 * Stateless transport adapter over VelocityEngine.
 * Exposes engine capabilities as MCP tools via stdio transport.
 *
 * Usage:
 *   VELOCITY_DATA_DIR=/path/to/data npx velocity-mcp
 *
 * Claude Code / Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "velocity": {
 *         "command": "node",
 *         "args": ["/path/to/mcp-server/dist/index.js"],
 *         "env": { "VELOCITY_DATA_DIR": "/your/data/directory" }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VelocityEngine } from '../src/engine/index.js';
import { registerTools } from './tools.js';

async function main() {
  const dataDir = process.env['VELOCITY_DATA_DIR'] ?? process.cwd();

  // Single engine instance shared across all tool calls in this session
  const engine = await VelocityEngine.create({
    runtime: 'node',
    dataDir,
  });

  const server = new Server(
    { name: 'velocity', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  registerTools(server, engine);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Ensure the engine is closed cleanly on exit
  process.on('SIGINT', async () => {
    await engine.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await engine.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[velocity-mcp] Fatal error:', err);
  process.exit(1);
});
