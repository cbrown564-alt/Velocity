# Export Implementation Analysis & Development Plan

**Date:** February 5, 2026
**Status:** Current implementation has critical issues requiring redesign

---

## Executive Summary

The initial export UI integration (commits 98f7373, aec59d2) has **three critical flaws**:

1. **Z-index bug**: Modal is obscured by slide navigator, making it unusable
2. **Poor UX placement**: Export button awkwardly positioned in table footer
3. **Wrong abstraction level**: Export tightly coupled to DataTable component instead of operating at slide/deck level

**Recommendation:** Refactor export to operate at the **slide deck level** with proper UI hierarchy.

---

## Current Implementation Review

### What Was Built

**Components:**
- `ExportModal.tsx` - Modal for configuring PPTX/XLSX exports
- `ExportModal.module.css` - Theme-agnostic styling
- Export button in `DataTable.tsx` footer
- Integration with `src/core/export/pptxExporter.ts` and `xlsxExporter.ts`

**Data Flow:**
```
DataTable → Export Button → ExportModal → Core Exporters → File Download
```

### Critical Issues

#### 1. Z-Index Layering Bug (Critical)

**Problem:**
- Export modal renders at `z-index: 60`
- Slide navigator (TimelineDock) likely at higher z-index (61+)
- User cannot interact with modal controls

**Evidence:**
- Screenshot shows modal partially visible but navigator overlapping
- "Export" button in modal is unreachable

**Root Cause:**
- Modal rendered inside `DataTable` component (within slide content area)
- Navigator is a top-level component with higher stacking context

#### 2. Poor Button Placement (UX)

**Problem:**
- Export button floats in bottom-right of table footer
- Inconsistent with table's purpose (display data, not document actions)
- Will appear on every table when user has multiple analyses

**Why This Is Wrong:**
- Tables are **content**, not **containers**
- Export is a **document-level action**, not a **table-level action**
- User expects export controls in app chrome (header, toolbar, menu)

**Current Behavior:**
```
┌────────────────────────────┐
│ Table Content              │
│ ...                        │
└────────────────────────────┘
───────────────────────────────
              [📥 Export] ← Awkward placement
```

**Expected Behavior:**
```
┌─────────────────────────────────────┐
│ [File] [Edit] [Export ▼]   [⚙️]     │ ← Global actions
├─────────────────────────────────────┤
│ Slide Title                         │
│ ┌─────────────────────────────┐     │
│ │ Table Content               │     │
│ │ ...                         │     │
│ └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

#### 3. Wrong Abstraction Level (Architecture)

**Problem:**
- Export is coupled to `DataTable` component
- Each table builds its own `ExportConfig`
- No way to export multiple slides/tables as a unified deck

**Limitations:**
- ❌ Cannot export all slides in current session
- ❌ Cannot select specific slides to export
- ❌ Cannot export slide with chart view (only table view)
- ❌ Redundant export buttons if user has multi-table layout (future)
- ❌ Export config built from DataTable props, not slide state

**What User Actually Needs:**
1. Export **current slide** (table or chart, as rendered)
2. Export **all slides** in session (full deck)
3. Export **selected slides** (multi-select from navigator)
4. Export **workspace** (future: cross-file reporting)

---

## Correct Architecture

### Export Should Operate at Slide/Deck Level

**Principle:** Export is a **presentation action**, not a **data component action**.

```
Slide/Deck Level
    ↓
Export Action (triggered from app chrome)
    ↓
Collect slide data (from store state)
    ↓
Build ExportConfig (one config for full deck)
    ↓
Call core exporters
    ↓
