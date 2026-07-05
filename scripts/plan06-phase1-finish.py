#!/usr/bin/env python3
"""Plan 06 Phase 1 — subtract WebR, harmonization, dead code."""
import json, re, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text()
def write(p,t): (ROOT/p).write_text(t)

DELETE = [
  "src/services/duckDb.ts","src/services/simulation.ts","src/services/AgentBridge.ts",
  "src/components/common/RCodeEditor.tsx","src/components/common/RCodeEditor.module.css",
  "src/components/common/AdvancedAnalysisPanel.tsx","src/components/common/AdvancedAnalysisPanel.module.css",
  "src/engine/webr","src/services/webRWorker.ts","src/store/slices/webrSlice.ts","src/types/webr.ts",
  "src/core/analysis/runners/MixedEffectsRunner.ts","src/core/analysis/runners/SurveyWeightingRunner.ts",
  "src/core/harmonization","src/features/harmonization",
  "src/store/slices/harmonizationSlice.ts","src/store/slices/harmonizationSlice.test.ts",
  "src/services/worker/engineHandlersHarmonization.ts","src/types/harmonization.ts",
  "mcp-server/handlers/harmonization.ts","src/test/fixtures/harmonization.ts",
]
for rel in DELETE:
  p = ROOT/rel
  if p.is_dir(): shutil.rmtree(p, ignore_errors=True)
  elif p.exists(): p.unlink()
ad = ROOT/"docs/archive/2026-07/plan-06-phase-1/scripts"; ad.mkdir(parents=True, exist_ok=True)
stale = ROOT/"scripts/design-reset-palette-open-benchmark.mjs"
if stale.exists(): shutil.move(str(stale), str(ad/stale.name))

# session legacy types
st = read("src/core/session/sessionTypes.ts")
st = st.replace("import type { HarmonizationSession } from '../../types/harmonization';",
"""/** Legacy session block — harmonization UI removed Plan 06 Phase 1. */
export interface LegacyHarmonizationSession {
  id: string; sourceDatasetId: string; targetDatasetId: string;
  mappings: unknown[]; createdAt: number; updatedAt: number; outputTableName: string | null;
}
""")
st = st.replace("harmonizationSession?: HarmonizationSession | null;", "harmonizationSession?: LegacyHarmonizationSession | null;")
write("src/core/session/sessionTypes.ts", st)
si = read("src/core/session/sessionImporter.ts").replace("import type { HarmonizationSession } from '../../types/harmonization';",
  "import type { LegacyHarmonizationSession } from './sessionTypes';")
si = si.replace("harmonizationSession: HarmonizationSession | null;", "harmonizationSession: LegacyHarmonizationSession | null;")
write("src/core/session/sessionImporter.ts", si)

# store
idx = read("src/store/index.ts")
for o,n in [("  createWebRSlice,\n  type WebRSlice,\n",""),("  createHarmonizationSlice,\n  type HarmonizationSlice,\n",""),
  ("      ...createWebRSlice(...args),\n",""),("      ...createHarmonizationSlice(...args),\n",""),
  ("  WebRSlice &\n  WorkspaceSlice &\n  HarmonizationSlice;","  WorkspaceSlice;")]: idx=idx.replace(o,n)
write("src/store/index.ts", idx)
sidx = read("src/store/slices/index.ts")
sidx = sidx.replace("export { createWebRSlice, type WebRSlice, type WebRStatus } from './webrSlice';\n","")
sidx = sidx.replace("export { createHarmonizationSlice, type HarmonizationSlice } from './harmonizationSlice';\n","")
write("src/store/slices/index.ts", sidx)
pc = read("src/store/persistConfig.ts")
pc = pc.replace("  harmonizationSession: VelocityState['harmonization']['session'];\n\n","")
pc = pc.replace("    harmonizationSession: state.harmonization?.session ?? null,\n\n","")
pc = re.sub(r"    if \(state\.harmonization\?\.session\) \{[\s\S]*?\n    \}\n","",pc,count=1)
write("src/store/persistConfig.ts", pc)

