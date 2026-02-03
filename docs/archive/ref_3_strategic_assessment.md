## 1. Executive Summary

The market research industry is currently navigating a pivotal transition from legacy, bifurcated workflows—characterized by a rigid separation between Data Processing (DP) and research analysis—toward an integrated, agile model where the "Researcher as Storyteller" demands immediate, autonomous access to data. The proposed software, "Velocity," aims to disrupt the entrenched duopoly of IBM SPSS Statistics and Displayr by leveraging a "local-first," browser-based architecture that prioritizes speed, user experience (UX), and data privacy over the exhaustive statistical depth of legacy tools. This report provides a critical evaluation of the "Velocity" Product Requirements Document (PRD), assessing its technical feasibility, market fit, and competitive positioning within the evolving landscape of 2026.

Our analysis indicates that the core value proposition of "Velocity"—specifically its "speed" and "local-first" architecture—addresses significant unmet needs regarding latency and data security that plague current cloud-based solutions. However, the initial PRD critically lacks essential domain-specific features, most notably complex survey weighting and editable native exports, which are non-negotiable for professional adoption in the boutique agency sector. The incumbents define the market's current boundaries: SPSS anchors the "power" segment with deep statistical rigor but suffers from archaic usability and high learning curves, while Displayr captures the "visualization and reporting" segment but struggles with performance latency and a high cost of entry.

"Velocity" possesses a viable path to market as a "middleware" solution—a rapid exploration and crosstabulation tool that bridges the gap between raw survey data and final reporting—provided it significantly expands its Minimum Viable Product (MVP) to include robust weighting capabilities and high-fidelity integration with Microsoft Office. The proposed technical architecture, relying on WebAssembly (WASM) technologies like DuckDB-Wasm and Pyodide, offers a disruptive speed advantage for datasets under 500MB, effectively solving the "Friday 4 PM" panic scenario for the target persona. This report details the necessary strategic pivots, technical architectural decisions, and feature enhancements required to transform "Velocity" from a concept into a market-viable category leader.


## 2. Strategic Market Context: The Rise of the "Researcher-Storyteller"

The market research landscape has shifted fundamentally over the last decade, driven by broader technological trends and evolving client expectations. Historically, the industry operated on a "factory model": a specialized Data Processing (DP) team cleaned, weighted, and tabulated data using command-line tools like Quantum or SPSS Syntax, handing static tables to researchers who then manually built reports in PowerPoint. This workflow is increasingly incompatible with modern demands for agility and iterative insight generation.


### 2.1 The Collapse of the DP Silo and the Agility Imperative

The "Data Processing Bottleneck" identified in the Velocity PRD is a well-documented industry pain point that has only intensified as project timelines compress. In the traditional model, a researcher discovering a need to merge age brackets or filter by a new variable would face a turnaround time of hours or days as the request cycled back through the DP department. This latency is unacceptable in a 2026 business environment where decisions are made in real-time. The modern persona, identified here as "Sarah the Strategist," is often a hybrid professional expected to navigate raw data, analyze trends, and craft narratives simultaneously without technical intermediaries.

However, the toolset available to these professionals has not kept pace with their evolving roles. Researchers are often forced into a binary choice: they must either learn the high-friction, code-heavy environment of SPSS, which requires significant training and offers poor visualization , or navigate the complex, sometimes sluggish cloud-based workflows of platforms like Displayr, which can suffer from performance issues known as the "spinning wheel" effect. The "Friday 4 PM" scenario described in the PRD is not merely a marketing trope but a reflection of a structural inefficiency in the agency model where the researcher's autonomy is limited by their tools.


### 2.2 The Shift to Self-Service and AI Integration

The global customer self-service software market is experiencing rapid growth, projected to increase from $18.26 billion in 2024 to $21.6 billion in 2025 at a compound annual growth rate (CAGR) of 18.3%. This macro trend mirrors the specific demand within market research for "democratized data." Agencies are under pressure to empower junior researchers and senior strategists alike to explore data without technical gatekeepers. The expectation is for software that requires zero configuration and minimal training—tools that operate with the intuitiveness of consumer applications rather than the density of enterprise ERP systems.

