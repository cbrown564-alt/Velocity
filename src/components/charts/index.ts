/**
 * Charts Components
 *
 * Interactive visualization components.
 * - Observable Plot based: PlotWrapper, InteractiveBarChart
 * - Mosaic based: MosaicBarChart (with native brush selection)
 */

export { PlotWrapper } from './PlotWrapper';
export type { PlotWrapperProps } from './PlotWrapper';

export { InteractiveBarChart } from './InteractiveBarChart';
export type {
    InteractiveBarChartProps,
    BarDatum,
    BarClickEvent,
} from './InteractiveBarChart';

export { MosaicBarChart } from './MosaicBarChart';
export type {
    MosaicBarChartProps,
    MosaicBarDatum,
    MosaicSelectionEvent,
} from './MosaicBarChart';
