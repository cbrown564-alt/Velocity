# Velocity Glossary & Domain Terms

This document provides a shared vocabulary for the Velocity team, translating between Technical, User-Facing, and Market Research (MR) industry terms.

## 1. Velocity UI Terms

| Term | Definition | Context |
| :--- | :--- | :--- |
| **The Pantry** | The left sidebar containing the list of all variables in the dataset. | "Drag 'Age' from the Pantry to the Canvas." |
| **The Canvas** | The central workspace where analysis happens (crosstabs, charts). | "Drop it onto the Canvas." |
| **Question** | The user-facing name for a Variable. We avoid "Variable" in the UI to feel less technical. | "Search for Question 5." |
| **Card** | The visual representation of a variable in the Pantry. | "The card shows the question text and a sparkline." |
| **Analyst Mode** | The toggle that reveals Phase 3 advanced features (WebR, Syntax Drawer). | "Switch to Analyst Mode to run a regression." |

## 2. Market Research (MR) Terminology

| Term | Definition |
| :--- | :--- |
| **Stub** | The rows of a crosstab (usually the main question being analyzed). |
| **Banner** | The columns of a crosstab (usually demographic breakdowns like Age, Gender). |
| **Crosstab** | A cross-tabulation table showing the relationship between two or more variables. |
| **Top 2 Box (T2B)** | The sum of the top two positive scale points (e.g., "Somewhat Agree" + "Strongly Agree"). Used as a key performance metric. |
| **Bottom 2 Box (B2B)**| The sum of the bottom two negative scale points. |
| **Net** | A combined category (different from T2B, can be any bespoke grouping). Consolidating "Coke" and "Diet Coke" into "Total Coke". |
| **Base (N)** | The total number of respondents included in a calculation. |
| **Effective Base** | The equivalent sample size after accounting for the efficiency loss due to weighting. |
| **Weighting** | Adjusting the data so that the sample distribution matches the target population (e.g., making sure 50% of the data counts as "Male" even if only 40% of respondents were male). |
| **Significance Testing** | Statistical tests (t-test, chi-square) used to compare columns. Usually denoted by letters (A, B, C...) assigned to columns. |

## 3. Technical Terminology

| Term | Definition |
| :--- | :--- |
| **Variable (Internal)**| The atomic unit of data storage in DuckDB/Arrow. Corresponds to a "Question" in the UI. |
| **Dataset** | A collection of variables and rows. Currently maps 1:1 to a loaded `.sav` file. |
| **Dual-State** | The concept that a variable has both **Raw Values** (integers) for computation and **Labels** (strings) for display. |
| **User Missing** | Specific definitions in SPSS/metadata that say "Code 99 means 'Don't Know' and should be excluded from the Base." |
| **Lazy Loading** | The architecture strategy of only downloading heavy engines (WebR, Pyodide) when specifically requested. |
