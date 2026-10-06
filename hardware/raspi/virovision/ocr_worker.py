"""The bus-mode OCR in its own process, behind the same `read` the pipeline already calls.

Why a process (2026-10-06). Building the OCR — importing OpenCV and onnxruntime, then creating an
onnxruntime session per model — holds the GIL for 10-20 s on the Zero 2 W, and an executor thread
does not help: while it runs, the daemon's event loop cannot run either. That loop is the one that
answers BlueZ, so a phone connecting in that window got no reply to its first GATT read and iOS
dropped the link after 30 s ("se perdió la conexión" right after switching the board on). Moving the
build later or caching its files only moved the freeze around. In a child process the GIL is not
shared: the daemon only waits on a pipe, which releases it.

It also means the OCR's work never competes with the daemon for the GIL while bus mode is reading.

The child is started with `spawn`, never `fork`: the daemon has D-Bus, camera and HTTP threads, and
forking a threaded process copies locks held by threads that do not exist in the child.
"""

from __future__ import annotations

import importlib
import logging
import multiprocessing
import threading
from typing import Any, Optional

log = logging.getLogger(__name__)

DEFAULT_ENGINE = "bus_banner.ocr:create_ocr"
"""`module:callable` that builds the real engine in the child; called with `DEFAULT_ENGINE_ARGS`."""
DEFAULT_ENGINE_ARGS = ("rapid",)

START_TIMEOUT_S = 120.0
"""Building the engine on a cold boot takes 20-30 s on the Zero 2 W; past this the child is stuck."""
READ_TIMEOUT_S = 10.0
"""One crop reads in well under a second. A child that takes this long is hung, and an OCR thread
waiting on it forever is a bus mode that silently stops announcing."""


def _child(connection, engine: str, args: tuple) -> None:
    """The child's whole life: build the engine, say so, then answer reads until the pipe closes."""
    try:
        module_name, _, attribute = engine.partition(":")
        factory = getattr(importlib.import_module(module_name), attribute)
        ocr = factory(*args)
        connection.send(("ready", getattr(ocr, "name", "ocr")))
    except BaseException as exc:  # noqa: BLE001 — whatever it was, the parent has to hear it
        connection.send(("failed", f"{type(exc).__name__}: {exc}"))
        return
    while True:
        try:
            patch, with_detection = connection.recv()
        except (EOFError, OSError):
            return  # the daemon is gone: nothing left to answer
        try:
            connection.send(("ok", ocr.read(patch, with_detection=with_detection)))
        except Exception as exc:  # noqa: BLE001 — one bad crop must not end the process
            connection.send(("error", f"{type(exc).__name__}: {exc}"))


class OcrProcess:
    """An `OcrEngine` (see `bus_banner.ocr`) whose engine lives in a child process.

    `start()` blocks until the engine is built, so call it from an executor. `read()` is thread safe
    but serialised: the pipeline has a single OCR thread anyway, and one pipe carries one exchange at
    a time.
    """

    def __init__(self, engine: str = DEFAULT_ENGINE, args: tuple = DEFAULT_ENGINE_ARGS,
                 start_timeout_s: float = START_TIMEOUT_S, read_timeout_s: float = READ_TIMEOUT_S) -> None:
        self._engine = engine
        self._args = args
        self._start_timeout_s = start_timeout_s
        self._read_timeout_s = read_timeout_s
        self._lock = threading.Lock()
        self._process: Optional[multiprocessing.process.BaseProcess] = None
        self._connection = None
        self.name = "ocr (separate process)"

    def start(self) -> None:
        """Builds the engine in a fresh child. Raises if it fails or does not finish in time."""
        with self._lock:
            self._start_locked()

    def _start_locked(self) -> None:
        self._stop_locked()
        context = multiprocessing.get_context("spawn")
        parent, child = context.Pipe()
        process = context.Process(target=_child, args=(child, self._engine, self._args), name="ocr-worker", daemon=True)
        process.start()
        child.close()  # ours is the other end; keeping this one open would hide the child's death
        self._process, self._connection = process, parent
        if not parent.poll(self._start_timeout_s):
            self._stop_locked()
            raise TimeoutError(f"the OCR process did not start in {self._start_timeout_s:.0f} s")
        try:
            status, detail = parent.recv()
        except EOFError:
            self._stop_locked()
            raise RuntimeError("the OCR process died while starting") from None
        if status != "ready":
            self._stop_locked()
            raise RuntimeError(f"the OCR process could not build its engine: {detail}")
        self.name = f"{detail} (separate process)"
        log.info("OCR running in its own process (pid %d)", process.pid)

    def read(self, patch: Any, with_detection: bool = False) -> list:
        with self._lock:
            if self._process is None or not self._process.is_alive():
                # Died since the last read (out of memory, a crash in the engine). One fresh start,
                # here, rather than leaving bus mode without an OCR for the rest of the session.
                log.warning("the OCR process is gone; starting a new one")
                self._start_locked()
            connection = self._connection
            try:
                connection.send((patch, with_detection))
                answered = connection.poll(self._read_timeout_s)
                status, result = connection.recv() if answered else (None, None)
            except (EOFError, OSError) as exc:
                self._stop_locked()
                raise RuntimeError(f"the OCR process went away mid-read: {exc}") from exc
            if not answered:
                # Raised outside the `try`: TimeoutError is an OSError, and the clause above would
                # report a hung child as one that went away.
                self._stop_locked()
                raise TimeoutError(f"the OCR process did not answer in {self._read_timeout_s:.0f} s")
        if status != "ok":
            raise RuntimeError(f"OCR failed in its process: {result}")
        return result

    def stop(self) -> None:
        with self._lock:
            self._stop_locked()

    def _stop_locked(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
        if self._process is not None:
            if self._process.is_alive():
                self._process.terminate()
                self._process.join(2)
                if self._process.is_alive():
                    self._process.kill()
            self._process = None