Furthermore, the integration of Artificial Intelligence (AI) and Large Language Models (LLMs) is reshaping user expectations regarding software interaction. By 2025, most software solutions are expected to feature AI integration, with users anticipating tools that can "speak" data—for example, interpreting natural language queries like "Show me satisfaction by gender" to generate instant visualizations. "Velocity's" proposed "Playful, Safe, Instant" vibe aligns perfectly with this shift toward consumer-grade User Experience (UX) in enterprise tools, a trend championed by modern productivity software like Linear, Raycast, and Notion. The market is signaling a clear preference for tools that reduce cognitive load and prioritize "flow state" over exhaustive feature lists.


### 2.3 The Local-First Renaissance and Privacy Concerns

A potent differentiating vector for "Velocity" is its "Local-First" architecture. In an era defined by stringent data privacy regulations (GDPR, CCPA) and the increasing risk of data breaches, the requirement to upload sensitive consumer data to third-party cloud servers presents a significant friction point for agencies. Processing data on the client side offers two distinct strategic advantages. First, it enhances security: data never leaves the user's machine, bypassing complex Information Security (InfoSec) reviews often required for cloud-based tools. Second, it drastically reduces latency. By eliminating network round-trips for every filter change, variable recode, or crosstab calculation, local-first tools can offer the immediate, "video game" responsiveness promised in the PRD, which is critical for maintaining the user's analytical flow.

The statistical analysis software market itself is robust, valued at $9.32 billion in 2024 and expected to grow to $14.83 billion by 2029. This growth is driven by the increasing volume and complexity of data and the rise of data-driven decision-making across industries. However, the market is currently bifurcated between heavy, on-premise legacy tools and heavy, cloud-based platforms. Velocity attempts to carve out a third space: the lightweight, local, browser-based analyst workbench.


## 3. Competitive Landscape: The Castle and The Cloud

To accurately assess "Velocity's" viability, we must thoroughly profile the two "enemies" cited in the PRD: the "Grey Menus" of IBM SPSS Statistics and the "Spinning Wheel" of Displayr. These incumbents define the current boundaries of the market.


### 3.1 The Incumbent: IBM SPSS Statistics

IBM SPSS Statistics remains the *lingua franca* of the market research industry. Its file format, the .SAV file, is the universal standard for data interchange between data collection platforms and analysis tools.

**Strengths and Market Position:** SPSS anchors the "power" end of the spectrum. It is renowned for its statistical depth, capable of performing everything from basic descriptives to complex multivariate analyses like factor analysis, clustering, and bootstrapping. It offers "perpetual" licensing options, although it has increasingly shifted toward subscription models, and enjoys deep institutional trust regarding the accuracy of its algorithms. For heavy-duty data processing, SPSS on a desktop is highly efficient, capable of handling massive datasets without the network latency inherent in cloud tools.

**Weaknesses and User Sentiment:** The user interface of SPSS is famously dated, often described as "grey menus" that have not evolved significantly in decades. Navigating these menus requires a solid grounding in statistical theory; a user must know exactly what test to run and where to find it. The software distinguishes rigidly between "Data View" (the spreadsheet) and "Output View" (the results), a separation that breaks the iterative loop of exploration. Furthermore, SPSS is distinctively *not* a reporting tool. Its visualizations are poor and static, forcing users to export data to Excel or PowerPoint to create client-ready charts.

**Pricing and Accessibility:** SPSS pricing is complex and often prohibitive for freelancers or small agencies. Subscription plans for the "Base" edition start around $99 per user per month, but perpetual licenses can cost upwards of $3,830 per user. This high cost of entry, combined with the steep learning curve of its proprietary syntax language, makes it a significant barrier for the "Sarah" persona who needs quick answers without a PhD in statistics.


### 3.2 The Challenger: Displayr

Displayr has successfully positioned itself as the modern, all-in-one alternative to SPSS, integrating data cleaning, analysis, visualization, and reporting into a single cloud-based platform.

**Strengths and Value Proposition:** Displayr's "killer feature" is its ability to create editable PowerPoint exports and host interactive online dashboards. It automates many complex tasks, such as driver analysis and weighting, and allows for the creation of "dynamic" documents where charts update automatically when new data is uploaded. It effectively combines the functionality of SPSS (analysis) and PowerPoint (reporting) into one browser tab.

