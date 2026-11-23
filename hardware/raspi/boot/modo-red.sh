#!/bin/sh
# ViroVision — network mode switch. virovision-modo-red.service runs it on every boot, before the
# daemon.
#
#   /boot/firmware/SIN-AP exists   -> development: --no-ap, the board stays on the known WiFi and
#                                     there is SSH, but the app will say "red apagada".
#   /boot/firmware/SIN-AP missing  -> product: the board brings up its own AP on boot (ADR 0003)
#                                     and leaves any other network, so there is NO SSH.
#
# The mode is switched from any computer: the partition is FAT, so the file is created or deleted.

LOG=/var/log/virovision-firstrun.log
exec >>"$LOG" 2>&1
set -x

DROPIN=/etc/systemd/system/virovision.service.d/10-sin-ap.conf

# This script is on the boot's critical path: the daemon does not start (and the board does not
# advertise) until it finishes. So every step only does work if something changed (2026-10-06: it
# took 3.5 s on every boot, 2.4 of them in a `daemon-reload` that was almost never needed).
RELOAD_UNITS=0
if [ -f /boot/firmware/SIN-AP ]; then
  mkdir -p "$(dirname "$DROPIN")"
  NEW=$(mktemp)
  cat > "$NEW" <<'EOF'
[Service]
ExecStart=
EnvironmentFile=-/etc/default/virovision
ExecStart=/home/virovision/virovision/.venv/bin/python -m virovision --no-ap $VIROVISION_ARGS
EOF
  if cmp -s "$NEW" "$DROPIN"; then
    rm -f "$NEW"
  else
    install -m 644 "$NEW" "$DROPIN" && rm -f "$NEW"
    RELOAD_UNITS=1
  fi
  echo "DEVELOPMENT mode (--no-ap): SSH available, the app will not see the board's network"
else
  if [ -e "$DROPIN" ]; then
    rm -f "$DROPIN"
    RELOAD_UNITS=1
  fi
  rmdir "$(dirname "$DROPIN")" 2>/dev/null || true
  echo "PRODUCT mode: the board brings up its AP, no SSH"
fi

