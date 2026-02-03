# Research 12: Pathways & Recommendations (UX Data Analysis)

## 1. Critical Review of Research 11

The `docs/research_11_UX_data_analysis.md` document presents a compelling argument for a "Magnetic Canvas" interface, effectively identifying the "Schism" between BI tools (Tableau) and Notebooks (Hex).

### Strengths
*   **Problem Definition:** Accurately diagnoses the "High Dimensionality" problem (500+ variables) which most modern BI tools (which assume <50 columns) fail to address.
*   **"Magnetic Canvas" Metaphor:** effectively bridges the gap between structure and freedom.
*   **"Glass Box" AI:** A crucial insight. Most AI tools are "Black Boxes" which survey researchers (who need to defend their data) cannot trust.

### Weaknesses / Omissions
*   **Implementation Complexity:** The document underestimates the technical difficulty of building a performant "Infinite Canvas" with "Magnetic Snapping" in the browser, especially with heavy DOM elements (Charts).
*   **State Management:** It doesn't detail how the "Canvas" state (x,y coordinates, links) integrates with the existing Redux/Zustand store which currently assumes a list/grid view.
*   **Mobile interaction details:** While "The Deck" is a good metaphor, the transition between "Canvas Mode" (Desktop) and "Deck Mode" (Mobile) is architecturally non-trivial.

## 2. Architecture Gap Analysis

Comparing the Research 11 proposal against Velocity's current status (`tracker_00_implementation_status.md` & `arch_01_system_architecture.md`):

| Feature | Proposed (Research 11) | Current (Velocity) | Gap |
| :--- | :--- | :--- | :--- |
| **Container** | **Magnetic Canvas** (Infinite 2D plane with swimlanes) | **Analysis Canvas** (Vertical Scroll List/Grid) | **High**. Moving to a 2D Canvas requires a fundamental UI rewrite of the core view. |
| **Navigation** | **Spotlight Search** (Cmd+K) for 500+ vars | **Sidebar / Miller Columns** | **Medium**. Backend for search exists (DuckDB), but the UI/Action layer is missing. |
| **Data Access** | **"Smart Shelf"** (Auto-promoted working sets) | **Variable Manager** (Manual definition) | **Medium**. Logic for "contextual promotion" needs to be built. |
| **Interaction** | **"Drop Zone" HUD** (3x3 grid on hover) | **Basic Drop Zones** (Standard dnd-kit) | **Low/Medium**. Visual polishes needed, but core mechanics exist. |
| **AI** | **"Glass Box"** (GenUI -> Config) | **None** | **High**. No LLM integration yet. |
| **Mobile** | **"The Deck"** (Serialized cards) | **Responsive Web** (Standard scaling) | **High**. Needs a dedicated mobile renderer. |

## 3. Competitive Landscape Assessment

Based on the research and knowledge of the field:

*   **Count.co:** The closest visual match. They use WebGL/Canvas for performance. *Risk:* Building a canvas engine from scratch is a 6-month project. We should stick to DOM-based manipulation (React Flow or similar) initially.
*   **Hex:** The closest logical match. Their "DAG" (Directed Acyclic Graph) is what we need for the "Data Prep" phase. *Velocity is currently more "Tableau-lite".*
*   **Crunch.io / Displayr:** The direct competitors. They rely heavily on traditional "Banner & Stub" tables. *Opportunity:* Velocity can win on "Fluidity" and "Speed" (WASM).

## 4. Recommended Pathways

We recommend a phased approach that delivers value immediately without requiring a "Big Bang" rewrite.

### Pathway A: The "Spotlight" (Immediate Win)
*   **Goal:** Solve the "Findability" problem without changing the canvas.
*   **Action:** Implement the `Cmd+K` Command Palette immediately.
*   **Tech:** `cmdk` (React library). Connect it to the VariableStore.
*   **Why:** Low effort, high impact. Solves the "500 variable" scrolling pain.

### Pathway B: The "Structured Canvas" (Compromise)
*   **Goal:** Move towards "Magnetic Canvas" without building a physics engine.
*   **Action:** Instead of a true distinct 2D canvas, implement a **"Grid-Layout"** system (like react-grid-layout or CSS Grid with DND).
*   **Refinement:** Allow users to drag charts side-by-side (2 columns) or stack them (1 column). This approximates the "Swimlane" concept without the complexity of an infinite pan/zoom whiteboard.

### Pathway C: "Glass Box" AI (The Differentiator)
*   **Goal:** Skip the "Chatbot" phase and go straight to "GenUI".
*   **Action:** Implement a basic "Text-to-Config" parser.
    *   *Input:* "NPS by Region"
    *   *Output:* JSON Config `{ rows: [Region], metric: [NPS] }` -> passed to `AnalysisEngine`.
*   **Why:** This proves the "Glass Box" concept (showing the configuration) before needing a complex LLM.

### Pathway D: Mobile "Deck" (Future)
*   Defer this. Focus on Desktop/Tablet excellence first. The "Card Stack" is the right design, but lower priority than the Core Desktop Experience.

## 5. Strategic Plan (Next 3 Sprints)

1.  **Sprint 1: Navigation.** Implement `Cmd+K` Spotlight Search. (Pathway A)
2.  **Sprint 2: Layout.** Upgrade `AnalysisCanvas` to support user-definable Columns/Rows (Grid Layout) -> "Pseudo-Canvas". (Pathway B)
3.  **Sprint 3: AI Foundation.** Build the "Text-to-JSON" parser for simplistic natural language commands. (Pathway C)

This approach avoids the "Spaghetti Canvas" risk while delivering the "Flow State" promised by the research.
