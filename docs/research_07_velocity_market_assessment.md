## 1. The Stagnation and Resurgence of the Survey Analytics Market

The global market for survey analysis software stands at a critical juncture in 2026, characterized by a paradox of robust financial growth and deep technological stagnation. While the broader industry is expanding—projected to reach between USD 8.55 billion and USD 15.87 billion by the early 2030s <sup>1</sup>—the user experience for the core practitioner has fragmented. For decades, the discipline of market research (MR) has been bound by a binary choice: the computational power of isolated desktop environments or the collaborative accessibility of sluggish cloud platforms. This dichotomy has created a "viability gap" where professional analysts are forced to trade performance for connectivity, a friction that is becoming increasingly untenable as datasets grow in volume and complexity.

The survey software market is no longer a niche vertical but a foundational layer of the global "Experience Economy." As organizations democratize data access, the demand for tools has shifted from specialized statisticians to a broader class of "citizen researchers"—product managers, HR professionals, and customer experience (CX) leads.<sup>1</sup> This shift drives a projected Compound Annual Growth Rate (CAGR) of 13.6% to 14.6% through 2030.<sup>1</sup> However, this democratization has exposed the limitations of existing infrastructure. The legacy "desktop giants," primarily IBM SPSS Statistics, remain entrenched due to their statistical depth and speed, yet they are fundamentally incompatible with modern, collaborative workflows.<sup>4</sup> Conversely, the "cloud challengers," led by platforms like Displayr and Qualtrics, offer collaboration but suffer from significant latency issues when handling the large-scale, granular datasets typical of high-end research.<sup>6</sup>

Into this fractured landscape enters "Velocity," a product profile that represents the convergence of local-first architecture and high-performance browser computing. By leveraging the emerging stack of WebAssembly (Wasm), DuckDB, and Apache Arrow, Velocity proposes a third way: a browser-based environment that executes heavy statistical computation on the client side, theoretically eliminating the latency of the cloud while bypassing the isolation of the desktop. This report provides an exhaustive analysis of the current market structure, the technological bottlenecks defining the status quo, and a critical assessment of Velocity’s potential to disrupt the SPSS-Displayr duopoly.

### 1.1 The Macro-Economic Context

The valuation of the survey software market varies by definition, with 2025 estimates ranging from USD 4.52 billion to USD 4.66 billion.<sup>1</sup> The disparity in long-term forecasts—ranging from USD 7.55 billion to nearly USD 16 billion by 2034 <sup>2</sup>—reflects the blurring lines between pure "survey analysis" tools and broader "Experience Management" (XM) platforms.

<table>
  <tr>
   <td><strong>Metric</strong>
   </td>
   <td><strong>Estimate / Forecast Range</strong>
   </td>
   <td><strong>CAGR</strong>
   </td>
   <td><strong>Drivers & Context</strong>
   </td>
  </tr>
  <tr>
   <td><strong>2025 Market Size</strong>
   </td>
   <td>USD 4.52B – USD 4.66B
   </td>
   <td>N/A
   </td>
   <td>Post-pandemic digitization; shift to real-time feedback loops. <sup>1</sup>
   </td>
  </tr>
  <tr>
   <td><strong>2030-2034 Forecast</strong>
   </td>
   <td>USD 7.55B – USD 15.87B
   </td>
   <td>11.0% – 14.6%
   </td>
   <td>Integration of AI; expansion of CX/EX mandates in enterprise. <sup>2</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Growth Leader</strong>
   </td>
   <td>Asia-Pacific (APAC)
   </td>
   <td>16.1%
   </td>
   <td>Mobile-first adoption; lack of legacy desktop infrastructure. <sup>1</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Dominant Deployment</strong>
   </td>
   <td>Cloud / SaaS
   </td>
   <td>15.5%
   </td>
   <td>Demand for remote collaboration and cross-device access. <sup>1</sup>
   </td>
  </tr>
</table>

The Asia-Pacific region is emerging as the primary engine of volume growth, expanding at a CAGR of 16.1%.<sup>1</sup> This geographical shift is crucial for product strategy; unlike North American or European markets, which are heavily invested in legacy desktop infrastructure (SPSS/SAS), APAC markets are leapfrogging directly to browser-based solutions. A tool like Velocity, which offers desktop-class power in a browser without heavy installation requirements, is uniquely positioned to capture this "greenfield" demand.
### 1.2 The Three Tiers of Market Structure

The current market is stratified into three distinct tiers, each serving a different user persona and creating specific "gaps" that a new entrant must address.
#### Tier 1: The Enterprise Experience Platforms (XM)

At the top of the pyramid are the XM giants: **Qualtrics, Medallia, and Forsta**. These platforms have successfully pivoted from being simple "survey tools" to enterprise operating systems.

* **Strengths:** They excel at data collection, workflow automation, and C-suite dashboarding. They solve the "distribution" problem, allowing companies to field surveys to millions of customers instantly.<sup>9</sup>
* **Weaknesses:** Their analysis capabilities are often broad but shallow. For the serious market researcher, Qualtrics’ built-in analytics ("Stats iQ") can feel restrictive, lacking the ability to perform complex custom weighting, intricate data transformations, or highly specific statistical tests without exporting data to a third-party tool.<sup>9</sup>
* **Market Share:** This segment commands the largest revenue share (Enterprise-grade solutions hold ~62.6%) due to high average contract values (ACV).<sup>1</sup>
#### Tier 2: The Statistical Heavyweights (The Legacy Desktop)

This tier is dominated by **IBM SPSS Statistics** and, to a lesser extent, **SAS**. For over 50 years, SPSS has been the lingua franca of market research.

