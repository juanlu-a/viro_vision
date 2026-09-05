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

echo "→ WiFi sin ahorro de energía"
# Medido el 2026-09-05: el primer GET tras un rato quieto tardó 153 ms contra 41-59 los siguientes; es
# el despertar del powersave del WiFi. Para el plan B (la foto por HTTP) conviene no pagarlo.
mkdir -p /etc/NetworkManager/conf.d
printf '[connection]\nwifi.powersave = 2\n' > /etc/NetworkManager/conf.d/10-virovision-wifi-powersave.conf
systemctl reload NetworkManager 2>/dev/null || true

echo "→ AP sólo local: sin puerta de enlace ni DNS en el DHCP"
# Medido el 2026-09-05: con el AP anunciándose como router, el iPhone unido a «ViroVision» quedaba
# sin internet (Safari: "sin conexión"). Sin las opciones 3 (router) y 6 (DNS) la red es sólo local y el
# teléfono conserva su ruta por defecto por datos móviles. Es el requisito duro del plan B (ADR 0003).
mkdir -p /etc/NetworkManager/dnsmasq-shared.d
printf 'dhcp-option=3\ndhcp-option=6\n' > /etc/NetworkManager/dnsmasq-shared.d/10-virovision-solo-local.conf

echo "→ servicio systemd"
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$INSTALL_DIR/virovision.service" > /etc/systemd/system/virovision.service
systemctl daemon-reload
systemctl enable --now virovision.service

echo
echo "listo. seguir los logs:   journalctl -u virovision -f"
echo "ver que anuncia:          bluetoothctl show | grep -i -e powered -e discoverable"
