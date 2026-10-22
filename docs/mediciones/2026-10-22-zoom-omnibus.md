# Medición: el zoom digital del modo ómnibus, en la placa

**Estado (2026-10-22): medición de banco cerrada; la de la calle, pendiente.** Primera corrida en el
dispositivo del zoom digital sobre el cartel que decidió el
[ADR 0006](../architecture/adr/0006-pipelines-por-caso-de-uso.md) (actualización 2026-10-19). Responde
si el zoom funciona en la Zero 2 W sin romper al detector, y si el modo de sensor completo entra en
esta placa. No responde a qué distancia se anuncia la línea en la calle.

## La pregunta

La prueba de campo del 2026-10-19 (SESSION-LOG de ese día) mostró que el ómnibus se detecta de lejos
pero el cartel sólo se lee con el ómnibus casi encima. El recorte del OCR sale de un stream de 1024 px
de ancho sobre un sensor de 4056, así que un cartel lejano llega con pocos píxeles y el reescalado de
`bus_banner.crop` agranda el borrón. El zoom recorta en el ISP (`ScalerCrop`) alrededor del cartel
para que el OCR reciba píxeles reales.

Tres preguntas concretas:

1. ¿El zoom afecta al detector, que vive en el IMX500 y debería seguir viendo el campo completo?
2. ¿Llegan a leerse carteles que sin zoom quedaban por debajo del mínimo de altura?
3. ¿El modo de sensor completo (`--bus-full-res`, hasta 4x) entra en la Zero 2 W?

## Montaje

- **Placa**: Raspberry Pi Zero 2 W, daemon `hardware/raspi/` como servicio `virovision`, desplegado
  desde la rama `feat/bus-dynamic-zoom` (luego #121). Acceso por SSH sobre la red `Jack_2.4`, con el AP
  de la placa bajado por BLE (`tools/ap.py`); cada reinicio del daemon lo vuelve a levantar.
- **Cámara**: Raspberry Pi AI Camera (Sony IMX500), detector de dos clases (`bus_sign`, `bus`) dentro
  del sensor, cargado desde `bus_sign.rpk`. Es el detector reentrenado en la V100 (SESSION-LOG
  2026-10-21); sus métricas de validación no constan (PENDIENTE).
- **Modo**: ómnibus, puesto por BLE con `{"cmd": "mode", "value": 1}` en la característica `control`.
- **Zoom**: dinámico, centrado en el cartel más ancho, hasta que el cartel mide ~64 px de alto y sin
  que ocupe más de la mitad del ancho del frame; se sostiene 1,5 s si se pierde el cartel y vuelve a
  1x (`hardware/raspi/virovision/zoom.py`). En el modo agrupado 2x2 del sensor (2028×1520) el techo
  práctico es 2x; el frame es de 1024×766.
- **Márgenes del recorte**: en **cero**, la caja del detector tal cual (decisión del 2026-10-21). Los
  márgenes `SIGN_MARGINS = (0.18, 0.06, 0.06)` volvieron ese mismo día, después de esta corrida (#122).
- **Escena**: `video2.MP4` del repo `bus-banner-recognizer` (el 115 a Luis Braille) reproducido en la
  pantalla de una laptop, con la cámara apuntada a la pantalla.
- **Fuente de los datos**: el journal del servicio (latido cada 5 s, línea de tiempo por track fechada
  desde que el sensor vio ese ómnibus) y las imágenes de evidencia del modo (#114). Volcado en el
  SESSION-LOG del 2026-10-22.

## Limitaciones, antes de los números

- **Es una pantalla, no la calle.** El moiré de una pantalla filmada no es el de un cartel de LEDs, y
  la distancia "lejana" es la de un video, no metros medidos. La pregunta que motivó el zoom (a qué
  distancia se anuncia la línea) no se contesta acá.
- **Una sola corrida, un solo video, dos anuncios.** Los tiempos son ejemplos, no una distribución.
- **No hubo corrida de control con `--no-bus-zoom`** sobre la misma escena. La afirmación "sin zoom no
  se habría leído" se apoya en la regla del código (el mínimo de 22 px de alto para intentar una
  lectura, `MIN_BANNER_HEIGHT_PX` en `bus.py`), no en una comparación medida.
- **Márgenes en cero**, que no es el estado vigente: desde #122 el recorte lleva margen y la lectura
  se descarta si el zoom lo deja afuera. El comportamiento con márgenes no se volvió a medir.

## Resultados

### Zoom de 2x (modo agrupado)

| Qué | Resultado |
|---|---|
| Zoom con el cartel en cuadro | 2,0x |
| Frames con detecciones, por latido de 5 s | entre 68 y 76 (a 15 fps un latido son unos 75 frames) |
| Cuadros por segundo | 15, los mismos que sin zoom |
| Al perder el cartel | vuelve a 1x |

El detector no se enteró del zoom: siguió detectando en casi todos los frames, a la misma tasa. Es lo
esperado, porque la zona de entrada del IMX500 (`set_inference_roi_abs`) es un control aparte del
`ScalerCrop` del ISP.

| Caso | Alto del cartel | Lecturas | Anuncio |
|---|---|---|---|
| Ómnibus lejano | ~10 px en la vista completa (mínimo sin zoom: 22 px); ~25 px al OCR con zoom | tres ilegibles, la cuarta buena | «115, Luis Braille» a los **7,6 s** |
| Ómnibus más cercano | no registrado | una | a **1,0 s** |

En las imágenes de evidencia, el recorte se ajustó al LED sin margen y el "1" de 115 entró completo.
(En la calle, en cambio, el "1" se siguió perdiendo con márgenes en cero, y por eso volvieron:
ADR 0006, actualización 2026-10-22.)

### Modo de sensor completo (`--bus-full-res`, hasta 4x)

| Qué | Resultado |
|---|---|
| Cuadros por segundo | 10 |
| Memoria libre | 65 MB de 415 |
| Con el primer ómnibus | la cámara se trabó (`Camera frontend has timed out`) y el daemon se reinició |

**No entra en la Zero 2 W.** Se sacó de `/etc/default/virovision`; la opción queda en el código para
otra placa, con la advertencia en la ayuda, en el README de `hardware/raspi/` y en el ADR 0006.

## Lo que no se midió

- **La distancia de anuncio en la calle, con y sin zoom** (`--no-bus-zoom`). Es la medición que
  decide si la fase 1 alcanza o si hace falta la fase 2 (mover también la zona de entrada del
  detector hacia el ómnibus).
- **Cuántos frames tarda en aplicarse un `ScalerCrop` pedido.** El código traduce con el recorte que
  reporta la metadata de cada frame, así que una demora no rompe la lectura, pero no está cuantificada.
- **El zoom con los márgenes vigentes** (#122): cuántas lecturas se descartan porque el recorte del ISP
  deja afuera el margen izquierdo.
- **Consumo y temperatura** durante el modo, con y sin zoom.
- **La precisión del detector reentrenado** sobre las 117 imágenes de evaluación.
