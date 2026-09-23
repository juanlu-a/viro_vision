# Cómo acceder a la placa (leer ANTES de tocarla)

Reglas operativas que ya costaron horas. Valen para la Pi que esté en uso. Nada de esto se deduce del
código: vive en la tarjeta.

> ⚠️ **Desde el 2026-09-19 la placa en uso es otra vez la Raspberry Pi Zero 2 W**, la del ADR 0003, y
> volvió la restricción que la 3 B+ prestada había tapado durante diez días: **la Zero 2 W no tiene
> puerto Ethernet**. Todo lo que este documento decía sobre «entrar por cable» **no aplica** mientras
> la placa sea la Zero; la sección quedó abajo porque la 3 B+ sigue existiendo y puede volver.
> Y la Zero es **sólo 2,4 GHz** (la 3 B+ era dual band): una red de 5 GHz no la ve.

## Las tres reglas

1. **Nunca unir la Mac al AP «ViroVision» de la placa.** La Mac tiene una sola radio WiFi: al unirse pierde
   internet, la sesión del agente se corta y macOS vuelve solo a la red conocida a mitad de una copia. Si la
   placa está en modo producto (AP arriba), se le baja el AP **por BLE** o se cambia el modo desde la
   microSD (las dos vías, abajo).
2. **La microSD es el panel de control.** La partición `bootfs` es FAT: se monta en la Mac y desde ahí se
   cambia el modo de red y se agregan redes WiFi, sin SSH. Ver abajo.
3. **La tarjeta sola no instala el daemon.** Sirve para cambiar el modo de red, sumar WiFi y
   actualizar los avisos, pero `instalar-daemon.sh` está detrás de la centinela
   `/var/lib/virovision-instalado`, **que vive en ext4** y no se borra desde macOS. Dejar un
   `virovision-daemon.tgz` nuevo en `bootfs` no alcanza: hay que extraerlo por SSH. O sea que la
   tarjeta es el camino **hacia** el SSH, no un reemplazo del SSH.

## Cómo entrar, en orden (Zero 2 W, sin Ethernet)

1. **Bajar el AP por BLE**, con la app del teléfono cerrada:
   `cd hardware/raspi && ./.venv-mac/bin/python tools/ap.py`. Tarda ~5 s, la placa vuelve sola a la
   WiFi conocida y ahí hay `ssh virovision@virovision.local`. **No hay que sacar la tarjeta ni apagar
   nada**, y es lo primero que conviene probar.
2. **La microSD**: `touch /Volumes/bootfs/SIN-AP` y arrancar. La placa queda en modo desarrollo de
   forma **persistente** (el punto 1 dura hasta el próximo reinicio), que es lo que se quiere para una
   sesión larga de despliegue. Es el procedimiento probado del 2026-09-10; está en
   `hardware/raspi/README.md`.
3. **Unirse al AP desde una máquina con dos interfaces** (no la Mac, ver regla 1): `sshd` escucha en
   todas, así que se llega a `ssh virovision@10.42.0.1` sin bajar el AP.

**Cable USB (gadget Ethernet): sin probar.** La Zero 2 W puede exponer una interfaz de red por su
puerto USB de datos (`dtoverlay=dwc2` en `config.txt` + `modules-load=dwc2,g_ether` en `cmdline.txt`,
las dos cosas se editan desde la Mac en `bootfs`). Sería el reemplazo natural del RJ45 que perdimos
—cable directo, sin tocarle el WiFi a nadie, con el AP arriba— pero **todavía nadie lo probó en esta
placa**: si lo probás, escribí acá qué pasó en vez de dejarlo como promesa.

## Redes WiFi: la placa guarda varias

NetworkManager conserva **todos** los perfiles y se une al que esté presente. Hoy tiene `Jack_2.4` (casa) y
`wye-guest` (oficina WyeWorks). Para sumar una red **sin SSH**: dejar en `bootfs` un archivo
`<nombre>.nmconnection` y `modo-red.sh` (que corre como root en cada arranque) lo instala en
`/etc/NetworkManager/system-connections/` y recarga NetworkManager. Plantilla:

```ini
[connection]
id=NOMBRE
uuid=<uuidgen en minúsculas>
type=wifi
interface-name=wlan0
autoconnect=true
autoconnect-priority=20

[wifi]
mode=infrastructure
ssid=NOMBRE

[wifi-security]
key-mgmt=wpa-psk
psk=CLAVE

[ipv4]
method=auto

[ipv6]
method=auto
addr-gen-mode=default
```

Con SSH es más corto: `sudo nmcli con add type wifi ifname wlan0 con-name NOMBRE ssid NOMBRE wifi-sec.key-mgmt wpa-psk wifi-sec.psk CLAVE`.
La Pi 3 B+ es dual band; la Zero 2 W **sólo 2,4 GHz**.

## Modo de red desde la microSD

- `bootfs/SIN-AP` **existe** → modo desarrollo: sin AP propio, se une a la WiFi conocida, hay SSH e internet;
  la app dice «red apagada».
- `bootfs/SIN-AP` **no existe** → modo producto: AP «ViroVision» al arrancar, sin SSH por WiFi.
- El drop-in de systemd lo escribe `modo-red.sh` en cada arranque: **no editarlo a mano**. Otra vía para
  bajar el AP sin tocar la tarjeta: `hardware/raspi/tools/ap.py` (por BLE, ~5 s), la placa vuelve a la WiFi conocida.

## Cable Ethernet directo Mac ↔ Pi — SÓLO con una placa que tenga RJ45 (la 3 B+ prestada)

> ⚠️ **No aplica a la Zero 2 W**, que no tiene puerto Ethernet. Esto se escribió entre el 2026-09-09
> y el 2026-09-18, mientras se trabajaba con la 3 B+ prestada, y queda porque esa placa puede volver.
> Con la Zero, subí a «Cómo entrar, en orden».

La Pi tiene `eth0` fija en **10.10.0.1/24**, gateway 10.10.0.2, DNS 8.8.8.8. En la Mac (adaptador «USB
10/100/1000 LAN», `en7`; dejarlo en **DHCP**, jamás con router configurado, porque pisa la ruta por
defecto de la Mac y la deja sin DNS):

```sh
sudo ifconfig en7 alias 10.10.0.2 netmask 255.255.255.0
sudo sysctl -w net.inet.ip.forwarding=1
echo "nat on en0 from 10.10.0.0/24 to any -> (en0)" | sudo pfctl -a com.apple/virovision -f -; sudo pfctl -e
ssh virovision@10.10.0.1      # o virovision@virovision.local
```

Después de conectar, en la placa: `sudo date -u -s "$(date -u +'%Y-%m-%d %H:%M:%S')"` (sin RTC, apt falla
con el reloj atrasado) y `getent hosts deb.debian.org` antes de instalar nada.

## Trampas que ya mordieron

- **El journal sobrevive a un reinicio desde el 2026-09-23** (antes Raspberry Pi OS lo guardaba en RAM,
  `Storage=volatile`). Para leer una prueba hecha en modo producto: bajar el AP con `tools/ap.py`,
  entrar por SSH y `journalctl -u virovision -b -1` (el arranque anterior) o `--list-boots`. Si una
  placa nueva vuelve a mostrar un solo arranque, le falta el drop-in de `setup.sh`.
- **La cámara no se desenchufa en caliente.** Tras sacar y volver a poner el cable, el daemon dice
  `camera ready` pero cada buffer da `Input/output error` (y el estado BLE, `camera: true`). Sólo
  reiniciar la placa la recupera.