* **Strengths:** Unrivaled statistical depth and performance. SPSS can chew through millions of rows of data with zero network latency. It handles the nuances of survey data—specifically the .sav file format, variable labels, and missing value schemes—better than any general-purpose BI tool.<sup>4</sup>
* **Weaknesses:** It is an island. SPSS requires a local installation, struggles on macOS (often requiring virtualization or dealing with bugs), and has no native collaboration features. Sharing results involves the "copy-paste" workflow into PowerPoint, a major source of error and inefficiency.<sup>4</sup>
* **Economic Friction:** Licensing is expensive ($99/month/user or thousands per year) and complex, creating a high barrier to entry for freelancers and students.<sup>15</sup>
#### Tier 3: The Cloud Analytical Middleware

Positioned as the bridge between Tier 1 and Tier 2 are the "modern" survey analysis platforms: **Displayr, Q Research Software, and Crunch.io**.

* **Positioning:** These tools explicitly market themselves as "SPSS killers." Displayr, in particular, focuses on the integration of analysis and reporting, allowing users to update PowerPoint decks automatically when data changes.<sup>4</sup>
* **The "Performance Gap":** While they solve the collaboration problem, they introduce the "latency problem." Displayr is described as "resource-intensive," and heavy calculations (like driver analysis on large datasets) can be slow because every interaction potentially requires a round-trip to the cloud server.<sup>7</sup> This sluggishness breaks the "flow" of exploratory analysis, a critical degradation in User Experience (UX) compared to SPSS.
## 2. The "Data Bottleneck" and Unmet Needs

The central failure of the current market architecture is the persistence of the "Data Bottleneck".<sup>19</sup> Despite the proliferation of tools, the workflow for a typical market researcher remains fragmented across incompatible silos. Data is collected in Qualtrics, exported as a .sav (SPSS) file, cleaned and weighted in SPSS (Desktop), and then visualized in PowerPoint or Tableau.
### 2.1 The Latency-Collaboration Trade-off

This fragmentation exists because no single platform has successfully united **performance** with **collaboration**.

* **Local Tools (SPSS):** High Performance, Zero Collaboration.
* **Cloud Tools (Displayr):** High Collaboration, Variable Performance.

As datasets grow larger—driven by the integration of behavioral data and multi-market tracking studies—cloud-based tools struggle to maintain the 60 frames-per-second (FPS) interactivity that users expect from modern software. The "spinner"—the loading icon that appears while a server processes a request—is the defining friction point of Tier 3 tools.<sup>20</sup> For an analyst who needs to iterate through hundreds of cross-tabs to find a story, even a 500ms delay per interaction accumulates into significant cognitive fatigue and lost productivity.
### 2.2 The "Mac User" and "Freemium" Gaps

Two specific demographic gaps further weaken the incumbents:

1. **The Mac Gap:** The creative industries (advertising, media, design) are overwhelmingly Mac-based, yet the standard tool (SPSS) runs poorly on macOS.<sup>14</sup> There is a desperate demand for a high-performance analysis tool that is OS-agnostic.
2. **The Freelancer Gap:** The gig economy for market research is growing, yet professional tools are priced for the enterprise. An independent consultant cannot justify a $3,000/year license for Q or SPSS, nor can they rely on basic tools like SurveyMonkey for complex analysis. A robust "Freemium" model is noticeably absent in the high-end analytics space.<sup>22</sup>

---
## 3. The Technological Inflection Point: Enabling "Velocity"

The emergence of "Velocity" is not merely a product launch; it is the inevitable result of a convergence in browser technologies. Three specific advancements—WebAssembly, Columnar Storage, and Local-First Architecture—have dismantled the technological barriers that previously forced the trade-off between web accessibility and desktop power.
### 3.1 WebAssembly (Wasm): The Browser as an OS

WebAssembly has fundamentally altered the capability of the web browser. It allows code written in low-level languages like C, C++, and Rust to execute in the browser at near-native speeds.<sup>24</sup>

* **Legacy Code Portability:** Crucially for the survey market, Wasm enables the porting of battle-tested statistical libraries. The **ReadStat** library (written in C) can be compiled to Wasm, allowing a browser-based tool to read and write SPSS .sav and Stata .dta files locally.<sup>26</sup> This provides "feature parity" with desktop tools regarding file compatibility without requiring server-side processing.
* **Computational Intensity:** Algorithms essential to survey analysis, such as **Iterative Proportional Fitting (Raking)** for weighting, are computationally expensive. Running these in JavaScript is slow and memory-inefficient. Wasm implementations can perform these calculations orders of magnitude faster, unlocking real-time weighting adjustments on the client side.<sup>27</sup>
### 3.2 DuckDB & Arrow: The Analytical Engine

The second pillar is **DuckDB**, an in-process SQL OLAP database, and **Apache Arrow**, a standardized in-memory columnar data format.

* **Vectorized Execution:** Traditional web applications treat data as rows (JSON objects), which is inefficient for analytical queries (e.g., "Average NPS by Age Group"). DuckDB processes data in columns (vectors). A query filtering a dataset of 1 million respondents takes milliseconds in DuckDB-Wasm compared to seconds or minutes in JavaScript-based logic.<sup>27</sup>
* **Zero-Copy Transfer:** Apache Arrow allows data to move between the database (DuckDB) and the visualization layer (e.g., a chart or grid) without serialization (copying). This "zero-copy" architecture is the secret to high-performance interactivity; it allows a user to filter a massive dataset and see the UI update instantly.<sup>24</sup>
### 3.3 The "Local-First" Architecture

