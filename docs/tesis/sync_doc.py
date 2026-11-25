#!/usr/bin/env python3
"""Sync the thesis chapters (Markdown, source of truth) into the Google Doc, section by section.

usage: sync_doc.py DOC.json OUT.json [--max-chars N] [--report] [--reinsert auto|1-14,16]
                   [--delete-orphans] [--only TITLE-PREFIX]
  DOC.json  the `content` object of a read_doc result
  OUT.json  update_doc arguments {requests, writeControl} for the bottom-most changed sections
            whose request JSON fits in N chars (default 25000). Empty requests = nothing to do.
  --report          list what differs: REPLACE, RETITLE, NEW, SKIP-IMG, ORPHAN (a Doc section no
                    Markdown section matches, e.g. one the Markdown moved or removed) and ORPHAN-IMG
  --reinsert auto   sections whose only images are repo figures (`<!-- imagen del Doc: figuras/... -->`
                    in the Markdown) can be rewritten; img_insert.py puts the images back afterwards
  --delete-orphans  also delete ORPHAN sections (never ORPHAN-IMG)
  --delete-orphan-img "7.4.5 ,12.3 "  also delete these ORPHAN-IMG sections (title prefixes), once their
                    images are safe elsewhere (repo figures, or moved by hand in the Doc)
"""
import glob, json, re, subprocess, sys, unicodedata

REPO = str(__import__("pathlib").Path(__file__).parent)
TNR = {"weightedFontFamily": {"fontFamily": "Times New Roman", "weight": 400}}
RESET_TEXT = "bold,italic,underline,strikethrough,weightedFontFamily,fontSize,foregroundColor,backgroundColor,link,baselineOffset"
PARA_FIELDS = "namedStyleType,alignment,spaceAbove,spaceBelow,indentStart,indentEnd,indentFirstLine"
BLUE = {"color": {"rgbColor": {"red": 0.06666667, "green": 0.33333334, "blue": 0.8}}}
RED = {"color": {"rgbColor": {"red": 1}}}
PT = lambda v: {"magnitude": v, "unit": "PT"}


def u16(s):
    return len(s.encode("utf-16-le")) // 2


# ---------------------------------------------------------------- markdown side

def inlines(xs, style=None):
    style = dict(style or {})
    out = []
    for x in xs:
        t, c = x["t"], x.get("c")
        if t == "Str":
            out.append((c, style))
        elif t in ("Space", "SoftBreak", "LineBreak"):
            out.append((" ", style))
        elif t == "Strong":
            out += inlines(c, {**style, "bold": True})
        elif t == "Emph":
            out += inlines(c, {**style, "italic": True})
        elif t == "Strikeout":
            out += inlines(c, style)
        elif t == "Code":
            out.append((c[1], style))
        elif t == "Link":
            out += inlines(c[1], {**style, "link": c[2][0]})
        elif t == "Quoted":
            q = '"' if c[0]["t"] == "DoubleQuote" else "'"
            out += [(q, style)] + inlines(c[1], style) + [(q, style)]
        elif t in ("Span", "Underline", "SmallCaps", "Superscript", "Subscript"):
            out += inlines(c[-1] if isinstance(c, list) else c, style)
        elif t == "Math":
            out.append((c[1], style))
        elif t in ("RawInline", "Note", "Image"):
            pass
        else:
            raise SystemExit(f"inline {t}")
    # merge adjacent runs with the same style
    merged = []
    for text, st in out:
        if merged and merged[-1][1] == st:
            merged[-1] = (merged[-1][0] + text, st)
        else:
            merged.append((text, st))
    return merged


