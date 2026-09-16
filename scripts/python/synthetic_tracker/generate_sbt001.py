from sbt001_eval import *

rejected=[]; best=None
for k in range(50):
 seed=SEED+k; ds=[make_wave(w,seed) for w in range(1,6)]; mm=metrics(ds); gg=gates(mm)
 if all(gg.values()): best=(seed,ds,mm,gg); break
 rejected.append({'seed':seed,'reasons':[x for x,v in gg.items() if not v]})
if best is None: raise RuntimeError('No seed passed frozen gates')
seed,ds,mm,gg=best
for w,d in enumerate(ds,1): d.to_csv(OUT/'raw'/f'wave_{w:02d}.csv',index=False)

sample=ds[0]; cb={'projectId':'SBT-001','missingCodes':{'97':'structural/not applicable','98':"don't know",'99':'refused/prefer not to say'},'variables':[]}
for c in sample.columns:
 role='identifier' if c in ['respondent_id','wave'] else 'weight' if c=='wt_final' else 'profile' if c.startswith('S') else 'awareness' if c.startswith('A') else 'funnel' if c.startswith('F') else 'brand_image' if c.startswith('I_') else 'customer_experience' if c.startswith('E') else 'marketing' if c.startswith('M') else 'open_end' if c.startswith('O') else 'measure'; miss=[97,98,99] if c.startswith(('F1_','F2_','I_','E')) or c=='M3_pulse_campaign_recognition' else []; cb['variables'].append({'name':c,'role':role,'dtype':str(sample[c].dtype),'userMissingCodes':miss})
(OUT/'codebook.json').write_text(json.dumps(cb,indent=2))
processing={'projectId':'SBT-001','version':'1.0','steps':[{'id':'weight','action':'set_weight','variable':'wt_final'},{'id':'image_base','action':'define_base','rule':'Brand-image items use respondents with F1_[brand] >= 3; raw 97 is structural and excluded.'},{'id':'service_base','action':'define_base','rule':'E5 service satisfaction uses tracked-brand customers with E4_contacted_service == 1.'},{'id':'missing','action':'user_missing','rule':'Apply variable-specific codebook missing values; never globally collapse 97/98/99.'},{'id':'nps','action':'derive','rule':'Promoter E2_nps>=9; detractor<=6; NPS=100*(promoter%-detractor%) among current-provider respondents.'}]}
(OUT/'reference'/'processing_recipe.json').write_text(json.dumps(processing,indent=2)); (OUT/'reference'/'weighting_targets.json').write_text(json.dumps({'age':dict(zip(AGE,AP.tolist())),'gender':{'Man':.485,'Woman':.49,'Other':.025},'broadRegion':{'South':float(RP[:4].sum()),'MidNorth':float(RP[4:6].sum()),'Nations':float(RP[6:].sum())}},indent=2)); (OUT/'reference'/'variable_semantics.json').write_text(json.dumps({'brands':B,'attributes':ATTR,'notes':'See questionnaire.md; fictional brands only.'},indent=2))

struct={'rows_per_wave':[len(d) for d in ds],'unique_ids':len(set(pd.concat(ds).respondent_id))==N*5,'weight_bounds':[(float(d.wt_final.min()),float(d.wt_final.max())) for d in ds]}; iv=sv=0
for d in ds:
 for b in B:
  elig=d[f'F1_{b}']>=3
  for a in ATTR:
   x=d[f'I_{b}_{a}']; iv+=int(((~elig)&(x!=97)).sum())+int((elig&(x==97)).sum())
 eligible=np.isin(d.S8_current_provider,B)&(d.E4_contacted_service==1); sv+=int(((~eligible)&(d.E5_service_satisfaction!=97)).sum())+int((eligible&(d.E5_service_satisfaction==97)).sum())
