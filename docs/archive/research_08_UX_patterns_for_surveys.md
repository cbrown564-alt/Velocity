## 1. Executive Summary and Strategic Context

The development of **Velocity**, a local-first, high-performance survey analysis tool utilizing WebAssembly (WASM), presents a distinct opportunity to redefine the user experience of market research and data analysis. The current prototype, characterized by a single-screen interface managing over 500 raw variables, has encountered a critical barrier: cognitive overload. Users are reporting significant friction when attempting to switch between the distinct mental modes of "Data Engineering" (cleaning, organizing, recoding) and "Data Analysis" (visualization, storytelling). This report validates the hypothesis that a distinct, modal architecture is required to decouple these tasks while maintaining the fluidity afforded by the local-first architecture.

Analysis of the competitive landscape—ranging from specialized survey tools like Displayr and Crunch.io to general BI platforms like Tableau and PowerBI—reveals that the most successful tools for high-dimensional data employ specific strategies to manage complexity. These strategies leverage cognitive chunking, spatial organization, and visual abstractions to reduce the apparent density of information. The "Single Screen" dogma, while noble in its pursuit of immediacy, inevitably fails as variable counts exceed the threshold of immediate working memory (typically 7 +/- 2 items), scaling poorly into the thousands of variables common in longitudinal survey tracking.

This comprehensive architectural review suggests that Velocity should adopt a **Hybrid Hub-and-Spoke Model**. This architecture places the "Analysis Canvas" as the central hub for insight generation, supported by a specialized, full-screen "Variable Manager" spoke for data gardening. Unlike traditional modal dialogs which block interaction, this manager should function as a parallel workspace—a "Data Operating System"—that users can toggle instantly, leveraging WASM to preserve state and context without the latency penalties seen in server-side competitors. Furthermore, the adoption of **Visual ETL** patterns, specifically Direct Manipulation for recoding and Sankey Diagrams for harmonization, will democratize complex data engineering tasks, moving them from code-heavy interfaces to intuitive, tactile interactions.
## 2. The Cognitive Architecture of Data Work

To design an effective interface for Velocity, one must first deconstruct the cognitive operations involved in survey analysis. Data work is not a monolithic activity; it comprises two antagonistic modes of thought that require fundamentally different environmental affordances.
### 2.1 The Dichotomy of Gardening vs. Harvesting

The primary friction observed in Velocity's current state stems from the conflation of "Gardening" and "Harvesting."

**Data Gardening (Preparation & Engineering):** This phase involves the rigorous structuring of information. It is linear, convergent, and detail-oriented. The user’s mental model is focused on the *schema*—the container of the data. Tasks include cleaning dirty strings, merging categories (recoding), defining variable sets, and ensuring base sizes are statistically valid. In this mode, the user acts as an architect or engineer; they require density, precision, and broad visibility of the dataset's structure.

**Data Harvesting (Analysis & Storytelling):** This phase is exploratory, divergent, and creative. The user’s mental model shifts to the *content*—the signal within the data. Tasks include dragging variables to axes, styling charts, filtering for insights, and constructing narratives. In this mode, the user acts as an artist or detective; they require a clutter-free canvas, rapid feedback loops, and flow.

When a single interface attempts to serve both masters simultaneously, it fails both. A sidebar cluttered with 2,000 raw variable codes (Gardening artifacts) distracts from the visual patterns in a chart (Harvesting goal). Conversely, chart formatting tools clutter the workspace needed for complex logic validation. The "Mode" separation hypothesis is therefore not just a UI preference but a cognitive necessity for high-dimensional data work.
### 2.2 The Latency Imperative

The unique technical advantage of Velocity is its local-first WASM architecture. In server-side tools like **Crunch.io** or **Deepnote**, operations often carry a latency penalty.<sup>1</sup> Every time a user recodes a variable, a request is sent, processed, and returned. This "micro-latency" (200ms - 1s) subtly discourages exploration; users become hesitant to experiment with data structures because the cost of "Undo" is high.

Velocity’s zero-latency environment allows for a different UX paradigm: **Fearless Interaction**. If the interface can switch between "Data Mode" and "Analysis Mode" in under 16ms (one frame), the psychological barrier to switching disappears. This enables a design where the "Variable Manager" can be a heavy, feature-rich environment that feels lightweight because it is instantly accessible. This is similar to the "Edit Mode" vs. "Preview Mode" in design tools like Figma, where the switch is seamless and state-preserved.
## 3. Architectural Archetypes: A Comparative Analysis

Market analysis identifies three dominant architectural patterns for handling the Data vs. Analysis dichotomy. Each offers lessons for Velocity’s restructuring.
### 3.1 The Hard Separation Model (Tableau, PowerBI)

The most common pattern in general BI is a strict wall between data ingestion and visualization.

