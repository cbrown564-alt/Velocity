from spec import *
from itertools import combinations
LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
MIN_SHOW=30; MIN_OK=50; ALPHA=0.05

def zmean(a,b):
    if a['n']<MIN_SHOW or b['n']<MIN_SHOW: return 1.0
    se=sqrt(a['sd']**2/a['neff']+b['sd']**2/b['neff'])
    return 1.0 if se==0 else 2*(1-norm.cdf(abs((a['m']-b['m'])/se)))

def run_table(t, df, groups):
    cols=[]; li=0
    for g,cl in groups:
        for lbl,mask in cl:
            cols.append(dict(group=g,label=lbl,mask=mask,letter=LETTERS[li])); li+=1
    w=df.wt; base_all=t['basefn'](df)
    out=dict(t=t,cols=cols,bases=[],rows=[])
    for c in cols:
        b=c['mask']&base_all
        out['bases'].append(dict(n=int(b.sum()),nw=float(w[b].sum()),neff=float(w[b].sum()**2/(w[b]**2).sum()) if b.sum() else 0))
    for kind,label,fn in t['rows']:
        vals=[]
        for c in cols:
            b=c['mask']&base_all
            if kind in('cat','net'):
                v=cell(fn(df).fillna(False).astype(bool),w,b); v['kind']='share'
            elif kind=='mean':
                v=wmean(fn(df),w,b); v['p']=v['m']; v['kind']='mean'
            elif kind=='score':
                pr=cell(df.nps_atlas>=9,w,b); de=cell(df.nps_atlas<=6,w,b)
                v=dict(p=(pr['p']-de['p'])*100 if pr['n'] else np.nan,n=pr['n'],kind='score')
            v['sig']=''
            vals.append(v)
        # significance within groups
        if kind!='score':
            for g in dict.fromkeys(c['group'] for c in cols):
                idx=[i for i,c in enumerate(cols) if c['group']==g]
                for i,j in combinations(idx,2):
                    a,bb=vals[i],vals[j]
                    if a['n']<MIN_OK or bb['n']<MIN_OK: continue
                    p=zmean(a,bb) if kind=='mean' else ztest(a,bb)
                    if p<ALPHA:
                        if a['p']>bb['p']: a['sig']+=cols[j]['letter']
                        else: bb['sig']+=cols[i]['letter']
        out['rows'].append(dict(kind=kind,label=label,vals=vals))
    return out

def trend_measures(df):
    """key measures by wave for each brand, with change vs previous wave and sig"""
    ms=[('Unaided awareness (any mention)','All category buyers',lambda d,b: d[f'unaided_any_{b}']==1,lambda d,b: pd.Series(True,index=d.index)),
        ('Aided awareness','All category buyers',lambda d,b: d[f'aware_{b}']==1,lambda d,b: pd.Series(True,index=d.index)),
        ('Consideration (top-two box), all buyers','All category buyers',lambda d,b: d[f'consider_{b}'].isin([4,5]),lambda d,b: pd.Series(True,index=d.index)),
        ('Consideration among those aware (conversion)','Aware of brand',lambda d,b: d[f'consider_{b}'].isin([4,5]),lambda d,b: d[f'aware_{b}']==1),
        ('Bought / drunk past 3 months','All category buyers',lambda d,b: d[f'used_p3m_{b}']==1,lambda d,b: pd.Series(True,index=d.index)),
        ('Most preferred brand','All category buyers',lambda d,b: d.brand_pref==BR.index(b)+1,lambda d,b: pd.Series(True,index=d.index)),
        ('Advertising recall (past month)','All category buyers',lambda d,b: d[f'adrecall_{b}']==1,lambda d,b: pd.Series(True,index=d.index))]
    res=[]
    waves=[1,2,3,4]
    for name,basedesc,mf,bf in ms:
        for b in BR:
            cells=[]
            for wv in waves:
                d=df[df.wave==wv]; cells.append(cell(mf(d,b).fillna(False).astype(bool),d.wt,bf(d,b)))
            p=ztest(cells[-2],cells[-1]); p1=ztest(cells[0],cells[-1])
            res.append(dict(measure=name,basedesc=basedesc,brand=BRAND_NAMES[b],cells=cells,p_prev=p,p_first=p1))
    return res
