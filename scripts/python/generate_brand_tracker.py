#!/usr/bin/env python3
"""Brand Tracker synthetic dataset generator (Phase A of the Brand Tracker Demo plan).

Generates a 5-wave fictional "chilled coffee" brand tracker (Atlas / Beacon /
Meridian / Solstice / Cardinal), a deliberately messy raw variant of wave 4,
and a ground-truth JSON with weighted funnel metrics, wave-over-wave deltas
(two-proportion z on Kish effective sample sizes), segment cuts, attribute
deltas, achieved weighting margins and the planted-storyline verification.

The storyline (docs/workstreams/deck_native/10_brand_tracker_demo_plan.md §2.3)
lives entirely in scripts/python/brand_tracker_config.json — this script is the
mechanism, the config is the plant.

Determinism: all randomness flows from numpy default_rng seeded from the config
seed plus fixed stream offsets. Regenerating produces identical data (verified
via the dataframe checksums printed at the end). The .sav *bytes* are NOT
byte-stable across runs because pyreadstat embeds a creation timestamp in the
file header; compare data checksums, not file hashes.

Usage (from the repository root):

    python3 scripts/python/generate_brand_tracker.py

Outputs:
    public/examples/brandtracker_w4.sav
    test_data/fixtures/brand_tracker/brandtracker_w{1,2,3,5}.sav
    test_data/fixtures/brand_tracker/brandtracker_w4_raw.sav
    validation/brand_tracker_ground_truth.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pyreadstat

Z_CRITICAL_95 = 1.959964

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), "brand_tracker_config.json")

DEMO_WAVE = "w4"
DEMO_PATH = os.path.join("public", "examples", "brandtracker_w4.sav")
FIXTURE_DIR = os.path.join("test_data", "fixtures", "brand_tracker")
GROUND_TRUTH_PATH = os.path.join("validation", "brand_tracker_ground_truth.json")


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def quota_counts(n: int, probs) -> np.ndarray:
    """Largest-remainder apportionment of n into len(probs) integer counts."""
    raw = np.asarray(probs, dtype=float) * n
    base = np.floor(raw).astype(int)
    remainder = n - int(base.sum())
    order = np.argsort(-(raw - base), kind="stable")
    base[order[:remainder]] += 1
    return base


def quota_select(scores: np.ndarray, k: int) -> np.ndarray:
    """Boolean mask with exactly k True entries: the k largest scores."""
    out = np.zeros(len(scores), dtype=bool)
    k = max(0, min(int(k), len(scores)))
    if k > 0:
        idx = np.argsort(-scores, kind="stable")[:k]
        out[idx] = True
    return out


def assign_exact(rng: np.random.Generator, n: int, codes, probs) -> np.ndarray:
    """Assign codes with exact largest-remainder counts, randomly permuted."""
    counts = quota_counts(n, probs)
    pool = np.repeat(np.asarray(codes), counts)
    return rng.permutation(pool)


def ordered_split(scores: np.ndarray, codes, probs) -> np.ndarray:
    """Assign codes so that higher scores get later codes, with exact counts.

    codes must be ordered low→high (e.g. [1, 2, 3]); the lowest-scoring
    respondents receive the first code.
    """
    n = len(scores)
    counts = quota_counts(n, probs)
    order = np.argsort(scores, kind="stable")
    out = np.empty(n, dtype=float)
    start = 0
    for code, cnt in zip(codes, counts):
        out[order[start : start + cnt]] = code
        start += cnt
    return out


def rake_weights(df: pd.DataFrame, margins: dict, iterations: int = 80) -> np.ndarray:
    """IPF/rake to marginal targets. margins: {column: {code: share}}."""
    w = np.ones(len(df), dtype=float)
    for _ in range(iterations):
        for col, targets in margins.items():
            codes = df[col].to_numpy()
            total = w.sum()
            for code, share in targets.items():
                mask = codes == code
                current = w[mask].sum()
                if current > 0:
                    w[mask] *= (share * total) / current
    return w / w.mean()


def weighted_share(numerator: np.ndarray, weights: np.ndarray, denominator: np.ndarray):
    """Weighted % of denominator base, with Kish effective n of the base."""
    wd = weights[denominator]
    total = wd.sum()
    if total <= 0:
        return 0.0, 0.0, 0.0
    pct = 100.0 * weights[numerator & denominator].sum() / total
    n_eff = total**2 / (wd**2).sum()
    return pct, n_eff, total


def two_prop_z(p1_pct: float, n1_eff: float, p2_pct: float, n2_eff: float):
    """Pooled two-proportion z-test on weighted (effective) bases."""
    p1, p2 = p1_pct / 100.0, p2_pct / 100.0
    if n1_eff <= 0 or n2_eff <= 0:
        return 0.0, 1.0, False
    pooled = (p1 * n1_eff + p2 * n2_eff) / (n1_eff + n2_eff)
    se = math.sqrt(max(pooled * (1 - pooled), 1e-12) * (1 / n1_eff + 1 / n2_eff))
    z = (p2 - p1) / se if se > 0 else 0.0
    p_value = 2 * (1 - normal_cdf(abs(z)))
    return z, p_value, abs(z) >= Z_CRITICAL_95


def mean_diff_z(m1: float, v1: float, n1_eff: float, m2: float, v2: float, n2_eff: float):
    """Unpooled z-test for weighted means (composite / NPS scores)."""
    se = math.sqrt(v1 / max(n1_eff, 1e-9) + v2 / max(n2_eff, 1e-9))
    z = (m2 - m1) / se if se > 0 else 0.0
    p_value = 2 * (1 - normal_cdf(abs(z)))
    return z, p_value, abs(z) >= Z_CRITICAL_95


def normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def weighted_mean_var(values: np.ndarray, weights: np.ndarray):
    total = weights.sum()
    mean = float((values * weights).sum() / total)
    var = float(((values - mean) ** 2 * weights).sum() / total)
    n_eff = float(total**2 / (weights**2).sum())
    return mean, var, n_eff


def r4(x) -> float:
    return round(float(x), 4)


# ---------------------------------------------------------------------------
# Wave generation
# ---------------------------------------------------------------------------

class WaveData:
    def __init__(self, key: str, index: int, meta: dict, df: pd.DataFrame):
        self.key = key
        self.index = index  # 0-based position in the wave list
        self.meta = meta
        self.df = df


def generate_wave(cfg: dict, wave_meta: dict, wave_index: int) -> pd.DataFrame:
    seed = cfg["seed"]
    n = wave_meta["n"]
    wave_code = wave_meta["code"]
    brands = cfg["brands"]
    brand_keys = [b["key"] for b in brands]
    seg_keys = cfg["segments"]["keys"]
    sel_noise = cfg["noise"]["selection"]

    def rng_for(stream: int) -> np.random.Generator:
        return np.random.default_rng([seed, wave_code, stream])

    # --- Demographics -------------------------------------------------------
    rng = rng_for(1)
    bands = cfg["sample"]["age_bands"]
    band_codes = [b["code"] for b in bands]
    age_band = assign_exact(rng, n, band_codes, cfg["sample"]["sample_distribution"]["age_band"])
    age = np.zeros(n, dtype=int)
    for b in bands:
        mask = age_band == b["code"]
        age[mask] = rng.integers(b["lo"], b["hi"] + 1, size=int(mask.sum()))

    gender = assign_exact(rng_for(2), n, [1, 2], cfg["sample"]["sample_distribution"]["gender"])
    region = assign_exact(rng_for(3), n, [1, 2, 3, 4], cfg["sample"]["sample_distribution"]["region"])
    urbanicity_rng = rng_for(4)
    urbanicity = urbanicity_rng.choice([1, 2, 3], size=n, p=cfg["sample"]["urbanicity_distribution"])

    # Segment: exact quota within age band (drives the Growth/under-35 coupling)
    seg_rng = rng_for(5)
    segment = np.zeros(n, dtype=int)
    for b in bands:
        mask = age_band == b["code"]
        probs = cfg["segments"]["by_age_band"][str(b["code"])]
        segment[mask] = assign_exact(seg_rng, int(mask.sum()), [1, 2, 3], probs)

    # Income by segment, with refusals
    inc_rng = rng_for(6)
    income = np.zeros(n, dtype=float)
    for seg_code, seg_key in zip([1, 2, 3], seg_keys):
        mask = segment == seg_code
        probs = cfg["sample"]["income_by_segment"][seg_key]
        income[mask] = inc_rng.choice([1, 2, 3, 4, 5], size=int(mask.sum()), p=probs)
    refused = inc_rng.random(n) < cfg["missing_rates"]["income_refused"]
    income[refused] = 99

    # Interview date within the fielding window
    date_rng = rng_for(7)
    start = datetime.strptime(wave_meta["field_start"], "%Y-%m-%d")
    end = datetime.strptime(wave_meta["field_end"], "%Y-%m-%d")
    span = (end - start).days
    int_date = [start + timedelta(days=int(d)) for d in date_rng.integers(0, span + 1, size=n)]

    # --- Latent brand affinity ----------------------------------------------
    aff_rng = rng_for(8)
    affinity = {}
    for bk in brand_keys:
        seg_tilt = np.asarray(cfg["affinity_tilts"]["segment"][bk])[segment - 1]
        age_tilt = np.asarray(cfg["affinity_tilts"]["age_band"][bk])[age_band - 1]
        affinity[bk] = seg_tilt + age_tilt + aff_rng.normal(0.0, 1.0, size=n)

    # --- Awareness (aided, then unaided nested inside aided) -----------------
    aware = {}
    unaided = {}
    metrics = cfg["brand_metrics"]

    def cell_quota_select(rates_by_cell, scores):
        mask = np.zeros(n, dtype=bool)
        for seg_code in [1, 2, 3]:
            for b in bands:
                cell = (segment == seg_code) & (age_band == b["code"])
                cn = int(cell.sum())
                if cn == 0:
                    continue
                rate = rates_by_cell(seg_code, b["code"])
                k = int(round(cn * min(max(rate, 0.02), 0.97)))
                idx = np.flatnonzero(cell)
                sub = quota_select(scores[idx], k)
                mask[idx[sub]] = True
        return mask

    for bi, bk in enumerate(brand_keys):
        m = metrics[bk]
        noise_rng = rng_for(20 + bi)
        aided_scores = affinity[bk] + sel_noise * noise_rng.normal(0.0, 1.0, size=n)
        if "aided_by_segment" in m:
            seg_rates = m["aided_by_segment"]
            age_adj = m["aided_age_adjust"]
            aware[bk] = cell_quota_select(
                lambda s, a: (seg_rates[seg_keys[s - 1]][wave_index] + age_adj[str(a)][wave_index]) / 100.0,
                aided_scores,
            )
        else:
            k = int(round(n * m["aided"][wave_index] / 100.0))
            aware[bk] = quota_select(aided_scores, k)

        un_scores = affinity[bk] + sel_noise * noise_rng.normal(0.0, 1.0, size=n)
        un_scores[~aware[bk]] = -np.inf  # unaided recall implies aided recognition
        if "unaided_by_segment" in m:
            seg_rates = m["unaided_by_segment"]
            age_adj = m["unaided_age_adjust"]
            unaided[bk] = cell_quota_select(
                lambda s, a: (seg_rates[seg_keys[s - 1]][wave_index] + age_adj[str(a)][wave_index]) / 100.0,
                un_scores,
            )
        else:
            k = int(round(n * m["unaided"][wave_index] / 100.0))
            unaided[bk] = quota_select(un_scores, k)
        # cell quota can exceed the aware pool only if rates were misconfigured;
        # -inf scores keep unaided strictly inside aware regardless.
        unaided[bk] &= aware[bk]

    # --- Consideration (5-pt, aware brands only, DK=98) -----------------------
    consider = {}
    splits = cfg["scale_splits"]
    for bi, bk in enumerate(brand_keys):
        crng = rng_for(40 + bi)
        col = np.full(n, np.nan)
        aware_idx = np.flatnonzero(aware[bk])
        dk = crng.random(len(aware_idx)) < cfg["missing_rates"]["consider_dk"]
        col[aware_idx[dk]] = 98
        answering = aware_idx[~dk]
        conv = metrics[bk]["consider_t2b_of_aware"][wave_index] / 100.0
        k_t2b = int(round(len(answering) * conv))
        scores = affinity[bk][answering] + sel_noise * crng.normal(0.0, 1.0, size=len(answering))
        t2b = quota_select(scores, k_t2b)
        t2b_idx = answering[t2b]
        rest_idx = answering[~t2b]
        s45 = affinity[bk][t2b_idx] + sel_noise * crng.normal(0.0, 1.0, size=len(t2b_idx))
        col[t2b_idx] = ordered_split(s45, [4, 5], splits["consider_t2b"])
        s123 = affinity[bk][rest_idx] + sel_noise * crng.normal(0.0, 1.0, size=len(rest_idx))
        col[rest_idx] = ordered_split(s123, [1, 2, 3], splits["consider_rest"])
        consider[bk] = col

    # --- Usage P3M (nested in awareness, correlated with consideration) ------
    used = {}
    for bi, bk in enumerate(brand_keys):
        urng = rng_for(60 + bi)
        col = np.full(n, np.nan)
        aware_idx = np.flatnonzero(aware[bk])
        col[aware_idx] = 0
        conv = metrics[bk]["usage_of_aware"][wave_index] / 100.0
        k = int(round(len(aware_idx) * conv))
        t2b_flag = np.isin(consider[bk][aware_idx], [4, 5]).astype(float)
        scores = affinity[bk][aware_idx] + 1.2 * t2b_flag + sel_noise * urng.normal(0.0, 1.0, size=len(aware_idx))
        sel = quota_select(scores, k)
        col[aware_idx[sel]] = 1
        used[bk] = col

    # --- Unaided first mention ------------------------------------------------
    ufrng = rng_for(80)
    unaided_first = np.zeros(n, dtype=float)
    mention_matrix = np.column_stack([unaided[bk] for bk in brand_keys])
    first_scores = np.column_stack(
        [affinity[bk] + 0.5 * ufrng.normal(0.0, 1.0, size=n) for bk in brand_keys]
    )
    first_scores[~mention_matrix] = -np.inf
    any_mention = mention_matrix.any(axis=1)
    unaided_first[any_mention] = np.argmax(first_scores[any_mention], axis=1) + 1
    other_share = cfg["unaided_first"]["other_brand_share_of_non_mentioners"]
    non = np.flatnonzero(~any_mention)
    is_other = ufrng.random(len(non)) < other_share
    unaided_first[non[is_other]] = 6
    unaided_first[non[~is_other]] = 7

    # --- Brand preference -------------------------------------------------------
    prng = rng_for(81)
    pref_scores = np.column_stack(
        [
            affinity[bk]
            + 0.8 * (consider[bk] == 5)
            + 0.4 * (consider[bk] == 4)
            + 0.7 * (used[bk] == 1)
            + 0.5 * prng.normal(0.0, 1.0, size=n)
            for bk in brand_keys
        ]
    )
    candidate = np.column_stack([np.isin(consider[bk], [4, 5]) for bk in brand_keys])
    pref_scores[~candidate] = -np.inf
    brand_pref = np.where(candidate.any(axis=1), np.argmax(pref_scores, axis=1) + 1, 6).astype(float)

    # --- NPS (Atlas P3M users only) ---------------------------------------------
    nrng = rng_for(82)
    nps = np.full(n, np.nan)
    users_idx = np.flatnonzero(used["atlas"] == 1)
    shares = cfg["nps"]["class_shares"][wave_meta["key"]]  # promoter, passive, detractor
    counts = quota_counts(len(users_idx), shares)
    scores = (
        affinity["atlas"][users_idx]
        + 0.8 * (consider["atlas"][users_idx] == 5)
        + sel_noise * nrng.normal(0.0, 1.0, size=len(users_idx))
    )
    order = np.argsort(-scores, kind="stable")
    promoters = users_idx[order[: counts[0]]]
    passives = users_idx[order[counts[0] : counts[0] + counts[1]]]
    detractors = users_idx[order[counts[0] + counts[1] :]]
    nps[promoters] = nrng.choice([9, 10], size=len(promoters), p=cfg["nps"]["promoter_value_probs"])
    nps[passives] = nrng.choice([7, 8], size=len(passives), p=cfg["nps"]["passive_value_probs"])
    nps[detractors] = nrng.choice(
        [0, 1, 2, 3, 4, 5, 6], size=len(detractors), p=cfg["nps"]["detractor_value_probs"]
    )

    # --- Attribute battery (aware brands only, DK=98) ------------------------------
    attributes = {}
    for bi, bk in enumerate(brand_keys):
        arng = rng_for(100 + bi)
        aware_idx = np.flatnonzero(aware[bk])
        consider_centered = np.where(np.isin(consider[bk], [1, 2, 3, 4, 5]), consider[bk] - 3, 0.0)
        for attr in cfg["attributes"]:
            ak = attr["key"]
            col = np.full(n, np.nan)
            dk = arng.random(len(aware_idx)) < cfg["missing_rates"]["attribute_dk"]
            col[aware_idx[dk]] = 98
            answering = aware_idx[~dk]
            rate = metrics[bk]["attributes_t2b_of_aware"][ak][wave_index] / 100.0
            k = int(round(len(answering) * rate))
            scores = (
                affinity[bk][answering]
                + 0.6 * consider_centered[answering]
                + sel_noise * arng.normal(0.0, 1.0, size=len(answering))
            )
            t2b = quota_select(scores, k)
            t2b_idx = answering[t2b]
            rest_idx = answering[~t2b]
            s45 = affinity[bk][t2b_idx] + sel_noise * arng.normal(0.0, 1.0, size=len(t2b_idx))
            col[t2b_idx] = ordered_split(s45, [4, 5], splits["attribute_t2b"])
            s123 = affinity[bk][rest_idx] + sel_noise * arng.normal(0.0, 1.0, size=len(rest_idx))
            col[rest_idx] = ordered_split(s123, [1, 2, 3], splits["attribute_rest"])
            attributes[(ak, bk)] = col

    # --- Ad recall (total base) ------------------------------------------------------
    adrecall = {}
    for bi, bk in enumerate(brand_keys):
        rrng = rng_for(140 + bi)
        k = int(round(n * metrics[bk]["adrecall"][wave_index] / 100.0))
        scores = affinity[bk] + 0.5 * aware[bk] + sel_noise * rrng.normal(0.0, 1.0, size=n)
        adrecall[bk] = quota_select(scores, k)

    # --- Assemble dataframe -------------------------------------------------------------
    data = {
        "resp_id": wave_code * 100000 + np.arange(1, n + 1),
        "wave": np.full(n, wave_code, dtype=int),
        "int_date": int_date,
        "cat_buyer": np.ones(n, dtype=int),
        "age": age,
        "age_band": age_band,
        "gender": gender,
        "region": region,
        "income_band": income,
        "urbanicity": urbanicity,
        "segment": segment,
        "unaided_first": unaided_first,
    }
    for bk in brand_keys:
        data[f"unaided_any_{bk}"] = unaided[bk].astype(int)
    for bk in brand_keys:
        data[f"aware_{bk}"] = aware[bk].astype(int)
    for bk in brand_keys:
        data[f"consider_{bk}"] = consider[bk]
    for bk in brand_keys:
        data[f"used_p3m_{bk}"] = used[bk]
    data["brand_pref"] = brand_pref
    data["nps_atlas"] = nps
    for attr in cfg["attributes"]:
        for bk in brand_keys:
            data[f"att_{attr['key']}_{bk}"] = attributes[(attr["key"], bk)]
    for bk in brand_keys:
        data[f"adrecall_{bk}"] = adrecall[bk].astype(int)

    df = pd.DataFrame(data)

    # --- Rim weight -----------------------------------------------------------------------
    pop = cfg["sample"]["population_margins"]
    margins = {
        "age_band": {c["code"]: s for c, s in zip(bands, pop["age_band"])},
        "gender": {1: pop["gender"][0], 2: pop["gender"][1]},
        "region": {i + 1: s for i, s in enumerate(pop["region"])},
    }
    df["wt"] = rake_weights(df, margins)
    return df


def validate_funnel_integrity(cfg: dict, df: pd.DataFrame, wave_key: str) -> None:
    """Fail loudly if nested-funnel rules are violated."""
    brand_keys = [b["key"] for b in cfg["brands"]]
    errors: list[str] = []

    for bk in brand_keys:
        aware = df[f"aware_{bk}"].to_numpy() == 1
        consider = df[f"consider_{bk}"].to_numpy()
        used = df[f"used_p3m_{bk}"].to_numpy()
        unaided = df[f"unaided_any_{bk}"].to_numpy() == 1

        if np.any(unaided & ~aware):
            errors.append(f"{wave_key}: unaided_any_{bk}=1 but aware_{bk}=0")
        if np.any(np.isin(consider, [1, 2, 3, 4, 5, 98]) & ~aware):
            errors.append(f"{wave_key}: consider_{bk} answered but not aware")
        if np.any((used == 1) & ~aware):
            errors.append(f"{wave_key}: used_p3m_{bk}=1 but not aware")
        for attr in cfg["attributes"]:
            col = df[f"att_{attr['key']}_{bk}"].to_numpy()
            if np.any(np.isin(col, [1, 2, 3, 4, 5, 98]) & ~aware):
                errors.append(f"{wave_key}: att_{attr['key']}_{bk} answered but not aware")

    nps = df["nps_atlas"].to_numpy()
    atlas_users = df["used_p3m_atlas"].to_numpy() == 1
    if np.any(~np.isnan(nps) & ~atlas_users):
        errors.append(f"{wave_key}: nps_atlas present but respondent is not an Atlas P3M user")
    if np.any(atlas_users & np.isnan(nps)):
        errors.append(f"{wave_key}: Atlas P3M user missing nps_atlas")

    if errors:
        raise RuntimeError("Funnel integrity violations:\n  " + "\n  ".join(errors))


# ---------------------------------------------------------------------------
# SAV metadata + writers
# ---------------------------------------------------------------------------


def brand_name(cfg, bk):
    return next(b["name"] for b in cfg["brands"] if b["key"] == bk)


def build_labels(cfg: dict, wave_meta: dict):
    brand_keys = [b["key"] for b in cfg["brands"]]
    names = {bk: brand_name(cfg, bk) for bk in brand_keys}
    category = cfg["category"]

    consider_labels = {
        1: "Would definitely not consider",
        2: "Would probably not consider",
        3: "Might or might not consider",
        4: "Would probably consider",
        5: "Would definitely consider",
        98: "Don't know",
    }
    agree_labels = {
        1: "Strongly disagree",
        2: "Somewhat disagree",
        3: "Neither agree nor disagree",
        4: "Somewhat agree",
        5: "Strongly agree",
        98: "Don't know",
    }
    nps_labels = {0: "0 - Not at all likely", 10: "10 - Extremely likely"}
    nps_labels.update({i: str(i) for i in range(1, 10)})

    column_labels = {
        "resp_id": "Respondent ID",
        "wave": "Tracking wave",
        "int_date": "Interview date",
        "cat_buyer": f"S2. Bought {category} in the past 3 months",
        "age": "D1. Age (years)",
        "age_band": "D1b. Age band (derived from D1)",
        "gender": "D2. Gender",
        "region": "D3. Region",
        "income_band": "D4. Household income band",
        "urbanicity": "D5. Area type",
        "segment": "SEG. Consumer segment (from segmentation model)",
        "unaided_first": f"Q1. Thinking of {category}, which brand comes to mind first? (unaided, first mention)",
        "brand_pref": "Q5. And which ONE of these brands do you most prefer?",
        "nps_atlas": f"Q6. How likely are you to recommend {names['atlas']} to a friend or colleague? (0-10; {names['atlas']} P3M buyers only)",
        "wt": "Analysis weight (rim: age x gender x region)",
    }
    value_labels = {
        "wave": {w["code"]: w["label"] for w in cfg["waves"]},
        "cat_buyer": {1: "Yes - bought in past 3 months"},
        "age_band": {b["code"]: b["label"] for b in cfg["sample"]["age_bands"]},
        "gender": {int(k): v for k, v in cfg["sample"]["gender_labels"].items()},
        "region": {int(k): v for k, v in cfg["sample"]["region_labels"].items()},
        "income_band": {**{int(k): v for k, v in cfg["sample"]["income_labels"].items()}, 99: "Refused"},
        "urbanicity": {int(k): v for k, v in cfg["sample"]["urbanicity_labels"].items()},
        "segment": {int(k): v for k, v in cfg["segments"]["labels"].items()},
        "unaided_first": {
            **{i + 1: names[bk] for i, bk in enumerate(brand_keys)},
            6: "Another brand (not listed)",
            7: "No brand mentioned",
        },
        "brand_pref": {**{i + 1: names[bk] for i, bk in enumerate(brand_keys)}, 6: "None of these"},
        "nps_atlas": nps_labels,
    }
    missing_ranges = {"income_band": [99.0]}

    for bk in brand_keys:
        column_labels[f"unaided_any_{bk}"] = f"Q1a. Unaided brand awareness - any mention: {names[bk]}"
        value_labels[f"unaided_any_{bk}"] = {0: "Not mentioned", 1: "Mentioned"}
        column_labels[f"aware_{bk}"] = (
            f"Q2. Which of these brands of {category} have you heard of, even if only by name? - {names[bk]}"
        )
        value_labels[f"aware_{bk}"] = {0: "No", 1: "Yes - aware"}
        column_labels[f"consider_{bk}"] = (
            f"Q3. How likely would you be to consider buying each brand the next time you buy {category}? - {names[bk]} (aware brands only)"
        )
        value_labels[f"consider_{bk}"] = consider_labels
        missing_ranges[f"consider_{bk}"] = [98.0, 99.0]
        column_labels[f"used_p3m_{bk}"] = (
            f"Q4. Which of these brands have you bought or drunk in the past 3 months? - {names[bk]} (aware brands only)"
        )
        value_labels[f"used_p3m_{bk}"] = {0: "No", 1: "Yes - bought/drunk in past 3 months"}
        column_labels[f"adrecall_{bk}"] = (
            f"Q8. Have you seen or heard any advertising for these brands in the past month? - {names[bk]}"
        )
        value_labels[f"adrecall_{bk}"] = {0: "No", 1: "Yes"}

    for attr in cfg["attributes"]:
        for bk in brand_keys:
            var = f"att_{attr['key']}_{bk}"
            column_labels[var] = (
                f"Q7. How much do you agree or disagree that each brand {attr['statement']}? - {names[bk]} (aware brands only)"
            )
            value_labels[var] = agree_labels
            missing_ranges[var] = [98.0, 99.0]

    variable_formats = {"resp_id": "F8.0", "age": "F3.0", "wt": "F10.6"}
    for col in column_labels:
        if col not in variable_formats and col not in ("int_date", "wt"):
            variable_formats.setdefault(col, "F3.0")

    return column_labels, value_labels, missing_ranges, variable_formats


def write_clean_wave(cfg: dict, wave: WaveData, path: str):
    column_labels, value_labels, missing_ranges, variable_formats = build_labels(cfg, wave.meta)
    df = wave.df
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pyreadstat.write_sav(
        df,
        path,
        row_compress=True,
        file_label=f"Brand Tracker - {cfg['category']} - {wave.meta['label']}",
        column_labels={k: v for k, v in column_labels.items() if k in df.columns},
        variable_value_labels={k: v for k, v in value_labels.items() if k in df.columns},
        missing_ranges={k: v for k, v in missing_ranges.items() if k in df.columns},
        variable_format={k: v for k, v in variable_formats.items() if k in df.columns},
    )


def write_raw_wave4(cfg: dict, wave: WaveData, path: str):
    """The messy 'raw agency file' variant of wave 4 (plan §2.4)."""
    raw_cfg = cfg["raw_wave4"]
    brand_keys = [b["key"] for b in cfg["brands"]]
    df = wave.df.copy()

    # 1. age numeric only - no derived band
    df = df.drop(columns=["age_band"])

    # 2. consideration scale coded in REVERSED label order vs waves 1-3
    for bk in brand_keys:
        col = df[f"consider_{bk}"]
        df[f"consider_{bk}"] = col.where(~col.isin([1, 2, 3, 4, 5]), 6 - col)

    # 3. two attribute variables renamed (atlas + beacon worth only)
    renames = dict(raw_cfg["renamed_attribute_variables"])
    df = df.rename(columns=renames)

    # 4. weight renamed with a poor label
    df = df.rename(columns={"wt": raw_cfg["weight_name"]})

    # 5. junk decoy column: respondent body weight in kg
    decoy = raw_cfg["decoy"]
    drng = np.random.default_rng([cfg["seed"], wave.meta["code"], 999])
    base = np.where(
        df["gender"].to_numpy() == 1,
        decoy["mean"] + decoy["gender_shift"],
        decoy["mean"] - decoy["gender_shift"] * 0.7,
    )
    kg = np.clip(drng.normal(base, decoy["sd"]), decoy["lo"], decoy["hi"]).round(1)
    insert_at = list(df.columns).index("gender") + 1
    df.insert(insert_at, decoy["name"], kg)

    column_labels, value_labels, missing_ranges, variable_formats = build_labels(cfg, wave.meta)
    reversed_consider = {
        1: "Would definitely consider",
        2: "Would probably consider",
        3: "Might or might not consider",
        4: "Would probably not consider",
        5: "Would definitely not consider",
        98: "Don't know",
    }
    for bk in brand_keys:
        value_labels[f"consider_{bk}"] = reversed_consider
    for old_name, new_name in renames.items():
        column_labels[new_name] = column_labels.pop(old_name)
        value_labels[new_name] = value_labels.pop(old_name)
        missing_ranges[new_name] = missing_ranges.pop(old_name)
        variable_formats[new_name] = variable_formats.pop(old_name)
    column_labels[raw_cfg["weight_name"]] = raw_cfg["weight_label"]
    variable_formats[raw_cfg["weight_name"]] = "F10.6"
    column_labels[decoy["name"]] = decoy["label"]
    variable_formats[decoy["name"]] = "F6.1"

    os.makedirs(os.path.dirname(path), exist_ok=True)
    pyreadstat.write_sav(
        df,
        path,
        row_compress=True,
        file_label=f"BT_{wave.meta['label'].split(' ')[0]}_FINAL_v3 (raw field export)",
        column_labels={k: v for k, v in column_labels.items() if k in df.columns},
        variable_value_labels={k: v for k, v in value_labels.items() if k in df.columns},
        missing_ranges={k: v for k, v in missing_ranges.items() if k in df.columns},
        variable_format={k: v for k, v in variable_formats.items() if k in df.columns},
    )


# ---------------------------------------------------------------------------
# Ground truth
# ---------------------------------------------------------------------------

def funnel_metrics(cfg: dict, df: pd.DataFrame) -> dict:
    """Weighted funnel metrics for every brand in one wave."""
    w = df["wt"].to_numpy()
    n = len(df)
    all_mask = np.ones(n, dtype=bool)
    out = {}
    for b in cfg["brands"]:
        bk = b["key"]
        aware = df[f"aware_{bk}"].to_numpy() == 1
        consider = df[f"consider_{bk}"].to_numpy()
        answering = np.isin(consider, [1, 2, 3, 4, 5])
        t2b = np.isin(consider, [4, 5])
        used = df[f"used_p3m_{bk}"].to_numpy() == 1

        unaided_pct, n_eff_total, _ = weighted_share(df[f"unaided_any_{bk}"].to_numpy() == 1, w, all_mask)
        aided_pct, _, _ = weighted_share(aware, w, all_mask)
        t2b_total_pct, _, _ = weighted_share(t2b, w, all_mask)
        t2b_ans_pct, n_eff_ans, base_ans = weighted_share(t2b, w, answering)
        used_total_pct, _, _ = weighted_share(used, w, all_mask)
        used_aware_pct, n_eff_aware, _ = weighted_share(used, w, aware)
        pref_code = [x["code"] for x in cfg["brands"] if x["key"] == bk][0]
        pref_pct, _, _ = weighted_share(df["brand_pref"].to_numpy() == pref_code, w, all_mask)
        adrecall_pct, _, _ = weighted_share(df[f"adrecall_{bk}"].to_numpy() == 1, w, all_mask)

        entry = {
            "unaided_any_pct": r4(unaided_pct),
            "aided_pct": r4(aided_pct),
            "consider_t2b_pct_of_total": r4(t2b_total_pct),
            "consider_t2b_pct_of_answering": r4(t2b_ans_pct),
            "consider_answering_n_eff": r4(n_eff_ans),
            "used_p3m_pct_of_total": r4(used_total_pct),
            "used_p3m_pct_of_aware": r4(used_aware_pct),
            "aware_n_eff": r4(n_eff_aware),
            "pref_share_pct": r4(pref_pct),
            "adrecall_pct": r4(adrecall_pct),
            "aware_count_unweighted": int(aware.sum()),
            "used_count_unweighted": int(used.sum()),
        }
        if bk == "atlas":
            nps = df["nps_atlas"].to_numpy()
            asked = ~np.isnan(nps)
            wn = w[asked]
            prom_pct, nps_n_eff, _ = weighted_share(nps >= 9, w, asked)
            detr_pct, _, _ = weighted_share((nps <= 6) & asked, w, asked)
            contrib = np.where(nps[asked] >= 9, 1.0, np.where(nps[asked] <= 6, -1.0, 0.0))
            mean, var, _ = weighted_mean_var(contrib, wn)
            entry["nps"] = {
                "score": r4(100 * mean),
                "promoters_pct": r4(prom_pct),
                "detractors_pct": r4(detr_pct),
                "base_unweighted": int(asked.sum()),
                "base_weighted": r4(wn.sum()),
                "n_eff": r4(nps_n_eff),
                "score_variance": r4(var),
            }
        out[bk] = entry
    return out


def composite_atlas(df: pd.DataFrame) -> dict:
    """Brand health composite: mean of aided awareness, consideration T2B (of
    total) and P3M usage (of total), computed per respondent then weighted."""
    w = df["wt"].to_numpy()
    aware = (df["aware_atlas"].to_numpy() == 1).astype(float)
    t2b = np.isin(df["consider_atlas"].to_numpy(), [4, 5]).astype(float)
    used = (df["used_p3m_atlas"].to_numpy() == 1).astype(float)
    score = (aware + t2b + used) / 3.0
    mean, var, n_eff = weighted_mean_var(score, w)
    return {"pct": r4(100 * mean), "variance": r4(var), "n_eff": r4(n_eff)}


def attributes_t2b(cfg: dict, df: pd.DataFrame) -> dict:
    w = df["wt"].to_numpy()
    out = {}
    for b in cfg["brands"]:
        bk = b["key"]
        brand_out = {}
        for attr in cfg["attributes"]:
            col = df[f"att_{attr['key']}_{bk}"].to_numpy()
            answering = np.isin(col, [1, 2, 3, 4, 5])
            pct, n_eff, _ = weighted_share(np.isin(col, [4, 5]), w, answering)
            brand_out[attr["key"]] = {"t2b_pct_of_answering": r4(pct), "n_eff": r4(n_eff)}
        out[bk] = brand_out
    return out


def segment_cuts_atlas(cfg: dict, df: pd.DataFrame) -> dict:
    w = df["wt"].to_numpy()
    out = {}
    for metric, col in (("aided", "aware_atlas"), ("unaided", "unaided_any_atlas")):
        flag = df[col].to_numpy() == 1
        metric_out = {}
        for banner, banner_col, labels in (
            ("by_segment", "segment", cfg["segments"]["labels"]),
            ("by_age_band", "age_band", {str(b["code"]): b["label"] for b in cfg["sample"]["age_bands"]}),
        ):
            codes = df[banner_col].to_numpy()
            cells = {}
            for code_str, label in labels.items():
                mask = codes == int(code_str)
                pct, n_eff, _ = weighted_share(flag, w, mask)
                cells[code_str] = {
                    "label": label,
                    "pct": r4(pct),
                    "n_unweighted": int(mask.sum()),
                    "n_eff": r4(n_eff),
                }
            metric_out[banner] = cells
        out[metric] = metric_out
    return out


def weighting_diagnostics(cfg: dict, df: pd.DataFrame) -> dict:
    w = df["wt"].to_numpy()
    n = len(df)
    deff = float(n * (w**2).sum() / (w.sum() ** 2))
    pop = cfg["sample"]["population_margins"]
    bands = cfg["sample"]["age_bands"]
    targets = {
        "age_band": {b["label"]: s for b, s in zip(bands, pop["age_band"])},
        "gender": {cfg["sample"]["gender_labels"][str(i + 1)]: s for i, s in enumerate(pop["gender"])},
        "region": {cfg["sample"]["region_labels"][str(i + 1)]: s for i, s in enumerate(pop["region"])},
    }
    achieved = {}
    unweighted = {}
    for dim, col, labels in (
        ("age_band", "age_band", {b["code"]: b["label"] for b in bands}),
        ("gender", "gender", {int(k): v for k, v in cfg["sample"]["gender_labels"].items()}),
        ("region", "region", {int(k): v for k, v in cfg["sample"]["region_labels"].items()}),
    ):
        codes = df[col].to_numpy()
        achieved[dim] = {}
        unweighted[dim] = {}
        for code, label in labels.items():
            mask = codes == code
            achieved[dim][label] = r4(w[mask].sum() / w.sum())
            unweighted[dim][label] = r4(mask.sum() / n)
    return {
        "target_margins": targets,
        "achieved_margins_weighted": achieved,
        "sample_margins_unweighted": unweighted,
        "design_effect": r4(deff),
        "n": n,
        "n_eff": r4(n / deff),
        "weight_mean": r4(w.mean()),
        "weight_min": r4(w.min()),
        "weight_max": r4(w.max()),
    }


def build_deltas(cfg: dict, waves: dict) -> dict:
    """Wave-over-wave deltas with significance for consecutive wave pairs."""
    wave_keys = [w["key"] for w in cfg["waves"]]
    pairs = list(zip(wave_keys[:-1], wave_keys[1:]))
    funnel_metric_keys = [
        ("unaided_any", "unaided_any_pct", "total"),
        ("aided", "aided_pct", "total"),
        ("consider_t2b_of_total", "consider_t2b_pct_of_total", "total"),
        ("consider_conversion", "consider_t2b_pct_of_answering", "answering"),
        ("used_p3m_of_total", "used_p3m_pct_of_total", "total"),
        ("pref_share", "pref_share_pct", "total"),
        ("adrecall", "adrecall_pct", "total"),
    ]
    deltas = {}
    for a, b in pairs:
        pair_key = f"{a}_{b}"
        wa, wb = waves[a], waves[b]
        pair_out = {"funnel": {}}
        for brand in cfg["brands"]:
            bk = brand["key"]
            fa, fb = wa["funnel"][bk], wb["funnel"][bk]
            brand_out = {}
            for name, field, base in funnel_metric_keys:
                if base == "total":
                    n1, n2 = wa["weighting"]["n_eff"], wb["weighting"]["n_eff"]
                else:
                    n1, n2 = fa["consider_answering_n_eff"], fb["consider_answering_n_eff"]
                p1, p2 = fa[field], fb[field]
                z, p_value, sig = two_prop_z(p1, n1, p2, n2)
                brand_out[name] = {
                    "from": p1,
                    "to": p2,
                    "delta_pts": r4(p2 - p1),
                    "z": round(z, 3),
                    "p": round(p_value, 4),
                    "significant_95": sig,
                }
            pair_out["funnel"][bk] = brand_out

        ca, cb = wa["composite_atlas"], wb["composite_atlas"]
        z, p_value, sig = mean_diff_z(
            ca["pct"] / 100, ca["variance"], ca["n_eff"], cb["pct"] / 100, cb["variance"], cb["n_eff"]
        )
        pair_out["composite_atlas"] = {
            "from": ca["pct"],
            "to": cb["pct"],
            "delta_pts": r4(cb["pct"] - ca["pct"]),
            "z": round(z, 3),
            "p": round(p_value, 4),
            "significant_95": sig,
        }

        na, nb = wa["funnel"]["atlas"]["nps"], wb["funnel"]["atlas"]["nps"]
        z, p_value, sig = mean_diff_z(
            na["score"] / 100, na["score_variance"], na["n_eff"], nb["score"] / 100, nb["score_variance"], nb["n_eff"]
        )
        pair_out["nps_atlas"] = {
            "from": na["score"],
            "to": nb["score"],
            "delta_pts": r4(nb["score"] - na["score"]),
            "z": round(z, 3),
            "p": round(p_value, 4),
            "significant_95": sig,
            "low_base_flag": bool(min(na["base_unweighted"], nb["base_unweighted"]) < 250),
        }

        attrs = {}
        for attr in cfg["attributes"]:
            ak = attr["key"]
            aa = wa["attributes_t2b_of_answering"]["atlas"][ak]
            ab = wb["attributes_t2b_of_answering"]["atlas"][ak]
            z, p_value, sig = two_prop_z(
                aa["t2b_pct_of_answering"], aa["n_eff"], ab["t2b_pct_of_answering"], ab["n_eff"]
            )
            attrs[ak] = {
                "from": aa["t2b_pct_of_answering"],
                "to": ab["t2b_pct_of_answering"],
                "delta_pts": r4(ab["t2b_pct_of_answering"] - aa["t2b_pct_of_answering"]),
                "z": round(z, 3),
                "p": round(p_value, 4),
                "significant_95": sig,
            }
        pair_out["attributes_atlas"] = attrs

        for metric in ("aided", "unaided"):
            for banner in ("by_segment", "by_age_band"):
                cells = {}
                for code, cell_a in wa["segments_atlas"][metric][banner].items():
                    cell_b = wb["segments_atlas"][metric][banner][code]
                    z, p_value, sig = two_prop_z(cell_a["pct"], cell_a["n_eff"], cell_b["pct"], cell_b["n_eff"])
                    cells[code] = {
                        "label": cell_a["label"],
                        "from": cell_a["pct"],
                        "to": cell_b["pct"],
                        "delta_pts": r4(cell_b["pct"] - cell_a["pct"]),
                        "z": round(z, 3),
                        "p": round(p_value, 4),
                        "significant_95": sig,
                    }
                pair_out[f"segments_atlas_{metric}_{banner}"] = cells

        deltas[pair_key] = pair_out
    return deltas


def storyline_checks(cfg: dict, waves: dict, deltas: dict) -> list:
    checks = []

    def add(check_id, element, description, values, ok):
        checks.append(
            {"id": check_id, "element": element, "description": description, "values": values, "pass": bool(ok)}
        )

    d34 = deltas["w3_w4"]
    d45 = deltas["w4_w5"]

    # 1. Composite up ~4pts W3→W4, significant
    c = d34["composite_atlas"]
    add(
        "composite_up",
        1,
        "Atlas brand health composite up ~4pts W3->W4, significant at 95% weighted",
        c,
        3.0 <= c["delta_pts"] <= 5.5 and c["significant_95"],
    )

    # 2. Top-of-funnel gain: unaided +6, conversion flat
    un = d34["funnel"]["atlas"]["unaided_any"]
    conv = d34["funnel"]["atlas"]["consider_conversion"]
    add(
        "top_of_funnel",
        2,
        "Atlas unaided awareness +~6pts W3->W4 (significant); awareness->consideration conversion flat (not significant)",
        {"unaided": un, "conversion": conv},
        5.0 <= un["delta_pts"] <= 7.5
        and un["significant_95"]
        and (not conv["significant_95"])
        and abs(conv["delta_pts"]) <= 4.0,
    )

    # 3. Beacon overtakes Meridian on consideration T2B in W4, first time in 4 waves
    ranks = {
        wk: {
            "beacon": waves[wk]["funnel"]["beacon"]["consider_t2b_pct_of_total"],
            "meridian": waves[wk]["funnel"]["meridian"]["consider_t2b_pct_of_total"],
        }
        for wk in ["w1", "w2", "w3", "w4"]
    }
    behind_first_3 = all(ranks[wk]["beacon"] < ranks[wk]["meridian"] for wk in ["w1", "w2", "w3"])
    ahead_w4 = ranks["w4"]["beacon"] > ranks["w4"]["meridian"]
    add(
        "beacon_overtake",
        3,
        "Beacon overtakes Meridian on consideration T2B (of total) in W4 for the first time in 4 waves",
        ranks,
        behind_first_3 and ahead_w4,
    )

    # 4. 'Innovative' +7 significant; 'worth the price' -2 within margin
    innov = d34["attributes_atlas"]["innov"]
    worth = d34["attributes_atlas"]["worth"]
    add(
        "drivers",
        4,
        "Atlas 'innovative' +~7pts W3->W4 (significant); 'worth the price' -~2pts (not significant)",
        {"innov": innov, "worth": worth},
        5.5 <= innov["delta_pts"] <= 8.5
        and innov["significant_95"]
        and -3.5 <= worth["delta_pts"] <= -0.5
        and not worth["significant_95"],
    )

    # 5. Gain concentrated in Growth + under-35s; exactly one significant segment divergence
    seg_un = d34["segments_atlas_unaided_by_segment"]
    seg_aided = d34["segments_atlas_aided_by_segment"]
    age_un = d34["segments_atlas_unaided_by_age_band"]
    sig_segments_unaided = [c for c in seg_un if seg_un[c]["significant_95"]]
    sig_segments_aided = [c for c in seg_aided if seg_aided[c]["significant_95"]]
    add(
        "segment_divergence",
        5,
        "Awareness gain concentrated in Growth segment (code 2) and under-35s; Core flat; exactly one significant segment divergence",
        {
            "unaided_by_segment": seg_un,
            "aided_by_segment": seg_aided,
            "unaided_by_age_band": age_un,
        },
        sig_segments_unaided == ["2"]
        and sig_segments_aided == ["2"]
        and age_un["1"]["significant_95"]
        and not age_un["3"]["significant_95"]
        and abs(seg_un["1"]["delta_pts"]) <= 4.0,
    )

    # 6. NPS improves on a low base (n≈180)
    nps = d34["nps_atlas"]
    base_w4 = waves["w4"]["funnel"]["atlas"]["nps"]["base_unweighted"]
    add(
        "nps_low_base",
        6,
        "Atlas NPS improves W3->W4 but on n~180 users (low-base flag)",
        {"delta": nps, "base_unweighted_w4": base_w4},
        nps["delta_pts"] >= 5.0 and nps["low_base_flag"] and 150 <= base_w4 <= 240,
    )

    # 7. W5 refresh: Growth gain consolidates; unaided + innovative go flat W4→W5
    growth_w5 = d45["segments_atlas_unaided_by_segment"]["2"]
    un45 = d45["funnel"]["atlas"]["unaided_any"]
    innov45 = d45["attributes_atlas"]["innov"]
    add(
        "wave5_refresh",
        7,
        "W5: Growth-segment unaided gain consolidates (does not fall back); unaided awareness and 'innovative' go flat W4->W5 (previously significant movers stabilise)",
        {"growth_unaided_w4_w5": growth_w5, "unaided_total_w4_w5": un45, "innov_w4_w5": innov45},
        growth_w5["delta_pts"] >= -1.5
        and not growth_w5["significant_95"]
        and abs(un45["delta_pts"]) <= 2.0
        and not un45["significant_95"]
        and abs(innov45["delta_pts"]) <= 2.0
        and not innov45["significant_95"],
    )

    return checks


def non_mover_guard(cfg: dict, deltas: dict) -> dict:
    """Every delta not on the planted-mover whitelist must be non-significant."""
    whitelist = {
        # (pair, brand, metric)
        ("w3_w4", "atlas", "unaided_any"),
        ("w3_w4", "atlas", "aided"),
        ("w3_w4", "atlas", "consider_t2b_of_total"),
        ("w3_w4", "atlas", "used_p3m_of_total"),
        ("w3_w4", "atlas", "adrecall"),
        ("w3_w4", "beacon", "consider_t2b_of_total"),
        ("w3_w4", "beacon", "consider_conversion"),
        # preference is downstream of the planted Beacon consideration surge
        ("w3_w4", "beacon", "pref_share"),
    }
    attr_whitelist = {("w3_w4", "innov")}
    violations = []
    for pair_key, pair in deltas.items():
        for bk, metrics in pair["funnel"].items():
            for metric, entry in metrics.items():
                if entry["significant_95"] and (pair_key, bk, metric) not in whitelist:
                    violations.append(
                        {"pair": pair_key, "brand": bk, "metric": metric, "delta_pts": entry["delta_pts"], "z": entry["z"]}
                    )
        for ak, entry in pair["attributes_atlas"].items():
            if entry["significant_95"] and (pair_key, ak) not in attr_whitelist:
                violations.append(
                    {"pair": pair_key, "brand": "atlas", "metric": f"att_{ak}", "delta_pts": entry["delta_pts"], "z": entry["z"]}
                )
    return {"whitelist_note": "planted movers exempt from the stability guard", "violations": violations, "pass": len(violations) == 0}


def dataframe_checksum(df: pd.DataFrame) -> str:
    return hashlib.sha256(df.to_csv(index=False, float_format="%.10g").encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the brand tracker demo dataset")
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Generate in memory and print storyline verification without writing files",
    )
    args = parser.parse_args()

    with open(args.config, "rb") as fh:
        config_bytes = fh.read()
    cfg = json.loads(config_bytes)
    config_sha256 = hashlib.sha256(config_bytes).hexdigest()

    os.chdir(REPO_ROOT)

    wave_data: dict[str, WaveData] = {}
    for idx, wave_meta in enumerate(cfg["waves"]):
        df = generate_wave(cfg, wave_meta, idx)
        validate_funnel_integrity(cfg, df, wave_meta["key"])
        wave_data[wave_meta["key"]] = WaveData(wave_meta["key"], idx, wave_meta, df)
        print(f"generated {wave_meta['key']}: {len(df)} rows, {len(df.columns)} vars, checksum {dataframe_checksum(df)[:16]}")

    # Ground truth per wave
    waves_out = {}
    for wk, wd in wave_data.items():
        waves_out[wk] = {
            "label": wd.meta["label"],
            "n": len(wd.df),
            "funnel": funnel_metrics(cfg, wd.df),
            "composite_atlas": composite_atlas(wd.df),
            "attributes_t2b_of_answering": attributes_t2b(cfg, wd.df),
            "segments_atlas": segment_cuts_atlas(cfg, wd.df),
            "weighting": weighting_diagnostics(cfg, wd.df),
        }

    deltas = build_deltas(cfg, waves_out)
    checks = storyline_checks(cfg, waves_out, deltas)
    guard = non_mover_guard(cfg, deltas)

    all_pass = all(c["pass"] for c in checks) and guard["pass"]
    print("\nStoryline verification:")
    for c in checks:
        print(f"  [{'PASS' if c['pass'] else 'FAIL'}] element {c['element']}: {c['id']}")
    print(f"  [{'PASS' if guard['pass'] else 'FAIL'}] non-mover guard ({len(guard['violations'])} violations)")
    if guard["violations"]:
        for v in guard["violations"]:
            print(f"      violation: {v}")

    if args.check_only:
        return 0 if all_pass else 1

    ground_truth = {
        "description": (
            "Ground truth for the synthetic brand tracker demo dataset "
            "(docs/workstreams/deck_native/10_brand_tracker_demo_plan.md). All metrics are weighted by 'wt' "
            "unless suffixed otherwise. Percentages are 0-100."
        ),
        "metadata": {
            "seed": cfg["seed"],
            "config_file": "scripts/python/brand_tracker_config.json",
            "config_sha256": config_sha256,
            "generation_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "generation_command": "python3 scripts/python/generate_brand_tracker.py",
            "generator": "scripts/python/generate_brand_tracker.py",
            "category": cfg["category"],
            "brands": {b["key"]: {"name": b["name"], "code": b["code"], "role": b["role"]} for b in cfg["brands"]},
            "data_checksums_sha256": {wk: dataframe_checksum(wd.df) for wk, wd in wave_data.items()},
        },
        "significance": {
            "method": (
                "Two-proportion z-test (pooled) on Kish effective sample sizes n_eff = (sum w)^2 / sum(w^2) "
                "of each metric's weighted base; composite and NPS use an unpooled z on weighted means."
            ),
            "alpha": 0.05,
            "z_critical": Z_CRITICAL_95,
        },
        "definitions": {
            "unaided_any_pct": "Weighted % of total base with any unaided mention of the brand (unaided_any_<brand>=1). Engine: weighted frequency of code 1 / sum of weighted counts for all codes on total base.",
            "aided_pct": "Weighted % of total base aware of the brand (aware_<brand>=1). Engine: weighted frequency of code 1 / sum of weighted counts for codes 0+1.",
            "consider_t2b_pct_of_total": "Weighted % of total base answering 4-5 on consider_<brand>. Engine: sum weightedCount(codes 4,5) / total weighted base (denominator from aware_<any>=0|1 frequency table).",
            "consider_t2b_pct_of_answering": "Weighted % of valid consideration answers (codes 1-5; DK=98 and structural missing excluded) that are 4-5",
            "consider_conversion": "Alias of consider_t2b_pct_of_answering: consideration conversion among aware brand answerers",
            "used_p3m_pct_of_total": "Weighted % of total base with used_p3m_<brand>=1. Engine: weighted frequency of code 1 / total weighted base.",
            "pref_share_pct": "Weighted % of total base preferring the brand (brand_pref)",
            "nps.score": "Weighted %promoters (9-10) minus %detractors (0-6) among Atlas P3M users, in points",
            "composite_atlas": "Brand health composite: per-respondent mean of (aided awareness, consideration T2B of total, P3M usage), weighted",
            "attribute t2b_pct_of_answering": "Weighted % agreeing (4-5) among valid answers (1-5) for att_<attribute>_atlas; base = aware of brand and gave a rating",
            "weight_mean": "Mean of wt across all respondents in the wave (should be ~1.0 after raking)",
            "wave5_flattened_mover": "Unaided awareness W4->W5 delta (documented in config raw_wave4._comment); significant W3->W4, flat/non-significant W4->W5",
        },
        "files": {
            "public/examples/brandtracker_w4.sav": "Demo wave (analysis-ready W4)",
            "test_data/fixtures/brand_tracker/brandtracker_w1.sav": "Analysis-ready W1",
            "test_data/fixtures/brand_tracker/brandtracker_w2.sav": "Analysis-ready W2",
            "test_data/fixtures/brand_tracker/brandtracker_w3.sav": "Analysis-ready W3",
            "test_data/fixtures/brand_tracker/brandtracker_w5.sav": "Analysis-ready W5 (refresh wave)",
            "test_data/fixtures/brand_tracker/brandtracker_w4_raw.sav": (
                "Raw agency-file variant of W4: same respondents/answers, but no age_band; consideration scale coded in "
                "reversed label order (1<->5, 2<->4); att_worth_atlas renamed att_value_atlas and att_worth_beacon "
                "renamed att_value_beacon; weight named rim_wt_final with label 'final wt'; junk decoy column "
                "body_weight_kg (respondent body weight ~60-110 kg)"
            ),
        },
        "waves": waves_out,
        "deltas": deltas,
        "storyline_checks": checks,
        "non_mover_guard": guard,
    }

    # --- Write artifacts -------------------------------------------------------
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    written = []
    for wk, wd in wave_data.items():
        if wk == DEMO_WAVE:
            path = DEMO_PATH
        else:
            path = os.path.join(FIXTURE_DIR, f"brandtracker_{wk}.sav")
        write_clean_wave(cfg, wd, path)
        written.append(path)
    raw_path = os.path.join(FIXTURE_DIR, "brandtracker_w4_raw.sav")
    write_raw_wave4(cfg, wave_data[DEMO_WAVE], raw_path)
    written.append(raw_path)

    os.makedirs(os.path.dirname(GROUND_TRUTH_PATH), exist_ok=True)
    with open(GROUND_TRUTH_PATH, "w", encoding="utf-8") as fh:
        json.dump(ground_truth, fh, indent=2)
        fh.write("\n")
    written.append(GROUND_TRUTH_PATH)

    print("\nArtifacts written:")
    for path in written:
        print(f"  {path} ({os.path.getsize(path):,} bytes)")

    if not all_pass:
        print("\nERROR: storyline verification failed — adjust brand_tracker_config.json and regenerate.", file=sys.stderr)
        return 1
    print("\nAll storyline checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