**Tableau** utilizes a tabbed approach where "Data Source" is distinct from "Sheet 1." In the Data Source view, users see a canvas for joins and a grid for data inspection.<sup>3</sup> Structural changes largely happen here. Once in the Sheet view, the data schema is mostly fixed. While users can create groups or calculations in the Sheet view, significant remodeling requires returning to the Data Source tab.

**PowerBI** takes this further with the **Power Query Editor**, which launches as a completely separate window.<sup>5</sup> This editor is a dedicated ETL environment with its own ribbon, history (Applied Steps), and formula language (M).

<table>
  <tr>
   <td><strong>Feature</strong>
   </td>
   <td><strong>Tableau/PowerBI Pattern</strong>
   </td>
   <td><strong>Implication for Velocity</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Separation</strong>
   </td>
   <td>Strict (Tabs or Windows).
   </td>
   <td>Reduces clutter but breaks flow.
   </td>
  </tr>
  <tr>
   <td><strong>Feedback Loop</strong>
   </td>
   <td>Slow (Model refresh required).
   </td>
   <td>Discourages iterative cleaning.
   </td>
  </tr>
  <tr>
   <td><strong>Cognitive Load</strong>
   </td>
   <td>Low (Modes are distinct).
   </td>
   <td>Context loss during switching.
   </td>
  </tr>
</table>

**Assessment:** While this model excels at handling complexity, the "Hard Switch" is a friction point. Users often tolerate dirty data in a visualization because the cost of switching back to the ETL view, finding the error, fixing it, and reloading the model is too high. Velocity should avoid the "Loading..." penalty associated with this model.
### 3.2 The Unified Monolith (Displayr, Excel)

Tools with a lineage in market research often favor a single-screen approach to maintain immediacy.

**Displayr** posits that "everything is done on a single screen".<sup>6</sup> The "Data Sources" tree sits on the left, the canvas in the center, and the "Object Inspector" on the right.<sup>7</sup> This minimizes navigation but maximizes density. The Object Inspector becomes a catch-all for thousands of properties, leading to "scroll fatigue."

**Excel** presents data and visualization on the same grid. This offers ultimate flexibility but zero structural enforcement. A user can accidentally delete a row of data while trying to move a chart.

<table>
  <tr>
   <td><strong>Feature</strong>
   </td>
   <td><strong>Displayr/Excel Pattern</strong>
   </td>
   <td><strong>Implication for Velocity</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Separation</strong>
   </td>
   <td>None (Single View).
   </td>
   <td>High immediacy, high clutter.
   </td>
  </tr>
  <tr>
   <td><strong>Feedback Loop</strong>
   </td>
   <td>Instant.
   </td>
   <td>Excellent for "tweaking."
   </td>
  </tr>
  <tr>
   <td><strong>Cognitive Load</strong>
   </td>
   <td>High (Visual noise).
   </td>
   <td>"Where is that setting?" syndrome.
   </td>
  </tr>
</table>

**Assessment:** This model struggles with high dimensionality. Navigating a tree of 2,000 variables in a narrow sidebar <sup>8</sup> while trying to view a chart is spatially inefficient. The user spends too much time scrolling the sidebar.
### 3.3 The Notebook/Flow Model (Hex, Deepnote, Alteryx)

This model treats analysis as a linear narrative or a directed graph.

**Hex and Deepnote** allow users to interleave SQL/Python code blocks with visual outputs.<sup>9</sup> Data prep is handled via code cells or "No-Code" blocks immediately preceding the visualization.<sup>11</sup>

**Alteryx** uses a visual flow metaphor where data moves left-to-right through transformation nodes.<sup>12</sup>

**Assessment:** This model is powerful for reproducibility but alien to non-technical survey analysts who think in "Dashboards" and "Crosstabs," not "Pipelines." However, the concept of a **"Recipe"** (a record of transformation steps) <sup>13</sup> is highly valuable and should be adapted into Velocity’s Variable Manager as a history of actions.
### 3.4 The Velocity Proposition: The "Soft Modal"

Velocity should adopt a **"Soft Modal"** architecture. This entails a dedicated "Variable Manager" layer that sits *over* the analysis canvas.

* **Trigger:** Accessed via a "Data" button or keyboard shortcut (e.g., Tab or D).
* **Behavior:** The Analysis Canvas recedes (blurs or slides back), and the Variable Manager overlays it.
* **Context Awareness:** If the user has "Q5: Satisfaction" selected in a chart on the Analysis Canvas, opening the Variable Manager immediately focuses on "Q5" in the data grid/list.
* **Preservation:** Unlike Tableau, which resets context, Velocity’s WASM engine maintains the state of both views in memory.

This approach provides the **focus** of the Hard Separation model with the **speed** of the Unified Monolith.
## 4. Managing High-Dimensionality (500-2,000 Variables)

Survey data differs from transactional data in its "width." A single survey might produce 2,000 columns due to "Grid" questions (loops), multiple-response checkboxes, and derived logic variables. Standard UI patterns like simple lists or Excel grids fail at this scale.
### 4.1 The "Variable Set" Abstraction

