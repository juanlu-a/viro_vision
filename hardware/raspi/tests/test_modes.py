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


def test_clicks_switch_between_modes_without_passing_through_idle():
    """ADR 0007, 2026-09-09 update. Until then this needed a long press in between, and pressing
    twice inside a mode did nothing — which in the hand reads as a broken button, not as a missing
    gesture."""
    m = ModeMachine()
    m.from_clicks(1)
    assert m.from_clicks(2) is True
    assert m.current is Mode.SUPERMARKET
    assert m.from_clicks(1) is True
    assert m.current is Mode.BUS


def test_naming_the_active_mode_is_not_a_transition():
    """No transition means nothing is announced, and the app does not take a second photo the user
    did not ask for."""
    m = ModeMachine()
    m.from_clicks(2)
    assert m.from_clicks(2) is False
    assert m.current is Mode.SUPERMARKET


def test_a_click_count_that_names_no_mode_leaves_the_state_alone():
    m = ModeMachine()
    m.from_clicks(1)
    assert m.from_clicks(3) is False
    assert m.from_clicks(0) is False
    assert m.current is Mode.BUS
    assert ModeMachine.mode_for_clicks(3) is None
    assert ModeMachine.mode_for_clicks(1) is Mode.BUS
    assert ModeMachine.mode_for_clicks(2) is Mode.SUPERMARKET


def test_long_press_always_returns_to_idle():
    m = ModeMachine()
    m.from_clicks(2)
    assert m.long_press() is True
    assert m.current is Mode.IDLE
    assert m.long_press() is False  # already there: no transition to announce
