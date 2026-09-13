"""Exists because the AP is driven through nmcli and a misplaced argument leaves the device with no
network and no SSH out on the street: the order and the content of the calls are the contract with
NetworkManager."""

import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.ap import CONNECTION_NAME, AccessPoint  # noqa: E402


class FakeNmcli:
    def __init__(self, existing=False, active_on_wlan0="netplan-wlan0-Jack_2.4"):
        self.calls = []
        self.existing = existing
        # What nmcli says is active on wlan0. It is a parameter because the interesting case is the
        # one where it still says `virovision-ap` after the AP was asked to come down.
        self.active_on_wlan0 = active_on_wlan0

    def __call__(self, args):
        self.calls.append(list(args))
        if args[:1] == ["-t"] and "--active" in args:
            return subprocess.CompletedProcess(args, 0, stdout=f"{self.active_on_wlan0}:wlan0\nlo:lo\n", stderr="")
        if args[:1] == ["-t"]:
            return subprocess.CompletedProcess(args, 0, stdout=(CONNECTION_NAME + "\n") if self.existing else "Jack_2.4\n", stderr="")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")


def test_turning_on_creates_the_connection_once_and_brings_it_up():
    nm = FakeNmcli(existing=False)
    ap = AccessPoint(nm)
    ap.turn_on()
    assert ap.on
    verbs = [c[:2] for c in nm.calls]
    assert ["con", "add"] in verbs and ["con", "modify"] in verbs and ["con", "up"] in verbs
    modify = next(c for c in nm.calls if c[:2] == ["con", "modify"])
    assert "802-11-wireless.mode" in modify and "ap" in modify
    assert "ipv4.method" in modify and "shared" in modify
    assert "802-11-wireless.band" in modify and "bg" in modify  # the Zero 2 W is 2.4 GHz only


def test_turning_on_with_the_connection_already_created_only_brings_it_up():
    nm = FakeNmcli(existing=True)
    AccessPoint(nm).turn_on()
    assert [c[:2] for c in nm.calls] == [["-t", "-f"], ["con", "up"]]


def test_turning_off_brings_the_connection_down_and_reconnects_to_the_known_network():
    nm = FakeNmcli(existing=True)
    ap = AccessPoint(nm)
    ap.turn_on()
    ap.turn_off()
    assert not ap.on
    # By position in the sequence and not by index from the end: the check that `turn_off` now makes
    # adds a call after these two, and the contract being pinned is the ORDER — down, then reconnect.
    down = nm.calls.index(["con", "down", CONNECTION_NAME])
    reconnect = next(i for i, c in enumerate(nm.calls) if c[:3] == ["-w", "25", "device"] and c[-1] == "wlan0")
    assert down < reconnect


def test_an_ap_that_refuses_to_come_down_is_reported_as_still_on():
    """The failure of 2026-09-13, reproduced: asked over BLE to turn the AP off, `nmcli con down`
    returned 0 and did nothing. The board then told the app `ap: false` while still serving the AP —
    the one state the app cannot recover from, because it stops looking for the device where it is.

    `self.on` has to come from the interface, not from the fact that we asked."""
    nm = FakeNmcli(existing=True, active_on_wlan0=CONNECTION_NAME)
    ap = AccessPoint(nm)
    ap.turn_on()
    ap.turn_off()
    assert ap.on, "an AP still active on wlan0 must not be reported as off"


def test_active_connection_returns_the_one_on_wlan0():
    assert AccessPoint(FakeNmcli()).active_connection() == "netplan-wlan0-Jack_2.4"


def test_an_nmcli_that_fails_raises_with_the_reason():
    def nm(args):
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="Error: wlan0 does not exist")

    with pytest.raises(RuntimeError, match="wlan0 does not exist"):
        AccessPoint(nm).turn_on()
