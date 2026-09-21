"""Materialise reversible agency-style exports; validate recovery from written CSVs.

Reconstructed from the Turn 3 specification. This is agency-v2, not a claim to
reproduce the unavailable conversation-era agency-v1 byte hashes.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

from sbt001_eval import verify_canonical

PROJECT = (
    Path(__file__).resolve().parents[3]
    / "evals/research_quality/projects/synthetic/SBT-001"
)
BRANDS = ["northstar", "pulse", "mosaic", "lumen", "harbour"]
WEIGHTS = {1: "weight", 2: "WT_FINAL", 3: "rimwt", 4: "final_weight", 5: "wt"}
BINARY_LABELS = {0: "No", 1: "Yes", 97: "Not asked", 98: "Don't know", 99: "Refused"}


def source_name(name, wave, index):
    """Keep a unique, deterministic name for every canonical variable."""
    if name == "wt_final":
        return WEIGHTS[wave]
    if name.startswith("A2_"):
        brand = name.removeprefix("A2_")
        return {
            1: f"Q10_{BRANDS.index(brand) + 1}",
            2: f"aw_{brand}",
            3: f"AWARE_{brand.upper()}",
            4: f"q10_{BRANDS.index(brand) + 1}",
            5: f"brand_aw_{brand}",
        }[wave]
    if name.startswith("I_"):
        _, brand, attribute = name.split("_", 2)
        brand_id = BRANDS.index(brand) + 1
        return {
            1: f"Q20_{brand_id}_{attribute.upper()}",
            2: f"img_{brand}_{attribute}",
            3: f"BIMAGE_{brand.upper()}_{attribute.upper()}",
            4: f"q20_{attribute}_{brand_id}",
            5: f"brand_img_{brand}_{attribute}",
        }[wave]
    return {
        1: f"QX{index:03d}",
        2: f"field_{name.lower()}",
        3: f"FIELD_{name.upper()}",
        4: f"qx{index:03d}",
        5: f"survey_{name.lower()}",
    }[wave]


def mapping_for(data, wave):
    columns = []
    for index, name in enumerate(data.columns):
        values = data[name]
        rule = {
            "canonicalName": name,
            "sourceName": source_name(name, wave, index),
            "dtype": str(values.dtype),
            "valueMap": {},
        }
        # Restrict missing-code transformations to questionnaire measures. A 97
        # in an identifier, weight, or free text is never treated as missing.
        routed = (
            name.startswith(("F1_", "F2_", "I_", "E"))
            or name == "M3_pulse_campaign_recognition"
        )
        binary = name.startswith(("A1_", "A2_", "F2_", "I_", "M2_")) or name in [
            "E3_problem",
            "E4_contacted_service",
            "M3_pulse_campaign_recognition",
        ]
        if wave == 2 and binary:
            rule["valueMap"] = {str(k): v for k, v in BINARY_LABELS.items()}
        elif wave == 3 and routed:
            rule["valueMap"] = {"97": ""}
        elif wave == 4 and routed:
            rule["valueMap"] = {"97": "-99", "98": "-98", "99": "-97"}
        elif wave == 5 and name in ["S8_current_provider", "F3_preference"]:
            rule["valueMap"] = {b: b.title() for b in BRANDS + ["other"]}
        columns.append(rule)
    return {
        "wave": wave,
        "weight": WEIGHTS[wave],
        "reverseColumns": wave in [3, 5],
        "columns": columns,
    }


def encode(data, mapping):
    result = {}
    for rule in mapping["columns"]:
        values = data[rule["canonicalName"]].map(str)
        result[rule["sourceName"]] = values.map(lambda x: rule["valueMap"].get(x, x))
    encoded = pd.DataFrame(result)
    return encoded.iloc[:, ::-1] if mapping["reverseColumns"] else encoded


def recover(data, mapping):
    expected = [r["sourceName"] for r in mapping["columns"]]
    if len(set(expected)) != len(expected) or set(data.columns) != set(expected):
        raise ValueError("Agency columns do not match the declared mapping")
    recovered = {}
    for rule in mapping["columns"]:
        inverse = {v: k for k, v in rule["valueMap"].items()}
        values = data[rule["sourceName"]].map(lambda x: inverse.get(x, x))
        dtype = rule["dtype"]
        if dtype.startswith("int"):
            values = values.map(int).astype(dtype)
        elif dtype.startswith("float"):
            # Python float preserves the round-trip decimal representation;
            # pd.to_numeric can round a final bit on some pandas versions.
            values = values.map(float).astype(dtype)
        elif rule["valueMap"] and not values.isin(rule["valueMap"]).all():
            raise ValueError(f"Unknown category in {rule['sourceName']}")
        recovered[rule["canonicalName"]] = values.astype(dtype)
    return pd.DataFrame(recovered)


def build(project=PROJECT):
    generation = verify_canonical(project)
    agency = project / "agency_raw"
    agency.mkdir(parents=True, exist_ok=True)
    reference = project / "reference"
    report = {
        "projectId": "SBT-001",
        "version": "agency-v2",
        "generatorVersion": generation["generatorVersion"],
        "status": "PASS",
        "checks": {},
    }
    mappings = {}
    for wave in range(1, 6):
        source = project / "raw" / f"wave_{wave:02d}.csv"
        canonical = pd.read_csv(
            source, float_precision="round_trip", keep_default_na=False
        )
        mapping = mapping_for(canonical, wave)
        mappings[str(wave)] = mapping
        path = agency / f"agency_wave_{wave:02d}.csv"
        encode(canonical, mapping).to_csv(path, index=False, lineterminator="\n")
    mapping_path = reference / "agency_wave_mapping.json"
    mapping_path.write_text(
        json.dumps(
            {"projectId": "SBT-001", "version": "agency-v2", "waves": mappings},
            indent=2,
        )
        + "\n"
    )
    # Recover using only the serialized mapping and exports, not in-memory originals.
    persisted = json.loads(mapping_path.read_text())["waves"]
    for wave in range(1, 6):
        source = project / "raw" / f"wave_{wave:02d}.csv"
        canonical = pd.read_csv(
            source, float_precision="round_trip", keep_default_na=False
        )
        path = agency / f"agency_wave_{wave:02d}.csv"
        raw = pd.read_csv(path, dtype=str, keep_default_na=False)
        restored = recover(raw, persisted[str(wave)])
        mismatches = [c for c in canonical if not canonical[c].equals(restored[c])]
        exact = canonical.equals(restored)
        report["checks"][str(wave)] = {
            "rows": len(restored),
            "columns": len(restored.columns),
            "roundtripExact": exact,
            "mismatchedColumns": mismatches,
            "canonicalSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "agencySha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        if not exact:
            report["status"] = "FAIL"
    recipe = {
        "projectId": "SBT-001",
        "version": "agency-v2",
        "mapping": "agency_wave_mapping.json",
        "steps": [
            "Read every field as text with automatic NA detection disabled",
            "Require exactly the mapped source columns",
            "Invert each column-specific valueMap; do not globally replace missing values",
            "Restore declared canonical dtype, column order and weight name",
            "Preserve respondent order and verify exact equality against canonical waves",
        ],
        "implementation": "scripts/python/synthetic_tracker/generate_agency_exports.py:recover",
    }
    (reference / "agency_processing_recipe.json").write_text(
        json.dumps(recipe, indent=2) + "\n"
    )
    (project / "hidden/agency_prep_validation.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    if report["status"] != "PASS":
        raise ValueError(
            "Agency round-trip failed; inspect hidden/agency_prep_validation.json"
        )
    return report


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
