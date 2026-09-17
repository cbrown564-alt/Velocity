"""Generate SBT-001 Category Board using only native charts for quantitative marks.

This is the integration harness for the native research-chart system. It intentionally
keeps editorial text/layout separate from chart construction.
"""
from __future__ import annotations
from pathlib import Path
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

sys.path.insert(0, str(Path(__file__).resolve().parent))
from native_chart_system import NativeChartBuilder, ChartSpec, Primitive, ResearchMeta

OUT=Path(__file__).resolve().parents[3]/'evals/research_quality/projects/synthetic/SBT-001/reference/deck'
OUT.mkdir(parents=True,exist_ok=True)

BG=RGBColor(248,246,241); INK=RGBColor(30,38,43); MUTED=RGBColor(105,112,113); ACCENT=RGBColor(0,126,125); NAVY=RGBColor(35,55,72)

# Deterministic values already bound by SBT-001 reference analysis / design iteration.
BRANDS={
 'Northstar':{'w2':46.68,'w5':45.07},'Pulse':{'w2':20.29,'w5':29.59},'Mosaic':{'w2':22.13,'w5':25.69},'Lumen':{'w2':18.05,'w5':18.96},'Harbour':{'w2':23.66,'w5':24.12}}
PULSE=[19.49,20.29,27.21,29.07,29.59]
HARBOUR_TOTAL=[25.07,23.66,23.71,22.79,24.12]
HARBOUR_YOUNG=[22.06,19.47,17.73,14.95,15.02]


def text(slide,s,x,y,w,h,size=18,color=INK,bold=False):
    q=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));p=q.text_frame.paragraphs[0];r=p.add_run();r.text=s;r.font.name='Aptos';r.font.size=Pt(size);r.font.bold=bold;r.font.color.rgb=color;return q

def background(slide,color=BG):
    q=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,0,slide.part.package.presentation_part.presentation.slide_width,slide.part.package.presentation_part.presentation.slide_height);q.fill.solid();q.fill.fore_color.rgb=color;q.line.fill.background();slide.shapes._spTree.remove(q._element);slide.shapes._spTree.insert(2,q._element)

def headline(slide,h,dek=None):
    text(slide,h,.7,.45,11.9,.72,30,INK,True)
    if dek:text(slide,dek,.72,1.2,11.6,.4,17,MUTED)

def meta(**kw): return ResearchMeta(**kw)

