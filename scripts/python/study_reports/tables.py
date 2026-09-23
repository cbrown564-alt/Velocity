"""Table definitions derived from a canonical codebook (no study-specific code)."""
from __future__ import annotations
from dataclasses import dataclass, field
import pandas as pd
from engine import Study, Est, share, mean, nps, MISSING_CODES

MISSING_LABEL = {97: "Don't know", 98: "Prefer not to say", 99: "Not answered"}


@dataclass
class Row:
    kind: str                 # share | net | mean | nps | excluded
    label: str
    num: pd.Series | None = None
    base: pd.Series | None = None    # row-specific base (overrides table base)
    x: pd.Series | None = None
    fmt: str = "pct"


@dataclass
class Table:
    id: str
    title: str
    question: str
    base_text: str
    base: pd.Series
    rows: list[Row]
    section: str
    source_vars: list[str] = field(default_factory=list)
    row_bases_vary: bool = False
    notes: list[str] = field(default_factory=list)


def _excluded_rows(st: Study, name, universe):
    s = st.col(name); out = []
    for m in MISSING_CODES:
        if m in st.vars[name]["missing"] and (universe & (s == m)).any():
            out.append(Row("excluded", f"{MISSING_LABEL[m]} (not in base)", num=(s == m), base=universe & s.notna()))
    return out


def var_rows(st: Study, name, base):
    v = st.vars[name]; s = st.col(name); rows = []
    if v["type"] == "scale":
        sc = v["scale"]; pts = sc["points"]
        if len(pts) == 11:
            rows += [Row("nps", "Net score (9–10 minus 0–6)", x=s), Row("net", "9–10", num=s.isin([9, 10])),
                     Row("net", "7–8", num=s.isin([7, 8])), Row("net", "0–6", num=s.isin(range(0, 7)))]
        else:
            top = sc["top_box"]
            rows.append(Row("net", f"Top two box ({min(top)}–{max(top)})", num=s.isin(top)))
        rows += [Row("share", l, num=(s == c)) for c, l in st.values(name)]
        if len(pts) != 11:
            bot = sc["bottom_box"]
            rows.append(Row("net", f"Bottom two box ({min(bot)}–{max(bot)})", num=s.isin(bot)))
        rows.append(Row("mean", f"Mean ({pts[0]}–{pts[-1]})", x=s.where(~s.isin(MISSING_CODES)), fmt="mean"))
    elif v["type"] == "count" and not v["values"]:
        vals = sorted(int(x) for x in s[base & st.valid(name)].unique())
        rows += [Row("share", str(c), num=(s == c)) for c in vals]
        rows.append(Row("mean", "Mean", x=s.where(~s.isin(MISSING_CODES)), fmt="mean"))
    else:
        rows += [Row("share", l, num=(s == c)) for c, l in st.values(name)]
        if v["type"] == "count": rows.append(Row("mean", "Mean", x=s.where(~s.isin(MISSING_CODES)), fmt="mean"))
    return rows


def var_table(st: Study, name, tid, section):
    v = st.vars[name]
    uni = st.universe(name)
    base = uni & st.valid(name)
    rows = var_rows(st, name, base) + _excluded_rows(st, name, uni)
    q = v.get("question_text") or v["label"]
    return Table(tid, v["label"], f"{v.get('question_id') or ''} {q}".strip(), v["universe"]["text"] + "; valid answers", base, rows, section, [name])


def set_tables(st: Study, s, next_id, section):
    """Summary table(s) for a set. Members that are scales also get their own tables elsewhere."""
    members = s["members"]; typ = s["type"]; out = []
    vs = [st.vars[m] for m in members]
    exprs = {m: st.vars[m]["universe"]["expr"] for m in members}
    same_base = len(set(exprs.values())) == 1

    def item_label(m):
        v = st.vars[m]; lab = v["label"]
        return lab.split(": ", 1)[-1].split(" — ")[-1] if typ in ("brand_grid", "brand_attribute_grid") else lab

    def summary(members_, title, question, base_text):
        rows = []
        for m in members_:
            v = st.vars[m]; col = st.col(m); b = st.universe(m) & st.valid(m)
            if v["type"] == "scale":
                num = col.isin(v["scale"]["top_box"]); lab = item_label(m) + " (top two box)"
            else:
                num = col == 1; lab = item_label(m)
            rows.append(Row("share", lab, num=num, base=b))
        uni = st.universe(members_[0]) & st.valid(members_[0])
        vary = len({st.vars[m]["universe"]["expr"] for m in members_}) > 1
        return Table(next_id(), title, question, base_text, uni, rows, section, list(members_), row_bases_vary=vary)

    q = s.get("question_text") or (vs[0].get("question_text") or s["label"])
    qid = s.get("question_id") or ""
    if typ == "multi_response":
        status = s.get("status_variable")
        base = (st.col(status) == 1) if status else pd.concat([st.valid(m) for m in members], axis=1).all(axis=1)
        rows = [Row("share", st.vars[m]["label"], num=st.col(m) == 1) for m in members]
        out.append(Table(next_id(), s["label"], f"{qid} {q}".strip(), s.get("base", "Answered the question") + "; respondents may choose several",
                         base, rows, section, members))
    elif typ == "brand_attribute_grid":
        brands = s["dims"]["brand"]
        for b in brands:
            ms = [m for m in members if m.startswith(f"I_{b}_") or f"_{b}_" in m]
            v0 = st.vars[ms[0]]
            out.append(summary(ms, f"{s['label']}: {v0['label'].split(':', 1)[1].split('—')[0].strip()}", f"{qid} {q}".strip(), v0["universe"]["text"] + "; valid answers"))
    else:  # brand_grid, battery, paired_measure
        if typ == "paired_measure": return out
        base_text = vs[0]["universe"]["text"] + "; valid answers" if same_base else "Varies by row — see base rows"
        out.append(summary(members, s["label"] + (" — summary" if typ == "battery" else ""), f"{qid} {q}".strip(), base_text))
    return out


def build_tables(st: Study, layout: list | None = None) -> list[Table]:
    """Tables in the order given by ``layout`` = [[section, [var or set ids]], ...]; anything unlisted
    (except identifiers, weights, admin and design variables) follows under "Other questions"."""
    order, sections = [], {}
    for sec, items in (layout or []):
        for it in items:
            order.append(it); sections[it] = sec
    in_set = {m: s for s in st.sets.values() for m in s["members"]}
    for v in st.cb["variables"]:
        key = in_set[v["name"]]["id"] if v["name"] in in_set else v["name"]
        if v["type"] in ("identifier", "weight") or v["role"] in ("admin", "design"): continue
        if key not in sections and v["name"] not in sections:
            order.append(key); sections[key] = "Other questions"
    tables, n = [], [0]
    done = set()

    def nid():
        n[0] += 1; return f"T{n[0]}"
    for key in order:
        if key in done: continue
        done.add(key); sec = sections[key]
        if key in st.sets:
            s = st.sets[key]
            tables += set_tables(st, s, nid, sec)
            for m in s["members"]:
                v = st.vars[m]
                if s["type"] in ("multi_response", "brand_attribute_grid") or v["type"] == "binary": continue
                if m in sections and m != key: continue   # listed separately in the layout
                tables.append(var_table(st, m, nid(), sec)); done.add(m)
        else:
            tables.append(var_table(st, key, nid(), sec))
    return tables
