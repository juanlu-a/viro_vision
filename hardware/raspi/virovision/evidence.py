"""What bus mode saw: the frame each bus was announced from, and the crop each OCR read was made on.

TEMPORARY — DEVELOPMENT ONLY. This module, its HTTP routes and its flags are removed before the final
version (team decision, 2026-10-12; tracked in `docs/ROADMAP.md`, "Antes de la versión final"): they
keep pictures of the street, people included, and serve them without authentication.

The journal says "track 3 read in 512 ms: 115 LUIS BRAILLE" and nothing about the picture behind it.
After a field run nobody could say whether a bad reading came from a sign that was too small, a crop
that cut half the destination, glare on the LEDs or the OCR itself — the four look the same in text.
So every bus mode run leaves a folder on the microSD:

    /home/virovision/evidence/<run>/
        t003-bus.jpg          the frame of «se acerca un ómnibus», every box the sensor reported drawn
        t003-r02-crop.jpg     exactly the patch the OCR read, before any upscaling (read #2 of track 3)
        t003-r02-frame.jpg    the whole frame with the bus box and that crop drawn (only reads with text)
        events.jsonl          one line per picture, plus the decision: what the OCR returned, its
                              scores, how long it took, and what was finally said

`<run>` is the wall-clock time the mode started. The Zero 2 W has no RTC: before NTP it is the time
fake-hwclock saved at the last shutdown, so the names stay in order but can be off by hours. The
journal's read lines carry `evidence <run>/t003-r02` so the two can always be matched.

Three limits keep it from costing what it is meant to explain:

- **Off the camera thread.** Encoding a 1024 px JPEG costs tens of ms on the Zero 2 W, and the frame
  loop has to keep draining at 15 fps (see `bus.py`). Pictures go to one writer thread through a short
  queue; when it is full they are dropped and counted, never waited for.
- **A budget on the card** (MAX_BYTES, MIN_FREE_BYTES). The oldest runs are deleted when a run begins;
  a run that outgrows the budget on its own stops recording, with one warning.
- **Ownership.** The daemon runs as root (BlueZ demands it); the folders are handed to the owner of
  /home/virovision so whoever copies them off over SSH can also delete them.

INSTRUMENTATION BOUNDARY: this is diagnostics, never control. Nothing here may raise into bus mode or
block it, and nothing in bus mode may depend on a picture being written. It is also the one thing on
the board that keeps images of the street — people included — which is why it stays on the device,
travels nowhere on its own, and can be turned off with `--no-evidence`.
"""

from __future__ import annotations

import html
import json
import logging
import os
import queue
import re
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Callable, Optional

log = logging.getLogger(__name__)

DEFAULT_DIR = Path("/home/virovision/evidence")
MAX_BYTES = 500_000_000
"""All runs together. A bus read for ten seconds leaves about 1 MB (two crops a second at ~10 KB, a
frame per read with text at ~80 KB); this is hundreds of buses, and a few percent of a 16 GB card."""
MIN_FREE_BYTES = 1_000_000_000
"""Below this much free space on the card nothing is recorded: the journal, the OS updates and the
announcements need the card more than a diagnostic does."""
QUEUE_SIZE = 4
"""Pictures waiting for the writer. Each holds a whole frame (~2.3 MB at 1024x768), on a 512 MB board."""
JPEG_QUALITY = 85
"""Higher than the phone photo's 70: what is being judged here is whether the LEDs were legible."""


def _box(box) -> Optional[list]:
    if box is None:
        return None
    return [round(box.x1), round(box.y1), round(box.x2), round(box.y2)]