# WiFi profiles left on bootfs from another computer (*.nmconnection): installed on every boot and
# reloaded by NetworkManager. Adds a network (an office, someone's home) without SSH.
for f in /boot/firmware/*.nmconnection; do
  [ -f "$f" ] || continue
  # macOS leaves a `._name` next to every file it copies to a FAT volume. Without this filter it is
  # installed as if it were a profile and NetworkManager logs an error on every boot.
  case "$(basename "$f")" in ._*) continue ;; esac
  dst="/etc/NetworkManager/system-connections/$(basename "$f")"
  cmp -s "$f" "$dst" && continue
  install -m 600 -o root -g root "$f" "$dst" && echo "WiFi profile installed: $dst" && RELOAD_NM=1
done
if [ -n "$RELOAD_NM" ]; then
  nmcli connection reload 2>/dev/null || true
fi

# Prerecorded system notices (ADR 0003, upd. 2026-09-16). They travel on the card rather than by
# `scp` so that a board in product mode (no SSH) can be updated too, which is exactly the situation
# in which they were found missing. Idempotent: they are copied again on every boot, and they are
# 800 KB.
SRC=/boot/firmware/announcements-system
DST=/home/virovision/announcements/system
if [ -d "$SRC" ]; then
  mkdir -p "$DST"
  n=0
  for w in "$SRC"/*.wav; do
    [ -f "$w" ] || continue
    case "$(basename "$w")" in ._*) continue ;; esac
    cmp -s "$w" "$DST/$(basename "$w")" && continue
    install -m 644 -o virovision -g virovision "$w" "$DST/$(basename "$w")" && n=$((n + 1))
  done
  # And whatever the card no longer carries is deleted: the catalog shrank once (from 10 to 6 notices
  # on 2026-09-17), and the leftovers are clips nobody can request, indistinguishable from a notice
  # someone recorded and forgot to route. The card is the source; this makes it the source of truth.
  # Deliberately narrow: only loose `*.wav` files in this directory, which is ours.
  for w in "$DST"/*.wav; do
    [ -f "$w" ] || continue
    [ -f "$SRC/$(basename "$w")" ] || { rm -f "$w" && echo "notice removed: $(basename "$w")"; }
  done
  echo "system notices updated: $n in $DST"
fi

# Daemon code update from the card (2026-11-18), for when there is no SSH: `instalar-daemon.sh` is
# behind its sentinel and only installs the first time. If /boot/firmware/virovision-update.tgz
# exists with the `virovision/` package (Python code only: it does not touch the .venv or run apt,
# so it is no use if the dependencies change), it replaces the installed package before the daemon
# starts, keeps the previous one in `virovision.anterior/` and renames the tgz to `.aplicado` so it
# is not applied again on every boot. To roll back: move `virovision.anterior` to `virovision` over
# SSH, or leave a tgz with the old version on the card.
UPD=/boot/firmware/virovision-update.tgz
APP=/home/virovision/virovision
if [ -f "$UPD" ] && [ -d "$APP/virovision" ]; then
  TMP=$(mktemp -d)
  if tar xzf "$UPD" -C "$TMP" && [ -f "$TMP/virovision/__main__.py" ]; then
    find "$TMP" -name '._*' -delete
    rm -rf "$APP/virovision.anterior"
    # Chained, with no `set -e` in this script: if the first `mv` failed, the second would put the new
    # package INSIDE the old one and the tgz would still be marked applied.
    if mv "$APP/virovision" "$APP/virovision.anterior"; then
      if mv "$TMP/virovision" "$APP/virovision" && chown -R virovision:virovision "$APP/virovision"; then
        mv "$UPD" "$UPD.aplicado"
        echo "daemon updated from the card ($(ls "$APP/virovision" | wc -l) files)"
      else
        rm -rf "$APP/virovision"
        mv "$APP/virovision.anterior" "$APP/virovision"
        echo "daemon update failed: previous version restored, the tgz stays for the next boot"
      fi
    else
      echo "daemon update failed: could not move the installed package aside"
    fi
  else
    echo "virovision-update.tgz has no virovision/__main__.py: not applied"
  fi
  rm -rf "$TMP"
fi

# Volume set from the card (2026-11-18): with the PAM8403 amplifier the daemon's 90 % is too loud,
# and a board in product mode has no SSH to turn it down. If /boot/firmware/VOLUMEN exists with a
# number from 0 to 100, a drop-in reapplies that level 40 s after the daemon starts (it sets its own
# on startup). A stopgap until the volume is chosen from the app: deleting the file removes the
# drop-in.
VOLDROPIN=/etc/systemd/system/virovision.service.d/20-volumen.conf
VOL=$(tr -cd '0-9' < /boot/firmware/VOLUMEN 2>/dev/null)
if [ -n "$VOL" ] && [ "$VOL" -le 100 ]; then
  mkdir -p "$(dirname "$VOLDROPIN")"
  NEW=$(mktemp)
  cat > "$NEW" <<EOF
[Service]
ExecStartPost=/bin/sh -c '(sleep 40; amixer -M -q set PCM ${VOL}%%) >/dev/null 2>&1 &'
EOF
  if cmp -s "$NEW" "$VOLDROPIN"; then
    rm -f "$NEW"
  else
    install -m 644 "$NEW" "$VOLDROPIN" && rm -f "$NEW"
    RELOAD_UNITS=1
  fi
  echo "volume set from the card: ${VOL}%"
elif [ -e "$VOLDROPIN" ]; then
  rm -f "$VOLDROPIN"
  RELOAD_UNITS=1
fi

# Only if a drop-in changed: without it systemd does not see the change, and with it it costs 2.4 s.
if [ "$RELOAD_UNITS" = 1 ]; then
  systemctl daemon-reload
fi
