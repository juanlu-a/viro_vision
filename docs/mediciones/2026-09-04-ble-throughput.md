# Medición — throughput BLE placa → teléfono y tamaño de foto (spike 0 del ADR 0003)

**Estado (2026-09-05): medición cerrada para iPhone.** Diez corridas reales (cinco con el WiFi de la
placa prendido, cinco apagado) y una referencia de WiFi. **No cumple el umbral: la foto va por WiFi.**
Decide el transporte de la foto en el modo supermercado
([ADR 0003](../architecture/adr/0003-enlace-placa-telefono.md)).

## La pregunta

¿La foto que hoy sube a la nube (**53 KB**: 1024 px de lado mayor, JPEG 0,7) baja de la placa al
teléfono por BLE en **menos de 2 s** (≥ ~27 KB/s)? Si sí, BLE alcanza y no hay WiFi. Si no, hay WiFi.

Y la segunda variable: si la foto se puede achicar **sin perder precisión sobre fotos reales de
góndola**, cuánto baja el tiempo (la transferencia es lineal en bytes; el LLM no se acelera, medido
el 02/09).

## Montaje

- Placa: Raspberry Pi Zero 2 W, Raspberry Pi OS Lite 64-bit (Bookworm), daemon de
  [`hardware/raspi/`](../../hardware/raspi/README.md) corriendo como servicio. Anotar `bluetoothctl --version`
  y `uname -r`.
- Teléfono: iPhone con development build de la app (`docs/dev-build-ios.md`), y Android si hay.
  Anotar modelo y versión del sistema.
- Distancia: ~1 m, sin obstáculos, como en el uso real (la placa en la patilla, el teléfono en el
  bolsillo o la mano).
- `EXPO_PUBLIC_SIMULATE_DEVICE` vacío o en 0 en el build; si no, la app usa el dispositivo simulado.

## Protocolo

