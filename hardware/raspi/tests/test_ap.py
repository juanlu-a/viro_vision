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
    def __init__(self, existing=False):
        self.calls = []
        self.existing = existing

    def __call__(self, args):
        self.calls.append(list(args))
        if args[:1] == ["-t"] and "--active" in args:
            return subprocess.CompletedProcess(args, 0, stdout="netplan-wlan0-Jack_2.4:wlan0\nlo:lo\n", stderr="")
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
    assert nm.calls[-2] == ["con", "down", CONNECTION_NAME]
    assert nm.calls[-1][:3] == ["-w", "25", "device"] and nm.calls[-1][-1] == "wlan0"


def test_active_connection_returns_the_one_on_wlan0():
    assert AccessPoint(FakeNmcli()).active_connection() == "netplan-wlan0-Jack_2.4"


def test_an_nmcli_that_fails_raises_with_the_reason():
    def nm(args):
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="Error: wlan0 does not exist")

    with pytest.raises(RuntimeError, match="wlan0 does not exist"):
        AccessPoint(nm).turn_on()
