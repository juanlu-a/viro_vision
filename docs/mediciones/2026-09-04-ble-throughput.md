# Medición — throughput BLE placa → teléfono y tamaño de foto (spike 0 del ADR 0003)

**Estado: protocolo listo, sin correr.** Las tablas se completan con la placa y el iPhone reales.
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

## Tabla A — throughput BLE

| bytes | teléfono | WiFi placa | MTU | corridas (ms) | mediana | rango | KB/s (mediana) |
|---|---|---|---|---|---|---|---|
| 53 000 | iPhone | apagado | | | | | |
| 53 000 | iPhone | prendido | | | | | |
| 35 000 | iPhone | apagado | | | | | |
| 30 000 | iPhone | apagado | | | | | |
| 15 000 | iPhone | apagado | | | | | |
| 53 000 | Android | apagado | | | | | |

**Umbral:** 53 000 bytes con mediana < 2000 ms ⇒ BLE alcanza.

## Tabla B — precisión según tamaño de foto (fotos reales de góndola)

Con el modelo por defecto (Luna), el botón **Elegir foto de la fototeca**, y el mismo set de fotos
reales del paso 8 de `qa-modo-supermercado.md`. Variar `LADO_MAYOR_MAX` en
`app/src/services/camera/redimension.ts` en un build local. Acierto = tipo y marca correctos.

| lado mayor | peso medio | fotos | acierto tipo | acierto marca | detalle legible |
|---|---|---|---|---|---|
| 1024 px | | | | | |
| 768 px | | | | | |
| 640 px | | | | | |

## Decisión

Se completa al final:

- Throughput medido (mediana y rango a 53 KB, WiFi apagado): …
- ¿Cumple el umbral? …
- Tamaño de foto más chico sin perder precisión: …
- **Transporte de la foto:** BLE / WiFi (plan B del ADR 0003), porque …

Al cerrar, agregar la sección `## Actualización 2026-MM-DD` al ADR 0003 con estas cuatro líneas.
