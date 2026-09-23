"""Tracker archetype: brand measures by wave, ranked developments, deck and key-measure grid.

Developments are found from the data, not from any answer key:
  * a wave-on-wave step that is significant (95%) and at least the materiality threshold;
  * a gradual change from first to current wave that is significant and material while no
    single step is;
  * the same two checks inside pre-specified subgroups, at a stricter 99% level and only
    where both waves have at least the indicative base.
Every title is built from those tests; nothing is described as stable or unchanged.
"""
from __future__ import annotations
from engine import share, mean, nps, wald, Est
from .common import fmt_value, fmt_change, plot_value, unit_of

GREY = "94A3B8"


class Tracker:
    def __init__(self, st, spec):
        self.st, self.spec = st, spec
        wv = spec["waves"]; self.wvar = wv["var"]
        self.waves = sorted(int(x) for x in st.col(self.wvar).dropna().unique())
        self.cur, self.prev, self.first = wv["current"], wv["previous"], wv["first"]
        self.wl = {int(k): v for k, v in wv["labels"].items()}
        self.ents = spec["entities"]; self.low = spec["low_base"]; self.mat = spec["materiality"]
        self.measures = list(spec["measures"])
        img = spec.get("image")
        if img:
            for a, lab in img["attribute_labels"].items():
                self.measures.append({"id": f"img_{a}", "label": f"Seen as '{lab.lower()}'", "kind": "share", "stage": "image",
                                      "num": f"I_{{id}}_{a} == 1", "base": f"F1_{{id}} in [3, 4, 5] and I_{{id}}_{a} in [0, 1]",
                                      "base_text": "Familiar with the brand (F1 = 3–5), excluding don't know"})
        self.M = {m["id"]: m for m in self.measures}
        self._cache = {}

    # ------------------------------------------------------------------ estimation
    def est(self, m, e, wave, sub=None):
        key = (m["id"], e["id"], wave, None if sub is None else sub[0])
        if key in self._cache: return self._cache[key]
        st = self.st; f = lambda s: s.format(id=e["id"], code=e["code"]) if s else s
        base = (st.col(self.wvar) == wave) & (st.mask(f(m.get("base"))) if m.get("base") else st.all)
        if sub is not None: base = base & sub[1]
        if m["kind"] == "share": r = share(st.mask(f(m["num"])), base, st.w)
        else:
            x = st.col(m["var"]); x = x.where(st.valid(m["var"]))
            r = (nps if m["kind"] == "nps" else mean)(x, base, st.w)
        self._cache[key] = r
        return r

    def series(self, m, e, sub=None): return [self.est(m, e, w, sub) for w in self.waves]

    def material(self, m, d):
        return abs(d) >= self.mat[m["kind"]]

    # ------------------------------------------------------------------ developments
    def developments(self):
        events, trends = [], []
        for m in self.measures:
            for e in self.ents:
                s = self.series(m, e)
                steps = {}
                for i in range(1, len(self.waves)):
                    t = wald(s[i - 1], s[i]); steps[self.waves[i]] = t
                    if s[i].n >= self.low["indicative"] and s[i - 1].n >= self.low["indicative"] and t.sig() and self.material(m, t.diff):
                        events.append({"m": m, "e": e, "wave": self.waves[i], "t": t, "series": s})
                h = wald(s[0], s[-1])
                if not any(x["m"] is m and x["e"] is e for x in events) and h.sig() and self.material(m, h.diff) \
                        and min(x.n for x in s) >= self.low["indicative"]:
                    trends.append({"m": m, "e": e, "t": h, "series": s, "kind": "trend"})
        # subgroup scan: funnel measures only, stricter alpha
        subs = []
        for g in self.spec.get("subgroups", []):
            for c in self._sub_cols(g):
                for m in [x for x in self.measures if x.get("stage") in ("funnel", "conversion")]:
                    for e in self.ents:
                        s = self.series(m, e, sub=(f"{g['group']}:{c[0]}", c[1]))
                        tot = self.series(m, e)
                        if min(x.n for x in s) < self.low["indicative"]: continue
                        h = wald(s[0], s[-1]); ht = wald(tot[0], tot[-1])
                        if h.sig(0.01) and abs(h.diff) >= 2 * self.mat[m["kind"]] and not ht.sig():
                            subs.append({"m": m, "e": e, "t": h, "series": s, "total": tot, "sub": c[0], "group": g["group"], "kind": "subgroup"})
        return events, trends, subs

    def _sub_cols(self, g):
        st = self.st
        if "cols" in g: return [(c["label"], st.col(g["var"]).isin(c["codes"])) for c in g["cols"]]
        return [(l, st.col(g["var"]) == c) for c, l in st.values(g["var"])]

    def stories(self, max_stories=6, per_brand=2):
        events, trends, subs = self.developments()
        by = {}
        for ev in events: by.setdefault((ev["e"]["id"], ev["wave"]), []).append(ev)
        cands = []
        STAGE = {"funnel": 0, "conversion": 1, "experience": 0, "marketing": 2, "image": 3}
        merged = set()
        for (eid, w) in sorted(by, key=lambda x: x[1]):
            if (eid, w) in merged: continue
            evs = sorted(by[(eid, w)], key=lambda x: -abs(x["t"].z))
            follow = []
            nxt = by.get((eid, w + 1), [])
            ids = {x["m"]["id"]: x["t"].diff for x in evs}
            if any(x["m"]["id"] in ids and (x["t"].diff > 0) != (ids[x["m"]["id"]] > 0) for x in nxt):
                follow = nxt; merged.add((eid, w + 1))
            # lead: the most downstream stage present, strongest within it
            best = min(STAGE.get(x["m"].get("stage"), 9) for x in evs)
            lead = max((x for x in evs if STAGE.get(x["m"].get("stage"), 9) == best), key=lambda x: abs(x["t"].z))
            members = [lead] + [x for x in evs if x is not lead]
            cands.append({"kind": "event", "e": evs[0]["e"], "wave": w, "lead": lead, "members": members, "followup": follow,
                          "score": abs(evs[0]["t"].z) + 0.5 * (len(evs) - 1)})
        for t in trends: cands.append({"kind": "trend", "e": t["e"], "lead": t, "members": [t], "score": abs(t["t"].z)})
        for s in subs: cands.append({"kind": "subgroup", "e": s["e"], "lead": s, "members": [s], "score": abs(s["t"].z)})
        cands.sort(key=lambda c: -c["score"])
        chosen, count = [], {}
        for c in cands:
            b = c["e"]["id"]
            if count.get(b, 0) >= per_brand: continue
            if c["kind"] == "subgroup" and any(x["e"] is c["e"] and x["kind"] == "subgroup" for x in chosen): continue
            chosen.append(c); count[b] = count.get(b, 0) + 1
            if len(chosen) == max_stories: break
        return chosen, {"events": len(events), "trends": len(trends), "subgroup": len(subs), "candidates": len(cands)}

    # ------------------------------------------------------------------ wording
    def wlab(self, w): return self.wl[w]

    @staticmethod
    def pl(lab): return f"those aged {lab}" if lab.endswith("+") else f"{lab}s"

    def tl(self, m): return m.get("title", m["label"][0].lower() + m["label"][1:])

    def mag(self, d, k):
        if k == "share": return f"{abs(d) * 100:.0f} pts"
        if k == "nps": return f"{abs(d):.0f} pts"
        return f"{abs(d):.1f} points"

    def lvl(self, v, m):
        if m["kind"] == "mean" and m.get("scale_max"): return f"{v:.1f} out of {m['scale_max']}"
        return fmt_value(v, m["kind"])

    def title(self, c, long=False):
        m, e, t = c["lead"]["m"], c["e"], c["lead"]["t"]; k = m["kind"]
        verb = "rose" if t.diff > 0 else "fell"
        s = c["lead"]["series"]
        if c["kind"] == "event":
            w = c["wave"]; i = self.waves.index(w)
            txt = f"{e['label']} {self.tl(m)} {verb} {self.mag(t.diff, k)} to {self.lvl(s[i].value, m)} in {self.wlab(w)}"
            pol = lambda x: x["t"].diff * x["m"].get("polarity", 1)
            order = [x["id"] for x in self.measures]
            same = [x for x in c["members"][1:] if (pol(x) > 0) == (t.diff * m.get("polarity", 1) > 0) and x["m"].get("stage") != "image"]
            funnel_same = sorted([x for x in same if x["m"].get("stage") == "funnel"], key=lambda x: -order.index(x["m"]["id"]))
            same = (funnel_same + [x for x in same if x not in funnel_same])[:2]
            if same and long:
                txt += ", with " + " and ".join(f"{self.tl(x['m'])} ({fmt_change(x['t'].diff, x['m']['kind'], 0)})" for x in same) + " moving the same way"
            if w != self.cur:
                back = wald(s[i - 1], s[-1])
                if back.sig():
                    txt += f"; {self.wlab(self.cur)} is still {self.mag(back.diff, k)} {'below' if back.diff < 0 else 'above'} {self.wlab(self.waves[i - 1])}"
                else:
                    txt += f"; by {self.wlab(self.cur)} it was back to its {self.wlab(self.waves[i - 1])} level"
            return txt
        if c["kind"] == "trend":
            return (f"{e['label']} {self.tl(m)} has {'risen' if t.diff > 0 else 'fallen'} gradually, "
                    f"{fmt_change(t.diff, k)} from {self.wlab(self.first)} to {self.wlab(self.cur)}, with no single wave-on-wave step significant")
        return (f"Among {self.pl(c['lead']['sub'])}, {e['label']} {self.tl(m)} has {'risen' if t.diff > 0 else 'fallen'} "
                f"{fmt_change(t.diff, k).lstrip('+−')} since {self.wlab(self.first)}; the total-market change is not significant") \
            if c["lead"]["group"] == "Age" else \
            (f"{e['label']} {self.tl(m)} has {'risen' if t.diff > 0 else 'fallen'} {fmt_change(t.diff, k).lstrip('+−')} "
             f"among {c['lead']['sub']} since {self.wlab(self.first)}; the total-market change is not significant")

    # ------------------------------------------------------------------ outputs
    def deck(self):
        st, sp = self.st, self.spec
        stories, diag = self.stories()
        n_cur = int((st.col(self.wvar) == self.cur).sum())
        wave_base = f"Base: all respondents, n≈{n_cur:,} per wave ({', '.join(self.wlab(w) for w in self.waves)}). Weighted ({st.cb['weight']})."
        sig_note = "Significance: Wald test on Kish effective bases, 95%, wave on wave unless stated."
        slides, chart = [], []
        slides.append({"type": "cover", "title": sp["report_title"], "subtitle": f"{sp['brief_title']} · {self.wlab(self.cur)}",
                       "meta": f"{len(self.waves)} waves · {n_cur:,} respondents per wave · weighted", "footnote": sp.get("source_note", "")})
        # summary
        rows = []
        for c in stories[:5]:
            m, e, t = c["lead"]["m"], c["e"], c["lead"]["t"]; s = c["lead"]["series"]; k = m["kind"]
            when = f"in {self.wlab(c['wave'])}" if c["kind"] == "event" else f"{self.wlab(self.first)}→{self.wlab(self.cur)}"
            val = s[self.waves.index(c["wave"])].value if c["kind"] == "event" else s[-1].value
            lab = f"{e['label']} · {m['label']}" + (f" · {c['lead']['sub']}" if c["kind"] == "subgroup" else "")
            rows.append({"value": fmt_value(val, k), "label": lab, "change": f"{fmt_change(t.diff, k)} {when} · significant",
                         "sig": True, "direction": "up" if t.diff * m.get("polarity", 1) > 0 else "down", "color": e["color"], "text": self.title(c, long=True)})
        slides.append({"type": "findings", "title": self.summary_title(stories), "measure": f"Developments that pass significance and materiality tests · level and change",
                       "rows": rows, "source": f"{wave_base} {sig_note} Materiality: ±{self.mat['share'] * 100:.0f} pts for percentages, ±{self.mat['nps']:.0f} for NPS."})
        # funnel
        stages = [m for m in self.measures if m.get("stage") == "funnel"]
        cats = [m["label"] for m in stages]
        series = [{"name": e["label"], "color": e["color"], "values": [plot_value(self.est(m, e, self.cur).value, "share") for m in stages]} for e in self.ents]
        for e, sr in zip(self.ents, series):
            for m, v in zip(stages, sr["values"]): chart.append([len(slides) + 1, f"Brand funnel, {self.wlab(self.cur)}", e["label"], m["label"], v / 100, "proportion", self.est(m, e, self.cur).n, m["base_text"]])
        slides.append({"type": "bar", "title": self.funnel_title(stages), "measure": f"Brand funnel, {self.wlab(self.cur)} · % of all respondents",
                       "categories": cats, "series": series, "dir": "col", "legend": True, "max": 100, "fmt": "0",
                       "source": f"Base: all respondents in {self.wlab(self.cur)}, n={n_cur:,}. Weighted. Consideration counts non-aware respondents as not considering."})
        # stories
        for c in stories:
            slides.append(self.story_slide(c, chart, len(slides) + 1, wave_base, sig_note))
            if c["kind"] == "event":
                sub = self.subgroup_slide(c)
                if sub: slides.append(sub)
        slides.append({"type": "method", "title": "About this study", "items": self.method_items(), "source": sp.get("source_note", "")})
        return {"meta": {"title": sp["report_title"], "footer": f"{sp['report_title']} · {self.wlab(self.cur)}"}, "slides": slides}, chart, diag, stories

    def summary_title(self, stories):
        if not stories: return "No development passes both the significance and materiality tests this wave"
        names = []
        for c in stories[:3]:
            if c["e"]["label"] not in names: names.append(c["e"]["label"])
        return f"{len(stories)} developments change the picture, led by {', '.join(names[:-1]) + ' and ' + names[-1] if len(names) > 1 else names[0]}"

    def funnel_title(self, stages):
        leaders = []
        for m in stages:
            vals = sorted(((self.est(m, e, self.cur).value, e["label"]) for e in self.ents), reverse=True)
            leaders.append(vals[0][1])
        top = max(set(leaders), key=leaders.count)
        if leaders.count(top) == len(leaders):
            return f"{top} leads every stage of the funnel in {self.wlab(self.cur)}"
        others = [f"{l} on {m['label'].lower()}" for l, m in zip(leaders, stages) if l != top]
        return f"{top} leads {leaders.count(top)} of {len(stages)} funnel stages in {self.wlab(self.cur)}; " + ", ".join(others) + (" leads" if len(others) == 1 else "")

    def story_slide(self, c, chart, slide_no, wave_base, sig_note):
        m, e = c["lead"]["m"], c["e"]; k = m["kind"]
        cats = [self.wlab(w) for w in self.waves]
        if c["kind"] == "subgroup":
            s, tot = c["lead"]["series"], c["lead"]["total"]
            series = [{"name": f"{e['label']} · {c['lead']['sub']}", "color": e["color"], "values": [plot_value(x.value, k) for x in s]},
                      {"name": f"{e['label']} · all ages", "color": GREY, "values": [plot_value(x.value, k) for x in tot]}]
            bases = f"Unweighted base, {c['lead']['sub']}: " + ", ".join(f"{self.wlab(w)} {x.n}" for w, x in zip(self.waves, s)) + "."
        else:
            s = c["lead"]["series"]
            others = [self.series(m, o) for o in self.ents if o is not e]
            avg = [sum(o[i].value for o in others) / len(others) for i in range(len(self.waves))]
            series = [{"name": e["label"], "color": e["color"], "values": [plot_value(x.value, k) for x in s]},
                      {"name": "Average of other tracked brands", "color": GREY, "values": [plot_value(v, k) for v in avg]}]
            bases = f"Unweighted base, {e['label']}: " + ", ".join(f"{self.wlab(w)} {x.n}" for w, x in zip(self.waves, s)) + "."
        for sr in series:
            for cat, v in zip(cats, sr["values"]):
                chart.append([slide_no, m["label"], sr["name"], cat, (v / 100 if k == "share" else v), unit_of(k), None, m["base_text"]])
        panel = []
        for mem in c["members"][:4]:
            mm = mem["m"]; ss = mem["series"]; tt = mem["t"]
            wi = self.waves.index(c["wave"]) if c["kind"] == "event" else len(self.waves) - 1
            panel.append({"name": mm["label"], "value": fmt_value(ss[wi].value, mm["kind"]),
                          "change": fmt_change(tt.diff, mm["kind"]) + (f" in {self.wlab(c['wave'])}" if c["kind"] == "event" else f" since {self.wlab(self.first)}"),
                          "sig": True, "direction": "up" if tt.diff * mm.get("polarity", 1) > 0 else "down", "color": e["color"]})
        if c["kind"] == "event" and c["wave"] != self.cur:
            i = self.waves.index(c["wave"]); back = wald(s[i - 1], s[-1])
            panel.append({"name": f"{m['label']} now ({self.wlab(self.cur)})", "value": fmt_value(s[-1].value, k),
                          "change": f"{fmt_change(back.diff, k)} vs {self.wlab(self.waves[i - 1])}", "sig": back.sig(), "direction": "up" if back.diff > 0 else "down", "color": GREY})
        unit = {"share": "%", "nps": "NPS (promoters − detractors)", "mean": "mean score"}[k]
        base_txt = m["base_text"]
        return {"type": "line", "title": self.title(c), "measure": f"{m['label']} · {unit} · {base_txt.lower()}", "categories": cats, "series": series,
                "fmt": '0"%"' if k == "share" else "0.0" if k == "mean" else "0", "panel": panel, "panel_title": f"{self.wlab(c['wave']) if c['kind'] == 'event' else self.wlab(self.cur)} level · change",
                "source": f"Base: {base_txt}. {bases} Weighted. {sig_note}", "labels": True}

    def subgroup_slide(self, c):
        """Where the change happened, when an age-group difference in change is significant."""
        m, e, w = c["lead"]["m"], c["e"], c["wave"]; k = m["kind"]; i = self.waves.index(w)
        g = next((x for x in self.spec.get("subgroups", []) if x["group"] == "Age"), None)
        if not g: return None
        rows, changes = [], []
        for lab, mask in self._sub_cols(g):
            a, b = self.est(m, e, self.waves[i - 1], (f"Age:{lab}", mask)), self.est(m, e, w, (f"Age:{lab}", mask))
            t = wald(a, b); changes.append((lab, t, a, b))
        ok = [x for x in changes if x[2].n >= self.low["indicative"] and x[3].n >= self.low["indicative"]]
        if len(ok) < 2: return None
        moved = [x for x in ok if x[1].sig() and (x[1].diff > 0) == (c["lead"]["t"].diff > 0)]
        still = [x for x in ok if not x[1].sig()]
        if not moved or not still: return None
        from math import sqrt
        from scipy.stats import norm
        top = max(moved, key=lambda x: abs(x[1].diff)); flat = min(still, key=lambda x: abs(x[1].diff))
        dd = top[1].diff - flat[1].diff; se = sqrt(top[1].se ** 2 + flat[1].se ** 2); p = 2 * (1 - norm.cdf(abs(dd / se)))
        if p >= 0.05: return None
        header = ["Age group", f"Base {self.wlab(w)} (n)", self.wlab(self.waves[i - 1]), self.wlab(w), "Change"]
        for lab, t, a, b in changes:
            low = min(a.n, b.n) < self.low["indicative"]
            rows.append([lab, f"{b.n:,}", fmt_value(a.value, k), fmt_value(b.value, k),
                         {"text": "base too small" if low else fmt_change(t.diff, k) + (" ▲" if t.sig() and t.diff > 0 else " ▼" if t.sig() else ""),
                          "sig": (not low) and t.sig(), "direction": "up" if t.diff > 0 else "down"}])
        title = (f"The {self.wlab(w)} {'rise' if c['lead']['t'].diff > 0 else 'fall'} in {e['label']} {self.tl(m)} came from "
                 + " and ".join(f"{self.pl(x[0])} ({fmt_change(x[1].diff, k)})" for x in moved)
                 + "; " + " and ".join(self.pl(x[0]) for x in still) + " showed no significant change")
        hi, lo = top, flat
        return {"type": "table", "title": title, "measure": f"{e['label']} {self.tl(m)} by age · {self.wlab(self.waves[i - 1])} and {self.wlab(w)}",
                "header": header, "rows": rows, "colW": [3.2, 2.2, 2.0, 2.0, 2.73],
                "source": f"Base: {m['base_text']} in each age group. Weighted. ▲/▼ change significant at 95%. Difference in change between {hi[0]} and {lo[0]}: p={p:.3f}."}

    def method_items(self):
        st = self.st
        return [["Sample", st.cb.get("population") or ""],
                ["Waves", ", ".join(w["label"] for w in st.cb.get("waves") or []) + f"; {int((st.col(self.wvar) == self.cur).sum()):,} respondents per wave, fresh samples."],
                ["Weighting", f"{st.cb['weight']} within each wave. Percentages are weighted; bases shown are unweighted."],
                ["Significance", "Wald tests on Kish effective bases at 95%. Subgroup trends are screened at 99% because many are examined. Changes also need to exceed a materiality threshold before they are reported."],
                ["Bases", "Routed questions use their own base (for example, image among those familiar with the brand; NPS among current customers). Bases under 50 are not used for claims."]]

    def key_grid(self):
        cols = ["Measure", "Brand"] + [self.wlab(w) for w in self.waves] + [f"{self.wlab(self.prev)}→{self.wlab(self.cur)}", f"{self.wlab(self.first)}→{self.wlab(self.cur)}", f"Base {self.wlab(self.cur)}"]
        rows = []
        for m in self.measures:
            k = m["kind"]; fmtv = "0.0%" if k == "share" else "+0;-0;0" if k == "nps" else "0.00"
            for e in self.ents:
                s = self.series(m, e); t1 = wald(s[-2], s[-1]); th = wald(s[0], s[-1])
                def chg(t):
                    d = t.diff * (100 if k == "share" else 1)
                    f = '"▲ "+0.0;-0.0;0.0' if t.sig() and d > 0 else '+0.0;"▼ "-0.0;0.0' if t.sig() else "+0.0;-0.0;0.0"
                    return {"v": round(d, 1) + 0.0, "fmt": f,
                            "color": ("1E7B4F" if d > 0 else "B3261E") if t.sig() else "1B2430", "bold": t.sig()}
                rows.append({"group": m["id"], "cells": [m["label"] if e is self.ents[0] else None, e["label"]] +
                             [{"v": x.value if x.n >= self.low["suppress"] else "[u]", "fmt": fmtv, "italic": x.n < self.low["indicative"]} for x in s] +
                             [chg(t1), chg(th), {"v": s[-1].n, "fmt": "#,##0"}]})
        return {"title": f"Key measures by wave, {self.wlab(self.first)}–{self.wlab(self.cur)}",
                "subtitle": "Percentages weighted; NPS in points; means on the 0–10 scale. ▲/▼: change significant at 95% (Wald, effective bases). Each measure's base is in Definitions and the measure list below.",
                "columns": cols, "rows": rows, "widths": [34, 12] + [9] * len(self.waves) + [12, 12, 11], "label_cols": 2, "base": "Varies by measure"}
