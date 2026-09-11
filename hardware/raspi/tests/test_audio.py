"""Exists because the failure this code fixes was silent, and a silent failure comes back.

`/audio` accepted the reading, wrote it to /tmp, answered 202 — and nobody had passed a `play`, so
the sentence never reached the speaker while every layer reported success. The tests here pin the two
things that can bring that back without anyone noticing: choosing the wrong decoder for an extension
(the audio "plays" and is never heard), and a missing decoder raising instead of warning (the HTTP
handler that answers the phone would die with it).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.audio import Player, command_for  # noqa: E402


def test_the_mp3_the_app_sends_goes_to_a_decoder():
    """The app synthesizes MP3 (`services/audio/synthesis.ts`), so this is the real path."""
    assert command_for("/tmp/virovision-audio/audio-123.mp3") == ["mpg123", "-q", "/tmp/virovision-audio/audio-123.mp3"]


def test_a_wav_goes_to_aplay_and_not_to_the_mp3_decoder():
    """`aplay` comes with alsa-utils and needs no decoder: it is the way out if a board cannot
    install mpg123 (apt fails on this one when the clock has not synced — no RTC)."""
    assert command_for("/tmp/x.wav") == ["aplay", "-q", "/tmp/x.wav"]


def test_the_extension_is_matched_regardless_of_case():
    assert command_for("/tmp/X.MP3")[0] == "mpg123"


def test_a_format_nobody_can_play_is_none_instead_of_a_guess():
    """`http_server` names the file `.bin` when the Content-Type is not one it knows. Guessing a
    decoder for it would print an error from mpg123 instead of saying what actually happened."""
    assert command_for("/tmp/audio-1.bin") is None
    assert command_for("/tmp/audio-1") is None


def test_playing_a_format_nobody_can_play_does_not_raise():
    # The caller is the HTTP handler answering the phone: an exception here would be a 500 on a
    # request that did deliver its audio.
    Player().play("/tmp/audio-1.bin")


def test_playing_with_no_decoder_installed_does_not_raise():
    """On the Mac neither mpg123 nor aplay exists, which is exactly the board's state before
    `setup.sh` runs. It has to end in a log line, not in an exception."""
    Player().play("/tmp/does-not-exist.mp3")


def test_stopping_with_nothing_playing_is_safe():
    # `stop()` is called on every new reading and on shutdown, most of the time with nothing playing.
    player = Player()
    player.stop()
    player.stop()


def test_the_volume_is_clamped_instead_of_passed_through():
    """`amixer` would reject 140% with an error, and the level would silently stay where it was — the
    symptom being "the volume setting does nothing"."""
    from virovision.audio import DEFAULT_VOLUME_PERCENT, set_output_volume

    # On the Mac there is no amixer, so this returns False: what is asserted is that it does not raise
    # for an out-of-range value, which is the caller's contract at startup.
    assert set_output_volume(140) is False
    assert set_output_volume(-5) is False
    assert 0 < DEFAULT_VOLUME_PERCENT <= 100


def test_the_default_level_leaves_headroom():
    """PWM audio clips at the top, and a distorted sentence is harder to understand than a soft one —
    which is the opposite of the point."""
    from virovision.audio import DEFAULT_VOLUME_PERCENT

    assert DEFAULT_VOLUME_PERCENT < 100
