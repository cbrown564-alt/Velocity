# Frontend And UI Architecture Maturity Review

Date: 2026-05-19

Scope: React UI architecture, design system integrity, component boundaries, interaction coherence, accessibility, and testability. Read-only audit; no files modified.

## Summary Judgment

Frontend maturity is mixed. The three-mode shell and token-based theming are solid foundations, but monolithic files, inconsistent styling layers, raw Tailwind/legacy token usage, overlay sprawl, and thin UI test/accessibility coverage keep the design system from production-grade coherence.

The essential architecture is present and worth keeping. The gap is execution discipline, not missing concepts.

## Strengths

### Three-Mode UX Is Real

The Workspace to Analysis Canvas to Variable Manager overlay model is implemented rather than aspirational.

- `AppShell` implements the documented soft-modal overlay behavior: canvas scale/blur, Variable Manager slide-in, and keyboard toggling with input guards.
- `App.tsx` routes `splash`, `uploading`, `dashboard`, `restoring`, and `metadata`.
- `WorkspaceView` is a separate workspace surface.

### Design System Plumbing Is Sound

- `index.css` defines semantic aliases such as `--bg-app`, `--text-primary`, status tokens, and visualization layers on top of per-theme primitives.
- `ThemeContext` injects theme colors/materials at runtime.
- Tailwind is configured to work with CSS variables, which is the right hybrid pattern when utilities stay token-backed.

### Feature-Level Architecture Choices

- `DashboardShell` centralizes analysis canvas behavior after extraction from the old app monolith.
- `VirtualizedVariableList`, `useResolvedVariables`, `SlideContainer`, and `DataTable` separate data resolution and presentation reasonably well.
- Variable Manager uses Miller columns and facet search, matching the documented “data gardening” spoke.
- Some focused UI tests exist for high-risk interaction points: drop zones, row shelf sorting, slide container, timeline dock, and draggable variables.

### Workspace Polish

Workspace has a cohesive library-browser UI and explicit theme work, including liquid-glass overrides. It is visually ambitious, though not yet structurally mature.

## Issues

### Monolith Orchestration

| File | Approximate LOC | Issue |
|---|---:|---|
| `src/App.tsx` | 868 | Owns mode machine, workspace handlers, harmonization wiring, global modals, session import/export, restoration/metadata flows, and toasts. |
| `src/features/workspace/components/WorkspaceView.tsx` | 1028 | Single component for library UI, projects, filters, batch actions, and subcomponents. |
| `src/features/dashboard/DashboardShell.tsx` | 615 | DnD, persistence UI, header actions, and canvas behavior in one file. Focused but still heavy. |
| `src/components/overlays/ExportModal.tsx` | 526 | Complex export UI in one overlay. |

`App.tsx` mounts many overlays inline: data drawer, recode modal, filter modal, project modal, cross-wave panel, harmonization workspace, export/import modal, export modal, and session modals. There is no clear modal host or overlay composition boundary.

### Theme And Token Compliance

Raw Tailwind palette classes bypass the theme system on primary surfaces:

- `DashboardShell.tsx`: `bg-indigo-50/30`
- `App.tsx`: `bg-white`, `bg-indigo-100`, `text-indigo-600`, `text-white`, `shadow-indigo-500/20`
- `ConvertSystemMissingModal.tsx`: `bg-white`, `text-gray-*`, `bg-indigo-600`
- Other modal/dashboard components: red, amber, stone, gray, and white classes

Legacy or undefined tokens remain in common components:

- `DataDrawer.tsx`: `--color-paper`, `--color-ink`, `--color-terracotta`, `--gray-*`
- `FilterBar.tsx`, `FilterChip.tsx`, `AvatarGroup.tsx`, `CollaboratorCursor.tsx`: related legacy token usage

CSS fallback hexes mask missing tokens and break theme parity:

- `WorkspaceView.module.css`
- `VariableInspector.module.css`
- `CrossWavePanel.module.css`
- `ExportImportModal.module.css`
- Harmonization CSS modules

Deprecated fonts are still loaded even though the legacy Research Desk language has been deprecated. If Atkinson is needed for PPTX, document it as a scoped exception.

### Interaction Coherence