"Local-First" software prioritizes the user's local device as the primary source of truth, with the cloud serving only as a synchronization and backup mechanism.<sup>20</sup>

* **Privacy & Compliance:** In a Local-First model, sensitive survey data (PII) never leaves the user's machine unless they explicitly choose to sync it. This solves a major friction point for researchers in healthcare and finance who are hesitant to upload datasets to third-party clouds like Displayr due to GDPR or internal compliance rules.<sup>20</sup>
* **Resilience:** The application works entirely offline. An analyst can open a massive .sav file, clean data, and build charts while on a flight, with changes syncing once connectivity is restored. This "offline-first" capability is a major differentiator against always-online SaaS tools.<sup>21</sup>

---
## 4. Product Profile Assessment: Velocity

**Velocity** is assessed here as the embodiment of this new technological paradigm: a **Local-First, Wasm-Powered Survey Analytics Platform**. It is designed to disrupt the market by offering the speed of SPSS with the modern UX of a browser-based tool.
### 4.1 Core Architecture and Performance

Velocity’s architecture is built to eliminate the "spinner." By moving the compute engine (DuckDB-Wasm) to the client, it removes network latency from the analysis loop.

* **Ingestion:** Velocity utilizes the ReadStat C-library (via Wasm) to parse SPSS (.sav), Stata (.dta), and CSV files instantly. Because this happens locally via the browser's File System Access API (OPFS), a 500MB dataset opens as quickly as a local Excel file, bypassing the "upload/processing" delays of cloud competitors.<sup>26</sup>
* **Data Grid:** To handle the display of large datasets (100k+ rows), Velocity likely employs a **Canvas-based data grid** (similar to technologies like Glide Data Grid or Tadviewer). Unlike HTML DOM tables, which become sluggish with large row counts, a Canvas grid renders data as a single image, maintaining 60 FPS scrolling performance regardless of dataset size.<sup>35</sup>


### 4.2 The "Killer Feature": Real-Time Weighting (Raking)

Weighting is the litmus test for professional survey tools. Most web tools offer rudimentary weighting or require server processing time. Velocity implements **Generalized Raking (GREG)** and **Iterative Proportional Fitting (IPF)** directly in Wasm.<sup>28</sup>

* **Mechanism:** Using C++ libraries compiled to Wasm (such as those referenced in the raking GitHub repositories), Velocity allows users to define complex weighting schemes (rim weighting, nested targets) and see the impact on their data instantly. This "What-If" capability—adjusting a demographic target and seeing the data shift in real-time—is a workflow currently impossible in server-side tools.<sup>37</sup>
### 4.3 Visual Analytics and Reporting

Velocity utilizes a grammar-based visualization approach (likely leveraging **Vega** or **Mosaic**) that binds directly to the local Arrow data store.

* **Interactive Exploration:** This enables "cross-filtering," where selecting a segment in one chart (e.g., clicking "Detractors" in an NPS chart) instantly filters all other charts on the dashboard. Because the data is local, this interaction is fluid, encouraging deeper exploration compared to the static "run and wait" model of SPSS or the lagging updates of Displayr.<sup>30</sup>
### 4.4 User Experience (UX) Design

Velocity’s design philosophy mirrors the "No Spinners" ideal of the Local-First manifesto.<sup>20</sup>

* **Document-Based Model:** Velocity treats analyses as "documents" (like a .velocity file) that live on the user's machine but can be synced. This familiar mental model appeals to SPSS users used to managing files, while the sync capability appeals to modern teams.
* **Syntax-Free Workflow:** While it runs SQL (via DuckDB) under the hood, the UI abstracts this into a drag-and-drop interface. However, unlike SPSS, which generates proprietary syntax, Velocity could expose the underlying SQL or Python/R code (via Pyodide) for advanced users, offering a bridge to the data science community.<sup>12</sup>

---
## 5. Strategic Analysis: Viability and Competition

Velocity’s market entry is timed to exploit the growing dissatisfaction with legacy tools and the performance limitations of first-generation cloud apps. However, its success is not guaranteed; it faces significant adoption barriers.
### 5.1 Competitive Positioning

Velocity must triangulate its position between SPSS and Displayr using a strategy of **"Uncompromising Hybridity."**

<table>
  <tr>
   <td><strong>Competitor</strong>
   </td>
   <td><strong>Velocity's Competitive Advantage</strong>
   </td>
   <td><strong>Velocity's Competitive Disadvantage</strong>
   </td>
  </tr>
  <tr>
   <td><strong>IBM SPSS Statistics</strong>
   </td>
   <td><strong>Collaboration & UX.</strong> Velocity is built for sharing; SPSS is built for isolation. Velocity runs natively on Macs. <sup>5</sup>
   </td>
   <td><strong>Depth.</strong> SPSS has 50+ years of obscure statistical tests. Velocity will lack niche features (e.g., complex survival analysis) at launch. <sup>12</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Displayr / Q</strong>
   </td>
   <td><strong>Speed & Privacy.</strong> Velocity has zero latency (local compute) and keeps data on-device (GDPR friendly). <sup>20</sup>
   </td>
   <td><strong>Ecosystem.</strong> Displayr has mature PowerPoint automation and a "report-ready" workflow that Velocity must rebuild. <sup>17</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Excel / Sheets</strong>
   </td>
   <td><strong>Scale & Rigor.</strong> Velocity handles millions of rows and native survey formats (.sav) that crash Excel. <sup>27</sup>
   </td>
   <td><strong>Ubiquity.</strong> Everyone has Excel. Velocity introduces a new tool to the stack.
   </td>
  </tr>