**Weaknesses and Performance Issues:** Being a fully cloud-native platform running R on the backend, Displayr is susceptible to latency. Every significant action—filtering a dashboard, recalculating a regression, or even switching pages—can trigger a server round-trip. Users have reported "spinning wheel" delays, particularly when working with complex dashboards or large datasets. This latency breaks the "flow state" that Velocity aims to capture. Furthermore, the interface, in its attempt to be comprehensive, has become dense and complex, often described as having a steep learning curve for new users.

**Pricing Model:** Displayr is positioned as an enterprise tool. Standard pricing starts at approximately $3,000 to $3,219 per user per year. While there are free "Viewer" licenses and lower-tier options for viewing reports, the "Editor" licenses required to actually analyze data are expensive. This pricing structure effectively excludes the "casual" analyst or the freelancer who needs to perform ad-hoc analysis on a.SAV file but cannot justify a multi-thousand-dollar subscription.


### 3.3 The Gap for "Velocity"

The competitive analysis reveals a clear "middle market" gap. SPSS is too difficult and archaic for the modern strategist; Displayr is too slow and expensive for quick, ad-hoc exploration. "Velocity" aims to be the "Notion" or "Figma" of this space: fast, beautiful, limited in scope but delightful to use. The key differentiator is **Zero-Latency Exploration**. If Velocity can open a 50MB file and generate a crosstab in 100 milliseconds (via local execution) versus Displayr's 2-5 seconds (server roundtrip), it wins the battle for the user's attention and ease of use.


## 4. Critical Evaluation of the MVP (The "Velocity" PRD)

The provided PRD outlines a compelling vision but contains significant functional omissions that would likely render the tool unusable for professional market research in its current state. While the focus on speed is laudable, the "Must Haves" list ignores critical domain-specific requirements.


### 4.1 The Engine: Technical Viability of WASM

The PRD proposes using **DuckDB-Wasm** or **Pyodide** to parse.SAV files locally. This is technically viable but fraught with challenges that need addressing.

**Pyodide and Performance Constraints:** Pyodide allows Python data science libraries (like pandas) to run in the browser. Reading.SAV files typically relies on the pyreadstat library, which wraps the C library ReadStat. While Pyodide has made great strides, the initialization time is non-trivial; downloading the runtime (6MB+) and initializing the environment can take 4-5 seconds on a fresh load. Furthermore, parsing large binary files like.SAV in a browser-based Python environment is significantly slower than native execution. Benchmarks suggest that reading large files can take substantial time, and without careful management (e.g., utilizing Web Workers to offload processing), this operation will freeze the browser UI, recreating the very "spinning wheel" experience Velocity seeks to eliminate.

**DuckDB-Wasm Capabilities:** DuckDB-Wasm offers a more performant alternative for querying and aggregation (crosstabs). It is optimized for analytical SQL workloads and can execute queries on millions of rows in sub-second times within the browser. However, DuckDB does not natively support reading SPSS.SAV files directly in its WASM implementation without extensions. The architecture would likely require a hybrid approach: using a specialized WASM module (perhaps based on ReadStat compiled to WASM) to parse the.SAV file into a format DuckDB can ingest (like Apache Arrow), and then using DuckDB for the high-speed analysis.

**Memory Limitations:** The "Local-First" architecture is bound by browser memory limits. A single browser tab is typically capped at around 4GB of WebAssembly memory (varies by browser). While a 50MB SPSS file is well within this limit, a complex survey with 100,000 respondents and thousands of variables could expand in memory to exceed this cap, leading to crashes. Velocity must explicitly market itself as an *agile exploration tool* for typical survey datasets (e.g., N=1,000 to N=10,000), not a "Big Data" warehouse replacement.


### 4.2 The "Must Haves": The Weighting Dealbreaker

The PRD lists "Instant Crosstabs" and "Sig Testing" as essential. However, it misses the **single most important feature** for market research analysis after crosstabs: **Weighting**.

**The Necessity of Weighting:** Almost no commercial survey data is analyzed unweighted. Survey samples rarely perfectly match the demographic distribution of the target population (e.g., a sample might skew female or older than the census data). Weighting is the statistical technique used to correct these biases. If "Velocity" cannot apply a weight variable to the crosstab, the numbers it produces are effectively "wrong" in the eyes of the researcher. A tool that cannot weight data cannot replace SPSS or Displayr, even for a quick "Friday 4 PM" chart.