# analysis
at = read("src/types/analysis.ts")
at = at.replace("export type AnalysisEngine = 'auto' | 'duckdb' | 'webr';","export type AnalysisEngine = 'auto' | 'duckdb';")
at = re.sub(r"  /\*\* Analysis engine selection: auto selects WebR[\s\S]*?enableDesignEffects: boolean;\n",
  "  /** Analysis engine selection (DuckDB-backed crosstabs in the wedge). */\n  engine: AnalysisEngine;\n", at)
write("src/types/analysis.ts", at)
write("src/store/slices/analysisSlice.ts", read("src/store/slices/analysisSlice.ts").replace("  enableDesignEffects: false,\n",""))
write("src/types/engineWorker.ts", read("src/types/engineWorker.ts"))
ew = read("src/types/engineWorker.ts")
ew = re.sub(r"\n    // --- Harmonization ---\n    \| \{ type: 'engine\.getValueFrequencies'[\s\S]*?keyColumn: string \}\n", "\n", ew, count=1)
ew = re.sub(r"\n    // --- Harmonization ---\n    \| \{ type: 'engine\.valueFrequencies'[\s\S]*?overlap: number \}\n", "\n", ew, count=1)
write("src/types/engineWorker.ts", ew)

# worker types
wt = read("src/types/worker.ts").replace("import type { VariableMapping } from './harmonization';\n","")
wt = re.sub(r"    \| \{ type: 'getValueFrequencies'[\s\S]*?getRespondentOverlap'[\s\S]*?\n","",wt,count=1)
for line in ["valueFrequencies","harmonizedTableCreated","respondentOverlap"]: wt=wt.replace(f"    | {{ type: '{line}'","REMOVED")
wt = "\n".join(l for l in wt.splitlines() if not l.strip().startswith("REMOVED"))
write("src/types/worker.ts", wt)

# engineHandlers
eh = read("src/services/worker/engineHandlers.ts")
if "engineHandlersHarmonization" in eh:
  ea = """
  'engine.exportArrow': async (request) => {
    if (request.type !== 'engine.exportArrow') return;
    const arrow = await import('apache-arrow');
    const { conn } = workerDbState;
    if (!conn) throw new Error('DB not initialized');
    const start = performance.now();
    const result = await conn.query(request.sql);
    const ipcBuffer = arrow.tableToIPC(result);
    postEngineTransfer({ type: 'engine.arrowExported', requestId: request.requestId,
      buffer: ipcBuffer.buffer as ArrayBuffer, rowCount: result.numRows, durationMs: performance.now()-start },
      [ipcBuffer.buffer as Transferable]);
  },
"""
  eh = eh.replace("import { engineHandlersHarmonization } from './engineHandlersHarmonization';\n","")
  eh = eh.replace("import { postEngineResponse } from './engineMessaging';","import { postEngineResponse, postEngineTransfer } from './engineMessaging';")
  eh = eh.replace("  ...engineHandlersHarmonization,\n\n  'engine.close'", ea+"  'engine.close'")
  write("src/services/worker/engineHandlers.ts", eh)

# EngineProxy / BrowserEngine
ep = read("src/services/EngineProxy.ts").replace("import type { VariableMapping } from '../types/harmonization';\n","")
ep = re.sub(r"\n  // =+\n  // Harmonization[\s\S]*?\n  // =+\n  // Cleanup","\n  // ==========================================================================\n  // Cleanup",ep,count=1)
write("src/services/EngineProxy.ts", ep)
be = read("src/engine/BrowserEngine.ts").replace("import type { VariableMapping } from '../types/harmonization';\n","")
be = re.sub(r"\n  async getValueFrequencies\([\s\S]*?\n  \}\n\n  dispose\(\)","\n  dispose()",be,count=1)
write("src/engine/BrowserEngine.ts", be)