The single most important pattern for managing high dimensionality in survey tools is the **Variable Set** (Displayr) <sup>8</sup> or **Array** (Crunch).<sup>14</sup>

**The Problem:** A question like *"Rate the following 20 brands on trust"* creates 20 columns in the database (Q1_1 to Q1_20). A flat list of 2,000 such variables is unnavigable.

**The Solution:** The UI must abstract these 20 columns into a single object: "Q1: Brand Trust."

* **Interaction:** The user interacts with 1 item, not 20.
* **Analysis:** Dragging this single item to a table automatically creates a summary grid (brands in rows, percentages in columns).<sup>15</sup>
* **Implication for Velocity:** The "Variable Manager" must prioritize the *Set* level of hierarchy. The default view should collapse raw columns into Sets, reducing the list length by ~90%. Users should only see raw columns if they explicitly "expand" a Set.
### 4.2 Navigation Pattern: Miller Columns (The Finder)

For navigating deep hierarchies (Wave > Section > Question > Variable), the **Miller Columns** pattern (popularized by macOS Finder) is superior to nested accordions.

* **Visual Logic:**
    * **Column 1 (Taxonomy):** Survey Sections (Demographics, Screeners, Main Body).
    * **Column 2 (Sets):** Questions within the selected section (Age, Gender, Brand Awareness).
    * **Column 3 (Variables):** Individual items within the question (Male, Female).
    * **Column 4 (Inspector):** Metadata and Distribution Preview.
* **Benefits:** This allows users to drill down without vertical scrolling fatigue. It utilizes horizontal screen space, which is often abundant on desktop displays.<sup>16</sup>
* **Evidence:** Crunch.io utilizes a folder-based hierarchy effectively to organize variables <sup>17</sup>, but a Miller Column view provides better wayfinding for deep structures.
### 4.3 Pattern: The "Card Sorting" Organizer

Organizing 2,000 variables is fundamentally a categorization task. The "List View" is poor for organization because it lacks spatial affordances. Velocity should implement a **Grid/Card View** for the Variable Manager.

* **Metaphor:** Each Variable Set is a "Card."
* **Interaction:** Users can select 50 cards (variables) and drag them into a "Folder" or "Group".<sup>18</sup>
* **Visuals:** This mimics **Miro** or **Pinterest**. It leverages spatial memory ("I put the demographics in the top left").
* **Bulk Actions:** Selecting multiple cards triggers a "Context Action Bar" <sup>18</sup> enabling operations like "Hide," "Move," "Change Type," or "Combine."
### 4.4 Faceted Search and Filtering

With 2,000 items, "scrolling to find" is inefficient. The Variable Manager must function as a search engine.

* **Faceted Filters:** Users should be able to filter the variable list by metadata attributes <sup>20</sup>:
    * *Type:* Nominal, Numeric, Text, Date.
    * *Status:* Hidden, Visible, Derived.
    * *Quality:* 100% Complete, Has Missing Data.
* **Use Case:** A user can instantly isolate "All Text Variables with >50% Missing Data" to perform cleanup. This turns the Variable Manager into a **Data Quality Dashboard**.<sup>12</sup>
### 4.5 The "Sparkline" Preview

In a list of 2,000 variables, names like Q5_A are meaningless. The user needs to see the *shape* of the data.

* **Pattern:** Integrating **Sparklines** or **Mini-Histograms** directly into the variable list/card.<sup>22</sup>
* **Information Density:** A small bar chart showing the distribution (e.g., skewed vs. normal) or a progress bar showing % missing values allows the user to assess the utility of a variable without opening it.
* **Alteryx/Trifacta Influence:** These tools place histograms at the top of every column <sup>22</sup>, providing immediate visual profiling. Velocity should adopt this for the Variable Manager grid.
## 5. Visual ETL: The Art of No-Code Data Preparation

The "Data Engineering" aspect of survey analysis involves specific tasks: Recoding (grouping), Cleaning (text manipulation), and Harmonization (merging waves). Velocity's goal is to avoid code. This requires **Direct Manipulation** and **Programming by Example (PBE)**.
### 5.1 Recoding: The "Drag-and-Merge" Metaphor

Recoding (e.g., combining "Agree" and "Strongly Agree" into "Top 2 Box") is the most frequent user action.

**Current Anti-Pattern:** A modal dialog with two lists (Source Values -> Target Groups). This is abstract and disconnects the user from the data context.

**Recommended Pattern: Direct Manipulation on the Canvas.**

* **Interaction:** In a table or chart, the user drags the "Strongly Agree" header/bar and drops it onto the "Agree" header/bar.<sup>15</sup>
* **Feedback:** The visual elements merge. A tooltip appears: "Group Created. Name: [New Group]."
* **Source:** Displayr and Q allow dragging rows within a table to merge them.<sup>23</sup> This keeps the user in "Analysis Mode" while performing an ETL task.
* **Tableau Comparison:** Tableau uses a paperclip icon to group.<sup>24</sup> While functional, dragging is more tactile and aligns with the mental model of "combining."
### 5.2 Text Cleaning: Transform by Example