**RIM vs. Cell Weighting:** The PRD must support at least the application of pre-calculated weights (variables existing in the.SAV file). Ideally, to challenge Displayr, it should eventually support *creating* weights. There are two main types: **Cell Weighting**, which weights based on interlocking demographic cells (e.g., Age x Gender), and **RIM Weighting** (Raking), which iteratively adjusts weights to match marginal distributions of multiple variables (e.g., Age, Gender, Region) independently. RIM weighting is generally preferred in market research as it allows for more variables without requiring massive sample sizes to fill every cell. The MVP *must* at minimum allow a user to drag a "Weight" variable into a global slot to apply it to all calculations.


### 4.3 The Output: The Clipboard Trap

The PRD specifies "Copy as Image" and "Copy as Excel." This is insufficient for the "Sarah" persona.

**The "Editable" Requirement:** "Sarah the Strategist" rarely sends raw screenshots to clients. She builds decks. If she copies an *image* of a chart, she cannot edit the font, color, or data label in PowerPoint to match the client's branding. She is forced to redraw the chart manually, which introduces error and wastes time. Displayr's competitive advantage is its ability to export **Editable PowerPoint Objects**. To be a viable alternative, Velocity must offer a "Smart Copy" feature that places an HTML table or formatted object on the clipboard that pastes into Excel or PowerPoint as editable data, preserving the ability to style it natively in Office.


### 4.4 Data Preparation Features

The PRD mentions "Merging" columns but overlooks "Variable Sets." Modern surveys often contain "Grid" questions (e.g., "Rate the following brands on a scale of 1-5"). In the.SAV file, these are separate variables (Q1_1, Q1_2, etc.). A modern tool must automatically detect and group these into a single "Variable Set" or "Grid" to allow for efficient analysis (e.g., showing a summary table of Top 2 Box scores for all brands at once). Treating them as individual, unconnected variables makes analysis tedious and slow.


## 5. Revised Product Requirements: "Velocity 1.0"

Based on the research findings, the following revised PRD improves the tool's viability by addressing critical feature gaps while maintaining the core "Speed > Power" philosophy.


### 5.1 Revised Core Philosophy

**Speed > Power, but Accuracy is Non-Negotiable.** We do not need to perform every obscure statistical test that SPSS offers, but the basic descriptive statistics (counts, percentages, means) and significance tests we do perform must be rigorously accurate and support weighting.


### 5.2 Enhanced Feature Set (The "Real" Must-Haves)


#### A. The Engine: Hybrid WASM Strategy



* **Architecture:** Adopt a hybrid approach. Use a specialized WASM build of ReadStat (C++) to parse.SAV files and convert them directly into **Apache Arrow** format in the browser.
* **Query Engine:** Use **DuckDB-Wasm** to ingest the Arrow data zero-copy. DuckDB's vectorized execution engine is significantly faster for the aggregations (GROUP BY) required for crosstabs than Python/Pandas.
* **Non-Blocking UI:** Implement **Web Workers** for all data loading and processing tasks. The main thread must remain free to render the UI, ensuring the "video game" responsiveness even while data is crunching in the background.


#### B. Data Preparation (The "Mise en place")



* **Variable Sets:** Implement auto-detection logic to group related variables (e.g., share a common label prefix like Q5_a, Q5_b) into "Grids" or "Variable Sets." This allows users to drag one object to visualize 10 brands instantly.
* **Recoding:**
    * *Merge:* Drag-and-drop to combine answer categories.
    * *Nets:* Create "Top 2 Box" (Net Positive) variables that exist alongside the original data, rather than just a toggle. This allows for comparing "Top Box" vs "Bottom Box."
    * *Re-basing:* One-click option to hide "Don't Know" or "Refused" answers, automatically recalculating percentages based on the valid sample.


#### C. Weighting (The Critical Addition)



* **Apply Weight:** The Sidebar must allow dragging a numeric variable into a dedicated "Global Weight" slot.
* **Mechanism:** When a weight is applied, all subsequent tables must calculate Weighted N and Weighted % automatically.
* **Visibility:** A global "Weight On/Off" toggle must be visible at all times, preventing the common error of analyzing unweighted data by mistake.


