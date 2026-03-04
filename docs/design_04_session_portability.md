# Design Brief: Session Portability & Storage Durability

**Author:** Architect (Claude Opus)
**Created:** 2026-02-26
**Status:** In Progress (implementation started 2026-03-04)
**Scope:** Session export/import, storage persistence hardening, user storage communication
**Phase:** Late Phase 2 / Early Phase 3 (cross-cutting local-first infrastructure)

---

## 1. Problem Statement

Velocity is a local-first tool. All data lives in the browser. Today this creates three concrete problems:

1. **No portability.** A researcher who analyzes data on their office machine cannot continue at home. A consultant cannot hand off analysis to a colleague. The only path is re-uploading the SAV file and manually reconstructing every recode, filter, and slide.

2. **Silent storage risk.** OPFS data can be evicted by the browser under storage pressure. The app never calls `navigator.storage.persist()` to request durable storage. Users have no visibility into where their data lives or how fragile it is.

3. **No backup mechanism.** OPFS is invisible to the OS filesystem. Standard backup tools (Time Machine, Backblaze, iCloud) do not capture it. A researcher who formats their machine loses all session state.

These are not theoretical — they are the primary barriers to professional adoption beyond single-session, single-device use.

---

## 2. Proposed Solution

Three features, designed to be built in sequence:

### Feature A: Storage Persistence & Communication
Request durable storage from the browser. Show users where their data lives and how safe it is.

### Feature B: Session Export
Package the analysis recipe (everything except raw respondent data) into a portable `.velocity` file the user can download.

### Feature C: Session Import
Upload a `.velocity` file on any device, re-upload the matching SAV, and have the app automatically restore the full analysis session.

Together, these solve multi-device access, colleague handoff, and backup — without any server infrastructure.

---

## 3. Architecture

### 3.1 What Goes Into a `.velocity` File

A `.velocity` file is a JSON document (optionally gzip-compressed) containing the analysis recipe. It contains **no respondent data** — no survey responses, no raw rows, no personally identifiable information. This means it is safe to email, share on Slack, or store in a cloud drive without IRB or data governance implications.

```typescript
interface VelocitySessionFile {
  // ── Format ──────────────────────────────────────────────────
  formatVersion: 1;
  exportedAt: string;                       // ISO 8601 timestamp
  velocityVersion: string;                  // App version at export time

  // ── Dataset Fingerprint ─────────────────────────────────────
  // Used to verify the user uploads the correct SAV on import.
  // Contains NO respondent data — only structural metadata.
  dataset: {
    originalFilename: string;               // e.g. "wave7_2024.sav"
    rowCount: number;
    source: 'sav' | 'csv' | 'arrow';
    fingerprint: {
      columnCount: number;
      columnNames: string[];                // Variable IDs only (no labels)
      checksum?: string;                    // SHA-256 of first 64KB of source file (optional)
    };
  };

  // ── Variable Metadata ───────────────────────────────────────
  // Full variable definitions including labels, types, value labels.
  // These are metadata about the survey instrument, not respondent data.
  variables: Variable[];
  variableSets: VariableSet[];
  folders: Folder[];

  // ── Transform Log ───────────────────────────────────────────
  // The ordered sequence of data transformations applied.
  // These are the "recipe" — replay them on a fresh SAV to reconstruct
  // all derived variables.
  transformLog: DataTransform[];

  // ── Analysis Configuration ──────────────────────────────────
  tableConfig: TableConfig;
  activeFilters: Filter[];
  analysisSettings?: Partial<AnalysisSettings>;

  // ── Analysis Deck ───────────────────────────────────────────
  slides: Slide[];
  sections: SlideSection[];

  // ── Workspace Context (optional) ────────────────────────────
  // Only present for multi-dataset / longitudinal sessions.
  workspace?: {
    projects: Project[];
    datasetLinks: Array<{
      datasetFilename: string;
      datasetRowCount: number;
      role: string;                         // e.g. "wave_1", "wave_2"
    }>;
  };

  // ── Harmonization Session (optional) ────────────────────────
  harmonizationSession?: HarmonizationSession | null;
}
```

### 3.2 What Is Explicitly Excluded