# VelocityEngine / workspaceManager
ve = read("src/engine/VelocityEngine.ts")
for imp in ["import { buildHarmonizedTableQuery } from '../core/harmonization/harmonizationQueries';\n",
  "import { autoMatchVariables } from '../core/harmonization/matchEngine';\n",
  "import type { VariableMapping } from '../types/harmonization';\n"]: ve=ve.replace(imp,"")
ve = re.sub(r"\n  async proposeMappings\([\s\S]*?\n  \}\n\n  async loadWorkspaceDataset\(", "\n  async loadWorkspaceDataset(", ve, count=1)
ve = re.sub(
    r"\n  proposeWorkspaceMappings\([\s\S]*?\n  \}\n\n  async harmonizeWorkspaceDatasets\([\s\S]*?\n  \}\n\n  async importSession\(",
    "\n  async importSession(",
    ve,
    count=1,
)
write("src/engine/VelocityEngine.ts", ve)
wm = read("src/engine/workspaceManager.ts")
for imp in ["import { autoMatchVariables } from '../core/harmonization/matchEngine';\n",
  "import { buildHarmonizedTableQuery } from '../core/harmonization/harmonizationQueries';\n",
  "import type { VariableMapping } from '../types/harmonization';\n"]: wm=wm.replace(imp,"")
wm = re.sub(r"\n  proposeWorkspaceMappings\([\s\S]*?\n  \}\n\}","\n}",wm,count=1)
write("src/engine/workspaceManager.ts", wm)

# App / hooks / ModalHost
app = read("src/App.tsx")
app = app.replace("  const harmonization = useVelocityStore((state) => state.harmonization);\n","")
app = re.sub(r"        harmonization=\{\{[\s\S]*?\}\}\n","",app,count=1)
app = app.replace("        onOpenHarmonization={workspaceOrchestration.handleOpenHarmonization}\n","")
write("src/App.tsx", app)
mh = read("src/app/components/ModalHost.tsx")
mh = mh.replace("import { HarmonizationWorkspace } from '../../features/harmonization';\n","")
mh = re.sub(r"  harmonization: \{[\s\S]*?\};\n","",mh,count=1)
mh = mh.replace("  harmonization,\n","").replace("  onOpenHarmonization: (w1: StoredDataset, w2: StoredDataset) => void;\n","")
mh = mh.replace("  onOpenHarmonization,\n","").replace("        onOpenHarmonization={onOpenHarmonization}\n","")
mh = re.sub(r"\n    \{harmonization\.isOpen[\s\S]*?\n      \)\}\n","",mh,count=1)
write("src/app/components/ModalHost.tsx", mh)
usc = read("src/app/hooks/useSessionLifecycle.ts")
usc = usc.replace("  const harmonization = useVelocityStore((state) => state.harmonization);\n","")
usc = usc.replace("      harmonizationSession: harmonization.session,\n","      harmonizationSession: null,\n")
usc = usc.replace("    harmonization.session,\n","")
usc = re.sub(r"          harmonization: \{[\s\S]*?\},\n","",usc,count=1)
write("src/app/hooks/useSessionLifecycle.ts", usc)
orch = read("src/app/hooks/useWorkspaceOrchestration.ts")
for s in ["  handleOpenHarmonization: (w1: StoredDataset, w2: StoredDataset) => void;\n",
  "  harmonizationSourceDataset: StoredDataset | null;\n","  harmonizationTargetDataset: StoredDataset | null;\n",
  "  harmonizationSourceVars: Variable[] | null;\n","  harmonizationTargetVars: Variable[] | null;\n",
  "  const harmonization = useVelocityStore((state) => state.harmonization);\n",
  "  const openHarmonization = useVelocityStore((state) => state.openHarmonization);\n",
  "  const closeHarmonization = useVelocityStore((state) => state.closeHarmonization);\n"]: orch=orch.replace(s,"")
