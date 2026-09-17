#!/bin/sh
# ViroVision — interruptor de modo de red. Lo corre virovision-modo-red.service en cada arranque,
# antes del daemon.
#
#   /boot/firmware/SIN-AP existe   -> desarrollo: --no-ap, la placa se queda en la WiFi conocida y
#                                     hay SSH, pero la app va a decir "red apagada".
#   /boot/firmware/SIN-AP no está  -> producto: la placa levanta su propio AP al arrancar (ADR 0003)
#                                     y deja cualquier otra red, así que NO hay SSH.
#
# El modo se cambia desde cualquier computadora: la partición es FAT, se crea o se borra el archivo.

LOG=/var/log/virovision-firstrun.log
exec >>"$LOG" 2>&1
set -x

DROPIN=/etc/systemd/system/virovision.service.d/10-sin-ap.conf

if [ -f /boot/firmware/SIN-AP ]; then
  mkdir -p "$(dirname "$DROPIN")"
  cat > "$DROPIN" <<'EOF'
[Service]
ExecStart=
EnvironmentFile=-/etc/default/virovision
ExecStart=/home/virovision/virovision/.venv/bin/python -m virovision --no-ap $VIROVISION_ARGS
EOF
  echo "modo DESARROLLO (--no-ap): hay SSH, la app no verá red de la placa"
else
  rm -f "$DROPIN"
  rmdir "$(dirname "$DROPIN")" 2>/dev/null || true
  echo "modo PRODUCTO: la placa levanta su AP, no habrá SSH"
fi

# Perfiles WiFi dejados en bootfs desde otra computadora (*.nmconnection): se instalan en cada
# arranque y NetworkManager los recarga. Permite sumar una red (oficina, casa de alguien) sin SSH.
for f in /boot/firmware/*.nmconnection; do
  [ -f "$f" ] || continue
  # macOS deja un `._nombre` al lado de cada archivo que copia a una FAT. Sin este filtro se instala
  # como si fuera un perfil y NetworkManager escupe un error por cada arranque.
  case "$(basename "$f")" in ._*) continue ;; esac
  dst="/etc/NetworkManager/system-connections/$(basename "$f")"
  install -m 600 -o root -g root "$f" "$dst" && echo "perfil WiFi instalado: $dst"
done
nmcli connection reload 2>/dev/null || true

# Avisos de sistema pregrabados (ADR 0003, act. 2026-09-16). Van por la tarjeta y no por `scp` para
# que una placa en modo producto -sin SSH- también se pueda actualizar, que es exactamente la
# situación en la que se descubrió que faltaban. Idempotente: se recopian en cada arranque, y son
# 800 KB.
SRC=/boot/firmware/announcements-system
DST=/home/virovision/announcements/system
if [ -d "$SRC" ]; then
  mkdir -p "$DST"
  n=0
  for w in "$SRC"/*.wav; do
    [ -f "$w" ] || continue
    case "$(basename "$w")" in ._*) continue ;; esac
    install -m 644 -o virovision -g virovision "$w" "$DST/$(basename "$w")" && n=$((n + 1))
  done
  echo "avisos de sistema instalados: $n en $DST"
fi

systemctl daemon-reload
