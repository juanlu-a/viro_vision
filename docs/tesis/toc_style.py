#!/usr/bin/env python3
"""Make every line of the Doc's table of contents use one font family and size.

usage: toc_style.py DOC.json OUT.json [--font "Times New Roman"] [--size N]
  DOC.json  the `content` object of a read_doc result (a whole read_doc result also works)
  OUT.json  update_doc arguments {requests, writeControl}: one updateTextStyle per TOC paragraph
            that is not already in the target font and size (adjacent ones merged into one range),
            touching only weightedFontFamily and fontSize, then re-applying bold where it was (the
            font change clears it); links and the rest stay as they are. Empty requests = nothing to do.

Refreshing the index from the Docs UI mixes fonts (new lines come out in Arial); the API cannot
refresh the index, but it can restyle the text inside it. Default font and size are the majority,
by characters, among the TOC runs.
"""
import collections, json, sys


def u16(s):
    return len(s.encode("utf-16-le")) // 2


def font_size(st, default=(None, None)):
    return (st.get("weightedFontFamily", {}).get("fontFamily") or default[0],
            st.get("fontSize", {}).get("magnitude") or default[1])


def named_styles(tab):
    """Effective (font, size) per named style; missing fields inherit from NORMAL_TEXT."""
    styles = {s["namedStyleType"]: s.get("textStyle", {})
              for s in tab["documentTab"].get("namedStyles", {}).get("styles", [])}
    normal = font_size(styles.get("NORMAL_TEXT", {}))
    return {k: font_size(v, normal) for k, v in styles.items()}, normal


def run_style(r, para_default):
    # A run without an explicit font or size inherits it from its paragraph's named style
    # (the API drops explicit values equal to the inherited ones).
    return font_size(r["textRun"].get("textStyle", {}), para_default)


def toc_paragraphs(doc):
    for tab in doc["tabs"]:
        styles, normal = named_styles(tab)
        for el in tab["documentTab"]["body"]["content"]:
            if "tableOfContents" in el:
                for c in el["tableOfContents"]["content"]:
                    if "paragraph" in c:
                        kind = c["paragraph"].get("paragraphStyle", {}).get("namedStyleType")
                        yield tab["tabProperties"]["tabId"], c, styles.get(kind, normal)


def main():
    args = sys.argv[1:]
    font = size = None
    if "--font" in args:
        i = args.index("--font"); font = args[i + 1]; del args[i:i + 2]
    if "--size" in args:
        i = args.index("--size"); size = float(args[i + 1]); del args[i:i + 2]
    if len(args) != 2:
        raise SystemExit(__doc__)
    doc = json.load(open(args[0]))
    doc = doc.get("content", doc)

    paras = list(toc_paragraphs(doc))
    if not paras:
        raise SystemExit("the Doc has no table of contents")
    fonts, sizes = collections.Counter(), collections.Counter()
    for _, p, base in paras:
        for r in p["paragraph"]["elements"]:
            if "textRun" in r:
                f, s = run_style(r, base)
                n = u16(r["textRun"]["content"])
                fonts[f] += n
                sizes[s] += n
    print("TOC runs by characters:")
    print("  fonts:", dict(fonts.most_common()))
    print("  sizes:", dict(sizes.most_common()))
    font = font or fonts.most_common(1)[0][0]
    size = size or sizes.most_common(1)[0][0]
    if font is None or size is None:
        raise SystemExit("cannot infer target font/size; pass --font and --size")
    print(f"target: {font} {size:g} pt")

    reqs, bold, changed = [], [], 0
    for tab_id, p, base in paras:
        runs = [r for r in p["paragraph"]["elements"] if "textRun" in r]
        if all(run_style(r, base) == (font, size) for r in runs):
            continue
        for r in runs:
            if r["textRun"].get("textStyle", {}).get("bold"):
                if bold and bold[-1][0] == tab_id and bold[-1][2] == r["startIndex"]:
                    bold[-1][2] = r["endIndex"]
                else:
                    bold.append([tab_id, r["startIndex"], r["endIndex"]])
        text = "".join(r["textRun"]["content"] for r in runs).rstrip("\n")
        print(f"  restyle [{p['startIndex']},{p['endIndex']}) {text[:60]!r}")
        last = reqs[-1]["updateTextStyle"]["range"] if reqs else None
        if last and last["tabId"] == tab_id and last["endIndex"] == p["startIndex"]:
            last["endIndex"] = p["endIndex"]  # adjacent paragraphs: one request
            changed += 1
            continue
        reqs.append({"updateTextStyle": {
            "range": {"startIndex": p["startIndex"], "endIndex": p["endIndex"], "tabId": tab_id},
            "textStyle": {"weightedFontFamily": {"fontFamily": font, "weight": 400},
                          "fontSize": {"magnitude": size, "unit": "PT"}},
            "fields": "weightedFontFamily,fontSize"}})
        changed += 1
    # Setting weightedFontFamily (weight 400) clears bold, so bold runs get it back afterwards.
    reqs += [{"updateTextStyle": {"range": {"startIndex": a, "endIndex": b, "tabId": t},
                                  "textStyle": {"bold": True}, "fields": "bold"}}
             for t, a, b in bold]
    print(f"restyled {changed} of {len(paras)} TOC paragraphs ({len(bold)} bold ranges kept)"
          f" in ops={len(reqs)}")
    json.dump({"requests": reqs, "writeControl": {"requiredRevisionId": doc["revisionId"]}},
              open(args[1], "w"), ensure_ascii=False)


if __name__ == "__main__":
    main()
