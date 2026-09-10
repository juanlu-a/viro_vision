# Daemon de la placa (Raspberry Pi Zero 2 W)

Un solo proceso Python que hace de **periférico BLE** (servidor GATT sobre BlueZ), captura con la
Camera Module 3 y lleva la máquina de modos de [ADR 0007](../../docs/architecture/adr/0007-botones-fisicos-modos-de-operacion.md).
Hoy su trabajo principal es **el spike del [ADR 0003](../../docs/architecture/adr/0003-enlace-placa-telefono.md)**:
medir cuánto tarda una foto de ~53 KB en llegar al teléfono por BLE, para decidir si hace falta WiFi.

Software mínimo a propósito: Raspberry Pi OS **Lite** 64-bit (Bookworm), BlueZ que ya viene, un venv,
un servicio de systemd. No hay camino sin Linux: la cámara necesita libcamera, el Coral libedgetpu, el
BLE BlueZ.

## Instalación (una vez, por SSH)

Desde la Mac, en la raíz del repo, con la placa prendida y en la misma red:

```sh
scp -r hardware/raspi <usuario>@<host-o-ip-de-la-pi>:~/virovision
ssh <usuario>@<host-o-ip-de-la-pi>
cd ~/virovision && sudo ./setup.sh
```

`setup.sh` instala `bluez`, `python3-picamera2` y `python3-venv`, crea `.venv` (con
`--system-site-packages`, porque picamera2 viene por apt), instala `requirements.txt`, enciende el
Bluetooth y deja `virovision.service` habilitado y corriendo. Tarda unos minutos la primera vez.

Verificar:

```sh
journalctl -u virovision -f          # tiene que decir: anunciando «ViroVision» ...
bluetoothctl show | grep -i powered   # Powered: yes
```

Desde el iPhone, antes de tocar la app: **nRF Connect** o **LightBlue** (gratis) ven un periférico
`ViroVision` con un servicio `4380c500-…` y cinco características. Si eso se ve, la placa está bien.

## Cómo arranca la microSD que está en uso (y por qué no se parece a `setup.sh`)

La tarjeta que está en la placa **no se instaló con los pasos de arriba** y su comportamiento no se
deduce del repo. Escribirlo acá es la única forma de que alguien entienda por qué la placa hace algo
distinto de lo que dice el código. Todo vive en `/boot/firmware`, que es **FAT**: se toca desde
cualquier computadora con la tarjeta puesta, sin herramientas de ext4 y sin entrar a la placa.

**El interruptor de modo de red.** Un `virovision-modo-red.service` (`Before=virovision.service`)
corre `/boot/firmware/modo-red.sh` en **cada** arranque, y ese script decide según exista o no un
archivo:

| `/boot/firmware/SIN-AP` | qué hace `modo-red.sh` | consecuencia |
|---|---|---|
| **existe** | escribe el drop-in `/etc/systemd/system/virovision.service.d/10-sin-ap.conf` con `--no-ap` | desarrollo: la placa se queda en la WiFi conocida, **hay SSH**, y la app dice «red apagada» (`status.ip` llega null) |
| **no existe** | borra ese drop-in | producto: la placa levanta su AP al arrancar (ADR 0003) y deja cualquier otra red, así que **no hay SSH** por la red de casa |

Por eso **el drop-in no se edita a mano**: lo pisa el próximo arranque. Lo que se cambia es el
archivo `SIN-AP`, y si hay que cambiar el flag, `modo-red.sh`.

> ✅ **Resuelto el 2026-09-10.** El flag estaba hardcodeado con el nombre viejo (`--sin-ap`, que
> ADR 0009 renombró a `--no-ap`) **en dos archivos, no en uno**: `modo-red.sh` y también
> `instalar-daemon.sh`, que escribe el mismo drop-in por su cuenta después de instalar. Los dos
> quedaron corregidos en la tarjeta. Queda una mención en `firstrun.sh`, pero es un comentario que
> narra lo que pasaba antes y ese script ya no está enganchado en `cmdline.txt`.
>
> **La lección, si algún día se renombra otro flag:** buscarlo en TODO `bootfs`, no en el archivo
> obvio — `grep -ro -- '--[a-z-]*' /Volumes/bootfs/*.sh`. Un flag repetido en dos scripts se corrige
> en uno solo y vuelve en el próximo arranque.

**Con el AP arriba sí se puede entrar.** `sshd` escucha en todas las interfaces: uniéndose a la red
`ViroVision` (clave `virovision2026`) se llega a `ssh virovision@10.42.0.1`. Lo que se pierde en esa
computadora es **internet**, no el SSH — el AP no anuncia gateway ni DNS a propósito (ADR 0003).