class Evidence:
    """One per daemon. `begin_run` at every start of bus mode; the rest is called from the frame loop
    and the OCR thread, and only queues work."""

    def __init__(
        self,
        root: Path = DEFAULT_DIR,
        *,
        max_bytes: int = MAX_BYTES,
        min_free_bytes: int = MIN_FREE_BYTES,
        queue_size: int = QUEUE_SIZE,
        clock: Callable[[], float] = time.time,
        encode: Optional[Callable[[Any], bytes]] = None,
        draw: Optional[Callable[..., Any]] = None,
        crop: Optional[Callable[[Any, Any], Any]] = None,
    ) -> None:
        self._root = Path(root)
        self._max_bytes = max_bytes
        self._min_free = min_free_bytes
        self._clock = clock
        # Injectable so the tests need neither OpenCV nor a camera; on the board they are cv2's.
        self._encode = encode
        self._draw = draw
        self._crop = crop
        self._queue: queue.Queue = queue.Queue(maxsize=queue_size)
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._run: Optional[Path] = None
        self._run_bytes = 0
        self._full = False
        self._dropped = 0

    # --- called by bus mode ---------------------------------------------------------------------

    def begin_run(self) -> None:
        """A new folder for this run of bus mode, after making room for it."""
        try:
            self._root.mkdir(parents=True, exist_ok=True)
            self._chown(self._root)
            self._prune()
            name = time.strftime("%Y%m%d-%H%M%S", time.localtime(self._clock()))
            run = self._root / name
            n = 1
            while run.exists():  # two starts in the same second
                n += 1
                run = self._root / f"{name}-{n}"
            run.mkdir()
            self._chown(run)
        except Exception as exc:  # noqa: BLE001 — see the INSTRUMENTATION BOUNDARY
            log.warning("evidence: could not prepare %s (%s); this run records nothing", self._root, exc)
            self._run = None
            return
        with self._lock:
            self._run, self._run_bytes, self._full, self._dropped = run, 0, False, 0
        self._ensure_writer()
        log.info("evidence: recording this run in %s", run)

    def bus_seen(self, track_id: int, frame, detections: list) -> Optional[str]:
        """The frame «se acerca un ómnibus» was said from, every detection on it drawn. Returns the
        name it will be saved under, for the journal's line, like `read`."""
        run = self._run
        if run is None or frame is None:
            return None
        stem = f"t{track_id:03d}-bus"
        boxes = [(d.label, d.box, d.conf) for d in detections]
        queued = self._put(
            {"what": "bus", "track": track_id, "detections": [{"label": l, "box": _box(b), "conf": round(c, 2)} for l, b, c in boxes]},
            pictures=[(stem, lambda: self._drawn(frame, boxes))],
        )
        return f"{run.name}/{stem}" if queued else None

    def track_ref(self, track_id: int) -> Optional[str]:
        """`<run>/t003`: every picture of that bus starts with it. For the journal's lines about a
        track as a whole — the decision, above all, which is made from several reads."""
        run = self._run
        return f"{run.name}/t{track_id:03d}" if run is not None else None

    def read(self, track_id: int, attempt: int, frame, result, ocr_ms: int) -> Optional[str]:
        """One OCR read. Returns the name it will be saved under, for the journal's line, or None when
        this run records nothing. `result` is the pipeline's `Result`, or None if the read raised."""
        run = self._run
        if run is None or frame is None:
            return None
        stem = f"t{track_id:03d}-r{attempt:02d}"
        reading = getattr(result, "reading", None)
        crop_box = getattr(result, "banner_box", None)
        texts = getattr(result, "texts", None) or []
        record = {
            "what": "read",
            "track": track_id,
            "attempt": attempt,
            "ocr_ms": ocr_ms,
            "crop_box": _box(crop_box),
            "bus_box": _box(getattr(result, "bus_box", None)),
            "texts": [{"text": t.text, "score": round(t.score, 3)} for t in texts],
            "raw": reading.raw if reading else None,
            "number": reading.number if reading else None,
            "destination": reading.destination if reading else None,
            "confidence": round(reading.confidence, 3) if reading else None,
            "verified": bool(getattr(reading, "verified", False)),
            "inferred": list(getattr(reading, "inferred", ()) or ()),
        }
        pictures = []
        if crop_box is not None:
            pictures.append((f"{stem}-crop", lambda: self._cropped(frame, crop_box)))
            if texts:
                # The whole frame only when the OCR returned something: an empty read's crop already
                # shows why, and the frame is ten times the bytes.
                label = " ".join(t.text for t in texts)
                marks = [("bus", result.bus_box, None)] if result.bus_box is not None else []
                marks.append((label, crop_box, None))
                pictures.append((f"{stem}-frame", lambda: self._drawn(frame, marks)))
        if not self._put(record, pictures):
            # Never name a picture that will not exist: the journal line is how it is found later, and
            # a name that leads nowhere is worse than none.
            return None
        return f"{run.name}/{stem}"

    def decided(self, event, announced: bool) -> None:
        """What the votes made of the reads, and whether it was said or silenced as an echo."""
        self._put(
            {
                "what": "decided",
                "track": event.track,
                "attempts": event.attempts,
                "number": event.number,
                "destination": event.destination,
                "announced": announced,
            },
            pictures=[],
        )

    def close(self) -> None:
        thread = self._thread
        if thread is None:
            return
        try:
            self._queue.put(None, timeout=1)
        except queue.Full:
            return
        thread.join(timeout=3)

    # --- the writer -----------------------------------------------------------------------------

    def _put(self, record: dict, pictures: list) -> bool:
        run = self._run
        if run is None or self._full:
            return False
        # The same clock, and the same precision, as the journal's own timestamps
        # (`journalctl -o short-precise`): a line of one and a line of the other match by time too.
        now = self._clock()
        wall = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)) + f".{int(now % 1 * 1000):03d}"
        record = {"wall": wall, **record}
        try:
            self._queue.put_nowait((run, record, pictures))
        except queue.Full:
            with self._lock:
                self._dropped += 1
            return False
        return True

    def _ensure_writer(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._write_loop, name="bus-evidence", daemon=True)
        self._thread.start()

    def _write_loop(self) -> None:
        while True:
            job = self._queue.get()
            if job is None:
                return
            try:
                self._write(*job)
            except Exception as exc:  # noqa: BLE001 — one picture that will not write is not the run
                log.warning("evidence: could not write (%s)", exc)

    def _write(self, run: Path, record: dict, pictures: list) -> None:
        if run != self._run or self._full:
            return  # queued in a previous run, or this one ran out of room
        if self._dropped:
            with self._lock:
                record["dropped_before"], self._dropped = self._dropped, 0
        files = []
        for stem, render in pictures:
            image = render()
            if image is None:
                continue
            data = self._encode_jpeg(image)
            path = run / f"{stem}.jpg"
            path.write_bytes(data)
            self._chown(path)
            self._run_bytes += len(data)
            files.append(path.name)
        if files:
            record["files"] = files
        line = (json.dumps(record, ensure_ascii=False) + "\n").encode()
        events = run / "events.jsonl"
        new = not events.exists()
        with events.open("ab") as f:
            f.write(line)
        if new:
            self._chown(events)
        self._run_bytes += len(line)
        if self._run_bytes > self._max_bytes or self._free() < self._min_free:
            self._full = True
            log.warning("evidence: %s reached the budget on the card; this run records nothing more", run.name)

    # --- pictures -------------------------------------------------------------------------------

    def _encode_jpeg(self, image) -> bytes:
        if self._encode is not None:
            return self._encode(image)
        import cv2

        ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            raise ValueError("cv2.imencode failed")
        return buffer.tobytes()

    def _cropped(self, frame, box):
        """The same pixels the OCR got. `bus_banner.crop` also upscales a small sign to 64 px; that is
        left out on purpose, so the picture shows how small the sign really was."""
        if self._crop is not None:
            return self._crop(frame, box)
        height, width = frame.shape[:2]
        x1, y1 = max(0, int(box.x1)), max(0, int(box.y1))
        x2, y2 = min(width, int(box.x2)), min(height, int(box.y2))
        if x2 <= x1 or y2 <= y1:
            return None
        return frame[y1:y2, x1:x2]

    def _drawn(self, frame, marks: list):
        """A copy of the frame with each (label, box, conf) drawn. The frame itself is never touched:
        the OCR thread may still be reading it."""
        if self._draw is not None:
            return self._draw(frame, marks)
        import cv2

        out = frame.copy()
        colors = {"bus": (255, 200, 0), "bus_sign": (0, 200, 255)}
        for label, box, conf in marks:
            if box is None:
                continue
            color = colors.get(label, (0, 255, 0))
            x1, y1, x2, y2 = (int(v) for v in (box.x1, box.y1, box.x2, box.y2))
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            text = label if conf is None else f"{label} {conf:.2f}"
            cv2.putText(out, text, (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        return out

    # --- the card -------------------------------------------------------------------------------

    def _free(self) -> int:
        try:
            return shutil.disk_usage(self._root).free
        except OSError:
            return self._min_free  # unknown: do not stop over it

    def _prune(self) -> None:
        """Deletes the oldest runs until what is left fits the budget with room for one more."""
        runs = sorted((p for p in self._root.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime)
        sizes = {p: sum(f.stat().st_size for f in p.iterdir() if f.is_file()) for p in runs}
        total = sum(sizes.values())
        while runs and (total > self._max_bytes * 0.8 or self._free() < self._min_free):
            oldest = runs.pop(0)
            shutil.rmtree(oldest, ignore_errors=True)
            total -= sizes[oldest]
            log.info("evidence: deleted the old run %s to make room", oldest.name)

    def _chown(self, path: Path) -> None:
        """To the owner of the folder above the root (/home/virovision): the daemon is root, the
        person copying the pictures off is not."""
        try:
            owner = self._root.parent.stat()
            if owner.st_uid != os.geteuid():
                os.chown(path, owner.st_uid, owner.st_gid)
        except (OSError, AttributeError):
            pass


# --- reading it back over WiFi (`http_server.py`) -----------------------------------------------
#
# The board already serves the phone's photo over HTTP (ADR 0003's plan B), so the pictures go out
# the same way: a page any browser on the same network can open — the phone joined to the board's
# AP included — and a JSON listing for the app. Read-only on purpose: deleting stays an SSH job, so
# nobody on the AP can wipe the evidence of a run by following a link.

RUN_NAME = re.compile(r"^\d{8}-\d{6}(-\d+)?$")
FILE_NAME = re.compile(r"^[a-z0-9-]+\.(jpg|jsonl)$")
"""Only names this module writes. A request path is never joined to the root without matching one:
that is what keeps `/evidence/../../etc/shadow` out — the daemon runs as root."""


def find_file(root: Path, run: str, name: str) -> Optional[Path]:
    """The file a request names, or None if the name is not one this module could have written."""
    if not RUN_NAME.match(run) or not FILE_NAME.match(name):
        return None
    path = Path(root) / run / name
    return path if path.is_file() else None


def _read_events(run: Path) -> list:
    try:
        lines = (run / "events.jsonl").read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    events = []
    for line in lines:
        try:
            events.append(json.loads(line))
        except ValueError:
            continue  # the writer was killed mid-line; the rest of the run is still worth showing
    return events


def list_runs(root: Path) -> list:
    """Newest first: after a field run, the run you want is the last one."""
    try:
        runs = [p for p in Path(root).iterdir() if p.is_dir() and RUN_NAME.match(p.name)]
    except OSError:
        return []
    out = []
    for run in sorted(runs, key=lambda p: p.name, reverse=True):
        events = _read_events(run)
        files = [f for f in run.iterdir() if f.is_file()]
        out.append(
            {
                "run": run.name,
                "buses": sum(e.get("what") == "bus" for e in events),
                "reads": sum(e.get("what") == "read" for e in events),
                "said": [_said(e) for e in events if e.get("what") == "decided" and e.get("announced")],
                "files": len(files),
                "bytes": sum(f.stat().st_size for f in files),
            }
        )
    return out


def _ref(track, what: str) -> str:
    """`t003-r02`: what the journal prints after `evidence <run>/`, and the page's anchor for it, so
    `/evidence/<run>/#t003-r02` jumps straight to the picture a journal line names."""
    try:
        return f"t{int(track):03d}-{what}"
    except (TypeError, ValueError):
        return f"t-{what}"


def _said(event: dict) -> str:
    return ", ".join(p for p in (event.get("number"), event.get("destination")) if p) or "?"


_STYLE = """
:root { color-scheme: light dark; --bg: #fff; --fg: #111; --muted: #555; --line: #ccc; --ok: #0a6b2d; }
@media (prefers-color-scheme: dark) { :root { --bg: #111; --fg: #eee; --muted: #aaa; --line: #444; --ok: #6fdc8c; } }
body { background: var(--bg); color: var(--fg); font: 16px/1.4 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; }
a { color: inherit; }
img { max-width: 100%; height: auto; border: 1px solid var(--line); display: block; }
.crop { image-rendering: pixelated; min-height: 48px; }
section { border-top: 2px solid var(--line); margin-top: 24px; padding-top: 8px; }
.read { display: grid; gap: 8px; margin: 12px 0; }
.muted { color: var(--muted); }
.said { color: var(--ok); font-weight: 600; }
code { word-break: break-all; }
"""


def _page(title: str, body: str) -> bytes:
    return (
        f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)}</title><style>{_STYLE}</style></head>"
        f"<body>{body}</body></html>"
    ).encode()


def index_page(root: Path) -> bytes:
    runs = list_runs(root)
    if not runs:
        items = "<p>Todavía no hay corridas del modo ómnibus guardadas.</p>"
    else:
        rows = []
        for r in runs:
            said = "; ".join(r["said"]) or "ninguna línea dicha"
            rows.append(
                f'<li><a href="/evidence/{r["run"]}/">{r["run"]}</a> — {r["buses"]} ómnibus, '
                f'{r["reads"]} lecturas, <span class="said">{html.escape(said)}</span> '
                f'<span class="muted">({r["bytes"] // 1000} KB)</span></li>'
            )
        items = f"<ul>{''.join(rows)}</ul>"
    note = '<p class="muted">La hora del nombre es la de la placa, que no tiene reloj propio: antes de sincronizar puede estar corrida.</p>'
    return _page("Evidencia del modo ómnibus", f"<h1>Qué vio la cámara</h1>{note}{items}")


def run_page(root: Path, run: str) -> Optional[bytes]:
    """One run, grouped by bus: the frame it was noticed in, then every read with its crop, what the
    OCR returned and how sure it was, then what was said. None if the run does not exist."""
    if not RUN_NAME.match(run) or not (Path(root) / run).is_dir():
        return None
    events = _read_events(Path(root) / run)
    tracks: dict = {}
    for e in events:
        tracks.setdefault(e.get("track"), []).append(e)

    def img(name: str, alt: str, cls: str = "") -> str:
        return f'<a href="{name}"><img src="{name}" alt="{html.escape(alt)}" class="{cls}" loading="lazy"></a>'

    sections = []
    for track, items in tracks.items():
        parts = [f"<h2>Ómnibus {track}</h2>"]
        for e in items:
            files = e.get("files") or []
            dropped = f' <span class="muted">({e["dropped_before"]} imágenes descartadas antes)</span>' if e.get("dropped_before") else ""
            if e.get("what") == "bus":
                labels = ", ".join(f'{d["label"]} {d["conf"]}' for d in e.get("detections", []))
                ref = _ref(track, "bus")
                parts.append(f'<p id="{ref}">{e.get("wall", "")} — detectado: {html.escape(labels) or "?"} · <code>evidence {run}/{ref}</code>{dropped}</p>')
                parts += [img(f, f"Cuadro en que se detectó el ómnibus {track}") for f in files]
            elif e.get("what") == "read":
                texts = " · ".join(f'{t["text"]} ({t["score"]:.2f})' for t in e.get("texts", [])) or "el OCR no devolvió nada"
                parsed = _said(e) if e.get("number") or e.get("destination") else "sin línea ni destino"
                flags = " ✓ catálogo" if e.get("verified") else ""
                if e.get("inferred"):
                    flags += f' · completado: {", ".join(e["inferred"])}'
                crop = [img(f, f"Recorte leído: {texts}", "crop") for f in files if f.endswith("-crop.jpg")]
                frame = [img(f, f"Cuadro de la lectura {e.get('attempt')}") for f in files if f.endswith("-frame.jpg")]
                attempt = e.get("attempt") or 0
                ref = _ref(track, f"r{attempt:02d}")
                parts.append(
                    f'<div class="read" id="{ref}"><div>{e.get("wall", "")} — lectura {attempt}, {e.get("ocr_ms")} ms'
                    f" · <code>evidence {run}/{ref}</code>{dropped}</div>"
                    f"{''.join(crop)}<div>OCR: <code>{html.escape(texts)}</code></div>"
                    f"<div>Interpretado: <b>{html.escape(parsed)}</b>{html.escape(flags)}</div>"
                    f"{''.join(frame)}</div>"
                )
            elif e.get("what") == "decided":
                how = "dicho" if e.get("announced") else "no dicho (eco del mismo ómnibus)"
                parts.append(f'<p class="said" id="{_ref(track, "decided")}">Decidido tras {e.get("attempts")} lecturas: {html.escape(_said(e))} — {how}</p>')
        sections.append(f"<section>{''.join(parts)}</section>")
    body = (
        f'<p><a href="/evidence/">← todas las corridas</a> · <a href="events.jsonl">events.jsonl</a></p>'
        f"<h1>Corrida {run}</h1>{''.join(sections) or '<p>Esta corrida no guardó nada.</p>'}"
    )
    return _page(f"Corrida {run}", body)