| Excluded | Reason |
|:---------|:-------|
| Raw data rows | Privacy. The SAV file contains respondent data and is never serialized into the session file. |
| OPFS file keys | Device-specific. Meaningless on another device. |
| Worker state | Ephemeral runtime state. |
| Query results | Regenerated on import by re-running analysis. |
| Variable stats cache | Regenerated on demand. |
| DuckDB database | Device-specific binary. Rebuilt from SAV + transform log. |

### 3.3 Import Flow

```
1. User opens Velocity (fresh or existing session)
2. "Import Session" → file picker → select .velocity file
3. App parses JSON, extracts dataset fingerprint
4. Shows confirmation modal:
   ┌──────────────────────────────────────────────┐
   │  Import Session                               │
   │                                               │
   │  This session was created with:               │
   │  📄 wave7_2024.sav (4,892 rows × 147 cols)   │
   │  📝 3 recoded variables                       │
   │  📊 8 analysis slides                         │
   │                                               │
   │  Please upload the matching dataset to         │
   │  restore your analysis.                       │
   │                                               │
   │  [ Drop SAV file here or click to browse ]    │
   │                                               │
   │  [Cancel]                         [Continue]  │
   └──────────────────────────────────────────────┘
5. User uploads SAV file
6. App verifies: rowCount matches, column names match
   - Strict match: exact column count + names → proceed
   - Partial match: >90% overlap → proceed with warning
   - Mismatch: <90% overlap → block with explanation
7. SAV is loaded into DuckDB via normal ingestion path
8. Transform log is replayed sequentially
9. Variable metadata is restored (labels, types, sets, folders)
10. Slides, filters, analysis config are restored
11. Analysis re-runs automatically
12. User sees their full session, exactly as exported
```

### 3.4 Storage Persistence

On app initialization, immediately after the worker reports `ready`:

```typescript
// Request persistent storage (prevents OPFS eviction)
if (navigator.storage?.persist) {
  const granted = await navigator.storage.persist();
  console.log(`🔒 [Storage] Persistent storage ${granted ? 'granted' : 'denied'}`);
}
```

This is a one-line addition that materially improves data durability. Chrome grants persistence automatically for installed PWAs and for sites with significant engagement. Firefox and Safari show a permission prompt.

### 3.5 Storage Status Communication

A small, non-intrusive status indicator in the app shell (bottom bar or settings panel) showing:

| State | Display |
|:------|:--------|
| Persistent storage granted, data loaded | "Session stored securely in this browser" |
| Persistent storage denied, data loaded | "Session stored locally — may be cleared by browser" |
| No data loaded | (hidden) |
| OPFS unavailable | "Limited storage — session will not persist between visits" |

Additionally, on first successful data load, a one-time toast notification:

> "Your data is stored locally in this browser only. Use **Export Session** to save a portable backup."

This sets correct expectations without requiring users to understand OPFS or browser storage internals.

---

## 4. Invariants & Constraints

### Architectural Invariants Preserved

| Invariant | How This Design Respects It |
|:----------|:---------------------------|
| **Worker-first compute** | Import triggers the same `loadSAV` → worker → DuckDB path as a normal upload. No new DuckDB access patterns. |
| **Dual-state data model** | `Variable[]` in the session file preserves both raw codes (valueLabels[].value) and string labels (valueLabels[].label). |
| **Core portability** | Export/import logic is pure serialization — no browser APIs needed. Can live in `src/core/session/`. |
| **No respondent data in export** | Enforced by the file format definition: variables (instrument metadata) are included; rows (respondent data) are not. |
| **Main thread zero** | Export is a JSON.stringify of existing state (sub-millisecond). Import triggers worker operations via existing message protocol. |

### Constraints & Risks

| Risk | Severity | Mitigation |
|:-----|:---------|:-----------|
| **Transform log incomplete** | Medium | Currently only covers `recode`. If new transform types are added (compute, merge, etc.), they must be added to the log before this feature ships. Gate: all transformations must be log-replayable. |
| **Format version drift** | Low | `formatVersion: 1` field enables future migration. Import function checks version and applies migrations if needed. |
| **Large session files** | Low | Session files are metadata-only. A dataset with 500 variables, 50 recodes, and 20 slides produces a ~200KB JSON. Optional gzip brings this under 50KB. |
| **Checksum mismatch on minor SAV edits** | Medium | The SHA-256 checksum (first 64KB) is optional and used as a hint, not a gate. Primary matching uses rowCount + columnNames, which are stable across minor SAV metadata edits. |
| **Slides reference variable IDs that don't exist in a different SAV** | Medium | Import validates all variable ID references against the uploaded SAV. Missing references are flagged in a diagnostic summary rather than silently dropped. |