> ⚠️ **Aun así, no despliegues desde una máquina con una sola interfaz de red.** Si el equipo sólo
> tiene WiFi, unirse al AP lo deja sin internet, y macOS además **se vuelve solo** a la red conocida
> cuando detecta que la nueva no tiene salida: la conexión no se sostiene, y una copia de archivos
> cortada por la mitad deja el daemon roto. Los dos caminos buenos, en orden:
>
> 1. **Cable Ethernet a la placa.** Esta Pi 3 B+ tiene RJ45 (la Zero 2 W no): queda en la red de
>    casa, se la alcanza sin tocarle el WiFi a nadie y el AP sigue arriba para el teléfono.
> 2. **Pasarla a modo desarrollo desde la tarjeta**: crear `/Volumes/bootfs/SIN-AP` desde cualquier
>    computadora y arrancar. Es lo que se hizo el 2026-09-10.

**El primer arranque.** Un `firstrun.sh` lanzado una sola vez desde `systemd.run=` en `cmdline.txt`
(target mínimo, sin red) instala ese servicio, lo aplica para ese arranque y **se saca del
`cmdline.txt`** para no repetir el arranque mínimo. Log en `/var/log/virovision-firstrun.log`.

**El daemon no se reinstala solo.** `instalar-daemon.sh` está detrás de
`ConditionPathExists=!/var/lib/virovision-instalado`, y esa sentinela ya existe: descomprimir un
`virovision-daemon.tgz` nuevo en `bootfs` **no alcanza**. Y la sentinela vive en **ext4**, no en
`bootfs`, así que **no se borra desde macOS con la tarjeta puesta** — "meto la tarjeta en la Mac y
reinstalo" no es un camino posible.

Cómo se desplegó el 2026-09-10, que es el procedimiento probado:

```sh
# 1. Desde el Mac, con la tarjeta puesta: pasar la placa a modo desarrollo
touch /Volumes/bootfs/SIN-AP        # NO corregir todavía el flag: el daemon viejo sólo entiende --sin-ap

# 2. Arrancar la placa; se une a la WiFi de casa. Buscarla y entrar:
ssh virovision@<ip-en-la-red-de-casa>

# 3. En la PLACA: bajar staging de GitHub e instalar sobre el .venv ya armado.
#    No hace falta setup.sh ni apt mientras no cambien las dependencias — y así se
#    esquiva el apt que falla por el reloj sin RTC ("not live until") si NTP no sincronizó.
curl -fsSL https://codeload.github.com/juanlu-a/viro_vision/tar.gz/refs/heads/staging -o /tmp/vv.tgz
mkdir -p /tmp/vv-src && tar -xzf /tmp/vv.tgz -C /tmp/vv-src --strip-components=1 --wildcards '*/hardware/raspi/*'
sudo systemctl stop virovision
mv ~/virovision/virovision ~/virovision/virovision.old-$(date +%Y%m%d-%H%M%S)   # respaldo
cp -r /tmp/vv-src/hardware/raspi/virovision ~/virovision/virovision
~/virovision/.venv/bin/python -c 'import virovision.core'                        # que importe antes de arrancar

# 4. AHORA sí, los flags (los dos archivos) y el .tgz de bootfs
sudo sed -i 's/--sin-ap/--no-ap/g' /boot/firmware/modo-red.sh /boot/firmware/instalar-daemon.sh
sudo sed -i 's/--sin-ap/--no-ap/g' /etc/systemd/system/virovision.service.d/10-sin-ap.conf
tar -czf /tmp/vv-daemon.tgz -C /tmp/vv-src/hardware raspi && sudo cp /tmp/vv-daemon.tgz /boot/firmware/virovision-daemon.tgz

# 5. Verificar y volver a modo producto
sudo systemctl daemon-reload && sudo systemctl restart virovision
curl -s http://localhost:8080/health
sudo rm -f /boot/firmware/SIN-AP && sudo systemctl reboot
```

> ⚠️ **Si rehacés el `.tgz`, tiene que llevar `raspi/` ENTERO.** El instalador hace `tar xzf` y
> después `mv /home/virovision/raspi /home/virovision/virovision`, así que necesita `raspi/setup.sh`,
> `raspi/requirements.txt`, `raspi/virovision.service` y `raspi/virovision/`. Un `.tgz` armado sólo
> con el paquete Python instala un daemon a medias, y el síntoma aparece meses después sin nada que
> lo conecte con el día en que se armó mal. Verificá los cuatro antes de copiarlo a `bootfs`.