#### D. Analysis & Statistics



* **Significance Testing:**
    * *Column Proportions (z-test):* Display standard A/B/C/D lettering for column comparisons.
    * *Column Means (t-test):* For scale/numeric variables.
    * *Confidence Level:* Simple toggle for 90%, 95% (default), and 99%.
* **Filtering:**
    * Global Filter Bar: Allow users to drag any variable (e.g., "Gender") to a top bar to filter the entire canvas (e.g., "Show me everything for Males only").


#### E. Output: "The Slide Starter"



* **Smart Clipboard:** The "Copy" function should place data on the clipboard in HTML/XML format specifically optimized for Microsoft Office. This ensures that when users paste into Excel or PowerPoint, the data retains its structure, formatting, and numeric integrity, allowing for the creation of native Office charts.
* **Native Editable Export (Stretch Goal):** Generate a clean .pptx file with the table rendered as a native PowerPoint table, not an image.


## 6. Detailed Profile of the Competitors


### 6.1 IBM SPSS Statistics (The Legacy Standard)

**Market Position:** The default tool for academic research, government statistics, and deep quantitative analysis. **Core Workflow:** Users open a .SAV file, navigate a menu bar (Analyze -> Descriptive Statistics -> Crosstabs), select variables via a dialog box, and generate output in a separate window. **Pain Points:** The rigid separation of data and output breaks the iterative flow. The interface is "modal-heavy," requiring users to click through multiple pop-ups to run a single table. Automation usually requires learning the proprietary SPSS Syntax language. **Pricing:** Perpetual licenses cost thousands of dollars; monthly subscriptions are available but expensive relative to modern SaaS tools ($99/mo per user). **Vulnerability:** It feels like software from the 1990s. It is intimidating for new entrants and junior staff, creating a barrier to entry that Velocity can exploit with superior UX.


### 6.2 Displayr (The Integrated Cloud Platform)

**Market Position:** The "complete" tool for agencies, designed to replace the combination of SPSS, Excel, and PowerPoint. **Core Workflow:** Users upload data to the cloud, drag variables onto a "page" (similar to a slide), and tables/charts appear instantly. It allows for complex logic and layout design. **Pain Points:** "The Spinning Wheel." Because it runs R in the cloud, even simple actions can suffer from network latency. The interface is extremely dense, offering thousands of features that can overwhelm a user who just wants a simple crosstab. **Pricing:** High. The "Professional" license required for editing and analysis costs ~$3,000 per user/year. This prices out the bottom end of the market. **Vulnerability:** It is over-engineered for simple exploration. It requires an internet connection and data upload, introducing friction and potential security concerns.


## 7. Unmet User Needs & Opportunities

Research into user forums (G2, Reddit, specialized MR communities) highlights specific gaps that Velocity is well-positioned to fill:


### 7.1 "Just Let Me See the Data"

Users frequently express frustration with the need to buy expensive licenses or wait for long upload processes just to "peek" at a .SAV file. There is a latent demand for a **"Figma for Data"**—a tool that is instant, lightweight, and visual. The ability to drag-and-drop a file and see the variables immediately without a login or credit card (for a viewer mode) would be a massive viral growth vector.


### 7.2 The "Data Cleaning" Interregnum

Researchers often receive "dirty" files from DP teams. They need to quickly check basic hygiene factors: "Did we capture the age quotas correctly?" "Are there duplicate IDs?" "Is the base size correct?" Velocity can position itself as the **"Triage" tool**—the first line of defense before data is sent for "Deep Analysis" in heavier tools.


### 7.3 Cost-Effective Scalability

Agencies are reluctant to purchase expensive SPSS or Displayr licenses for junior staff who primarily need to run simple crosstabs or check numbers. A low-cost license model (e.g., $20-$50/month) or a usage-based model could allow Velocity to sweep the junior researcher market, effectively acting as a "companion app" to the heavy tools used by the data science team.


## 8. Technical Deep Dive: The WASM Gamble

The core of Velocity's pitch is its "Local-First" architecture. While this offers significant advantages in speed and privacy, it also introduces hard technical constraints that must be managed.


### 8.1 The Performance Ceiling

