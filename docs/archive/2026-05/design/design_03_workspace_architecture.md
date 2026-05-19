# Workspace Architecture: Multi-File Management System

## 1. Overview

This document outlines the architecture and UX design for Velocity's multi-file workspace system, enabling users to manage multiple datasets, create projects for linked studies, and maintain session state across files.

**Design Concept: "The Research Library"**

The workspace is conceived as a personal research library where:
- **Datasets** are "volumes" in your collection
- **Projects** are "studies" that group related volumes
- **Sessions** preserve your analysis state like bookmarks

---

## 2. Research Findings

### 2.1 Local-First Principles (Ink & Switch)

Key principles incorporated:
- **Offline-first**: All data stored in OPFS, works without network
- **Data ownership**: User's data never leaves their device
- **Instant interactions**: No loading spinners, immediate feedback
- **Longevity**: Data persists across sessions and browser restarts

### 2.2 File Browser Patterns (Figma, Obsidian)

Borrowed concepts:
- **Recents page**: Quick access to recently opened files
- **Starred files**: User-curated favorites for fast access
- **Projects/Vaults**: Grouping mechanism for related content
- **Rich metadata**: Preview information without opening files

### 2.3 Data Analysis Tools (SPSS, Observable)

Domain-specific patterns:
- **Session persistence**: Restore analysis state (tables, filters, recodes)
- **Project files**: Link data with configuration
- **Wave linking**: Support for longitudinal study designs
- **Variable mapping**: Common respondent keys across waves

---

## 3. Data Model

### 3.1 StoredDataset

```typescript
interface StoredDataset {
  id: string;                    // UUID
  name: string;                  // Display name
  fileName: string;              // Original file name
  rowCount: number;
  columnCount: number;
  fileSize: number;              // bytes
  source: 'sav' | 'csv' | 'arrow';

  // Timestamps
  createdAt: number;
  lastOpenedAt: number;
  lastModifiedAt: number;

  // Organization
  projectId?: string;            // Link to project
  starred: boolean;

  // Longitudinal support
  waveNumber?: number;           // Wave 1, 2, 3...
  respondentKey?: string;        // Variable for linking respondents

  // Preview data
  thumbnail?: number[];          // Sparkline of first variable

  // Session state
  sessionState?: {
    tableConfig: { rowVars: string[]; colVar: string | null };
    activeFilters: Filter[];
    transformLog: DataTransform[];
  };
}
```

### 3.2 Project

```typescript
interface Project {
  id: string;
  name: string;
  color: string;                 // Visual identifier
  description?: string;
  createdAt: number;
  datasetIds: string[];          // Linked datasets

  // Longitudinal configuration
  isLongitudinal: boolean;
  respondentKeyVariable?: string; // Common key variable name
}
```

### 3.3 WorkspaceState

```typescript
interface WorkspaceState {
  datasets: StoredDataset[];
  projects: Project[];
  storageUsed: number;           // OPFS usage in bytes
  storageQuota: number;          // Browser quota limit
}
```

---

## 4. Storage Architecture

### 4.1 OPFS Structure

```
OPFS Root/
├── velocity_data_v1_dataset_{uuid}.db    # DuckDB database per dataset
├── velocity_data_v1_dataset_{uuid}.db    # ...
├── uploaded_sav/
│   ├── {timestamp}_{filename}.sav        # Original SAV files
│   └── ...
└── workspace.json                        # Workspace metadata (localStorage backup)
```

### 4.2 Storage Policies

**Quota Management:**
- Monitor OPFS usage via `navigator.storage.estimate()`
- Warning at 70% capacity
- Critical warning at 90% capacity
- Suggest cleanup when approaching limit

**Cleanup Strategies:**
1. **Manual**: User selects datasets to delete
2. **Auto-suggest**: Highlight oldest, largest, or duplicate files
3. **Session-only mode**: Load without persisting for one-time analysis

