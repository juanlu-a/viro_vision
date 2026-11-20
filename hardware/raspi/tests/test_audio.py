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


def test_the_default_is_not_the_old_unamplified_level():
    """90 % was right for a transducer hanging off a bare GPIO and far too loud once the PAM8403 went
    in (2026-11-18). A board nobody has set a level on yet must not start at that."""
    from virovision.audio import DEFAULT_VOLUME_PERCENT

    assert DEFAULT_VOLUME_PERCENT <= 60


def test_a_chosen_volume_survives_a_reboot(tmp_path):
    """The whole point of persisting it: the device has no volume buttons, and a reboot that put the
    level back to the default would be the device ignoring what the user asked for."""
    from virovision.audio import Volume

    applied = []
    path = tmp_path / "state" / "volume"
    Volume(path=path, default=50, apply=applied.append).set(30)

    after_reboot = Volume(path=path, default=50, apply=applied.append)
    after_reboot.apply_current()
    assert after_reboot.current == 30
    assert applied == [30, 30]


def test_without_a_remembered_level_the_default_applies(tmp_path):
    from virovision.audio import Volume

    applied = []
    Volume(path=tmp_path / "volume", default=50, apply=applied.append).apply_current()
    assert applied == [50]


def test_a_garbled_volume_file_falls_back_to_the_default(tmp_path):
    """Someone edits it by hand, or the battery dies mid-write on an older daemon: the board must
    still start, at the default, rather than crash on `int()`."""
    from virovision.audio import Volume

    path = tmp_path / "volume"
    path.write_text("loud\n")
    assert Volume(path=path, default=50, apply=lambda _: True).current == 50


def test_the_volume_is_clamped_before_it_is_applied_or_stored(tmp_path):
    from virovision.audio import Volume

    applied = []
    path = tmp_path / "volume"
    volume = Volume(path=path, default=50, apply=applied.append)
    assert volume.set(140) == 100
    assert volume.set(-5) == 0
    assert applied == [100, 0]
    assert path.read_text().strip() == "0"


def test_a_volume_that_cannot_be_stored_still_applies(tmp_path):
    """Losing the level at the next reboot is better than refusing to change it now."""
    from virovision.audio import Volume

    blocker = tmp_path / "not-a-dir"
    blocker.write_text("")
    applied = []
    volume = Volume(path=blocker / "volume", default=50, apply=applied.append)
    assert volume.set(20) == 20
    assert applied == [20] and volume.current == 20


def test_a_sequence_with_no_player_installed_does_not_raise():
    """Three clips in a row are a bus announcement. On the Mac there is no `aplay`, and the daemon has
    to survive that: the reading is lost, not the process."""
    player = Player()
    player.play_sequence(["/tmp/one.wav", "/tmp/two.wav"])
    player.stop()


def test_a_clip_dequeued_before_a_hush_is_not_played_after_it(monkeypatch):
    """`hush` means the phone is about to speak (2026-10-06). The worker had already taken the next
    clip off the queue when `stop` ran, and started it right after: the board talking over the phone
    it had just been told to yield to."""
    import threading

    import virovision.audio as audio

    started = []

    class Process:
        pid = 1

        def __init__(self, command, **kwargs):
            started.append(command[-1])

        def wait(self, timeout=None):
            pass

        def poll(self):
            return 0

    monkeypatch.setattr(audio.subprocess, "Popen", Process)
    player = Player()
    dequeued, resume = threading.Event(), threading.Event()
    real_command_for = audio.command_for

    def slow_command_for(path):
        dequeued.set()
        resume.wait(2)
        return real_command_for(path)

    monkeypatch.setattr(audio, "command_for", slow_command_for)
    player.play_sequence(["/tmp/115.wav"])
    assert dequeued.wait(2)
    worker = player._worker
    player.stop()  # the hush, while the worker holds the clip
    resume.set()
    worker.join(2)
    assert started == []
    assert player._worker is None, "a finished worker clears itself, so the next sequence starts one"


def test_the_pwm_pin_is_parked_once_the_output_is_idle_and_reconnected_for_the_next_clip(monkeypatch):
    """With the PAM8403 the idle PWM is a loud hiss that never stops (2026-11-18): the pin is held low
    between clips and handed back to PWM right before the next one."""
    import time

    import virovision.audio as audio

    monkeypatch.setattr(audio, "PARK_AFTER_S", 0.1)
    commands = []
    gate = audio.PwmGate(run=commands.append)

    class Process:
        pid = 1

        def __init__(self, command, **kwargs):
            self.done = False

        def poll(self):
            return 0 if self.done else None

        def wait(self, timeout=None):
            self.done = True

        def terminate(self):
            self.done = True

    monkeypatch.setattr(audio.subprocess, "Popen", Process)
    monkeypatch.setattr(audio, "command_for", lambda path: ["aplay", path])
    player = Player(gate=gate)
    assert commands == [["pinctrl", "set", "18", "op", "dl"]], "parked at startup: nothing is playing"
    commands.clear()

    player.play("/tmp/a.wav")
    assert commands == [["pinctrl", "set", "18", "a5"]]
    commands.clear()
    time.sleep(0.5)
    assert commands == [], "still playing: the pin stays on PWM"

    player._process.done = True
    deadline = time.monotonic() + 3
    while not commands and time.monotonic() < deadline:
        time.sleep(0.05)
    assert commands == [["pinctrl", "set", "18", "op", "dl"]]
    assert gate.is_open is False

    player.play("/tmp/b.wav")
    assert commands[-1] == ["pinctrl", "set", "18", "a5"]
    assert gate.is_open is True
    player.stop()