1. Conectar desde la pestaña **Dispositivo**. Anotar el MTU negociado (el resultado dice "paquetes de
   N bytes": N + 3 es el MTU).
2. **Medir transferencia** cinco veces por fila, con al menos 10 s entre corridas. Anotar los cinco
   valores en ms; la mediana y el rango se derivan. **Se reporta el rango, no el promedio**: en la
   campaña del 02/09 una sola corrida cayó en el extremo bueno y se leyó como el comportamiento.
3. Repetir con el **WiFi de la placa apagado** (`sudo rfkill block wifi`) y prendido
   (`sudo rfkill unblock wifi`, asociado a una red). Comparten antena: la diferencia es el costo de
   coexistencia que pagaría el plan B.
4. Para los otros tamaños, mandar el comando a mano (nRF Connect → `control`, texto) o cambiar
   `BYTES_FOTO_REFERENCIA` en un build local: `{"cmd":"medir","bytes":35000}`, `30000`, `15000`.
5. Si el mejor resultado da menos de ~15 KB/s, **antes de concluir** repetir con la variante
   `AcquireNotify` del daemon (ver caveat en el README de la placa): el cuello podría ser D-Bus y no
   la radio.

## Resultados parciales (2026-09-05)

Placa: Zero 2 W, Raspberry Pi OS 2026-06-18 (Debian 13 Trixie), kernel 6.18, BlueZ 5.82, Python 3.13,
daemon `4ebcf0a`+. Controlador BCM43438: **sin Data Length Extension** (LE features `0x1F`, bit 5 en
cero) → paquetes de radio de 27 bytes; 15 buffers ACL de 27 bytes. iOS negocia ATT MTU 185 y un
intervalo de conexión de 15 ms.

| receptor | bytes | chunk | WiFi placa | ms | KB/s | chunks perdidos |
|---|---|---|---|---|---|---|
| **iPhone (app TestFlight), 5 corridas** | 53 000 | 182 | prendido | **mediana 4 440** (4 080-6 150) | **11,9** (8,6-13,0) | 0 |
| Mac (bleak) | 53 000 | 182 | prendido | 4 245 | 12,5 | 0 |
| Mac (bleak) | 30 000 | 182 | prendido | 2 477 | 12,1 | 0 |
| Mac (bleak), pausa 1 ms | 30 000 | 182 | prendido | 3 210 | 9,3 | 0 |
| Mac (bleak), pausa 1 ms | 30 000 | 95 | prendido | 3 627 | 8,3 | 0 |
| Mac (bleak), pausa 1 ms | 30 000 | 47 | prendido | 3 767 | 8,0 | 0 |
| Mac (bleak), pausa 4 ms | 30 000 | 23 | prendido | 9 166 | 3,3 | 0 |

Lecturas:

- **11,8 KB/s es exactamente una notificación de 182 bytes por intervalo de 15 ms** (182 / 0,015 =
  12,1 KB/s). Con iPhone y con Mac da lo mismo: el techo lo pone el enlace, no el receptor.
- **Achicar el chunk no ayuda**: 95 y 47 bytes dan menos, no más. La hipótesis de "más
  notificaciones por evento con chunks chicos" queda descartada en este controlador.
- **El daemon no es el cuello** una vez resuelta la pérdida por D-Bus: entrega los 298 chunks en
  ~1,7 s (pausa de 4 ms) y el aire tarda 4,2 a 4,5 s. Sin pausa, dbus-next pierde chunks (llegaron
  175 de 298 y nunca el `fin`); con 1 ms no perdió ninguno en tres corridas.
- **53 KB en 4,5 s está más del doble por encima del umbral de 2 s**, con diez corridas. El ADR
  0003 va al plan B (WiFi para la foto). La única palanca que queda del lado BLE es Android con
  intervalo de 7,5 ms (el doble), que no sirve para iOS y tampoco llegaría a 2 s.

## Tabla A — throughput BLE

| bytes | teléfono | WiFi placa | MTU | corridas (ms) | mediana | rango | KB/s (mediana) |
|---|---|---|---|---|---|---|---|
| 53 000 | iPhone | apagado | 185 | 3580, 3660, 4470, 4520, 5010 | **4470** | 3580-5010 | **11,8** |
| 53 000 | iPhone | prendido | 185 | 4080, 4260, 4440, 4490, 6150 | **4440** | 4080-6150 | **11,9** |
| 35 000 | iPhone | apagado | | | | | |
| 30 000 | iPhone | apagado | | | | | |
| 15 000 | iPhone | apagado | | | | | |
| 53 000 | Android | apagado | | | | | |

**Umbral:** 53 000 bytes con mediana < 2000 ms ⇒ BLE alcanza. **Resultado: 4440-4470 ms. No alcanza,
por más del doble.** El WiFi de la placa prendido o apagado no mueve la mediana; sólo ensancha el rango.

### Plan B probado de punta a punta (2026-09-05, más tarde)

Con el PR #61: la app lee por BLE la dirección de la placa (`estado.ip`) y baja los 53 KB por HTTP.

| escenario | corridas (s) | mediana | nota |
|---|---|---|---|
| iPhone y placa en la **misma red** WiFi de casa | 2,24 · 0,04 · 0,05 | 0,05 | la primera es el aviso de permiso de red local de iOS |
| iPhone unido al **AP de la placa** (`ViroVision`, 10.42.0.1), datos móviles | 0,34 · 0,44 · 0,05 · 0,06 · 1,03 | 0,34 | caso real: sin WiFi de infraestructura |
| ídem, BLE en la misma sesión, para comparar | ~4 | 4 | igual que las diez corridas de arriba |

**El requisito duro del plan B se cumplió, pero recién al segundo intento.** Con el AP tal como lo
crea NetworkManager (`ipv4.method shared`), el DHCP anuncia la placa como router y DNS: el iPhone
unido a `ViroVision` **quedaba sin internet** (Safari: "sin conexión"), y el modo supermercado con él.
Con un drop-in de dnsmasq que quita las opciones 3 (router) y 6 (DNS), la red es **sólo local**, el
teléfono conserva su ruta por defecto por datos, y **Safari carga, la lectura de supermercado
funciona y la foto baja en menos de medio segundo, todo con el iPhone unido a la placa**. Está en
`setup.sh` (`/etc/NetworkManager/dnsmasq-shared.d/10-virovision-solo-local.conf`).

Conclusión: **el híbrido BLE (control) + WiFi (payload) queda validado en el caso real.** Lo que
falta es que la app se una al AP sola y que el AP viva con los modos; ver el ADR.

### Referencia WiFi (mismo archivo, misma placa, 2026-09-05)

53 000 bytes servidos por HTTP desde la placa y bajados desde la Mac en la misma red doméstica
(no es el AP del plan B, pero es la misma radio y el mismo tamaño): **153, 41, 46, 59, 43 ms**,
mediana **46 ms**, unas **100 veces** más rápido que BLE. El primer valor alto es el despertar del
ahorro de energía del WiFi de la placa; en el plan B conviene apagarlo mientras un modo esté activo.

## Tabla B — precisión según tamaño de foto (fotos reales de góndola)

Con el modelo por defecto (Luna), el botón **Elegir foto de la fototeca**, y el mismo set de fotos
reales del paso 8 de `qa-modo-supermercado.md`. Variar `LADO_MAYOR_MAX` en
`app/src/services/camera/redimension.ts` en un build local. Acierto = tipo y marca correctos.

| lado mayor | peso medio | fotos | acierto tipo | acierto marca | detalle legible |
|---|---|---|---|---|---|
| 1024 px | | | | | |
| 768 px | | | | | |
| 640 px | | | | | |

## Decisión (2026-09-05)

- Throughput medido a 53 KB, WiFi de la placa apagado: **mediana 4470 ms, rango 3580-5010 (11,8 KB/s)**.
  Prendido: 4440 ms, 4080-6150.
- ¿Cumple el umbral de 2000 ms? **No**, por un factor de 2,2. Y no es del daemon ni del receptor: es
  una notificación por intervalo de 15 ms, en un controlador sin DLE. La Mac da lo mismo.
- Tamaño de foto más chico sin perder precisión: **pendiente** (Tabla B). Ya no decide el transporte:
  ni a 30 KB (2,5 s medidos) BLE entra en el presupuesto.
- **Transporte de la foto: WiFi (plan B del ADR 0003).** BLE queda como plano de control, siempre
  vivo, como estaba decidido. Referencia WiFi: 46 ms por la misma foto.

La `## Actualización 2026-09-05` del ADR 0003 recoge estas líneas.
