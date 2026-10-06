"""The OCR in a child process (2026-10-06): building it in the daemon froze BlueZ's event loop for
10-20 s, and a phone connecting then lost its link after 30 s. These tests pin down that the child
answers like the in-process engine, and that a child that breaks never leaves bus mode hanging."""

import os

import pytest

from virovision.ocr_worker import OcrEngineFailed, OcrProcess


def worker(factory="echo", **kw):
    return OcrProcess(engine=f"fake_ocr_engines:{factory}", args=(), **kw)


def test_reads_go_to_a_separate_process_and_come_back():
    ocr = worker()
    ocr.start()
    try:
        (result,) = ocr.read("crop", with_detection=True)
        assert result[:3] == ("read", "crop", True)
        assert result[3] != os.getpid(), "the engine ran in this process, which is what froze the daemon"
        assert ocr.name == "echo (separate process)"
    finally:
        ocr.stop()


def test_an_engine_that_cannot_be_built_says_why():
    ocr = worker("broken")
    with pytest.raises(OcrEngineFailed, match="onnxruntime is not installed"):
        ocr.start()


def test_one_bad_crop_does_not_end_the_process():
    ocr = worker()
    ocr.start()
    try:
        with pytest.raises(RuntimeError, match="bad crop"):
            ocr.read("boom")
        assert ocr.read("next")[0][1] == "next"
    finally:
        ocr.stop()


def test_a_hung_engine_fails_the_read_instead_of_hanging_bus_mode():
    ocr = worker(read_timeout_s=1)
    ocr.start()
    try:
        with pytest.raises(TimeoutError):
            ocr.read("hang")
        # And the next read gets a fresh process rather than the hung one.
        assert ocr.read("again")[0][1] == "again"
    finally:
        ocr.stop()


def test_a_dead_process_is_replaced_on_the_next_read():
    ocr = worker()
    ocr.start()
    try:
        with pytest.raises(RuntimeError, match="went away"):
            ocr.read("die")
        assert ocr.read("alive")[0][1] == "alive"
    finally:
        ocr.stop()


def test_an_engine_that_never_finishes_building_times_out():
    ocr = worker("slow_start", start_timeout_s=1)
    with pytest.raises(OcrEngineFailed, match="did not build"):
        ocr.start()
    assert ocr._process is None, "the stuck child must not be left running"


def test_stop_ends_the_child():
    ocr = worker()
    ocr.start()
    process = ocr._process
    ocr.stop()
    assert not process.is_alive()
    assert ocr._process is None


def test_after_a_failed_restart_reads_fail_at_once_instead_of_rebuilding():
    """A child that dies on every build would otherwise cost a full rebuild per queued crop."""
    ocr = worker()
    ocr.start()
    try:
        with pytest.raises(RuntimeError, match="went away"):
            ocr.read("die")
        ocr._engine = "fake_ocr_engines:broken"  # the next build fails, as an out-of-memory child would
        with pytest.raises(OcrEngineFailed):
            ocr.read("x")
        with pytest.raises(RuntimeError, match="not retrying yet"):
            ocr.read("x")
    finally:
        ocr.stop()


def test_a_child_that_dies_while_building_is_an_engine_failure_not_a_reason_to_build_in_the_daemon():
    """On the 512 MB board a child dying mid-build is the out-of-memory killer; building the same
    engine in the daemon would freeze it and risk the killer taking the daemon too."""
    with pytest.raises(OcrEngineFailed, match="died"):
        worker("dies_while_building").start()


def test_a_second_crash_within_the_window_stops_the_rebuilds():
    ocr = worker()
    ocr.start()
    try:
        with pytest.raises(RuntimeError, match="went away"):
            ocr.read("die")
        assert ocr.read("rebuilt once")[0][1] == "rebuilt once", "one crash gets an immediate rebuild"
        with pytest.raises(RuntimeError, match="went away"):
            ocr.read("die")
        with pytest.raises(RuntimeError, match="not retrying yet"):
            ocr.read("x")
    finally:
        ocr.stop()
