*Recode negatively worded items into different variables

*recode optimism items

RECODE
  op2 op4 op6
  (1=5)  (2=4)  (3=3)  (4=2)  (5=1)  INTO  Rop2  Rop4  Rop6 .
EXECUTE .

*recode mastery items

RECODE
  mast1 mast3 mast4 mast6 mast7  (1=4)  (2=3)  (3=2)  (4=1) INTO 
  Rmast1 Rmast3 Rmast4 Rmast6 Rmast7   .
EXECUTE .

* recode perceived stress items

RECODE
  pss4 pss5 pss7 pss8   (1=5)  (2=4)  (3=3)  (4=2)  (5=1) INTO 
  Rpss4 Rpss5 Rpss7 Rpss8     .
EXECUTE .

*recode self esteem items

RECODE
  sest3 sest5 sest7 sest9 sest10  (1=4)  (2=3)  (3=2)  (4=1) INTO 
  Rsest3 Rsest5 Rsest7 Rsest9 Rsest10  .
EXECUTE .

*recode PCOISS items

RECODE
  pc1 pc2 pc7 pc11 pc15 pc16   (1=5)  (2=4)  (3=3)  (4=2)  (5=1) INTO 
  Rpc1 Rpc2 Rpc7 Rpc11 Rpc15 Rpc16 .
EXECUTE .

*Compute totals with rescored variables

COMPUTE toptim = op1+op3+op5+Rop2+Rop4+Rop6 .
EXECUTE .

COMPUTE tmast = mast2+mast5+Rmast1+Rmast3+Rmast4+Rmast6+Rmast7 .
EXECUTE .

COMPUTE tpcoiss = pc3+pc4+pc5+pc6+pc8+pc9+pc10+pc12+pc13+pc14+pc17+pc18+
 Rpc1+Rpc2+Rpc7+Rpc11+Rpc15+Rpc16 .
EXECUTE .

COMPUTE tslfest = sest1 + sest2 + sest4 + sest6 + sest8+ 
  Rsest3+Rsest5+Rsest7+Rsest9+Rsest10.
EXECUTE .

COMPUTE tposaff = pn1+pn4+pn6+pn7+pn9+pn12+pn13+pn15+pn17+pn18 .
EXECUTE .

COMPUTE tnegaff = pn2+pn3+pn5+pn8+pn10+pn11+pn14+pn16+pn19+pn20 .
EXECUTE .

COMPUTE tpstress = pss1 + pss2 + pss3 + pss6 + pss9 + pss10 + Rpss4 + Rpss5 +
  Rpss7 + Rpss8 .
EXECUTE .

COMPUTE tlifesat = lifsat1 + lifsat2 + lifsat3 + lifsat4 + lifsat5 .
EXECUTE .