Browser tabs are sandboxed environments. Chrome typically limits a single tab's WASM memory usage to approximately 4GB.



* **Scenario A (Small/Medium):** 1,000 respondents x 50 variables. File size &lt; 5MB.
    * *Result:* Instant performance. Sub-10ms response times for crosstabs. Velocity wins hands down against cloud tools.
* **Scenario B (Tracker Study):** 10,000 respondents x 500 variables. File size ~100MB.
    * *Result:* Viable. DuckDB-Wasm can handle millions of rows if the query execution is optimized. The initial parsing might take a few seconds, but subsequent analysis will be fast.
* **Scenario C (Massive Data):** 100,000 respondents or heavy open-ended text data. File size > 500MB.
    * *Result:* High risk of browser crash or UI freeze. Displayr handles this by offloading computation to a powerful cloud server. Velocity would struggle or fail here.
* **Mitigation Strategy:** Velocity must explicitly market itself for *agile exploration of standard survey data*, not as a "Big Data" warehouse. The UI should include a "Memory Meter" to warn users if they are approaching the browser's limits.


### 8.2 The ".SAV" Parsing Challenge

Reading SPSS files in the browser is the single hardest technical hurdle. The industry standard library, ReadStat, is written in C. While Python wrappers exist, running Python in the browser (via Pyodide) is generally slower than running compiled C++/Rust (via WASM).



* **Recommendation:** The MVP should utilize a **hybrid parsing approach**. Use a specialized WASM build of ReadStat to handle the proprietary binary format of .SAV files, extracting metadata (labels) and converting the core data table into **Apache Arrow** format. Arrow is a language-independent memory format that is optimized for analytics. DuckDB-Wasm can ingest Arrow data with "zero-copy," meaning it can query the data without duplicating it in memory. This pipeline (ReadStat WASM -> Arrow -> DuckDB WASM) minimizes memory overhead and maximizes speed.


## 9. Conclusion and Viability Assessment

**Verdict: Highly Viable Niche Strategy**

"Velocity" stands to do for market research what "Sketch" did for UI design: provide a stripped-down, faster, purpose-built tool that excels at a specific workflow, disrupting incumbents that have become bloated and generalized.



* **Market Viability:** High. The frustration with SPSS (UX/UI) and Displayr (Latency/Cost) is palpable in the industry. There is a demonstrated willingness to pay for "speed" and "autonomy." The "Friday 4 PM" use case is a powerful emotional hook.
* **Technical Viability:** Moderate to High. The "Local-First" constraints effectively limit the Total Addressable Market (TAM) to "Survey Data" (typically &lt;2GB), excluding "Big Data" or transactional data use cases. However, this is an acceptable trade-off for a specialized market research tool.
* **Adoption Barrier:** The primary barrier is **Trust**. Researchers need assurance that "Velocity's" numbers match "SPSS's" numbers exactly. The MVP must include a "Validation Mode" or "Parity Check" that explicitly demonstrates how it handles missing values and bases to prove statistical equivalence with the industry standard.

**Final Recommendation:** Proceed with the "Velocity" project, but **pivot the PRD immediately** to include **Weighting** and **Variable Set Management** in the MVP. Without these features, the tool is merely a viewer; with them, it becomes a category killer for the agile research workflow. The pricing strategy should target the "seat gap"—pricing the tool below the corporate credit card approval limit (e.g., $49/user/month) to encourage bottom-up adoption within agencies.


## 10. Revised Product Requirements Document (PRD v2.0)

**Project Code Name:** "Velocity" **Tagline:** The Instant Analysis Workbench for Market Researchers.


### 1. Core Value Proposition



* **Zero-Latency:** Interactions happen in &lt;100ms.
* **Local-First:** Data never leaves the browser (Security/Privacy).
* **Domain Native:** Understands "Top 2 Box," "NPS," and "Weighting" out of the box.


### 2. Target Persona Updates



* **Primary Persona:** "Sarah the Strategist."
* **Secondary Persona:** "The Junior Researcher." Tasks include data checking, cleaning, and prepping slides. Needs a tool that safeguards against statistical errors (e.g., analyzing unweighted data).


### 3. Essential Feature Set (Updated)


