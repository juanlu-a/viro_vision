#!/bin/sh
# ViroVision — etapa 2 de 2: instalar el daemon. La lanza virovision-instalar.service en el arranque
# normal, cuando ya hay NetworkManager y (con suerte) red. Idempotente: si no hay red no deja la
# sentinela y el próximo arranque lo reintenta.

LOG=/var/log/virovision-firstrun.log
exec >>"$LOG" 2>&1
set -x
echo "===== etapa 2 ($(date -Is)) ====="

SENTINELA=/var/lib/virovision-instalado
TGZ=/boot/firmware/virovision-daemon.tgz

ip -4 -o addr show dev wlan0 || echo "wlan0 sin IP"
nmcli -t -f NAME,DEVICE connection show --active || true

[ -f "$TGZ" ] || { echo "no está $TGZ, salgo"; exit 0; }

# setup.sh corre apt-get y tiene `set -eu`: sin DNS aborta entero y no queda nada instalado.
i=0
while [ $i -lt 24 ]; do
  getent hosts deb.debian.org >/dev/null 2>&1 && break
  i=$((i + 1))
  sleep 5
done
if ! getent hosts deb.debian.org >/dev/null 2>&1; then
  echo "sin DNS tras 2 min: no instalo, se reintenta en el próximo arranque"
  exit 0
fi

rm -rf /home/virovision/virovision
mkdir -p /home/virovision
tar xzf "$TGZ" -C /home/virovision && mv /home/virovision/raspi /home/virovision/virovision
chown -R virovision:virovision /home/virovision/virovision

# El daemon levanta el AP WiFi al arrancar (ADR 0003) y con el AP arriba la placa DEJA la red de
# casa: se pierde el SSH. Mientras se desarrolla queremos lo contrario. Para volver al
# comportamiento de producción: borrar este drop-in y reiniciar el servicio.
mkdir -p /etc/systemd/system/virovision.service.d
cat > /etc/systemd/system/virovision.service.d/10-sin-ap.conf <<'EOF'
[Service]
ExecStart=
ExecStart=/home/virovision/virovision/.venv/bin/python -m virovision --no-ap
EOF

if sh /home/virovision/virovision/setup.sh; then
  touch "$SENTINELA"
  systemctl daemon-reload
  systemctl restart virovision || true
  echo "daemon instalado OK"
else
  echo "setup.sh falló; se reintenta en el próximo arranque"
fi
echo "===== fin etapa 2 ($(date -Is)) ====="
