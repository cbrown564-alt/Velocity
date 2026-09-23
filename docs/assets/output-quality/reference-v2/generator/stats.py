from data import *
from math import sqrt
from scipy.stats import norm

def cell(mask, w, base):
    """weighted share of base with mask; returns dict with p, n_unw, n_w, n_eff"""
    wb=w[base]; b=wb.sum()
    n=int(base.sum())
    if n==0: return dict(p=np.nan,n=0,nw=0.0,neff=0.0)
    p=w[base&mask].sum()/b
    neff=b**2/(wb**2).sum()
    return dict(p=p,n=n,nw=b,neff=neff)

def ztest(c1,c2):
    """two independent weighted proportions, effective bases; returns two-sided p-value"""
    if c1['n']<30 or c2['n']<30 or np.isnan(c1['p']) or np.isnan(c2['p']): return 1.0
    p=(c1['p']*c1['neff']+c2['p']*c2['neff'])/(c1['neff']+c2['neff'])
    se=sqrt(p*(1-p)*(1/c1['neff']+1/c2['neff']))
    if se==0: return 1.0
    z=(c1['p']-c2['p'])/se
    return 2*(1-norm.cdf(abs(z)))

def wmean(vals, w, base):
    s=base & vals.notna()
    if s.sum()==0: return dict(m=np.nan,n=0,sd=np.nan,neff=0)
    ww=w[s]; x=vals[s]
    m=(ww*x).sum()/ww.sum(); var=(ww*(x-m)**2).sum()/ww.sum()
    return dict(m=m,n=int(s.sum()),sd=sqrt(var),neff=ww.sum()**2/(ww**2).sum())
