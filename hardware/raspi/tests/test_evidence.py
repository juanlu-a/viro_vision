"""Exists because the pictures bus mode keeps are only worth something if three promises hold: the
journal's read line names a picture that really is on the card, the pictures never slow the camera
loop down or raise into it, and they never fill the microSD the board boots from.

No camera, OpenCV or numpy: encoding, drawing and cropping are injected, and a "frame" is a string.
"""

import json
import os
import queue
import sys
import threading
import types
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.bus import BusWatcher  # noqa: E402
from virovision.evidence import Evidence  # noqa: E402


class Box:
    def __init__(self, x1, y1, x2, y2):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2


def text(t, score):
    return types.SimpleNamespace(text=t, score=score)


def result(texts, number=None, destination=None):
    reading = types.SimpleNamespace(
        raw=" ".join(t.text for t in texts), number=number, destination=destination, confidence=0.8, verified=bool(number and destination), inferred=()
    )
    return types.SimpleNamespace(reading=reading, bus_box=Box(0, 0, 400, 300), banner_box=Box(10, 20, 300, 60), texts=texts)


def make(tmp_path, **kwargs):
    kwargs.setdefault("min_free_bytes", 0)
    return Evidence(
        tmp_path / "evidence",
        encode=lambda image: f"jpeg of {image}".encode(),
        draw=lambda frame, marks: f"{frame} with {[m[0] for m in marks]}",
        crop=lambda frame, box: f"{frame} cropped at {box.x1},{box.y1}",
        **kwargs,
    )


def events(run: Path) -> list:
    return [json.loads(line) for line in (run / "events.jsonl").read_text().splitlines()]


def test_a_read_with_text_keeps_the_crop_the_frame_and_what_the_ocr_said(tmp_path):
    evidence = make(tmp_path)
    evidence.begin_run()
    name = evidence.read(3, 2, "frame", result([text("115", 0.91), text("LUIS BRAILLE", 0.77)], "115", "LUIS BRAILLE"), 512)
    evidence.close()

    run_name, stem = name.split("/")
    run = tmp_path / "evidence" / run_name
    assert stem == "t003-r02"
    assert (run / "t003-r02-crop.jpg").read_bytes() == b"jpeg of frame cropped at 10,20"
    assert "115 LUIS BRAILLE" in (run / "t003-r02-frame.jpg").read_text(), "the frame is labelled with what was read"
    [record] = events(run)
    assert record["files"] == ["t003-r02-crop.jpg", "t003-r02-frame.jpg"]
    assert record["texts"] == [{"text": "115", "score": 0.91}, {"text": "LUIS BRAILLE", "score": 0.77}]
    assert (record["number"], record["destination"], record["ocr_ms"]) == ("115", "LUIS BRAILLE", 512)
    assert record["crop_box"] == [10, 20, 300, 60]


def test_an_empty_read_keeps_only_the_crop_and_a_failed_one_only_the_line(tmp_path):
    """The crop of an empty read already shows why it was empty; the frame is ten times the bytes."""
    evidence = make(tmp_path)
    evidence.begin_run()
    evidence.read(1, 1, "frame", result([]), 300)
    evidence.read(1, 2, "frame", None, 5)  # the pipeline raised
    evidence.close()

    [run] = (tmp_path / "evidence").iterdir()
    empty, failed = events(run)
    assert empty["files"] == ["t001-r01-crop.jpg"]
    assert "files" not in failed and failed["raw"] is None


def test_the_bus_frame_and_the_decision_are_kept(tmp_path):
    evidence = make(tmp_path)
    evidence.begin_run()
    sign = types.SimpleNamespace(label="bus_sign", box=Box(10, 20, 300, 60), conf=0.88)
    evidence.bus_seen(4, "frame", [sign])
    evidence.decided(types.SimpleNamespace(track=4, attempts=3, number="115", destination="LUIS BRAILLE"), announced=False)
    evidence.close()

    [run] = (tmp_path / "evidence").iterdir()
    bus, decided = events(run)
    assert bus["files"] == ["t004-bus.jpg"] and bus["detections"][0]["label"] == "bus_sign"
    assert decided["announced"] is False, "an echo is recorded as not said"


def test_a_slow_card_drops_pictures_instead_of_holding_the_camera(tmp_path):
    """The read is called from the OCR thread and the bus frame from the camera loop: neither may wait
    for a JPEG to be written. Past the queue, pictures are dropped and the next line says how many."""
    gate = threading.Event()

    def slow_encode(image):
        gate.wait(5)
        return b"x"

    evidence = make(tmp_path, queue_size=1)
    evidence._encode = slow_encode
    evidence.begin_run()
    for attempt in range(1, 6):
        evidence.read(1, attempt, "frame", result([text("1", 0.9)]), 1)  # returns at once
    gate.set()
    evidence.read(1, 9, "frame", result([text("1", 0.9)]), 1)
    evidence.close()

    [run] = (tmp_path / "evidence").iterdir()
    lines = events(run)
    assert len(lines) < 6
    assert any(line.get("dropped_before") for line in lines)


def test_old_runs_are_deleted_to_keep_within_the_budget(tmp_path):
    root = tmp_path / "evidence"
    for i, name in enumerate(["20261001-100000", "20261002-100000", "20261003-100000"]):
        run = root / name
        run.mkdir(parents=True)
        (run / "big.jpg").write_bytes(b"x" * 400)
        os.utime(run, (1_000_000 + i, 1_000_000 + i))
    evidence = make(tmp_path, max_bytes=1000)
    evidence.begin_run()
    evidence.close()

    left = sorted(p.name for p in root.iterdir())
    assert "20261001-100000" not in left, "the oldest goes first"
    assert "20261003-100000" in left


