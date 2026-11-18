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

# Este script está en la cadena crítica del arranque: el daemon no arranca —y la placa no anuncia—
# hasta que termina. Por eso cada paso trabaja sólo si algo cambió (2026-10-06: corría 3,5 s en
# cada arranque, 2,4 de ellos en un `daemon-reload` que casi nunca hacía falta).
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
  echo "modo DESARROLLO (--no-ap): hay SSH, la app no verá red de la placa"
else
  if [ -e "$DROPIN" ]; then
    rm -f "$DROPIN"
    RELOAD_UNITS=1
  fi
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
  cmp -s "$f" "$dst" && continue
  install -m 600 -o root -g root "$f" "$dst" && echo "perfil WiFi instalado: $dst" && RELOAD_NM=1
done
if [ -n "$RELOAD_NM" ]; then
  nmcli connection reload 2>/dev/null || true
fi

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
    cmp -s "$w" "$DST/$(basename "$w")" && continue
    install -m 644 -o virovision -g virovision "$w" "$DST/$(basename "$w")" && n=$((n + 1))
  done
  # Y se borra lo que la tarjeta ya no trae: el catálogo se achicó una vez (de 10 a 6 avisos el
  # 2026-09-17) y los que sobran son clips que nadie puede pedir, indistinguibles de un aviso que
  # alguien grabó y se olvidó de rutear. La tarjeta es la fuente; esto la hace fuente de verdad.
  # Acotado a propósito: sólo `*.wav` sueltos en este directorio, que es nuestro.
  for w in "$DST"/*.wav; do
    [ -f "$w" ] || continue
    [ -f "$SRC/$(basename "$w")" ] || { rm -f "$w" && echo "aviso retirado: $(basename "$w")"; }
  done
  echo "avisos de sistema actualizados: $n en $DST"
fi

# Actualización del código del daemon desde la tarjeta (2026-11-18), para cuando no hay SSH:
# `instalar-daemon.sh` está detrás de su centinela y sólo instala la primera vez. Si existe
# /boot/firmware/virovision-update.tgz con el paquete `virovision/` (sólo el código Python: no toca
# el .venv ni corre apt, así que no sirve si cambian las dependencias), reemplaza el paquete
# instalado antes de que arranque el daemon, guarda el anterior en `virovision.anterior/` y renombra
# el tgz a `.aplicado` para no reaplicarlo en cada arranque. Volver atrás: mover
# `virovision.anterior` a `virovision` por SSH, o dejar en la tarjeta un tgz con la versión vieja.
UPD=/boot/firmware/virovision-update.tgz
APP=/home/virovision/virovision
if [ -f "$UPD" ] && [ -d "$APP/virovision" ]; then
  TMP=$(mktemp -d)
  if tar xzf "$UPD" -C "$TMP" && [ -f "$TMP/virovision/__main__.py" ]; then
    find "$TMP" -name '._*' -delete
    rm -rf "$APP/virovision.anterior"
    mv "$APP/virovision" "$APP/virovision.anterior"
    mv "$TMP/virovision" "$APP/virovision"
    chown -R virovision:virovision "$APP/virovision"
    mv "$UPD" "$UPD.aplicado"
    echo "daemon actualizado desde la tarjeta ($(ls "$APP/virovision" | wc -l) archivos)"
  else
    echo "virovision-update.tgz no trae virovision/__main__.py: no se aplica"
  fi
  rm -rf "$TMP"
fi

# Volumen fijado desde la tarjeta (2026-11-18): con el amplificador PAM8403 el 90 % del daemon es
# demasiado fuerte y una placa en modo producto no tiene SSH para bajarlo. Si existe
# /boot/firmware/VOLUMEN con un número de 0 a 100, un drop-in reaplica ese nivel 40 s después de que
# arranca el daemon (que fija el suyo al iniciar). Es un parche hasta que el volumen se elija desde
# la app: al borrar el archivo, el drop-in se retira.
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
  echo "volumen fijado desde la tarjeta: ${VOL}%"
elif [ -e "$VOLDROPIN" ]; then
  rm -f "$VOLDROPIN"
  RELOAD_UNITS=1
fi

# Sólo si algún drop-in cambió: sin eso systemd no lo ve, y con él son 2,4 s.
if [ "$RELOAD_UNITS" = 1 ]; then
  systemctl daemon-reload
fi