**Por qué nada de esto usa cloud-init como corresponde.** En esta imagen cloud-init lee
`network-config` y **no lo aplica** (`No network config applied. Neither a new instance nor
datasource network update allowed`; falta el módulo `cc_netplan_nm_patch`), así que el WiFi hay que
escribirlo a mano como keyfile de NetworkManager. Todo el andamiaje de arriba existe por eso.

## Emular la placa desde la Mac (sin hardware)

El mismo núcleo (`virovision/core.py`: comandos, modos, transferencias) se puede publicar por
CoreBluetooth desde una Mac con `bless`. Sirve para probar la app contra el perfil GATT real: conectar,
leer estado, cambiar de modo y reensamblar una transferencia. **El throughput contra la Mac no es el
de la placa** (otro chip, Bluetooth 5, otro stack): valida la app, no decide el ADR 0003.

```sh
cd hardware/raspi
python3.11 -m venv .venv-mac && .venv-mac/bin/pip install -r requirements-mac.txt   # python3 ≥ 3.9 sirve
.venv-mac/bin/python -m virovision.emulator -v
```

La primera vez macOS pide permiso de Bluetooth para la terminal (Privacidad y seguridad → Bluetooth).
Con el emulador corriendo, el iPhone ve «ViroVision» igual que vería la placa; la app se conecta con
*Buscar dispositivo* y *Medir transferencia* funciona de punta a punta. `--name ViroVision-Mac` si
la placa real está cerca y querés distinguirlas. Sin cámara: el comando `foto` responde con error, y
`medir` manda bytes sintéticos.

## Correr a mano (depurar)

```sh
sudo systemctl stop virovision
sudo .venv/bin/python -m virovision -v            # con cámara
sudo .venv/bin/python -m virovision -v --no-camera
```

Necesita root: BlueZ sólo deja registrar aplicaciones GATT y anuncios desde el bus del sistema.

## Perfil GATT

Servicio `4380c500-7ca3-4e37-b27d-f60e8d8d73d1`. Copiado a mano en
`app/src/features/device/gatt.ts`: **si cambia uno, cambia el otro en el mismo PR.**

| característica | UUID (…c5**XX**) | props | contenido |
|---|---|---|---|
| `mode` | 01 | read · notify · write | `uint8`: 0 esperando, 1 ómnibus, 2 supermercado |
| `control` | 02 | write · write w/o response | JSON con `cmd` (abajo) |
| `event` | 03 | notify | JSON ≤ 180 bytes |
| `transfer` | 04 | notify | binario: header 4 B (`seq` u16 LE, `total` u16 LE) + datos |
| `status` | 05 | read · notify | JSON: `version`, `temp`, `uptime`, `battery` (null), `camera`, `wifi`, `ip`, `port`, `ap` |
| `wifi` | 06 | read | JSON `{ssid, password, ip, port}` del punto de acceso; la app se une sola con esto |

Comandos de `control`:

| comando | efecto |
|---|---|
| `{"cmd":"measure","bytes":53000,"chunk":182,"interval_ms":0}` | manda `bytes` aleatorios por `transfer`. `chunk` = tamaño de notificación (default: MTU − 3); `interval_ms` = pausa entre chunks (default 0) |
| `{"cmd":"photo"}` | captura con la cámara (1024 px lado mayor, JPEG q70: lo mismo que la app manda a la nube) y la transfiere igual |
| `{"cmd":"mode","value":2}` | cambia de modo (equivale al botón) |
| `{"cmd":"status"}` | fuerza una notificación de `status` |
| `{"cmd":"ap","value":true,"minutes":10}` | enciende el punto de acceso por tiempo acotado (tope 60); `value:false` lo apaga |

Cada transferencia va envuelta en dos eventos: `{"t":"start","id":1,"kind":"measurement","bytes":53000,"chunks":298,"chunk":182}`
y `{"t":"end","id":1,...,"device_ms":N}`. **`device_ms` no es la medición**: es cuánto tardó la placa
en entregarle los chunks a BlueZ. El número que vale lo mide la app, del primer chunk al último.
`status` se notifica solo cada 15 s.

## Plan B: la foto por WiFi (HTTP) y el punto de acceso

Decidido el 2026-09-05 (ADR 0003, Actualización): por BLE la foto tarda 4,5 s; por WiFi, 46 ms. El
daemon levanta un **servidor HTTP** en el puerto 8080 (`--port`, `--no-http`) y publica su IP y
puerto en la característica `status` (`ip`, `port`, `ap`). La app siempre tira; la placa nunca empuja.