<table>
  <tr>
   <td>Feature
   </td>
   <td>Description
   </td>
   <td>Requirement
   </td>
  </tr>
  <tr>
   <td><strong>SPSS Import</strong>
   </td>
   <td>Read .SAV with Variable Labels, Value Labels, and User Missing data.
   </td>
   <td><strong>Critical</strong> (Hybrid ReadStat/DuckDB engine)
   </td>
  </tr>
  <tr>
   <td><strong>Weighting</strong>
   </td>
   <td>Drag variable to "Weight" slot. Support RIM Weighting (v2) and Cell Weighting (v1).
   </td>
   <td><strong>Critical</strong> (Missing in v1 PRD)
   </td>
  </tr>
  <tr>
   <td><strong>Variable Sets</strong>
   </td>
   <td>Auto-grouping of Grid questions and Multiple Response Sets.
   </td>
   <td><strong>Critical</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Recoding</strong>
   </td>
   <td>Drag-to-merge columns, Right-click to "Create Net" (Top 2 Box).
   </td>
   <td><strong>Critical</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Sig Testing</strong>
   </td>
   <td>Auto-testing (Col Proportions, Means) with standard MR formatting (A/B/C lettering).
   </td>
   <td><strong>Critical</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Smart Export</strong>
   </td>
   <td>Copy to Clipboard as HTML Table (pastes formatted to Excel/PPT).
   </td>
   <td><strong>Critical</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Undo/Redo</strong>
   </td>
   <td>Infinite state history.
   </td>
   <td><strong>Critical</strong>
   </td>
  </tr>
</table>



### 4. Technical Constraints & Risks



* **Memory Limit:** Hard cap at browser memory limit (approx 2GB safe zone). UI must warn users if file > 500MB.
* **Parsing Speed:** Use Web Workers for non-blocking file loading. Show a skeleton UI immediately while data parses in the background.


### 5. Success Metrics



* **The "3-Click Crosstab":** User can Drop File -> Drag Row -> Drag Column in &lt; 5 seconds.
* **Parity Check:** Velocity results must match SPSS results to 2 decimal places for 100% of benchmark datasets.


### 6. Go-to-Market Strategy



* **Freemium Model:** Free for files &lt; 10MB (targeting students/trials). Pro for unlimited local size. Team plan for shared "variable set" definitions (synced via lightweight cloud config, not data).
* **The "Trojan Horse":** Market it as a "Free SPSS Viewer" to drive installation, then upsell the "Editing/Analysis" features.

By addressing the glaring omission of **weighting** and refining the technical architecture to mitigate browser limitations, "Velocity" transforms from a risky concept into a highly potent disruptor in the $20B+ research software market.


#### Works cited

