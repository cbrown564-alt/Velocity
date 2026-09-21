"""Regression checks for SBT-001's generated benchmark, isolated from frozen files."""

import contextlib
import io
import copy
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest

import pandas as pd
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[4]


class BenchmarkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.scripts = cls.root / "scripts/python/synthetic_tracker"
        shutil.copytree(ROOT / "scripts/python/synthetic_tracker", cls.scripts)
        shutil.copytree(
            ROOT / "evals/research_quality/schemas",
            cls.root / "evals/research_quality/schemas",
        )
        cls.project = cls.root / "evals/research_quality/projects/synthetic/SBT-001"
        cls.run_script("generate_sbt001.py")
        cls.run_script("build_sbt001_analysis.py")
        cls.waves = [
            pd.read_csv(
                cls.project / "raw" / f"wave_{w:02d}.csv", float_precision="round_trip"
            )
            for w in range(1, 6)
        ]
        sys.path.insert(0, str(cls.scripts))
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                cls.analysis_functions = runpy.run_path(
                    str(cls.scripts / "build_sbt001_analysis.py")
                )
            cls.routing = staticmethod(
                runpy.run_path(str(cls.scripts / "sbt001_eval.py"))[
                    "image_routing_violations"
                ]
            )
        finally:
            sys.path.remove(str(cls.scripts))
        cls.analysis = json.loads(
            (cls.project / "reference/analysis/analysis_results.json").read_text()
        )

    @classmethod
    def run_script(cls, name):
        subprocess.run(
            [sys.executable, str(cls.scripts / name)],
            check=True,
            capture_output=True,
            text=True,
        )

    def test_image_routing_excludes_unaware_and_all_missing_codes(self):
        for d in self.waves:
            for brand in ["northstar", "pulse", "mosaic", "lumen", "harbour"]:
                eligible = d[f"F1_{brand}"].isin([3, 4, 5])
                image = d.filter(regex=f"^I_{brand}_")
                self.assertTrue(image.loc[~eligible].eq(97).all().all(), brand)
                self.assertFalse(image.loc[eligible].eq(97).any().any(), brand)

    def test_image_estimate_has_independently_computed_valid_base(self):
        d = self.waves[1]
        eligible = d.F1_pulse.isin([3, 4, 5]) & d.I_pulse_innovative.isin([0, 1])
        rows = d.loc[eligible]
        result = next(
            a["result"]
            for a in self.analysis["analyses"]
            if a["analysisId"] == "PULSE_INNOVATION_W2"
        )
        self.assertEqual(result["unweightedBase"], len(rows))
        self.assertAlmostEqual(result["weightedBase"], rows.wt_final.sum())
        self.assertAlmostEqual(
            result["estimate"],
            (rows.I_pulse_innovative * rows.wt_final).sum() / rows.wt_final.sum(),
        )
        self.assertAlmostEqual(
            result["ess"], rows.wt_final.sum() ** 2 / (rows.wt_final**2).sum()
        )

    def test_reference_findings_conform_to_declared_schema(self):
        schema = json.loads(
            (
                self.root / "evals/research_quality/schemas/finding.schema.json"
            ).read_text()
        )
        validator = Draft202012Validator(schema)
        findings = json.loads(
            (self.project / "reference/analysis/findings.json").read_text()
        )["findings"]
        for finding in findings:
            validator.validate(finding)
            self.assertEqual(
                [e["analysisRef"] for e in finding["evidence"]], finding["analysisRefs"]
            )
        invalid = copy.deepcopy(findings[0])
        invalid["evidence"] = []
        self.assertFalse(validator.is_valid(invalid))

    def test_unweighted_diagnostic_is_labelled_unweighted(self):
        diagnostic = next(
            a
            for a in self.analysis["analyses"]
            if a["analysisId"] == "PULSE_CONSID_W2_W3_UNWEIGHTED"
        )
        self.assertIsNone(diagnostic["weight"])

    def test_agency_exports_roundtrip_from_disk(self):
        script = self.scripts / "generate_agency_exports.py"
        self.assertTrue(
            script.exists(), "The agency package needs its reproducible generator"
        )
        self.run_script(script.name)
        report = json.loads(
            (self.project / "hidden/agency_prep_validation.json").read_text()
        )
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(len(report["checks"]), 5)
        for check in report["checks"].values():
            self.assertTrue(check["roundtripExact"])
            self.assertEqual(check["rows"], 2000)
            self.assertEqual(check["columns"], 85)
        before = {
            p.name: p.read_bytes() for p in (self.project / "agency_raw").glob("*.csv")
        }
        self.run_script(script.name)
        self.assertEqual(
            before,
            {
                p.name: p.read_bytes()
                for p in (self.project / "agency_raw").glob("*.csv")
            },
        )

    def test_missing_codes_do_not_enter_weighted_denominator(self):
        tiny = pd.DataFrame(
            {"answer": [1, 0, 97, 98, 99], "wt_final": [2.0, 1.0, 100.0, 100.0, 100.0]}
        )
        result = self.analysis_functions["wp"](tiny, "answer")
        self.assertEqual(result["unweightedBase"], 2)
        self.assertEqual(result["weightedBase"], 3)
        self.assertAlmostEqual(result["estimate"], 2 / 3)
        self.assertAlmostEqual(result["ess"], 9 / 5)
        self.assertEqual(
            self.analysis_functions["wp"](tiny, "answer", weighted=False)["estimate"],
            0.5,
        )

    def test_routing_validator_rejects_missing_code_as_familiar(self):
        columns = {}
        for brand in ["northstar", "pulse", "mosaic", "lumen", "harbour"]:
            columns[f"A2_{brand}"] = [1, 1, 1, 1, 1, 0, 0, 0]
            columns[f"F1_{brand}"] = [1, 2, 3, 4, 5, 97, 98, 99]
            for attribute in [
                "reliable",
                "value",
                "innovative",
                "trust",
                "customer_service",
                "premium",
                "environmental",
                "people_like_me",
            ]:
                columns[f"I_{brand}_{attribute}"] = [97, 97, 1, 0, 98, 97, 97, 97]
        tiny = pd.DataFrame(columns)
        self.assertEqual(self.routing(tiny), 0)
        for row in [5, 6, 7]:
            corrupt = tiny.copy()
            corrupt.loc[row, "I_pulse_innovative"] = 1
            self.assertEqual(self.routing(corrupt), 1)

    def test_agency_encoding_preserves_missing_meanings_labels_and_weights(self):
        module = runpy.run_path(str(self.scripts / "generate_agency_exports.py"))
        tiny = pd.DataFrame(
            {
                "respondent_id": ["001", "002", "003", "004", "005"],
                "F2_pulse": [0, 1, 97, 98, 99],
                "I_pulse_reliable": [0, 1, 97, 98, 99],
                "S8_current_provider": [
                    "pulse",
                    "other",
                    "northstar",
                    "mosaic",
                    "harbour",
                ],
                "F3_preference": ["other", "pulse", "lumen", "harbour", "northstar"],
                "wt_final": [0.35, 3.0, 1.2, 1.1234567891234567, 0.88],
            }
        )
        for wave in range(1, 6):
            mapping = module["mapping_for"](tiny, wave)
            encoded = module["encode"](tiny, mapping)
            restored = module["recover"](encoded, mapping)
            pd.testing.assert_frame_equal(restored, tiny, check_exact=True)
            if wave == 2:
                self.assertIn("Don't know", encoded.to_numpy())
                corrupted = encoded.copy()
                field = next(
                    r["sourceName"]
                    for r in mapping["columns"]
                    if r["canonicalName"] == "F2_pulse"
                )
                corrupted.loc[0, field] = "Unexpected label"
                with self.assertRaises(ValueError):
                    module["recover"](corrupted, mapping)
            if wave == 3:
                self.assertIn("", encoded.to_numpy())
                self.assertIn("98", encoded.to_numpy())
                self.assertIn("99", encoded.to_numpy())
            if wave == 4:
                for value in ["-99", "-98", "-97"]:
                    self.assertIn(value, encoded.to_numpy())
        self.assertEqual(tiny.loc[0, "respondent_id"], "001")

    def test_stale_or_modified_canonical_data_is_rejected(self):
        source = self.project / "raw/wave_01.csv"
        original = source.read_bytes()
        try:
            source.write_bytes(original + b"\n")
            for name in ["build_sbt001_analysis.py", "generate_agency_exports.py"]:
                result = subprocess.run(
                    [sys.executable, str(self.scripts / name)],
                    capture_output=True,
                    text=True,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("does not match its generation report", result.stderr)
        finally:
            source.write_bytes(original)
        report_path = self.project / "hidden/validation_report.json"
        original_report = report_path.read_bytes()
        report = json.loads(original_report)
        report["generatorVersion"] = "synthetic_brand_tracker_v1"
        try:
            report_path.write_text(json.dumps(report))
            result = subprocess.run(
                [sys.executable, str(self.scripts / "build_sbt001_analysis.py")],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Regenerate canonical data", result.stderr)
        finally:
            report_path.write_bytes(original_report)

    def test_generator_and_analysis_are_repeatable(self):
        paths = list((self.project / "raw").glob("*.csv")) + list(
            (self.project / "reference/analysis").glob("*.json")
        )
        before = {p: p.read_bytes() for p in paths}
        self.run_script("generate_sbt001.py")
        self.run_script("build_sbt001_analysis.py")
        self.assertEqual(before, {p: p.read_bytes() for p in paths})


if __name__ == "__main__":
    unittest.main()
