#!/usr/bin/env python3
"""Build the thesis body from the per-chapter sources.

The repository is the source of truth for chapters 1 to 12. The Google Doc holds
the cover page and the table of contents, which cannot be expressed in Markdown
(the cover carries an image and the index is a live field), and is the surface
the team reads and comments on.

Usage:
    python3 build.py                # whole body -> build/body.md and build/body.html
    python3 build.py --chapter 7    # one chapter, for a surgical edit
    python3 build.py --list         # what would be included, in order

The HTML output is what gets pasted into the Doc. See README.md for the
procedure and for the traps that are easy to fall into.
"""
import argparse
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
BUILD = HERE / "build"


def chapters():
    """Chapter files in document order, as (number, path)."""
    found = []
    for path in sorted(HERE.glob("[0-9][0-9]-*.md")):
        found.append((int(path.name[:2]), path))
    return found


def assemble(only=None):
    parts = []
    for number, path in chapters():
        if only is not None and number != only:
            continue
        parts.append(path.read_text().rstrip())
    if not parts:
        sys.exit(f"no chapter matched {only}")
    return "\n\n".join(parts) + "\n"


def check(text):
    """Fail on the conventions that are easy to break by hand."""
    problems = []
    if "—" in text:
        problems.append("em dash found: use commas, colons or parentheses")
    for match in re.finditer(r"^#{1,6}\s*$", text, re.M):
        problems.append(f"empty heading at offset {match.start()}")
    if problems:
        sys.exit("\n".join(problems))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chapter", type=int, help="build a single chapter")
    parser.add_argument("--list", action="store_true", help="list chapters and exit")
    args = parser.parse_args()

    if args.list:
        for number, path in chapters():
            print(f"{number:>2}  {path.name}")
        return

    text = assemble(args.chapter)
    check(text)

    BUILD.mkdir(exist_ok=True)
    stem = f"chapter-{args.chapter}" if args.chapter else "body"
    md = BUILD / f"{stem}.md"
    html = BUILD / f"{stem}.html"
    md.write_text(text)
    subprocess.run(
        ["pandoc", str(md), "-f", "gfm", "-t", "html", "-o", str(html)],
        check=True,
    )
    print(f"{md}   {len(text):>7} chars")
    print(f"{html}  {html.stat().st_size:>7} bytes")
    print()
    print("To put the HTML on the clipboard (macOS), so that Docs keeps the")
    print("headings and tables when pasting:")
    print(f"  python3 -c \"import sys;print(open('{html}','rb').read().hex())\" > /tmp/vv.hex")
    print("  osascript -e \"set the clipboard to (run script \\\"«data HTML$(cat /tmp/vv.hex)»\\\")\"")


if __name__ == "__main__":
    main()