| ruta | qué hace |
|---|---|
| `GET /health` | el mismo JSON que `status` |
| `GET /measure/<bytes>` | `<bytes>` aleatorios (hasta 5 MB), para medir la descarga sin cámara |
| `GET /photos/latest` | captura ahora y devuelve el JPEG (1024 px, q70); 503 sin cámara |
| `POST /audio` | guarda el MP3/WAV en `/tmp/virovision-audio/` para reproducirlo; 202 con el tamaño. Con `X-Encoding: base64` decodifica el cuerpo (así lo manda la app: `fetch` de RN no envía bytes) |

Dos modos de red, y el que importa es el segundo:

1. **Placa y teléfono en la misma red WiFi** (casa, laboratorio): no hay que hacer nada; la app baja de
   la IP que informa `status`. Sirve para desarrollar y medir.
2. **Sin WiFi de infraestructura** (la calle, el supermercado): la placa levanta su **punto de acceso**
   `ViroVision` (clave `virovision2026`, IP `10.42.0.1`) con NetworkManager, y el teléfono se une. El
   teléfono conserva internet por datos (en iOS hay que verificarlo: es el spike que queda). La placa
   tiene una sola radio: con el AP arriba deja su red anterior y **se pierde el SSH**; por eso el AP
   se enciende siempre **por tiempo acotado** (default 10 min, tope 60) y vuelve solo a la red
   conocida. **El AP sigue al modo**: se enciende al entrar a ómnibus o supermercado (20 min de tope,
   renovados en cada cambio) y se apaga al volver a esperando. Comando manual:
   `{"cmd":"ap","valor":true,"minutos":10}` por `control`; `{"cmd":"ap","valor":false}` lo baja antes.
   Evento `{"t":"ap","on":…,"minutes":…}`, `status.ap`, y `status` vuelve a notificarse con la
   IP nueva (10.42.0.1) para que la app sepa de dónde bajar la foto.
   **El AP es una red sólo local**: `setup.sh` deja un drop-in de dnsmasq sin puerta de enlace ni DNS
   (opciones DHCP 3 y 6). Con el default de NetworkManager el iPhone quedaba sin internet; así
   conserva su ruta por datos móviles (medido el 2026-09-05).

Para probar el modo 2 sin la app: unirse desde Ajustes del teléfono al WiFi `ViroVision`, abrir
`http://10.42.0.1:8080/health` en el navegador, y comprobar que el teléfono sigue con internet (abrir
cualquier sitio). Desde la placa, a mano y con vuelta automática:

```sh
sudo systemd-run --unit=ap-prueba sh -c 'nmcli con up virovision-ap; sleep 600; nmcli con down virovision-ap'
```

`setup.sh` deja el WiFi sin ahorro de energía (`wifi.powersave = 2`): el primer GET tras un rato quieto
tardaba 153 ms contra 41-59 los siguientes.

## Cómo medir (spike ADR 0003)

Protocolo y tablas en [`docs/mediciones/2026-09-04-ble-throughput.md`](../../docs/mediciones/2026-09-04-ble-throughput.md).
En corto: app conectada → *Medir transferencia* → cinco corridas por tamaño (53, 35, 30, 15 KB) → con
el WiFi de la placa prendido y apagado (`sudo rfkill block wifi` / `unblock`; comparten antena) →
anotar el **rango**, no el promedio.

### Caveat: D-Bus (medido el 2026-09-05)

`bluez-peripheral` notifica con `PropertiesChanged` sobre D-Bus, un mensaje por chunk. **Sin pausa
entre chunks, dbus-next pierde mensajes**: el socket hacia bluetoothd se llena en ~250 ms, la
librería recibe `EAGAIN` (`BlockingIOError: Resource temporarily unavailable`) y descarta el resto.
Al receptor le llegaron 175 de 298 chunks y nunca el evento `fin`. Por eso `gatt.py` duerme 4 ms
entre notificaciones (`VIROVISION_PAUSA_MS` para experimentar); con 1 ms tampoco perdió. La pausa no
sesga la medición: el daemon entrega los 298 chunks en ~1,7 s y el aire tarda 4,5 s. El arreglo de
fondo sigue siendo `AcquireNotify` (un fd con backpressure real), pero ya no cambia la conclusión:
el techo de ~12 KB/s lo pone el controlador (sin DLE, 27 bytes por paquete de radio, 15 buffers) con
el intervalo de 15 ms de iOS.

