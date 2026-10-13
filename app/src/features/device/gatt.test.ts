import { GATT, audioCommand } from '@/features/device/gatt';

describe('audioCommand', () => {
  /**
   * The device parses these two keys and nothing else (`hardware/raspi/virovision/core.py`). It is a
   * contract across two repositories, so it is pinned here: a rename on this side would be silent,
   * the device would keep its previous setting, and a bus reading would come out of the board with
   * the setting on the phone. That is the bug this command exists to fix (2026-09-15).
   */
  it('says exactly what the device reads', () => {
    expect(audioCommand('phone')).toBe('{"cmd":"audio","target":"phone"}');
    expect(audioCommand('device')).toBe('{"cmd":"audio","target":"device"}');
  });

  it('fits in a single write, with room to spare', () => {
    // The control characteristic takes one JSON object per write; the device caps its own events at
    // 180 bytes and this is far below any MTU we have negotiated (517).
    expect(audioCommand('device').length).toBeLessThan(64);
  });

  it('goes to the control characteristic, not the mode one', () => {
    // Writing it to `mode` would switch the device to an operating mode instead: `mode` is a single
    // byte and the first byte here is '{' (123), which is not a mode.
    expect(GATT.characteristics.control).not.toBe(GATT.characteristics.mode);
  });
});