orch = re.sub(r"\n  const handleOpenHarmonization = useCallback\([\s\S]*?\n  \);\n","",orch,count=1)
orch = re.sub(r"\n\n  useEffect\(\(\) => \{\n    if \(!harmonization\.isOpen\)[\s\S]*?\n  \}, \[harmonization\.isOpen[\s\S]*?\]\);\n","",orch,count=1)
for s in ["    handleOpenHarmonization,\n","    harmonizationSourceDataset,\n","    harmonizationTargetDataset,\n",
  "    harmonizationSourceVars,\n","    harmonizationTargetVars,\n"]: orch=orch.replace(s,"")
orch = re.sub(r"\n  const harmonizationSession = harmonization\.session;[\s\S]*?\n  const harmonizationTargetVars = useMemo\([\s\S]*?\n  \);\n","",orch,count=1)
write("src/app/hooks/useWorkspaceOrchestration.ts", orch)

# workspace UI
cwp = read("src/features/workspace/components/CrossWavePanel.tsx")
cwp = cwp.replace("  /** Callback to open Harmonization Workspace for two waves */\n  onOpenHarmonization?: (wave1: StoredDataset, wave2: StoredDataset) => void;\n","")
cwp = cwp.replace("  onOpenHarmonization,\n","").replace("        onOpenHarmonization={onOpenHarmonization}\n","")
cwp = re.sub(r"\n      \{/\* Variable Harmonization \*/\}[\s\S]*?\n      \)\}\n    </ModalShell>","\n    </ModalShell>",cwp,count=1)
write("src/features/workspace/components/CrossWavePanel.tsx", cwp)
wv = read("src/features/workspace/components/WorkspaceView.tsx")
wv = wv.replace("  computeHarmonizationStatus,\n","").replace("                      harmonizationStatus={computeHarmonizationStatus(project, pDatasets)}\n","")
write("src/features/workspace/components/WorkspaceView.tsx", wv)
wpc = read("src/features/workspace/components/WorkspaceProjectCard.tsx")
wpc = wpc.replace("  harmonizationStatus: 'complete' | 'partial' | 'none';\n","").replace("harmonizationStatus, ","")
wpc = re.sub(r"\n      \{project\.isLongitudinal && harmonizationStatus !== 'none' && \([\s\S]*?\)\}\n","",wpc,count=1)
write("src/features/workspace/components/WorkspaceProjectCard.tsx", wpc)
lib = read("src/features/workspace/lib/workspaceLibrary.ts")
lib = lib.replace("export type HarmonizationRingStatus = 'complete' | 'partial' | 'none';\n\n","")
lib = re.sub(r"/\*\* Harmonization ring[\s\S]*?\n\}\n\n","",lib,count=1)
write("src/features/workspace/lib/workspaceLibrary.ts", lib)
wlt = read("src/features/workspace/lib/workspaceLibrary.test.ts").replace("  computeHarmonizationStatus,\n","")
wlt = re.sub(r"\n  it\('computeHarmonizationStatus[\s\S]*?\n  \}\);\n","",wlt,count=1)
write("src/features/workspace/lib/workspaceLibrary.test.ts", wlt)
wpct = read("src/features/workspace/components/WorkspaceProjectCard.test.tsx")
wpct = wpct.replace('        harmonizationStatus="none"\n',"").replace('        harmonizationStatus="complete"\n',"")
wpct = re.sub(r"\n  it\('shows harmonization ring[\s\S]*?\n  \}\);\n","",wpct,count=1)
write("src/features/workspace/components/WorkspaceProjectCard.test.tsx", wpct)
write("src/store/persistence.test.ts", read("src/store/persistence.test.ts").replace("        harmonization: { session: null },\n",""))

