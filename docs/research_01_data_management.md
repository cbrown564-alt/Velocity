# Research Report: Dataset Management Features

**Objective:** Understand how existing survey tools (Displayr, Q, SPSS) handle "Variable Sets" and "Recoding" to inform Velocity's Milestone 2.1 implementation.

## 1. Variable Sets

### Definition
In Displayr and Q, a **Variable Set** is the primary unit of analysis. It is a wrapper around one or more variables that defines how they interact with analysis tools.
- **Single Variable Set:** 1 variable (e.g., "Age").
- **Multiple Variable Set:** Group of variables (e.g., "Q5a, Q5b, Q5c" - Brand Awareness).
- **Structure:** The "structure" (e.g., *Nominal-Multi*, *Binary-Grid*) dictates the default statistics (%, mean) and visualization.

### User Interface & Workflow
- **Automatic Creation:** On import, heuristics group variables (likely based on naming patterns `Q5_1`, `Q5_2` or metadata).
- **Manual Creation:**
  - **Action:** Select multiple variables in the data tree -> Right Click -> "Combine".
  - **Context:** This creates a new "Variable Set" node in the tree, hiding the individual variables or nesting them.
- **Modification:**
  - **Object Inspector:** A side panel allows changing the "Structure" (Type coercion) and "Label" of the set.
  - **Split:** Right-click -> "Split" to un-group back to individuals.

### Key Takeaways for Velocity
1.  **Abstraction Layer:** We need a `VariableSet` concept in our store that refers to `VariableId[]`.
2.  **The "Pantry" (Sidebar):** Should render `VariableSet`s, not just raw variables.
3.  **Interaction:** "Combine" via context menu is the standard pattern.

---

## 2. Recoding & Binning UI

### Definition
Recoding is the process of transforming variable values (e.g., 18-24 -> "Young") or structure.

### User Interface & Workflow
- **Merging Categories (Combine):**
  - **Pattern:** Select categories in a table or list -> Right Click -> "Combine".
  - **Feedback:** The categories merge instantly into a new bucket (e.g., "Top 2 Box").
- **Binning (Numeric -> Categorical):**
  - **Method:** "Convert to Ordinal" or "Banding".
  - **UI:** Often uses a Histogram with drag-handles or a dialogue to set cut-off points (e.g., 0-10, 11-20).
- **Recode Values:**
  - **Grid/Table UI:** A modal or panel showing "Source Value" -> "Target Value" mapping.
  - **Midpoints:** For calculating means from ranges (e.g., "18-24" -> 21).

### Key Takeaways for Velocity
1.  **Binning UI:** A dedicated modal for "Numeric -> Categorical" is needed. It should ideally show a histogram of the underlying data to help the user choose cut-offs.
2.  **Merging UI:** While "Right-click combine" is the gold standard for speed, a "Recode Modal" that allows selecting multiple source values and mapping them to a single target label is the MVP.
3.  **Variable Type switching:** Recoding often implies a type change (Scale -> Nominal).

---

## 3. Recommendation for Milestone 2.1

### Variable Sets Logic
- Introduce `VariableSet` entity in Zustand.
- Update `VariableList` to render Sets.
- Implement "Combine" action in the sidebar context menu.

### Recoding UI
- **Phase 1 (MVP):** "Binning Modal".
  - Input: Numeric Variable.
  - Output: New Nominal Variable.
  - UI: List of logic rules (e.g., `Value <= 18` = "Under 18"). 
- **Phase 2:** Histogram-based drag-to-bin (Visual feedback).
