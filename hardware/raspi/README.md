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

## Emular la placa desde la Mac (sin hardware)

El mismo núcleo (`virovision/nucleo.py`: comandos, modos, transferencias) se puede publicar por
CoreBluetooth desde una Mac con `bless`. Sirve para probar la app contra el perfil GATT real: conectar,
leer estado, cambiar de modo y reensamblar una transferencia. **El throughput contra la Mac no es el
de la placa** (otro chip, Bluetooth 5, otro stack): valida la app, no decide el ADR 0003.

```sh
cd hardware/raspi
python3.11 -m venv .venv-mac && .venv-mac/bin/pip install -r requirements-mac.txt   # python3 ≥ 3.9 sirve
.venv-mac/bin/python -m virovision.emulador -v
```

La primera vez macOS pide permiso de Bluetooth para la terminal (Privacidad y seguridad → Bluetooth).
Con el emulador corriendo, el iPhone ve «ViroVision» igual que vería la placa; la app se conecta con
*Buscar dispositivo* y *Medir transferencia* funciona de punta a punta. `--nombre ViroVision-Mac` si
la placa real está cerca y querés distinguirlas. Sin cámara: el comando `foto` responde con error, y
`medir` manda bytes sintéticos.

## Correr a mano (depurar)

```sh
sudo systemctl stop virovision
sudo .venv/bin/python -m virovision -v            # con cámara
sudo .venv/bin/python -m virovision -v --sin-camara
```

Necesita root: BlueZ sólo deja registrar aplicaciones GATT y anuncios desde el bus del sistema.

## Perfil GATT

Servicio `4380c500-7ca3-4e37-b27d-f60e8d8d73d1`. Copiado a mano en
`app/src/features/device/gatt.ts`: **si cambia uno, cambia el otro en el mismo PR.**

| característica | UUID (…c5**XX**) | props | contenido |
|---|---|---|---|
| `modo` | 01 | read · notify · write | `uint8`: 0 esperando, 1 ómnibus, 2 supermercado |
| `control` | 02 | write · write w/o response | JSON con `cmd` (abajo) |
| `evento` | 03 | notify | JSON ≤ 180 bytes |
| `transferencia` | 04 | notify | binario: header 4 B (`seq` u16 LE, `total` u16 LE) + datos |
| `estado` | 05 | read · notify | JSON: `version`, `temp`, `uptime`, `bateria` (null), `camara`, `wifi`, `ip`, `puerto`, `ap` |
| `wifi` | 06 | read | JSON `{ssid, clave, ip, puerto}` del punto de acceso; la app se une sola con esto |

Comandos de `control`:

| comando | efecto |
|---|---|
| `{"cmd":"medir","bytes":53000,"chunk":182,"intervalo_ms":0}` | manda `bytes` aleatorios por `transferencia`. `chunk` = tamaño de notificación (default: MTU − 3); `intervalo_ms` = pausa entre chunks (default 0) |
| `{"cmd":"foto"}` | captura con la cámara (1024 px lado mayor, JPEG q70: lo mismo que la app manda a la nube) y la transfiere igual |
| `{"cmd":"modo","valor":2}` | cambia de modo (equivale al botón) |
| `{"cmd":"estado"}` | fuerza una notificación de `estado` |
| `{"cmd":"ap","valor":true,"minutos":10}` | enciende el punto de acceso por tiempo acotado (tope 60); `valor:false` lo apaga |

Cada transferencia va envuelta en dos eventos: `{"t":"inicio","id":1,"tipo":"medicion","bytes":53000,"chunks":298,"chunk":182}`
y `{"t":"fin","id":1,...,"ms_placa":N}`. **`ms_placa` no es la medición**: es cuánto tardó la placa en
entregarle los chunks a BlueZ. El número que vale lo mide la app, del primer chunk al último.
`estado` se notifica solo cada 15 s.

## Plan B: la foto por WiFi (HTTP) y el punto de acceso

Decidido el 2026-09-05 (ADR 0003, Actualización): por BLE la foto tarda 4,5 s; por WiFi, 46 ms. El
daemon levanta un **servidor HTTP** en el puerto 8080 (`--puerto`, `--sin-http`) y publica su IP y
puerto en la característica `estado` (`ip`, `puerto`, `ap`). La app siempre tira; la placa nunca empuja.

| ruta | qué hace |
|---|---|
| `GET /salud` | el mismo JSON que `estado` |
| `GET /medir/<bytes>` | `<bytes>` aleatorios (hasta 5 MB), para medir la descarga sin cámara |
| `GET /fotos/ultima` | captura ahora y devuelve el JPEG (1024 px, q70); 503 sin cámara |
| `POST /audio` | guarda el MP3/WAV en `/tmp/virovision-audio/` para reproducirlo; 202 con el tamaño. Con `X-Encoding: base64` decodifica el cuerpo (así lo manda la app: `fetch` de RN no envía bytes) |

Dos modos de red, y el que importa es el segundo:

1. **Placa y teléfono en la misma red WiFi** (casa, laboratorio): no hay que hacer nada; la app baja de
   la IP que informa `estado`. Sirve para desarrollar y medir.
2. **Sin WiFi de infraestructura** (la calle, el supermercado): la placa levanta su **punto de acceso**
   `ViroVision` (clave `virovision2026`, IP `10.42.0.1`) con NetworkManager, y el teléfono se une. El
   teléfono conserva internet por datos (en iOS hay que verificarlo: es el spike que queda). La placa
   tiene una sola radio: con el AP arriba deja su red anterior y **se pierde el SSH**; por eso el AP
   se enciende siempre **por tiempo acotado** (default 10 min, tope 60) y vuelve solo a la red
   conocida. **El AP sigue al modo**: se enciende al entrar a ómnibus o supermercado (20 min de tope,
   renovados en cada cambio) y se apaga al volver a esperando. Comando manual:
   `{"cmd":"ap","valor":true,"minutos":10}` por `control`; `{"cmd":"ap","valor":false}` lo baja antes.
   Evento `{"t":"ap","encendido":…,"minutos":…}`, `estado.ap`, y `estado` vuelve a notificarse con la
   IP nueva (10.42.0.1) para que la app sepa de dónde bajar la foto.
   **El AP es una red sólo local**: `setup.sh` deja un drop-in de dnsmasq sin puerta de enlace ni DNS
   (opciones DHCP 3 y 6). Con el default de NetworkManager el iPhone quedaba sin internet; así
   conserva su ruta por datos móviles (medido el 2026-09-05).

Para probar el modo 2 sin la app: unirse desde Ajustes del teléfono al WiFi `ViroVision`, abrir
`http://10.42.0.1:8080/salud` en el navegador, y comprobar que el teléfono sigue con internet (abrir
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
- **Si el servicio se reinicia con el teléfono conectado**, la app puede seguir diciendo «Conectado»
  con el enlace muerto; desde el build del 2026-09-05 la app lo detecta y avisa. Con builds anteriores:
  Desconectar y Buscar dispositivo de nuevo.

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

1. Botón físico (GPIO) → `MaquinaDeModos.desde_clicks` / `click_largo`, con debounce medido.
2. Salida de audio por DAC I2S y anuncios pregrabados de modo y de líneas de ómnibus (ADR 0003).
3. Pipeline de ómnibus en placa (Coral): detección → recorte → OCR.
4. Si la medición lo pide: AP WiFi con NetworkManager + servidor HTTP (`GET /fotos/{id}`, `POST /audio`).