Cleaning messy text data (e.g., standardizing "US", "USA", "U.S.") usually requires Regex or complex formulas.

**Recommended Pattern: Programming by Example (PBE).**

* **Interaction:** The user selects a column in the Data Grid. They type the *desired output* for the first few rows (e.g., typing "United States" next to "USA").
* **System Response:** The system (using AI/Heuristics) infers the transformation rule and "ghosts" the predicted values for the rest of the column.<sup>25</sup>
* **Confirmation:** The user hits "Enter" to apply.
* **Source:** This pattern is popularized by **Excel Flash Fill** <sup>26</sup> and **Trifacta/Alteryx**.<sup>27</sup> It shifts the cognitive load from *process definition* (how to split strings) to *outcome definition* (what I want).
### 5.3 Harmonization: The Sankey Diagram

Harmonizing longitudinal data involves mapping variables from different survey waves (e.g., 2023 vs. 2024) to a common schema. This is a "Many-to-One" mapping problem that is notoriously difficult to visualize in a grid.

**Recommended Pattern: The Sankey Mapper.**

* **Visual Metaphor:** A **Sankey Diagram** <sup>28</sup> representing the flow of data.
* **Structure:**
    * **Left Column:** Source Variables (Wave 1 Categories).
    * **Right Column:** Target/Master Variables (Harmonized Categories).
    * **Flows:** Lines connecting sources to targets.
* **Utility:** The width of the flow represents the number of respondents. This allows users to visually audit the harmonization. If a massive flow from Wave 1 is mapped to "Other" in the Master, the user visually spots the data loss immediately.
* **Interaction:** Users can drag the flows to re-map categories. "Orphaned" nodes (unmapped categories) stand out visually.<sup>30</sup>
### 5.4 Data Lineage and Non-Destructive Editing

In local-first tools, "Undo" is powerful. However, complex ETL requires a visible history.

**Recommended Pattern: The Recipe Stack.**

* **Visual:** A side panel listing the sequence of transformations applied to the dataset (e.g., "1. Import", "2. Rename Q1", "3. Recode Q5", "4. Filter Speeders").<sup>31</sup>
* **Interaction:** Users can click a previous step to revert the view to that state ("Time Travel"). They can insert steps in the middle or delete steps.
* **Source:** **Power Query** <sup>32</sup> and **Trifacta** <sup>33</sup> use this effectively. It provides auditability—crucial for market research integrity—without requiring code version control.
## 6. Detailed UX Specifications for Velocity

Based on the research, the following specifications define the optimal architecture for Velocity.
### 6.1 The "Variable Manager" (Data Mode)

* **Access:** Toggled via specific UI button or hotkey D. Overlays the Analysis Canvas.
* **Layout:** Three-pane "Miller Column" design.
    * **Pane 1 (Navigation):** Folders (Demographics, Tracker, KPIs). Supports drag-and-drop organization.
    * **Pane 2 (Variable Grid):** List of variables within selected folder. Columns for Name, Label, Type, and **Sparkline Distribution**.
    * **Pane 3 (Detail Inspector):** Deep metadata for the selected variable (Value attributes, Missing values toggle, Full distribution histogram).
* **Capabilities:**
    * **Bulk Actions:** Shift+Click selection for bulk type conversion or hiding.<sup>18</sup>
    * **Search:** Faceted search bar at the top (Type, Status, Name).<sup>34</sup>
    * **Logic:** Formula builder for complex variables using a "Block" metaphor (like Scratch or simplified Knime nodes).<sup>35</sup>
### 6.2 The "Analysis Canvas" (Report Mode)

* **Layout:** Infinite canvas or dashboard grid (user selectable).
* **Sidebar:** Displays **Variable Sets** only (not raw columns). This "Curated List" is the output of the work done in the Variable Manager.
* **Drop Zones:** When dragging a variable, valid targets (Rows, Columns, Filter) light up with large, semi-transparent overlays (Heads-Up Display style).<sup>17</sup>
* **Visual ETL:**
    * **Recoding:** Drag bars/rows onto each other to group.
    * **Filtering:** Click a bar/slice -> Context Menu -> "Filter by this value" or "Exclude this value."
### 6.3 State Management & Transition

* **Persistence:** Selection state is shared. Selecting "Q1" in the Analysis Canvas sidebar and switching to "Data Mode" should auto-scroll the Variable Grid to "Q1."
* **Performance:** Transitions must be under 100ms. A "Skeleton Screen" or loading spinner destroys the cognitive connection between the modes.
## 7. Strategic Implications and Future Outlook
### 7.1 AI as the "Junior Analyst"