---

## 5. Relationship to Sync Infrastructure

### Why We Are Not Building a Sync Server Now

The session export/import approach solves the three stated problems (multi-device, handoff, backup) with:
- **Zero server infrastructure** — no hosting, no authentication, no encryption key management
- **Zero ongoing operational cost** — the feature is a pure client-side function
- **Days of development** — versus weeks-to-months for a sync server
- **Perfect alignment with the existing user workflow** — researchers already manage SAV files via email, shared drives, and USB sticks. A `.velocity` file fits naturally alongside the `.sav` file.

### When a Sync Server Becomes Necessary

A sync server (following the Actual Budget model of encrypted event logs, not raw data) becomes justified only if user research reveals that the manual file transfer step creates unacceptable friction. The specific signals:

1. Users frequently abandon multi-device workflows because exporting/importing is too many steps.
2. Users lose work because they forget to export before switching devices.
3. A team use case emerges where multiple analysts need to build incrementally on a shared project and email-based handoff is too slow.

If these signals appear, the sync server would store:
- Encrypted `.velocity` session files (not SAV data)
- A device registry per user
- Sync metadata (last modified, conflict detection via version vectors)

The `.velocity` file format designed here becomes the sync primitive — the server would store and relay these files, not raw state. This means the export/import feature is not throwaway work; it is the foundational data contract that a future sync layer would build on.

### The Actual Budget Model: Complexity Assessment

For reference, what a minimal sync server would require:

| Component | Complexity | Notes |
|:----------|:-----------|:------|
| Server application | Medium | Node.js/Deno, ~500 LOC for REST API |
| Database | Low | SQLite or Postgres for session metadata |
| User authentication | High | Account creation, login, password reset, session tokens |
| E2E encryption | High | Client-side key derivation, vault passwords, key rotation |
| Conflict resolution | Medium | Version vectors; last-writer-wins per session is acceptable |
| Client sync protocol | Medium | Detect local changes, push, pull, merge |
| Infrastructure | Ongoing | Hosting, TLS, monitoring, backups, GDPR compliance for account data |
| **Total** | **High** | Weeks to months; ongoing operational cost |

The file-based approach achieves ~80% of the value at ~10% of the cost. The remaining 20% (automatic background sync) is a genuine UX improvement but not a prerequisite for professional adoption.

---

## 6. File Organization

New code locations:

```
src/core/session/                    # Headless session logic (no browser deps)
├── sessionExporter.ts               # Serialize state → VelocitySessionFile
├── sessionImporter.ts               # Parse VelocitySessionFile → state updates
├── sessionValidator.ts              # Validate format version, dataset match
└── sessionTypes.ts                  # VelocitySessionFile interface

src/components/overlays/
├── SessionExportModal.tsx           # Export confirmation + download trigger
└── SessionImportModal.tsx           # Import flow: file upload → SAV upload → restore

src/components/common/
└── StorageStatusIndicator.tsx       # Persistent storage status badge
```

Session logic lives in `src/core/session/` — it has **zero browser dependencies**. It accepts plain objects (the Zustand state subset) and returns plain objects (the session file structure). This preserves the headless core invariant from `arch_03` and means the CLI could also export/import sessions in the future.

---

## 7. Test Strategy

| Layer | Tests | What They Verify |
|:------|:------|:-----------------|
| **Unit: sessionExporter** | Given a known state snapshot, produces expected JSON structure | Format correctness, no respondent data leakage, all metadata preserved |
| **Unit: sessionImporter** | Given a known `.velocity` file, produces correct state updates | Variable restoration, transform log parsing, slide reconstruction |
| **Unit: sessionValidator** | Given mismatched datasets, produces correct diagnostics | Column mismatch detection, partial match scoring, version migration |
| **Integration: round-trip** | Export → Import → Compare | State equality after round-trip (minus ephemeral fields) |
| **Integration: transform replay** | Import session with recodes → verify DuckDB has derived columns | Transform log replay correctness |
| **Manual: cross-device** | Export on Chrome Mac → Import on Firefox Windows | Cross-browser portability |

