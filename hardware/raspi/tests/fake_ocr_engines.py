"""Engines for `test_ocr_worker.py`. A module of its own because the child is spawned: it has to
import the factory by name, so the factory cannot live inside a test function."""

import os
import time


class Echo:
    name = "echo"

    def read(self, patch, with_detection=False):
        if patch == "boom":
            raise ValueError("bad crop")
        if patch == "hang":
            time.sleep(30)
        if patch == "die":
            os._exit(1)
        return [("read", patch, with_detection, os.getpid())]


def echo():
    return Echo()


def broken():
    raise ImportError("onnxruntime is not installed")


def slow_start():
    time.sleep(30)
    return Echo()


def dies_while_building():
    os._exit(1)  # what the out-of-memory killer looks like from the parent
