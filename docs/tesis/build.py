#!/usr/bin/env python3
"""Build the thesis body from the per-chapter sources.

The repository is the source of truth for chapters 1 to 13. The Google Doc holds
the cover page and the table of contents, which cannot be expressed in Markdown
(the cover carries an image and the index is a live field), and is the surface
the team reads and comments on.

Usage:
    python3 build.py                # whole body -> build/body.md and build/body.html
    python3 build.py --chapter 7    # one chapter, for a surgical edit
    python3 build.py --list         # what would be included, in order

The whole-body build also writes build/lists.md, the list of tables and the list of
figures that go in the Doc's front matter next to the table of contents.

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
    problems += check_captions(text, "Tabla", "Tablas")
    problems += check_captions(text, "Figura", "Figuras")
    if problems:
        sys.exit("\n".join(problems))


def captions(text, word):
    """(number, title) of every caption line, e.g. 'Tabla 7: Title.'"""
    return [(int(m.group(1)), m.group(2)) for m in re.finditer(rf"^{word} (\d+): (.*)$", text, re.M)]


def check_captions(text, word, plural):
    """Captions numbered 1..N in order, and each one cited somewhere outside its caption.

    Only applies to the whole body: a single chapter starts mid-sequence.
    """
    problems = []
    found = captions(text, word)
    numbers = [n for n, _ in found]
    if numbers and numbers[0] == 1 and numbers != list(range(1, len(numbers) + 1)):
        problems.append(f"{word} captions are not numbered 1..N in order: {numbers}")
    body = re.sub(rf"^{word} \d+:.*$", "", text, flags=re.M)
    cited = set()
    for m in re.finditer(rf"\b(?:{word}|{plural}) (\d+(?:(?:, | y | a )\d+)*)", body):
        cited |= {int(n) for n in re.findall(r"\d+", m.group(1))}
    for n in numbers:
        if n not in cited:
            problems.append(f"{word} {n} is never cited in the text")
    if word == "Tabla":
        lines = text.split("\n")
        for i, line in enumerate(lines):
            if line.startswith("|") and (i == 0 or not lines[i - 1].startswith("|")):
                j = i - 1
                while j >= 0 and not lines[j].strip():
                    j -= 1
                if j < 0 or not re.match(r"Tabla \d+: ", lines[j]):
                    problems.append(f"table without a 'Tabla N: title.' caption: {line[:60]}")
    return problems


def lists(text):
    """The list of tables and the list of figures, for the front matter of the Doc."""
    out = ["# Lista de tablas", ""]
    out += [f"Tabla {n}: {title}" for n, title in captions(text, "Tabla")]
    out += ["", "# Lista de figuras", ""]
    out += [f"Figura {n}: {title}" for n, title in captions(text, "Figura")]
    return "\n".join(out) + "\n"


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
    if args.chapter is None:
        (BUILD / "lists.md").write_text(lists(text))
    subprocess.run(
        ["pandoc", str(md), "-f", "gfm", "-t", "html", "-o", str(html)],
        check=True,
    )
    print(f"{md}   {len(text):>7} chars")
    print(f"{html}  {html.stat().st_size:>7} bytes")
    if args.chapter is None:
        print(f"{BUILD / 'lists.md'}   list of tables and list of figures")
    print()
    print("To put the HTML on the clipboard (macOS), so that Docs keeps the")
    print("headings and tables when pasting:")
    print(f"  python3 -c \"import sys;print(open('{html}','rb').read().hex())\" > /tmp/vv.hex")
    print("  osascript -e \"set the clipboard to (run script \\\"«data HTML$(cat /tmp/vv.hex)»\\\")\"")


if __name__ == "__main__":
    main()
