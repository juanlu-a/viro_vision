#!/bin/sh
# Instala el daemon en una Raspberry Pi OS Lite (Bookworm) y lo deja corriendo como servicio.
# Correr con sudo desde el directorio donde se copió hardware/raspi:  sudo ./setup.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "correlo con sudo" >&2
  exit 1
fi

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "→ instalando en $INSTALL_DIR"

echo "→ paquetes del sistema"
apt-get update -qq
# --no-install-recommends: picamera2 arrastra Qt y demás si se lo deja. En Lite no hace falta nada de eso.
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
  bluez python3-venv python3-pip python3-picamera2

echo "→ venv (con los paquetes del sistema, por picamera2)"
if [ ! -d "$INSTALL_DIR/.venv" ]; then
  python3 -m venv --system-site-packages "$INSTALL_DIR/.venv"
fi
"$INSTALL_DIR/.venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

echo "→ Bluetooth: encendido y sin ahorro de energía del adaptador"
rfkill unblock bluetooth || true
systemctl enable --now bluetooth.service
bluetoothctl power on >/dev/null || true

echo "→ servicio systemd"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$INSTALL_DIR/virovision.service" > /etc/systemd/system/virovision.service
systemctl daemon-reload
systemctl enable --now virovision.service

echo
echo "listo. seguir los logs:   journalctl -u virovision -f"
echo "ver que anuncia:          bluetoothctl show | grep -i -e powered -e discoverable"
