# Research Brief: UX Patterns for Modern Data Analysis Platforms

## 1. Context & Background
**App Name:** Velocity
**Current State:** A local-first, high-performance survey analysis tool running in the browser (WASM).
**Current Experience:** A single-screen prototype where:
*   A sidebar lists 500+ raw variables.
*   A central canvas handles drag-and-drop analysis (tables).
*   Data management (renaming, recoding) is handled via disparate modals or is missing.

**The Problem:**
The single-screen approach is becoming cognitively overloaded. Users struggle to switch between "Organizing/Cleaning Data" and "Analyzing Data". We believe we need to split the application into distinct "Modes" or screens, but we need to validate this hypothesis and find the best design patterns.

## 2. Research Objective
We are looking for a comprehensive exploration of **UX Design Patterns** in:
1.  **Specialized Survey Tools:** (e.g., Displayr, Qualtrics, Crunch.io).
2.  **General Data Science/BI Tools:** (e.g., Tableau, PowerBI, Hex, Deepnote).
3.  **Visual Collaboration Tools:** (e.g., Miro, Figma) - specifically for managing large numbers of items (variables).

**Primary Goal:** Determine the optimal architecture for separating (or integrating) **Data Engineering (ETL)** and **Data Analysis**.

## 3. Key Questions to Answer

### A. The "Mode" Separation
*   How do best-in-class tools separate the "Data Prep" phase from the "Analysis" phase?
    *   Is it a hard switch (like Tableau's "Data Source" vs "Sheet")?
    *   Is it a seamless blend?
    *   Is it a "Notebook" flow?
*   *Hypothesis to test:* We believe a "Variable Manager" (Card Sorting style) combined with an "Analysis Canvas" (Dashboard style) is the right approach. Is this supported by market trends?

### B. Managing High-Dimensionality
*   Survey data often has 500-2,000 columns (variables). Standard "Excel-like" grids fail here.
*   What broadly successful patterns exist for organizing/grouping 1,000+ items?
    *   Card Sorting?
    *   Mind Mapping?
    *   Facet Search / Finder patterns?

### C. Visual ETL
*   We want to avoid code-heavy ETL. What are the best visual metaphors for:
    *   **Recoding:** Grouping values (e.g., merging "Agree" + "Strongly Agree").
    *   **Harmonization:** Example: Visualizing how "Education" changed between 2020 and 2024. (Sankey diagrams? Flowcharts?)

## 4. Output Requirements
*   **Case Studies:** Screenshots/descriptions of how 3-4 top competitors handle the Prep-to-Analysis transition.
*   **Pattern Library:** A collection of relevant UI patterns (e.g., "The Split Pane", "The Modal Editor", "The Flow Canvas").
*   **Recommendation:** Based on the research, should Velocity adopt a strictly modal architecture (separate screens) or investigate a unified but structured workspace?