Download file
```

### Proper UI Location

**Option A: Header Menu (Recommended)**
```
┌─────────────────────────────────────┐
│ Velocity │ sleep.sav    [Export ▼] │ ← Dropdown menu
│                          │ PowerPoint (.pptx)
│                          │ Excel (.xlsx)
│                          │ ─────────
│                          │ Current Slide
│                          │ All Slides
│                          │ Selected Slides
└─────────────────────────────────────┘
```

**Option B: Slide Navigator Integration**
```
┌─────────────────────────────────────┐
│                                     │
│ [Content Area]                      │
│                                     │
├─────────────────────────────────────┤
│ [◀] [Analysis 1] [Analysis 2] [▶]  │ ← Slide navigator
│                    [📥 Export Deck] │ ← Context action
└─────────────────────────────────────┘
```

**Option C: Context Menu (Right-click)**
```
Right-click on slide navigator:
┌─────────────────────┐
│ Edit Title          │
│ Duplicate Slide     │
│ Delete Slide        │
│ ───────────────     │
│ Export This Slide   │
│ Export All Slides   │
└─────────────────────┘
```

---

## Development Plan

### Phase 1: Fix Z-Index Bug (Immediate)

**Goal:** Make current implementation usable while planning refactor.

**Tasks:**
1. Move `ExportModal` to **App.tsx** (top-level render)
2. Manage modal state via Zustand store slice
3. Set modal `z-index: 9999` (above all app chrome)
4. Test modal accessibility from any view

**Files to Modify:**
- `src/App.tsx` - Render modal at root
- `src/store/slices/uiSlice.ts` - Add `exportModalOpen: boolean`
- `src/features/dashboard/components/DataTable.tsx` - Dispatch action instead of local state

**Estimated Time:** 30 minutes

---

### Phase 2: Move Export to Slide Level (Short-term)

**Goal:** Export operates on slides, not tables.

#### 2A: Data Access Refactor

**Current (Wrong):**
```typescript
// DataTable builds export config from props
const exportConfig = {
  title: 'Report',
  analyses: [{ label: 'Table', result: processedData }]
};
```

**Correct (Future):**
```typescript
// Export action reads from store state
const slides = useVelocityStore(state => state.slides);
const currentSlide = useVelocityStore(state => state.getSlideById(activeSlideId));

