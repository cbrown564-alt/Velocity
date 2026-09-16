import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.special import expit

OUT=Path(__file__).resolve().parents[3]/'evals/research_quality/projects/synthetic/SBT-001'; (OUT/'raw').mkdir(parents=True,exist_ok=True); (OUT/'reference').mkdir(exist_ok=True); (OUT/'hidden').mkdir(exist_ok=True)
SEED=564001; N=2000; B=['northstar','pulse','mosaic','lumen','harbour']
AGE=['18-24','25-34','35-44','45-54','55-64','65+']; AP=np.array([.11,.17,.17,.17,.16,.22])
REG=['London','South East','South West','East','Midlands','North','Wales','Scotland','Northern Ireland']; RP=np.array([.14,.14,.09,.09,.16,.17,.05,.09,.07])
G=['Man','Woman','Non-binary/another identity','Prefer not to say']; GP=[.485,.49,.015,.01]
INC=['<£20k','£20-39k','£40-59k','£60-99k','£100k+','Prefer not to say']; IP=[.18,.28,.24,.18,.07,.05]
ATTR=['reliable','value','innovative','trust','customer_service','premium','environmental','people_like_me']
BA={'northstar':2.4,'pulse':.25,'mosaic':1.,'lumen':.1,'harbour':1.25}; BU={'northstar':.7,'pulse':-.2,'mosaic':0.,'lumen':-.35,'harbour':-.05}
LOAD={k:np.array(v) for k,v in {'northstar':[-.05,.25,-.05,.15,.2,0,-.1],'pulse':[-.1,.05,.65,-.05,-.25,.25,.5],'mosaic':[.35,0,-.05,.15,.05,0,.05],'lumen':[-.4,.6,.35,.1,-.05,.05,.15],'harbour':[.15,-.05,-.4,.1,.4,-.1,-.3]}.items()}
IMG={'northstar':[1.3,.1,.2,.8,.45,.25,0,.35],'pulse':[.15,.55,1.1,.2,.25,.05,.25,.7],'mosaic':[.35,.8,.05,.35,.55,-.25,.1,.5],'lumen':[.65,-.35,.75,.45,.5,1.2,.3,.1],'harbour':[.5,.2,-.4,.35,.3,-.2,-.05,.1]}
COR=np.array([[1,-.2,-.05,.05,.05,0,.1],[-.2,1,.25,.25,.1,.05,-.05],[-.05,.25,1,.05,-.1,.25,.25],[.05,.25,.05,1,.15,0,-.05],[.05,.1,-.1,.15,1,-.05,-.45],[0,.05,.25,0,-.05,1,.1],[.1,-.05,.25,-.05,-.45,.1,1.]])
L=np.linalg.cholesky(COR)

