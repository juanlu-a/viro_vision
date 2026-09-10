"""Exists because the BlueZ adapter only runs on the device: on 2026-09-05 a new core argument
(`ap_control`) did not propagate to the adapter and the service went into a restart loop no test on
the Mac saw. It runs only where `bluez_peripheral` is installed (the device, or a venv that has it);
elsewhere it is skipped, not failed."""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

pytest.importorskip("bluez_peripheral")

from virovision.gatt import ViroVisionService  # noqa: E402


def test_the_bluez_adapter_builds_with_every_core_argument():
    loop = asyncio.new_event_loop()
    try:
        service = ViroVisionService(
            loop=loop,
            read_status=lambda: {"version": "t"},
            capture=None,
            synthetic_payload=bytes,
            ap_control=lambda on: None,
        )
        assert len(service._characteristics) == 6
        assert service.mode.getter_func(service, None) == b"\x00"
    finally:
        loop.close()