The "Transform by Example" pattern is the precursor to fully **AI-driven ETL**. Future iterations of Velocity should allow users to perform gardening via Natural Language Processing (NLP).

* *Query:* "Clean up the open-ended text in Q5 and group similar themes."
* *Action:* The AI proposes a grouping in the Variable Manager, which the user reviews and confirms.
### 7.2 Collaborative Data Prep

As survey projects involve teams, the Variable Manager must support **Multiplayer** interactions.

* **Presence:** Users should see who is editing the "Demographics" folder (Figma-style avatars).<sup>36</sup>
* **Conflict:** Visual indicators if two users attempt to recode the same variable simultaneously.
### 7.3 The Competitive Moat

By implementing this architecture, Velocity builds a moat against two flanks:

1. **Against General BI (Tableau):** Velocity handles "Variable Sets" and "Survey Logic" natively, removing the painful pivoting required in Tableau.
2. **Against Web Survey Tools (Crunch):** Velocity's local-first WASM engine allows for instant mode switching and "Direct Manipulation" ETL, providing a tactile feel that server-side tools cannot match due to latency.
## 8. Conclusion

The "Single Screen" prototype is a dead end for high-dimensional data. It conflates two distinct cognitive modes, leading to overload. The solution is not to retreat to the high-friction, modal separation of legacy BI tools, but to pioneer a **"Connected Hub-and-Spoke"** architecture.

By giving "Data Gardening" a dedicated, feature-rich environment (The Variable Manager) that is instantly accessible from the "Harvesting" environment (The Analysis Canvas), Velocity respects the user's need for both **Flow** and **Structure**. Combined with **Visual ETL** patterns like Drag-and-Merge and Sankey Harmonization, this architecture transforms data preparation from a chore into a creative, tactile part of the analytical process.

---
# Detailed Analysis: Section by Section
## 9. Architectural Deep Dive: Mode Separation

The question of *how* to separate data preparation from analysis is central to the UX strategy.
### 9.1 The Cost of Context Switching

Research in Human-Computer Interaction (HCI) suggests that "modal" interfaces often introduce "mode errors" and break "flow." However, for complex tasks, **focus** is more important than mode-lessness. When a user is cleaning a dataset of 2,000 variables, they need the full screen to see the matrix. They do not need to see the chart they are trying to build; they need to see the *ingredients*.

* **Tableau's Approach:** Tableau's "Data Source" tab is a separate context. The user defines the joins and pivots here. The cognitive cost is the *round trip*. To fix a data error seen in a chart, the user must leave the chart, find the data, fix it, and return.
* **Displayr's Approach:** Displayr attempts to keep the data tree and chart on one screen. The cost is **Fitts's Law** violations. The targets (variables in the tree) become small and crowded. The user spends significant mental energy aiming the mouse and scrolling.
### 9.2 The "Notebook" Alternative

Tools like **Hex** and **Deepnote** utilize a linear flow.

* **Structure:** Data Loader Block -> SQL Block -> Python Transformation -> Chart Block.
* **Pros:** This makes the *lineage* explicit. The user can see exactly where the data changed.
* **Cons:** It forces a linear chronology. Survey analysis is non-linear. An analyst might jump from Q1 to Q50 and back to Q5. A notebook structure makes this "jumping" difficult.
### 9.3 Validating the Hypothesis: The Hybrid Model

The research supports the hypothesis of a **"Variable Manager"** (Card/Grid style) combined with an **"Analysis Canvas"** (Dashboard style).

* **Support from Market Trends:**
    * **Figma:** Separates "Design" from "Dev Mode." Same canvas, different tools/panels.
    * **Crunch.io:** Uses a "Variable Organizer" mode that is distinct from the "Analysis" mode.<sup>37</sup>
    * **Alteryx:** Separates the "Workflow" (ETL) from the "Browse Tool" (Results).<sup>12</sup>

**Conclusion on Modes:** The separation is necessary for density management. The innovation Velocity can bring is the **speed of the transition** (WASM) and the **persistence of context** (keeping the same variables in focus across modes).
## 10. High-Dimensionality Patterns: Taming the List

The "List View" is the default pattern for data tools, but it fails at N=2,000.
### 10.1 Miller Columns (The Finder Pattern)

Miller Columns (cascading lists) allow users to navigate hierarchy without losing context.

* **Implementation:**
    * **Level 1:** Data Sources (Wave 1, Wave 2).
    * **Level 2:** Folders (Demographics, Attitudes).
    * **Level 3:** Variable Sets (Q1, Q2).
    * **Level 4:** Variables (Q1_1, Q1_2).
* **Advantages:**
    * **Preview:** Selecting an item in any column can show a preview in the next column.
    * **Wayfinding:** Users always see the "path" back to the root.
* **Source:** **macOS Finder** <sup>38</sup>, **Crunch.io** (Folders).<sup>17</sup>
### 10.2 The "Variable Card" Metaphor