</table>

### 5.2 The Product-Led Growth (PLG) Strategy

To disrupt the incumbents, Velocity should adopt a **Product-Led Growth (PLG)** strategy similar to **Figma**.<sup>40</sup>

* **The "Trojan Horse":** Launch Velocity initially as the best *free* online viewer for SPSS (.sav) and Stata files. The market is full of users desperately searching for "free SPSS viewer" or "open.sav on Mac".<sup>34</sup> By solving this simple pain point perfectly—instant load, no install, free—Velocity can capture the top-of-funnel traffic for its target audience.
* **The Viral Loop:** Enable "one-click publishing." A user analyzes data locally, then generates a public (or password-protected) link to a read-only interactive dashboard. This link loads instantly for the client (because it's a lightweight Wasm bundle), demonstrating the product's speed to every stakeholder who views a report.
* **Monetization:** Follow the standard PLG model: Free for individuals (local-only), Paid for Teams (cloud sync, shared libraries, advanced export). This undercuts the high per-seat cost of SPSS and makes it accessible to the growing freelancer market.<sup>43</sup>
### 5.3 Risks and Mitigation

* **Browser Memory Constraints:** Wasm is generally limited to 4GB of memory in 32-bit environments (though 64-bit Wasm is emerging). For massive datasets, this is a hard ceiling. Velocity must implement aggressive memory management (paging to OPFS) to handle datasets larger than RAM, or risk crashing the browser tab—a user experience failure that creates distrust.<sup>24</sup>
* **The "Trust" Barrier:** Market researchers are conservative. They trust SPSS because the math is "known" to be correct. A new tool using a new engine (DuckDB) will face scrutiny regarding the accuracy of its statistical calculations (e.g., standard error estimation in complex samples). Velocity must publish "validation whitepapers" comparing its results decimal-for-decimal against SPSS to build trust.<sup>46</sup>
### 5.4 Conclusion: The Inevitability of the Edge

The analysis indicates that Velocity represents a highly viable and necessary evolution of the survey software market. The technological convergence of DuckDB, Arrow, and Wasm has opened a window for a tool that offers **"SPSS power in a Chrome tab."**

By resolving the "Data Bottleneck" through local-first processing, Velocity addresses the primary frustration of modern analysts: the sluggishness of cloud tools. Simultaneously, by bypassing the need for local installation and proprietary licensing, it addresses the primary frustration of the freelancer and Mac user: access. If Velocity can execute its PLG strategy effectively—leveraging the "free viewer" hook to build a user base—it has the potential to become the "Figma of Analytics," pushing the incumbents into obsolescence not by having *more* features, but by fundamentally changing the *speed* at which insights are generated.
## 6. Detailed Feature Analysis of Velocity

To critically assess Velocity, we must dissect the specific features required to compete with established players like SPSS and Displayr, identifying where Velocity excels and where it currently faces gaps.
### 6.1 Data Ingestion and Handling

The foundation of any survey tool is its ability to handle industry-standard file formats.

* **SPSS (.sav) Integration:** This is non-negotiable. Velocity leverages the **ReadStat** library compiled to Wasm.<sup>26</sup> This allows it to read binary .sav files, including metadata (variable labels, value labels, missing value definitions).
    * *Strategic Edge:* Competitors like Excel cannot read these files natively. Competitors like Displayr require an upload process that converts the file, often losing metadata or taking time. Velocity opens them instantly.
* **Handling Large Datasets:** Velocity uses **DuckDB** for storage. DuckDB's columnar nature allows it to compress data efficiently. A 1GB CSV file might compress to 200MB in DuckDB, fitting easily within the browser's memory footprint.<sup>27</sup>
* **The "Wide Data" Challenge:** Survey data is often "wide" (thousands of columns/variables). Row-based databases struggle here. DuckDB's columnar format is specifically optimized for this, allowing operations like "calculate mean of Q1a, Q1b... Q1z" to happen via vectorized instructions.<sup>48</sup>
### 6.2 The Analytics Engine: DuckDB-Wasm

Velocity’s decision to use DuckDB-Wasm is its primary differentiator.

* **SQL Power:** Under the hood, Velocity runs full SQL. This supports complex joins (e.g., joining survey data with CRM data), window functions, and aggregations.<sup>30</sup>
* **Extensions:** DuckDB supports extensions. Velocity can potentially load the spatial extension for geospatial analysis or the icu extension for text processing, all within the browser.<sup>50</sup>
* **Performance Benchmarks:** Research indicates that DuckDB-Wasm can perform aggregations on millions of rows in sub-second timeframes (e.g., ~0.8 seconds for 3M rows).<sup>27</sup> This is comparable to desktop performance and vastly superior to client-side JavaScript arrays.
### 6.3 Weighting and Sampling

Weighting is where "toy" tools fail. Velocity implements **Raking (Iterative Proportional Fitting)**.

* **Implementation:** Using C++ algorithms (like the raking repo) compiled to Wasm.<sup>28</sup>
* **Workflow:** Users define target distributions (e.g., "Census 2024"). Velocity runs the raking algorithm locally. Because this is CPU-bound, Wasm is 10-20x faster than a JS implementation.<sup>52</sup>
* **Rim Weighting:** Velocity supports Rim Weighting (weighting on multiple variables simultaneously).<sup>38</sup> The local engine allows users to toggle weights on/off and instantly see the effect on all charts, a crucial workflow for checking data validity.
### 6.4 Visualization and Reporting

Velocity moves beyond static charts.

* **Grammar of Graphics:** By using a declarative visualization grammar (like **Vega-Lite** or **Mosaic**), Velocity allows for flexible, layered charts.<sup>39</sup>
* **Export:** This is a critical gap Velocity must close. SPSS and Displayr excel at exporting to PowerPoint. Velocity uses HTML5 Canvas, which can easily be exported to high-resolution PNG/PDF.<sup>36</sup> However, generating *native* PowerPoint objects (editable shapes) from the browser is complex and represents a significant development hurdle to match Displayr’s capabilities.<sup>17</sup>

---
## 7. The Competitive Battlefield: Velocity vs. The Incumbents
### 7.1 Velocity vs. IBM SPSS Statistics

* **The Price War:** SPSS is expensive ($99/mo or $3,000+ perpetual).<sup>15</sup> Velocity’s low server costs allow for a Freemium model. This is devastating to SPSS’s hold on the student/freelancer market.
* **The OS War:** SPSS on Mac is a second-class citizen, often requiring emulation or suffering from UI lag.<sup>14</sup> Velocity runs natively in Chrome/Safari/Edge on any OS, giving it an immediate advantage with creative agencies and modern tech-forward research teams.
* **Collaboration:** SPSS has none. Sharing means emailing a file. Velocity allows "Google Docs style" collaboration (if the user enables sync), turning a solitary activity into a team sport.<sup>5</sup>
### 7.2 Velocity vs. Displayr

* **The Performance War:** Displayr is powerful but slow. It relies on server round-trips. Velocity is instant. For the "power user" who works fast, Velocity’s lack of latency is a massive quality-of-life improvement.<sup>4</sup>
* **The Offline War:** Displayr requires the internet. Velocity works offline. This is crucial for researchers traveling or working in secure, air-gapped environments.<sup>21</sup>
* **The Feature Gap:** Displayr has spent 10+ years building specific MR features (MaxDiff, TURF, Driver Analysis). Velocity is new. It cannot match this breadth immediately. Velocity must rely on its plugin architecture (Wasm) to allow the community to fill these gaps, similar to how Figma’s plugin community empowered it.<sup>40</sup>
### 7.3 Velocity vs. Q Research Software

* **The "Legacy" Trap:** Q is a desktop Windows app. It faces the same "dying platform" risks as SPSS. It requires installation and updates. Velocity is always up-to-date and requires no install.<sup>53</sup>
* **Data Handling:** Q handles data well, but Velocity’s use of DuckDB allows it to potentially handle *larger* datasets (via paging) than Q’s in-memory engine, depending on the machine’s specs.<sup>45</sup>

---
## 8. Strategic Roadmap and Future Outlook

To succeed, Velocity must navigate a path that maximizes its disruptive potential while mitigating the risks of being a "new entrant" in a conservative field.
### 8.1 Phase 1: The "Free Utility" Strategy (Months 1-12)

* **Goal:** Capture Traffic and Trust.
* **Tactic:** Release the "Velocity Viewer." A completely free, no-login-required web tool to view, filter, and summarize .sav and .dta files.
* **Why:** There is massive search volume for "open sav file online".<sup>34</sup> By providing a superior, private (local-only) viewer, Velocity builds a reputation for speed and privacy.
* **Feature Focus:** Perfect ReadStat integration. Instant rendering. Basic frequency tables.
### 8.2 Phase 2: The "Freelancer's Workbench" (Months 12-24)

* **Goal:** Monetization and Workflow Adoption.
* **Tactic:** Introduce the "Pro" tier. Add Weighting (Raking), Cross-tabs with significance testing, and basic Export.
* **Target:** Freelance consultants and students who cannot afford SPSS.
* **Pricing:** $20-$30/month. Significantly undercuts SPSS ($99) while offering better UX.
### 8.3 Phase 3: The "Enterprise Collaboration Hub" (Year 2+)

* **Goal:** Displacement of Incumbents.
* **Tactic:** Team Sync, Shared Libraries, and API integration (e.g., pull directly from Qualtrics).
* **Feature Focus:** PowerPoint automation (matching Displayr’s killer feature), Advanced Statistics (Regression, Drivers) via Wasm plugins.
* **Positioning:** "The modern OS for Insights."
### 8.4 Future Trends: AI and The Edge

The future of Velocity lies in **Edge AI**. With WebNN and WebGPU, browsers will soon run local Large Language Models (LLMs) efficiently.<sup>56</sup>

* **Integration:** Velocity could integrate a local LLM (like a quantized Llama model) to perform "AI coding" of open-ended survey responses *on the client device*. This would compete directly with **Coppelia** and **Caplena** but with a massive privacy advantage: the raw text never leaves the user's computer.<sup>57</sup> This aligns perfectly with the privacy-first zeitgeist and the increasing regulation of AI data usage.

In conclusion, Velocity is not just a theoretical product; it is the blueprint for the next generation of data tools. The market has proven that users value speed (SPSS) and collaboration (Displayr). Until now, they could not have both. The convergence of Wasm, DuckDB, and Local-First architecture finally makes this synthesis possible. Velocity’s success will depend on its execution—specifically, its ability to maintain browser stability while handling heavy data—but its strategic direction is aligned with the inevitable trajectory of software history: bringing the power of the cloud to the speed of the edge.

---
**Source Mapping & Data Clusters**

<table>
  <tr>
   <td><strong>Topic</strong>
   </td>
   <td><strong>Relevant Sources</strong>
   </td>
  </tr>
  <tr>
   <td><strong>Market Sizing & CAGR</strong>
   </td>
   <td><sup>1</sup>
   </td>
  </tr>
  <tr>
   <td><strong>SPSS Market Position</strong>
   </td>
   <td><sup>4</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Displayr/Q Analysis</strong>
   </td>
   <td><sup>4</sup>
   </td>
  </tr>
  <tr>
   <td><strong>WebAssembly & Wasm</strong>
   </td>
   <td><sup>24</sup>
   </td>
  </tr>
  <tr>
   <td><strong>DuckDB & Arrow</strong>
   </td>
   <td><sup>24</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Local-First / PLG</strong>
   </td>
   <td><sup>20</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Weighting / Raking</strong>
   </td>
   <td><sup>28</sup>
   </td>
  </tr>
  <tr>
   <td><strong>Coppelia / AI Trends</strong>
   </td>
   <td><sup>57</sup>
   </td>
  </tr>
</table>

#### Works cited

1. Survey Software Market Size & Share Outlook to 2030 - Mordor Intelligence, accessed on January 20, 2026, [https://www.mordorintelligence.com/industry-reports/survey-software-market](https://www.mordorintelligence.com/industry-reports/survey-software-market)
2. Online Survey Software Market Size, Industry Share | Forecast 2034, accessed on January 20, 2026, [https://www.fortunebusinessinsights.com/online-survey-software-market-108268](https://www.fortunebusinessinsights.com/online-survey-software-market-108268)
3. Online Survey Software Market Analysis, Growth & Forecast 2024–2029 | AI and Industry Innovation – Technavio Report, accessed on January 20, 2026, [https://www.technavio.com/report/online-survey-software-market-industry-analysis](https://www.technavio.com/report/online-survey-software-market-industry-analysis)
4. SPSS vs. Displayr, accessed on January 20, 2026, [https://www.displayr.com/spss-vs-displayr/](https://www.displayr.com/spss-vs-displayr/)
5. Key Differences Between SPSS and Displayr, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/5014997593231-Key-Differences-Between-SPSS-and-Displayr](https://help.displayr.com/hc/en-us/articles/5014997593231-Key-Differences-Between-SPSS-and-Displayr)
6. Diagnose Slow Network or Network Problems - Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/4403876768783-Diagnose-Slow-Network-or-Network-Problems](https://help.displayr.com/hc/en-us/articles/4403876768783-Diagnose-Slow-Network-or-Network-Problems)
7. Diagnose Computer and Browser Issues - Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/5074795636367-Diagnose-Computer-and-Browser-Issues](https://help.displayr.com/hc/en-us/articles/5074795636367-Diagnose-Computer-and-Browser-Issues)
8. Survey Software Market Size, Share 2025 - 2034, accessed on January 20, 2026, [https://www.proficientmarketinsights.com/market-reports/survey-software-market-2692](https://www.proficientmarketinsights.com/market-reports/survey-software-market-2692)
9. Market Research Software Platform | Qualtrics, accessed on January 20, 2026, [https://www.qualtrics.com/market-research/](https://www.qualtrics.com/market-research/)
10. Alchemer | Online Survey Software & Tools, accessed on January 20, 2026, [https://www.alchemer.com/](https://www.alchemer.com/)
11. Advanced Market Research Analysis Software Tools in 2026 - Displayr, accessed on January 20, 2026, [https://www.displayr.com/top-market-research-analysis-software-tools/](https://www.displayr.com/top-market-research-analysis-software-tools/)
12. accessed on January 20, 2026, [https://www.researchgate.net/publication/396358205_Comparative_Analysis_of_Statistical_Results_Generated_by_Python_R_SPSS_and_Excel#:~:text=Python%20and%20R%20offer%20greater,quick%20calculations%20and%20basic%20visualizations.](https://www.researchgate.net/publication/396358205_Comparative_Analysis_of_Statistical_Results_Generated_by_Python_R_SPSS_and_Excel#:~:text=Python%20and%20R%20offer%20greater,quick%20calculations%20and%20basic%20visualizations.)
13. Displayr Reviews 2026: Details, Pricing, & Features - G2, accessed on January 20, 2026, [https://www.g2.com/products/displayr/reviews](https://www.g2.com/products/displayr/reviews)
14. Reading .sav files - Apple Support Communities, accessed on January 20, 2026, [https://discussions.apple.com/thread/842940](https://discussions.apple.com/thread/842940)
15. Compare SPSS Statistics vs. Q Research Software by Displayr - G2, accessed on January 20, 2026, [https://www.g2.com/compare/ibm-spss-statistics-vs-q-research-software-by-displayr](https://www.g2.com/compare/ibm-spss-statistics-vs-q-research-software-by-displayr)
16. IBM SPSS Software, accessed on January 20, 2026, [https://www.ibm.com/products/spss](https://www.ibm.com/products/spss)
17. Why People and Companies Choose Displayr, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/360004500375-Why-People-and-Companies-Choose-Displayr](https://help.displayr.com/hc/en-us/articles/360004500375-Why-People-and-Companies-Choose-Displayr)
18. How to Troubleshoot Speed and Performance Issues - Displayr Help, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/5815727374223-How-to-Troubleshoot-Speed-and-Performance-Issues](https://help.displayr.com/hc/en-us/articles/5815727374223-How-to-Troubleshoot-Speed-and-Performance-Issues)
19. What is Data Bottleneck? - Dremio, accessed on January 20, 2026, [https://www.dremio.com/wiki/data-bottleneck/](https://www.dremio.com/wiki/data-bottleneck/)
20. Local-first software: You own your data, in spite of the cloud - Ink & Switch, accessed on January 20, 2026, [https://www.inkandswitch.com/essay/local-first/](https://www.inkandswitch.com/essay/local-first/)
21. Benefits of LocalFirst for the Good of All | by Volodymyr Pavlyshyn - Medium, accessed on January 20, 2026, [https://volodymyrpavlyshyn.medium.com/benefits-of-localfirst-for-the-good-of-all-e611e3ea823f](https://volodymyrpavlyshyn.medium.com/benefits-of-localfirst-for-the-good-of-all-e611e3ea823f)
22. Free or open-source alternatives to SPSS for academic work? - Reddit, accessed on January 20, 2026, [https://www.reddit.com/r/spss/comments/1pumwl5/free_or_opensource_alternatives_to_spss_for/](https://www.reddit.com/r/spss/comments/1pumwl5/free_or_opensource_alternatives_to_spss_for/)
23. 7 Best Survey Analysis Software and Tools in 2026 - VWO, accessed on January 20, 2026, [https://vwo.com/blog/survey-analysis-software/](https://vwo.com/blog/survey-analysis-software/)
24. DuckDB Wasm, accessed on January 20, 2026, [https://duckdb.org/docs/stable/clients/wasm/overview](https://duckdb.org/docs/stable/clients/wasm/overview)
25. What are WebAssembly (WASM) Applications? Complete Guide 2025 | Vofox Solutions, accessed on January 20, 2026, [https://vofoxsolutions.com/what-are-webassembly-applications](https://vofoxsolutions.com/what-are-webassembly-applications)
26. WizardMac/ReadStat: Command-line tool (+ C library) for ... - GitHub, accessed on January 20, 2026, [https://github.com/WizardMac/ReadStat](https://github.com/WizardMac/ReadStat)
27. Lightning-Fast Analytics: DuckDB + WASM for Large Datasets in the Browser - Medium, accessed on January 20, 2026, [https://medium.com/@davidrp1996/lightning-fast-analytics-duckdb-wasm-for-large-datasets-in-the-browser-43cb43cee164](https://medium.com/@davidrp1996/lightning-fast-analytics-duckdb-wasm-for-large-datasets-in-the-browser-43cb43cee164)
28. xinBrueck/raking: Adjust weights for survey data by applying Raking Algorithm - GitHub, accessed on January 20, 2026, [https://github.com/xinBrueck/raking](https://github.com/xinBrueck/raking)
29. 15+ Companies Using DuckDB in Production: A Comprehensive Guide - MotherDuck Blog, accessed on January 20, 2026, [https://motherduck.com/blog/15-companies-duckdb-in-prod/](https://motherduck.com/blog/15-companies-duckdb-in-prod/)
30. A curated list of awesome DuckDB resources - GitHub, accessed on January 20, 2026, [https://github.com/davidgasquez/awesome-duckdb](https://github.com/davidgasquez/awesome-duckdb)
31. Local-First Software: Origins And Evolution - PowerSync, accessed on January 20, 2026, [https://www.powersync.com/blog/local-first-software-origins-and-evolution](https://www.powersync.com/blog/local-first-software-origins-and-evolution)
32. From the Cloud to the Edge: Exploring the Local-First Software Revolution - CDInsights, accessed on January 20, 2026, [https://www.clouddatainsights.com/from-the-cloud-to-the-edge-exploring-the-local-first-software-revolution/](https://www.clouddatainsights.com/from-the-cloud-to-the-edge-exploring-the-local-first-software-revolution/)
33. Origin private file system - Web APIs | MDN, accessed on January 20, 2026, [https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
34. Open .sav files without spss - AddMaple, accessed on January 20, 2026, [https://addmaple.com/help/frequently-asked-questions/open-sav-files-without-spss](https://addmaple.com/help/frequently-asked-questions/open-sav-files-without-spss)
35. Would someone elaborate on the choice of canvas vs DOM for grids like this? Ther... | Hacker News, accessed on January 20, 2026, [https://news.ycombinator.com/item?id=23935464](https://news.ycombinator.com/item?id=23935464)
36. I wrote an HTML canvas data grid so you don't have to | by Jason Smith | ITNEXT, accessed on January 20, 2026, [https://itnext.io/i-wrote-an-html-canvas-data-grid-so-you-dont-have-to-d945aa4780b4](https://itnext.io/i-wrote-an-html-canvas-data-grid-so-you-dont-have-to-d945aa4780b4)
37. Generalized Raking for Survey Weighting - DEV Community, accessed on January 20, 2026, [https://dev.to/potloc/generalized-raking-for-survey-weighting-2d1d](https://dev.to/potloc/generalized-raking-for-survey-weighting-2d1d)
38. Applying RIM Weighting - Forsta Surveys, accessed on January 20, 2026, [https://forstasurveys.zendesk.com/hc/en-us/articles/4409461611163-Applying-RIM-Weighting](https://forstasurveys.zendesk.com/hc/en-us/articles/4409461611163-Applying-RIM-Weighting)
39. Why Mosaic? - UW Interactive Data Lab, accessed on January 20, 2026, [https://idl.uw.edu/mosaic/why-mosaic/](https://idl.uw.edu/mosaic/why-mosaic/)
40. Figma Product-Led Growth: How a Design Tool Took Over the World - Ptengine, accessed on January 20, 2026, [https://www.ptengine.com/blog/business-strategy/figma-product-led-growth-how-a-design-tool-took-over-the-world/](https://www.ptengine.com/blog/business-strategy/figma-product-led-growth-how-a-design-tool-took-over-the-world/)
41. I studied how Figma and Loom achieved product-led growth. Here's what I found: : r/ycombinator - Reddit, accessed on January 20, 2026, [https://www.reddit.com/r/ycombinator/comments/1cdl415/i_studied_how_figma_and_loom_achieved_productled/](https://www.reddit.com/r/ycombinator/comments/1cdl415/i_studied_how_figma_and_loom_achieved_productled/)
42. SPSS Viewer Download - The SPSS Legacy Viewer lets you edit SPSS Output Navigator, accessed on January 20, 2026, [https://spss-viewer.software.informer.com/](https://spss-viewer.software.informer.com/)
43. The Freemium Business Model Explained | Recurly, accessed on January 20, 2026, [https://recurly.com/blog/what-is-freemium-a-guide-for-subscription-businesses/](https://recurly.com/blog/what-is-freemium-a-guide-for-subscription-businesses/)
44. Unlocking API Revenue: Why the Freemium Model Works Best | Zuplo Learning Center, accessed on January 20, 2026, [https://zuplo.com/learning-center/unlocking-api-revenue](https://zuplo.com/learning-center/unlocking-api-revenue)
45. Limits - DuckDB, accessed on January 20, 2026, [https://duckdb.org/docs/stable/operations_manual/limits](https://duckdb.org/docs/stable/operations_manual/limits)
46. What to Do When Displayr's Results Are Different Than Another Program's Results, accessed on January 20, 2026, [https://help.displayr.com/hc/en-us/articles/4408426631439-What-to-Do-When-Displayr-s-Results-Are-Different-Than-Another-Program-s-Results](https://help.displayr.com/hc/en-us/articles/4408426631439-What-to-Do-When-Displayr-s-Results-Are-Different-Than-Another-Program-s-Results)
47. Top 10 Data Analysis Tools in 2025 - Codebasics, accessed on January 20, 2026, [https://codebasics.io/blog/top-10-data-analysis-tools](https://codebasics.io/blog/top-10-data-analysis-tools)
48. Advanced WebAssembly Performance Optimization: Pushing the Limits of Web Performance, accessed on January 20, 2026, [https://dev.to/rikinptl/advanced-webassembly-performance-optimization-pushing-the-limits-of-web-performance-4ke0](https://dev.to/rikinptl/advanced-webassembly-performance-optimization-pushing-the-limits-of-web-performance-4ke0)
49. Friendly SQL - DuckDB, accessed on January 20, 2026, [https://duckdb.org/docs/stable/sql/dialect/friendly_sql](https://duckdb.org/docs/stable/sql/dialect/friendly_sql)
50. anofox_statistics – DuckDB Community Extensions, accessed on January 20, 2026, [https://duckdb.org/community_extensions/extensions/anofox_statistics](https://duckdb.org/community_extensions/extensions/anofox_statistics)
51. Extensions - DuckDB, accessed on January 20, 2026, [https://duckdb.org/docs/stable/extensions/overview](https://duckdb.org/docs/stable/extensions/overview)
52. Understanding the Performance of WebAssembly Applications - Weihang Wang, accessed on January 20, 2026, [https://weihang-wang.github.io/papers/imc21.pdf](https://weihang-wang.github.io/papers/imc21.pdf)
53. A Brief History of Displayr and Q - Technical Documentation - Zendesk, accessed on January 20, 2026, [https://displayrdocs.zendesk.com/hc/en-us/articles/8268890735631-A-Brief-History-of-Displayr-and-Q](https://displayrdocs.zendesk.com/hc/en-us/articles/8268890735631-A-Brief-History-of-Displayr-and-Q)
54. Getting Started with Q | Q Research Software, accessed on January 20, 2026, [https://www.qresearchsoftware.com/getting-started-with-q-part-1-understand-the-q-workflow](https://www.qresearchsoftware.com/getting-started-with-q-part-1-understand-the-q-workflow)
55. Project Options - Q Wiki, accessed on January 20, 2026, [https://wiki.q-researchsoftware.com/wiki/Project_Options](https://wiki.q-researchsoftware.com/wiki/Project_Options)
56. How WebAssembly Gets Used: The 18 Most Exciting Startups Building with Wasm, accessed on January 20, 2026, [https://www.amplifypartners.com/blog-posts/how-webassembly-gets-used-the-18-most-exciting-startups-building-with-wasm](https://www.amplifypartners.com/blog-posts/how-webassembly-gets-used-the-18-most-exciting-startups-building-with-wasm)
57. Caplena: The AI feedback analytics software you can trust, accessed on January 20, 2026, [https://caplena.com/en](https://caplena.com/en)
58. WebAssembly progress - Page 4 - Ports - Haiku Community, accessed on January 20, 2026, [https://discuss.haiku-os.org/t/webassembly-progress/10848?page=4](https://discuss.haiku-os.org/t/webassembly-progress/10848?page=4)
59. 7 Best SPSS Alternatives in 2026 (Compared) - Displayr, accessed on January 20, 2026, [https://www.displayr.com/best-spss-alternatives/](https://www.displayr.com/best-spss-alternatives/)
60. WebAssembly/binaryen: Optimizer and compiler/toolchain library for WebAssembly - GitHub, accessed on January 20, 2026, [https://github.com/WebAssembly/binaryen](https://github.com/WebAssembly/binaryen)
61. Using C++ in a web app with WebAssembly | by Netherlands eScience Center, accessed on January 20, 2026, [https://blog.esciencecenter.nl/using-c-in-a-web-app-with-webassembly-efd78c08469](https://blog.esciencecenter.nl/using-c-in-a-web-app-with-webassembly-efd78c08469)
62. Coppelia Machine Learning and Analytics, accessed on January 20, 2026, [https://coppelia.io](https://coppelia.io)