#!/bin/sh
# ViroVision — stage 2 of 2: install the daemon. virovision-instalar.service launches it on a normal
# boot, once NetworkManager is up and (hopefully) there is a network. Idempotent: with no network it
# does not leave the sentinel, and the next boot retries.

LOG=/var/log/virovision-firstrun.log
exec >>"$LOG" 2>&1
set -x
echo "===== stage 2 ($(date -Is)) ====="

SENTINEL=/var/lib/virovision-instalado
TGZ=/boot/firmware/virovision-daemon.tgz

ip -4 -o addr show dev wlan0 || echo "wlan0 has no IP"
nmcli -t -f NAME,DEVICE connection show --active || true

[ -f "$TGZ" ] || { echo "$TGZ is missing, exiting"; exit 0; }

# setup.sh runs apt-get under `set -eu`: without DNS it aborts entirely and nothing is installed.
i=0
while [ $i -lt 24 ]; do
  getent hosts deb.debian.org >/dev/null 2>&1 && break
  i=$((i + 1))
  sleep 5
done
if ! getent hosts deb.debian.org >/dev/null 2>&1; then
  echo "no DNS after 2 min: not installing, the next boot retries"
  exit 0
fi

rm -rf /home/virovision/virovision
mkdir -p /home/virovision
tar xzf "$TGZ" -C /home/virovision && mv /home/virovision/raspi /home/virovision/virovision
chown -R virovision:virovision /home/virovision/virovision

# The daemon brings up the WiFi AP on start (ADR 0003), and with the AP up the board LEAVES the home
# network: SSH is lost. During development we want the opposite. To go back to the production
# behavior: delete this drop-in and restart the service.
# Byte for byte the drop-in `modo-red.sh` writes for SIN-AP (2026-10-06): this one dropped
# /etc/default/virovision and $VIROVISION_ARGS, so the first run after an install ignored the board's
# flags (detector, labels), and a SIN-AP board then paid a needless `daemon-reload` on the next boot.
# It still forces --no-ap whatever SIN-AP says: the install needs the board on the home network.
mkdir -p /etc/systemd/system/virovision.service.d
cat > /etc/systemd/system/virovision.service.d/10-sin-ap.conf <<'EOF'
[Service]
ExecStart=
EnvironmentFile=-/etc/default/virovision
ExecStart=/home/virovision/virovision/.venv/bin/python -m virovision --no-ap $VIROVISION_ARGS
EOF

if sh /home/virovision/virovision/setup.sh; then
  touch "$SENTINEL"
  systemctl daemon-reload
  systemctl restart virovision || true
  echo "daemon installed OK"
else
  echo "setup.sh failed; the next boot retries"
fi
echo "===== end of stage 2 ($(date -Is)) ====="