Treating variables as "Cards" rather than text rows enables spatial organization.

* **Visuals:** A card can contain more than text. It can contain a **Sparkline** (data distribution) and **Quality Indicators** (red dot for missing data).
* **Interaction:** Card sorting is a natural human activity for categorization. A "Kanban" view for variables allows users to drag variables into "Done/Cleaned" or "To Review" buckets.
* **Source:** **Miro** (Sticky Notes) <sup>18</sup>, **Trello**.
### 10.3 Faceted Search

Faceted search is the standard for e-commerce (Amazon) and finding files (Finder). It applies perfectly to variables.

* **Facets:**
    * *Data Type:* (Categorical, Numeric, Text).
    * *Role:* (Filter, Weight, Target).
    * *Completeness:* (Full, Partial, Empty).
* **Interaction:** "Show me all Numeric variables with &lt;100% completeness." This instantly isolates problematic data.
* **Source:** **Algolia** / **Elasticsearch** UI patterns.<sup>20</sup>
## 11. Visual ETL Patterns: Democratizing Engineering

Velocity aims to be used by researchers, not data engineers. Code (SQL, Python, R) is a barrier.
### 11.1 Visual Recoding (Grouping)

Recoding is the act of mapping many values to fewer values.

* **Drag-and-Merge:** The most intuitive pattern. Drag "Pepsi" onto "Coke" to create "Cola."
    * **Feedback:** The UI must visually indicate the "Drop Target" and the resulting "Group."
    * **Source:** **Displayr** <sup>15</sup>, **Q Research Software**.<sup>39</sup>
* **Lasso Selection:** In a scatter plot or map, lasso points to group them.
    * **Source:** **Tableau**.<sup>3</sup>
### 11.2 Transform by Example (Flash Fill)

For text manipulation (splitting, extraction), "Programming by Example" is superior to Regex.

* **Mechanism:** The user provides examples of the input and desired output. The system induces the program.
* **User Experience:**
    1. User sees column "First Name Last Name".
    2. User creates new column.
    3. User types "First Name" in row 1.
    4. System auto-fills the rest.
* **Source:** **Excel Flash Fill** <sup>26</sup>, **Trifacta**.<sup>27</sup>
### 11.3 Visualizing Harmonization (Schema Mapping)

Mapping variables across time (longitudinal) or source (multi-market) is complex.

* **The Sankey Diagram:** This is the optimal visualization for "Flow" and "Mapping."
    * **Nodes:** Categories in Source A and Source B.
    * **Links:** The mapping logic.
    * **Width:** The number of records flowing through that map.
* **Why it works:** It makes **Data Loss** visible. If a category in Source A has no link to Source B, it is visually orphaned.
* **Source:** **Google Charts Sankey** <sup>28</sup>, **DataHub Lineage**.<sup>41</sup>
## 12. Integration and System Design
### 12.1 The "Variable Set" as First-Class Citizen

Velocity must enforce the "Variable Set" concept at the database level.

* **Structure:** A Variable Set is a container for 1+ Variables.
* **Behavior:** The Analysis Canvas operates on Sets. The Variable Manager operates on Variables *and* Sets.
* **Benefit:** This solves the dimensionality problem. 2,000 variables usually condense to ~150-200 Sets (Questions).
### 12.2 Local-First State Management

* **Architecture:** The "Database" is in the browser (SQLite via WASM or similar).
* **UX Implication:** "Save" is obsolete. "Undo" is infinite and instant.
* **Mode Switching:** Because the data is local, switching from Analysis to Variable Manager requires no network call. This allows the "Soft Modal" animation (sliding overlay) which preserves the user's mental map.
## 13. Conclusion and Recommendations

The research confirms that Velocity's "Single Screen" prototype is insufficient for the scale of data typical in market research. To succeed, Velocity must:

1. **Split the UI:** Adopt a **Hub-and-Spoke** model with a dedicated **Variable Manager** (Gardening) and **Analysis Canvas** (Harvesting).
2. **Organize by Sets:** Use the **Variable Set** abstraction to reduce list density.
3. **Use Visual Metaphors:** Implement **Miller Columns** for navigation, **Drag-and-Merge** for recoding, and **Sankey Diagrams** for harmonization.
4. **Leverage Speed:** Use WASM to make mode transitions instant, reducing the cognitive friction of the separation.

This architecture balances the need for rigorous data management with the need for fluid, creative analysis, positioning Velocity as a next-generation tool that transcends the limitations of both legacy desktop software and current web-based platforms.
#### Works cited