### Otras lecciones de la primera instalación

- **BlueZ 5.82 expone `/org/bluez/test`**, y `Adapter.get_first` de bluez-peripheral lo toma por un
  adaptador y explota. El daemon toma `hci0` por su ruta (`--hci`).
- **`PYTHONUNBUFFERED=1` en el servicio**: las excepciones que bluez-peripheral imprime con `print()`
  no llegaban al journal hasta que el proceso moría.
- **iOS cachea la lista de características de la placa.** Cuando el perfil GATT gana una característica
  (el 2026-09-05, `wifi`), el iPhone puede seguir sirviéndole a la app la lista anterior: la app no
  la encuentra y el flujo falla sin error visible (el AP se levantaba y la app no se unía). Remedio:
  apagar y prender el Bluetooth del teléfono desde Ajustes. Cada vez que cambie el GATT, avisarlo
  en las notas del build.
- **Si el servicio se reinicia con el teléfono conectado**, la app puede seguir diciendo «Conectado»
  con el enlace muerto; desde el build del 2026-09-05 la app lo detecta y avisa. Con builds anteriores:
  Desconectar y Buscar dispositivo de nuevo.

## Botón físico (ADR 0007)

El único control en la placa. `virovision/button.py`; los modos que dispara viven en `modes.py`.

| Gesto | Efecto |
|---|---|
| 1 click desde *esperando* | modo ómnibus |
| 2 clicks desde *esperando* | modo supermercado |
| mantenerlo apretado | volver a *esperando*, desde cualquier modo |

Dentro de un modo los clicks cortos no hacen nada todavía: salir es siempre el click largo. Cada
transición se notifica por `mode` y `event` igual que si la hubiera pedido la app, así que **la app
no distingue** si el modo lo cambió el dedo del usuario o ella misma.

**Cableado**: pulsador entre **GPIO 5 (pin físico 29)** y **GND (pin 30, el de al lado)**. Pull-up
interno, sin resistencia externa. Con un tact switch de 4 patas hay que usar **dos patas en
diagonal**: las dos de una misma cara vienen unidas de fábrica y darían un botón apretado para
siempre. `--button-gpio N` para otro pin, `--no-button` para ignorarlo.

**Tiempos** (en `button.py`, todavía sin calibrar con el usuario):

| Constante | Valor | Por qué |
|---|---|---|
| `REBOTE_S` | 50 ms | el rebote de un tact switch 6x6 está en el orden de los 10 ms |
| `UMBRAL_LARGO_S` | 0,8 s | salir por accidente es peor que tener que insistir |
| `VENTANA_DOBLE_CLICK_S` | 0,4 s | es lo que tarda en aplicarse un click simple: el precio del doble click |

El botón es **opcional**: sin gpiozero, sin permisos sobre el pin o sin botón soldado, el daemon
arranca igual (log `sin botón físico`) y los modos entran por BLE. Una placa sin daemon sería peor.

## Problemas conocidos

- `BlueZ no está disponible en D-Bus`: `sudo systemctl start bluetooth` y revisar `rfkill list`.
- El iPhone ve `ViroVision` pero no conecta: borrar el dispositivo en *Ajustes → Bluetooth* del
  teléfono (iOS cachea el GATT viejo) y reiniciar el servicio.
- Sin cámara detectada: `libcamera-hello --list-cameras`; en Bookworm la Camera Module 3 va sin
  tocar `config.txt`. El daemon sigue igual sin cámara, sólo `foto` falla.
- `pip` se queja de *externally-managed-environment*: es que no se activó el venv; `setup.sh` instala
  siempre dentro de `.venv`.

## Tests (en la Mac)

```sh
cd hardware/raspi && pip install -r requirements-dev.txt && python3 -m pytest
```

Sólo lo puro: el partido en chunks, la máquina de modos y el núcleo de comandos (que es el mismo
código en la placa y en el emulador). Lo que habla con BlueZ se prueba en la placa; lo que habla con
CoreBluetooth, arrancando el emulador.

## Qué falta (en orden)

1. Salida de audio por DAC I2S y anuncios pregrabados de modo y de líneas de ómnibus (ADR 0003).
2. Pipeline de ómnibus en placa (Coral): detección → recorte → OCR.
3. Si la medición lo pide: AP WiFi con NetworkManager + servidor HTTP (`GET /fotos/{id}`, `POST /audio`).
4. Calibrar los tiempos del botón con el usuario (ver *Botón físico*): los actuales son una primera
   estimación, no una medición.
