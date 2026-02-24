import PptxGenJS from 'pptxgenjs';
import { ExportConfig, AnalysisExportItem } from './types';
import { ProcessedRow, ProcessedColumn, ProcessedCell } from '../../types/processedData';

const SIG_LETTERS: Record<string, string> = {
  high_95: '▲',
  high_80: '△',
  low_95: '▼',
  low_80: '▽',
};

const DEFAULTS = {
  primaryColor: '1C1C1C',
  headerColor: 'E07A5F',
  fontFamily: 'Atkinson Hyperlegible',
  fontSize: 9,
  headerFontSize: 10,
};

function flattenRows(rows: ProcessedRow[], result: ProcessedRow[] = []): ProcessedRow[] {
  for (const row of rows) {
    result.push(row);
    if (row.children.length) {
      flattenRows(row.children, result);
    }
  }
  return result;
}

function formatCell(cell: ProcessedCell | undefined, showSig: boolean): string {
  if (!cell) return '';
  const pct = `${cell.percent.toFixed(1)}%`;
  const sig = showSig && cell.sig ? ` ${SIG_LETTERS[cell.sig] || ''}` : '';
  return `${pct}${sig}`;
}

function buildSlideTable(
  item: AnalysisExportItem,
  columns: ProcessedColumn[],
  branding: typeof DEFAULTS
): PptxGenJS.TableRow[] {
  const showSig = item.options?.showSignificance !== false;
  const headerStyle: PptxGenJS.TableCellProps = {
    fill: { color: branding.headerColor },
    color: 'FFFFFF',
    bold: true,
    fontSize: branding.headerFontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const cellStyle: PptxGenJS.TableCellProps = {
    fontSize: branding.fontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const tableRows: PptxGenJS.TableRow[] = [];

  // Header row
  const headerRow: PptxGenJS.TableCell[] = [
    { text: '', options: headerStyle },
    ...columns.map(col => ({ text: col.label, options: headerStyle })),
    { text: 'Total', options: headerStyle },
  ];
  tableRows.push(headerRow);

  // Data rows
  const flatRows = flattenRows(item.result.rows);
  for (const row of flatRows) {
    const indent = row.depth > 0 ? '  '.repeat(row.depth) : '';
    const labelStyle: PptxGenJS.TableCellProps = {
      ...cellStyle,
      bold: row.depth === 0,
    };

    const dataRow: PptxGenJS.TableCell[] = [
      { text: `${indent}${row.label}`, options: labelStyle },
      ...columns.map(col => ({
        text: formatCell(row.cells[col.key], showSig),
        options: { ...cellStyle, align: 'right' as const },
      })),
      { text: row.total.toString(), options: { ...cellStyle, align: 'right' as const, bold: true } },
    ];
    tableRows.push(dataRow);
  }

  return tableRows;
}

function buildSlideChart(
  pptx: PptxGenJS,
  slide: any, // PptxGenJS.Slide type might not be fully exported, use any for now
  item: AnalysisExportItem,
  branding: typeof DEFAULTS
) {
  const chartTypeKey = item.chartType || 'vertical-bar';

  // Mapping Velocity ChartType to PPTX ChartTypes
  let pptxChartType: any = PptxGenJS.ChartType.bar;
  let barDir: 'bar' | 'col' = 'col';
  let barGrouping: 'standard' | 'stacked' | 'clustered' = 'standard';

  switch (chartTypeKey) {
    case 'horizontal-bar':
      barDir = 'bar';
      break;
    case 'vertical-bar':
      barDir = 'col';
      break;
    case 'grouped-bar':
      barDir = 'bar';
      barGrouping = 'clustered';
      break;
    case 'grouped-column':
      barDir = 'col';
      barGrouping = 'clustered';
      break;
    case 'stacked-bar':
      barDir = 'bar';
      barGrouping = 'stacked';
      break;
    case 'donut':
      pptxChartType = PptxGenJS.ChartType.doughnut;
      break;
    case 'scatter':
      pptxChartType = PptxGenJS.ChartType.scatter;
      break;
    default:
      // Fallback (e.g. histogram, box-plot)
      barDir = 'col';
  }

  const showPercents = item.options?.showPercents !== false;

  const seriesData = item.result.series.map(series => {
    return {
      name: series.label || 'Series 1',
      labels: series.data.map(d => d.label),
      values: series.data.map(d => showPercents ? d.percent : d.value)
    };
  });

  const chartOpts: any = {
    x: 0.5,
    y: 1.0,
    w: 12.3,
    h: 5.5,
    showTitle: false,
    showLegend: item.result.series.length > 1,
    legendPos: 'b',
    barDir,
    barGrouping,
    // Use branding colors + a fallback categorical palette
    chartColors: [branding.headerColor, branding.primaryColor, '4F46E5', '10B981', 'F59E0B'],
    dataLabelFormatCode: showPercents ? '0.0"%"' : '0',
    showValue: true,
    dataBorder: { pt: 1, color: 'FFFFFF' },
    dataLabelColor: '333333',
    dataLabelFontFace: branding.fontFamily,
    dataLabelFontSize: 10,
    // Provide general styling logic
    valAxisLabelFormatCode: showPercents ? '0"%"' : '0',
  };

  slide.addChart(pptxChartType, seriesData, chartOpts);
}

export async function exportPptx(config: ExportConfig): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const branding = {
    ...DEFAULTS,
    ...(config.branding?.primaryColor && { primaryColor: config.branding.primaryColor.replace('#', '') }),
    ...(config.branding?.headerColor && { headerColor: config.branding.headerColor.replace('#', '') }),
    ...(config.branding?.fontFamily && { fontFamily: config.branding.fontFamily }),
  };

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(config.title, {
    x: 0.5,
    y: '40%',
    w: '90%',
    fontSize: 28,
    fontFace: branding.fontFamily,
    color: branding.primaryColor,
    bold: true,
  });

  // One slide per analysis
  for (const item of config.analyses) {
    const slide = pptx.addSlide();

    slide.addText(item.label, {
      x: 0.5,
      y: 0.3,
      w: '90%',
      fontSize: 18,
      fontFace: branding.fontFamily,
      color: branding.primaryColor,
      bold: true,
    });

    if (item.viewType === 'chart') {
      buildSlideChart(pptx, slide, item, branding);
    } else {
      const tableRows = buildSlideTable(item, item.result.columns, branding);
      const colCount = item.result.columns.length + 2; // label + cols + total

      slide.addTable(tableRows, {
        x: 0.5,
        y: 1.0,
        w: 12.3,
        colW: Array(colCount).fill(12.3 / colCount),
        rowH: 0.35,
        autoPage: true,
        autoPageRepeatHeader: true,
      });
    }
  }

  const output = await pptx.write({ outputType: 'uint8array' });
  return output as Uint8Array;
}
