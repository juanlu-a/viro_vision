#!/bin/sh
# Installs the daemon on a Raspberry Pi OS Lite (Bookworm) and leaves it running as a service.
# Run it with sudo from the directory hardware/raspi was copied to:  sudo ./setup.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "run it with sudo" >&2
  exit 1
fi

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "→ installing in $INSTALL_DIR"

echo "→ system packages"
apt-get update -qq
# --no-install-recommends: picamera2 drags in Qt and more if left alone. None of that is needed on Lite.
# gpiozero + lgpio: the physical button (ADR 0007). They go through apt like picamera2 — gpiozero's
# backend on Trixie is lgpio, and the apt package is the one that brings the version matching the kernel.
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
  bluez python3-venv python3-pip python3-picamera2 python3-gpiozero python3-lgpio

echo "→ venv (with the system packages, because of picamera2)"
if [ ! -d "$INSTALL_DIR/.venv" ]; then
  python3 -m venv --system-site-packages "$INSTALL_DIR/.venv"
fi
"$INSTALL_DIR/.venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

echo "→ Bluetooth: powered on and with the adapter's power saving off"
rfkill unblock bluetooth || true
systemctl enable --now bluetooth.service
bluetoothctl power on >/dev/null || true

echo "→ WiFi without power saving"
# Measured on 2026-09-05: the first GET after a while idle took 153 ms against 41-59 for the following
# ones; that is the WiFi power save waking up. For plan B (the photo over HTTP) it is better not to pay it.
mkdir -p /etc/NetworkManager/conf.d
printf '[connection]\nwifi.powersave = 2\n' > /etc/NetworkManager/conf.d/10-virovision-wifi-powersave.conf
systemctl reload NetworkManager 2>/dev/null || true

echo "→ local-only AP: no gateway and no DNS in the DHCP"
# Measured on 2026-09-05: with the AP advertising itself as a router, the iPhone joined to "ViroVision"
# was left without internet (Safari: "no connection"). Without options 3 (router) and 6 (DNS) the network
# is local only and the phone keeps its default route over cellular data. It is plan B's hard
# requirement (ADR 0003).
mkdir -p /etc/NetworkManager/dnsmasq-shared.d
# The file used to be called 10-virovision-solo-local.conf; a stale copy would apply the same options
# twice, so it is removed rather than left behind.
rm -f /etc/NetworkManager/dnsmasq-shared.d/10-virovision-solo-local.conf
printf 'dhcp-option=3\ndhcp-option=6\n' > /etc/NetworkManager/dnsmasq-shared.d/10-virovision-local-only.conf

echo "→ systemd service"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$INSTALL_DIR/virovision.service" > /etc/systemd/system/virovision.service
systemctl daemon-reload
systemctl enable --now virovision.service

echo
echo "done. follow the logs:      journalctl -u virovision -f"
echo "check what it advertises:   bluetoothctl show | grep -i -e powered -e discoverable"
