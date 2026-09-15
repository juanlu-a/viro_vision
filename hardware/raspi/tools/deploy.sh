#!/usr/bin/env bash
# Copies this checkout's daemon to the board and restarts it. Also installs the bus-banner wheel if
# one is passed: the board has no git and no credentials on purpose (a device that goes out to the
# street should not carry them), so the package is built on the laptop and copied over.
#
#   tools/deploy.sh                                   # only the daemon
#   tools/deploy.sh ../../../bus-banner-recognizer/dist/*.whl
#
# HOST defaults to virovision.local. In product mode there is no SSH over WiFi: use the Ethernet
# cable (HOST=10.10.0.1) or put the SIN-AP file back on the microSD. See references/placa-acceso.md.
set -euo pipefail

HOST="${HOST:-virovision.local}"
USER="${USER_ON_BOARD:-virovision}"
TARGET="/home/$USER/virovision"
VENV="$TARGET/.venv"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WHEEL="${1:-}"

echo "→ $USER@$HOST"
ssh -o ConnectTimeout=8 "$USER@$HOST" true || {
  echo "no responde. Con el AP arriba no hay SSH por WiFi: cable Ethernet (HOST=10.10.0.1) o microSD." >&2
  exit 1
}

if [ -n "$WHEEL" ]; then
  echo "→ wheel: $(basename "$WHEEL")"
  ssh "$USER@$HOST" "mkdir -p /home/$USER/wheels"
  scp -q "$WHEEL" "$USER@$HOST:/home/$USER/wheels/"
  # sudo, o pip cae en ~/.local y el daemon (que corre como root) no lo ve.
  ssh "$USER@$HOST" "sudo $VENV/bin/pip install --no-deps --force-reinstall -q /home/$USER/wheels/$(basename "$WHEEL")"
fi

echo "→ daemon"
scp -q "$HERE"/virovision/*.py "$USER@$HOST:$TARGET/virovision/"
ssh "$USER@$HOST" "sudo systemctl restart virovision"
echo "→ esperando a que el modo ómnibus esté listo"
ssh "$USER@$HOST" "timeout 120 journalctl -u virovision -f -n 0 --no-pager | grep -m1 'bus mode ready' || echo '(no apareció: mirá journalctl -u virovision)'"