def blocks(bs, quote=False, level=None, ordered=False):
    out = []
    for b in bs:
        t, c = b["t"], b.get("c")
        if t in ("Para", "Plain"):
            runs = inlines(c)
            if level is not None:
                out.append({"k": "li", "runs": runs, "level": level, "ordered": ordered})
            else:
                out.append({"k": "quote" if quote else "p", "runs": runs})
        elif t == "Header":
            out.append({"k": "h", "level": c[0], "runs": inlines(c[2])})
        elif t in ("BulletList", "OrderedList"):
            items = c if t == "BulletList" else c[1]
            lv = 0 if level is None else level + 1
            for item in items:
                first = True
                for sub in item:
                    if sub["t"] in ("Para", "Plain") and first:
                        out += blocks([sub], quote, lv, t == "OrderedList")
                        first = False
                    else:
                        out += blocks([sub], quote, lv if sub["t"] in ("BulletList", "OrderedList") else None)
        elif t == "BlockQuote":
            out += blocks(c, True, level, ordered)
        elif t == "CodeBlock":
            for line in c[1].rstrip("\n").split("\n"):
                out.append({"k": "code", "runs": [(line, {})] if line else []})
        elif t == "Table":
            rows = []
            head, bodies = c[3], c[4]
            def cell_runs(cell):
                rs = []
                for bb in cell[4]:
                    rs += inlines(bb["c"]) if bb["t"] in ("Para", "Plain") else []
                return rs
            for row in head[1]:
                rows.append([cell_runs(cell) for cell in row[1]])
            nhead = len(rows)
            for body in bodies:
                for row in body[3]:
                    rows.append([cell_runs(cell) for cell in row[1]])
            out.append({"k": "table", "rows": rows, "head": nhead})
        elif t == "HorizontalRule":
            pass
        elif t == "Div":
            out += blocks(c[1], quote, level, ordered)
        elif t == "RawBlock":
            # `<!-- imagen del Doc[: path] -->` marks where an image sits in the Doc
            mk = re.match(r"\s*<!-- imagen del Doc(?:: (\S+))?", c[1])
            if mk:
                out.append({"k": "img", "path": mk.group(1), "runs": []})
        else:
            raise SystemExit(f"block {t}")
    return out


def md_sections():
    text = "\n\n".join(open(p).read() for p in sorted(glob.glob(f"{REPO}/[0-9][0-9]-*.md")))
    ast = json.loads(subprocess.run(["pandoc", "-f", "gfm", "-t", "json"], input=text, capture_output=True,
                                    text=True, check=True).stdout)
    bl = blocks(ast["blocks"])
    secs = []
    for b in bl:
        if b["k"] == "h":
            secs.append({"level": b["level"], "title": "".join(r[0] for r in b["runs"]).strip(), "blocks": []})
        elif secs:
            secs[-1]["blocks"].append(b)
    return secs


def runs_text(runs):
    return "".join(r[0] for r in runs)


def md_plain(blocks_):
    parts = []
    for b in blocks_:
        if b["k"] == "img":
            continue
        if b["k"] == "table":
            parts += [runs_text(c) for row in b["rows"] for c in row]
        else:
            parts.append(runs_text(b["runs"]))
    return norm(" ".join(parts))


