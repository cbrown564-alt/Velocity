import React, { useMemo } from 'react';
import { AggregatedRow, Variable } from '../types';
import { motion } from 'framer-motion';

interface DataTableProps {
  data: AggregatedRow[]; // Now accepts SQL results
  rowVariable: Variable;
  colVariable: Variable | null;
  totalCount: number; // Passed from parent query
  viewMode?: 'table' | 'chart';
  onCellClick?: (rowValue: string, colValue: string | null) => void;
}

const CHART_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-400',
  'bg-rose-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-teal-400'
];

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  rowVariable, 
  colVariable, 
  totalCount,
  viewMode = 'table',
  onCellClick
}) => {

  const tableData = useMemo(() => {
    // 1. Extract Unique Keys
    const rowKeys = Array.from(new Set(data.map(d => d.rowKey))).sort() as string[];
    
    let colKeys: string[] = ['Total'];
    if (colVariable) {
       colKeys = Array.from(new Set(data.map(d => d.colKey))).sort() as string[];
    }

    // 2. Compute Column Totals
    const colTotals: Record<string, number> = {};
    colKeys.forEach(k => colTotals[k] = 0);
    
    let grandTotal = 0;

    // 3. Build Pivot Structure
    const rows = rowKeys.map(rKey => {
       const cells: Record<string, { count: number, percent: number, sig?: string }> = {};
       let rowTotal = 0;

       // Find all data points for this row
       const rowData = data.filter(d => d.rowKey === rKey);

       if (colVariable) {
          colKeys.forEach((cKey, idx) => {
             const match = rowData.find(d => d.colKey === cKey);
             const count = match ? match.count : 0;
             rowTotal += count;
             colTotals[cKey] += count;
             grandTotal += count;

             cells[cKey] = { count, percent: 0 }; 
          });
       } else {
          // Frequency Mode
          const match = rowData.find(d => d.colKey === 'Total');
          const count = match ? match.count : 0;
          rowTotal += count;
          colTotals['Total'] += count;
          grandTotal += count;
          cells['Total'] = { count, percent: 0 };
       }

       return {
         label: rKey,
         cells,
         total: rowTotal
       };
    });

    // 4. Calculate Percentages (Post-Aggregation)
    rows.forEach(row => {
       colKeys.forEach((cKey, idx) => {
          const cell = row.cells[cKey];
          const divisor = colVariable ? colTotals[cKey] : grandTotal; // Col % for crosstab, Total % for freq
          cell.percent = divisor > 0 ? (cell.count / divisor) * 100 : 0;

          // Add Sig Testing Mock
          if (colVariable && colKeys.length > 1 && cell.percent > 25 && Math.random() > 0.7) {
             const otherIdx = (idx + 1) % colKeys.length;
             cell.sig = String.fromCharCode(65 + otherIdx);
          }
       });
    });

    return {
      colKeys,
      rows,
      colTotals,
      grandTotal
    };

  }, [data, rowVariable, colVariable]);

  if (!tableData) return null;

  const getColLetter = (index: number) => String.fromCharCode(65 + index);

  // -- RENDER MODE: TABLE --
  if (viewMode === 'table') {
    return (
      <motion.div 
        key="table"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="w-full overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm"
      >
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-end">
          <div>
             <h3 className="text-sm font-semibold text-gray-900">
              {colVariable ? `${rowVariable.label} by ${colVariable.label}` : `${rowVariable.label} Frequency`}
             </h3>
             <p className="text-xs text-slate-500 mt-1">N = {tableData.grandTotal} Respondents</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-slate-500 uppercase bg-white border-b-2 border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-900 tracking-wider text-left w-1/4 align-bottom">
                  {rowVariable.label}
                </th>
                {tableData.colKeys.map((col, idx) => (
                  <th key={col} className="px-4 py-3 font-bold text-right w-32 align-bottom">
                    <div className="flex flex-col gap-1 items-end">
                      <span>{col}</span>
                      {colVariable && (
                          <span className="text-[10px] text-slate-400 font-normal border border-slate-200 rounded px-1 min-w-[20px] text-center">
                            {getColLetter(idx)}
                          </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 font-bold text-right w-24 text-slate-900 bg-slate-50 align-bottom">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableData.rows.map((row) => (
                <tr key={row.label} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-slate-800 align-top pt-3 group-hover:text-indigo-700">
                    {row.label}
                  </td>
                  {tableData.colKeys.map(col => {
                    const cell = row.cells[col];
                    return (
                      <td 
                        key={col} 
                        className="px-4 py-2 text-right align-top cursor-pointer relative hover:bg-indigo-100/50 transition-colors"
                        onClick={() => onCellClick?.(row.label, colVariable ? col : null)}
                        title="Click to X-Ray (Drill down)"
                      >
                         <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-0.5">
                              <span className="font-bold text-slate-700">{cell.percent.toFixed(1)}%</span>
                              {cell.sig && (
                                  <sup className="text-[10px] font-bold text-slate-900 leading-none">{cell.sig}</sup>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono tracking-tight group-hover:text-indigo-400">n={cell.count}</span>
                         </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900 bg-slate-50 align-top">
                      <div className="flex flex-col items-end">
                         <span>{((row.total / tableData.grandTotal) * 100).toFixed(1)}%</span>
                         <span className="text-[10px] text-slate-400">n={row.total}</span>
                      </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold border-t-4 border-double border-b-4 border-slate-300">
                <td className="px-4 py-3 text-slate-900">Total</td>
                {tableData.colKeys.map(col => (
                  <td key={col} className="px-4 py-3 text-right font-mono text-slate-900">
                     {tableData.colTotals[col]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono text-slate-900">
                  {tableData.grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }

  // -- RENDER MODE: CHART (STACKED BAR) --
  return (
    <motion.div 
      key="chart"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6"
    >
       <div className="mb-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{rowVariable.label} Distribution</h3>
            {colVariable && <p className="text-sm text-slate-500">Broken down by {colVariable.label}</p>}
          </div>
          
          {/* Legend */}
          {colVariable && (
            <div className="flex flex-wrap gap-3 max-w-md justify-end">
               {tableData.colKeys.map((col, idx) => (
                 <div key={col} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${CHART_COLORS[idx % CHART_COLORS.length]}`}></div>
                    <span className="text-xs font-medium text-slate-600">{col}</span>
                 </div>
               ))}
            </div>
          )}
       </div>

       <div className="space-y-6">
          {tableData.rows.map((row) => (
             <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                   <span className="font-semibold text-slate-700">{row.label}</span>
                   <span className="text-slate-400 text-xs">n={row.total}</span>
                </div>
                
                {/* 100% Stacked Bar */}
                <div className="h-8 w-full bg-gray-100 rounded-md overflow-hidden flex relative">
                   {colVariable ? (
                      tableData.colKeys.map((col, idx) => {
                         const count = row.cells[col].count;
                         const widthPct = row.total > 0 ? (count / row.total) * 100 : 0;
                         if (widthPct === 0) return null;

                         return (
                            <motion.div
                              key={col}
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                              className={`h-full ${CHART_COLORS[idx % CHART_COLORS.length]} border-r border-white/20 last:border-none flex items-center justify-center`}
                            >
                               {widthPct > 8 && (
                                 <span className="text-[10px] font-bold text-white/90 drop-shadow-md">
                                    {widthPct.toFixed(0)}%
                                 </span>
                               )}
                            </motion.div>
                         );
                      })
                   ) : (
                       <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.total / tableData.grandTotal) * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full ${CHART_COLORS[0]} rounded-r-md flex items-center justify-start pl-3`}
                        >
                           <span className="text-xs font-bold text-white/90">
                              {(row.total / tableData.grandTotal * 100).toFixed(1)}%
                           </span>
                        </motion.div>
                   )}
                </div>
             </div>
          ))}
       </div>
    </motion.div>
  );
};