"""The OCR in a child process (2026-10-06): building it in the daemon froze BlueZ's event loop for
10-20 s, and a phone connecting then lost its link after 30 s. These tests pin down that the child
answers like the in-process engine, and that a child that breaks never leaves bus mode hanging."""

import os

import pytest

from virovision.ocr_worker import OcrProcess


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
    with pytest.raises(RuntimeError, match="onnxruntime is not installed"):
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
