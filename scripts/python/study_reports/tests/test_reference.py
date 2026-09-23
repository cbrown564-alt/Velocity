"""Check report-engine numbers against the independent reference analyses committed in evals/.

SBT-001: 147 reference analyses (turn4-v2). SBT-002: concept metrics, Holm pairwise tests and the
pre-specified interaction. SBT-001 is skipped unless its canonical files have been built.
"""
import json, sys, unittest
from pathlib import Path
import pandas as pd

HERE = Path(__file__).resolve().parents[1]; ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from engine import Study, share, wald  # noqa: E402
from archetypes.tracker import Tracker  # noqa: E402
from archetypes.concept_test import ConceptTest  # noqa: E402

SYN = ROOT / "evals/research_quality/projects/synthetic"
BR = ["northstar", "pulse", "mosaic", "lumen", "harbour"]
TOL = 1e-9


def sbt001_estimate(tr, st, a, wave):
    """Recompute one reference analysis at ``wave`` with the tracker's own measures."""
    metric, uni = a["metric"], a["universe"]
    aid = a["analysisId"].lower()
    brand = next((b for b in BR if b in metric or aid.startswith(b)), None)
    e = next((x for x in tr.ents if x["id"] == brand), None)
    age = st.col("S1_age")
    sub = None
    if "18-34" in uni or "18_34" in uni: sub = ("Age:18–34", age.isin([1, 2]))
    elif "35+" in uni or "35_plus" in uni: sub = ("Age:35+", age.isin([3, 4, 5, 6]))
    elif "non-binary" in uni: sub = ("Gender:nb", st.col("S2_gender") == 3)
    fam = metric.split(":")[0].split("_")[0]
    mid = {"A2": "aware", "aware": "aware", "consideration": "consider", "current": "current", "preference": "pref",
           "E2": "nps", "nps": "nps", "E1": "sat", "sat": "sat", "E3": "problem", "problem": "problem", "F2": "consider_aware"}
    if metric.startswith("I_") or metric == "reliability":
        attr = "reliable" if metric == "reliability" else metric.split("_", 2)[2]
        m = tr.M[f"img_{attr}"]
    elif metric.startswith("M3"):
        base = (st.col("wave") == wave) & sub[1] & st.valid("M3_pulse_campaign_recognition")
        return share(st.col("M3_pulse_campaign_recognition") == 1, base, st.w)
    else:
        key = "consideration" if metric.startswith("consideration_total") else "current" if metric.startswith("current_provider") \
            else "preference" if metric.startswith("preference") else fam
        m = tr.M[mid[key]]
    if a.get("weight") is None:  # unweighted diagnostic
        f = lambda s: s.format(id=e["id"], code=e["code"]) if s else s
        base = (st.col("wave") == wave) & (st.mask(f(m.get("base"))) if m.get("base") else st.all)
        if sub: base &= sub[1]
        return share(st.mask(f(m["num"])), base, pd.Series(1.0, index=st.df.index))
    return tr.est(m, e, wave, sub)


@unittest.skipUnless((SYN / "SBT-001/canonical/sbt_001.csv").exists(), "SBT-001 canonical files not built")
class SBT001Reference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st = Study(ROOT, "SBT-001")
        cls.tr = Tracker(cls.st, json.loads((HERE / "specs/sbt001.json").read_text()))
        cls.ref = json.loads((SYN / "SBT-001/reference/analysis/analysis_results.json").read_text())["analyses"]

    def test_all_reference_analyses(self):
        checked = 0
        for a in self.ref:
            with self.subTest(a["analysisId"]):
                r = a["result"]; e = sbt001_estimate(self.tr, self.st, a, a["wave"])
                scale = 100 if a["analysisType"] == "nps" or a["metric"] == "nps" else 1
                self.assertAlmostEqual(e.value, r["estimate"] * (1 if scale == 1 else 1), delta=1e-6 * scale, msg=a["analysisId"])
                self.assertEqual(e.n, r["unweightedBase"])
                if "comparison" in a:
                    b = sbt001_estimate(self.tr, self.st, a, a["comparisonWave"]); t = wald(b, e)
                    self.assertAlmostEqual(t.diff, a["comparison"]["difference"], delta=1e-6 * scale)
                    self.assertAlmostEqual(t.p, a["comparison"]["pValue"], delta=1e-6)
                checked += 1
        self.assertEqual(checked, len(self.ref))


class SBT002Reference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st = Study(ROOT, "SBT-002")
        cls.ct = ConceptTest(cls.st, json.loads((HERE / "specs/sbt002.json").read_text()))
        cls.ref = json.loads((SYN / "SBT-002/reference/analysis_results.json").read_text())
        cls.code = {"Flex": 1, "Plus": 2, "Simple": 3}

    def test_concept_metrics(self):
        for m, cells in self.ref["concept_metrics"].items():
            for cell, r in cells.items():
                with self.subTest(m=m, cell=cell):
                    e = self.ct.t2b(m, self.code[cell])
                    self.assertAlmostEqual(e.value * 100, r["top2_pct"], places=6)
                    self.assertEqual(e.n, r["n_unweighted"])
                    self.assertAlmostEqual(e.ess, r["n_eff"], places=4)

    def test_pairwise_holm(self):
        for m, pairs in self.ref["pairwise"].items():
            ests, pw, _ = self.ct.ranking(m)
            for p in pairs:
                with self.subTest(m=m, pair=(p["a"], p["b"])):
                    ok, d, t = self.ct.beats(pw, self.code[p["b"]], self.code[p["a"]])   # a minus b
                    self.assertAlmostEqual(d * 100, p["top2_diff_pp"], places=6)
                    self.assertAlmostEqual(t.p, p["p_raw"], places=8)
                    self.assertAlmostEqual(t.p_adj, p["p_holm"], places=8)
                    self.assertEqual(t.sig(), p["significant_holm"])

    def test_interaction_estimates(self):
        inter = {(i["measure"], i["a"], i["b"]): i for i in self.ct.interactions()}
        for m, r in self.ref["interactions"].items():
            with self.subTest(m=m):
                i = inter[(m, 1, 2)]   # Plus minus Flex
                self.assertAlmostEqual(i["diff"] * 100, r["diff_pp"], places=6)
                self.assertAlmostEqual(i["t"].se * 100, r["se_pp"], places=6)
                self.assertAlmostEqual(i["t"].p, r["p_raw"], places=8)


if __name__ == "__main__":
    unittest.main()