def test_a_run_that_outgrows_the_budget_stops_recording(tmp_path):
    evidence = make(tmp_path, max_bytes=60)
    evidence.begin_run()
    for attempt in range(1, 10):
        evidence.read(1, attempt, "frame", result([text("115", 0.9)]), 1)
    evidence.close()

    [run] = (tmp_path / "evidence").iterdir()
    assert len(events(run)) < 9


def test_a_root_that_cannot_be_created_records_nothing_and_raises_nothing(tmp_path):
    blocker = tmp_path / "file"
    blocker.write_text("not a folder")
    evidence = Evidence(blocker / "evidence", min_free_bytes=0)
    evidence.begin_run()
    assert evidence.read(1, 1, "frame", result([text("1", 0.9)]), 1) is None
    evidence.bus_seen(1, "frame", [])
    evidence.close()


def test_bus_mode_hands_each_read_and_its_picture_name_to_the_journal(tmp_path):
    """The journal's line is how a picture is found after a run: the name must travel with the read."""

    class Pipeline:
        def process_with_boxes(self, frame, banner_box, bus_box):
            return result([text("115", 0.9)], "115", None)

    evidence = make(tmp_path)
    evidence.begin_run()
    watcher = BusWatcher(types.SimpleNamespace(sensor=None), lambda files: None, lambda event: None, evidence=evidence)
    watcher._pipeline = Pipeline()
    jobs, results = queue.Queue(), queue.Queue()
    jobs.put(("frame", Box(10, 20, 300, 60), None, 7, 1))
    jobs.put(None)
    watcher._read_loop(jobs, results)
    evidence.close()

    track_id, reading, _, name = results.get_nowait()
    assert (track_id, reading.number) == (7, "115")
    assert name.endswith("/t007-r01")
    assert (tmp_path / "evidence" / name.split("/")[0] / "t007-r01-crop.jpg").exists()


def test_the_bus_frame_is_kept_even_when_the_phrase_is_silenced(tmp_path):
    """The silence window is about not repeating a phrase; the picture answers what the sensor took
    for a bus, which matters most precisely when it fires again and again."""
    seen = []
    evidence = types.SimpleNamespace(bus_seen=lambda track, frame, detections: seen.append(track))
    watcher = BusWatcher(types.SimpleNamespace(sensor=None), lambda files: None, lambda event: None, evidence=evidence)
    watcher._announce_presence = lambda: None
    bus = types.SimpleNamespace(kind="bus", track=1)
    watcher._handle(bus, "frame", [])
    watcher._handle(types.SimpleNamespace(kind="bus", track=2), "frame", [])  # inside PRESENCE_SILENCE_S
    assert seen == [1, 2]


def _serve(root):
    from virovision.http_server import HttpServer

    s = HttpServer(lambda: {}, bytes, capture=None, port=0, evidence_dir=root)
    s.start()
    return s


def _fetch(server, path):
    import urllib.error
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{server.port}{path}", timeout=5) as r:
            return r.status, r.headers.get("Content-Type"), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type"), e.read()


def test_the_pictures_are_served_over_wifi_with_the_journal_reference_beside_each(tmp_path):
    """The point of the pictures is to match them with the journal after a run: the page shows each
    one next to the `evidence <run>/t003-r02` the journal printed, and anchors it under that name."""
    evidence = make(tmp_path)
    evidence.begin_run()
    sign = types.SimpleNamespace(label="bus_sign", box=Box(10, 20, 300, 60), conf=0.88)
    evidence.bus_seen(3, "frame", [sign])
    name = evidence.read(3, 2, "frame", result([text("115", 0.91)], "115", "LUIS BRAILLE"), 512)
    evidence.close()
    run, stem = name.split("/")

    server = _serve(tmp_path / "evidence")
    try:
        status, _, body = _fetch(server, "/evidence.json")
        assert status == 200 and json.loads(body)["runs"][0]["run"] == run

        status, kind, body = _fetch(server, f"/evidence/{run}/")
        page = body.decode()
        assert status == 200 and kind.startswith("text/html")
        assert f'id="{stem}"' in page and f"evidence {name}" in page
        assert "t003-r02-crop.jpg" in page and f"evidence {run}/t003-bus" in page

        status, kind, body = _fetch(server, f"/evidence/{run}/t003-r02-crop.jpg")
        assert (status, kind, body) == (200, "image/jpeg", b"jpeg of frame cropped at 10,20")
        assert _fetch(server, "/evidence/")[0] == 200
    finally:
        server.stop()


def test_only_names_the_board_wrote_are_served(tmp_path):
    """The daemon runs as root: a path out of the folder would serve anything on the card."""
    root = tmp_path / "evidence"
    (root / "20261012-101500").mkdir(parents=True)
    (tmp_path / "secret.jpg").write_bytes(b"no")
    server = _serve(root)
    try:
        for path in (
            "/evidence/20261012-101500/../../secret.jpg",
            "/evidence/..%2F/secret.jpg",
            "/evidence/20261012-101500/secret.txt",
            "/evidence/not-a-run/",
            "/evidence/20261012-101500/missing.jpg",
        ):
            assert _fetch(server, path)[0] in (301, 404), path
    finally:
        server.stop()


def test_with_evidence_off_the_routes_say_so(tmp_path):
    from virovision.http_server import HttpServer

    server = HttpServer(lambda: {}, bytes, capture=None, port=0)
    server.start()
    try:
        status, _, body = _fetch(server, "/evidence/")
        assert status == 404 and b"--no-evidence" in body
    finally:
        server.stop()
