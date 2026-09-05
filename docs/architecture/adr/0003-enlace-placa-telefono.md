# ADR 0003 — Enlace placa ↔ teléfono: BLE como plano de control, la foto se decide midiendo

- **Status:** Proposed (2026-09-04) — **actualizado 2026-09-05: la medición cerró el transporte de la
  foto: WiFi (plan B)**. Falta validar con el tutor
- **Date:** 2026-09-04
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** hardware, app, architecture, ble, wifi
- **Relates to:** [ADR 0001](0001-offline-first-on-device-inference.md),
  [ADR 0006](0006-pipelines-por-caso-de-uso.md),
  [ADR 0007](0007-botones-fisicos-modos-de-operacion.md)

## Contexto

El 2026-09-04 el equipo fijó dónde corre cada cosa:

- **Modo ómnibus: entero en la placa** (caso B del diagrama canónico en
  [`architecture/README.md`](../README.md)): detección y OCR cuantizados sobre la Zero 2 W + Coral,
  anuncio por el parlante de la placa. El teléfono no participa. Es el caso que mejor cumple ADR 0001.
- **Modo supermercado: la placa captura, el teléfono procesa.** La placa manda la foto al teléfono,
  la app llama al LLM con visión (ADR 0006, vía el proxy de ADR 0008) y devuelve el resultado, como
  JSON o como audio, para reproducirlo en el auricular de la placa.

Hay que definir **el enlace placa ↔ teléfono** con tres restricciones que puso el equipo:

1. **La mínima cantidad de software** en la placa.
2. **Sin cifrar el payload**: los datos no son sensibles y TLS agrega latencia y código.
3. **Presupuesto de tiempo en supermercado: 3 a 4 s** desde que el usuario dispara la foto hasta que
   empieza el audio. El usuario está quieto frente a la góndola; no es el ómnibus que se mueve.

Y una pregunta concreta: **¿vale la pena WiFi para el payload, o alcanza BLE?** La Zero 2 W trae las
dos radios en el mismo chip (BCM43436/8: WiFi 2,4 GHz, Bluetooth 4.2) y comparten antena.

### Lo que ya está medido y cambia la cuenta

| dato | valor | fuente |
|---|---|---|
| foto que hoy sube a la nube | **~53 KB** (1024 px lado mayor, JPEG 0,7) | `docs/mediciones/2026-09-02-modelos-supermercado.md`, Resultado 4 |
| lo mismo a 768 / 640 / 384 px | ~35 / 30 / 15 KB | ídem |
| latencia del LLM | mediana 1,7 s (Luna, default) / 0,85 s (Qwen) | ídem, Resultado 1 |
| latencia del LLM según tamaño de foto | **no baja** con la foto más chica: las medianas no ordenan | ídem, Resultado 4 |
| TTS a MP3 en la nube (`gpt-4o-mini-tts`) | ~1 a 1,5 s; MP3 de ~12 KB | ADR 0006, `services/audio/sintesis.ts` |
| throughput BLE de la Zero 2 W hacia un iPhone | **sin medir** | — |

Throughput BLE típico de este chip (Bluetooth 4.2, sin 2M PHY) con notificaciones GATT hacia iOS:
**10 a 20 KB/s**, con reportes de hasta ~30 KB/s bien afinado. Es un número de terceros sobre el
mismo chip en una Pi 3; **no es nuestro** y por eso la decisión se posterga a medirlo.

### Presupuesto de tiempo (disparo → audio)

| etapa | sólo BLE | BLE + WiFi |
|---|---|---|
| foto de 53 KB, placa → teléfono | 2,7-5,3 s a 10-20 KB/s; 1,8 s a 30 KB/s | ~0,1 s |
| LLM (mediana Luna / Qwen) | 1,7 / 0,85 s | 1,7 / 0,85 s |
| TTS en la nube a MP3 | ~1 a 1,5 s | ~1 a 1,5 s |
| audio de ~12 KB, teléfono → placa | 0,6-1,2 s | ~0,05 s |
| **total** | **~6 a 9 s; ~4,5 s en el mejor caso** | **~3 a 3,5 s; ~2,5 s con Qwen** |

La transferencia no se solapa con nada: la foto tiene que llegar entera antes de llamar al modelo.
Todo el exceso de "sólo BLE" es transferencia.

