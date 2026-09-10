"""Exists because the transitions are the contract with the blind user (ADR 0007): a click that
changed mode while inside another one, or a long press that did not go back to idle, would leave the
user not knowing which state they are in, and the audio is their only indicator."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.modes import ModeMachine, Mode  # noqa: E402


def test_one_click_from_idle_is_bus():
    m = ModeMachine()
    assert m.from_clicks(1) is True
    assert m.current is Mode.BUS


def test_two_clicks_from_idle_is_supermarket():
    m = ModeMachine()
    assert m.from_clicks(2) is True
    assert m.current is Mode.SUPERMARKET


def test_inside_a_mode_clicks_do_not_change_mode():
    m = ModeMachine()
    m.from_clicks(1)
    assert m.from_clicks(2) is False
    assert m.current is Mode.BUS


def test_long_press_always_returns_to_idle():
    m = ModeMachine()
    m.from_clicks(2)
    assert m.long_press() is True
    assert m.current is Mode.IDLE
    assert m.long_press() is False  # already there: no transition to announce
