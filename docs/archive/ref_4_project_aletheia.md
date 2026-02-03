## 1. The Analytical Stagnation: Why General Purpose Tools Fail Specialized Data

The global market research and social science sectors operate on a technological paradox. While data collection methods have evolved rapidly—shifting from clipboard-based interviews to mobile intercepts and real-time sentiment scraping—the tools used to analyze this data remain entrenched in paradigms established decades ago. The incumbent hegemony, dominated by IBM’s **SPSS Statistics** and newer challengers like **Displayr**, relies on a generalized approach to data processing. These platforms treat data as a monolithic grid of rows and columns, agnostic to the underlying structure or the semantic richness of the information contained within. A row is a row, whether it represents a timestamped server log, a clinical trial patient, or a respondent in a complex, multi-wave tracking study.

This generalization is a fundamental architectural flaw when applied to the specific, nuanced domain of longitudinal survey research. Datasets like the **World Values Survey (WVS)**—arguably the most complex and historically significant repository of human sentiment in existence—expose the brittle nature of these general-purpose tools. The WVS is not merely "data"; it is a distributed, multi-generational archive of shifting cultural norms, characterized by extreme "width" (thousands of variables), deep nesting (individuals within regions within countries within waves), and a heavy reliance on metadata (value labels, missing value codes, and weighting schemes).

**Project Aletheia** is proposed as a direct response to this stagnation. It is a blueprint for a purpose-built statistical environment designed not for the "average" dataset, but specifically for the "wide," "long," and "messy" reality of cross-national survey data. By leveraging the emerging "Local-First" web stack—comprising **DuckDB Wasm** for columnar storage, **Rust** for high-performance ingestion, and **WebR** for gold-standard statistical computation—Aletheia aims to move the center of analytical gravity from the server to the client. This report outlines the technical requirements, user experience paradigms, and strategic trade-offs necessary to build a tool that does not just replicate the functionality of SPSS, but fundamentally accelerates the extraction of insight from the complex tapestry of human survey data.


### 1.1 The Limitations of the Spreadsheet Metaphor

The dominant user interface paradigm in current statistical software is the spreadsheet view—the "Data View" in SPSS or the grid in Excel. This visual metaphor assumes that the primary unit of interaction is the *cell*. However, in large-scale survey analysis, the researcher almost never interacts with a single cell. They interact with *constructs*—abstract concepts like "Democracy" or "Happiness" that are measured across multiple variables and waves.

When a researcher opens the WVS Longitudinal File (1981–2022) in SPSS, they are confronted with a grid containing over 400,000 rows and thousands of columns. This presentation is cognitively overwhelming. It forces the user to mentally map cryptic variable names (e.g., E025, F118) to their theoretical concepts ("Political Action", "Justifiability of Homosexuality"). The disconnect between the user's mental model (concepts and trends) and the tool's interface (rows and codes) creates massive friction. Project Aletheia seeks to replace this spreadsheet metaphor with a **Construct-First** interface, utilizing visual abstraction and direct manipulation to manage the complexity of high-dimensional data.


### 1.2 The "Thick Client" Opportunity

Historically, analyzing a 1GB+ dataset like the Integrated Values Surveys (IVS) required a desktop application or a powerful server. Web-based tools like Displayr rely on server-side processing, where every interaction—dragging a variable to a chart, filtering a country—triggers a round-trip request to the cloud. This introduces latency that breaks the flow of exploration. It also raises data sovereignty issues; researchers working with sensitive field data in restrictive jurisdictions may be legally prohibited from uploading datasets to US-hosted cloud servers.

Recent advances in browser technologies allow us to invert this model. With **WebAssembly (Wasm)**, we can compile high-performance C++ and Rust engines to run directly in the browser's memory sandbox. **DuckDB**, an embedded analytical SQL database, can now run client-side, executing vectorized queries on millions of rows in milliseconds without the data ever leaving the user's device. This architecture enables Aletheia to offer the privacy and responsiveness of a desktop app with the accessibility and collaboration features of the web—a "Thick Client" for the modern age.


## 2. The Archetype: Deconstructing the World Values Survey Data

To build a tool that outperforms general-purpose software, we must first deeply understand the specific characteristics of the data it is optimized for. The World Values Survey serves as the ultimate "stress test" for any survey analysis platform. It represents a class of data shared by large-scale commercial tracking studies (e.g., brand health trackers) and governmental panel surveys.


### 2.1 Structural Morphology: Wide, Long, and Sparse

