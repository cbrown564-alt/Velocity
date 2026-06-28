import { ProcessedAnalysisData, ChartDataPoint, ChartSeries } from '../types/processedData';
import { ChartType } from '../types/charts';
import { hasBoxPlotStats } from '../core/visualization/chartTypeResolver';

/**
 * Transforms processed analysis data based on the active chart type.
 * Handles specialized data structures for complex charts like Diverging Bar, Violin, Scatter, etc.
 */
export const transformChartData = (
  processedData: ProcessedAnalysisData | null | undefined,
  activeChartType: ChartType,
): ProcessedAnalysisData | null => {
  if (!processedData) return null;

  // Mean-only metric crosstabs (no quartiles) → column means as vertical bars
  if (
    (activeChartType === 'grouped-box-plot' ||
      activeChartType === 'box-plot' ||
      activeChartType === 'violin' ||
      activeChartType === 'ridgeline') &&
    processedData.isMetric &&
    !hasBoxPlotStats(processedData)
  ) {
    if (processedData.rows.length === 1 && processedData.columns.length > 0) {
      const metricRow = processedData.rows[0];
      const data = processedData.columns.map((col) => ({
        label: col.label,
        rawValue: col.key,
        value: metricRow.cells[col.key]?.mean ?? 0,
        percent: 0,
      }));

      return {
        ...processedData,
        series: [
          {
            key: 'means',
            label: metricRow.label,
            data,
          },
        ],
      };
    }
  }

  if (activeChartType === 'diverging-bar') {
    // CASE 1: Single Variable (Pivot Categories to Segments)
    // If we have 1 column (Total) and multiple Rows (Categories)
    if (processedData.columns.length === 1 && processedData.rows.length > 1) {
      // Create specific columns from the rows (Scale Points)
      const newColumns = processedData.rows
        .map((r) => ({
          key: r.rawValue,
          label: r.label,
          total: r.total,
        }))
        .sort((a, b) => {
          // Try to sort numerically if keys are numbers (codes)
          const valA = parseFloat(a.key);
          const valB = parseFloat(b.key);
          if (!isNaN(valA) && !isNaN(valB)) {
            return valA - valB;
          }
          return a.key.localeCompare(b.key);
        });

      // Create a single row for the variable
      const mainVar = processedData.rowVariables[0];
      const newRow: any = {
        key: mainVar?.id || 'root',
        label: mainVar?.label || 'Distribution',
        rawValue: mainVar?.id || 'root',
        total: processedData.grandTotal,
        cells: {},
      };

      // Map counts to the new cells
      processedData.rows.forEach((r) => {
        // The cell value comes from the 'Total' column of the original row
        const originalCell = r.cells[processedData.columns[0].key];
        if (originalCell) {
          newRow.cells[r.rawValue] = originalCell;
        }
      });

      return {
        ...processedData,
        columns: newColumns,
        rows: [newRow],
        series: newColumns.map((col) => ({
          key: col.key,
          label: col.label,
          data: [
            {
              label: newRow.label,
              rawValue: newRow.rawValue,
              value: newRow.cells[col.key]?.count || 0,
              percent: newRow.cells[col.key]?.percent || 0,
              sig: newRow.cells[col.key]?.sig,
            },
          ],
        })),
      };
    }

    // CASE 2: Grid Variable (Dimensions are inverted for visualization)
    // Current: Rows = Scale Points (1..10), Columns = Items (Content, Energy...)
    // Target: Rows = Items, Segments = Scale Points
    if (processedData.columns.length > 1 && processedData.rows.length > 1) {
      // Create specific columns from the rows (Scale Points)
      const newColumns = processedData.rows
        .map((r) => ({
          key: r.rawValue,
          label: r.label,
          total: r.total,
        }))
        .sort((a, b) => {
          // Try to sort numerically if keys are numbers (codes)
          const valA = parseFloat(a.key);
          const valB = parseFloat(b.key);
          if (!isNaN(valA) && !isNaN(valB)) {
            return valA - valB;
          }
          // Fallback to string sort
          return a.key.localeCompare(b.key);
        });

      // 2. New Rows = Old Columns (The Items)
      const newRows = processedData.columns.map((col) => {
        const newRow: any = {
          key: col.key,
          label: col.label,
          rawValue: col.key,
          total: col.total,
          cells: {},
        };

        // Fill cells: For each Scale Point (Old Row), get the data for this Item (Old Col)
        processedData.rows.forEach((oldRow) => {
          const cell = oldRow.cells[col.key];
          if (cell) {
            newRow.cells[oldRow.rawValue] = cell;
          }
        });

        return newRow;
      });

      // 3. Calculate Average and Sort Rows
      newRows.forEach((row) => {
        let sum = 0;
        let count = 0;
        newColumns.forEach((col) => {
          const val = parseFloat(col.key);
          const cell = row.cells[col.key];
          if (!isNaN(val) && cell) {
            sum += val * cell.count;
            count += cell.count;
          }
        });
        row.average = count > 0 ? sum / count : 0;
      });

      // Sort by average descending
      newRows.sort((a: any, b: any) => b.average - a.average);

      // 4. New Series = Old Rows (The Scale Points mapped to the new items)
      const newSeries = newColumns.map((newCol) => ({
        key: newCol.key,
        label: newCol.label,
        data: newRows.map((row) => ({
          label: row.label,
          rawValue: row.rawValue,
          value: row.cells[newCol.key]?.count || 0,
          percent: row.cells[newCol.key]?.percent || 0,
          sig: row.cells[newCol.key]?.sig,
        })),
      }));

      return {
        ...processedData,
        columns: newColumns,
        rows: newRows,
        series: newSeries,
      };
    }
  }

  // CASE 3: Violin / Ridgeline (Distribution Charts)
  // These renderers expect each "Series" to be a group (Category),
  // and the "Data" within that series to be the histogram bins.
  if (activeChartType === 'violin' || activeChartType === 'ridgeline') {
    // Two scenarios:
    // 1. Single metric (age only): 1 row ('Age'), 1 column ('Total')
    //    → Create 1 series from the row
    // 2. Grouped metric (age × sex): 1 row ('Age'), multiple columns (Male, Female)
    //    → Create 1 series per column, using bins from that column's cell

    let newSeries: ChartSeries[];

    if (processedData.columns.length === 1) {
      // Scenario 1: Single metric - iterate rows
      newSeries = processedData.rows
        .filter((r) => {
          const colKey = processedData.columns[0]?.key;
          return r.cells[colKey]?.histogramBins && r.cells[colKey].histogramBins!.length > 0;
        })
        .map((r) => {
          const colKey = processedData.columns[0].key;
          return {
            key: r.rawValue,
            label: r.label,
            data: (r.cells[colKey].histogramBins || []).map((bin) => ({
              label: r.label,
              rawValue: String(bin.x0),
              value: bin.count,
              percent: 0,
              x0: bin.x0,
              x1: bin.x1,
              count: bin.count,
            })),
          };
        });
    } else {
      // Scenario 2: Grouped metric - iterate columns
      // Each column (Male, Female) becomes a series
      newSeries = processedData.columns
        .filter((col) => {
          // Check if any row has histogram bins for this column
          return processedData.rows.some(
            (r) => r.cells[col.key]?.histogramBins && r.cells[col.key].histogramBins!.length > 0,
          );
        })
        .map((col) => {
          // Get bins from the first row (usually the metric row like 'Age')
          const firstRow = processedData.rows[0];
          const bins = firstRow?.cells[col.key]?.histogramBins || [];

          return {
            key: col.key,
            label: col.label,
            data: bins.map((bin) => ({
              label: col.label,
              rawValue: String(bin.x0),
              value: bin.count,
              percent: 0,
              x0: bin.x0,
              x1: bin.x1,
              count: bin.count,
            })),
          };
        });
    }

    if (newSeries.length > 0) {
      return {
        ...processedData,
        series: newSeries,
      };
    }
  }

  // CASE 4: Scatter / Hexbin (Two Continuous Variables)
  // processedData arrives as a pivoted table.
  // There are two common structures:
  // 1. Raw-ish crosstab (if binning was done on both sides): Rows = X bins, Cols = Y bins.
  // 2. Metric Analysis: Row = "Age" (Label), Cols = "Weight" (Values/Bins).
  //    Here, X = Col Value, Y = Cell Mean (Aggregated Scatter).
  if (activeChartType === 'scatter' || activeChartType === 'hexbin') {
    const points: ChartDataPoint[] = [];

    // Scenario 1: Metric Analysis (Row is just a label, e.g. "Age")
    // We plot (X=ColVal, Y=Mean of RowVar)
    // This effectively plots the "Trend" or "Binned Means".
    const isMetricRow = processedData.rows.length === 1 && isNaN(parseFloat(processedData.rows[0].rawValue));

    if (isMetricRow) {
      const metricRow = processedData.rows[0];
      processedData.columns.forEach((col) => {
        const xVal = parseFloat(col.key);
        if (isNaN(xVal)) return; // Skip totals

        const cell = metricRow.cells[col.key];
        if (cell && cell.count > 0 && cell.mean !== undefined) {
          points.push({
            label: `${metricRow.label} (Mean) by ${col.label}`,
            rawValue: `${col.key},${cell.mean}`,
            value: cell.count, // Size by count
            percent: 0,
            x: xVal,
            y: cell.mean,
          });
        }
      });
    } else {
      // Scenario 2: Bin x Bin Matrix (Heatmap style)
      // Iterate through all rows (Y values? or X?)
      // Usually Row = Independent (X)? or Component?
      // Let's assume Row = Y (vertical axis) and Col = X (horizontal axis) for a table.

      processedData.rows.forEach((row) => {
        const rowVal = parseFloat(row.rawValue);
        if (isNaN(rowVal)) return;

        processedData.columns.forEach((col) => {
          const colVal = parseFloat(col.key);
          if (isNaN(colVal)) return;

          const cell = row.cells[col.key];
          if (cell && cell.count > 0) {
            points.push({
              label: `${row.label}, ${col.label}`,
              rawValue: `${row.rawValue},${col.key}`,
              value: cell.count,
              percent: 0,
              x: rowVal,
              y: colVal,
            });
          }
        });
      });
    }

    if (points.length > 0) {
      return {
        ...processedData,
        series: [
          {
            key: 'scatter-data',
            label: 'Data',
            data: points,
          },
        ],
      };
    }
  }

  return processedData;
};