struct['image_routing_violations']=iv; struct['service_routing_violations']=sv
mosaic=[]
for w,d in enumerate(ds,1):
 mask=(d.S2_gender=='Non-binary/another identity')&(d.F2_mosaic!=97); mosaic.append({'wave':w,'unweightedBase':int(mask.sum()),'weightedPct':float(100*prop(d,'F2_mosaic',mask))})
hard={k:bool(v) for k,v in gg.items()}; hard.update({'rows':struct['rows_per_wave']==[2000]*5,'unique_ids':struct['unique_ids'],'image_routing':iv==0,'service_routing':sv==0,'mosaic_low_base_trap':mosaic[3]['unweightedBase']<50 and abs(mosaic[3]['weightedPct']-mosaic[2]['weightedPct'])>10})
validation={'projectId':'SBT-001','generatorVersion':'synthetic_brand_tracker_v1','rootSeed':SEED,'selectedSeed':seed,'rejectedSeeds':rejected,'hardGates':hard,'metrics':{k:float(v) for k,v in mm.items()},'structural':struct,'lowBaseTrap':mosaic,'status':'PASS' if all(hard.values()) else 'FAIL','savExport':{'status':'OPTIONAL','note':'CSV is canonical; SAV conversion requires a compatible writer such as pyreadstat.'}}
(OUT/'hidden'/'validation_report.json').write_text(json.dumps(validation,indent=2))
events={'events':[{'eventId':'pulse_campaign_launch','wave':3,'validated':True,'evidence':['pulse_w3_weighted_uplift_pp','pulse_unweighted_overstatement_pp','pulse_recog_young_w3']},{'eventId':'northstar_service_incident','wave':4,'validated':True,'evidence':['northstar_nps_drop','northstar_awareness_move']},{'eventId':'northstar_partial_recovery','wave':5,'validated':True,'evidence':['generated event; detailed recovery gold deferred to E4']},{'eventId':'harbour_youth_decline','wave':'1-5','validated':True,'evidence':['harbour_youth_decline']}]}; (OUT/'hidden'/'planted_events.json').write_text(json.dumps(events,indent=2))
traps={'traps':[{'trapId':'TRAP_WEIGHT_01','validated':hard['pulse_w3_unweighted_overstatement'],'goldBehaviour':'Use wt_final; do not report unweighted surge as population movement.'},{'trapId':'TRAP_LOWBASE_01','validated':hard['mosaic_low_base_trap'],'goldBehaviour':'Demote/flag Wave 4 Mosaic movement in the tiny non-binary subgroup.','evidence':mosaic},{'trapId':'TRAP_ROUTING_01','validated':hard['service_routing'],'goldBehaviour':'E5 base is service-contacting current customers only.'},{'trapId':'TRAP_GRIDBASE_01','validated':hard['image_routing'],'goldBehaviour':'Image base is sufficiently familiar respondents only.'},{'trapId':'TRAP_FUNNEL_01','validated':True,'goldBehaviour':'Current provider and preference are separate.'},{'trapId':'TRAP_TREND_01','validated':hard['harbour_w1_w5_youth_decline'],'goldBehaviour':'Detect Harbour gradual youth decline across horizon.'}]}; (OUT/'hidden'/'traps.json').write_text(json.dumps(traps,indent=2))
truth={'projectId':'SBT-001','generatorVersion':'synthetic_brand_tracker_v1','rootSeed':SEED,'selectedChildSeed':seed,'rejectedSeeds':rejected,'truthLayers':{'world':'latent factors + brand utilities + events','measurement':'questionnaire.md + codebook.json','processing':'reference/processing_recipe.json','population':'reference/weighting_targets.json','sample':'hidden/validation_report.json','research':'hidden/planted_events.json + hidden/traps.json'},'events':events['events'],'traps':traps['traps']}; (OUT/'hidden'/'generation_truth.json').write_text(json.dumps(truth,indent=2))
print(json.dumps({'status':validation['status'],'selectedSeed':seed,'metrics':validation['metrics']},indent=2))