The WVS is released in "waves," with the most recent, Wave 7 (2017–2022), covering 66 countries. The "Holy Grail" for analysts is the longitudinal merged file, which combines all WVS waves with the European Values Study (EVS) to cover a 40-year timespan.

This creates a dataset with unique morphological traits:



* **Extreme Width:** A single wave might contain 300 questions. Over 40 years, questions are added, dropped, or modified. The union of all variables results in a "wide" dataset with thousands of columns.
* **Systematic Sparsity:** Because questions change between waves, the data matrix is sparse. A question about "Social Media Usage" introduced in 2017 will have missing values for all respondents from 1981 to 2015. Unlike random missingness in other fields, this is *structural missingness*.
* **Hierarchical Nesting:** The data is strictly nested: Individual Respondents (L_1) \rightarrow Regional Sub-units (L_2) \rightarrow Country-Years (L_3) \rightarrow Countries (L_4).

**Implication for Aletheia:** Standard row-based storage engines (like JavaScript's native Array of Objects or simple CSV parsers) are inefficient for this structure. They waste memory storing null or NA for the structural gaps. Aletheia must utilize a **Columnar Store** (specifically DuckDB) which uses techniques like Run-Length Encoding (RLE) to compress these extensive runs of missing values, reducing the memory footprint by 60–80% and allowing the full longitudinal file to fit within the browser's memory limits.


### 2.2 The Metadata Dependency: The .sav Legacy

The industry standard for distributing this data is the **SPSS System File (.sav)**. Unlike a CSV file, which stores only text, a .sav file is a binary database that tightly couples the data (integers) with the metadata (labels).

Consider the variable V240 (Sex):



* **Data Level:** Stored as integers 1 and 2. This is efficient for storage and computation.
* **Metadata Level:** Mapped via a dictionary to 1 = "Male" and 2 = "Female".
* **Missing Value Definitions:** Specific integers like -1, -2, and -4 are flagged as "User Missing" values, corresponding to "Don't Know", "No Answer", and "Not Asked" respectively.

**Constraint of Current Tools:** Many modern data science tools (e.g., Pandas in Python, generic SQL clients) treat these files clumsily. They often force the user to choose between loading the raw integers (losing the meaning) or the string labels (losing the efficiency and order). Furthermore, they often treat all negative numbers as a generic NaN (Not a Number), destroying the distinction between a respondent who *refused to answer* (-2) and one who was *never asked the question* (-4). This distinction is critical for calculating valid response rates.

**Aletheia Requirement:** The ingestion engine must implement a **Dual-State Variable System**. Every variable must effectively be an object containing both a typed array of integers (for the DuckDB compute engine) and a hash map of labels (for the UI). The system must natively respect "User Missing" definitions, allowing the user to toggle whether -1 is treated as a null value (excluded from means) or a valid category (included in frequency counts) with a single click.


### 2.3 The Harmonization Nightmare

The single greatest friction point in longitudinal analysis is **variable harmonization**. Over a 40-year period, the specific wording of questions and the coding of answers inevitably drift.



* **Identifier Drift:** A question measuring "Life Satisfaction" might be coded as V22 in Wave 2, A170 in Wave 5, and Q49 in Wave 7. The WVS archivists provide "Correspondence Tables" (Excel files) to map these , but applying them in SPSS requires tedious renaming scripts.
* **Scale Inversion:** A particularly egregious issue occurred in WVS Wave 7, where many scales were "inverted" compared to previous waves. For example, on a scale of 1-10, "1" might have historically meant "Completely Dissatisfied," but in the new wave, it was recoded to mean "Completely Satisfied". Merging these waves without careful recoding results in a dataset where the trend line is complete noise.
* **Input vs. Output Harmonization:** The WVS uses "Input Harmonization" for core questions (asking the exact same question in every language) but "Output Harmonization" for socio-demographics like Education. Local interviewers record the specific local degree (e.g., "Abitur" in Germany, "Baccalauréat" in France), which is then mapped to the international ISCED standard. This mapping is often lossy and subject to error.

**Aletheia Requirement:** The tool cannot treat harmonization as a manual pre-processing step. It must feature a dedicated **Harmonization Workspace**. This interface would visualize the lineage of a variable across waves, flagging discontinuities (like scale inversions) and allowing users to visually "wire" variables together across time, creating a unified longitudinal construct without writing complex IF/ELSE syntax.


## 3. Technical Architecture: The "Local-First" Engine

To deliver on the promise of instant interaction with massive survey files, Aletheia requires a sophisticated client-side architecture. We are moving beyond the era of "sending a CSV to a Python server" and entering the era of the **Browser-Based Data Warehouse**.


### 3.1 The Ingestion Layer: Rust and ReadStat

The first hurdle is getting the data into the browser. Browsers natively understand JSON and CSV, but they do not understand the binary .sav or .dta formats used by WVS. JavaScript libraries for parsing these formats exist but are notoriously slow and often incomplete.

**The Solution: Rust + Wasm.** We will utilize **ReadStat**, the robust C library developed for the R haven package, which is the industry standard for parsing SPSS/Stata files. By wrapping ReadStat in **Rust** and compiling it to WebAssembly, Aletheia can achieve near-native parsing speeds within the browser.



* **Process:** When a user drags a 500MB .sav file into Aletheia, the Rust Wasm module intercepts the file stream. It parses the binary structure, extracting the data into an **Apache Arrow** IPC stream and the metadata (labels) into a separate JSON object.
* **Zero-Copy Transfer:** This Arrow stream is then passed directly to the DuckDB database. Because both Arrow and DuckDB share a columnar memory layout, this transfer can be zero-copy (or near zero-copy), meaning we do not waste time or memory serializing data between the parser and the database.


### 3.2 The Storage Layer: DuckDB Wasm

Once parsed, the data resides in **DuckDB Wasm**. This is an in-process SQL OLAP database designed for analytical workloads.



* **Vectorized Execution:** DuckDB processes data in batches of column vectors (e.g., 1024 values at a time) rather than row-by-row. For a query like SELECT country, AVG(satisfaction) FROM wvs GROUP BY country, DuckDB is orders of magnitude faster than standard JavaScript array iteration or row-based databases like SQLite.
* **Parquet Transcoding:** To handle the memory constraints of the browser (typically limited to ~4GB per tab), Aletheia will automatically transcode the raw survey data into **Parquet** files stored in the browser's origin-private file system (OPFS). Parquet is a columnar file format that supports compression (Snappy/Zstd) and encoding schemes (RLE/Dictionary) that are highly effective for survey data.
    * *Example:* A column of 400,000 responses where 300,000 are -4 (Not Asked) compresses to almost nothing in Parquet using RLE, whereas it would occupy megabytes in a standard array.
* **Streaming Execution:** DuckDB supports streaming query execution. This means that even if a query involves millions of rows, DuckDB can process it in chunks, ensuring the browser UI thread never freezes.


### 3.3 The Statistical Core: WebR vs. Pyodide

While DuckDB handles data manipulation (filtering, aggregating), it is not a statistical engine. It cannot calculate Cronbach's Alpha, run a Factor Analysis, or estimate a Mixed-Effects Model. For this, we need a full statistical runtime.

**The Choice: WebR (R in Wasm) over Pyodide (Python in Wasm).** While Python is dominant in general data science, **R** remains the undisputed king of academic social science and survey statistics.



* **Library Maturity:** The specific methods used in WVS research—such as **Multi-level Modeling** (lme4) and **Psychometrics** (psych, lavaan)—are far more mature and stable in R than in Python. Python's statsmodels implementation of mixed models (mixedlm) is known to be slower and more prone to convergence failures on complex nested data compared to R's lme4.
* **Performance:** Benchmarks indicate that for mixed-effects models (a key requirement for WVS), R's lme4 is significantly faster than Python's alternatives.
* **Existing Codebase:** Much of the existing WVS methodology (e.g., the Inglehart-Welzel syntax) is published in SPSS or R. Porting this to Python would be error-prone; running it natively in R via WebR ensures reproducibility.

**Architecture:** Aletheia will run **WebR** in a dedicated Web Worker. When a user requests a complex analysis (e.g., a Factor Analysis), DuckDB will export the relevant columns to an Arrow buffer, transfer it to the WebR worker, where R will ingest it, run the factanal() function, and return the results as a JSON object to the UI.


## 4. Reimagining the User Experience: The "Builder" Mode

The "Builder" mode in Aletheia is where the researcher constructs their dataset. This is the direct challenger to the "Variable View" in SPSS or the "Data" tab in Displayr. The goal is to reduce cognitive load through visual metaphors that match the researcher's mental model.


### 4.1 Variable Management: The Card Sorting Interface

In a dataset with 500+ variables, a linear list is the worst possible interface. It requires the user to read and process text sequentially.



* **The Solution:** A **Card Sorting UI**.
* **Visual Representation:** Variables are not rows in a list; they are "Cards." Each card displays:
    * **Header:** Variable Label ("Trust in people").
    * **Sub-header:** Variable Name/ID (A165).
    * **Sparkline:** A mini-histogram showing the distribution of responses. This allows the user to instantly assess data quality—is the data skewed? Is it mostly missing?
* **Interaction Pattern:** The workspace is an infinite canvas. Users drag variable cards from a "Deck" (sidebar) onto the canvas.
    * **Grouping:** Dragging one card onto another creates a **Cluster** or "Construct." For example, dragging "Trust in family," "Trust in neighbors," and "Trust in strangers" together creates a cluster named "Social Trust."
    * **Cognitive Benefit:** This mimics the physical card sorting methods used in UX research and psychology to organize concepts. It aligns with the "chunking" principle of memory, allowing researchers to manage massive variable counts by organizing them into a small number of semantic groups.


### 4.2 Visual Recoding: The "Bucketing" Metaphor

Recoding variables (e.g., collapsing a 10-point scale into "Low," "Medium," "High") is the most frequent data cleaning task. In SPSS, this involves a modal dialog where users type logic: IF (x &lt;= 3) y = 1. This is slow and error-prone.



* **The Solution:** **Interactive Visual Bucketing**.
* **Interface:** When a user selects a variable for recoding, Aletheia displays a large, interactive bar chart of the frequency distribution.
* **Interaction:** The user performs a "Lasso" gesture (click and drag) over bars 1, 2, and 3.
    * A pop-over appears: "Create Group?"
    * The user types "Low."
    * The bars visually collapse into a single block labeled "Low."
* **Feedback Loop:** The chart immediately updates to show the new distribution (e.g., "Low: 30%").
* **Logic Generation:** Behind the scenes, Aletheia generates the standard R code (case_when(...)) or SQL (CASE WHEN...) to execute this transformation. This code is accessible in a "Syntax Drawer" for verification, satisfying the need for transparency.


### 4.3 The Harmonization Bridge: A Sankey Mapper

To solve the WVS wave-merging problem—where "Education" in Wave 6 does not perfectly match "Education" in Wave 7—Aletheia introduces the **Harmonization Bridge**.



* **Visual Metaphor:** A **Sankey Diagram**.
* **Layout:**
    * **Left Pillar:** The categories of the source variable (e.g., Wave 6 Education: "Incomplete Secondary", "Complete Secondary").
    * **Right Pillar:** The categories of the target variable (e.g., Wave 7 Education: "Lower Secondary", "Upper Secondary").
    * **Flows:** Lines connect the left categories to the right categories based on the current mapping logic.
* **Interaction:**
    * **Visualizing Loss:** If two source categories map to the same target category (loss of detail), the flow lines merge. If a source category has no target (data loss), the line terminates in a "Unmapped" bucket (colored red).
    * **Remapping:** The user can click a flow line and drag it to a different target category to modify the mapping logic.
* **Benefit:** This visualizes the *consequences* of harmonization decisions in a way that code scripts cannot. It exposes the "messiness" of longitudinal data and forces the researcher to confront trade-offs explicitly.


# Section 5: Democratizing Advanced Statistics: The "Analyst" Mode

WVS data requires specific, advanced statistical methods that are often intimidating to perform in general-purpose tools. Aletheia automates the setup of these models, acting as an "Expert System" that guides the user toward methodological validity.


### 5.1 The Cultural Map Generator (Factor Analysis Wizard)

The **Inglehart-Welzel Cultural Map** is the most famous output of the WVS. It reduces 10 specific variables into two dimensions: *Traditional vs. Secular-Rational* and *Survival vs. Self-Expression*. Replicating this in SPSS requires complex syntax to handle missing values, factor rotation, and score saving.



* **Feature:** The **Cultural Map Template**.
* **Automation:** Aletheia comes pre-loaded with the standard definitions. It scans the dataset for the required variables (e.g., F063 "Importance of God", F120 "Justifiable: Abortion") using the WVS codebook definitions.
* **The "What-If" Engine:** Researchers often want to test variations. "What if we replace 'Abortion' with 'Divorce'?"
    * The user drags "Divorce" into the model.
    * **WebR** instantly re-runs the Factor Analysis (Principal Components or PAF with Varimax rotation) in the background.
    * **Visual Output:** Instead of a text table of loadings, Aletheia displays a **Force-Directed Graph** or a **Loading Plot** (vectors). Variables that "load" together cluster visually. The user can visually "prune" weak variables (short vectors) by cutting their links.
    * **Result:** A scatterplot of countries on the new dimensions is generated instantly.


### 5.2 Auto-Hierarchical Modeling (MLM)

Standard OLS regression is statistically invalid for WVS data because respondents are clustered within countries. This violates the assumption of independence, leading to underestimated standard errors. Correct analysis requires **Multi-level Modeling (MLM)**.



* **The Barrier:** Setting up an MLM in SPSS (MIXED) or R (lmer) is complex. Users often default to OLS because it's easier.
* **The Aletheia Solution:** **Auto-Hierarchy Detection.**
    * **Algorithm:** When a user initializes a regression, Aletheia scans the variables. It detects S003 (Country Code) as a grouping variable (high cardinality, categorical, repeating values).
    * **Prompt:** The system proactively suggests: *"This data appears to be clustered by Country. Would you like to use a Mixed Effects Model to correct for group-level variance?"*
* **Optimization:** Running a full MLM on 400,000 rows can be slow. Aletheia utilizes **Variational Inference** or **Laplace Approximation** methods (via specific R or C++ libraries interfaced through WebAssembly) to provide a "Quick Look" approximation in seconds. This allows for interactive model building. The user can then select "Run Final Model" to execute the rigorous (but slower) REML estimation via lme4 in the WebR worker.


### 5.3 Context-Aware Weighting

Weighting in WVS is critical and confusing. There are weights for national representativeness (S017) and weights for cross-national pooling (S018, S019).



* **Current Failure Mode:** A user applies the "Pool" weight (S018) to compare countries, then filters to look at just "Brazil" but forgets to switch back to the "National" weight (S017).
* **Aletheia Solution:** The weighting selector is not a global toggle but a **View Property**.
    * When the view is "Single Country," Aletheia defaults to S017.
    * When the view is "Cross-National Comparison," Aletheia automatically switches to S018.
    * The UI displays a visible "Weighting Badge" that changes color/label based on the context, alerting the user to the active weighting regime.


# Section 6: Visualizing the Human Condition: The "Explorer" Mode

Static charts cannot do justice to a 40-year global dataset. Aletheia leverages GPU acceleration to allow users to interact with the raw data, not just the aggregates.


### 6.1 Breaking the DOM Barrier with WebGL

Plotting 400,000 respondents on a scatterplot using standard web technologies (SVG or HTML Canvas) typically crashes the browser or results in single-digit frame rates. The Document Object Model (DOM) simply cannot handle that many elements.



* **The Solution:** **Regl (WebGL)**.
* **Implementation:** Aletheia uses the **Regl-Scatterplot** library, which renders points directly on the GPU. This allows for rendering 10 to 20 million points with smooth 60fps zooming and panning.
* **Interaction:**
    * **Lasso Selection:** Users can draw a freehand shape around a cluster of points (e.g., respondents who are both "High Secular" and "Low Happiness").
    * **Shader Picking:** This selection is handled on the GPU, allowing for instant identification of the selected points.
    * **Sidebar Drilldown:** A side panel instantly updates to show the demographic profile of the selected cluster (e.g., "Selection is 65% Female, mostly from Nordic countries"). This technique, known as **Brushing and Linking**, connects the abstract geometric space of the scatterplot to the concrete demographic reality of the respondents.


### 6.2 The "Time Machine" Animation

To visualize cultural change (e.g., the secularization of Western Europe or the post-Soviet value retrenchment), Aletheia implements a **Gapminder-style** animation engine.



* **Mechanism:**
    * **The Axis:** The Cultural Map (Traditional/Secular vs Survival/Self-Expression).
    * **The Entities:** Bubbles representing Countries (sized by population or GDP).
    * **The Timeline:** A slider covering 1981–2022.
* **Interpolation Strategy:** Since WVS waves happen only every 5 years, the data is discontinuous. Aletheia uses **Linear or Spline Interpolation** to calculate the intermediate positions of the bubbles for the years between waves. This creates a smooth animation flow rather than a jerky slideshow.
* **Trails:** Users can enable "Trails" for specific countries. As the "China" bubble moves, it leaves a line tracing its path. This visualizes the *trajectory* of development—showing, for instance, that while China has moved massively on the "Survival/Self-Expression" axis (economic growth), it has moved very little on the "Traditional/Secular" axis (cultural persistence), a key finding of the Inglehart-Welzel theory.


# Section 7: Strategic Trade-offs and Market Positioning

Building a specialized tool implies making deliberate choices to optimize for one domain at the expense of others. Aletheia is not a tool for everyone; it is a tool for survey researchers.


### 7.1 Trade-off: Depth vs. Breadth



* **Decision:** Aletheia prioritizes **Survey Statistics** (Crosstabs, ANOVA, Factor Analysis, MLM) over **General Data Science** (Neural Networks, XGBoost, Time Series Forecasting).
* **Implication:** We will not build features for image recognition or high-frequency trading data. The UI for defining "Constructs" and "Weights" would be clutter for a user analyzing simple A/B test logs.
* **Constraint:** By enforcing "Survey Logic" (like the dual-state variable system for labels), we make the tool slightly harder to use for purely numeric data (e.g., sensor readings), but infinitely better for categorical survey data.


### 7.2 Trade-off: Memory Limits vs. Privacy



* **Decision:** We prioritize **Local-First Processing** (Privacy/Speed) over **Unlimited Data Size**.
* **Constraint:** Browser tabs are limited to roughly 4GB of WebAssembly memory. This is sufficient for the WVS (approx. 1-2GB uncompressed, much less as Parquet), but it would fail for a massive census file with 100 million rows.
* **Mitigation Strategy:** **Partitioned Storage.** If a user loads a file exceeding the memory limit, Aletheia will store the full dataset in the browser's **IndexedDB** or **OPFS** and use DuckDB's streaming engine to page in only the columns and rows required for the active view. This degrades performance slightly (disk I/O vs RAM) but allows for scalability beyond the RAM limit.


### 7.3 Trade-off: GUI vs. Reproducibility



* **The Conflict:** GUI tools are easy to use but often lack reproducibility. Academic journals require code (Syntax) to verify results.
* **Decision:** **Code Generation as a Feature.**
    * Aletheia is "Code-First" under the hood. Every drag-and-drop action—creating a bucket, running a regression—generates a snippet of clean, commented **R code** (using dplyr and lme4).
    * **The "Syntax Drawer":** This code is visible in a side panel. Users can copy this code to RStudio to reproduce their analysis exactly. This bridges the gap, allowing Aletheia to serve as an "Interface for R" rather than a black box.


### 7.4 Market Positioning



* **Vs. SPSS:** Aletheia wins on UX (modern, reactive), Visualization (interactive, animated), and Cost (no expensive licensing). It loses on legacy inertia and the sheer breadth of obscure tests available in SPSS.
* **Vs. Displayr:** Aletheia wins on **Latency** and **Privacy**. Displayr is cloud-centric; Aletheia is local-first. For a researcher exploring a dataset, the difference between a 50ms response (local) and a 500ms response (cloud) is the difference between "flow" and frustration.
* **Target Persona:** The "Modern Social Scientist" or "Market Research Architect." Someone who understands the complexity of the data but is tired of the friction of legacy tools. They value the rigor of R but desire the speed of a GUI.


## Conclusion

Project Aletheia represents a fundamental rethink of the statistical analysis environment. By rejecting the "one size fits all" spreadsheet metaphor and embracing the specific structural reality of longitudinal survey data, it offers a workflow that is distinct from and superior to SPSS. It leverages the cutting edge of the browser stack—DuckDB, Rust, WebR, and WebGL—to solve the specific pain points of the World Values Survey: the width of the data, the complexity of the harmonization, the nesting of the hierarchies, and the richness of the historical trends. It is a tool built not just to calculate statistics, but to illuminate the shifting values of humanity.


<table>
  <tr>
   <td>Feature
   </td>
   <td>SPSS / Legacy Tools
   </td>
   <td>Project Aletheia
   </td>
  </tr>
  <tr>
   <td><strong>Data Engine</strong>
   </td>
   <td>Row-based, Memory-heavy
   </td>
   <td><strong>DuckDB (Columnar, Compressed)</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Ingestion</strong>
   </td>
   <td>Native (Slow for large files)
   </td>
   <td><strong>Rust + ReadStat (Wasm optimized)</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Harmonization</strong>
   </td>
   <td>Manual Syntax / Recode Scripts
   </td>
   <td><strong>Visual Sankey Mapper</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Analysis</strong>
   </td>
   <td>Menu-driven, Static Output
   </td>
   <td><strong>WebR (R-compatible), Reactive</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Visualization</strong>
   </td>
   <td>Static Charts (GPL)
   </td>
   <td><strong>WebGL (Regl), Animated</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Architecture</strong>
   </td>
   <td>Desktop / Server-Client
   </td>
   <td><strong>Local-First WebAssembly</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Weighting</strong>
   </td>
   <td>Global State (Error-prone)
   </td>
   <td><strong>Context-Aware View Properties</strong>
   </td>
  </tr>
</table>


This table summarizes the generational leap Project Aletheia proposes. It is not merely a faster SPSS; it is a new lens for social research.


#### Works cited

1. Can anyone clarify what is the difference between 'R' software statistics and SPSS Statistics? | ResearchGate, https://www.researchgate.net/post/Can_anyone_clarify_what_is_the_difference_between_R_software_statistics_and_SPSS_Statistics 2. R programming vs SPSS - Benefits of each? : r/AskStatistics - Reddit, https://www.reddit.com/r/AskStatistics/comments/uw2qaq/r_programming_vs_spss_benefits_of_each/ 3. World Values Survey Wave 7 (2017-2022) - WVS Database, https://www.worldvaluessurvey.org/WVSDocumentationWV7.jsp 4. The WVS Cultural Map of the World, http://piketty.pse.ens.fr/files/InglehartWelzel2011.pdf 5. DuckDB Wasm, https://duckdb.org/docs/stable/clients/wasm/overview 6. DuckDB-Wasm versus X, https://shell.duckdb.org/versus 7. Inglehart–Welzel cultural map of the world - Wikipedia, https://en.wikipedia.org/wiki/Inglehart%E2%80%93Welzel_cultural_map_of_the_world 8. Inglehart–Welzel Cultural Map (from the World Values Survey) - WVS Database, https://www.worldvaluessurvey.org/WVSContents.jsp?CMSID=Findings 9. Instructions for building the Integrated Surveys 1981-2008 data file - WVS Database, https://www.worldvaluessurvey.org/WVSContents.jsp?CMSID=intinstructions&CMSID=intinstructions 10. WVS Longitudinal files - World Values Survey, https://www.worldvaluessurvey.org/WVSDocumentationWVL.jsp 11. The tradrat and survself scores are the two variables that are used to build the Cultural Map. - WVS Database, https://www.worldvaluessurvey.org/WVSContents.jsp?CMSID=tradrat 12. DuckDB-Wasm: Efficient Analytical SQL in the Browser, https://duckdb.org/2021/10/29/duckdb-wasm 13. webassembly system interface (wasi) changes everything.. getting started tutorial using rust & wasm - YouTube, https://www.youtube.com/watch?v=MONlkYotR5s 14. Memory Management in DuckDB, https://duckdb.org/2024/07/09/memory-management 15. Joint EVS/WVS 2017-2022 dataset - European Values Study, https://europeanvaluesstudy.eu/methodology-data-documentation/survey-2017/joint-evs-wvs/ 16. Religiosity, neutrality, fairness, skepticism, and societal tranquility: A data science analysis of the World Values Survey - PMC - NIH, https://pmc.ncbi.nlm.nih.gov/articles/PMC7799817/ 17. Data Integration Architecture: Modern Design Patterns - Nexla, https://nexla.com/data-integration-101/data-integration-architecture/ 18. Performance Guide - DuckDB, https://duckdb.org/docs/stable/guides/performance/overview 19. Creating SPSS .sav files using client-side JavaScript in web application - IT Dev Example, https://community.webshinetech.com/t/creating-spss-sav-files-using-client-side-javascript-in-web-application/3139 20. Joint EVS/WVS 2017-2022 dataset - GESIS - Leibniz-Institut für Sozialwissenschaften, https://www.gesis.org/en/european-values-study/data-and-documentation/joint-evs/wvs-2017-2022-dataset 21. Harmonization in the world values survey - United Arab Emirates University, https://research.uaeu.ac.ae/en/publications/harmonization-in-the-world-values-survey/ 22. Joint EVS/WVS 2017-2022 Dataset (Joint EVS/WVS) - GESIS Search, https://search.gesis.org/research_data/ZA7505 23. sav-reader - NPM, https://www.npmjs.com/package/sav-reader 24. ReadStat/README.md at dev - GitHub, https://github.com/WizardMac/ReadStat/blob/dev/README.md 25. Compiling from Rust to WebAssembly - MDN Web Docs, https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Rust_to_Wasm 26. Compiling an existing C module to WebAssembly - MDN Web Docs, https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Existing_C_to_Wasm 27. kylebarron/parquet-wasm: Rust-based WebAssembly bindings to read and write Apache Parquet data - GitHub, https://github.com/kylebarron/parquet-wasm 28. Serialize and Deserialize Parquet with Preact - MojoAuth, https://mojoauth.com/serialize-and-deserialize/serialize-and-deserialize-parquet-with-preact 29. Speed up lmer function in R - Stack Overflow, https://stackoverflow.com/questions/32177542/speed-up-lmer-function-in-r 30. Fitting Mixed Effects Models - Python, Julia or R? : r/rstats - Reddit, https://www.reddit.com/r/rstats/comments/s3yo9g/fitting_mixed_effects_models_python_julia_or_r/ 31. Why is mixed-effects model (lme) slow compared to fixed-effects model (fixest)? - Cross Validated - Stats StackExchange, https://stats.stackexchange.com/questions/660393/why-is-mixed-effects-model-lme-slow-compared-to-fixed-effects-model-fixest 32. R lme4 getting vastly different results than Python statsmodels for same(?) model, https://stats.stackexchange.com/questions/451180/r-lme4-getting-vastly-different-results-than-python-statsmodels-for-same-mode 33. Generalized Linear Mixed Effects Models in R and Python with GPBoost, https://towardsdatascience.com/generalized-linear-mixed-effects-models-in-r-and-python-with-gpboost-89297622820c/ 34. WebR & Pyodide, https://rud.is/w/webr-pyodide/ 35. Card Sorting: Designing Usable Categories, https://www.ipcinfo.org/fileadmin/user_upload/drm_matrix/docs/CardSorting-for-printing.pdf 36. Card Sorting - Maze, https://maze.co/features/card-sorting/ 37. 16 Chat UI Design Patterns That Work in 2025 - Bricx Labs, https://bricxlabs.com/blogs/message-screen-ui-deisgn 38. How to do card sorting for UX design and research - YouTube, https://www.youtube.com/watch?v=supdWgEqROE 39. Card Sorting: The Ultimate Guide for 2026 | IxDF - The Interaction Design Foundation, https://www.interaction-design.org/literature/article/the-pros-and-cons-of-card-sorting-in-ux-research 40. Design pattern for assigning items to two buckets/lists, where items can be in both, one or none - Graphic Design Stack Exchange, https://graphicdesign.stackexchange.com/questions/16770/design-pattern-for-assigning-items-to-two-buckets-lists-where-items-can-be-in-b 41. I replaced FastAPI with Pyodide: My visual ETL tool now runs 100% in-browser - Reddit, https://www.reddit.com/r/Python/comments/1qbxkde/i_replaced_fastapi_with_pyodide_my_visual_etl/ 42. View of Merging Complex or Divergent Datasets using SPSS: A Method and Tutorial, https://journals.library.columbia.edu/index.php/gsjp/article/view/10033/5212 43. Factor Analysis | SPSS Annotated Output - OARC Stats - UCLA, https://stats.oarc.ucla.edu/spss/output/factor-analysis/ 44. Fitting Linear Mixed-Effects Models using lme4 - CRAN, https://cran.r-project.org/package=lme4/vignettes/lmer.pdf 45. Gaussian Variational Approximate Inference for Generalized Linear Mixed Models, https://www.tandfonline.com/doi/abs/10.1198/jcgs.2011.09118 46. Ultra-Fast Approximate Inference Using Variational Functional Mixed Models - PMC - NIH, https://pmc.ncbi.nlm.nih.gov/articles/PMC10441618/ 47. lme4: Linear Mixed-Effects Models using 'Eigen' and S4 - CRAN, https://cran.r-project.org/web/packages/lme4/lme4.pdf 48. Managing weights - WVS Database, https://www.worldvaluessurvey.org/WVSContents.jsp?CMSID=WEIGHT&CMSID=WEIGHT 49. CHANGELOG.md - flekschas/regl-scatterplot - GitHub, https://github.com/flekschas/regl-scatterplot/blob/main/CHANGELOG.md 50. Regl-Scatterplot: A Scalable Interactive JavaScript-based Scatter Plot Library, https://joss.theoj.org/papers/10.21105/joss.05275 51. flekschas/regl-scatterplot: Scalable WebGL-based scatter plot library build with Regl - GitHub, https://github.com/flekschas/regl-scatterplot 52. Using animation to enhance scatterplots - Diva-Portal.org, https://www.diva-portal.org/smash/get/diva2:1618097/FULLTEXT01.pdf 53. Recreating Gapminder using Chart.js - Create With Data, https://www.createwithdata.com/gapminder-chartjs/ 54. Gapminder Tools, https://www.gapminder.org/tools/ 55. 14 Animating views | Interactive web-based data visualization with R, plotly, and shiny, https://plotly-r.com/animating-views