- **`SIN-AP` puede estar «presente» y no existir.** macOS deja un `._SIN-AP` al lado de cada archivo
  que copia a una FAT, y si se borra el real el compañero sobrevive: en un `ls` a los ojos parece que
  está. El 2026-09-17 la placa estuvo en modo producto creyéndola en desarrollo, y como BLE anda
  igual en los dos modos el celular la veía y no había señal de que algo estuviera mal. Comprobar con
  `[ -f SIN-AP ] && echo sí`, no mirando el listado.
- **Los perfiles WiFi y los avisos se instalan solos desde `bootfs`** en cada arranque
  (`modo-red.sh`, versionado en `hardware/raspi/boot/`): un `*.nmconnection` suelto y una carpeta
  `announcements-system/` con los `.wav`. Es la vía para actualizar una placa en modo producto, que
  no tiene SSH.
- **La tarjeta le gana a la placa en cada arranque.** `modo-red.sh` reinstala los avisos desde
  `/boot/firmware/announcements-system/` cada vez que arranca, así que **alinear la placa por SSH no
  sirve**: el próximo reinicio lo deshace. El 2026-09-18 se desplegaron 6 clips por SSH, la placa
  reinició sola y volvieron los 10 viejos de la tarjeta. Lo que hay que actualizar es
  `/boot/firmware/`, y **eso se hace por SSH sin sacar la tarjeta**:
  `scp` a `/tmp` y `sudo install` / `sudo cp` a `/boot/firmware/…`. El lector de tarjetas nunca hace
  falta.
- **No copies código a la placa con el `tar` de macOS.** El `tar` de macOS mete los `._` de los
  atributos extendidos, y al extraer con GNU tar en la Pi el 2026-09-18 **todos los `.py` quedaron en
  0 bytes**: nombres y fechas correctos, contenido vacío. El daemon arrancaba, importaba módulos
  vacíos, salía con código 0 y systemd lo reiniciaba en bucle — sin una sola excepción en el log. Lo
  que sí funciona es `scp virovision/*.py placa:…/virovision/`, y **verificar los bytes de los dos
  lados** (`cat *.py | wc -c`), no que los archivos existan.
- **El daemon NO se reinstala solo.** `instalar-daemon.sh` está protegido por la centinela
  `/var/lib/virovision-instalado`, así que dejar un `virovision-daemon.tgz` nuevo en la tarjeta no
  alcanza: hay que extraerlo por SSH. El payload igual conviene que viaje en la tarjeta, porque así
  no hace falta internet en la placa.
- **Las fechas de archivo mienten.** `modo-red.sh` corre antes de que NTP sincronice y la Pi no tiene
  RTC: lo que instala queda fechado en el apagado anterior. Para saber cuándo se instaló algo,
  `/var/log/virovision-firstrun.log`.
- **Para probar los avisos sin el teléfono**: `./.venv-mac/bin/python tools/say.py --all` desde
  `hardware/raspi` (con la app cerrada). Dice uno por uno los diez y reporta los errores que conteste
  la placa.
- `nmcli con up` sobre `eth0` corta la sesión SSH que va por ese cable: usar `nmcli dev reapply eth0` o
  escribir `/etc/resolv.conf`.
- `pkill -f "patrón"` mata la propia sesión SSH si el patrón está en su línea de comando: matar por PID
  leyendo `/proc/<pid>/cmdline`.
- Si la Pi pide DHCP por cable y nadie contesta, NetworkManager da la conexión por fallida y la placa
  **desaparece del link** hasta reenchufar el cable (por eso la IP fija).
- En la oficina, `1.1.1.1:53` está bloqueado y el HTTP plano se manipula: DNS 8.8.8.8 y `apt` por HTTPS
  (`/etc/apt/sources.list.d/*.sources` ya están en `https://`).
- El servicio `virovision` toma la cámara al arrancar: `sudo systemctl stop virovision` antes de probar la
  cámara a mano, y volver a prenderlo al terminar.
- Usuario `virovision`, hostname `virovision.local`, `sudo` sin contraseña, clave SSH de la Mac ya cargada.