# MCP
write("mcp-server/handlers/index.ts", read("mcp-server/handlers/index.ts").replace("import { harmonizationHandlers } from './harmonization.js';\n","").replace("  ...harmonizationHandlers,\n",""))
dl = read("mcp-server/handlers/dataLifecycle.ts").replace("import type { VariableMapping } from '../../src/types/harmonization.js';\n","")
dl = re.sub(r"\n  velocity_workspace_propose_mappings:[\s\S]*?\n  \},\n","",dl,count=1)
dl = re.sub(r"\n  velocity_workspace_harmonize:[\s\S]*?\n  \},\n","",dl,count=1)
write("mcp-server/handlers/dataLifecycle.ts", dl)
schemas = read("mcp-server/schemas.ts")
schemas = re.sub(r"\n  \{\n    name: 'velocity_workspace_propose_mappings',[\s\S]*?\n  \},\n  \{\n    name: 'velocity_workspace_harmonize',[\s\S]*?\n  \},","",schemas,count=1)
schemas = re.sub(r"\n  // Harmonization\n  \{\n    name: 'velocity_propose_mappings',[\s\S]*?\n  \},\n  \{\n    name: 'velocity_build_harmonized_table',[\s\S]*?\n  \},","",schemas,count=1)
schemas = schemas.replace("Use for cross-wave harmonization. Set metadataOnly","Set metadataOnly")
write("mcp-server/schemas.ts", schemas)

# tests
ep = read("src/services/EngineProxy.test.ts")
ep = re.sub(r"\n    \{\n      method: 'getValueFrequencies',[\s\S]*?\n    \},\n    \{\n      method: 'buildHarmonizedTable',[\s\S]*?\n    \},\n    \{\n      method: 'getRespondentOverlap',[\s\S]*?\n    \},","",ep,count=1)
write("src/services/EngineProxy.test.ts", ep)
bet = read("src/engine/BrowserEngine.test.ts")
bet = bet.replace("    'getValueFrequencies',\n","").replace("    'buildHarmonizedTable',\n","").replace("    'getRespondentOverlap',\n","")
bet = re.sub(r"\n    \{ method: 'getValueFrequencies',[\s\S]*?\n    \},\n    \{\n      method: 'buildHarmonizedTable',[\s\S]*?\n    \},\n    \{ method: 'getRespondentOverlap',[\s\S]*?\n    \},","",bet,count=1)
write("src/engine/BrowserEngine.test.ts", bet)
vet = read("src/engine/VelocityEngine.test.ts")
vet = vet.replace("""  it('exposes chart, mapping, and harmonization helpers over the active dataset', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });
    await engine.loadFile('/data/brand_tracker.sav');

    const chart = await engine.recommendChart(['Q1'], 'GENDER');
    expect(chart.operation).toBe('recommendChart');
    expect(chart.data).toBeDefined();

    const mappings = await engine.proposeMappings(['Q1'], ['Q1']);
    expect(mappings.operation).toBe('proposeMappings');
    expect(Array.isArray(mappings.data)).toBe(true);

    const harmonized = await engine.buildHarmonizedTable('wave1', 'wave2', [], {}, {});
    expect(harmonized.operation).toBe('buildHarmonizedTable');
    expect(harmonized.data.sql).toContain('SELECT');
  });
""","""  it('exposes chart recommendation over the active dataset', async () => {
    const adapter = new MockAdapter();
    const engine = await VelocityEngine.create({ runtime: 'node', adapter });
    await engine.loadFile('/data/brand_tracker.sav');
    const chart = await engine.recommendChart(['Q1'], 'GENDER');
    expect(chart.operation).toBe('recommendChart');
    expect(chart.data).toBeDefined();
  });
""")
write("src/engine/VelocityEngine.test.ts", vet)
mcp = read("mcp-server/__tests__/tools.test.ts")
mcp = re.sub(r"\n    harmonizeWorkspaceDatasets: vi\.fn\(\)\.mockResolvedValue\(\{[\s\S]*?\}\),\n","",mcp,count=1)
mcp = re.sub(r"\n    buildHarmonizedTable: vi\.fn\(\)\.mockResolvedValue\(\{[\s\S]*?\}\),\n","",mcp,count=1)
mcp = re.sub(r"\ndescribe\('velocity_workspace_harmonize'[\s\S]*?\n\}\);\n","",mcp,count=1)
mcp = re.sub(r"\ndescribe\('velocity_propose_mappings'[\s\S]*?\n\}\);\n","",mcp,count=1)
write("mcp-server/__tests__/tools.test.ts", mcp)
for rel in ["src/features/dashboard/components/RecipeInspector.test.tsx","src/features/dashboard/DashboardShell.test.tsx","src/features/dashboard/components/DataTable.test.tsx"]:
  p=ROOT/rel
  if p.exists(): p.write_text(p.read_text().replace("        enableDesignEffects: false,\n","").replace("      enableDesignEffects: false,\n",""))

