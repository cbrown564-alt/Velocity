from stats import *
BRAND_NAMES={'atlas':'Atlas','beacon':'Beacon','meridian':'Meridian','solstice':'Solstice','cardinal':'Cardinal'}
CUR=4; PREV=3
WAVE_LBL={1:'W1 Q3 2025',2:'W2 Q4 2025',3:'W3 Q1 2026',4:'W4 Q2 2026',5:'W5 Q3 2026'}
FIELD={1:'14–27 Jul 2025',2:'13–26 Oct 2025',3:'12–25 Jan 2026',4:'13–26 Apr 2026',5:'13–26 Jul 2026'}
ATTR=[('taste','Tastes great'),('worth','Is worth the price'),('innov','Is innovative'),('forme','Is for someone like me'),
      ('avail','Is widely available'),('premium','Is a premium brand'),('trust','Is a brand I trust'),('sustain','Is environmentally sustainable')]
CONS={5:'Would definitely consider',4:'Would probably consider',3:'Might or might not consider',2:'Would probably not consider',1:'Would definitely not consider',98:"Don't know"}
AGREE={5:'Strongly agree',4:'Somewhat agree',3:'Neither agree nor disagree',2:'Somewhat disagree',1:'Strongly disagree',98:"Don't know"}

def banner(df):
    """list of groups: (group label, [(col label, mask)]) ; wave group uses whole df, others current wave"""
    cur=df.wave==CUR
    g=[('Wave',[(WAVE_LBL[PREV],df.wave==PREV),(WAVE_LBL[CUR]+' (Total)',cur)])]
    for var,lbl,codes in [('segment','Segment',{1:'Core',2:'Growth',3:'Value'}),('age_band','Age',{1:'18–34',2:'35–54',3:'55+'}),
                          ('gender','Gender',{1:'Male',2:'Female'}),('region','Region',{1:'North',2:'East',3:'South',4:'West'})]:
        g.append((lbl,[(v,cur&(df[var]==k)) for k,v in codes.items()]))
    return g

# Row kinds: ('cat',label,maskfn) ('net',label,maskfn) ('mean',label,seriesfn) ('score',label,fn(sub)->value) ('dk',...)
def T(id,title,q,basedesc,basefn,rows,section):
    return dict(id=id,title=title,q=q,basedesc=basedesc,basefn=basefn,rows=rows,section=section)

def build_tables(meta):
    L=meta.column_names_to_labels; tabs=[]; n=0
    def nid():
        nonlocal n; n+=1; return n
    ALL=lambda d: pd.Series(True,index=d.index)
    # Q1 first mention
    rows=[('cat',v,(lambda k: lambda d: d.unaided_first==k)(k)) for k,v in meta.variable_value_labels['unaided_first'].items()]
    tabs.append(T(nid(),'First brand mentioned (unaided)',L['unaided_first'],'All category buyers',ALL,rows,'Brand awareness'))
    grid=lambda pre,val: [('cat',BRAND_NAMES[b],(lambda b: lambda d: d[f'{pre}_{b}']==val)(b)) for b in BR]
    tabs.append(T(nid(),'Unaided brand awareness (any mention)','Q1a. Thinking of ready-to-drink chilled coffee, which brands can you think of? (unaided, any mention)','All category buyers',ALL,grid('unaided_any',1),'Brand awareness'))
    tabs.append(T(nid(),'Aided brand awareness','Q2. Which of these brands of ready-to-drink chilled coffee have you heard of, even if only by name?','All category buyers',ALL,grid('aware',1),'Brand awareness'))
    rows=[('cat',BRAND_NAMES[b],(lambda b: lambda d: d[f'consider_{b}'].isin([4,5]))(b)) for b in BR]
    tabs.append(T(nid(),'Brand consideration (top-two box) — share of all category buyers','Q3. How likely would you be to consider buying each brand the next time you buy ready-to-drink chilled coffee? Would definitely + probably consider. Respondents not aware of a brand are counted as not considering it.','All category buyers',ALL,rows,'Consideration'))
    for b in BR:
        rows=[('net','Consider (top-two box)',(lambda b: lambda d: d[f'consider_{b}'].isin([4,5]))(b))]
        rows+=[('cat',CONS[k],(lambda b,k: lambda d: d[f'consider_{b}']==k)(b,k)) for k in (5,4,3,2,1)]
        rows+=[('net','Not consider (bottom-two box)',(lambda b: lambda d: d[f'consider_{b}'].isin([1,2]))(b)),
               ('cat',"Don't know",(lambda b: lambda d: d[f'consider_{b}']==98)(b)),
               ('mean','Mean score (1–5, excl. don\'t know)',(lambda b: lambda d: d[f'consider_{b}'].where(d[f'consider_{b}']<=5))(b))]
        tabs.append(T(nid(),f'Consideration of {BRAND_NAMES[b]}',L[f'consider_{b}'].replace(' (aware brands only)',''),f'Category buyers aware of {BRAND_NAMES[b]}',(lambda b: lambda d: d[f'aware_{b}']==1)(b),rows,'Consideration'))
    tabs.append(T(nid(),'Brands bought or drunk in the past 3 months','Q4. Which of these brands have you bought or drunk in the past 3 months? Asked for brands the respondent is aware of; non-aware counted as not bought.','All category buyers',ALL,grid('used_p3m',1),'Usage and preference'))
    rows=[('cat',v,(lambda k: lambda d: d.brand_pref==k)(k)) for k,v in meta.variable_value_labels['brand_pref'].items()]
    tabs.append(T(nid(),'Most preferred brand',L['brand_pref'],'All category buyers',ALL,rows,'Usage and preference'))
    nps=lambda d: d.nps_atlas
    rows=[('score','Net Promoter Score (promoters − detractors)',None),
          ('net','Promoters (9–10)',lambda d: d.nps_atlas>=9),('net','Passives (7–8)',lambda d: d.nps_atlas.between(7,8)),('net','Detractors (0–6)',lambda d: d.nps_atlas<=6)]
    rows+=[('cat',meta.variable_value_labels['nps_atlas'].get(float(k),str(k)),(lambda k: lambda d: d.nps_atlas==k)(k)) for k in range(10,-1,-1)]
    rows+=[('mean','Mean score (0–10)',nps)]
    tabs.append(T(nid(),'Likelihood to recommend Atlas (NPS)','Q6. How likely are you to recommend Atlas to a friend or colleague? (0–10)','Bought or drank Atlas in the past 3 months',lambda d: d.nps_atlas.notna(),rows,'Usage and preference'))
    for b in BR:
        rows=[('cat',a,(lambda b,c: lambda d: d[f'att_{c}_{b}'].isin([4,5]))(b,c)) for c,a in ATTR]
        tabs.append(T(nid(),f'Brand image: {BRAND_NAMES[b]} (agree, top-two box)',f'Q7. How much do you agree or disagree that {BRAND_NAMES[b]}… ? Strongly + somewhat agree.',f'Category buyers aware of {BRAND_NAMES[b]}',(lambda b: lambda d: d[f'aware_{b}']==1)(b),rows,'Brand image'))
    tabs.append(T(nid(),'Advertising recall (past month)','Q8. Have you seen or heard any advertising for these brands in the past month?','All category buyers',ALL,grid('adrecall',1),'Advertising'))
    return tabs
