**Project Code Name:** "Velocity" (The Anti-SPSS) **Date:** January 2026 **Primary User:** The Market Researcher ("The Storyteller")

## 1. The High-Level Pitch

**"Velocity" is the Notion of statistical analysis.** It is a local-first, web-native tool that allows market researchers to drag-and-drop `.SAV` (SPSS) files and explore data instantly. It removes the "Data Processing Bottleneck" by making crosstabs, filters, and significance testing as easy as playing a video game.

- **Core Philosophy:** Speed > Power.
    
- **The Vibe:** "Playful, Safe, Instant." (Think: Linear, Raycast, Notion).
    
- **The Enemy:** The "Spinning Wheel" of Displayr and the "Grey Menus" of SPSS.
    

---

## 2. Target Audience & Persona

- **Name:** "Sarah the Strategist"
    
- **Role:** Senior Research Exec at a boutique agency.
    
- **The Pain:** It’s Friday at 4 PM. A client needs one slide. She knows the data is in the file, but she doesn't know SPSS syntax, and the Data Processing team has gone home.
    
- **The Goal:** She wants to open the file, drag "Gender" to columns, "Satisfaction" to rows, and screenshot the result. She does _not_ want to configure a server or write code.
    

---

## 3. MVP Feature Set (The "Must Haves")

### A. The Engine (Invisible but Vital)

- **Local-First Architecture:** The app must run 100% in the browser (Client-side).
    
- **WASM Backend:** Use **DuckDB-Wasm** or **Pyodide** to parse `.SAV` files locally.
    
    - _Constraint:_ No data is ever uploaded to a cloud server.
        
- **File Support:** Must read `.SAV` (SPSS) files, including:
    
    - Variable Labels (Question text).
        
    - Value Labels (1="Male").
        
    - User Missing Values.
        

### B. The Interface (The "Workbench")

- **The Canvas:** A clean, infinite whitespace in the center. No grid lines until data is present.
    
- **The Sidebar (The "Pantry"):**
    
    - A searchable list of all variables on the left.
        
    - **Smart Icons:** Distinct icons for Nominal (Text), Ordinal (Scale), and Scale (Number) variables.
        
- **Drag-and-Drop Physics:**
    
    - Users drag a variable from the Pantry -> Canvas.
        
    - **Drop Zone Logic:** The Canvas visually highlights "Rows" and "Columns" drop zones when a variable is hovering.
        

### C. The Analysis (The "Magic")

- **Instant Crosstabs:** Dropping a variable immediately renders a table.
    
- **Automatic Sig Testing:**
    
    - If a Crosstab is generated, automatically run column proportions tests (A/B/C/D).
        
    - _Visual:_ Small, subtle superscript letters next to the percentages. Green color for "Significantly Higher," Red for "Lower" (optional toggle).
        
- **The "Top 2 Box" Toggle:** A global toggle switch. When ON, all 5-point Likert scales collapse into "Net Positive" automatically.
    

### D. The Output

- **Export to Clipboard:** A "Copy as Image" and "Copy as Excel" button on every table.
    
- **PPT Export:** Basic export that puts the current table onto a slide.
    

---

## 4. User Journey (The "Friday 4 PM" Test)

1. **Landing:** User opens `velocity.app`. Screen is blank white with a large, friendly "Drop .SAV file here" area.
    
2. **Loading:** User drops a 50MB file.
    
    - _Success Metric:_ Parsed and ready in **< 2 seconds**.
        
3. **Exploration:**
    
    - User sees the variable list. Search: "NPS".
        
    - Drags "NPS_Grouped" to Columns.
        
    - Drags "Age_Group" to Rows.
        
4. **Refinement:**
    
    - User realizes "Age" is messy.
        
    - User highlights columns "18-24" and "25-34", right-clicks, and selects **"Merge"**.
        
    - _Result:_ Table updates instantly to show "18-34". No syntax required.
        
5. **Finish:** Click "Copy to Clipboard." Paste into email. Done.
    

---

## 5. Design System (For the AI / Vibe Coding)

_Use this section as your "System Instruction" when prompting the AI._

- **Aesthetic Style:** "Clean Productivity."
    
    - **Font:** Inter or San Francisco (System UI).
        
    - **Colors:** High amount of whitespace. Primary action color is a soft Indigo. Secondary data color is Greyscale.
        
    - **Borders:** Thin, subtle borders (1px solid #E5E7EB).
        
    - **Shadows:** Soft, diffused shadows for floating elements (dropshadow-sm).
        
- **Interaction Model:**
    
    - **Hover States:** Everything clickable should have a subtle background fade on hover.
        
    - **Feedback:** If an action takes >100ms, show a tiny skeleton loader, never a blocking spinner.
        
- **Terminology:**
    
    - Don't say "Variable." Say **"Question."**
        
    - Don't say "Crosstab." Say **"Table."**
        
    - Don't say "Syntax." Say **"Logic."**
        

---

## 6. Technical "Do Not Break" Rules

1. **The "Undo" Button:** Must work for _everything_. If I accidentally merge a column, Cmd+Z must fix it instantly.
    
2. **Read-Only Default:** The app treats the `.SAV` file as read-only. We never overwrite the user's original file. We only export _new_ artifacts.
    
3. **State Persistence:** If I refresh the browser, my tables should still be there (store state in `localStorage` or `IndexedDB`).
    

---