# Verify a change

Run focused tests while developing, then use the checks relevant to the result:

- Run `npm run ci` before claiming a code change is broadly complete. This is the same command GitHub runs.
- Run `npm run test:e2e` when a browser interaction, persistence path, or export journey changes.
- Inspect changed UI and exported files directly. Run specialist parity, coverage, mutation, visual, production, or research checks only when they answer a concrete question about the change.
- For documentation only, run `npm run format:check`.

Report what passed and any material check that was not run. Automated checks verify implementation; the product owner decides whether a research workflow is useful enough to extend or share.

For a new clone, initialize `packages/readstat-wasm`, install dependencies with `npm ci --legacy-peer-deps`, and install Playwright browsers before browser tests.
