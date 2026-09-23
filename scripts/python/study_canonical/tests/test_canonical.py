"""Regression tests for the canonical study converter.

Run from the repository root:  python -m unittest discover -s scripts/python/study_canonical/tests -v
SBT-001 tests are skipped unless its raw waves have been generated.
"""
import importlib, sys, tempfile, unittest
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from canonical import validate, write_outputs, check_sav_roundtrip, MISSING  # noqa: E402
from adapters import ADAPTERS  # noqa: E402

SYN = ROOT / "evals/research_quality/projects/synthetic"


def available(mod):
    return mod != "sbt001" or (SYN / "SBT-001/raw/wave_01.csv").exists()


def source_frame(mod):
    sid = f"SBT-{mod[3:]}"
    if mod == "sbt001":
        return pd.concat([pd.read_csv(SYN / sid / "raw" / f"wave_{w:02d}.csv") for w in range(1, 6)], ignore_index=True)
    return pd.read_csv(SYN / sid / "model_inputs/respondents.csv")


def invert(df, study, mod):
    """Rebuild source values from canonical values using only the stored recode maps and the missing policy."""
    out = {}
    for v in study["variables"]:
        n, s = v["name"], df[v["name"]]
        if v["recode"]:
            inv = {code: text for text, code in v["recode"].items() if code is not None}
            blank_text = [t for t, c in v["recode"].items() if c is None]
            out[n] = s.map(lambda x: inv.get(int(x)) if pd.notna(x) else (blank_text[0] if blank_text else np.nan))
        elif mod == "sbt001" and v["type"] not in ("identifier", "weight") and n != "wave":
            back = s.copy()
            back[s == 98] = 99; back[s == 97] = 98; back[s.isna()] = 97
            out[n] = back
        else:
            out[n] = s
    return pd.DataFrame(out)


class Conversion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.built = {m: importlib.import_module(f"adapters.{m}").build(ROOT) for m in ADAPTERS if available(m)}

    def test_every_study_validates(self):
        for m, (df, study) in self.built.items():
            with self.subTest(m):
                rep = validate(df, study)
                self.assertTrue(rep["passed"], rep["errors"][:5])

    def test_conversion_is_lossless(self):
        for m, (df, study) in self.built.items():
            with self.subTest(m):
                src, inv = source_frame(m), invert(df, study, m)
                self.assertEqual(list(src.columns), list(inv.columns))
                for c in src.columns:
                    a, b = src[c], inv[c]
                    if a.dtype == object or b.dtype == object:
                        self.assertTrue((a.fillna("<NA>").astype(str) == b.fillna("<NA>").astype(str)).all(), c)
                    else:
                        self.assertTrue(np.array_equal(a.astype(float).fillna(-1).values, b.astype(float).fillna(-1).values), c)

    def test_one_missing_convention(self):
        for m, (df, study) in self.built.items():
            for v in study["variables"]:
                with self.subTest(m, var=v["name"]):
                    self.assertTrue(set(v["missing"]) <= set(MISSING))
                    self.assertFalse({x["code"] for x in v["values"]} & set(MISSING))

    def test_no_text_codes_remain(self):
        for m, (df, study) in self.built.items():
            for v in study["variables"]:
                if v["type"] != "identifier":
                    self.assertNotEqual(df[v["name"]].dtype, object, (m, v["name"]))

    def test_sav_round_trip(self):
        with tempfile.TemporaryDirectory() as t:
            for m, (df, study) in self.built.items():
                with self.subTest(m):
                    paths = write_outputs(df, study, Path(t) / m, m)
                    rt = check_sav_roundtrip(df, study, paths["sav"])
                    self.assertTrue(rt["passed"], rt["problems"][:5])


class ValidatorCatchesFaults(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.df, cls.study = importlib.import_module("adapters.sbt004").build(ROOT)

    def errors(self, df):
        return validate(df, self.study)["errors"]

    def test_value_outside_codebook(self):
        d = self.df.copy(); d.loc[0, "age_band"] = 7
        self.assertTrue(any("age_band" in e for e in self.errors(d)))

    def test_answer_outside_universe(self):
        d = self.df.copy(); i = d.index[d.planning_tool_28d == 0][0]; d.loc[i, "tool_satisfaction_5"] = 4
        self.assertTrue(any("tool_satisfaction_5" in e and "outside universe" in e for e in self.errors(d)))

    def test_bad_weight(self):
        d = self.df.copy(); d.loc[0, "wt_final"] = 0
        self.assertTrue(any("weight" in e for e in self.errors(d)))

    def test_text_value(self):
        d = self.df.copy(); d["age_band"] = d["age_band"].astype(object); d.loc[0, "age_band"] = "18-34"
        self.assertTrue(any("non-numeric" in e for e in self.errors(d)))


if __name__ == "__main__":
    unittest.main()