**El tamaño de la foto es la palanca principal sobre BLE, y ninguna sobre WiFi.** La transferencia
es lineal en bytes; el LLM no se acelera con la foto más chica. A 640 px (30 KB) y 15 KB/s la foto
tarda 2 s y el total queda en ~5 a 5,5 s; a 30 KB/s entra en 4 s sin WiFi. **Pero** el acierto 3/3 a
384 px del 02/09 fue sobre una imagen sintética con texto de 90 px y contraste máximo; una góndola
real tiene el peso neto en cuerpo 8 y reflejos. Bajar el techo exige medir precisión con fotos
reales.

## Decisión

### 1. Software de la placa: Raspberry Pi OS Lite + un servicio

No hay camino sin Linux en la Zero 2 W: la Camera Module 3 necesita libcamera, el Coral necesita
libedgetpu sobre libusb, y BLE necesita BlueZ. Lo mínimo honesto es **Raspberry Pi OS Lite 64-bit,
sin escritorio, y un único servicio de systemd** con un daemon Python asyncio (picamera2,
tflite/pycoral, gpiozero y BlueZ por D-Bus son Python-first; lo pesado corre en librerías nativas
igual). El hotspot WiFi, si hace falta, lo da NetworkManager que ya viene. Buildroot/Yocto sólo si el
arranque de 20 a 30 s molesta, y antes de eso se resuelve con una señal de audio de "listo". Más
adelante, raíz de sólo lectura (overlayfs) para que un corte de batería no rompa la SD.

El código vive en [`hardware/raspi/`](../../../hardware/raspi/README.md).

### 2. BLE (GATT) es el plano de control, siempre vivo

Independientemente de por dónde viaje la foto, **BLE queda conectado siempre** y lleva modo,
comandos, eventos y resultados. La razón fuerte no es el consumo: **el usuario lleva el teléfono
bloqueado en el bolsillo**, y en iOS un socket WiFi no puede despertar una app; una notificación
GATT sí (modo de fondo `bluetooth-central`). El ciclo entero de supermercado, entonces, es: botón en
la placa → notificación BLE despierta la app → la app tiene unos segundos de ejecución en segundo
plano para bajar la foto, llamar a la nube, sintetizar y devolver el audio.

Perfil GATT (servicio `4380c500-7ca3-4e37-b27d-f60e8d8d73d1`, UUIDs de 128 bits generados al azar; los
placeholders `0000fffX` que había en la app eran del rango de 16 bits reservado al Bluetooth SIG):

| característica | props | contenido |
|---|---|---|
| `modo` | read · notify · write | uint8: 0 esperando, 1 ómnibus, 2 supermercado (ADR 0007) |
| `control` | write | JSON `{cmd: medir \| foto \| modo \| estado, …}` |
| `evento` | notify | JSON ≤ 180 bytes: inicio/fin de transferencia, cambio de modo, error, resultado |
| `transferencia` | notify | binario: header de 4 bytes (`seq` u16 LE, `total` u16 LE) + datos |
| `estado` | read · notify | JSON: versión, temperatura, uptime, batería (null hoy), cámara, wifi |
| `wifi` | read | **reservada** para el plan B: SSID, clave, IP y puerto del AP de la placa |

El perfil está duplicado a mano en `hardware/raspi/virovision/gatt.py` y
`app/src/features/device/gatt.ts`, con el aviso en los dos lados.

### 3. El transporte de la foto se decide midiendo, con umbral escrito

**Umbral: si los 53 KB de la foto de referencia bajan por BLE en menos de 2 s (≥ ~27 KB/s), no hay
WiFi. Si no, la placa levanta un AP WiFi para la foto (plan B).** La medición es el spike 0, con
protocolo y tablas en [`docs/mediciones/2026-09-04-ble-throughput.md`](../../mediciones/2026-09-04-ble-throughput.md).
Mide **dos variables**, porque las dos deciden: throughput BLE a 53 / 35 / 30 / 15 KB, y precisión
del modelo con fotos reales de góndola a 1024 / 768 / 640 px. BLE se construye igual en los dos
escenarios, así que medir primero no cuesta software de más, y cierra además la "comparación de
protocolos" que la tesis tiene marcada como `PENDIENTE`.