1. Crunch.io: Combine the Ease of Drag-and-Drop Analysis with the Speed of Scripting, accessed on January 20, 2026, [https://www.youtube.com/watch?v=-4OKGkT9z-c](https://www.youtube.com/watch?v=-4OKGkT9z-c)
2. Variable explorer - Deepnote docs, accessed on January 20, 2026, [https://deepnote.com/docs/variable-explorer](https://deepnote.com/docs/variable-explorer)
3. Workbooks and Sheets - Tableau Help, accessed on January 20, 2026, [https://help.tableau.com/current/pro/desktop/en-us/environ_workbooksandsheets.htm](https://help.tableau.com/current/pro/desktop/en-us/environ_workbooksandsheets.htm)
4. Data Source Page - Tableau Help, accessed on January 20, 2026, [https://help.tableau.com/current/pro/desktop/en-us/environment_datasource_page.htm](https://help.tableau.com/current/pro/desktop/en-us/environment_datasource_page.htm)
5. Difference between making changes in Data View vs Power Query editor? : r/PowerBI, accessed on January 20, 2026, [https://www.reddit.com/r/PowerBI/comments/123h7zl/difference_between_making_changes_in_data_view_vs/](https://www.reddit.com/r/PowerBI/comments/123h7zl/difference_between_making_changes_in_data_view_vs/)
6. Key Differences Between Q and Displayr, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/4855245618575-Key-Differences-Between-Q-and-Displayr](https://help.displayr.com/hc/en-us/articles/4855245618575-Key-Differences-Between-Q-and-Displayr)
7. Overview of the User Interface - Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/4404808948751-Overview-of-the-User-Interface](https://help.displayr.com/hc/en-us/articles/4404808948751-Overview-of-the-User-Interface)
8. Variable Sets – Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/360004639255-Variable-Sets](https://help.displayr.com/hc/en-us/articles/360004639255-Variable-Sets)
9. Hex vs VS Code | Data Science Notebooks, accessed on January 20, 2026, [https://datasciencenotebook.org/compare/hex/vscode](https://datasciencenotebook.org/compare/hex/vscode)
10. Hex: Bring the magic of AI to data, for everyone, accessed on January 20, 2026, [https://hex.tech/](https://hex.tech/)
11. Introducing: “No-Code” Cells - Hex, accessed on January 20, 2026, [https://hex.tech/blog/introducing-no-code-cells/](https://hex.tech/blog/introducing-no-code-cells/)
12. Data Preparation, Blending, and Enrichment Tools - Alteryx, accessed on January 20, 2026, [https://www.alteryx.com/products/capabilities/data-preparation-tools](https://www.alteryx.com/products/capabilities/data-preparation-tools)
13. NEW FEATURE FRIDAY | TRIFACTA - The Information Lab, accessed on January 20, 2026, [https://www.theinformationlab.co.uk/community/blog/new-feature-friday-trifacta/](https://www.theinformationlab.co.uk/community/blog/new-feature-friday-trifacta/)
14. Getting Started - Crunch.io, accessed on January 20, 2026, [https://crunch.io/r/crunch/articles/crunch.html](https://crunch.io/r/crunch/articles/crunch.html)
15. Understanding Variable Sets in Displayr: A Tutorial, accessed on January 20, 2026, [https://www.displayr.com/variable-sets/](https://www.displayr.com/variable-sets/)
16. 15 Tips For Using Column View In the Mac Finder - MacMost.com, accessed on January 20, 2026, [https://macmost.com/15-tips-for-using-column-view-in-the-mac-finder.html](https://macmost.com/15-tips-for-using-column-view-in-the-mac-finder.html)
17. Organizing Variables – Help Center, accessed on January 20, 2026, [https://help.crunch.io/hc/en-us/articles/360040060112-Organizing-Variables](https://help.crunch.io/hc/en-us/articles/360040060112-Organizing-Variables)
18. Bulk action UX: 8 design guidelines with examples for SaaS - Eleken, accessed on January 20, 2026, [https://www.eleken.co/blog-posts/bulk-actions-ux](https://www.eleken.co/blog-posts/bulk-actions-ux)
19. Organization of 500+ items - icons - UX Stack Exchange, accessed on January 20, 2026, [https://ux.stackexchange.com/questions/114344/organization-of-500-items](https://ux.stackexchange.com/questions/114344/organization-of-500-items)
20. Faceted Search — The Silent Workhorse of Every Industry | by Khili Sharma | Medium, accessed on January 20, 2026, [https://medium.com/@herstackoverflow/faceted-search-the-silent-workhorse-of-every-industry-26c3729af761](https://medium.com/@herstackoverflow/faceted-search-the-silent-workhorse-of-every-industry-26c3729af761)
21. Add facets to a query - Azure AI Search | Microsoft Learn, accessed on January 20, 2026, [https://learn.microsoft.com/en-us/azure/search/search-faceted-navigation](https://learn.microsoft.com/en-us/azure/search/search-faceted-navigation)
22. Overview of Visual Profiling - Alteryx Help, accessed on January 20, 2026, [https://help.alteryx.com/aac/en/trifacta-classic/concepts/feature-overviews/overview-of-visual-profiling.html](https://help.alteryx.com/aac/en/trifacta-classic/concepts/feature-overviews/overview-of-visual-profiling.html)
23. How to Combine and Split Variable Sets - Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/360004128475-How-to-Combine-and-Split-Variable-Sets](https://help.displayr.com/hc/en-us/articles/360004128475-How-to-Combine-and-Split-Variable-Sets)
24. Grouping Data in Tableau - YouTube, accessed on January 20, 2026, [https://www.youtube.com/watch?v=y6VEMVpwWX0](https://www.youtube.com/watch?v=y6VEMVpwWX0)
25. Add a column from examples - Power Query - Microsoft Learn, accessed on January 20, 2026, [https://learn.microsoft.com/en-us/power-query/column-from-example](https://learn.microsoft.com/en-us/power-query/column-from-example)
26. Excel's Autofill and Flash Fill for Quick Data Patterns - Graduate School USA, accessed on January 20, 2026, [https://www.graduateschool.edu/learn/excel/excel-autofill-flash-fill-quick-data-patterns](https://www.graduateschool.edu/learn/excel/excel-autofill-flash-fill-quick-data-patterns)
27. Transform by Example: Your Data Cleaning Wish is Our Command | Alteryx, accessed on January 20, 2026, [https://www.alteryx.com/blog/transform-by-example-your-data-cleaning-wish-is-our-command](https://www.alteryx.com/blog/transform-by-example-your-data-cleaning-wish-is-our-command)
28. Sankey Diagram | Charts - Google for Developers, accessed on January 20, 2026, [https://developers.google.com/chart/interactive/docs/gallery/sankey](https://developers.google.com/chart/interactive/docs/gallery/sankey)
29. Deep Dive on Sankey Diagrams - Plotly, accessed on January 20, 2026, [https://plotly.com/blog/sankey-diagrams/](https://plotly.com/blog/sankey-diagrams/)
30. Sankey diagram - Wikipedia, accessed on January 20, 2026, [https://en.wikipedia.org/wiki/Sankey_diagram](https://en.wikipedia.org/wiki/Sankey_diagram)
31. Transform Basics - Alteryx Help, accessed on January 20, 2026, [https://help.alteryx.com/aac/en/trifacta-classic/basics/transform-basics.html](https://help.alteryx.com/aac/en/trifacta-classic/basics/transform-basics.html)
32. Query Overview in Power BI Desktop - Microsoft Learn, accessed on January 20, 2026, [https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-query-overview](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-query-overview)
33. Trifacta Student Lab Guide - Amazon S3, accessed on January 20, 2026, [https://s3-us-west-2.amazonaws.com/training.trifacta.com/online-resources/v4.0/Chapter+2A.pdf](https://s3-us-west-2.amazonaws.com/training.trifacta.com/online-resources/v4.0/Chapter+2A.pdf)
34. User Interface design for selecting elements from big lists, accessed on January 20, 2026, [https://softwareengineering.stackexchange.com/questions/336311/user-interface-design-for-selecting-elements-from-big-lists](https://softwareengineering.stackexchange.com/questions/336311/user-interface-design-for-selecting-elements-from-big-lists)
35. Create, Modify, and Configure a Component in KNIME Analytics Platform - YouTube, accessed on January 20, 2026, [https://www.youtube.com/watch?v=F38tgMXV2KU](https://www.youtube.com/watch?v=F38tgMXV2KU)
36. Master Figma's Advanced Tag UI with Auto Layout & Variables - YouTube, accessed on January 20, 2026, [https://www.youtube.com/watch?v=CfPB1_FJFtA](https://www.youtube.com/watch?v=CfPB1_FJFtA)
37. Organize Variables into Folders - Help Center, accessed on January 20, 2026, [https://help.crunch.io/hc/en-us/articles/360045553112-Organize-Variables-into-Folders](https://help.crunch.io/hc/en-us/articles/360045553112-Organize-Variables-into-Folders)
38. Change how folders are displayed in the Finder on Mac - Apple Support, accessed on January 20, 2026, [https://support.apple.com/guide/mac-help/change-folders-displayed-finder-mac-mchldaafb302/mac](https://support.apple.com/guide/mac-help/change-folders-displayed-finder-mac-mchldaafb302/mac)
39. Set Question - Q Wiki, accessed on January 20, 2026, [https://wiki.q-researchsoftware.com/wiki/Set_Question](https://wiki.q-researchsoftware.com/wiki/Set_Question)
40. Flash Fill Gives Excel a Smart Charge - Microsoft Research, accessed on January 20, 2026, [https://www.microsoft.com/en-us/research/blog/flash-fill-gives-excel-smart-charge/](https://www.microsoft.com/en-us/research/blog/flash-fill-gives-excel-smart-charge/)
41. Data Lineage Software | DataHub Cloud, accessed on January 20, 2026, [https://datahub.com/products/data-lineage/](https://datahub.com/products/data-lineage/)