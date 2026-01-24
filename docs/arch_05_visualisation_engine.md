 Summary                                                                                                                            
                                                                                                                                    
 Consolidate visualization around D3.js, remove legacy dependencies, and implement a context-aware chart system that:               
 - Auto-selects appropriate chart types based on data configuration                                                                 
 - Enables Visual ETL (drag-to-merge, click-to-filter) directly on charts                                                           
 - Provides curated alternatives for user selection                                                                                 
                                                                                                                                    
 ---                                                                                                                                
 Guiding Principles (from research_08_UX_patterns_for_surveys.md)                                                                   
                                                                                                                                    
 1. Harvesting Mode: Analysis Canvas is for insight generation - clutter-free, rapid feedback                                       
 2. Variable Sets First: Canvas operates on Sets (Questions), not raw variables                                                     
 3. Visual ETL on Canvas: Direct manipulation for recoding (drag bars to merge, right-click to filter/exclude)                      
 4. Context Awareness: Selection state shared with Variable Manager                                                                 
                                                                                                                                    
 ---                                                                                                                                
 Chart Type Mapping                                                                                                                 
 ┌─────────────────────────────────────┬───────────────────────────┬────────────────────────────┬────────────────────────┐          
 │         Data Configuration          │       Default Chart       │        Alternatives        │         Notes          │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Single nominal, no column           │ Horizontal Bar (ranked)   │ Vertical Bar, Donut        │ Sorted by frequency    │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Single ordinal, no column           │ Horizontal Bar (ordered)  │ Diverging Bar              │ Preserve scale order   │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Ordinal + column (Likert by banner) │ Diverging Stacked Bar     │ Grouped Bar, 100% Stacked  │ Centers the scale      │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Nominal + column (cross-tab)        │ Grouped Bar               │ 100% Stacked, Mosaic       │ Compare across columns │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Grid (multiple statements)          │ Stacked Bar per statement │ Diverging Stacked, Grouped │ Shows composition      │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Multiple response                   │ Horizontal Bar (ranked %) │ Lollipop                   │ Ranked by selection    │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Scale, no column                    │ Histogram                 │ Box Plot                   │ Distribution           │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Scale + nominal column              │ Grouped Box Plot          │ Violin, Ridgeline          │ P2 priority            │          
 ├─────────────────────────────────────┼───────────────────────────┼────────────────────────────┼────────────────────────┤          
 │ Two scales                          │ Scatterplot               │ Hexbin                     │ P3 priority            │          
 └─────────────────────────────────────┴───────────────────────────┴────────────────────────────┴────────────────────────┘          
 ---                                                                                                                                
 Decision: Sparkline Refactoring                                                                                                    
                                                                                                                                    
 Recommendation: Keep Sparkline as Pure React/SVG (Do Not Refactor to D3) ✓ Confirmed                                               
                                                                                                                                    
 ---                                                                                                                                
 Phase 1: Legacy Cleanup                                                                                                            
                                                                                                                                    
 Goal: Remove deprecated visualization code and dependencies.                                                                       
                                                                                                                                    
 Files to Delete                                                                                                                    
                                                                                                                                    
 - /src/components/charts/InteractiveBarChart.tsx                                                                                   
 - /src/components/charts/MosaicBarChart.tsx                                                                                        
 - /src/components/charts/PlotWrapper.tsx                                                                                           
 - /src/components/charts/InteractiveBarChart.module.css                                                                            
 - /src/components/charts/MosaicBarChart.module.css                                                                                 
                                                                                                                                    
 Files to Modify                                                                                                                    
                                                                                                                                    
 /src/components/charts/index.ts - Remove legacy exports:                                                                           
 // Remove these lines (23-39)                                                                                                      
 export { PlotWrapper } from './PlotWrapper';                                                                                       
 export type { PlotWrapperProps } from './PlotWrapper';                                                                             
 export { InteractiveBarChart } from './InteractiveBarChart';                                                                       
 export type { InteractiveBarChartProps, BarClickEvent } from './InteractiveBarChart';                                              
 export { MosaicBarChart } from './MosaicBarChart';                                                                                 
 export type { MosaicBarChartProps, MosaicBarDatum, MosaicSelectionEvent } from './MosaicBarChart';                                 
                                                                                                                                    
 package.json - Remove dependencies:                                                                                                
 - @observablehq/plot                                                                                                               
 - @uwdata/mosaic-core                                                                                                              
 - @uwdata/mosaic-plot                                                                                                              
 - @uwdata/mosaic-sql                                                                                                               
 - @uwdata/vgplot                                                                                                                   
                                                                                                                                    
 ---                                                                                                                                
 Phase 2: Chart System Architecture                                                                                                 
                                                                                                                                    
 Goal: Build a flexible chart system that auto-selects visualization types and allows user switching.                               
                                                                                                                                    
 New Files                                                                                                                          
                                                                                                                                    
 /src/types/charts.ts - Chart type definitions                                                                                      
 export type ChartType =                                                                                                            
   | 'horizontal-bar' | 'vertical-bar' | 'grouped-bar'                                                                              
   | 'stacked-bar-100' | 'diverging-bar' | 'donut'                                                                                  
   | 'histogram' | 'box-plot' | 'scatter' | 'lollipop';                                                                             
                                                                                                                                    
 export interface ChartRecommendation {                                                                                             
   default: ChartType;                                                                                                              
   alternatives: ChartType[];                                                                                                       
   reason: string;                                                                                                                  
 }                                                                                                                                  
                                                                                                                                    
 /src/services/chartRecommender.ts - Auto-selection logic                                                                           
 - Analyzes: row variable type, column presence, variable set structure, metric mode                                                
 - Returns default + 2-4 curated alternatives                                                                                       
                                                                                                                                    
 /src/components/charts/AnalysisChart.tsx - Main wrapper                                                                            
 - Receives AggregatedRow[] and ChartType                                                                                           
 - Delegates to appropriate D3 renderer                                                                                             
 - Handles common concerns: dimensions, legends, drill-down, Visual ETL                                                             
                                                                                                                                    
 /src/components/charts/ChartSelector.tsx - Type picker UI                                                                          
 - Shows icons for available chart types in header                                                                                  
 - Tooltip explains each type                                                                                                       
                                                                                                                                    
 Chart Renderers (Priority Order)                                                                                                   
                                                                                                                                    
 P0 (Core):                                                                                                                         
 - /src/components/charts/renderers/HorizontalBarRenderer.tsx - Single variable frequency                                           
 - /src/components/charts/renderers/StackedBarRenderer.tsx - Grids, cross-tabs                                                      
 - /src/components/charts/renderers/DivergingBarRenderer.tsx - Likert scales                                                        
 - Adapt existing D3Histogram.tsx for scale variables                                                                               
                                                                                                                                    
 P1:                                                                                                                                
 - /src/components/charts/renderers/GroupedBarRenderer.tsx - Nominal × Nominal                                                      
 - /src/components/charts/renderers/DonutRenderer.tsx - Simple frequencies                                                          
                                                                                                                                    
 P2/P3 (Future):                                                                                                                    
 - Box plots, scatterplots, etc.                                                                                                    
                                                                                                                                    
 Shared Utilities                                                                                                                   
                                                                                                                                    
 /src/components/charts/shared/                                                                                                     
 - chartColors.ts - Design system palette (terracotta-based)                                                                        
 - ChartTooltip.tsx - Shared tooltip                                                                                                
 - ChartLegend.tsx - Shared legend                                                                                                  
                                                                                                                                    
 ---                                                                                                                                
 Phase 3: Visual ETL on Canvas                                                                                                      
                                                                                                                                    
 Goal: Enable direct manipulation for recoding on charts (per research_08 Section 5.1, 6.2).                                        
                                                                                                                                    
 Interactions to Implement                                                                                                          
                                                                                                                                    
 1. Drag-to-Merge (bars in single-variable charts):                                                                                 
   - Drag "Strongly Agree" bar onto "Agree" bar                                                                                     
   - Creates recode group, triggers InputModal for naming                                                                           
   - Visual feedback: drop target highlight, merge animation                                                                        
 2. Click-to-Filter/Exclude (context menu):                                                                                         
   - Right-click any bar/segment                                                                                                    
   - Menu: "Filter to this value" | "Exclude this value" | "Create Group..."                                                        
   - Updates global filter in store                                                                                                 
 3. Drill-Down (existing):                                                                                                          
   - Click segment → X-Ray drawer with raw records                                                                                  
                                                                                                                                    
 Files to Modify                                                                                                                    
                                                                                                                                    
 - /src/components/charts/AnalysisChart.tsx - Visual ETL event handling                                                             
 - /src/store/slices/analysisSlice.ts - Add filter actions for Visual ETL                                                           
 - /src/store/slices/uiSlice.ts - Add selectedChartType state                                                                       
                                                                                                                                    
 New Files                                                                                                                          
                                                                                                                                    
 - /src/components/overlays/ChartContextMenu.tsx - Unified context menu                                                             
                                                                                                                                    
 ---                                                                                                                                
 Phase 4: Integration & Polish                                                                                                      
                                                                                                                                    
 DataTable.tsx Updates (lines 529-606)                                                                                              
                                                                                                                                    
 Replace CSS-based chart mode:                                                                                                      
 // Before: Framer Motion with Tailwind (bg-indigo-500, etc.)                                                                       
 // After: <AnalysisChart data={chartData} chartType={selectedChartType} ... />                                                     
                                                                                                                                    
 Transform tableData.rows → chart renderer format based on:                                                                         
 - Row variable type (nominal/ordinal/scale)                                                                                        
 - Column variable presence                                                                                                         
 - VariableSet structure (single/grid/multiple)                                                                                     
                                                                                                                                    
 State Management                                                                                                                   
                                                                                                                                    
 Add to uiSlice.ts:                                                                                                                 
 selectedChartType: ChartType | null;  // null = auto-select default                                                                
 setSelectedChartType: (type: ChartType | null) => void;                                                                            
                                                                                                                                    
 Color Palette (Design System)                                                                                                      
                                                                                                                                    
 Replace Tailwind classes with CSS variables:                                                                                       
 const CHART_PALETTE = [                                                                                                            
   'var(--color-terracotta)',   // #E07A5F                                                                                          
   'var(--color-success)',      // #52796F                                                                                          
   'var(--color-warning)',      // #F4A261                                                                                          
   'var(--color-info)',         // #84A59D                                                                                          
   'var(--gray-600)',           // #57534E                                                                                          
 ];                                                                                                                                 
                                                                                                                                    
 ---                                                                                                                                
 Verification                                                                                                                       
                                                                                                                                    
 After implementation:                                                                                                              
 1. npm run build - No errors                                                                                                       
 2. npm run test:run - Tests pass                                                                                                   
 3. Manual testing with SAV file:                                                                                                   
   - Single nominal variable → Horizontal bar (ranked)                                                                              
   - Ordinal variable → Ordered bar or diverging bar                                                                                
   - Grid variable set → Stacked bar per statement                                                                                  
   - Cross-tab (nominal × nominal) → Grouped bar                                                                                    
   - Scale variable → Histogram                                                                                                     
   - Visual ETL: Drag bars to merge, right-click to filter                                                                          
                                                                                                                                    
 ---                                                                                                                                
 Files Summary (Updated for Path C)                                                                                                 
                                                                                                                                    
 Phase 1: Legacy Cleanup                                                                                                            
 ┌────────┬───────────────────────────────────────────────────────┐                                                                 
 │ Action │                         File                          │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ DELETE │ /src/components/charts/InteractiveBarChart.tsx        │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ DELETE │ /src/components/charts/MosaicBarChart.tsx             │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ DELETE │ /src/components/charts/PlotWrapper.tsx                │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ DELETE │ /src/components/charts/InteractiveBarChart.module.css │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ DELETE │ /src/components/charts/MosaicBarChart.module.css      │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ MODIFY │ /src/components/charts/index.ts                       │                                                                 
 ├────────┼───────────────────────────────────────────────────────┤                                                                 
 │ MODIFY │ /package.json                                         │                                                                 
 └────────┴───────────────────────────────────────────────────────┘                                                                 
 Phase 2: Core Chart System                                                                                                         
 ┌────────┬────────────────────────────────────────────────────────────┐                                                            
 │ Action │                            File                            │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/types/charts.ts                                       │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/services/chartRecommender.ts                          │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/AnalysisChart.tsx                   │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/AnalysisChart.module.css            │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/ChartSelector.tsx                   │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/ChartSelector.module.css            │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/renderers/HorizontalBarRenderer.tsx │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/renderers/StackedBarRenderer.tsx    │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/renderers/index.ts                  │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/shared/chartColors.ts               │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/shared/ChartTooltip.tsx             │                                                            
 ├────────┼────────────────────────────────────────────────────────────┤                                                            
 │ CREATE │ /src/components/charts/shared/ChartLegend.tsx              │                                                            
 └────────┴────────────────────────────────────────────────────────────┘                                                            
 Phase 2.5: Slide Foundation                                                                                                        
 ┌──────────┬─────────────────────────────────────────────────────────────────────────────┐                                         
 │  Action  │                                    File                                     │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ CREATE   │ /src/types/slides.ts                                                        │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ CREATE   │ /src/store/slices/slidesSlice.ts                                            │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ CREATE   │ /src/features/dashboard/components/SlideContainer.tsx                       │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ CREATE   │ /src/features/dashboard/components/SlideContainer.module.css                │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ REFACTOR │ /src/features/dashboard/components/DataTable.tsx → embeds in SlideContainer │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ MODIFY   │ /src/store/slices/uiSlice.ts                                                │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ MODIFY   │ /src/store/slices/analysisSlice.ts                                          │                                         
 ├──────────┼─────────────────────────────────────────────────────────────────────────────┤                                         
 │ MODIFY   │ /src/store/index.ts (add slidesSlice)                                       │                                         
 └──────────┴─────────────────────────────────────────────────────────────────────────────┘                                         
 Phase 3: Visual ETL                                                                                                                
 ┌────────┬─────────────────────────────────────────────────────────────────────────┐                                               
 │ Action │                                  File                                   │                                               
 ├────────┼─────────────────────────────────────────────────────────────────────────┤                                               
 │ CREATE │ /src/components/overlays/ChartContextMenu.tsx                           │                                               
 ├────────┼─────────────────────────────────────────────────────────────────────────┤                                               
 │ CREATE │ /src/components/overlays/ChartContextMenu.module.css                    │                                               
 ├────────┼─────────────────────────────────────────────────────────────────────────┤                                               
 │ MODIFY │ /src/components/charts/AnalysisChart.tsx (add drag-merge, context menu) │                                               
 └────────┴─────────────────────────────────────────────────────────────────────────┘                                               
 Phase 4: Additional Renderers + Multi-Slide (Future)                                                                               
 ┌────────┬───────────────────────────────────────────────────────────┐                                                             
 │ Action │                           File                            │                                                             
 ├────────┼───────────────────────────────────────────────────────────┤                                                             
 │ CREATE │ /src/components/charts/renderers/DivergingBarRenderer.tsx │                                                             
 ├────────┼───────────────────────────────────────────────────────────┤                                                             
 │ CREATE │ /src/components/charts/renderers/GroupedBarRenderer.tsx   │                                                             
 ├────────┼───────────────────────────────────────────────────────────┤                                                             
 │ CREATE │ /src/components/charts/renderers/DonutRenderer.tsx        │                                                             
 ├────────┼───────────────────────────────────────────────────────────┤                                                             
 │ CREATE │ /src/features/dashboard/components/SlideStrip.tsx         │                                                             
 ├────────┼───────────────────────────────────────────────────────────┤                                                             
 │ CREATE │ /src/features/dashboard/components/GridLayout.tsx         │                                                             
 └────────┴───────────────────────────────────────────────────────────┘                                                             
 ---                                                                                                                                
 Implementation Order (Revised for Path C)                                                                                          
                                                                                                                                    
 1. Phase 1: Legacy cleanup (delete files, remove deps)                                                                             
 2. Phase 2: Core chart system (types, recommender, AnalysisChart, HorizontalBar + StackedBar)                                      
 3. Phase 2.5: Slide foundation (types, slidesSlice, SlideContainer with Focus mode)                                                
 4. Phase 3: Visual ETL (drag-merge, context menu)                                                                                  
 5. Phase 4: Additional renderers + Multi-slide navigation (Future milestone)                                                       
 6. Phase 5: Grid/Comparison layouts + PPTX prep (Future milestone)                                                                 
                                                                                                                                    
 Milestone 2.4 Scope: Phases 1-3 + basic Phase 2.5 (single slide, Focus mode only)                                                  
                                                                                                                                    
 ---                                                                                                                                
 Appendix: Canvas Layout Architecture Decision                                                                                      
                                                                                                                                    
 The Question                                                                                                                       
                                                                                                                                    
 Before building the visualization library, we must decide how charts/tables are arranged on the Analysis Canvas. This affects:     
 - How D3 charts are sized/positioned                                                                                               
 - What container system wraps them                                                                                                 
 - Future multi-visualization layouts                                                                                               
                                                                                                                                    
 Research Summary                                                                                                                   
                                                                                                                                    
 How Competitors Handle This                                                                                                        
 ┌────────────┬────────────────────────────────────┬───────────────────────────┬──────────────────────────────┐                     
 │    Tool    │              Approach              │           Pros            │             Cons             │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ Displayr   │ Free-form single screen            │ Flexible, PowerPoint-like │ Cluttered with 100+ charts   │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ Crunch.io  │ Single viz focus, dashboard tiles  │ Clean, focused            │ Limited multi-viz comparison │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ Tableau    │ Tiled containers + floating        │ Best of both worlds       │ Complex learning curve       │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ PowerBI    │ Grid snap with smart guides        │ Fast alignment            │ Less precise than Tableau    │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ Sigma      │ Strict grid modules                │ Clean, 99% of use cases   │ Less flexible                │                     
 ├────────────┼────────────────────────────────────┼───────────────────────────┼──────────────────────────────┤                     
 │ QuickSight │ 3 modes: Tiled, Free-form, Classic │ Choice per dashboard      │ Context switching            │                     
 └────────────┴────────────────────────────────────┴───────────────────────────┴──────────────────────────────┘                     
 Sources: https://www.displayr.com/dashboarding/, https://crunch.io/visualization/,                                                 
 https://dataveld.com/2018/12/12/tableau-to-power-bi-dashboard-layout-size/                                                         
                                                                                                                                    
 Current Velocity State                                                                                                             
                                                                                                                                    
 From design_02_ux_modes.md:                                                                                                        
 - Variable Manager (Mode A): "Infinite Canvas with Cards" (Miro style)                                                             
 - Analysis Canvas (Mode B): "Dashboard/Slide Editor" (PowerPoint/Tableau style)                                                    
                                                                                                                                    
 Current implementation: Fixed single-table view with shelves. No multi-visualization support.                                      
                                                                                                                                    
 ---                                                                                                                                
 Three Paths Forward                                                                                                                
                                                                                                                                    
 Path A: Single Focus (Current + Enhanced)                                                                                          
                                                                                                                                    
 Description: Keep the current single-table focus but make charts/tables interchangeable. One visualization at a time, like a       
 "magnified view."                                                                                                                  
                                                                                                                                    
 Implementation:                                                                                                                    
 - Chart fills the main content area                                                                                                
 - Shelves (row/column/filter) remain as configuration UI                                                                           
 - viewMode toggle switches between table/chart views of same data                                                                  
                                                                                                                                    
 Pros:                                                                                                                              
 - Minimal architecture change                                                                                                      
 - Fast to build                                                                                                                    
 - Clean, focused UX (no clutter)                                                                                                   
 - Aligns with "Harvesting" mode philosophy                                                                                         
                                                                                                                                    
 Cons:                                                                                                                              
 - Can't compare multiple visualizations side-by-side                                                                               
 - Limited for complex dashboards                                                                                                   
 - Users may expect multi-viz capability                                                                                            
                                                                                                                                    
 Best for: MVP, rapid iteration, survey analysis where focus > breadth                                                              
                                                                                                                                    
 ---                                                                                                                                
 Path B: Grid-Based Dashboard                                                                                                       
                                                                                                                                    
 Description: Add a grid system where users can add multiple visualization "cards" that snap to a modular layout.                   
                                                                                                                                    
 Implementation:                                                                                                                    
 - CSS Grid or library (react-grid-layout)                                                                                          
 - Each card contains one AnalysisChart                                                                                             
 - Cards can be resized within grid constraints                                                                                     
 - Add/remove cards, reorder via drag-drop                                                                                          
                                                                                                                                    
 Pros:                                                                                                                              
 - Professional dashboard look                                                                                                      
 - Multi-viz comparison                                                                                                             
 - Responsive layout built-in                                                                                                       
 - Common pattern users understand                                                                                                  
                                                                                                                                    
 Cons:                                                                                                                              
 - Significant architecture change                                                                                                  
 - Need card management UI (add/delete/resize)                                                                                      
 - State complexity (multiple configs)                                                                                              
 - May not fit "Single Focus" analysis workflow                                                                                     
                                                                                                                                    
 Best for: Report-building, client-facing dashboards                                                                                
                                                                                                                                    
 ---                                                                                                                                
 Path C: Hybrid Slide + Focus                                                                                                       
                                                                                                                                    
 Description: Analysis Canvas has a "slide deck" metaphor. Each slide can be table OR chart OR dashboard. Like Displayr's page      
 system.                                                                                                                            
                                                                                                                                    
 Implementation:                                                                                                                    
 - Page/slide navigation in sidebar or bottom strip                                                                                 
 - Each slide has its own layout mode:                                                                                              
   - "Focus": Single visualization (Path A)                                                                                         
   - "Dashboard": Grid layout (Path B)                                                                                              
   - "Comparison": Side-by-side (predefined)                                                                                        
 - Slides can be exported as PPTX pages                                                                                             
                                                                                                                                    
 Pros:                                                                                                                              
 - Maximum flexibility                                                                                                              
 - Maps to PowerPoint export workflow                                                                                               
 - Users choose complexity level                                                                                                    
 - Progressive disclosure                                                                                                           
                                                                                                                                    
 Cons:                                                                                                                              
 - Most complex to build                                                                                                            
 - Multi-page state management                                                                                                      
 - Higher learning curve                                                                                                            
 - Scope creep risk                                                                                                                 
                                                                                                                                    
 Best for: Full reporting suite, PowerPoint-first workflows                                                                         
                                                                                                                                    
 ---                                                                                                                                
 Critical Assessment                                                                                                                
                                                                                                                                    
 For Milestone 2.4 (Chart View)                                                                                                     
                                                                                                                                    
 Recommendation: Start with Path A (Single Focus)                                                                                   
                                                                                                                                    
 Rationale:                                                                                                                         
 1. Scope Control: Building grid/slide systems is a separate milestone                                                              
 2. User Flow: Survey analysts typically focus on one question at a time                                                            
 3. Visual ETL First: Drag-to-merge needs solid single-chart interaction before multi-chart                                         
 4. Iteration Speed: Can ship chart view quickly, gather feedback                                                                   
                                                                                                                                    
 For Future (Milestone 2.6+ PowerPoint Export)                                                                                      
                                                                                                                                    
 Consider Path C (Hybrid Slide + Focus)                                                                                             
                                                                                                                                    
 Rationale:                                                                                                                         
 1. PPTX Alignment: Slide metaphor maps directly to export                                                                          
 2. Progressive Complexity: Users start with Focus, graduate to Dashboard                                                           
 3. Displayr Parity: Competitors offer multi-page reports                                                                           
                                                                                                                                    
 ---                                                                                                                                
 Decision: Path C Selected (Hybrid Slide System)                                                                                    
                                                                                                                                    
 User confirmed: Build a slide deck metaphor with per-slide layout modes.                                                           
                                                                                                                                    
 ---                                                                                                                                
 Revised Architecture for Path C                                                                                                    
                                                                                                                                    
 Slide System Concepts                                                                                                              
                                                                                                                                    
 AnalysisCanvas                                                                                                                     
 ├── SlideStrip (bottom/side navigation)                                                                                            
 │   ├── Slide 1: "Brand Awareness" (Focus mode)                                                                                    
 │   ├── Slide 2: "Demographics Dashboard" (Grid mode)                                                                              
 │   └── Slide 3: "Key Findings" (Comparison mode)                                                                                  
 ├── ActiveSlide                                                                                                                    
 │   ├── Layout Container (mode-dependent)                                                                                          
 │   │   ├── Focus: Single AnalysisChart filling space                                                                              
 │   │   ├── Grid: Multiple AnalysisCharts in grid cells                                                                            
 │   │   └── Comparison: Side-by-side predefined layout                                                                             
 │   └── Shelves (Row/Column/Filter config)                                                                                         
 └── SlideInspector (slide settings, export options)                                                                                
                                                                                                                                    
 Slide Layout Modes                                                                                                                 
 ┌───────────────────────┬─────────────────────────────────┬───────────────────────────┐                                            
 │         Mode          │           Description           │         Use Case          │                                            
 ├───────────────────────┼─────────────────────────────────┼───────────────────────────┤                                            
 │ Focus                 │ Single viz fills canvas         │ Deep-dive on one question │                                            
 ├───────────────────────┼─────────────────────────────────┼───────────────────────────┤                                            
 │ Grid (2x2, 3x2, etc.) │ Multiple vizs in fixed grid     │ Dashboard overview        │                                            
 ├───────────────────────┼─────────────────────────────────┼───────────────────────────┤                                            
 │ Comparison            │ Side-by-side (horizontal split) │ A/B testing, pre/post     │                                            
 ├───────────────────────┼─────────────────────────────────┼───────────────────────────┤                                            
 │ Freeform              │ Drag-anywhere positioning       │ Custom layouts            │                                            
 └───────────────────────┴─────────────────────────────────┴───────────────────────────┘                                            
 State Model                                                                                                                        
                                                                                                                                    
 // src/types/slides.ts                                                                                                             
                                                                                                                                    
 interface Slide {                                                                                                                  
   id: string;                                                                                                                      
   title: string;                                                                                                                   
   layoutMode: 'focus' | 'grid' | 'comparison' | 'freeform';                                                                        
   gridConfig?: { rows: number; cols: number };                                                                                     
   cells: SlideCell[];  // Visualization slots                                                                                      
 }                                                                                                                                  
                                                                                                                                    
 interface SlideCell {                                                                                                              
   id: string;                                                                                                                      
   position: { row: number; col: number } | { x: number; y: number };                                                               
   size: { width: number; height: number };                                                                                         
   content: {                                                                                                                       
     type: 'chart' | 'table' | 'text' | 'empty';                                                                                    
     chartType?: ChartType;                                                                                                         
     tableConfig?: TableConfig;                                                                                                     
   };                                                                                                                               
 }                                                                                                                                  
                                                                                                                                    
 // Store slice                                                                                                                     
 interface SlidesState {                                                                                                            
   slides: Slide[];                                                                                                                 
   activeSlideId: string;                                                                                                           
   // ... actions                                                                                                                   
 }                                                                                                                                  
                                                                                                                                    
 ---                                                                                                                                
 Phased Implementation (Revised)                                                                                                    
                                                                                                                                    
 Phase 1: Legacy Cleanup (unchanged)                                                                                                
                                                                                                                                    
 Delete deprecated chart components and dependencies.                                                                               
                                                                                                                                    
 Phase 2: Core Chart System (unchanged)                                                                                             
                                                                                                                                    
 Build chart types, recommender, renderers - but design for embedding in any container.                                             
                                                                                                                                    
 Phase 2.5: Slide Foundation (NEW)                                                                                                  
                                                                                                                                    
 Goal: Basic slide infrastructure that supports future expansion.                                                                   
                                                                                                                                    
 Minimal Viable Slides:                                                                                                             
 - Single slide (default) with Focus mode only                                                                                      
 - State slice for slides (even if just one)                                                                                        
 - Slide title/naming                                                                                                               
 - Container that passes dimensions to AnalysisChart                                                                                
                                                                                                                                    
 Files:                                                                                                                             
 - /src/types/slides.ts - Type definitions                                                                                          
 - /src/store/slices/slidesSlice.ts - Slide state management                                                                        
 - /src/features/dashboard/components/SlideContainer.tsx - Layout wrapper                                                           
 - Modify DataTable.tsx → rename/refactor to AnalysisView.tsx                                                                       
                                                                                                                                    
 Phase 3: Visual ETL on Canvas (unchanged)                                                                                          
                                                                                                                                    
 Drag-to-merge, click-to-filter on charts.                                                                                          
                                                                                                                                    
 Phase 4: Multi-Slide & Grid Layouts                                                                                                
                                                                                                                                    
 Goal: Full slide system with multiple layout modes.                                                                                
                                                                                                                                    
 Files:                                                                                                                             
 - /src/features/dashboard/components/SlideStrip.tsx - Navigation                                                                   
 - /src/features/dashboard/components/GridLayout.tsx - Grid mode                                                                    
 - /src/features/dashboard/components/ComparisonLayout.tsx - Side-by-side                                                           
 - /src/features/dashboard/components/SlideInspector.tsx - Settings panel                                                           
                                                                                                                                    
 Phase 5: Polish & Export Prep                                                                                                      
                                                                                                                                    
 - Slide thumbnails in strip                                                                                                        
 - Export slide as image                                                                                                            
 - Prep for PPTX export (Milestone 2.6)                                                                                             
                                                                                                                                    
 ---                                                                                                                                
 Key Design Decisions for Path C                                                                                                    
                                                                                                                                    
 1. Charts are container-agnostic: Renderers receive width/height props, don't assume their parent                                  
 2. TableConfig is per-cell, not global: Each visualization has its own configuration                                               
 3. Layout modes are pluggable: SlideContainer renders different layouts based on mode                                              
 4. Slide state is normalized: Slides array with activeSlideId, cells reference by position                                         
                                                                                                                                    
 ---                                                                                                                                
 Impact on Current Files                                                                                                            
 ┌──────────────────┬───────────────────────────────────────────────────────────────┐                                               
 │       File       │                            Change                             │                                               
 ├──────────────────┼───────────────────────────────────────────────────────────────┤                                               
 │ DataTable.tsx    │ Refactor to AnalysisView.tsx, becomes child of SlideContainer │                                               
 ├──────────────────┼───────────────────────────────────────────────────────────────┤                                               
 │ uiSlice.ts       │ Move viewMode to slidesSlice, add slide-related state         │                                               
 ├──────────────────┼───────────────────────────────────────────────────────────────┤                                               
 │ analysisSlice.ts │ TableConfig becomes per-cell, not global                      │                                               
 ├──────────────────┼───────────────────────────────────────────────────────────────┤                                               
 │ App.tsx          │ Render SlideContainer instead of direct DataTable             │                                               
 └──────────────────┴───────────────────────────────────────────────────────────────┘                                               
 ---                                                                                                                                
 Verification (Updated)                                                                                                             
                                                                                                                                    
 After implementation:                                                                                                              
 1. npm run build - No errors                                                                                                       
 2. npm run test:run - Tests pass                                                                                                   
 3. Manual testing:                                                                                                                 
   - Create default slide (Focus mode)                                                                                              
   - Toggle between table/chart views                                                                                               
   - Visual ETL works on charts                                                                                                     
   - Future: Add second slide, switch between them                                                                                  
   - Future: Change slide to Grid mode, add multiple charts 