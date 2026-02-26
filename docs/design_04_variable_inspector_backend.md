# Variable Inspector Backend Work

This document outlines backend tasks needed to complete the Variable Inspector UX upgrades. Currently, the UI has visual affordances for editing, but these actions need to be wired up to the application state/backend.

## Overview
1.  **Inline Label & Name Editing:** The visual placeholders and styles are present in the header and Value Mapping table, but clicking them does nothing.
2.  **Missing Value Toggles:** The quick actions in the Value Mapping table to toggle a value as `missing` are not functional.

## Action Items

### 1. Header Inline Editing
The `InspectorHeader.tsx` component needs to support updating the `variable.label` and `variable.name`.

*   **Implementation:**
    *   Introduce local state for 'edit mode' (e.g., `isEditingLabel`, `isEditingName`).
    *   Swap the text strings for `<input>` fields when in edit mode.
    *   On `blur` or `Enter`, dispatch a Redux action to update the variable metadata in the store (e.g., a new action `updateVariableMetadata({ datasetId, variableId, updates: { label: newLabel } })`).
*   **File:** `src/features/variableManager/components/InspectorHeader.tsx`
*   **Dependencies:** Action creators in `src/store/slices/dataSlice.ts`.

### 2. Value Mapping Inline Editing
The `InspectorStats.tsx` table needs to support updating individual value labels within the dictionary.

*   **Implementation:**
    *   Similar to the header, the "Label" td cell needs to become editable.
    *   Clicking the label or the pencil icon should convert the cell to an input.
    *   Dispatch an action to update specific value labels for a variable: `updateValueLabel({ datasetId, variableId, valueCode, newLabel })`.
    *   *Note: This might be tricky because the unified table merges data stats with `valueLabels` arrays, so ensure you handle adding brand-new metadata to a value rather than just updating an existing `valueLabel` object.*
*   **File:** `src/features/variableManager/components/InspectorStats.tsx`
*   **Dependencies:** Action creators in `src/store/slices/dataSlice.ts`.

### 3. Missing Value Toggles
The "Set as Missing" / "Include value" buttons in the action column of the Value Mapping table need to be functional.

*   **Implementation:**
    *   The button rendered in `InspectorStats.tsx` needs an `onClick` handler.
    *   This handler should dispatch an action: `toggleDiscreteMissingValue({ datasetId, variableId, valueCode, isMissing: boolean })`.
    *   The reducer should safely add or remove the `valueCode` from the `variable.missingValues.discrete` array without mutating state directly.
*   **File:** `src/features/variableManager/components/InspectorStats.tsx`
*   **Dependencies:** Action creators in `src/store/slices/dataSlice.ts`.