Al cerrar la medición este ADR recibe una sección `## Actualización` con el rango medido y la
decisión final.

### 4. Plan B WiFi, diseñado ahora para no rediseñar después

Si el umbral no se cumple:

- **La placa es el punto de acceso**, con SSID y clave fijos por unidad, IP fija y DHCP, todo con
  NetworkManager (`nmcli device wifi hotspot`). El teléfono se une; **no al revés** (ver
  alternativas). La placa no necesita internet en ningún caso.
- **BLE lleva las credenciales**: la app lee la característica `wifi` y se une con la API del sistema
  (`NEHotspotConfigurationManager` en iOS, con un aviso una sola vez; `WifiNetworkSpecifier` en
  Android, que además mantiene datos móviles para internet). Requiere `NSLocalNetworkUsageDescription`
  y la excepción ATS `NSAllowsLocalNetworking`.
- **HTTP plano en la placa**, sin TLS: `GET /fotos/{id}` (JPEG ya reducido), `POST /audio` (MP3 a
  reproducir), `GET /salud`. WPA2 ya cifra el aire; la app usa `fetch` sin dependencias nuevas. **La
  app siempre tira, la placa nunca empuja**: así el teléfono no necesita servidor HTTP.
- El AP puede levantarse sólo con un modo activo y apagarse en *esperando*, para no gastar batería
  anunciando una red que nadie usa.

### 5. Qué vuelve al auricular, según el modo

- **Supermercado → audio ya sintetizado.** Reusa el TTS del teléfono y el MP3 que ADR 0006 dejó
  implementado detrás de `EXPO_PUBLIC_AUDIO_FILE_ENABLED`; la placa sólo reproduce un archivo. Por
  el mismo transporte que trajo la foto. Si no hay enlace tampoco hubo foto: no hace falta un camino
  degradado. El JSON del resultado viaja igual por BLE para que la app lo muestre y lo registre.
