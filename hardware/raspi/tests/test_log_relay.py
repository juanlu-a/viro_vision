"""Exists because the journal is the only place this board writes its failures, and in the street
nobody can read it (2026-10-06): the relay hands the phone its WARNING-and-worse lines. What can go
wrong is all quiet: an event too big for one notification is never sent, a failure looping at 15 fps
floods the control plane, a boot error logged before any phone is listening is lost, and a handler
that logs while emitting recurses until the stack gives out."""

import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.core import EVENT_MAX_BYTES, event_bytes  # noqa: E402
from virovision.log_relay import LogRelay  # noqa: E402


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def _logger(relay, name="virovision.bus"):
    logger = logging.getLogger(f"{name}.test{id(relay)}")
    logger.propagate = False
    logger.handlers = [relay]
    logger.setLevel(logging.DEBUG)
    return logger


def _live(relay):
    sent = []
    relay.attach(sent.append)
    relay.subscriber_ready()
    return sent


def test_warnings_and_worse_become_compact_events():
    relay = LogRelay()
    sent = _live(relay)
    logger = _logger(relay)
    logger.info("routine")
    logger.warning("no frame in %d s", 12)
    try:
        raise RuntimeError("frontend timeout")
    except RuntimeError:
        logger.exception("capture failed")
    assert [e["lvl"] for e in sent] == ["warning", "error"]
    assert sent[0] == {"t": "log", "lvl": "warning", "src": sent[0]["src"], "msg": "no frame in 12 s"}
    assert sent[0]["src"].startswith("bus"), "the `virovision.` prefix is dropped"
    assert sent[1]["msg"] == "capture failed | RuntimeError: frontend timeout"


def test_a_huge_multibyte_message_still_fits_one_notification():
    relay = LogRelay()
    sent = _live(relay)
    _logger(relay).error("número de línea ilegible: %s", "ñ📶" * 500)
    data = event_bytes(sent[0])
    assert len(data) <= EVENT_MAX_BYTES
    assert json.loads(data)["msg"].startswith("número de línea ilegible")


def test_a_flood_is_rate_limited_and_the_loss_is_counted():
    clock = Clock()
    relay = LogRelay(per_minute=10, clock=clock)
    sent = _live(relay)
    logger = _logger(relay)
    for i in range(25):
        logger.error("frame %d failed", i)
    assert len(sent) == 10
    clock.now += 61
    logger.error("later")
    assert sent[-1]["msg"] == "later" and sent[-1]["drop"] == 15


def test_what_happens_before_a_phone_listens_is_replayed_once():
    """The boot is when the camera and the AP fail, and no phone is subscribed yet. Sent at that
    moment, the event reaches nobody."""
    relay = LogRelay(buffered=3)
    logger = _logger(relay)
    for i in range(5):
        logger.warning("boot %d", i)
    sent = []
    relay.attach(sent.append)
    assert sent == [], "attached is not subscribed"
    relay.subscriber_ready()
    assert [e["msg"] for e in sent] == ["boot 2", "boot 3", "boot 4"], "the newest, in order"
    relay.subscriber_ready()
    assert len(sent) == 3, "a second status read replays nothing"

    relay.central_gone()
    logger.warning("while alone")
    assert len(sent) == 3
    relay.subscriber_ready()
    assert sent[-1]["msg"] == "while alone"


def test_logging_from_inside_the_relay_does_not_recurse():
    relay = LogRelay()
    logger = _logger(relay)
    sent = []

    def emit(event):
        sent.append(event)
        logger.error("emitting failed")  # what a closing loop or a D-Bus error would do

    relay.attach(emit)
    relay.subscriber_ready()
    logger.error("first")
    assert [e["msg"] for e in sent] == ["first"]


def test_an_emit_that_raises_never_reaches_the_code_that_logged():
    relay = LogRelay()

    def emit(event):
        raise RuntimeError("Event loop is closed")

    relay.attach(emit)
    relay.subscriber_ready()
    _logger(relay).error("at shutdown")  # must not raise