def build(path=OUT/'SBT001_Category_Board_native.pptx'):
    prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5);blank=prs.slide_layouts[6]
    # 1 text-led
    s=prs.slides.add_slide(blank);background(s);text(s,'CATEGORY BOARD',.72,.62,3,.25,11,ACCENT,True);text(s,'Pulse advances;\nNorthstar and Harbour face\ndifferent vulnerabilities.',.72,1.22,10.8,2.4,36,INK,True);text(s,'SBT-001 synthetic UK mobile brand tracker · Waves 1–5',.75,5.92,8.5,.35,17,MUTED)
    # 2 three native evidence microcharts
    s=prs.slides.add_slide(blank);background(s);headline(s,'Three pressures are reshaping the category.','Three distinct measures, populations and periods — shown as separate native charts.')
    specs=[
      ChartSpec(Primitive.SLOPE_TWO_PERIOD,[{'category':'Pulse','start':20.29,'end':27.21}],meta=meta(universe='Total eligible sample',weight='wt_final',period='W2→W3'),y_min=15,y_max=30),
      ChartSpec(Primitive.TREND_HERO,[{'period':'W3','value':-12.54},{'period':'W4','value':-60.71},{'period':'W5','value':-33.17}],meta=meta(universe='Current Northstar customers',weight='wt_final',period='W3→W5'),y_min=-70,y_max=0),
      ChartSpec(Primitive.SLOPE_TWO_PERIOD,[{'category':'Harbour 18–34','start':22.06,'end':15.02}],meta=meta(universe='18–34',weight='wt_final',period='W1→W5'),y_min=10,y_max=25)]
    for i,sp in enumerate(specs):NativeChartBuilder(s).add(sp,.7+i*4.15,2.15,3.75,3.55)
    # 3 native scatter
    s=prs.slides.add_slide(blank);background(s);headline(s,'Northstar leads on consideration; Pulse records the largest gain.','W5 total-sample consideration × W2→W5 percentage-point change')
    rows=[{'entity':k,'position':v['w5'],'change':v['w5']-v['w2']} for k,v in BRANDS.items()]
    NativeChartBuilder(s).add(ChartSpec(Primitive.SCATTER_POSITION_CHANGE,rows,x_min=10,x_max=50,y_min=-4,y_max=12),.9,1.8,11.4,4.8)
    # 4 native hero trend
    s=prs.slides.add_slide(blank);background(s);headline(s,"Pulse's consideration gains persist beyond the Wave 3 jump.",'Weighted total-sample consideration; campaign timing is contextual, not causal')
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_HERO,[{'period':f'W{i+1}','value':v} for i,v in enumerate(PULSE)],y_min=15,y_max=32),.9,1.8,11.4,4.8)
    # 5 native XY dumbbell
    s=prs.slides.add_slide(blank);background(s);headline(s,"Pulse's observed consideration increase is larger among 18–34s.",'W2→W3 weighted consideration')
    NativeChartBuilder(s).add(ChartSpec(Primitive.DUMBBELL_XY,[{'category':'18–34','start':25.98,'end':37.12,'change':11.14},{'category':'35+','start':18.07,'end':23.33,'change':5.26}],x_min=15,x_max=40),.9,1.8,11.4,4.8)
    # 6 native multi dumbbell
    s=prs.slides.add_slide(blank);background(s);headline(s,"Pulse's consideration and preference gains outpace gains in provider share.",'Four separate weighted population measures; not respondent-level funnel transitions')
    rows=[{'measure':'Prompted awareness','start':57.79,'end':73.82},{'measure':'Consideration','start':20.29,'end':29.59},{'measure':'Preference','start':15.34,'end':25.11},{'measure':'Current provider','start':15.16,'end':19.79}]
    NativeChartBuilder(s).add(ChartSpec(Primitive.DUMBBELL_XY_MULTI,rows,x_min=0,x_max=80),.9,1.8,11.4,4.8)
    # 7 separate native charts preserve universes/units
    s=prs.slides.add_slide(blank);background(s);headline(s,"Northstar's awareness remains high while customer advocacy falls sharply.",'Current-customer and all-eligible-respondent evidence remain separate')
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_HERO,[{'period':'W3','value':-12.54},{'period':'W4','value':-60.71}],y_min=-70,y_max=0),.8,2.0,5.7,4.25)
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_HERO,[{'period':'W3','value':93.54},{'period':'W4','value':93.57}],y_min=85,y_max=100),6.85,2.0,5.7,4.25)
    text(s,'CURRENT NORTHSTAR CUSTOMERS',.9,1.72,3,.22,10,RGBColor(184,65,55),True);text(s,'ALL ELIGIBLE RESPONDENTS',6.95,1.72,3,.22,10,NAVY,True)
    # 8 two native recovery charts
    s=prs.slides.add_slide(blank);background(s);headline(s,'Northstar improves in Wave 5, but remains well short of its pre-shock position.','Two independent current-customer measures')
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_HERO,[{'period':'W3','value':-12.54},{'period':'W4','value':-60.71},{'period':'W5','value':-33.17}],y_min=-70,y_max=0),.8,2.0,5.7,4.25)
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_HERO,[{'period':'W3','value':13.78},{'period':'W4','value':34.09},{'period':'W5','value':21.76}],y_min=0,y_max=40),6.85,2.0,5.7,4.25)
    text(s,'NPS',.9,1.72,1,.22,11,INK,True);text(s,'RECENT PROBLEMS',6.95,1.72,2,.22,11,INK,True)
    # 9 native compare trend
    s=prs.slides.add_slide(blank);background(s);headline(s,"Harbour's aggregate result masks declining consideration among 18–34s.",'Weighted consideration · common scale · five waves')
    rows=[{'period':f'W{i+1}','series_1':HARBOUR_TOTAL[i],'series_2':HARBOUR_YOUNG[i]} for i in range(5)]
    NativeChartBuilder(s).add(ChartSpec(Primitive.TREND_COMPARE,rows,y_min=10,y_max=30),.9,1.8,11.4,4.8)
    # 10 text-led
    s=prs.slides.add_slide(blank);background(s,NAVY);text(s,'THREE QUESTIONS SHOULD SHAPE THE NEXT WAVE',.75,.65,10.8,.35,12,RGBColor(210,221,224),True);text(s,'What should the next wave tell us?',.75,1.25,10.8,.75,34,RGBColor(255,255,255),True)
    for i,(b,q) in enumerate([('PULSE','Are consideration gains translating into provider choice?'),('NORTHSTAR','Is the customer recovery continuing?'),('HARBOUR','Is younger-audience consideration declining or beginning to recover?')]):text(s,b,.85,2.55+i*1.15,1.5,.25,11,ACCENT,True);text(s,q,2.55,2.5+i*1.15,8.5,.45,18,RGBColor(255,255,255),True)
    prs.save(path);return path

if __name__=='__main__': print(build())
