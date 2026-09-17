"""Velocity native PowerPoint research-chart builder.

Invariant: every quantitative mark is an Office chart series backed by an embedded
workbook. Shapes/text may frame or annotate charts, never substitute for data marks.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

INK=RGBColor(30,38,43); MUTED=RGBColor(105,112,113); GRID=RGBColor(217,215,208)
ACCENT=RGBColor(0,126,125); CONTEXT=RGBColor(98,111,120); RISK=RGBColor(184,65,55); RECOVERY=RGBColor(184,126,43)

class Primitive(str,Enum):
    BAR_RANKED='MR_BAR_RANKED'; BAR_COMPARE='MR_BAR_COMPARE'; STACKED_100='MR_STACKED_100'; LIKERT_DIVERGING='MR_LIKERT_DIVERGING'; BAR_DIVERGING_NET='MR_BAR_DIVERGING_NET'; TREND_HERO='MR_TREND_HERO'; TREND_COMPARE='MR_TREND_COMPARE'; SLOPE_TWO_PERIOD='MR_SLOPE_TWO_PERIOD'; DUMBBELL_XY='MR_DUMBBELL_XY'; DUMBBELL_XY_MULTI='MR_DUMBBELL_XY_MULTI'; SCATTER_POSITION_CHANGE='MR_SCATTER_POSITION_CHANGE'; SCATTER_QUADRANT='MR_SCATTER_QUADRANT'; INDEX_VS_BENCHMARK='MR_INDEX_VS_BENCHMARK'; NPS_COMPOSITION='MR_NPS_COMPOSITION'

@dataclass(frozen=True)
class ResearchMeta:
    question:str|None=None; universe:str|None=None; unweighted_base:str|None=None; weight:str|None=None; period:str|None=None; significance:str|None=None; suppression:str|None=None; source:str|None=None

@dataclass
class ChartSpec:
    primitive:Primitive; rows:list[dict[str,Any]]; meta:ResearchMeta=field(default_factory=ResearchMeta); x_min:float|None=None; x_max:float|None=None; y_min:float|None=None; y_max:float|None=None; value_format:str='0.0'; highlight:str|None=None; series_labels:list[str]|None=None

class NativeChartBuilder:
    def __init__(self,slide): self.slide=slide
    def add(self,spec,x,y,w,h):
        return {Primitive.BAR_RANKED:self._bar_ranked,Primitive.BAR_COMPARE:self._bar_compare,Primitive.STACKED_100:self._stacked,Primitive.LIKERT_DIVERGING:self._likert,Primitive.BAR_DIVERGING_NET:self._diverging,Primitive.TREND_HERO:self._trend,Primitive.TREND_COMPARE:self._trend_compare,Primitive.SLOPE_TWO_PERIOD:self._slope,Primitive.DUMBBELL_XY:self._dumbbell,Primitive.DUMBBELL_XY_MULTI:self._dumbbell,Primitive.SCATTER_POSITION_CHANGE:self._scatter,Primitive.SCATTER_QUADRANT:self._scatter,Primitive.INDEX_VS_BENCHMARK:self._diverging,Primitive.NPS_COMPOSITION:self._nps}[spec.primitive](spec,x,y,w,h)
    def _cat(self,t,d,x,y,w,h):
        c=self.slide.shapes.add_chart(t,Inches(x),Inches(y),Inches(w),Inches(h),d).chart; return self._style(c)
    def _xy(self,t,d,x,y,w,h):
        c=self.slide.shapes.add_chart(t,Inches(x),Inches(y),Inches(w),Inches(h),d).chart; return self._style(c)
    def _style(self,c):
        c.has_title=False;c.has_legend=False;c.chart_style=2
        for ax in ('value_axis','category_axis'):
            try:
                a=getattr(c,ax);a.tick_labels.font.size=Pt(10);a.tick_labels.font.color.rgb=MUTED;a.format.line.color.rgb=GRID
            except Exception: pass
        try:c.value_axis.has_major_gridlines=True;c.value_axis.major_gridlines.format.line.color.rgb=GRID
        except Exception:pass
        return c
    def _limits(self,c,s):
        if s.x_min is not None:c.category_axis.minimum_scale=s.x_min
        if s.x_max is not None:c.category_axis.maximum_scale=s.x_max
        if s.y_min is not None:c.value_axis.minimum_scale=s.y_min
        if s.y_max is not None:c.value_axis.maximum_scale=s.y_max
    def _bar_ranked(self,s,x,y,w,h):
        rows=sorted(s.rows,key=lambda r:r['value']);d=CategoryChartData();d.categories=[r['category'] for r in rows];d.add_series('Value',[r['value'] for r in rows]);c=self._cat(XL_CHART_TYPE.BAR_CLUSTERED,d,x,y,w,h);c.value_axis.minimum_scale=0 if s.x_min is None else s.x_min;c.plots[0].has_data_labels=True;c.plots[0].data_labels.position=XL_LABEL_POSITION.OUTSIDE_END;c.plots[0].data_labels.number_format=s.value_format;c.series[0].format.fill.solid();c.series[0].format.fill.fore_color.rgb=ACCENT;return c
    def _bar_compare(self,s,x,y,w,h):
        keys=[k for k in s.rows[0] if k.startswith('series_')];d=CategoryChartData();d.categories=[r['category'] for r in s.rows]
        for i,k in enumerate(keys):d.add_series((s.series_labels or keys)[i],[r[k] for r in s.rows])
        c=self._cat(XL_CHART_TYPE.BAR_CLUSTERED,d,x,y,w,h);c.value_axis.minimum_scale=0;c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;return c
    def _stacked(self,s,x,y,w,h):
        keys=[k for k in s.rows[0] if k.startswith('part_')];d=CategoryChartData();d.categories=[r['category'] for r in s.rows]
        for k in keys:d.add_series(k,[r[k] for r in s.rows])
        c=self._cat(XL_CHART_TYPE.BAR_STACKED_100,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;return c
    def _likert(self,s,x,y,w,h):
        d=CategoryChartData();d.categories=[r['category'] for r in s.rows];cols=[('Strongly disagree',lambda r:-r['strong_negative']),('Disagree',lambda r:-r['negative']),('Neutral left',lambda r:-r['neutral']/2),('Neutral right',lambda r:r['neutral']/2),('Agree',lambda r:r['positive']),('Strongly agree',lambda r:r['strong_positive'])]
        for name,f in cols:d.add_series(name,[f(r) for r in s.rows])
        c=self._cat(XL_CHART_TYPE.BAR_STACKED,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;lim=max(max(r['strong_negative']+r['negative']+r['neutral']/2,r['strong_positive']+r['positive']+r['neutral']/2) for r in s.rows);c.value_axis.minimum_scale=-lim;c.value_axis.maximum_scale=lim;return c
    def _diverging(self,s,x,y,w,h):
        key='difference' if 'difference' in s.rows[0] else 'difference_vs_benchmark';cat='category' if 'category' in s.rows[0] else 'attribute';d=CategoryChartData();d.categories=[r[cat] for r in s.rows];d.add_series('Difference',[r[key] for r in s.rows]);return self._cat(XL_CHART_TYPE.BAR_CLUSTERED,d,x,y,w,h)
    def _trend(self,s,x,y,w,h):
        d=CategoryChartData();d.categories=[r['period'] for r in s.rows];d.add_series((s.series_labels or ['Value'])[0],[r['value'] for r in s.rows]);c=self._cat(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.series[0].format.line.color.rgb=ACCENT;c.series[0].format.line.width=Pt(2.5);self._limits(c,s);return c
    def _trend_compare(self,s,x,y,w,h):
        keys=[k for k in s.rows[0] if k.startswith('series_')];d=CategoryChartData();d.categories=[r['period'] for r in s.rows]
        for i,k in enumerate(keys):d.add_series((s.series_labels or keys)[i],[r[k] for r in s.rows])
        c=self._cat(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;self._limits(c,s);return c
    def _scatter(self,s,x,y,w,h):
        d=XyChartData()
        for r in s.rows:
            name=r.get('entity',r.get('label','Point'));ss=d.add_series(name);ss.add_data_point(r.get('position',r.get('x_value')),r.get('change',r.get('y_value')))
        c=self._xy(XL_CHART_TYPE.XY_SCATTER,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.RIGHT;self._limits(c,s);return c
    def _slope(self,s,x,y,w,h):
        d=CategoryChartData();d.categories=['Start','End']
        for r in s.rows:d.add_series(r['category'],[r['start'],r['end']])
        c=self._cat(XL_CHART_TYPE.LINE_MARKERS,d,x,y,w,h);c.has_legend=len(s.rows)>1;c.legend.position=XL_LEGEND_POSITION.RIGHT if c.has_legend else XL_LEGEND_POSITION.BOTTOM
        if s.y_min is not None:c.value_axis.minimum_scale=s.y_min
        if s.y_max is not None:c.value_axis.maximum_scale=s.y_max
        return c
    def _dumbbell(self,s,x,y,w,h):
        """Fully native XY dumbbell: one XY line-with-markers series per row.

        Each series contains exactly two points (start/end) at a shared Y position, so the
        connector and endpoints all remain native chart marks and update through Edit Data.
        """
        d=XyChartData();n=len(s.rows)
        for i,r in enumerate(s.rows):
            label=r.get('category',r.get('measure'));ss=d.add_series(label);yp=n-i;ss.add_data_point(r['start'],yp);ss.add_data_point(r['end'],yp)
        c=self._xy(XL_CHART_TYPE.XY_SCATTER_LINES,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.RIGHT;self._limits(c,s);c.value_axis.minimum_scale=.5;c.value_axis.maximum_scale=n+.5;c.value_axis.has_major_gridlines=False
        for i,ser in enumerate(c.series):ser.format.line.color.rgb=[ACCENT,CONTEXT,RISK,RECOVERY][i%4];ser.format.line.width=Pt(2)
        return c
    def _nps(self,s,x,y,w,h):
        d=CategoryChartData();d.categories=[r['category'] for r in s.rows]
        for k in ('detractor','passive','promoter'):d.add_series(k,[r[k] for r in s.rows])
        c=self._cat(XL_CHART_TYPE.BAR_STACKED_100,d,x,y,w,h);c.has_legend=True;c.legend.position=XL_LEGEND_POSITION.BOTTOM;return c

def display_table(spec):return [dict(r) for r in spec.rows]
def helper_table(spec):
    if spec.primitive in (Primitive.DUMBBELL_XY,Primitive.DUMBBELL_XY_MULTI):
        n=len(spec.rows);return [{'category':r.get('category',r.get('measure')),'y_position':n-i,'connector_width':r['end']-r['start']} for i,r in enumerate(spec.rows)]
    if spec.primitive==Primitive.LIKERT_DIVERGING:return [{'category':r['category'],'strong_negative_plot':-r['strong_negative'],'negative_plot':-r['negative'],'neutral_left':-r['neutral']/2,'neutral_right':r['neutral']/2,'positive_plot':r['positive'],'strong_positive_plot':r['strong_positive']} for r in spec.rows]
    return []
