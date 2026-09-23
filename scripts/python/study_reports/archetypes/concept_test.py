"""Concept-test archetype: monadic cells compared on top-two box with Holm-adjusted pairwise
tests, a materiality threshold, a pre-specified subgroup interaction and routed-base checks."""
from __future__ import annotations
from itertools import combinations
from math import sqrt
from scipy.stats import norm
from engine import share, mean, wald, holm, Test
from .common import fmt_value, fmt_change, plot_value

GREY = "94A3B8"


class ConceptTest:
    def __init__(self, st, spec):
        self.st, self.spec = st, spec
        c = spec["cells"]; self.cvar = c["var"]
        self.cells = [(int(k), v, c["colors"][k]) for k, v in c["labels"].items()]
        self.mat = spec["materiality_pp"] / 100; self.low = spec["low_base"]
        self.measures = spec["primary"] + spec["diagnostics"]

    def lab(self, name): return self.st.vars[name]["label"]

    def base(self, name, extra=None):
        b = self.st.universe(name) & self.st.valid(name)
        return b if extra is None else b & extra

    def t2b(self, name, code, extra=None, box="top_box"):
        st = self.st; v = st.vars[name]
        return share(st.col(name).isin(v["scale"][box]), self.base(name, extra) & (st.col(self.cvar) == code), st.w)

    def pairwise(self, ests):
        """ests: {code: Est}. Returns {(a,b): Test (b - a)} Holm-adjusted across the pairs."""
        pairs = list(combinations([c for c, _, _ in self.cells], 2))
        tests = [wald(ests[a], ests[b]) for a, b in pairs]
        holm(tests)
        return dict(zip(pairs, tests))

    def ranking(self, name):
        ests = {c: self.t2b(name, c) for c, _, _ in self.cells}
        pw = self.pairwise(ests)
        order = sorted(ests, key=lambda c: -ests[c].value)
        return ests, pw, order

    def beats(self, pw, a, b):
        """(significant and material, value of b minus a, test)."""
        t = pw[(a, b)] if (a, b) in pw else pw[(b, a)]
        d = t.diff if (a, b) in pw else -t.diff
        return t.sig() and abs(d) >= self.mat, d, t

    def name(self, code): return next(l for c, l, _ in self.cells if c == code)

    # ------------------------------------------------------------------ subgroup interaction
    def interactions(self):
        sg = self.spec["strategic_subgroup"]; st = self.st
        yes, no = st.col(sg["var"]) == sg["yes"], st.col(sg["var"]) != sg["yes"]
        out = []
        for name in self.spec["primary"]:
            for a, b in combinations([c for c, _, _ in self.cells], 2):
                ya, yb, na_, nb = self.t2b(name, a, yes), self.t2b(name, b, yes), self.t2b(name, a, no), self.t2b(name, b, no)
                dd = (yb.value - ya.value) - (nb.value - na_.value)
                se = sqrt(ya.se ** 2 + yb.se ** 2 + na_.se ** 2 + nb.se ** 2)
                out.append({"measure": name, "a": a, "b": b, "diff": dd, "t": Test(dd, se, dd / se, float(2 * (1 - norm.cdf(abs(dd / se))))),
                            "yes": (ya, yb), "no": (na_, nb)})
        holm([o["t"] for o in out])
        return out

    # ------------------------------------------------------------------ deck
    def deck(self):
        st, sp = self.st, self.spec; slides, chart = [], []
        n = len(st.df); cell_n = {c: int((st.col(self.cvar) == c).sum()) for c, _, _ in self.cells}
        cells_txt = ", ".join(f"{l} n={cell_n[c]:,}" for c, l, _ in self.cells)
        base_all = f"Base: all respondents, each shown one concept at random ({cells_txt}). Weighted ({st.cb['weight']})."
        sig = f"Pairwise tests on top-two box, Holm-adjusted across the three pairs, 95%; 'material' = at least {self.mat * 100:.0f} pts."
        slides.append({"type": "cover", "title": sp["report_title"], "subtitle": sp["brief_title"],
                       "meta": f"{len(self.cells)} concepts · {n:,} respondents · randomised monadic · weighted", "footnote": sp.get("source_note", "")})
        pi, ap = sp["primary"][0], sp["primary"][1]
        e_pi, pw_pi, o_pi = self.ranking(pi)
        e_ap, pw_ap, o_ap = self.ranking(ap)
        inter = self.interactions()
        best_int = min(inter, key=lambda x: x["t"].p_adj)
        routed = [self.routing(r) for r in sp.get("routed", [])]
        # summary
        rows = [self.lead_row(pi, e_pi, pw_pi, o_pi), self.lead_row(ap, e_ap, pw_ap, o_ap)]
        if best_int["t"].sig():
            yb = best_int["yes"]; rows.append({"value": fmt_change(best_int["diff"], "share", 0), "label": f"{sp['strategic_subgroup']['label']}: {self.name(best_int['b'])} vs {self.name(best_int['a'])}",
                                               "change": "interaction · significant (Holm)", "sig": True, "direction": "up", "color": self.color(best_int["b"]),
                                               "text": self.int_title(best_int)})
        for r in routed:
            if r and r["flag"]:
                rows.append({"value": f"{r['min_rate'] * 100:.0f}%", "label": f"{self.lab(r['name'])}: share of {self.name(r['low'])} cell asked", "change": "routed question · base differs by concept",
                             "sig": None, "color": GREY, "text": r["title"]})
        slides.append({"type": "findings", "title": self.summary_title(pi, e_pi, pw_pi, o_pi), "measure": "What the concept test shows · level and comparison",
                       "rows": rows, "source": f"{base_all} {sig}"})
        # scorecard table
        slides.append(self.scorecard(base_all, sig))
        # primary bars
        cats = [l for _, l, _ in self.cells]
        series = [{"name": self.lab(m), "color": col, "values": [plot_value(self.t2b(m, c).value, "share") for c, _, _ in self.cells]}
                  for m, col in ((pi, "1F3A5F"), (ap, "8FA3BF"))]
        for s_ in series:
            for cat, v in zip(cats, s_["values"]): chart.append([len(slides) + 1, "Top-two box by concept", s_["name"], cat, v / 100, "proportion", None, "All respondents in the concept cell"])
        slides.append({"type": "bar", "title": self.pi_title(pi, e_pi, pw_pi, o_pi), "measure": f"Top-two box (4–5) by concept · % of respondents shown each concept",
                       "categories": cats, "series": series, "dir": "col", "legend": True, "max": 100, "fmt": '0"%"', "source": f"{base_all} {sig}"})
        # PI distribution
        slides.append(self.distribution(pi, base_all, chart, len(slides) + 1))
        # subgroup
        slides.append(self.subgroup_slide(best_int, base_all, chart, len(slides) + 1))
        # likes / dislikes
        for key in ("likes_set", "dislikes_set"):
            if sp.get(key): slides.append(self.mr_slide(sp[key], base_all, negative=(key == "dislikes_set")))
        for r in routed:
            if r: slides.append(r["slide"])
        slides.append({"type": "method", "title": "About this study", "items": [
            ["Sample", st.cb.get("population") or ""],
            ["Design", f"Randomised monadic: each respondent saw one of {len(self.cells)} concepts ({cells_txt})."],
            ["Weighting", f"{st.cb['weight']}. Percentages are weighted; bases are unweighted."],
            ["Tests", f"Wald tests on Kish effective bases. Pairwise concept comparisons are Holm-adjusted within each measure. A difference is 'material' at {self.mat * 100:.0f} pts or more."],
            ["Subgroups", f"{sp['strategic_subgroup']['label']} is the pre-specified subgroup; interactions are Holm-adjusted as one family. Other cuts are exploratory (tables only)."]],
            "source": sp.get("source_note", "")})
        return {"meta": {"title": sp["report_title"], "footer": sp["report_title"]}, "slides": slides}, chart, {"interactions": [(self.lab(i["measure"]), self.name(i["a"]), self.name(i["b"]), round(i["diff"] * 100, 1), round(i["t"].p_adj, 4)) for i in inter]}, None

    def color(self, code): return next(col for c, _, col in self.cells if c == code)

    def lead_row(self, name, ests, pw, order):
        a, b = order[0], order[1]
        ok, d, t = self.beats(pw, b, a)
        return {"value": fmt_value(ests[a].value, "share"), "label": f"{self.name(a)} · {self.lab(name).lower()} (top two box)",
                "change": f"{fmt_change(d, 'share')} vs {self.name(b)} · {'significant and material' if ok else 'significant but below materiality' if t.sig() else 'not significant'}",
                "sig": ok, "direction": "up", "color": self.color(a), "text": self.pi_title(name, ests, pw, order)}

    def pi_title(self, name, ests, pw, order):
        a, b, c = order
        ok_ab, d_ab, t_ab = self.beats(pw, b, a); ok_bc, d_bc, _ = self.beats(pw, c, b)
        m = self.lab(name).lower()
        if ok_ab:
            s = f"{self.name(a)} leads on {m} ({fmt_value(ests[a].value, 'share')} top-two box), {d_ab * 100:.0f} pts ahead of {self.name(b)}"
        elif t_ab.sig():
            s = f"{self.name(a)} and {self.name(b)} are close on {m}: {self.name(a)}'s {d_ab * 100:.0f}-pt lead is significant but below the {self.mat * 100:.0f}-pt materiality bar"
        else:
            s = f"No clear winner on {m}: {self.name(a)} ({fmt_value(ests[a].value, 'share')}) and {self.name(b)} ({fmt_value(ests[b].value, 'share')}) are not significantly different"
        if ok_bc: s += f"; {self.name(c)} trails at {fmt_value(ests[c].value, 'share')}"
        return s

    def summary_title(self, name, ests, pw, order):
        a, b, c = order
        ok_ab, _, _ = self.beats(pw, b, a); ok_bc, _, _ = self.beats(pw, c, b)
        if ok_ab: return f"{self.name(a)} is the strongest concept overall; the case for {self.name(b)} rests on a specific audience"
        if ok_bc: return f"{self.name(a)} and {self.name(b)} both clear {self.name(c)}; neither wins outright on {self.lab(name).lower()}"
        return f"No concept is clearly ahead on {self.lab(name).lower()}"

    def int_title(self, i):
        (ya, yb), (na_, nb) = i["yes"], i["no"]; sg = self.spec["strategic_subgroup"]
        return (f"Among {sg['label'].lower()}, {self.name(i['b'])} is {fmt_change(yb.value - ya.value, 'share', 0)} vs {self.name(i['a'])} on {self.lab(i['measure']).lower()}; "
                f"among {sg['no_label'].lower()} it is {fmt_change(nb.value - na_.value, 'share', 0)}")

    def scorecard(self, base_all, sig):
        st = self.st; codes = [c for c, _, _ in self.cells]
        letters = {c: chr(65 + i) for i, c in enumerate(codes)}
        header = ["Top-two box"] + [f"{l} ({letters[c]})" for c, l, _ in self.cells]
        rows, wins = [], {c: 0 for c in codes}
        for m in self.measures:
            ests, pw, order = self.ranking(m)
            row = [{"text": self.lab(m), "bold": m in self.spec["primary"]}]
            for c in codes:
                lets = "".join(letters[o] for o in codes if o != c and self.beats(pw, o, c)[0] and self.beats(pw, o, c)[1] > 0)
                wins[c] += len(lets)
                row.append({"text": f"{ests[c].value * 100:.0f}%" + (f" {lets}" if lets else ""), "bold": bool(lets), "sig": bool(lets), "direction": "up", "align": "right"})
            rows.append(row)
        rows.append([{"text": "Unweighted base", "color": "5B6573"}] + [{"text": f"{int((st.col(self.cvar) == c).sum()):,}", "color": "5B6573", "align": "right"} for c in codes])
        top = max(wins, key=wins.get)
        beat = {o: sum(1 for m in self.measures if self.beats(self.ranking(m)[1], o, top)[0] and self.beats(self.ranking(m)[1], o, top)[1] > 0)
                for o in codes if o != top}
        lost = {o: sum(1 for m in self.measures if self.beats(self.ranking(m)[1], top, o)[0] and self.beats(self.ranking(m)[1], top, o)[1] > 0)
                for o in codes if o != top}
        parts = [f"{self.name(o)} on {k} of {len(self.measures)}" for o, k in sorted(beat.items(), key=lambda x: -x[1])]
        title = f"{self.name(top)} is significantly and materially ahead of " + " and ".join(parts) + " measures"
        if any(lost.values()):
            title += "; " + ", ".join(f"{self.name(o)} beats it on {k}" for o, k in lost.items() if k)
        return {"type": "table", "title": title,
                "measure": "Concept scorecard · top-two box (4–5) · letters = significantly and materially higher than that concept (Holm, 95%, ≥5 pts)",
                "header": header, "rows": rows, "colW": [4.33] + [2.6] * len(codes), "source": f"{base_all} {sig}"}

    def distribution(self, name, base_all, chart, slide_no):
        st = self.st; v = st.vars[name]
        cats = [f"{l}" for _, l, _ in self.cells]
        palette = ["D9786C", "F0C4BE", "E5E7EB", "A9C6E3", "5B8FC7"]
        series = []
        for (code, label), col in zip(st.values(name), palette):
            vals = [plot_value(share(st.col(name) == code, self.base(name) & (st.col(self.cvar) == c), st.w).value, "share") for c, _, _ in self.cells]
            series.append({"name": label, "color": col, "values": vals})
            for cat, x in zip(cats, vals): chart.append([slide_no, f"{self.lab(name)} distribution", label, cat, x / 100, "proportion", None, "All respondents in the concept cell"])
        b2b = {c: self.t2b(name, c, box="bottom_box") for c, _, _ in self.cells}
        pw = self.pairwise(b2b); worst = max(b2b, key=lambda c: b2b[c].value)
        others = [c for c in b2b if c != worst]
        polar = all(self.beats(pw, o, worst)[0] and self.beats(pw, o, worst)[1] > 0 for o in others)
        title = (f"{self.name(worst)} divides opinion: {b2b[worst].value * 100:.0f}% would not {self.lab(name).lower().replace('purchase intent', 'buy')} it, significantly more than the other concepts"
                 if polar else f"The full {self.lab(name).lower()} distribution shows no concept with a significantly larger rejecting minority")
        return {"type": "stacked", "title": title, "measure": f"{v['question_text']} · % by concept", "categories": cats, "series": series,
                "source": f"{base_all} Bottom-two box compared pairwise, Holm-adjusted, 95%, ≥{self.mat * 100:.0f} pts."}

    def subgroup_slide(self, best, base_all, chart, slide_no):
        sg = self.spec["strategic_subgroup"]; st = self.st; name = best["measure"]
        yes, no = st.col(sg["var"]) == sg["yes"], st.col(sg["var"]) != sg["yes"]
        cats = [l for _, l, _ in self.cells]
        series = []
        for lab_, mask, col in ((sg["label"], yes, "C2410C"), (sg["no_label"], no, "94A3B8")):
            ests = [self.t2b(name, c, mask) for c, _, _ in self.cells]
            series.append({"name": lab_, "color": col, "values": [plot_value(e.value, "share") for e in ests]})
            for cat, e in zip(cats, ests): chart.append([slide_no, f"{self.lab(name)} by {sg['label'].lower()}", lab_, cat, e.value, "proportion", e.n, "Respondents in the concept cell and subgroup"])
        bases = "; ".join(f"{l}: {sg['label'].lower()} n={self.t2b(name, c, yes).n}, others n={self.t2b(name, c, no).n}" for c, l, _ in self.cells)
        title = self.int_title(best) if best["t"].sig() else f"No concept performs significantly differently among {sg['label'].lower()} once tests are adjusted"
        return {"type": "bar", "title": title, "measure": f"{self.lab(name)} · top-two box · by {sg['label'].lower()} (pre-specified subgroup)", "categories": cats, "series": series,
                "dir": "col", "legend": True, "max": 100, "fmt": '0"%"',
                "source": f"Base: respondents in each concept cell. {bases}. Weighted. Interaction = difference between concepts among {sg['label'].lower()} minus the same difference among others; "
                          f"Holm-adjusted across {2 * 3} pre-specified tests. This one: {fmt_change(best['diff'], 'share')}, adjusted p={best['t'].p_adj:.4f}."}

    def mr_slide(self, set_id, base_all, negative=False):
        st = self.st; s = st.sets[set_id]; codes = [c for c, _, _ in self.cells]
        items = [m for m in s["members"] if m not in s.get("exclusive", [])]
        base = st.all
        tot = {m: share(st.col(m) == 1, base, st.w).value for m in items}
        items = sorted(items, key=lambda m: -tot[m])[:6]
        letters = {c: chr(65 + i) for i, c in enumerate(codes)}
        header = [s["label"]] + [f"{l} ({letters[c]})" for c, l, _ in self.cells]
        rows, notable = [], []
        for m in items:
            ests = {c: share(st.col(m) == 1, base & (st.col(self.cvar) == c), st.w) for c in codes}
            pw = self.pairwise(ests); row = [st.vars[m]["label"]]
            for c in codes:
                lets = "".join(letters[o] for o in codes if o != c and self.beats(pw, o, c)[0] and self.beats(pw, o, c)[1] > 0)
                if lets: notable.append((m, c, ests[c].value))
                row.append({"text": f"{ests[c].value * 100:.0f}%" + (f" {lets}" if lets else ""), "bold": bool(lets), "sig": bool(lets), "direction": "down" if negative else "up", "align": "right"})
            rows.append(row)
        best = {}
        for m in items:
            ests = {c: share(st.col(m) == 1, base & (st.col(self.cvar) == c), st.w) for c in codes}
            pw = self.pairwise(ests)
            for c in codes:
                ahead = [o for o in codes if o != c and self.beats(pw, o, c)[0] and self.beats(pw, o, c)[1] > 0]
                if not ahead: continue
                lead = min(ests[c].value - ests[o].value for o in codes if o != c)
                score = (len(ahead), lead)
                if c not in best or score > best[c][0]: best[c] = (score, st.vars[m]["label"].lower())
        if best:
            title = f"{s['label']} differs by concept: " + ", ".join(f"{self.name(c)} for {best[c][1]}" for c in codes if c in best)
        else:
            title = f"{s['label']}: no concept stands out significantly on any of the six most-mentioned items"
        return {"type": "table", "title": title, "measure": f"{s['question_text']} · % selecting · six most-mentioned items",
                "header": header, "rows": rows, "colW": [4.33] + [2.6] * len(codes),
                "source": f"{base_all} Letters: significantly and materially higher than that concept (Holm, 95%, ≥{self.mat * 100:.0f} pts). Respondents could choose several."}

    def routing(self, name):
        st = self.st; codes = [c for c, _, _ in self.cells]
        uni = st.universe(name)
        rates = {c: share(uni, st.col(self.cvar) == c, st.w) for c in codes}
        spread = max(r.value for r in rates.values()) - min(r.value for r in rates.values())
        flag = spread >= 0.10
        low_c = min(rates, key=lambda c: rates[c].value)
        t2 = {c: self.t2b(name, c) for c in codes}
        cats = [l for _, l, _ in self.cells]
        title = (f"'{self.lab(name)}' is not comparable across concepts: only {rates[low_c].value * 100:.0f}% of {self.name(low_c)} respondents were asked, against "
                 f"{min(r.value for c, r in rates.items() if c != low_c) * 100:.0f}–{max(r.value for r in rates.values()) * 100:.0f}% of the others" if flag else
                 f"'{self.lab(name)}' was asked of a similar share of each concept cell")
        slide = {"type": "bar", "title": title, "measure": f"Share of each cell asked ({st.vars[name]['universe']['text']}) and top-two box among those asked",
                 "categories": cats, "series": [{"name": "Asked the question (% of cell)", "color": "94A3B8", "values": [plot_value(rates[c].value, "share") for c in codes]},
                                                {"name": "Top-two box among those asked", "color": "1F3A5F", "values": [plot_value(t2[c].value, "share") for c in codes]}],
                 "dir": "col", "legend": True, "max": 100, "fmt": '0"%"',
                 "source": f"Base: respondents in each concept cell; top-two box among those asked (" + ", ".join(f"{self.name(c)} n={t2[c].n}" for c in codes) + "). Weighted. "
                           "Because the routed base differs by concept, compare the top-two box figures with caution."}
        return {"name": name, "flag": flag, "min_rate": rates[low_c].value, "low": low_c, "title": title, "slide": slide}

    # ------------------------------------------------------------------ tablebook grid
    def key_grid(self):
        codes = [c for c, _, _ in self.cells]; letters = {c: chr(65 + i) for i, c in enumerate(codes)}
        cols = ["Measure", "Statistic"] + [f"{l} ({letters[c]})" for c, l, _ in self.cells] + ["Sig. higher (Holm, ≥5 pts)"]
        rows = []
        for m in self.measures + self.spec.get("routed", []):
            for stat, box in (("Top-two box", "top_box"), ("Bottom-two box", "bottom_box")):
                ests = {c: self.t2b(m, c, box=box) for c in codes}; pw = self.pairwise(ests)
                wins = [f"{self.name(c)} > {self.name(o)}" for c in codes for o in codes if o != c and self.beats(pw, o, c)[0] and self.beats(pw, o, c)[1] > 0]
                rows.append({"group": m, "cells": [self.lab(m) if box == "top_box" else None, stat] + [{"v": ests[c].value, "fmt": "0.0%"} for c in codes] + ["; ".join(wins) or "–"]})
            ms = [mean(self.st.col(m).where(self.st.valid(m)), self.base(m) & (self.st.col(self.cvar) == c), self.st.w) for c in codes]
            rows.append({"group": m, "cells": [None, "Mean (1–5)"] + [{"v": x.value, "fmt": "0.00"} for x in ms] + [""]})
            rows.append({"group": m, "cells": [None, "Unweighted base"] + [{"v": self.t2b(m, c).n, "fmt": "#,##0", "color": "5B6573"} for c in codes] + [""]})
        return {"title": "Concept scorecard", "subtitle": f"Weighted percentages. Pairwise Wald tests on Kish effective bases, Holm-adjusted across the three pairs within each row; listed only when also ≥{self.mat * 100:.0f} pts.",
                "columns": cols, "rows": rows, "widths": [34, 16] + [12] * len(codes) + [44], "label_cols": 2, "base": "All respondents in each cell (routed measures: those asked)"}
