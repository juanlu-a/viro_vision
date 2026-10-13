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
import signal
import threading
import time
from typing import Any, Optional

log = logging.getLogger(__name__)

DEFAULT_ENGINE = "bus_banner.ocr:create_ocr"
"""`module:callable` that builds the real engine in the child; called with `DEFAULT_ENGINE_ARGS`."""
DEFAULT_ENGINE_ARGS = ("rapid",)

START_TIMEOUT_S = 120.0
"""Building the engine on a cold boot takes 20-30 s on the Zero 2 W; past this the child is stuck."""
RESTART_BACKOFF_S = 60.0
"""After a failed restart, or a second crash within this window, reads fail at once for this long
instead of rebuilding: a child that dies on every build (out of memory), or on every crop (a native
crash in the engine), would otherwise cost a 20-30 s rebuild per queued crop."""
READ_TIMEOUT_S = 10.0
"""One crop reads in well under a second. A child that takes this long is hung, and an OCR thread
waiting on it forever is a bus mode that silently stops announcing."""


class OcrEngineFailed(RuntimeError):
    """The child started but did not end up with a working engine: the build raised (a missing model,
    an import that fails), never finished, or the child died doing it (out of memory, usually). Its
    own type because building the same engine in the daemon would go the same way — after bringing
    back the freeze this module exists to avoid — so callers must not fall back on it."""


def _child(connection, engine: str, args: tuple, log_level: int) -> None:
    """The child's whole life: build the engine, say so, then answer reads until the pipe closes."""
    # Ctrl-C on a manual `-v` run reaches the whole process group; the parent decides when this ends.
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    # A spawned child starts with no logging configured: without this, whatever the engine logs is lost.
    logging.basicConfig(level=log_level, format="%(asctime)s %(levelname)s %(name)s (ocr-worker): %(message)s")
    try:
        module_name, _, attribute = engine.partition(":")
        factory = getattr(importlib.import_module(module_name), attribute)
        ocr = factory(*args)
        connection.send(("ready", getattr(ocr, "name", "ocr")))
    except BaseException as exc:  # noqa: BLE001 — whatever it was, the parent has to hear it
        try:
            connection.send(("failed", f"{type(exc).__name__}: {exc}"))
        except OSError:
            pass  # the parent already gave up on us
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
        self._failed_at: Optional[float] = None
        self._last_crash: Optional[float] = None
        self.name = "ocr (separate process)"

    def start(self) -> None:
        """Builds the engine in a fresh child. Raises if it fails or does not finish in time."""
        with self._lock:
            self._start_locked()

    def _start_locked(self) -> None:
        self._stop_locked()
        context = multiprocessing.get_context("spawn")
        parent, child = context.Pipe()
        process = context.Process(
            target=_child,
            args=(child, self._engine, self._args, logging.getLogger().getEffectiveLevel()),
            name="ocr-worker",
            daemon=True,
        )
        process.start()
        child.close()  # ours is the other end; keeping this one open would hide the child's death
        self._process, self._connection = process, parent
        if not parent.poll(self._start_timeout_s):
            self._stop_locked()
            raise OcrEngineFailed(f"the OCR process did not build its engine in {self._start_timeout_s:.0f} s")
        try:
            status, detail = parent.recv()
        except EOFError:
            self._stop_locked()
            raise OcrEngineFailed("the OCR process died while building its engine") from None
        if status != "ready":
            self._stop_locked()
            raise OcrEngineFailed(f"the OCR process could not build its engine: {detail}")
        self.name = f"{detail} (separate process)"
        self._failed_at = None
        log.info("OCR running in its own process (pid %d)", process.pid)

    def read(self, patch: Any, with_detection: bool = False) -> list:
        with self._lock:
            if self._process is None or not self._process.is_alive():
                # Died since the last read (out of memory, a crash in the engine). One fresh start,
                # here, rather than leaving bus mode without an OCR for the rest of the session.
                if self._failed_at is not None and time.monotonic() - self._failed_at < RESTART_BACKOFF_S:
                    raise RuntimeError("the OCR process is down and its last restart failed; not retrying yet")
                log.warning("the OCR process is gone; starting a new one")
                try:
                    self._start_locked()
                except Exception:
                    self._failed_at = time.monotonic()
                    raise
                self._failed_at = None
            connection = self._connection
            try:
                connection.send((patch, with_detection))
                answered = connection.poll(self._read_timeout_s)
                status, result = connection.recv() if answered else (None, None)
            except (EOFError, OSError) as exc:
                self._stop_locked()
                self._crashed()
                raise RuntimeError(f"the OCR process went away mid-read: {exc}") from exc
            if not answered:
                # Raised outside the `try`: TimeoutError is an OSError, and the clause above would
                # report a hung child as one that went away.
                self._stop_locked()
                self._crashed()
                raise TimeoutError(f"the OCR process did not answer in {self._read_timeout_s:.0f} s")
        if status != "ok":
            raise RuntimeError(f"OCR failed in its process: {result}")
        return result

    def _crashed(self) -> None:
        """One crash gets an immediate rebuild on the next read; a second within the window does not."""
        now = time.monotonic()
        if self._last_crash is not None and now - self._last_crash < RESTART_BACKOFF_S:
            self._failed_at = now
        self._last_crash = now

    def stop(self, wait_s: float = 2.0) -> None:
        """Ends the child. Bounded on purpose: it runs on shutdown, and a `read` that is restarting
        holds the lock for up to `START_TIMEOUT_S`; past `wait_s` the child is ended without it."""
        if self._lock.acquire(timeout=wait_s):
            try:
                self._stop_locked()
            finally:
                self._lock.release()
            return
        process = self._process
        if process is not None and process.is_alive():
            process.kill()
            process.join(1)  # reaped, or it lingers as a zombie

    def _stop_locked(self) -> None:
        if self._connection is not None:
            try:
                self._connection.close()
            except OSError:
                pass
            self._connection = None
        if self._process is not None:
            if self._process.is_alive():
                self._process.terminate()
                self._process.join(2)
                if self._process.is_alive():
                    self._process.kill()
                    self._process.join(1)  # reaped, or it lingers as a zombie
            self._process = None