- No shared modal/dialog primitive: each overlay reimplements backdrop, centering, motion, and z-index behavior.
- Z-index ladder is ad hoc: `z-40`, `z-50`, `z-[100]`, `z-[110]`, `z-[120]`, `z-[121]`, `z-[140]`, `z-[9999]`, and `z-[1000]` appear across surfaces.
- Some destructive flows still use native `window.confirm` / `alert`.
- Some global paths have stub or duplicate logic, including recode/filter save paths that should be consolidated.
- Theme switching UI under-discovers the third theme.

### Accessibility And Testability

- Many icon buttons lack accessible names.
- Most modals do not consistently provide `role="dialog"`, `aria-modal`, focus trapping, and return focus.
- There are very few stable `data-testid` anchors for end-to-end tests.
- UI test coverage lags behind core coverage. Headless logic is well tested; feature surfaces and modals are not.

### Styling Architecture Drift

The hybrid CSS model is acceptable, but the implementation is inconsistent:

- Dashboard and Variable Manager rely heavily on Tailwind-in-TSX.
- Workspace and harmonization rely on large CSS modules.
- Some slide chrome uses plain CSS imports.
- Liquid Glass behavior appears through a mix of global attribute selectors and component-level overrides.

## Bloat And Duplication

| Item | Evidence | Verdict |
|---|---|---|
| `FolderPanel.tsx` | Exported but not imported in the active Miller layout | Likely dead or superseded code |
| `CollaboratorCursor.tsx` / `AvatarGroup.tsx` | No clear active feature imports | Likely placeholder collaboration UI |
| Many modal implementations | No shared `Modal` / `Dialog` base | Duplicate motion/backdrop/focus patterns |
| Duplicate filter-save logic | App and DashboardShell both handle similar flows | Consolidate ownership |
| `WorkspaceView.module.css` | Large one-off stylesheet | Maintainability risk |
| Legacy plus semantic tokens | Same component families use both | Doubles contributor mental model |
| Framer Motion everywhere | Useful for mode transitions, excessive for simple toasts/buttons | Reserve for major transitions |

Essential to keep: `AppShell`, `DashboardShell`, Miller columns, `VirtualizedVariableList`, `ThemeContext`, token layer, and the workspace library concept.

Bloat to trim or consolidate: dead folder/collaboration widgets, copy-paste modals, fallback-hex CSS, duplicate handlers, and decorative affordances that do not support core workflows.

## Recommendations

### P0

1. Enforce semantic tokens on primary surfaces: Dashboard, App restoration/metadata screens, DataDrawer, shelves, and top modals.
2. Define missing semantic tokens: `--text-tertiary`, `--bg-hover`, and standardized `--status-*`. Do not add gray palette aliases.
3. Establish an overlay layer contract: one z-index scale and one shared `ModalRoot` / `Dialog` component.
4. Fix broken/global interaction paths: replace primary `window.confirm` / `alert` flows and remove stubbed modal handlers.

### P1

1. Finish App decomposition into feature shells: `WorkspaceShell`, `SessionShell`, and `ModalHost`.
2. Split `WorkspaceView` into presentational cards/list components plus hooks.
3. Delete or wire dead UI components.
4. Add UI test anchors and baseline tests for open dataset, row/col drop, Variable Manager toggle, export/session flows, and modal focus behavior.
5. Extract dashboard DnD logic into a `useDashboardDnD` hook.

### P2

1. Decide and document CSS strategy by surface.
2. Remove deprecated font imports or document export-specific exceptions.
3. Unify slide chrome under CSS modules or shared typography utilities.
4. Expose all three themes in the theme picker.
5. Reduce motion usage where CSS transitions are sufficient.
6. Lazy-load `HarmonizationWorkspace`, export modals, and WebR/advanced panels.

## Maturity Grades

| Area | Grade | Note |
|---|---|---|
| Information architecture | B+ | Three modes are real and conceptually sound. |
| Design system / tokens | C | Strong docs and injection; weak compliance. |
| Component boundaries | C- | Extraction started; App and Workspace remain monoliths. |
| Interaction coherence | C | DnD is strong; modals/z-index are fragmented. |
| Accessibility | D+ | Sparse ARIA and inconsistent modal behavior. |
| UI testability | D | Core is tested; UI mostly is not. |
| Visual/theme completeness | B- for default theme, C across all themes | Soft Machine is best supported; theme parity is incomplete. |

## Bottom Line

The UI is a feature-rich prototype with a sound conceptual model. The next maturity step is not a redesign. It is token cleanup, modal consolidation, App/Workspace decomposition, dead-code removal, and UI/a11y testing.