def make_wave(w,seed):
 r=np.random.default_rng(np.random.SeedSequence([seed,w])); age=r.choice(AGE,N,p=AP); gender=r.choice(G,N,p=GP); region=r.choice(REG,N,p=RP); income=r.choice(INC,N,p=IP); Z=r.normal(size=(N,7))@L.T
 young=np.isin(age,AGE[:2]); old=np.isin(age,AGE[-2:]); aff=np.isin(income,['£60-99k','£100k+']); Z[:,2]+=young*.45-old*.25; Z[:,6]+=young*.35-old*.2; Z[:,0]-=aff*.3; Z[:,1]+=aff*.25
 if w==3:
  idx=r.choice(np.where(~young)[0],260,False); age[idx]=r.choice(AGE[:2],len(idx),p=[.4,.6]); Z[idx,2]+=.55; Z[idx,6]+=.45; young=np.isin(age,AGE[:2])
 d=pd.DataFrame({'respondent_id':[f'SBT001-W{w:02d}-{i+1:04d}' for i in range(N)],'wave':w,'S1_age':age,'S2_gender':gender,'S3_region':region,'S5_income':income}); d['S4_employment']=r.choice(['Full-time','Part-time','Self-employed','Student','Not working','Retired','Other'],N,p=[.44,.12,.08,.07,.07,.19,.03]); d['S6_decision_role']=r.choice(['Sole','Shared'],N,p=[.55,.45]); d['S7_contract_type']=r.choice(['SIM-only','Handset contract','PAYG','Other'],N,p=[.38,.45,.14,.03])
 aware={}; fam={}; util={}
 for b in B:
  aw=BA[b]+.06*(w-1)+(0.5 if b=='pulse' and w>=3 else 0)-(.03*(w-1) if b=='harbour' else 0); aware[b]=r.random(N)<expit(aw+.12*Z[:,2]+(.22*Z[:,5] if b=='pulse' else 0)); d[f'A2_{b}']=aware[b].astype(int)
  fs=np.clip(np.rint(2+1.15*expit(BU[b]+Z@LOAD[b])+r.normal(.4,.85,N)),1,5).astype(int); fam[b]=np.where(aware[b],fs,97); d[f'F1_{b}']=fam[b]
  u=BU[b]+Z@LOAD[b]; u+=((.04*(w-1)+((.5*young+.12*(~young)) if w>=3 else 0)) if b=='pulse' else 0); u-=((.14*(w-1)*young+.03*(w-1)*(~young)) if b=='harbour' else 0); u-=.06 if b=='northstar' and w>=4 else 0; util[b]=u+r.normal(0,.5,N)
  c=aware[b]&(r.random(N)<expit(-.75+u)); d[f'F2_{b}']=np.where(aware[b],c.astype(int),97); d[f'A1_{b}']=(r.random(N)<expit(-1.6+.8*aware[b]+.55*(fam[b]>=3)+(.5 if b=='northstar' else 0)+(.45 if b=='pulse' and w>=3 else 0))).astype(int)
  ad={'northstar':-.35,'pulse':-1.,'mosaic':-.8,'lumen':-1.1,'harbour':-.95}[b]+(1.3 if b=='pulse' and w==3 else .8 if b=='pulse' and w==4 else .45 if b=='pulse' and w==5 else 0); d[f'M2_{b}']=(r.random(N)<expit(ad+.45*Z[:,5])).astype(int)
 U=np.column_stack([util[b] for b in B]+[r.normal(-.15,.4,N)]); U[:,0]+=.35; U[:,4]+=old*.55; e=np.exp(U-U.max(1,keepdims=True)); pr=e/e.sum(1,keepdims=True); choices=np.array(B+['other']); provider=np.array([r.choice(choices,p=pr[i]) for i in range(N)]); d['S8_current_provider']=provider; d['S9_provider_tenure']=r.choice(['<1 year','1-2 years','3-4 years','5+ years'],N,p=[.2,.35,.28,.17])
 PU=np.column_stack([util[b]+r.normal(0,.45,N) for b in B]); PU=np.where(np.column_stack([aware[b] for b in B]),PU,-99); d['F3_preference']=np.array(B)[PU.argmax(1)]
 for b in B:
  elig=fam[b]>=3
  for j,a in enumerate(ATTR):
   sc=IMG[b][j]+.18*Z[:,1]+(.25*Z[:,2] if a=='innovative' else 0)+(.25*Z[:,0] if a=='value' else 0); sc+=(.45 if b=='pulse' and a=='innovative' and w>=3 else 0); sc+=(-.55 if b=='northstar' and a=='reliable' and w==4 else -.18 if b=='northstar' and a=='reliable' and w==5 else 0); vals=np.where(elig,(r.random(N)<expit(sc)).astype(int),97); d[f'I_{b}_{a}']=np.where(elig&(r.random(N)<.035),98,vals)
 sat=np.full(N,97); nps=np.full(N,97); problem=np.full(N,97); contact=np.full(N,97); css=np.full(N,97)
 for b in B:
  m=provider==b; base={'northstar':7.6,'pulse':7.2,'mosaic':7.4,'lumen':7.8,'harbour':6.9}[b]; ev=(-1.35 if b=='northstar' and w==4 else -.45 if b=='northstar' and w==5 else 0); sat[m]=np.clip(np.rint(base+ev+.3*Z[:,3]+r.normal(0,1.35,N)),0,10)[m]; nps[m]=np.clip(np.rint(base-.5+ev*1.15+.3*Z[:,4]+r.normal(0,1.8,N)),0,10)[m]; pp=.14+(.24 if b=='northstar' and w==4 else .08 if b=='northstar' and w==5 else 0); p=r.random(N)<pp; problem[m]=p[m].astype(int); c=r.random(N)<(.22+.2*p); contact[m]=c[m].astype(int); cm=m&(contact==1); css[cm]=np.clip(np.rint(7.1+ev*.8+r.normal(0,1.6,N)),0,10)[cm]
 d['E1_satisfaction']=sat; d['E2_nps']=nps; d['E3_problem']=problem; d['E4_contacted_service']=contact; d['E5_service_satisfaction']=css; d['M3_pulse_campaign_recognition']=97 if w<3 else (r.random(N)<expit((-1.05 if w==3 else -1.55 if w==4 else -2)+.55*Z[:,5]+.5*young)).astype(int); d['O1_reason_code']=r.choice(['price','network_quality','service','innovation','trust','habit','recommendation','other'],N,p=[.22,.2,.12,.12,.12,.12,.05,.05])
 g3=np.where(gender=='Man','Man',np.where(gender=='Woman','Woman','Other')); broad=np.where(np.isin(region,REG[:4]),'South',np.where(np.isin(region,REG[4:6]),'MidNorth','Nations')); cells=list(zip(age,g3,broad)); samp=pd.Series(cells).value_counts(normalize=True); gt={'Man':.485,'Woman':.49,'Other':.025}; bt={'South':RP[:4].sum(),'MidNorth':RP[4:6].sum(),'Nations':RP[6:].sum()}; wt=np.array([dict(zip(AGE,AP))[a]*gt[g]*bt[br]/samp[(a,g,br)] for a,g,br in cells]); wt=np.clip(wt,.35,3)
 for _ in range(12): wt=np.clip(wt/wt.mean(),.35,3)
 d['wt_final']=wt; return d

