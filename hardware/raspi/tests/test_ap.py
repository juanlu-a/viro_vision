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
    """Stands in for nmcli, answering the three query shapes `AccessPoint` uses.

    `active_on_wlan0` is a parameter (and may be a list, consumed one reading at a time) because the
    interesting cases are all about what nmcli says is active *after* an operation: still the AP, or
    finally the home network.
    """

    def __init__(self, existing=False, active_on_wlan0="netplan-wlan0-Jack_2.4", profiles=None):
        self.calls = []
        self.existing = existing
        self.active_on_wlan0 = active_on_wlan0
        self.profiles = profiles if profiles is not None else [
            ("802-11-wireless", "yes", "Jack_2.4"),
            ("802-11-wireless", "no", CONNECTION_NAME),
            ("loopback", "no", "lo"),
        ]

    def _active(self):
        if isinstance(self.active_on_wlan0, list):
            return self.active_on_wlan0.pop(0) if self.active_on_wlan0 else None
        return self.active_on_wlan0

    def __call__(self, args):
        self.calls.append(list(args))
        if args[:1] == ["-t"] and "--active" in args:
            active = self._active()
            body = f"{active}:wlan0\n" if active else ""
            return subprocess.CompletedProcess(args, 0, stdout=body + "lo:lo\n", stderr="")
        if args[:1] == ["-t"] and "TYPE,AUTOCONNECT,NAME" in args:
            rows = "".join(f"{k}:{a}:{n}\n" for k, a, n in self.profiles)
            return subprocess.CompletedProcess(args, 0, stdout=rows, stderr="")
        if args[:1] == ["-t"]:
            return subprocess.CompletedProcess(args, 0, stdout=(CONNECTION_NAME + "\n") if self.existing else "Jack_2.4\n", stderr="")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")


def test_turning_on_creates_the_connection_once_and_brings_it_up():
    nm = FakeNmcli(existing=False)
    ap = AccessPoint(nm, sleep=lambda _s: None)
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
    AccessPoint(nm, sleep=lambda _s: None).turn_on()
    assert [c[:2] for c in nm.calls] == [["-t", "-f"], ["con", "up"]]


def test_the_reconnection_never_brings_our_own_ap_back_up():
    """The bug measured on the board on 2026-09-14, and the reason this method is no longer one line.

    `nmcli device connect wlan0` means "activate the best AVAILABLE connection", and one second after
    the AP is torn down the home network is not available yet —nothing has re-scanned— while an
    AP-mode profile always is, because it needs to see nothing. So the board asked to leave its own
    access point and was put straight back on it, with both commands reporting success. `autoconnect
    no` on the AP profile does not help: it governs automatic activation, not an explicit
    `device connect`.

    Here nmcli keeps answering `virovision-ap`, which is exactly that situation. What must NOT appear
    is a `device connect`, and what must appear is the home profile brought up BY NAME."""
    nm = FakeNmcli(existing=True, active_on_wlan0=CONNECTION_NAME)
    ap = AccessPoint(nm, sleep=lambda _s: None)
    ap.turn_off()

    assert not any("device" in c and "connect" in c for c in nm.calls), "`device connect` can pick the AP"
    assert ["-w", "25", "con", "up", "Jack_2.4"] in nm.calls


def test_the_reconnection_waits_for_networkmanager_before_forcing_anything():
    """NM's own autoconnect is the path that behaves: on the board it brings the home profile up about
    two seconds after the AP goes down, choosing what this board is configured to prefer. If it does
    its job, nothing else should be activated."""
    nm = FakeNmcli(existing=True, active_on_wlan0=[CONNECTION_NAME, "Jack_2.4"])
    ap = AccessPoint(nm, sleep=lambda _s: None)
    ap.turn_off()

    assert not ap.on
    assert not any(c[:2] == ["-w", "25"] and "up" in c for c in nm.calls), "it forced a profile it did not need to"


def test_known_networks_excludes_the_ap_and_anything_not_wifi():
    nm = FakeNmcli()
    assert AccessPoint(nm, sleep=lambda _s: None).known_networks() == ["Jack_2.4"]


def test_a_connection_name_with_a_colon_survives_the_parsing():
    """`nmcli -t` escapes a colon inside a name, so NAME is asked for last: splitting from the left
    would cut the name in half."""
    nm = FakeNmcli(profiles=[("802-11-wireless", "yes", "Casa: 2.4GHz")])
    assert AccessPoint(nm, sleep=lambda _s: None).known_networks() == ["Casa: 2.4GHz"]


def test_turning_off_brings_the_connection_down_and_reconnects_to_the_known_network():
    nm = FakeNmcli(existing=True)
    ap = AccessPoint(nm, sleep=lambda _s: None)
    ap.turn_on()
    ap.turn_off()
    assert not ap.on
    # By position in the sequence and not by index from the end: the checks `turn_off` now makes add
    # calls after these, and the contract being pinned is the ORDER — down, then look at wlan0.
    down = nm.calls.index(["con", "down", CONNECTION_NAME])
    looked = next(i for i, c in enumerate(nm.calls) if "--active" in c)
    assert down < looked


def test_an_ap_that_refuses_to_come_down_is_reported_as_still_on():
    """The failure of 2026-09-13, reproduced: asked over BLE to turn the AP off, `nmcli con down`
    returned 0 and did nothing. The board then told the app `ap: false` while still serving the AP —
    the one state the app cannot recover from, because it stops looking for the device where it is.

    `self.on` has to come from the interface, not from the fact that we asked."""
    nm = FakeNmcli(existing=True, active_on_wlan0=CONNECTION_NAME)
    ap = AccessPoint(nm, sleep=lambda _s: None)
    ap.turn_on()
    ap.turn_off()
    assert ap.on, "an AP still active on wlan0 must not be reported as off"


def test_active_connection_returns_the_one_on_wlan0():
    assert AccessPoint(FakeNmcli(), sleep=lambda _s: None).active_connection() == "netplan-wlan0-Jack_2.4"


def test_an_nmcli_that_fails_raises_with_the_reason():
    def nm(args):
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="Error: wlan0 does not exist")

    with pytest.raises(RuntimeError, match="wlan0 does not exist"):
        AccessPoint(nm, sleep=lambda _s: None).turn_on()