const exportConfig = {
  title: slides[0].title || 'Analysis Report',
  analyses: slides.map(slide => ({
    label: slide.title,
    result: slide.cells[0].processedData, // From store, not props
  })),
};
```

**Challenge:** `processedData` is currently computed in `DataTable` via `useProcessedAnalysisData` hook. Need to either:
- **Option A:** Store processed data in Zustand slides slice (adds memory overhead)
- **Option B:** Re-compute processed data during export (adds latency)
- **Option C:** Move processing to worker and cache results (architectural, preferred)

**Recommendation:** Option B for MVP (acceptable latency), Option C for Phase 3.

#### 2B: UI Refactor

**Task:** Move export button from DataTable to app chrome.

**Approach 1: Slide Header Integration**
- Add "Export" icon button next to slide title edit button
- Tooltip: "Export this slide to PowerPoint or Excel"
- Opens modal with "Current Slide" pre-selected

**Approach 2: Global Header Menu**
- Add "Export" dropdown in top-right header (near theme switcher, reset button)
- Dropdown options: "Current Slide", "All Slides"
- More discoverable for users

**Recommended:** Approach 2 (global header) with future expansion to multi-select.

**Files to Modify:**
- `src/components/layout/AppShell.tsx` - Add export dropdown to header
- `src/features/dashboard/components/SlideHeader.tsx` - Optional: Add slide-level icon
- `src/features/dashboard/components/DataTable.tsx` - **Remove export button**

**Estimated Time:** 2 hours

---

### Phase 3: Multi-Slide Export (Medium-term)

**Goal:** Export entire analysis deck or selected slides.

#### 3A: Export Scope Selection

**Modal Enhancement:**
Add "Export Scope" section to modal:
```
┌─────────────────────────────────────┐
│ EXPORT SCOPE                        │
│ ○ Current Slide (Analysis 1)        │
│ ● All Slides (3 slides)             │
│ ○ Selected Slides (Choose...)       │
└─────────────────────────────────────┘
```

If "Selected Slides" chosen, show slide picker:
```
┌─────────────────────────────────────┐
│ SELECT SLIDES TO EXPORT             │
│ ☑ Analysis 1 (gender × region)      │
│ ☐ Analysis 2 (age × intent)         │
│ ☑ Analysis 3 (satisfaction chart)   │
└─────────────────────────────────────┘
```

#### 3B: Slide Data Collection

**Challenge:** Each slide may have different configurations (table vs chart, different variables).

**Solution:** Iterate over selected slides and build `AnalysisExportItem[]`:

```typescript
const buildExportConfig = (slideIds: string[]): ExportConfig => {
  const slides = store.getState().slides.filter(s => slideIds.includes(s.id));

  return {
    title: 'Analysis Report',
    analyses: slides.map(slide => {
      // Re-compute processed data for this slide's config
      const processedData = computeProcessedData(
        slide.cells[0].tableConfig,
        store.getState().dataset
      );

      return {
        label: slide.title || `Slide ${slide.order}`,
        result: processedData,
        options: {
          showSignificance: true,
          showPercents: true,
          showCounts: false,
        },
      };
    }),
  };
};
```

**Estimated Time:** 4 hours

---

### Phase 4: Chart Export Support (Long-term)

**Goal:** Export slides in chart view, not just table view.

**Current Limitation:**
- Core exporters (`pptxExporter.ts`, `xlsxExporter.ts`) only handle `ProcessedAnalysisData` (table format)
- No support for exporting chart images

**Solution Options:**

**Option A: Chart-to-Table Conversion (Quick)**
- Always export underlying data as tables
- Ignore chart view setting
- **Pros:** No new code needed
- **Cons:** User loses chart visualization in export

**Option B: Chart Screenshot Export (Medium)**
- Use `html2canvas` or similar to capture chart as image
- Embed PNG in PowerPoint slide
- **Pros:** Preserves visual
- **Cons:** Not editable in PowerPoint, lower quality

**Option C: Native Chart Generation (Complex)**
- Use PptxGenJS chart API to generate native PowerPoint charts
- Requires mapping Velocity chart configs to PptxGenJS chart types
- **Pros:** Fully editable charts in PowerPoint
- **Cons:** Significant development time, limited chart type support

**Recommendation:** Option A for Phase 4, Option C for Phase 5 (if user demand exists).

**Estimated Time:** 1-2 hours (Option A), 8-16 hours (Option C)

---

## Revised Architecture Diagram

### Current (Broken)
```
┌─────────────────────────────────────┐
│ App.tsx                             │
│  ┌───────────────────────────────┐  │
│  │ SlideContainer                │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ DataTable               │  │  │
│  │  │  - Export button        │  │  │
│  │  │  - ExportModal (z:60) ← BLOCKED │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ TimelineDock (z:61) ← OVERLAYS MODAL │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Proposed (Fixed)
```
┌─────────────────────────────────────┐
│ App.tsx                             │
│  ┌───────────────────────────────┐  │
│  │ AppHeader                     │  │
│  │  [Export ▼] ← Trigger         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ SlideContainer                │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ DataTable (no export)   │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ TimelineDock                  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ ExportModal (z:9999) ← TOP    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Implementation Priority

### Must-Fix (P0)
- ✅ **Phase 1:** Z-index bug (makes feature unusable)
- ✅ **Phase 2A:** Data access refactor (architectural correctness)
- ✅ **Phase 2B:** UI relocation (proper UX)

### Should-Have (P1)
- **Phase 3:** Multi-slide export (core value proposition)

### Nice-to-Have (P2)
- **Phase 4:** Chart export support (if users request)

---

## Testing Checklist

After refactor, verify:

- [ ] Modal appears above all UI elements (no z-index bugs)
- [ ] Export button is in app header (not table footer)
- [ ] Can export single slide (table view)
- [ ] Can export all slides (multiple tables)
- [ ] PPTX file opens in PowerPoint with correct formatting
- [ ] XLSX file opens in Excel with correct data
- [ ] Significance markers (▲▼) appear when enabled
- [ ] Export works across all three themes (Soft Machine, Mission Control, Liquid Glass)
- [ ] Modal is keyboard accessible (Esc to close, Tab navigation)
- [ ] Export with filters applied reflects filtered data
- [ ] Export with weights applied reflects weighted data

---

## Rollback Plan

If refactor introduces regressions:

1. **Immediate:** Revert commits and restore Phase 1 quick-fix (z-index only)
2. **Short-term:** Keep export in DataTable but fix modal rendering
3. **Long-term:** Revisit architecture with user feedback

---

## Conclusion

The current implementation **works functionally** (core exporters are solid) but has **critical UX and architectural flaws**. The export feature is unusable due to z-index layering and poorly placed in the UI hierarchy.

**Recommended Action:**
1. Implement Phase 1 (z-index fix) **immediately** to unblock users
2. Implement Phase 2 (slide-level refactor) **this week** to establish correct architecture
3. Defer Phase 3 (multi-slide) and Phase 4 (charts) based on user feedback

**Estimated Total Time:**
- Phase 1: 30 min
- Phase 2: 2 hours
- Phase 3: 4 hours
- **Total MVP:** ~3 hours of focused work

---

## Appendix: User Feedback Analysis

From user's bug report:

> 1. The modal doesn't fit onto the screen, and the slide navigator is on top of it so I can't even click export

**Root Cause:** Z-index issue + modal rendered in wrong DOM location.

> 2. The export button is in a strange place, hovering in the bottom right of a table

**Root Cause:** Wrong abstraction level - export is presentation action, not table action.

> 3. The export functionality should operate at a higher level of abstraction: we should be able to export a set of slides or an individual slide

**Root Cause:** Export tightly coupled to DataTable component instead of slide/deck state.

**Validation:** User's diagnosis is 100% correct. This analysis confirms all three issues.