**Recommended Limits:**
- Soft limit: 10 datasets (comfortable management)
- Hard limit: Based on device storage (typically 1-5GB)
- Per-file warning: 50MB triggers metadata-only option

---

## 5. UX Architecture

### 5.1 App Mode States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Workspace  │────▶│  Dashboard  │────▶│  Analysis   │
│    View     │     │   (Active)  │     │   Canvas    │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                   │                   │
       │                   │                   │
       └───────────────────┴───────────────────┘
              (Return to Workspace)
```

**Mode Transitions:**
- `Workspace` → `Dashboard`: User opens a dataset
- `Dashboard` → `Workspace`: User clicks "Workspace" in sidebar
- Session state auto-saved on mode transitions

### 5.2 Workspace View Components

```
┌──────────────────────────────────────────────────────────┐
│ Header                                                    │
│ ┌─────────┐ ┌──────────────────┐ ┌────────┐ ┌─────────┐ │
│ │📊 Workspace │ Storage: 245MB/1GB │ [🔍 Search] │ [Upload] │ │
│ └─────────┘ └──────────────────┘ └────────┘ └─────────┘ │
├──────────────────────────────────────────────────────────┤
│ Filter Tabs                                               │
│ [🕐 Recent] [⭐ Starred] [📁 Projects] [All]              │
├──────────────────────────────────────────────────────────┤
│ Content                                                   │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Projects (if filtered)                               │  │
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐                │  │
│ │ │ Brand   │ │ Wave    │ │ Q4      │                │  │
│ │ │ Track   │ │ Study   │ │ Survey  │                │  │
│ │ └─────────┘ └─────────┘ └─────────┘                │  │
│ └─────────────────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Datasets (grid or list)                              │  │
│ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │  │
│ │ │ 📊  │ │ 📊  │ │ 📊  │ │ 📊  │ │ 📊  │          │  │
│ │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘          │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Dataset Card Information

Each dataset card displays:
- File icon and type badge (.sav, .csv)
- Dataset name (editable)
- Metadata: rows × columns, file size
- Mini sparkline preview
- Project badge (if linked)
- Wave badge (if longitudinal)
- Last opened timestamp
- Session indicator (if analysis saved)
- Star button
- Quick actions on hover

### 5.4 Dataset Sidebar (During Analysis)

A collapsible sidebar for switching datasets without returning to workspace:

```
┌────────────────────────────────────────────────┐
│ ┌──────┐                                        │
│ │      │  Main Analysis Area                    │
│ │  DS  │                                        │
│ │ Side │  (Variable Manager / Analysis Canvas)  │
│ │ bar  │                                        │
│ │      │                                        │
│ └──────┘                                        │
└────────────────────────────────────────────────┘
```

Collapsed (56px): Icons only with tooltips
Expanded (280px): Full dataset list with metadata

---

## 6. User Flows

### 6.1 First Launch (Empty State)

```
1. User opens Velocity
2. → Empty workspace with:
   - Welcome message
   - Upload button (prominent)
   - "Load Example" option
   - Privacy assurance message
```

### 6.2 Returning User (Data Exists)

```
1. User opens Velocity
2. → Workspace view shows recent datasets
3. → "Continue where you left off" for last session
4. User clicks dataset
5. → Session restored (if saved)
6. → Dashboard mode activated
```

### 6.3 Uploading New Dataset

```
1. User clicks "Upload" or drags file
2. → File processed, added to OPFS
3. → Dataset card appears in workspace
4. → User can open immediately or continue browsing
```

### 6.4 Creating a Project (Linking Datasets)

```
1. User selects multiple datasets (shift+click or checkboxes)
2. → "Link as Project" button appears
3. User clicks, modal opens
4. → Configure: name, color, description
5. → Toggle: "Longitudinal Study"
6. → If longitudinal: assign wave numbers
7. → If longitudinal: select respondent key variable
8. User confirms
9. → Project created, datasets linked
```

### 6.5 Switching Datasets (During Analysis)