def norm(s):
    s = unicodedata.normalize("NFC", s).replace("\u000b", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------- doc side

def para_text(p):
    return "".join(e.get("textRun", {}).get("content", "") for e in p["elements"])


def doc_sections(doc):
    body = doc["tabs"][0]["documentTab"]["body"]["content"]
    secs, started = [], False
    for el in body:
        p = el.get("paragraph")
        st = p and p["paragraphStyle"].get("namedStyleType", "")
        if p and st.startswith("HEADING_") and para_text(p).strip():
            title = para_text(p).strip()
            if title == "1. Introducción":
                started = True
            if started:
                secs.append({"title": title, "level": int(st[-1]), "hs": el["startIndex"], "he": el["endIndex"],
                             "els": [], "img": False})
                continue
        if started and secs and "startIndex" in el:
            secs[-1]["els"].append(el)
            # inline images and floating ones (positioned objects, anchored to a paragraph) alike: a
            # replace would delete them, so these sections are never rewritten
            if p and (p.get("positionedObjectIds") or any("inlineObjectElement" in e for e in p["elements"])):
                secs[-1]["img"] = True
    body_end = body[-1]["endIndex"]
    for i, s in enumerate(secs):
        # the last section runs to the body's final newline, which can never be deleted
        s["end"] = secs[i + 1]["hs"] if i + 1 < len(secs) else body_end - 1
        s["last"] = i + 1 == len(secs)
        s["body_end"] = body_end
        s["img"] = s["img"] and not reinsertable(s["els"])
    return secs


# Figures whose source image is in the repository (docs/tesis/figuras/ or docs/mediciones/): a section
# whose only images are these, each right above its "Figura N:" caption, can be rewritten, and
# scratchpad imgins.py puts the images back above their captions afterwards. Set with --reinsert.
REINSERT = set()
REINSERT_CAPTIONS = set()  # with --reinsert auto: caption texts, without "Figura N:", of the repo figures


def caption_key(text):
    return norm(re.sub(r"^Figura \d+:\s*", "", text))[:80]


def repo_figures():
    """{figure number: (path relative to docs/tesis, width in pt)} for every figure whose image lives in
    the repository: a `<!-- imagen del Doc: figuras/x.png [ancho=N] -->` marker followed by its
    "Figura N:" caption."""
    out, pending = {}, None
    for path in sorted(glob.glob(f"{REPO}/[0-9][0-9]-*.md")):
        for line in open(path):
            m = re.match(r"\s*<!-- imagen del Doc: (\S+)(?: ancho=(\d+))? -->", line)
            if m:
                pending = (m.group(1), int(m.group(2) or 400))
                continue
            if not line.strip():
                continue
            c = re.match(r"Figura (\d+):", line)
            if pending and c:
                out[int(c.group(1))] = pending
                REINSERT_CAPTIONS.add(caption_key(line))
            pending = None
    return out


def reinsertable(els):
    if not REINSERT:
        return False
    for i, el in enumerate(els):
        p = el.get("paragraph")
        if not p:
            continue
        if p.get("positionedObjectIds"):
            return False
        if any("inlineObjectElement" in e for e in p["elements"]):
            nxt = next((x["paragraph"] for x in els[i + 1:] if "paragraph" in x), None)
            m = nxt and re.match(r"Figura (\d+):", para_text(nxt))
            if not m:
                return False
            # by caption text when known: numbers shift whenever a figure is added or moved
            if REINSERT_CAPTIONS:
                if caption_key(para_text(nxt)) not in REINSERT_CAPTIONS:
                    return False
            elif int(m.group(1)) not in REINSERT:
                return False
    return True


def doc_plain(els):
    parts = []
    for el in els:
        if "paragraph" in el:
            parts.append(para_text(el["paragraph"]))
        elif "table" in el:
            for r in el["table"]["tableRows"]:
                for c in r["tableCells"]:
                    parts.append(" ".join(para_text(x["paragraph"]) for x in c["content"] if "paragraph" in x))
    return norm(" ".join(parts))


def strip_num(t):
    return re.sub(r"^\d+(\.\d+)*\.?\s+", "", t).strip()


# ---------------------------------------------------------------- request builder

class Builder:
    def __init__(self):
        self.req = []

    def rng(self, a, b):
        return {"startIndex": a, "endIndex": b}

    def text_style(self, a, b, runs, base_extra=None, color_markers=True):
        if b <= a:
            return
        base = {**TNR, **(base_extra or {})}
        self.req.append({"updateTextStyle": {"range": self.rng(a, b), "textStyle": base, "fields": RESET_TEXT}})
        pos = a
        for text, st in runs:
            n = u16(text)
            ts, f = {}, []
            if st.get("bold"):
                ts["bold"] = True; f.append("bold")
            if st.get("italic"):
                ts["italic"] = True; f.append("italic")
            if st.get("link"):
                ts.update({"link": {"url": st["link"]}, "underline": True, "foregroundColor": BLUE})
                f += ["link", "underline", "foregroundColor"]
            if f and n:
                self.req.append({"updateTextStyle": {"range": self.rng(pos, pos + n), "textStyle": ts,
                                                     "fields": ",".join(f)}})
            pos += n
        if color_markers:
            full = runs_text(runs)
            for m in re.finditer(r"\[(PENDIENTE|FIGURA)[^\]]*\]", full):
                s = a + u16(full[:m.start()]); e = a + u16(full[:m.end()])
                self.req.append({"updateTextStyle": {"range": self.rng(s, e), "textStyle": {"foregroundColor": RED},
                                                     "fields": "foregroundColor"}})

    def para_style(self, a, b, kind, level=None):
        if kind == "h":
            ps = {"namedStyleType": f"HEADING_{level}"}
        elif kind == "quote":
            ps = {"namedStyleType": "NORMAL_TEXT", "alignment": "JUSTIFIED", "spaceAbove": PT(12), "spaceBelow": PT(12),
                  "indentStart": PT(30), "indentEnd": PT(30), "indentFirstLine": PT(30)}
        elif kind in ("code", "cell"):
            ps = {"namedStyleType": "NORMAL_TEXT", "alignment": "JUSTIFIED"}
        else:
            ps = {"namedStyleType": "NORMAL_TEXT", "alignment": "JUSTIFIED", "spaceAbove": PT(12), "spaceBelow": PT(12)}
        self.req.append({"updateParagraphStyle": {"range": self.rng(a, b), "paragraphStyle": ps, "fields": PARA_FIELDS}})

    def emit_blocks(self, cursor, blocks_, fill_empty=False):
        """Insert blocks after the paragraph whose newline is at `cursor`. If fill_empty, the paragraph at
        `cursor` is an empty one to be filled by the first paragraph block."""
        i = 0
        while i < len(blocks_):
            b = blocks_[i]
            if b["k"] == "img":
                i += 1  # the Doc's own images stay where they are; repo figures come back via img_insert.py
                continue
            if b["k"] == "table":
                cursor = self.emit_table(cursor, b)
                fill_empty = True
                i += 1
                continue
            if b["k"] == "li":
                group = []
                while i < len(blocks_) and blocks_[i]["k"] == "li":
                    group.append(blocks_[i]); i += 1
                cursor, fill_empty = self.emit_list(cursor, group, fill_empty), False
                continue
            text = runs_text(b["runs"])
            if fill_empty:
                start = cursor
                self.req.append({"insertText": {"location": {"index": cursor}, "text": text}} if text else None)
                fill_empty = False
            else:
                start = cursor + 1
                self.req.append({"insertText": {"location": {"index": cursor}, "text": "\n" + text}})
            self.req = [r for r in self.req if r]
            end = start + u16(text)
            self.req.append({"deleteParagraphBullets": {"range": self.rng(start, end + 1)}})
            self.para_style(start, end + 1, b["k"], b.get("level"))
            if b["k"] == "h":
                self.req.append({"updateTextStyle": {"range": self.rng(start, end), "textStyle": {},
                                                     "fields": RESET_TEXT}} if end > start else None)
                self.req = [r for r in self.req if r]
            else:
                self.text_style(start, end, b["runs"])
            cursor = end
            i += 1
        if fill_empty:
            # an empty paragraph left after a table at the end of the section: make it plain body text
            self.req.append({"deleteParagraphBullets": {"range": self.rng(cursor, cursor + 1)}})
            self.para_style(cursor, cursor + 1, "code")
        return cursor

    def emit_list(self, cursor, group, fill_empty):
        texts = [("\t" * g["level"]) + runs_text(g["runs"]) for g in group]
        joined = "\n".join(texts)
        if fill_empty:
            start = cursor
            self.req.append({"insertText": {"location": {"index": cursor}, "text": joined}})
        else:
            start = cursor + 1
            self.req.append({"insertText": {"location": {"index": cursor}, "text": "\n" + joined}})
        end = start + u16(joined)
        preset = "NUMBERED_DECIMAL_ALPHA_ROMAN" if group[0]["ordered"] else "BULLET_DISC_CIRCLE_SQUARE"
        self.req.append({"deleteParagraphBullets": {"range": self.rng(start, end + 1)}})
        self.req.append({"createParagraphBullets": {"range": self.rng(start, end + 1), "bulletPreset": preset}})
        tabs = sum(g["level"] for g in group)
        end -= tabs
        self.req.append({"updateParagraphStyle": {"range": self.rng(start, end + 1), "paragraphStyle": {
            "namedStyleType": "NORMAL_TEXT", "alignment": "JUSTIFIED", "spaceAbove": PT(12), "spaceBelow": PT(12)},
            "fields": "namedStyleType,alignment,spaceAbove,spaceBelow"}})
        pos = start
        for g in group:
            t = runs_text(g["runs"])
            self.text_style(pos, pos + u16(t), g["runs"])
            pos += u16(t) + 1
        return end

    def emit_table(self, cursor, b):
        rows = b["rows"]
        R, C = len(rows), max(len(r) for r in rows)
        i = cursor
        self.req.append({"insertTable": {"rows": R, "columns": C, "location": {"index": i}}})
        empty_after = i + 3 + R * (2 * C + 1)
        self.req.append({"updateParagraphStyle": {"range": self.rng(empty_after, empty_after + 1),
                                                  "paragraphStyle": {"namedStyleType": "NORMAL_TEXT"},
                                                  "fields": "namedStyleType"}})
        cells = [(r, c, rows[r][c] if c < len(rows[r]) else []) for r in range(R) for c in range(C)]
        for r, c, runs in reversed(cells):
            t = runs_text(runs)
            if t:
                self.req.append({"insertText": {"location": {"index": i + 4 + r * (2 * C + 1) + 2 * c}, "text": t}})
        total = sum(u16(runs_text(x[2])) for x in cells)
        t_start, t_end = i + 1, empty_after + total
        self.req.append({"updateParagraphStyle": {"range": self.rng(t_start + 1, t_end - 1), "paragraphStyle": {
            "namedStyleType": "NORMAL_TEXT", "alignment": "JUSTIFIED"}, "fields": PARA_FIELDS}})
        self.req.append({"updateTextStyle": {"range": self.rng(t_start + 1, t_end - 1), "textStyle": TNR,
                                             "fields": RESET_TEXT}})
        before = 0
        for r, c, runs in cells:
            p = i + 4 + r * (2 * C + 1) + 2 * c + before
            n = u16(runs_text(runs))
            if n:
                rr = [(x, {**st, "bold": True}) for x, st in runs] if r < b["head"] else runs
                if any(st for _, st in rr) or re.search(r"\[(PENDIENTE|FIGURA)", runs_text(runs)):
                    self.text_style_runs(p, rr)
            before += n
        return t_end

    def text_style_runs(self, a, runs):
        pos = a
        for text, st in runs:
            n = u16(text)
            ts, f = {}, []
            if st.get("bold"):
                ts["bold"] = True; f.append("bold")
            if st.get("italic"):
                ts["italic"] = True; f.append("italic")
            if st.get("link"):
                ts.update({"link": {"url": st["link"]}, "underline": True, "foregroundColor": BLUE})
                f += ["link", "underline", "foregroundColor"]
            if f and n:
                self.req.append({"updateTextStyle": {"range": self.rng(pos, pos + n), "textStyle": ts,
                                                     "fields": ",".join(f)}})
            pos += n


# ---------------------------------------------------------------- plan

def score(m, d):
    """How well Markdown section m matches Doc section d: 0 = not the same section. Same title beats
    same title under another number; equal text breaks ties between repeated titles."""
    if d["title"] == m["title"]:
        sc = 4
    elif strip_num(d["title"]) == strip_num(m["title"]) and d["level"] == m["level"]:
        sc = 2
    else:
        return 0
    return sc + (1 if md_plain(m["blocks"]) == doc_plain(d["els"]) else 0)


def align(md, ds):
    """Order-preserving alignment of Markdown and Doc sections with the highest total score (weighted
    longest common subsequence). A greedy forward match jumps to the first title that fits further down
    and drops everything in between; this keeps the bulk in place, so only the sections that really
    moved come out as NEW (in the Markdown) plus ORPHAN (in the Doc). Returns [(md index, doc index)]."""
    n, k = len(md), len(ds)
    sc = [[score(m, d) for d in ds] for m in md]
    best = [[0] * (k + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        row, nxt, si = best[i], best[i + 1], sc[i]
        for j in range(k - 1, -1, -1):
            v = max(nxt[j], row[j + 1])
            if si[j]:
                v = max(v, si[j] + nxt[j + 1])
            row[j] = v
    pairs, i, j = [], 0, 0
    while i < n and j < k:
        if sc[i][j] and best[i][j] == sc[i][j] + best[i + 1][j + 1]:
            pairs.append((i, j)); i += 1; j += 1
        elif best[i][j] == best[i + 1][j]:
            i += 1
        else:
            j += 1
    return pairs


def plan(doc):
    md, ds = md_sections(), doc_sections(doc)
    pairs = align(md, ds)
    doc_of = dict(pairs)
    matched = {j for _, j in pairs}
    ops, pending_new = [], []
    for i, m in enumerate(md):
        k = doc_of.get(i)
        if k is None:
            pending_new.append(m)
            continue
        if pending_new:
            ops.append({"t": "new", "at": ds[k]["hs"], "secs": pending_new})
            pending_new = []
        d = ds[k]
        if d["title"] != m["title"]:
            ops.append({"t": "retitle", "d": d, "m": m})
        if md_plain(m["blocks"]) != doc_plain(d["els"]):
            if d["img"]:
                # with images only a paragraph-level patch is safe: it never touches the image paragraphs
                if patch(d, m) is not None or segments(d, m) is not None:
                    ops.append({"t": "replace", "d": d, "m": m, "img": True})
                else:
                    ops.append({"t": "skip-img", "d": d, "m": m})
            else:
                ops.append({"t": "replace", "d": d, "m": m})
    if pending_new:
        if not ds:
            raise SystemExit("the Doc has no '1. Introducción' heading: nothing to anchor the chapters to")
        ops.append({"t": "new", "at": ds[-1]["body_end"], "secs": pending_new, "at_end": True})
    # Doc sections no Markdown section claimed: moved (the Markdown has them elsewhere, as NEW) or removed
    for k, d in enumerate(ds):
        if k not in matched:
            ops.append({"t": "orphan-img" if d["img"] else "orphan", "d": d})
    return ops


def op_pos(op):
    return op["at"] if op["t"] == "new" else op["d"]["hs"]


def patch(d, m):
    """Paragraph-level edit: when the section has the same sequence of paragraphs, list items and tables
    (same rows and columns) as the Markdown, rewrite only the paragraphs and table cells whose text
    changed, keeping their paragraph style. Much smaller batches than a full replace. Returns None when
    the structure differs (then a full replace)."""
    units = []
    for el in d["els"]:
        if "table" in el:
            units.append(("table", el))
        elif "paragraph" in el:
            p = el["paragraph"]
            text = para_text(p).rstrip("\n")
            if not text.strip():
                continue
            if p.get("positionedObjectIds"):
                return None
            if any("inlineObjectElement" in e for e in p["elements"]):
                if text.strip():
                    return None
                continue  # an image paragraph is left exactly where it is
            units.append(("li" if p.get("bullet") else "p", el))
    mb = [x for x in m["blocks"] if x["k"] == "table" or (x["k"] != "img" and runs_text(x["runs"]).strip())]
    if len(units) != len(mb):
        return None
    edits = []  # (start, end, runs)

    def edit(el_par, runs):
        text = para_text(el_par["paragraph"]).rstrip("\n")
        new = runs_text(runs)
        if text != new:
            edits.append((el_par["startIndex"], el_par["endIndex"], runs))

    for (kind, el), blk in zip(units, mb):
        mk = "li" if blk["k"] == "li" else ("table" if blk["k"] == "table" else "p")
        if mk != kind:
            return None
        if kind != "table":
            edit(el, blk["runs"])
            continue
        rows = el["table"]["tableRows"]
        if len(rows) != len(blk["rows"]):
            return None
        for r, mr in zip(rows, blk["rows"]):
            cells = r["tableCells"]
            if len(cells) != len(mr):
                return None
            for c, mc in zip(cells, mr):
                ps = [x for x in c["content"] if "paragraph" in x]
                if len(ps) != 1:
                    if norm(" ".join(para_text(x["paragraph"]) for x in ps)) != norm(runs_text(mc)):
                        return None
                    continue
                edit(ps[0], mc)
    b = Builder()
    for s, e, runs in sorted(edits, key=lambda x: -x[0]):
        new = runs_text(runs)
        if e - 1 > s:
            b.req.append({"deleteContentRange": {"range": b.rng(s, e - 1)}})
        if new:
            b.req.append({"insertText": {"location": {"index": s}, "text": new}})
            b.text_style(s, s + u16(new), runs)
    return b.req


def is_image_par(el):
    p = el.get("paragraph")
    return bool(p) and any("inlineObjectElement" in e for e in p["elements"]) and not para_text(p).strip()


def segments(d, m):
    """Replace plan for a section with images whose structure changed: the Doc's image paragraphs split
    the section into stretches of text, the Markdown's `<!-- imagen del Doc -->` markers split it the
    same way, and each stretch that differs is rewritten whole. The images are never touched. Returns
    None when the counts disagree or an image floats (positioned object)."""
    els = d["els"]
    if any(el.get("paragraph", {}).get("positionedObjectIds") for el in els):
        return None
    imgs = [el for el in els if is_image_par(el)]
    if any("inlineObjectElement" in e for el in els if "paragraph" in el and not is_image_par(el)
           for e in el["paragraph"]["elements"]):
        return None  # an image sharing its paragraph with text
    md_parts, cur = [], []
    for blk in m["blocks"]:
        if blk["k"] == "img":
            md_parts.append(cur); cur = []
        else:
            cur.append(blk)
    md_parts.append(cur)
    if len(md_parts) != len(imgs) + 1:
        return None
    bounds = [d["he"]] + [im["endIndex"] for im in imgs]
    ends = [im["startIndex"] for im in imgs] + [d["end"]]
    reqs = []
    for k in range(len(md_parts) - 1, -1, -1):
        a, b_, part = bounds[k], ends[k], md_parts[k]
        doc_els = [el for el in els if a <= el.get("startIndex", -1) < b_]
        if md_plain(part) == doc_plain(doc_els):
            continue
        bld = Builder()
        if b_ > a:
            bld.req.append({"deleteContentRange": {"range": bld.rng(a, b_)}})
        bld.emit_blocks(a - 1, part)
        if part and part[0]["k"] == "table":
            # a table inserted right after the anchor paragraph takes its newline: restore its style
            style = ({"namedStyleType": f"HEADING_{m['level']}"}, "namedStyleType") if k == 0 else \
                ({"namedStyleType": "NORMAL_TEXT", "alignment": "CENTER"}, "namedStyleType,alignment")
            start = d["hs"] if k == 0 else imgs[k - 1]["startIndex"]
            bld.req.append({"updateParagraphStyle": {"range": bld.rng(start, a), "paragraphStyle": style[0],
                                                     "fields": style[1]}})
        reqs += bld.req
    return reqs


def build(op):
    b = Builder()
    if op["t"] == "replace":
        d, m = op["d"], op["m"]
        small = patch(d, m)
        if small is not None:
            return small
        if op.get("img"):
            return segments(d, m) or []  # never rewrite a section with images wholesale
        if d["end"] > d["he"]:
            b.req.append({"deleteContentRange": {"range": b.rng(d["he"], d["end"])}})
        b.emit_blocks(d["he"] - 1, m["blocks"])
        if m["blocks"] and m["blocks"][0]["k"] == "table":
            # a table inserted right after the heading takes the heading's newline: restore its style
            b.req.append({"updateParagraphStyle": {"range": b.rng(d["hs"], d["he"]), "paragraphStyle": {
                "namedStyleType": f"HEADING_{m['level']}"}, "fields": "namedStyleType"}})
    elif op["t"] == "orphan":
        d = op["d"]
        b.req.append({"deleteContentRange": {"range": b.rng(d["hs"], d["end"])}})
        if d["last"]:
            # what is left is the body's final paragraph: make sure it is plain text, not the heading
            b.req.append({"updateParagraphStyle": {"range": b.rng(d["hs"], d["hs"] + 1), "paragraphStyle": {
                "namedStyleType": "NORMAL_TEXT"}, "fields": "namedStyleType"}})
    elif op["t"] == "retitle":
        d, m = op["d"], op["m"]
        b.req.append({"deleteContentRange": {"range": b.rng(d["hs"], d["he"] - 1)}})
        b.req.append({"insertText": {"location": {"index": d["hs"]}, "text": m["title"]}})
    elif op["t"] == "new":
        # insert "TITLE\n" at the start of the next heading, then the blocks after it. At the end of the
        # body, first open an empty paragraph after the last one and insert there.
        at = op["at"]
        if op.get("at_end"):
            b.req.append({"insertText": {"location": {"index": at - 1}, "text": "\n"}})
        cursor = None
        first = True
        for s in op["secs"]:
            if first:
                b.req.append({"insertText": {"location": {"index": at}, "text": s["title"] + "\n"}})
                start = at
                cursor = at + u16(s["title"])
                first = False
            else:
                b.req.append({"insertText": {"location": {"index": cursor}, "text": "\n" + s["title"]}})
                start = cursor + 1
                cursor = start + u16(s["title"])
            b.req.append({"deleteParagraphBullets": {"range": b.rng(start, cursor + 1)}})
            b.para_style(start, cursor + 1, "h", s["level"])
            b.req.append({"updateTextStyle": {"range": b.rng(start, cursor), "textStyle": {}, "fields": RESET_TEXT}})
            hstart, hend = start, cursor + 1
            cursor = b.emit_blocks(cursor, s["blocks"])
            if s["blocks"] and s["blocks"][0]["k"] == "table":
                b.req.append({"updateParagraphStyle": {"range": b.rng(hstart, hend), "paragraphStyle": {
                    "namedStyleType": f"HEADING_{s['level']}"}, "fields": "namedStyleType"}})
    return b.req


def main():
    args = sys.argv[1:]
    if "--reinsert" in args and args[args.index("--reinsert") + 1] == "auto":
        REINSERT.update(repo_figures())
    elif "--reinsert" in args:
        for part in args[args.index("--reinsert") + 1].split(","):
            a, _, b = part.partition("-")
            REINSERT.update(range(int(a), int(b or a) + 1))
    doc = json.load(open(args[0]))
    out = args[1]
    maxc = int(args[args.index("--max-chars") + 1]) if "--max-chars" in args else 25000
    ops = plan(doc)
    if "--report" in args:
        for op in ops:
            t = op["t"]
            if t == "new":
                where = "AT END" if op.get("at_end") else f"before {op['at']}"
                print("NEW", where, [s["title"] for s in op["secs"]])
            else:
                print(t.upper(), op["d"]["title"], "->", op["m"]["title"] if t == "retitle" else "")
    SKIP = ("13.2.3 ",)
    force = tuple(args[args.index("--delete-orphan-img") + 1].split(",")) if "--delete-orphan-img" in args else ()
    for op in ops:
        if op["t"] == "orphan-img" and force and op["d"]["title"].startswith(force):
            op["t"] = "orphan"
    kinds = ("replace", "retitle", "new") + (("orphan",) if "--delete-orphans" in args else ())
    todo = [op for op in ops if op["t"] in kinds
            # matched by the Doc's title or the Markdown's: a renumbered section keeps its old title in
            # the Doc until its retitle lands
            and not (op["t"] == "replace" and (op["d"]["title"].startswith(SKIP)
                                               or op["m"]["title"].startswith(SKIP)))]
    if "--only" in args:
        want = args[args.index("--only") + 1]
        todo = [op for op in todo if op["t"] != "new" and op["d"]["title"].startswith(want)]
    # bottom-up: an edit never moves an index a later (lower) edit relies on. Within one section, the
    # retitle (heading text) goes after the body replace, which is below it.
    # same index: the body replace (below the heading) first, then the retitle, then a new section
    # inserted before that heading, so no op uses an index another op at the same spot already moved
    todo.sort(key=lambda op: (op_pos(op), {"orphan": 3, "replace": 2, "retitle": 1, "new": 0}[op["t"]]),
              reverse=True)
    reqs, size = [], 0
    for op in todo:
        r = build(op)
        n = len(json.dumps(r, ensure_ascii=False, separators=(",", ":")))
        if reqs and size + n > maxc:
            break
        reqs += r
        size += n
    json.dump({"requests": reqs, "writeControl": {"requiredRevisionId": doc["revisionId"]}}, open(out, "w"),
              ensure_ascii=False, separators=(",", ":"))
    print(f"ops={len(todo)} batch_requests={len(reqs)} batch_chars={size}", file=sys.stderr)


if __name__ == "__main__":
    main()
