# Research: Direct Data Import Feasibility

## Executive Summary
Integrating "Direct Imports" (from Qualtrics, Decipher, etc.) is **feasible** without rewriting the core data processing engine (DuckDB-WASM), but it **introduces a new architectural requirement**: a server-side component or proxy to handle API authentication and CORS, which conflicts with the current purely Client-Side (SPA) architecture.

## 1. Competitive Landscape: How Crunch.io Does It
Crunch.io treats "Direct Imports" as **Remote File Ingestions**:
1.  **Authentication**: User provides API Token/Keys.
2.  **Orchestration**: System connects to the platform, lists surveys, and triggers an "Export" job.
3.  **Asynchronous Processing**: The system polls the external API until the export is ready.
4.  **Ingestion**: The file (SPSS/JSON/CSV) is downloaded and ingested.
5.  **Metadata Mapping**: Crucial value-add. They map platform-specific schemas (e.g., Qualtrics Question Types) to their internal variable types automatically.

## 2. External API Realities (Qualtrics & Decipher)
These platforms rarely offer a "real-time stream" of data. They use an **Async Export Pattern**:
*   **Qualtrics API**:
    1.  `POST /surveys/{surveyId}/export-responses` (Initiates export)
    2.  `GET /surveys/{surveyId}/export-responses/{exportId}` (Polls progress, returns percent complete)
    3.  `GET /surveys/{surveyId}/export-responses/{fileId}/file` (Downloads result, usually ZIP)
*   **Decipher (Forsta) API**:
    *   Similar flow, often involving fetching a "Datamap" (schema) and "Data" (responses) separately.
    *   Authentication is via Headers (`x-apikey`).

**Constraint**: Most of these APIs **do not support CORS** (Cross-Origin Resource Sharing) for browser-based requests. They expect to be called from a server. Calling them directly from a browser (Velocity's current state) will likely fail with CORS errors unless a proxy is used.

## 3. Velocity Architecture Gap Analysis
### Current State
*   **Architecture**: Client-Side SPA (Vite + React).
*   **Ingestion**: `analysisWorker.ts` accepts `File` objects (Strings/ArrayBuffers) from the local machine.
*   **State**: Synchronous/Local (User selects file -> Worker processes it).

### The Gap
1.  **Network/CORS**: We cannot reliably call Qualtrics/Decipher APIs from the browser due to CORS.
2.  **Persistence**: "Direct Import" implies we save the connection so the user can "Refresh Data" later. Storing API keys in `localStorage` is insecure for enterprise use cases, though acceptable for a "Local-First" prototype if clearly communicated.
3.  **Job Management**: We need a way to manage the "Start -> Poll -> Download" lifecycle.

## 4. Recommendations
### Option A: Serverless Functions (Recommended Path)
Introduce a lightweight backend (e.g., Vercel Serverless Functions or a small Node container).
*   **Role**: Acts as a proxy.
    *   UI sends Key + Survey ID to Proxy.
    *   Proxy talks to Qualtrics (bypassing CORS).
    *   Proxy streams the file back to the UI.
*   **Pros**: Secure, reliable, standard practice.
*   **Cons**: Adds infrastructure complexity to a "static" site.

### Option B: Client-Side Proxy (Interim Solution)
Use a public CORS proxy (not recommended for production/sensitive data) or a local proxy if this is an Electron app.
*   **Verdict**: Not viable for a web-based SaaS handling confidential survey data.

### Option C: "Bring Your Own Key" + Client Fetch (Risky)
Attempt to call APIs directly.
*   *Note*: Some APIs *might* allow CORS if configured, but Qualtrics historically is strict.
*   **Verdict**: High risk of failure.

## Conclusion
We **can** add Direct Imports to the foundations later, provided we are willing to add a **server-side API layer** (e.g., Next.js API routes) to handle the network negotiations. The core "Data Engine" (DuckDB-WASM) does **not** need to change; it just needs a new way to receive the file (as a Blob from a network response instead of a File from an input).

**Immediate Action**: No core architectural changes needed for *Data Processing*. However, for *Data Acquisition*, we should plan for a "Connection Manager" feature that essentially downloads the remote file and hands it to the existing Worker.