def prop(d,col,mask=None,weighted=True):
 x=d if mask is None else d.loc[mask]; y=(x[col]==1).astype(float); return np.average(y,weights=x.wt_final) if weighted else y.mean()
def nps(d,b):
 x=d[d.S8_current_provider==b].E2_nps; return 100*((x>=9).mean()-(x<=6).mean())
def metrics(ds):
 w1,w2,w3,w4,w5=ds; m={}; a2=w2.F2_pulse!=97; a3=w3.F2_pulse!=97; m['pulse_w3_weighted_uplift_pp']=100*(prop(w3,'F2_pulse',a3)-prop(w2,'F2_pulse',a2)); m['pulse_w3_unweighted_uplift_pp']=100*(prop(w3,'F2_pulse',a3,False)-prop(w2,'F2_pulse',a2,False)); m['pulse_unweighted_overstatement_pp']=m['pulse_w3_unweighted_uplift_pp']-m['pulse_w3_weighted_uplift_pp']; m['northstar_nps_w3']=nps(w3,'northstar'); m['northstar_nps_w4']=nps(w4,'northstar'); m['northstar_nps_drop']=m['northstar_nps_w4']-m['northstar_nps_w3']; m['northstar_awareness_w3']=100*prop(w3,'A2_northstar'); m['northstar_awareness_w4']=100*prop(w4,'A2_northstar'); m['northstar_awareness_move']=m['northstar_awareness_w4']-m['northstar_awareness_w3']; y1=w1.S1_age.isin(AGE[:2])&(w1.F2_harbour!=97); y5=w5.S1_age.isin(AGE[:2])&(w5.F2_harbour!=97); m['harbour_youth_consider_w1']=100*prop(w1,'F2_harbour',y1); m['harbour_youth_consider_w5']=100*prop(w5,'F2_harbour',y5); m['harbour_youth_decline']=m['harbour_youth_consider_w5']-m['harbour_youth_consider_w1']; m['pulse_recog_young_w3']=100*prop(w3,'M3_pulse_campaign_recognition',w3.S1_age.isin(AGE[:2])); m['pulse_recog_older_w3']=100*prop(w3,'M3_pulse_campaign_recognition',~w3.S1_age.isin(AGE[:2])); m['min_kish_ess']=min(d.wt_final.sum()**2/(d.wt_final.pow(2).sum()) for d in ds); return m
def gates(m): return {'pulse_w3_weighted_uplift':3<=m['pulse_w3_weighted_uplift_pp']<=10,'pulse_w3_unweighted_overstatement':m['pulse_unweighted_overstatement_pp']>=1.2,'northstar_w4_customer_experience_drop':m['northstar_nps_drop']<=-15,'northstar_w4_awareness_resilience':abs(m['northstar_awareness_move'])<2,'harbour_w1_w5_youth_decline':m['harbour_youth_decline']<=-5,'campaign_targeting':m['pulse_recog_young_w3']-m['pulse_recog_older_w3']>=5,'weight_ess':m['min_kish_ess']>=1500}

best=None; rejected=[]
for k in range(50):
 seed=SEED+k; ds=[make_wave(w,seed) for w in range(1,6)]; mm=metrics(ds); gg=gates(mm)
 if all(gg.values()): best=(seed,ds,mm,gg); break
 rejected.append({'seed':seed,'reasons':[x for x,v in gg.items() if not v]})
if best is None: raise RuntimeError('No seed passed frozen gates')
seed,ds,mm,gg=best
for w,d in enumerate(ds,1): d.to_csv(OUT/'raw'/f'wave_{w:02d}.csv',index=False)
cb={'projectId':'SBT-001','missingCodes':{'97':'structural/not applicable','98':'don\'t know','99':'refused/prefer not to say'},'variables':[]}; sample=ds[0]
for c in sample.columns:
 role='identifier' if c in ['respondent_id','wave'] else 'weight' if c=='wt_final' else 'profile' if c.startswith('S') else 'awareness' if c.startswith('A') else 'funnel' if c.startswith('F') else 'brand_image' if c.startswith('I_') else 'customer_experience' if c.startswith('E') else 'marketing' if c.startswith('M') else 'open_end' if c.startswith('O') else 'measure'; miss=[97,98,99] if c