1. Market researcher job profile | Prospects.ac.uk, https://www.prospects.ac.uk/job-profiles/market-researcher 2. Compare SPSS Statistics vs. Q Research Software by Displayr - G2, https://www.g2.com/compare/ibm-spss-statistics-vs-q-research-software-by-displayr 3. Compare Displayr vs. SPSS Statistics - G2, https://www.g2.com/compare/displayr-vs-ibm-spss-statistics 4. SPSS vs. Displayr, https://www.displayr.com/spss-vs-displayr/ 5. Doesn't feel smooth (Triple display) : r/simracing - Reddit, https://www.reddit.com/r/simracing/comments/1jlh5au/doesnt_feel_smooth_triple_display/ 6. Top 5 Research Trends for 2025: People, Markets, and Customers, https://sarid-ins.com/research-trends-2025-data/ 7. McKinsey technology trends outlook 2025, https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-top-trends-in-tech 8. Which Market Research Tool Is Right for You? SurveyCTO vs. Alchemer, Forsta, and Qualtrics, https://www.surveycto.com/data-collection-quality/which-market-research-tool-is-right-for-you/ 9. DuckDB Wasm : What Happens When You Put a Database in Your Browser? - MotherDuck, https://motherduck.com/blog/duckdb-wasm-in-browser/ 10. Statistical Analysis Software Market Trends And Share By 2034, https://www.thebusinessresearchcompany.com/report/statistical-analysis-software-global-market-report 11. IBM SPSS Statistics Pricing Overview - G2, https://www.g2.com/products/ibm-spss-statistics/pricing 12. IBM SPSS Statistics, https://www.ibm.com/products/spss-statistics 13. Understanding the Cost of IBM SPSS Software: A Comprehensive Guide - Oreate AI Blog, https://www.oreateai.com/blog/understanding-the-cost-of-ibm-spss-software-a-comprehensive-guide/356bea3b1b0296b76a2ca354780e410c 14. Displayr for Pricing Research, https://www.displayr.com/pricing-research/ 15. How to Update an Existing PowerPoint Document - Displayr Help, https://help.displayr.com/hc/en-us/articles/360002885956-How-to-Update-an-Existing-PowerPoint-Document 16. Displayr Reviews 2025: Pricing, Features & More - SelectHub, https://www.selecthub.com/p/data-visualization-tools/displayr/ 17. View Displayr Plans and Pricing - Sign Up for a Free Trial Today!, https://www.displayr.com/pricing/ 18. Best Sales Data Analytics Software for 2026 - Research.com, https://research.com/software/sales-data-analytics-software 19. Read and write spss data format · Issue #5768 · pandas-dev/pandas - GitHub, https://github.com/pandas-dev/pandas/issues/5768 20. Roadmap — Version 0.29.1 - Pyodide, https://pyodide.org/en/stable/project/roadmap.html 21. Optimize the size of minimal pyodide build · Issue #646 - GitHub, https://github.com/pyodide/pyodide/issues/646 22. Using Pyodide — Version 0.29.1, https://pyodide.org/en/stable/usage/index.html 23. pd.read_sav and pyreadstat are so slow. how can i speed up pandas for big data if i have to use SAV/SPSS file format? - Stack Overflow, https://stackoverflow.com/questions/63712214/pd-read-sav-and-pyreadstat-are-so-slow-how-can-i-speed-up-pandas-for-big-data-i 24. DuckDB-Wasm: Efficient Analytical SQL in the Browser, https://duckdb.org/2021/10/29/duckdb-wasm 25. Lightning-Fast Analytics: DuckDB + WASM for Large Datasets in the Browser - Medium, https://medium.com/@davidrp1996/lightning-fast-analytics-duckdb-wasm-for-large-datasets-in-the-browser-43cb43cee164 26. DuckDB Wasm – DuckDB, https://duckdb.org/docs/stable/clients/wasm/overview 27. I replaced FastAPI with Pyodide: My visual ETL tool now runs 100% in-browser - Reddit, https://www.reddit.com/r/Python/comments/1qbxkde/i_replaced_fastapi_with_pyodide_my_visual_etl/ 28. RIM Weighting: What it is, Benefits & How to Calculate? - QuestionPro, https://www.questionpro.com/blog/rim-weighting/ 29. A Researcher's Guide To Survey Weighting Techniques - Displayr, https://www.displayr.com/a-researchers-guide-to-survey-weighting-techniques/ 30. Weighting Methodology - B3 Intelligence, https://www.b3intelligence.com/knowledge-center/weighting-methodology/ 31. Weighting data: a look at misconceptions and design | Articles - Quirks Media, https://www.quirks.com/articles/weighting-data-a-look-at-misconceptions-and-design 32. Publishing to Excel, PowerPoint, and as a PDF - Displayr Help, https://help.displayr.com/hc/en-us/articles/4401847563279-Publishing-to-Excel-PowerPoint-and-as-a-PDF 33. Exporting to Excel from Displayr, https://www.displayr.com/exporting-to-excel/ 34. DuckDB-Wasm versus X, https://shell.duckdb.org/versus 35. I analyzed 150k negative reviews on G2 (from 8k+ companies) so that you can uncover potential SaaS opportunities. - Reddit, https://www.reddit.com/r/SaaS/comments/1hzyu21/i_analyzed_150k_negative_reviews_on_g2_from_8k/ 36. Data Preparation | Guide to Market Research - Q Research Software, https://www.qresearchsoftware.com/market-research-guide-data-preparation 37. Situational Use of Data Weighting - TRC Insights, https://trcmarketresearch.com/whitepaper/situational-use-of-data-weighting-complete/ 38. Survey Software Pricing Guide, https://fluidsurveys.com/pricing/ 39. DuckDB in Python in the Browser with Pyodide, PyScript, and JupyterLite, https://duckdb.org/2024/10/02/pyodide
