"""Velocity native PowerPoint research-chart builder.

Hard invariant: quantitative marks are native Office chart series. Shapes may frame or
annotate a chart but may not encode a numeric value.

python-pptx supports standard bar/line/scatter chart creation. Some advanced Office
features (cell-linked data labels, XY error-bar connectors, custom chart-template XML)
require post-processing of the OOXML package; those transforms are isolated here so the
semantic primitive/data contract remains stable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable, Sequence

from pptx.chart.data import CategoryChartData, XyChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor


INK = RGBColor(30, 38, 43)
MUTED = RGBColor(105, 112, 113)
GRID = RGBColor(217, 215, 208)
ACCENT = RGBColor(0, 126, 125)
CONTEXT = RGBColor(98, 111, 120)
RISK = RGBColor(184, 65, 55)
RECOVERY = RGBColor(184, 126, 43)


class Primitive(str, Enum):
    BAR_RANKED = "MR_BAR_RANKED"
    BAR_COMPARE = "MR_BAR_COMPARE"
    STACKED_100 = "MR_STACKED_100"
    LIKERT_DIVERGING = "MR_LIKERT_DIVERGING"
    BAR_DIVERGING_NET = "MR_BAR_DIVERGING_NET"
    TREND_HERO = "MR_TREND_HERO"
    TREND_COMPARE = "MR_TREND_COMPARE"
    SLOPE_TWO_PERIOD = "MR_SLOPE_TWO_PERIOD"
    DUMBBELL_XY = "MR_DUMBBELL_XY"
    DUMBBELL_XY_MULTI = "MR_DUMBBELL_XY_MULTI"
    SCATTER_POSITION_CHANGE = "MR_SCATTER_POSITION_CHANGE"
    SCATTER_QUADRANT = "MR_SCATTER_QUADRANT"
    INDEX_VS_BENCHMARK = "MR_INDEX_VS_BENCHMARK"
    NPS_COMPOSITION = "MR_NPS_COMPOSITION"


@dataclass(frozen=True)
class ResearchMeta:
    question: str | None = None
    universe: str | None = None
    unweighted_base: str | None = None
    weight: str | None = None
    period: str | None = None
    significance: str | None = None
    suppression: str | None = None
    source: str | None = None


@dataclass
class ChartSpec:
    primitive: Primitive
    rows: list[dict[str, Any]]
    meta: ResearchMeta = field(default_factory=ResearchMeta)
    x_min: float | None = None
    x_max: float | None = None
    y_min: float | None = None
    y_max: float | None = None
    value_format: str = "0.0"
    highlight: str | None = None


class NativeChartBuilder:
    """Build native PowerPoint chart objects from semantic research primitives."""

    def __init__(self, slide):
        self.slide = slide

    def add(self, spec: ChartSpec, x: float, y: float, w: float, h: float):
        method = {
            Primitive.BAR_RANKED: self._bar_ranked,
            Primitive.BAR_COMPARE: self._bar_compare,
            Primitive.STACKED_100: self._stacked_100,
            Primitive.LIKERT_DIVERGING: self._likert_diverging,
            Primitive.BAR_DIVERGING_NET: self._diverging_bar,
            Primitive.TREND_HERO: self._trend_hero,
            Primitive.TREND_COMPARE: self._trend_compare,
            Primitive.SCATTER_POSITION_CHANGE: self._scatter_position_change,
            Primitive.SCATTER_QUADRANT: self._scatter_quadrant,
            Primitive.INDEX_VS_BENCHMARK: self._diverging_bar,
            Primitive.NPS_COMPOSITION: self._nps_composition,
            Primitive.DUMBBELL_XY: self._dumbbell_xy,
            Primitive.DUMBBELL_XY_MULTI: self._dumbbell_xy,
            Primitive.SLOPE_TWO_PERIOD: self._slope,
        }[spec.primitive]
        return method(spec, x, y, w, h)

    def _add_category_chart(self, chart_type, data, x, y, w, h):
        chart = self.slide.shapes.add_chart(chart_type, Inches(x), Inches(y), Inches(w), Inches(h), data).chart
        self._base_style(chart)
        return chart

    def _add_xy_chart(self, chart_type, data, x, y, w, h):
        chart = self.slide.shapes.add_chart(chart_type, Inches(x), Inches(y), Inches(w), Inches(h), data).chart
        self._base_style(chart)
        return chart

    def _base_style(self, chart):
        chart.has_title = False
        chart.has_legend = False
        chart.chart_style = 2
        try:
            chart.value_axis.tick_labels.font.size = Pt(10)
            chart.value_axis.tick_labels.font.color.rgb = MUTED
            chart.value_axis.format.line.color.rgb = GRID
            chart.value_axis.has_major_gridlines = True
            chart.value_axis.major_gridlines.format.line.color.rgb = GRID
        except Exception:
            pass
        try:
            chart.category_axis.tick_labels.font.size = Pt(11)
            chart.category_axis.tick_labels.font.color.rgb = INK
            chart.category_axis.format.line.color.rgb = GRID
        except Exception:
            pass

    def _labels(self, plot, position=XL_LABEL_POSITION.OUTSIDE_END, fmt="0.0"):
        plot.has_data_labels = True
        labels = plot.data_labels
        labels.position = position
        labels.number_format = fmt
        labels.font.size = Pt(10)
        labels.font.color.rgb = INK

    def _bar_ranked(self, spec, x, y, w, h):
        rows = sorted(spec.rows, key=lambda r: r["value"])
        d = CategoryChartData(); d.categories = [r["category"] for r in rows]; d.add_series("Value", [r["value"] for r in rows])
        c = self._add_category_chart(XL_CHART_TYPE.BAR_CLUSTERED, d, x,y,w,h)
        c.value_axis.minimum_scale = 0 if spec.x_min is None else spec.x_min
        if spec.x_max is not None: c.value_axis.maximum_scale = spec.x_max
        self._labels(c.plots[0], fmt=spec.value_format)
        c.series[0].format.fill.solid(); c.series[0].format.fill.fore_color.rgb = ACCENT
        return c

    def _bar_compare(self, spec, x,y,w,h):
        keys = [k for k in spec.rows[0] if k.startswith("series_")]
        d=CategoryChartData(); d.categories=[r["category"] for r in spec.rows]
        for key in keys: d.add_series(key, [r[key] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.BAR_CLUSTERED,d,x,y,w,h); c.has_legend=True; c.legend.position=XL_LEGEND_POSITION.BOTTOM
        c.value_axis.minimum_scale=0; self._labels(c.plots[0],fmt=spec.value_format); return c

    def _stacked_100(self, spec,x,y,w,h):
        keys=[k for k in spec.rows[0] if k.startswith("part_")]
        d=CategoryChartData();d.categories=[r["category"] for r in spec.rows]
        for key in keys:d.add_series(key,[r[key] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.BAR_STACKED_100,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;return c

    def _likert_diverging(self,spec,x,y,w,h):
        # DISPLAY DATA remain the supplied absolute percentages. Helper series are deterministic.
        cols=["strong_negative","negative","neutral_left","neutral_right","positive","strong_positive"]
        d=CategoryChartData();d.categories=[r["category"] for r in spec.rows]
        values={k:[] for k in cols}
        for r in spec.rows:
            values["strong_negative"].append(-r["strong_negative"])
            values["negative"].append(-r["negative"])
            values["neutral_left"].append(-r["neutral"]/2)
            values["neutral_right"].append(r["neutral"]/2)
            values["positive"].append(r["positive"])
            values["strong_positive"].append(r["strong_positive"])
        for k in cols:d.add_series(k,values[k])
        c=self._add_category_chart(XL_CHART_TYPE.BAR_STACKED,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM
        lim=max(sum(abs(values[k][i]) for k in cols[:3]) for i in range(len(spec.rows)));lim=max(lim,max(sum(values[k][i] for k in cols[3:]) for i in range(len(spec.rows))))
        c.value_axis.minimum_scale=-lim;c.value_axis.maximum_scale=lim;return c

    def _diverging_bar(self,spec,x,y,w,h):
        key="difference" if "difference" in spec.rows[0] else "difference_vs_benchmark"
        d=CategoryChartData();d.categories=[r["category"] if "category" in r else r["attribute"] for r in spec.rows];d.add_series("Difference",[r[key] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.BAR_CLUSTERED,d,x,y,w,h);self._labels(c.plots[0],fmt=spec.value_format);return c

    def _trend_hero(self,spec,x,y,w,h):
        d=CategoryChartData();d.categories=[r["period"] for r in spec.rows];d.add_series("Value",[r["value"] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.series[0].format.line.color.rgb=ACCENT;c.series[0].format.line.width=Pt(2.5)
        if spec.y_min is not None:c.value_axis.minimum_scale=spec.y_min
        if spec.y_max is not None:c.value_axis.maximum_scale=spec.y_max
        return c

    def _trend_compare(self,spec,x,y,w,h):
        keys=[k for k in spec.rows[0] if k.startswith("series_")]
        d=CategoryChartData();d.categories=[r["period"] for r in spec.rows]
        for k in keys:d.add_series(k,[r[k] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM
        if spec.y_min is not None:c.value_axis.minimum_scale=spec.y_min
        if spec.y_max is not None:c.value_axis.maximum_scale=spec.y_max
        return c

    def _scatter_position_change(self,spec,x,y,w,h):
        d=XyChartData()
        # One native series per entity enables direct semantic selection/highlighting.
        for row in spec.rows:
            series=d.add_series(row["entity"]);series.add_data_point(row["position"],row["change"])
        c=self._add_xy_chart(XL_CHART_TYPE.XY_SCATTER,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.RIGHT
        if spec.x_min is not None:c.category_axis.minimum_scale=spec.x_min
        if spec.x_max is not None:c.category_axis.maximum_scale=spec.x_max
        if spec.y_min is not None:c.value_axis.minimum_scale=spec.y_min
        if spec.y_max is not None:c.value_axis.maximum_scale=spec.y_max
        return c

    def _scatter_quadrant(self,spec,x,y,w,h):
        return self._scatter_position_change(spec,x,y,w,h)

    def _nps_composition(self,spec,x,y,w,h):
        d=CategoryChartData();d.categories=[r["category"] for r in spec.rows]
        for k in ("detractor","passive","promoter"):d.add_series(k,[r[k] for r in spec.rows])
        c=self._add_category_chart(XL_CHART_TYPE.BAR_STACKED_100,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;return c

    def _slope(self,spec,x,y,w,h):
        d=CategoryChartData();d.categories=["Start","End"]
        for row in spec.rows:d.add_series(row["category"],[row["start"],row["end"]])
        c=self._add_category_chart(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.RIGHT;return c

    def _dumbbell_xy(self,spec,x,y,w,h):
        """Create native XY endpoint series.

        Connector/error-bar OOXML is intentionally post-processed by `apply_dumbbell_connectors`.
        Keeping endpoints as native scatter series means no numeric mark is ever a freeform shape.
        """
        d=XyChartData();start=d.add_series("Start");end=d.add_series("End")
        n=len(spec.rows)
        for i,row in enumerate(spec.rows):
            yp=n-i;start.add_data_point(row["start"],yp);end.add_data_point(row["end"],yp)
        c=self._add_xy_chart(XL_CHART_TYPE.XY_SCATTER,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM
        if spec.x_min is not None:c.category_axis.minimum_scale=spec.x_min
        if spec.x_max is not None:c.category_axis.maximum_scale=spec.x_max
        c.value_axis.minimum_scale=.5;c.value_axis.maximum_scale=n+.5;c.value_axis.has_major_gridlines=False
        # Mark for OOXML connector/label post-processing.
        c._element.set("velocityPrimitive", spec.primitive.value)
        return c


def display_table(spec: ChartSpec) -> list[dict[str, Any]]:
    """Return the clean human-readable data that must be preserved in the embedded workbook."""
    return [dict(row) for row in spec.rows]


def helper_table(spec: ChartSpec) -> list[dict[str, Any]]:
    if spec.primitive in (Primitive.DUMBBELL_XY, Primitive.DUMBBELL_XY_MULTI):
        n=len(spec.rows);out=[]
        for i,row in enumerate(spec.rows):
            out.append({"category":row.get("category",row.get("measure")),"y_position":n-i,"connector_start":row["start"],"connector_width":row["end"]-row["start"]})
        return out
    if spec.primitive == Primitive.LIKERT_DIVERGING:
        return [{"category":r["category"],"strong_negative_plot":-r["strong_negative"],"negative_plot":-r["negative"],"neutral_left":-r["neutral"]/2,"neutral_right":r["neutral"]/2,"positive_plot":r["positive"],"strong_positive_plot":r["strong_positive"]} for r in spec.rows]
    return []
