import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Table, RotateCcw, X, CheckCircle2, Search, Filter, BarChart3, LayoutGrid, Loader2, Users, Wifi, AlertCircle } from 'lucide-react';

import { MOCK_DATASET } from './constants';
import { DraggableVariable } from './components/DraggableVariable';
import { DropZone } from './components/DropZone';
import { DataTable } from './components/DataTable';
import { CollaboratorCursor } from './components/CollaboratorCursor';
import { AvatarGroup } from './components/AvatarGroup';
import { DataDrawer } from './components/DataDrawer';
import { RecodeModal } from './components/RecodeModal';
import { TableConfig, AggregatedRow, Variable, Collaborator } from './types';
import { dbService } from './services/duckDb';
// import { simService } from './services/simulation'; // Removed simulation service

// App Modes
type AppMode = 'splash' | 'uploading' | 'dashboard';
type ViewMode = 'table' | 'chart';

export default function App() {
  const [mode, setMode] = useState<AppMode>('splash');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isDbReady, setIsDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data State
  const [variables, setVariables] = useState<Variable[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [totalRows, setTotalRows] = useState(0);

  // Analysis State
  const [tableConfig, setTableConfig] = useState<TableConfig>({
    rowVar: null,
    colVar: null
  });
  const [queryResult, setQueryResult] = useState<AggregatedRow[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);

  // X-Ray (Drill Down) State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');

  // Recode State
  const [recodeModalOpen, setRecodeModalOpen] = useState(false);
  const [variableToRecode, setVariableToRecode] = useState<Variable | null>(null);

  // Collaboration State (Reserved for future expansion)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]); 
  
  // -- INIT DUCKDB --
  useEffect(() => {
    const init = async () => {
      try {
        await dbService.init();
        setIsDbReady(true);
      } catch (e: any) {
        console.error("Failed to init DB:", e);
        setInitError(e.message || "Failed to initialize DuckDB");
      }
    };
    init();
  }, []);

  // -- HELPER: REFRESH SCHEMA --
  const refreshVariables = async () => {
    const schema = await dbService.getTableSchema();
    const newVariables: Variable[] = schema.map(col => ({
       id: col.name,
       label: col.name.replace(/_/g, ' '),
       type: col.type === 'VARCHAR' ? 'categorical' : 'numeric' 
    }));
    setVariables(newVariables);
  };

  // -- HELPER: CONVERT MOCK TO CSV (For Demo) --
  const loadMockData = async () => {
    // Convert MOCK_DATASET to CSV string
    if (MOCK_DATASET.data.length === 0) return;
    const headers = Object.keys(MOCK_DATASET.data[0]);
    const csvRows = [
        headers.join(','),
        ...MOCK_DATASET.data.map(row => headers.map(fieldName => `"${row[fieldName]}"`).join(','))
    ];
    const csvContent = csvRows.join('\n');
    
    await dbService.loadCSV('mock_data.csv', csvContent);
    setVariables(MOCK_DATASET.variables);
    setFilename('Mock_Data_v2.sav');
    setTotalRows(MOCK_DATASET.data.length);
    setMode('dashboard');
  };

  // -- LOGIC: UPLOAD --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMode('uploading');
    
    try {
      const text = await file.text();
      await dbService.loadCSV(file.name, text);
      await refreshVariables();

      setFilename(file.name);
      // Get count
      const countRes = await dbService.runQuery('SELECT COUNT(*) as c FROM main');
      setTotalRows(Number(countRes[0].c));

      setMode('dashboard');
    } catch (err) {
      console.error(err);
      alert("Error loading file. Check console.");
      setMode('splash');
    }
  };

  const handleDemoClick = () => {
     setMode('uploading');
     setTimeout(() => {
        loadMockData();
     }, 800);
  };

  // -- QUERY EXECUTION --
  useEffect(() => {
    const runAnalysis = async () => {
      if (!tableConfig.rowVar) {
         setQueryResult([]);
         return;
      }
      
      setIsQuerying(true);
      try {
         const row = tableConfig.rowVar;
         const col = tableConfig.colVar;
         let sql = '';

         if (col) {
            // Crosstab Query
            sql = `SELECT "${row}" as rowKey, "${col}" as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "${row}", "${col}"`;
         } else {
            // Frequency Query
            sql = `SELECT "${row}" as rowKey, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "${row}"`;
         }

         const result = await dbService.runQuery(sql);
         setQueryResult(result as AggregatedRow[]);
      } catch (e) {
         console.error("Query failed", e);
      } finally {
         setIsQuerying(false);
      }
    };

    runAnalysis();
  }, [tableConfig]);


  // -- DRILL DOWN (X-RAY) LOGIC --
  const handleCellClick = async (rowValue: string, colValue: string | null) => {
    if (!tableConfig.rowVar) return;

    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerData([]);
    
    const rowVarLabel = variables.find(v => v.id === tableConfig.rowVar)?.label;
    
    let whereClause = `"${tableConfig.rowVar}" = '${rowValue}'`;
    let titleDescription = `${rowVarLabel}: ${rowValue}`;

    if (tableConfig.colVar && colValue) {
      const colVarLabel = variables.find(v => v.id === tableConfig.colVar)?.label;
      whereClause += ` AND "${tableConfig.colVar}" = '${colValue}'`;
      titleDescription += ` • ${colVarLabel}: ${colValue}`;
    }

    setDrawerTitle(titleDescription);

    try {
      const sql = `SELECT * FROM main WHERE ${whereClause} LIMIT 100`;
      const result = await dbService.runQuery(sql);
      setDrawerData(result);
    } catch (error) {
      console.error("Drill down failed", error);
    } finally {
      setDrawerLoading(false);
    }
  };

  // -- RECODE LOGIC --
  const handleRecodeClick = (variable: Variable) => {
    setVariableToRecode(variable);
    setRecodeModalOpen(true);
  };

  const handleRecodeComplete = async () => {
     await refreshVariables();
  };

  // -- LOGIC: DRAG & DROP --
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
    if (!draggingId) return;

    // Get the element under the cursor
    const point = info.point;
    const elemBelow = document.elementFromPoint(point.x, point.y);
    
    const dropZone = elemBelow?.closest('[id^="drop-zone-"]');
    
    if (dropZone) {
      const zoneId = dropZone.id;
      if (zoneId === 'drop-zone-rows') {
        setTableConfig(prev => ({ ...prev, rowVar: draggingId }));
      } else if (zoneId === 'drop-zone-cols') {
        setTableConfig(prev => ({ ...prev, colVar: draggingId }));
      }
    }

    setDraggingId(null);
  };

  // Filter variables based on search
  const filteredVariables = variables.filter(v => 
    v.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen bg-white text-slate-800 antialiased overflow-hidden flex flex-col ${draggingId ? 'select-none cursor-grabbing' : ''}`}>
      
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
      
      {/* MODALS */}
      <DataDrawer 
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerTitle}
        data={drawerData}
        loading={drawerLoading}
      />

      <RecodeModal 
         isOpen={recodeModalOpen}
         onClose={() => setRecodeModalOpen(false)}
         variable={variableToRecode}
         onSave={handleRecodeComplete}
      />

      {/* GLOBAL PROGRESS BAR */}
      <AnimatePresence>
        {mode === 'uploading' && (
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="fixed top-0 left-0 h-1 bg-indigo-600 z-50 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
          />
        )}
      </AnimatePresence>

      {/* SPLASH SCREEN */}
      <AnimatePresence>
        {mode === 'splash' && (
          <motion.div 
            exit={{ opacity: 0, y: -20, pointerEvents: 'none' }}
            className="fixed inset-0 flex items-center justify-center bg-white z-40"
          >
            <div className="text-center space-y-8 max-w-md w-full px-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Velocity.</h1>
                <p className="text-slate-500 text-lg">The zero-latency research dashboard.</p>
                
                {initError ? (
                  <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-2 rounded-md">
                    <AlertCircle size={16} />
                    <span>{initError}</span>
                  </div>
                ) : (
                  !isDbReady && <p className="text-xs text-indigo-500 animate-pulse">Initializing DuckDB Engine...</p>
                )}
              </div>

              <motion.button 
                onClick={() => isDbReady && fileInputRef.current?.click()}
                disabled={!isDbReady}
                whileHover={{ scale: 1.02, borderColor: '#4F46E5', backgroundColor: '#EEF2FF' }}
                whileTap={{ scale: 0.98 }}
                className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all cursor-pointer bg-gray-50/30
                  ${isDbReady ? 'border-gray-300' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}
              >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                  {isDbReady ? <FileUp className="w-8 h-8 text-indigo-500" /> : <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-700">Drop CSV file to analyze</p>
                  <p className="text-sm text-slate-400">
                     <span className="hover:text-indigo-600 hover:underline z-50 relative" onClick={(e) => { e.stopPropagation(); handleDemoClick(); }}>
                        or use example data
                     </span>
                  </p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASHBOARD */}
      {mode === 'dashboard' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-screen"
        >
          {/* CURSOR OVERLAY (Currently Inactive - Reserved for V2) */}
          <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
            {collaborators.map(user => (
              <CollaboratorCursor key={user.id} user={user} />
            ))}
          </div>

          {/* SIDEBAR */}
          <aside className="w-72 bg-gray-50/50 border-r border-gray-200 flex flex-col shrink-0 z-30 relative">
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">V</span>
                </div>
                <span className="font-semibold text-slate-800 tracking-tight">Velocity</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search variables..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 border-none rounded-md text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            <div className={`flex-1 p-3 custom-scrollbar ${draggingId ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                Survey Questions
              </p>
              <div className="space-y-1">
                {filteredVariables.map(variable => (
                  <DraggableVariable 
                    key={variable.id} 
                    variable={variable} 
                    onDragStart={setDraggingId}
                    onDragEnd={handleDragEnd}
                    onRecode={handleRecodeClick}
                  />
                ))}
              </div>
            </div>
            
            <div className="p-3 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-3 text-xs text-gray-500 px-2">
                 <CheckCircle2 size={12} className="text-green-500" />
                 <span>{filename} ({totalRows} rows)</span>
              </div>
            </div>
          </aside>

          {/* MAIN CANVAS */}
          <main className="flex-1 flex flex-col bg-white relative overflow-hidden z-0">
            {/* HEADER */}
            <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-10">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Analysis</span>
                <span>/</span>
                <span className="text-gray-900 font-medium">Untitled Crosstab</span>
              </div>

              <div className="flex items-center gap-6">
                
                {/* COLLABORATORS (Future) */}
                <AvatarGroup users={collaborators} />

                <div className="h-4 w-px bg-gray-200"></div>

                <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Table size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('chart')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>
                
                <button 
                  onClick={() => setTableConfig({ rowVar: null, colVar: null })}
                  className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            </header>

            {/* FILTER BAR */}
            <div className="h-12 border-b border-gray-100 bg-white flex items-center px-6 gap-3 shrink-0 z-10">
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 border border-dashed border-gray-300 rounded-full hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors group">
                 <span className="text-lg leading-none font-light text-slate-400 group-hover:text-indigo-500">+</span>
                 Add Filter
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-gray-100 rounded-full border border-gray-200 group-hover:border-gray-300 transition-colors">
                <span>Gender = Female</span>
                <button className="text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 p-0.5 transition-colors">
                   <X size={12} />
                </button>
              </div>
            </div>

            {/* WORKSPACE */}
            <div className="flex-1 overflow-auto bg-[#FAFAFA] relative flex flex-col">
              <div className="w-full max-w-5xl mx-auto p-8 flex flex-col gap-6">
                
                {/* COLUMN SHELF */}
                <div className="flex gap-4 items-center pl-32">
                   <div className="w-8 flex justify-center">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider rotate-180 writing-mode-vertical">Columns</span>
                   </div>
                   <DropZone 
                      id="drop-zone-cols"
                      type="column"
                      label="Drop Column Variable"
                      active={!!draggingId}
                      currentVariable={variables.find(v => v.id === tableConfig.colVar) || null}
                      onRemove={() => setTableConfig(prev => ({ ...prev, colVar: null }))}
                   />
                </div>

                <div className="flex gap-4 items-start">
                   {/* ROW SHELF */}
                   <div className="w-32 flex flex-col items-end gap-2 pt-16">
                      <DropZone 
                        id="drop-zone-rows"
                        type="row"
                        label="Drop Row Variable"
                        active={!!draggingId}
                        currentVariable={variables.find(v => v.id === tableConfig.rowVar) || null}
                        onRemove={() => setTableConfig(prev => ({ ...prev, rowVar: null }))}
                      />
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider pr-1">Rows</span>
                   </div>

                   {/* RESULT AREA */}
                   <div className="flex-1 min-h-[400px]">
                      {tableConfig.rowVar ? (
                        <div className="relative">
                          {isQuerying && (
                             <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 className="animate-spin text-indigo-600" size={32} />
                             </div>
                          )}
                          <DataTable 
                            data={queryResult}
                            rowVariable={variables.find(v => v.id === tableConfig.rowVar)!}
                            colVariable={variables.find(v => v.id === tableConfig.colVar) || null}
                            totalCount={totalRows}
                            viewMode={viewMode}
                            onCellClick={handleCellClick}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-64 border-2 border-dashed border-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-300 gap-4 bg-white">
                          <LayoutGrid size={48} className="opacity-20" />
                          <p className="text-sm font-medium">Drag a variable to the Row shelf to start</p>
                        </div>
                      )}
                   </div>
                </div>

              </div>
            </div>
          </main>
        </motion.div>
      )}
    </div>
  );
}