---

## 8. Implementation Sequence

### Step 1: Storage Persistence & Communication (< 1 day)
- Add `navigator.storage.persist()` call in app init
- Add `StorageStatusIndicator` component
- Add one-time toast on first data load

### Step 2: Session Types & Exporter (1–2 days)
- Define `VelocitySessionFile` in `src/core/session/sessionTypes.ts`
- Implement `exportSession()` in `src/core/session/sessionExporter.ts`
- Wire "Export Session" action in the UI (settings menu or app shell)
- Unit tests for export

### Step 3: Session Validator & Importer (2–3 days)
- Implement `validateSessionFile()` and dataset matching logic
- Implement `importSession()` state restoration
- Wire transform log replay into the import flow
- Unit tests for import and validation

### Step 4: Import Modal UI (1–2 days)
- Build `SessionImportModal` with two-step flow (session file → SAV file)
- Match verification UX with diagnostic feedback
- Integration test: full round-trip

### Step 5: Polish & Edge Cases (1 day)
- Gzip compression for large sessions
- Partial match warnings
- Missing variable reference diagnostics
- Cross-browser testing

**Total estimated scope:** 6–9 days of implementation.

---

## 9. Decision Record

| Decision | Rationale |
|:---------|:----------|
| **File-based portability over sync server** | Solves the stated problems at 10% of the complexity. No infrastructure debt. No authentication system. The file format becomes the foundation for a future sync layer if needed. |
| **JSON format (not binary)** | Human-readable, debuggable, trivially extensible. Session files are small (~50–200KB). Binary packing adds complexity for negligible size savings. |
| **No respondent data in session file** | Non-negotiable privacy constraint. Session files must be safe to share without data governance review. |
| **Checksum as hint, not gate** | SAV files may have minor metadata differences across exports. Blocking on exact match would create false negatives. Column name matching is the reliable structural check. |
| **Core logic in `src/core/session/`** | Preserves headless core invariant. CLI can reuse. No browser dependency in serialization logic. |
| **`navigator.storage.persist()` on init** | One line of code. Materially reduces OPFS eviction risk. No downside. Should have been added at the same time as OPFS persistence. |

---

## 10. References

- `docs/arch_01_system_architecture.md` — System boundaries (worker, store, UI)
- `docs/arch_03_headless_core.md` — Headless core seam and `DatabaseAdapter` interface
- `docs/arch_06_local_first_persistence.md` — OPFS persistence strategy and failure modes
- `docs/design_01_system.md` — Semantic tokens for UI components
- `docs/design_02_ux_modes.md` — Mode separation (Canvas vs Manager)
- `src/store/persistConfig.ts` — Current `PersistedState` interface (lines 39–64)
- `src/store/slices/dataSlice.ts` — `DataTransform` type (line 148), `Variable`/`Dataset` types (lines 30–69)
- `src/types/slides.ts` — `Slide`, `SlideSection`, `SlideAnalysisState` types
- `src/store/slices/analysisSlice.ts` — `TableConfig`, `Filter`, `AnalysisSettings` types
- `docs/blue_02_feature_matrix.md` — Scope governance (Keep/Delay/Reject)
- `docs/roadmap_00_strategic_guide.md` — Strategic sequencing

---

## 11. Implementation Log

### 2026-03-04

- Completed: Corrected dataset fingerprint export logic to exclude transform-generated columns (for example, recode outputs), so import matching validates against the original source schema rather than derived runtime columns.
- Completed: Added regression coverage in `src/core/session/sessionExporter.test.ts` to protect this behavior.
- Verified: `vitest run src/core/session` passes after the change.
- Completed: Added optional gzip codec support for session files. Export now auto-compresses larger payloads when `CompressionStream` is available, producing `.velocity.gz`. Import auto-detects gzip files (extension or magic header) and decompresses via `DecompressionStream`.
- Open: Surface session import diagnostics to end users (currently logged to console).
