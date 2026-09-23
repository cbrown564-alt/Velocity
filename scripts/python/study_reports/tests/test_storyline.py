"""Storyline guards: the generated narrative must find the developments the data supports and avoid
the traps built into the studies (unweighted surges, low bases, routed-base comparisons).
These tests read hidden answer-key files only to evaluate; generation never reads them."""
import json, sys, unittest
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]; ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from engine import Study  # noqa: E402
from archetypes.tracker import Tracker  # noqa: E402
from archetypes.concept_test import ConceptTest  # noqa: E402
SYN = ROOT / "evals/research_quality/projects/synthetic"


@unittest.skipUnless((SYN / "SBT-001/canonical/sbt_001.csv").exists(), "SBT-001 canonical files not built")
class Tracker001(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tr = Tracker(Study(ROOT, "SBT-001"), json.loads((HERE / "specs/sbt001.json").read_text()))
        cls.stories, _ = cls.tr.stories()
        cls.deck, *_ = cls.tr.deck()

    def has(self, brand, kind, wave=None):
        return any(c["e"]["id"] == brand and c["kind"] == kind and (wave is None or c.get("wave") == wave) for c in self.stories)

    def test_planted_developments_found(self):
        self.assertTrue(self.has("pulse", "event", 3), "Pulse W3 step change")
        self.assertTrue(self.has("northstar", "event", 4), "Northstar W4 experience drop")
        self.assertTrue(any(c["e"]["id"] == "harbour" and c["kind"] == "subgroup" and c["lead"]["sub"] == "18–34" for c in self.stories), "Harbour youth decline")

    def test_weighting_trap_not_claimed(self):
        # Pulse consideration among the aware, W2->W3: significant unweighted only.
        for c in self.stories:
            for mem in c["members"]:
                self.assertFalse(mem["e"]["id"] == "pulse" and mem["m"]["id"] == "consider_aware" and c.get("wave") == 3)

    def test_no_claim_on_low_base(self):
        for c in self.stories:
            for mem in c["members"]:
                self.assertTrue(all(x.n >= 50 for x in mem["series"]) or c["kind"] == "event")
        titles = " ".join(s.get("title", "") for s in self.deck["slides"])
        self.assertNotIn("Non-binary", titles)

    def test_never_claims_stability(self):
        titles = " ".join(s.get("title", "") for s in self.deck["slides"]).lower()
        for w in ("stable", "steady", "unchanged", "flat"):
            self.assertNotIn(w, titles)


class Concept002(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ct = ConceptTest(Study(ROOT, "SBT-002"), json.loads((HERE / "specs/sbt002.json").read_text()))
        cls.deck, *_ = cls.ct.deck()

    def test_routed_measure_flagged(self):
        r = self.ct.routing("premium_value_5")
        self.assertTrue(r["flag"]); self.assertEqual(self.ct.name(r["low"]), "Plus")

    def test_no_overclaimed_winner_on_purchase_intent(self):
        ests, pw, order = self.ct.ranking("purchase_intent_5")
        ok, _, _ = self.ct.beats(pw, order[1], order[0])
        title = next(s["title"] for s in self.deck["slides"] if s["type"] == "bar")
        self.assertEqual(ok, "leads" in title)

    def test_prespecified_interaction_reported(self):
        self.assertTrue(any("food explorers" in s["title"].lower() for s in self.deck["slides"]))


if __name__ == "__main__":
    unittest.main()