# demo
demo = read("scripts/brand-tracker-recipe-demo.ts")
if "proposeWorkspaceMappings" in demo:
  demo = re.sub(r"  // ── Step 3: Map renamed attribute variables[\s\S]*?logGap\(\n    'INF-08',[\s\S]*?\n  \);\n",
    "  section('STEP 3 · Fuzzy variable mapping (skipped — harmonization excised)');\n  console.log('  ⊘ Skipped: harmonization removed Plan 06 Phase 1');\n  logGap('INF-08','Harmonization cluster removed; recipe continues with in-wave recodes only.');\n",demo,count=1)
  write("scripts/brand-tracker-recipe-demo.ts", demo)

# telemetry
po = read("src/services/pilotOnboarding.ts")
if "sav_legacy_ingestion" not in po:
  po = po.replace("  | 'workspace_reopened';","  | 'workspace_reopened'\n  | 'sav_legacy_ingestion';")
  write("src/services/pilotOnboarding.ts", po)
scl = read("src/services/worker/savChunkedLoader.ts")
if "recordPilotEvent" not in scl:
  scl = scl.replace("import { workerDbState } from './workerDbState';","import { recordPilotEvent } from '../pilotOnboarding';\nimport { workerDbState } from './workerDbState';")
  scl = scl.replace("  if (ENABLE_SAV_STREAMING_LEGACY) {\n    return loadSAVChunkedLegacy(buffer, chunkSize, onProgress);\n  }",
    "  if (ENABLE_SAV_STREAMING_LEGACY) {\n    recordPilotEvent('sav_legacy_ingestion', { fileSizeBytes: buffer.byteLength, route: 'legacy_chunked_fallback' });\n    return loadSAVChunkedLegacy(buffer, chunkSize, onProgress);\n  }")
  write("src/services/worker/savChunkedLoader.ts", scl)

# package / vite / vitest
pkg = json.loads((ROOT/"package.json").read_text())
pkg["dependencies"].pop("@monaco-editor/react", None); pkg["dependencies"].pop("webr", None)
pkg["scripts"].pop("eval:05b:engine", None)
(ROOT/"package.json").write_text(json.dumps(pkg, indent=2)+"\n")
vite = read("vite.config.ts")
vite = vite.replace("import { defineConfig, loadEnv } from 'vite';","import { defineConfig } from 'vite';")
vite = vite.replace("export default defineConfig(({ mode }) => {\n  const env = loadEnv(mode, '.', '');\n  return {","export default defineConfig(() => ({")
vite = re.sub(r"\n    define: \{[\s\S]*?\},\n","",vite,count=1)
vite = vite.replace("      exclude: ['@velocity/readstat-wasm', 'webr'],","      exclude: ['@velocity/readstat-wasm'],")
vite = re.sub(r"\n            if \(id\.includes\('webr'\)\) \{\n              return 'webr-vendor';\n            \}\n","",vite,count=1)
write("vite.config.ts", vite)
write("vitest.config.ts", read("vitest.config.ts").replace("        'src/engine/webr/',\n","").replace("        'src/store/slices/webrSlice.ts',\n",""))
print("ok")
