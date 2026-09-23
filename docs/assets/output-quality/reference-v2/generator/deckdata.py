from compute import *
import json
df,meta=load()
W=[1,2,3,4]
ALL=lambda d: pd.Series(True,index=d.index)
def series(mf,bf=ALL):
    cs=[cell(mf(df[df.wave==w]).fillna(False).astype(bool),df[df.wave==w].wt,bf(df[df.wave==w])) for w in W]
    sig=[None]+[ztest(cs[i-1],cs[i])<ALPHA for i in range(1,4)]
    return dict(p=[round(c['p']*100,1) for c in cs],n=[c['n'] for c in cs],sig=sig,ch=[None]+[round((cs[i]['p']-cs[i-1]['p'])*100,1) for i in range(1,4)])
D={}
D['aware']={b:series(lambda d,b=b: d[f'aware_{b}']==1) for b in BR}
D['unaided']={b:series(lambda d,b=b: d[f'unaided_any_{b}']==1) for b in BR}
D['consider']={b:series(lambda d,b=b: d[f'consider_{b}'].isin([4,5])) for b in BR}
D['conv']={b:series(lambda d,b=b: d[f'consider_{b}'].isin([4,5]),lambda d,b=b: d[f'aware_{b}']==1) for b in BR}
D['p3m']={b:series(lambda d,b=b: d[f'used_p3m_{b}']==1) for b in BR}
D['pref']={b:series(lambda d,b=b: d.brand_pref==BR.index(b)+1) for b in BR}
D['adrec']={b:series(lambda d,b=b: d[f'adrecall_{b}']==1) for b in BR}
# image W4 among aware, with W3 for atlas
img={}
d4=df[df.wave==4]; d3=df[df.wave==3]
for b in ['atlas','beacon','meridian']:
    img[b]={}
    for c,a in ATTR:
        x=cell(d4[f'att_{c}_{b}'].isin([4,5]),d4.wt,d4[f'aware_{b}']==1)
        y=cell(d3[f'att_{c}_{b}'].isin([4,5]),d3.wt,d3[f'aware_{b}']==1)
        img[b][a]=dict(p=round(x['p']*100,1),n=x['n'],prev=round(y['p']*100,1),ch=round((x['p']-y['p'])*100,1),sig=ztest(x,y)<ALPHA)
D['image']=img
# atlas vs beacon image sig (independent approx not valid; skip)
# segment/age breakdown of Atlas aided + unaided W3 vs W4
seg=[]
for var,codes in [('segment',{1:'Core',2:'Growth',3:'Value'}),('age_band',{1:'18–34',2:'35–54',3:'55+'})]:
    for k,v in codes.items():
        row=dict(group=var,label=v)
        for m,mf in [('aware',lambda d: d.aware_atlas==1),('unaided',lambda d: d.unaided_any_atlas==1)]:
            a=cell(mf(d3),d3.wt,d3[var]==k); b=cell(mf(d4),d4.wt,d4[var]==k)
            row[m]=dict(w3=round(a['p']*100,1),w4=round(b['p']*100,1),ch=round((b['p']-a['p'])*100,1),sig=ztest(a,b)<ALPHA,n3=a['n'],n4=b['n'])
        seg.append(row)
tot=dict(group='total',label='All category buyers')
for m,mf in [('aware',lambda d: d.aware_atlas==1),('unaided',lambda d: d.unaided_any_atlas==1)]:
    a=cell(mf(d3),d3.wt,ALL(d3)); b=cell(mf(d4),d4.wt,ALL(d4))
    tot[m]=dict(w3=round(a['p']*100,1),w4=round(b['p']*100,1),ch=round((b['p']-a['p'])*100,1),sig=ztest(a,b)<ALPHA,n3=a['n'],n4=b['n'])
D['seg']=[tot]+seg
# NPS by wave
nps=[]
for w in W:
    d=df[(df.wave==w)&df.nps_atlas.notna()]; ww=d.wt; t=ww.sum()
    pro=ww[d.nps_atlas>=9].sum()/t*100; pas=ww[d.nps_atlas.between(7,8)].sum()/t*100; det=ww[d.nps_atlas<=6].sum()/t*100
    nps.append(dict(wave=w,n=len(d),pro=round(pro,1),pas=round(pas,1),det=round(det,1),nps=round(pro-det,1)))
D['nps']=nps
# NPS W3 vs W4 test of promoters minus detractors: bootstrap-free approx via variance of (x) where x=+1/0/-1
def npsvar(w):
    d=df[(df.wave==w)&df.nps_atlas.notna()]; x=np.where(d.nps_atlas>=9,1,np.where(d.nps_atlas<=6,-1,0)); ww=d.wt.values
    m=(ww*x).sum()/ww.sum(); v=(ww*(x-m)**2).sum()/ww.sum(); ne=ww.sum()**2/(ww**2).sum(); return m,v,ne
m3,v3,n3=npsvar(3); m4,v4,n4=npsvar(4); z=(m4-m3)/sqrt(v3/n3+v4/n4); D['nps_p']=float(2*(1-norm.cdf(abs(z))))
m1,v1,n1=npsvar(1); z=(m4-m1)/sqrt(v1/n1+v4/n4); D['nps_p_w1']=float(2*(1-norm.cdf(abs(z))))
D['labels']={w:WAVE_LBL[w] for w in W}; D['field']=FIELD
json.dump(D,open('deck.json','w'),indent=1,default=lambda o: bool(o) if isinstance(o,np.bool_) else float(o))
print(json.dumps({k:D[k] for k in ['nps','nps_p','nps_p_w1']},indent=0,default=str))
for k in ['aware','unaided','consider','conv']: print(k,{b:(v['p'],v['sig']) for b,v in D[k].items() if b in('atlas','beacon','meridian')})
for b in img: print(b,{a:(v['p'],v['prev'],v['sig']) for a,v in img[b].items()})
for r in D['seg']: print(r['label'],r['aware'],r['unaided'])
