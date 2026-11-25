#!/usr/bin/env python3
"""Put each repository figure's image back right above its caption in the Google Doc.

usage: img_insert.py DOC.json OUT.json SHA
  DOC.json  the `content` object of a read_doc result
  OUT.json  update_doc arguments {requests, writeControl}
  SHA       a commit already pushed to GitHub: Docs fetches each image from raw.githubusercontent.com
            at that commit, so the file must exist there

A figure is a repository figure when the Markdown marks it `<!-- imagen del Doc: figuras/x.png -->` (a path
relative to docs/tesis, so `../mediciones/...` also works)
(optionally `ancho=N`, in points; default 400) right before its "Figura N:" caption. Only captions
with no image in the paragraph above get one, so running it twice changes nothing. Images that exist
only in the Doc (a bare `<!-- imagen del Doc -->`) are never touched.
"""
import json, posixpath, sys

from sync_doc import para_text, repo_figures

RAW = "https://raw.githubusercontent.com/juanlu-a/viro_vision/{sha}/{path}"


def main():
    doc_path, out, sha = sys.argv[1:4]
    doc = json.load(open(doc_path))
    figs = repo_figures()
    body = doc["tabs"][0]["documentTab"]["body"]["content"]
    found, prev = {}, None
    for el in body:
        p = el.get("paragraph")
        if not p:
            prev = None
            continue
        text = para_text(p)
        for n in figs:
            if text.startswith(f"Figura {n}:"):
                has_img = prev is not None and any("inlineObjectElement" in e for e in prev["elements"])
                if not has_img:
                    found[n] = el["startIndex"]
        # an image paragraph has no text of its own; blank paragraphs in between are skipped
        if text.strip() or any("inlineObjectElement" in e for e in p["elements"]):
            prev = p
    reqs = []
    for n, i in sorted(found.items(), key=lambda kv: -kv[1]):
        path, width = figs[n]
        reqs.append({"insertText": {"location": {"index": i}, "text": "\n"}})
        reqs.append({"insertInlineImage": {"location": {"index": i}, "uri": RAW.format(sha=sha, path=posixpath.normpath("docs/tesis/" + path)),
                                           "objectSize": {"width": {"magnitude": width, "unit": "PT"}}}})
        reqs.append({"updateParagraphStyle": {"range": {"startIndex": i, "endIndex": i + 1},
                                              "paragraphStyle": {"alignment": "CENTER"}, "fields": "alignment"}})
    json.dump({"requests": reqs, "writeControl": {"requiredRevisionId": doc["revisionId"]}}, open(out, "w"))
    print("figures to insert:", sorted(found), "| already in place or not in the Doc:", sorted(set(figs) - set(found)),
          file=sys.stderr)


if __name__ == "__main__":
    main()