def test_a_gate_without_pinctrl_does_nothing(monkeypatch):
    """The Mac, or a board without `pinctrl`: the audio must still play, just without parking."""
    import virovision.audio as audio

    monkeypatch.setattr(audio.shutil, "which", lambda name: None)
    gate = audio.PwmGate()
    gate.park()
    gate.open()
    assert gate.is_open is True


def test_the_bus_clips_wait_for_the_sentence_play_started_instead_of_talking_over_it(monkeypatch):
    """2026-11-20: the queue worker launched its clip over the one `play` had started (a mode notice,
    a supermarket reading) and overwrote `_process`, so both were heard at once and the first became
    an orphan no `stop` could cut. Now the clips start only once that sentence has ended."""
    import threading

    import virovision.audio as audio

    running = []
    overlaps = []
    finish = {}

    class Process:
        pid = 1

        def __init__(self, command, **kwargs):
            self.name = command[-1]
            self.done = threading.Event()
            finish[self.name] = self.done
            if running:
                overlaps.append((running[-1], self.name))
            running.append(self.name)

        def _end(self):
            if self.name in running:
                running.remove(self.name)

        def wait(self, timeout=None):
            if not self.done.wait(timeout if timeout is not None else 2):
                raise audio.subprocess.TimeoutExpired("x", timeout)
            self._end()

        def poll(self):
            if self.done.is_set():
                self._end()
                return 0
            return None

        def terminate(self):
            self.done.set()

    monkeypatch.setattr(audio.subprocess, "Popen", Process)
    player = Player()
    player.play("/tmp/modo-omnibus.wav")
    player.play_sequence(["/tmp/115.wav"])
    worker = player._worker
    # The notice is still talking: the bus clip must not have started.
    assert "/tmp/115.wav" not in finish
    finish["/tmp/modo-omnibus.wav"].set()
    for _ in range(50):
        if "/tmp/115.wav" in finish:
            break
        threading.Event().wait(0.02)
    finish["/tmp/115.wav"].set()
    worker.join(2)
    assert overlaps == []
    assert "/tmp/115.wav" in finish


def test_a_hung_sentence_is_cut_after_the_cap_so_the_bus_clips_still_play(monkeypatch):
    """A decoder that never ends must not hold every bus clip behind it (review, 2026-11-20)."""
    import virovision.audio as audio

    started = []

    class Hung:
        pid = 7

        def __init__(self, command, **kwargs):
            self.name = command[-1]
            self.alive = self.name.endswith("hung.wav")
            started.append(self.name)

        def poll(self):
            return None if self.alive else 0

        def wait(self, timeout=None):
            if self.alive and timeout is not None:
                raise audio.subprocess.TimeoutExpired("x", timeout)

        def terminate(self):
            pass  # ignores SIGTERM

        def kill(self):
            self.alive = False

    monkeypatch.setattr(audio.subprocess, "Popen", Hung)
    monkeypatch.setattr(audio, "PLAY_WAIT_CAP_S", 0.2)
    player = Player()
    player.play("/tmp/hung.wav")
    player.play_sequence(["/tmp/115.wav"])
    player._worker.join(3)
    assert started == ["/tmp/hung.wav", "/tmp/115.wav"]


def test_a_queued_clip_that_hangs_is_cut_so_the_next_one_plays(monkeypatch):
    """The queue's own clip, not only the sentence it waits behind, is bounded (review, 2026-11-20)."""
    import virovision.audio as audio

    started = []

    class Clip:
        pid = 8

        def __init__(self, command, **kwargs):
            self.alive = command[-1].endswith("hung.wav")
            started.append(command[-1])

        def poll(self):
            return None if self.alive else 0

        def wait(self, timeout=None):
            if self.alive:
                raise audio.subprocess.TimeoutExpired("x", timeout)

        def terminate(self):
            self.alive = False

        def kill(self):
            self.alive = False

    monkeypatch.setattr(audio.subprocess, "Popen", Clip)
    monkeypatch.setattr(audio, "PLAY_WAIT_CAP_S", 0.1)
    player = Player()
    player.play_sequence(["/tmp/hung.wav", "/tmp/115.wav"])
    player._worker.join(3)
    assert started == ["/tmp/hung.wav", "/tmp/115.wav"]
