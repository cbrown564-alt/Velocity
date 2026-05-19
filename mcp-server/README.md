# @velocity/mcp-server

MCP stdio transport over `VelocityEngine`. Thin handlers only — no business logic in this package.

Part of the root npm workspace (`packages/*`, `mcp-server`). Install from the repository root:

```bash
npm install --legacy-peer-deps
```

## Commands (from repository root)

| Script | Purpose |
| :--- | :--- |
| `npm run mcp:dev` | Run server via `tsx` (development) |
| `npm run mcp:build` | Vitest suite for MCP tool wiring |
| `npm run velocity-mcp-setup` | Smoke-test stdio connect + tool list |

## Configuration

See `docs/guide_agent_quickstart.md`. Typical Claude/Cursor entry:

```json
{
  "command": "node",
  "args": ["--import", "tsx", "mcp-server/index.ts"],
  "env": { "VELOCITY_DATA_DIR": "/path/to/survey/files" }
}
```

Engine code is imported from `../src/engine/` at runtime (not published as a separate npm package yet).