```
1. User is analyzing Dataset A
2. User expands dataset sidebar
3. User clicks Dataset B
4. → Session for Dataset A auto-saved
5. → Dataset B loaded
6. → Session for Dataset B restored (if exists)
```

---

## 7. Session Persistence

### 7.1 What Gets Saved

Per dataset:
- Table configuration (row/column variables)
- Active filters
- Weight variable selection
- Variable recodes/transforms
- View mode preferences

### 7.2 When Sessions Save

- On mode transition (workspace ↔ analysis)
- On dataset switch
- Periodically (debounced, every 30s of inactivity)
- On browser close (beforeunload)

### 7.3 Restoration Flow

```
1. User opens dataset with saved session
2. → Toast: "Restoring your previous analysis..."
3. → Table config applied
4. → Filters applied
5. → Transforms replayed
6. → User sees exactly where they left off
```

---

## 8. Longitudinal Data Support

### 8.1 Wave Linking Concept

```
Project: "Brand Tracking 2024"
├── Wave 1 (Jan 2024) ─── respondent_id
├── Wave 2 (Apr 2024) ─── respondent_id  ←─ Linked by common key
├── Wave 3 (Jul 2024) ─── respondent_id
└── Wave 4 (Oct 2024) ─── respondent_id
```

### 8.2 Visual Indicators

- Wave badges on dataset cards
- Timeline visualization in project cards
- Connection lines between linked datasets
- Color-coded project badges

### 8.3 Future Capabilities (Phase 3)

- Cross-wave analysis (compare W1 vs W2)
- Panel attrition reporting
- Respondent journey tracking
- Wave-over-wave trend visualization
- Harmonization tools (map different variable names)

---

## 9. Theme Compatibility

All components use semantic tokens for theme compatibility:

| Token | Purpose |
|-------|---------|
| `--bg-app` | Main background |
| `--bg-panel` | Card backgrounds |
| `--bg-surface` | Elevated surfaces |
| `--bg-active` | Selected/hover states |
| `--text-primary` | Main text |
| `--text-secondary` | Muted text |
| `--color-accent` | Interactive elements |
| `--border-color` | Borders |

Theme-specific enhancements:
- **Mission Control**: Radar sweep animation on card hover
- **Soft Machine**: Left accent bar on card hover
- **Liquid Glass**: Frosted glass blur effects

---

## 10. Implementation Phases

### Phase 1: Core Workspace (MVP)
- [ ] WorkspaceView component
- [ ] Dataset cards (grid/list views)
- [ ] Storage indicator
- [ ] Basic CRUD operations
- [ ] Session persistence (per dataset)

### Phase 2: Projects & Organization
- [ ] Project creation modal
- [ ] Project cards
- [ ] Dataset linking
- [ ] Filter tabs (recent/starred/projects)

### Phase 3: Longitudinal Support
- [ ] Wave assignment UI
- [ ] Respondent key configuration
- [ ] Wave timeline visualization
- [ ] Cross-wave analysis tools

### Phase 4: Advanced Features
- [ ] Batch operations
- [ ] Export workspace
- [ ] Import from other tools
- [ ] Collaboration prep (sync architecture)

---

## 11. Technical Considerations

### 11.1 Performance

- Virtualize dataset list for >50 items
- Lazy-load thumbnails
- Debounce search filtering
- Cache storage estimates

### 11.2 Migrations

When schema changes:
1. Version workspace metadata
2. Provide migration functions
3. Handle graceful degradation

### 11.3 Error Handling

- Corrupted OPFS files: Quarantine and offer recovery
- Quota exceeded: Clear guidance on cleanup
- Missing datasets: Graceful removal from projects

---

## 12. References

- Figma File Browser: https://help.figma.com/hc/en-us/articles/14381406380183
- Local-First Software: https://www.inkandswitch.com/local-first/
- Obsidian Vault Organization: https://help.obsidian.md/data-storage
- Velocity Design System: `docs/design_01_system.md`
- Velocity UX Modes: `docs/design_02_ux_modes.md`