- **Ómnibus → anuncios pregrabados en la SD.** La placa tiene que hablar sin teléfono, y las líneas
  de Montevideo son un conjunto finito: pregrabar cada anuncio con una voz buena da latencia cero y
  no exige correr un TTS en 512 MB de RAM. Los avisos de sistema (cambio de modo, "sin conexión con
  el teléfono", "listo") también pregrabados.
- **Palanca pendiente de medir**: TTS en la placa (Piper, voces en español) para supermercado costaría
  parecido a la nube (~1 a 1,5 s) pero sacaría la vuelta del audio y una dependencia. No se decide acá.

### 6. Salida de audio de la placa: DAC I2S cableado

La Zero 2 W no tiene jack. **DAC I2S con amplificador** (MAX98357A o PCM5102A) a un auricular
cableado. Descartado A2DP desde la placa: BLE, WiFi y audio Bluetooth compartirían el mismo chip y la
misma antena, y eso produce cortes de audio; además A2DP suma 150 a 250 ms de codificación. USB está
ocupado por el Coral. Esto reemplaza el "Bluetooth Classic (A2DP/HFP) o cableado" que decían los
documentos hasta hoy.

## Alternativas consideradas

- **Hotspot del teléfono y la placa como cliente.** Rechazado. En iOS la app no puede encender el
  hotspot; el usuario tiene que activar además "Maximizar compatibilidad" porque la placa es sólo
  2,4 GHz; y el hotspot deja de ser visible a los pocos segundos si nadie está conectado. Para una
  persona ciega es una trampa. En Android existe `LocalOnlyHotspot`, pero no da lo mismo en las dos
  plataformas.
- **Wi-Fi Direct / Wi-Fi Aware.** No existen en iOS (Multipeer Connectivity es sólo Apple).
- **Sólo BLE, sin medir.** Con 53 KB y 10 a 20 KB/s el total da 6 a 9 s, el doble del presupuesto.
  Podría cerrar con 640 px y 30 KB/s, pero ninguno de los dos números está probado. De ahí el umbral.
- **BLE con L2CAP CoC** (canal orientado a conexión, 2 a 3× el throughput de GATT). `react-native-ble-plx`
  no lo soporta, y sobre Bluetooth 4.2 sin 2M PHY tampoco alcanza los 27 KB/s con margen. Más
  software, no menos.
- **Decidir WiFi ahora.** Menos incertidumbre, pero paga desde el día uno el costo que no está en la
  placa sino en la app: módulo nativo para unirse a la red, permiso de red local en iOS, el riesgo
  de "WiFi sin internet" y algo de batería. Se paga sólo si la medición lo pide.
- **A2DP desde la placa al auricular Bluetooth.** Ver §6.
- **Imagen Buildroot/Yocto.** Arranque de ~5 s en vez de ~25 s, a cambio de mantener una distro
  propia. No para una tesis; queda como optimización si el arranque resulta un problema de uso.

## Consecuencias

### Positivas

- La app puede despertarse con el teléfono en el bolsillo: BLE siempre vivo es lo único que lo permite.
- Se construye una sola vez lo que hace falta en los dos escenarios (BLE + GATT), y la medición que
  decide el resto es un deliverable de la tesis.
- La placa lleva un solo proceso y ningún secreto: sin TLS, sin claves, sin cuenta.
- Los dos casos de ómnibus del diagrama canónico quedan resueltos en B; A deja de estar en stand by.

### Costos / riesgos — cada uno es un spike con criterio

0. **Throughput BLE real** (este PR lo deja listo para correr): 53 KB en < 2 s ⇒ sin WiFi.
   Caveat: `bluez-peripheral` notifica por `PropertiesChanged` en D-Bus, un mensaje por chunk; si la
   v1 da < 15 KB/s hay que repetir con `AcquireNotify` antes de concluir. Medir con el WiFi de la
   placa apagado y prendido: comparten antena.
1. **Segundo plano en iOS**: con la pantalla bloqueada, una notificación BLE despierta la app y el
   ciclo completo (foto → nube → TTS → audio a la placa) termina antes de que iOS la suspenda. Con
   las medianas medidas entra, pero hay que verlo. Hasta entonces el plugin de ble-plx queda con
   `isBackgroundEnabled: false`.
2. **Sólo si hay WiFi**: iOS unido a un WiFi sin internet enruta el HTTPS del proxy por datos móviles.
   Funciona en general; hay que verlo con nuestra app.
3. **Coexistencia BLE/WiFi** en el BCM43438: jitter en las notificaciones durante una transferencia.
4. **libedgetpu/pycoral en Bookworm**: los paquetes oficiales quedaron en Python 3.9; hay builds de la
   comunidad. No es de este ADR pero condiciona la "mínima cantidad de software" del pilar.

## Implicaciones para el código actual

- `app/src/features/device/gatt.ts`: UUIDs de 128 bits y las características nuevas (hecho en este PR).
- `app/src/services/ble/`: cliente real sobre `react-native-ble-plx` detrás del selector, módulo puro
  de reensamblado y medición con tests, botón «Medir transferencia» en Dispositivo que anuncia el
  resultado por voz (hecho en este PR).
- `hardware/raspi/`: daemon con el GATT, la transferencia medible, captura con picamera2 y la máquina
  de modos de ADR 0007 (hecho en este PR). Faltan botón GPIO, DAC y anuncios pregrabados.
- `app.json`: sin cambios de permisos; `isBackgroundEnabled` sigue en `false` hasta el spike 1.
- Si gana el plan B: característica `wifi` en los dos lados, módulo nativo para unirse a la red,
  `NSLocalNetworkUsageDescription` + `NSAllowsLocalNetworking`, hotspot + servidor HTTP en la placa.

## Actualización 2026-09-05 — La medición decidió: la foto va por WiFi

Se corrió el spike 0 con la placa real (Raspberry Pi OS 2026-06-18, Trixie, BlueZ 5.82) y el build de
TestFlight del día. Diez corridas en iPhone, cinco con el WiFi de la placa prendido y cinco apagado:

| WiFi de la placa | mediana | rango | KB/s |
|---|---|---|---|
| apagado | **4,47 s** | 3,58-5,01 | 11,8 |
| prendido | **4,44 s** | 4,08-6,15 | 11,9 |

**53 KB tardan 4,5 s: 2,2 veces el umbral de 2 s.** No es del daemon (entrega los 298 chunks en
1,7 s) ni del receptor (la Mac da 12,5 KB/s): es **una notificación de 182 bytes por intervalo de
conexión de 15 ms**, el mínimo que acepta iOS. El controlador BCM43438 **no tiene Data Length
Extension** (paquetes de radio de 27 bytes, 15 buffers ACL), y chunks más chicos rinden menos, no más.
El caveat de D-Bus resultó real pero de otra forma: sin pausa, dbus-next **pierde** chunks; con una
pausa de 4 ms no pierde ninguno y no es el cuello. Como referencia, el mismo archivo por HTTP sobre la
misma radio WiFi baja en 46 ms. Detalle en `docs/mediciones/2026-09-04-ble-throughput.md`.

**Decisión:** transporte de la foto por **WiFi, según el plan B de §4**: la placa como AP, credenciales
por BLE, HTTP plano, la app siempre tira. **BLE sigue siendo el plano de control siempre vivo** (§2), y
todo lo demás del ADR queda como estaba. La Tabla B (precisión por tamaño de foto) deja de decidir el
transporte y pasa a ser una optimización de tokens y tráfico, como ya decía la medición del 02/09.

Consecuencias inmediatas: se ejecuta la lista de §Implicaciones "si gana el plan B": característica
`wifi` en los dos lados, módulo nativo para unirse a la red (`NEHotspotConfigurationManager` /
`WifiNetworkSpecifier`), `NSLocalNetworkUsageDescription` + `NSAllowsLocalNetworking`, hotspot con
NetworkManager y servidor HTTP en la placa. Y el spike 2 (iOS en un WiFi sin internet enruta el HTTPS
del proxy por datos móviles) pasa a ser el primero de la lista. El AP se levanta sólo con un modo
activo: el primer `GET` tras despertar el WiFi de la placa tardó 153 ms contra 41-59 los siguientes.

## Actualización 2026-09-05 (2) — El plan B probado en el caso real: funciona, con una condición

Mismo día, con el PR #61 (servidor HTTP en la placa, AP con NetworkManager, «Medir por WiFi» en la
app). iPhone **unido al AP de la placa**, sin ninguna otra red, con datos móviles:

- Foto de 53 KB por HTTP: 0,05 a 1,03 s, mediana **0,34 s** (misma sesión por BLE: ~4 s).
- **Safari carga y la lectura de supermercado funciona** con el teléfono unido a la placa: el
  teléfono conserva internet por datos. Era el spike 2, y era el requisito duro del equipo.
- **La condición**: el AP tiene que ser una red **sólo local**. Con el DHCP anunciando la placa como
  router y DNS (lo que hace NetworkManager por defecto en modo `shared`), iOS quedaba **sin internet**.
  Quitar las opciones DHCP 3 y 6 lo resuelve; está en `setup.sh`. Es una regla del diseño, no un
  ajuste: **la placa nunca se anuncia como salida a internet.**

**El híbrido queda confirmado como diseño**: BLE es el plano de control siempre vivo (despierta la app,
lleva botón, modo, eventos, resultados y credenciales) y WiFi lleva sólo el payload, a demanda. Es el
patrón de las cámaras vestibles y de acción que mueven fotos al teléfono. Presupuesto del ciclo de
supermercado: ~50 ms de foto + ~1,5 s de nube + 1 a 1,5 s de TTS + ~50 ms de audio ≈ **3 s**.

Queda para el PR siguiente: (1) la app se une al AP sola (`NEHotspotConfigurationManager` /
`WifiNetworkSpecifier`) con las credenciales de la característica `wifi`; (2) el AP vive con los
modos: arriba con un modo activo, abajo en *esperando*, siempre con tope de tiempo; (3) el audio de
vuelta por `POST /audio` al parlante; (4) el spike 1, segundo plano en iOS. Y una deuda del día:
el AP levantado con un temporizador externo (`systemd-run`) no arrancó en un intento y no quedó
registro de por qué; el camino que vale es el comando `ap` del daemon, que trae su propio tope.

## Ver también

- Diagrama canónico y flujos por caso de uso: [`architecture/README.md`](../README.md).
- Protocolo de la medición: [`docs/mediciones/2026-09-04-ble-throughput.md`](../../mediciones/2026-09-04-ble-throughput.md).
- Instalación y perfil de la placa: [`hardware/raspi/README.md`](../../../hardware/raspi/README.md).
