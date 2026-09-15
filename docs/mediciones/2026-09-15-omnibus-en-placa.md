# Medición — el modo ómnibus, entero, corriendo en la placa

**Estado (2026-09-15): medición cerrada.** Primera vez que el camino de ómnibus completo —detección,
recorte, OCR y voz— corre en el dispositivo, disparado por el botón físico, sin teléfono y sin
internet. Es la evidencia de que el **caso B** del [ADR 0006](../architecture/adr/0006-pipelines-por-caso-de-uso.md)
(todo en la placa) es viable en el hardware que tenemos, y lo que habilita enmendar el
[ADR 0003 §5](../architecture/adr/0003-enlace-placa-telefono.md).

## La pregunta

Desde que el usuario aprieta el botón hasta que escucha **qué línea es**, ¿cuánto pasa? Y antes que
eso: ¿entra el pipeline en una Pi 3 B+ sin acelerador, sin quedarse sin cámara ni sin RAM?

El umbral no es de laboratorio, es de la vereda: un ómnibus está a la vista unos pocos segundos. Si
el anuncio llega después de que arrancó, no sirve.

## Montaje

- **Placa**: Raspberry Pi 3 B+ prestada (la Zero 2 W tiene el conector CSI roto), Raspberry Pi OS
  Trixie 64-bit, Python 3.13, daemon `hardware/raspi/` como servicio `virovision`.
- **Cámara**: Raspberry Pi AI Camera (Sony **IMX500**). El detector corre **dentro del sensor**.
- **Detector**: `bus_sign.rpk`, el modelo de Magalí Dellapiazza cuantizado a int8 (ver abajo).
- **OCR**: PP-OCRv5 mobile (PaddleOCR) por ONNX, en la CPU de la Pi, en un hilo aparte.
- **Voz**: 386 `.wav` pregrabados en `/home/virovision/announcements`, por `aplay`.
- **Escena**: video de ómnibus de Montevideo reproducido en una pantalla, cámara apuntada a la
  pantalla. No es la calle; es repetible, que es lo que hacía falta para medir.
- **Rama**: `feat/omnibus-en-el-daemon`, commit `9381499`.

## Resultados

Del journal del servicio, corrida del 2026-09-15 13:56 (hora de la placa):

| Qué | Cuándo | Desde el botón |
|---|---|---|
| Click del botón, modo → ÓMNIBUS | 13:56:04,215 | 0 |
| Vigilancia arrancada | 13:56:04,220 | 5 ms |
| OCR devuelve la lectura | 13:56:05,484 | 1,27 s |
| «Ómnibus 115, Luis Braille» | 13:56:05,488 | **1,27 s** |

Las tres lecturas siguientes de la misma corrida, ya en régimen:

| Lectura | OCR |
|---|---|
| 13:56:35 | 971 ms |
| 13:56:36 | 1001 ms |
| 13:56:52 | 1006 ms |

**El OCR es el costo.** La detección en el sensor no consume CPU de la Pi y no aparece en el
presupuesto de tiempo: el sensor entrega cajas a 15 fps mientras la CPU hace otra cosa.

Reinicio en frío, con el cable de red desenchufado (journal del arranque de las 14:11):

| Qué | Cuándo | Desde que arranca el servicio |
|---|---|---|
| Servicio activo | 14:11:07 | 0 |
| Cámara lista, detector cargado en el sensor | 14:11:14 | 7 s |
| Modo ómnibus listo (los tres modelos de OCR cargados) | 14:11:54 | **47 s** |

Los 40 s del medio son **la carga de los modelos de OCR**, no el sensor: el firmware del detector
queda cacheado y sube en menos de un segundo. En un reinicio del servicio sin apagar la placa el total
baja a ~24 s. Que el modo tarde en estar listo no bloquea el arranque: el daemon responde `/health`
a los 7 s y el botón ya escucha.

Ocupación del chip del sensor: 2,64 MB de modelo + 4,48 MB de runtime = **7,12 MB de los 8 MB (90 %)**.

## Qué modelo está en la cámara

Es **el modelo de Magalí, sin reentrenar**: YOLO11n fine-tuneado por ella sobre el dataset Roboflow
`find-bus-sign` v6 (140 fotos, una clase `bus_sign`, 40 epochs). Las diferencias son todas de
formato, ninguna de aprendizaje:

| | El de Magalí (`.pt`) | El que corre en la cámara (`.rpk`) |
|---|---|---|
| Pesos | float32 | **int8**, cuantizado con la herramienta de Sony calibrando con las mismas 140 fotos |
| Dónde corre | CPU/GPU de una computadora | **dentro del sensor**, 15 fps, sin CPU ni RAM de la Pi |
| NMS | aparte, en ultralytics | **incluida en el modelo**: la cámara devuelve cajas finales |
| Tamaño | 5,2 MB | 2,64 MB |
| Clases | `bus_sign` | `bus_sign` (idéntico) |

## Lo que la medición dejó en evidencia

- **Un ómnibus es un anuncio, y el tracker solo no alcanza.** En la primera corrida desde el botón el
  anuncio salió dos veces en un segundo. Era **un solo ómnibus**: se movió la cámara mientras estaba
  en cuadro, se perdió el track y el mismo ómnibus volvió como uno nuevo. Cualquier cosa que corte el
  track —una mano, un poste, alguien que pasa— haría lo mismo, y quien no ve no puede distinguir «lo
  repitió» de «llegó otro». Se agregó un silencio de 10 s por línea.
- **El número de línea se pierde con el recorte justo.** El OCR lee `15` donde dice `115`: el primer
  dígito se funde con el ícono de silla de ruedas. Tres remedios, los tres puestos: margen izquierdo
  de recorte tres veces mayor que el derecho, medio voto para líneas que no están en el catálogo, y
  reparación contra el catálogo de la STM (el log muestra `15 LUIS BRALLE` entrando y
  `115, LUIS BRAILLE` saliendo).
- **El OCR no puede correr en el hilo de la cámara.** libcamera da el sensor por muerto tras ~1 s sin
  consumir frames, y el OCR tarda ~1 s. Va en un hilo aparte, y es lo que hizo desaparecer los
  «Camera frontend has timed out».
- **`aplay a.wav b.wav` falla en el segundo archivo** («Unable to install hw params»). Un `aplay` por
  archivo, en cola. Sin esto el destino no se escuchaba nunca.
- **La foto de supermercado sobrevive** al cambio de configuración de la cámara: `/photos/latest`
  sigue devolviendo un JPEG de 1024×766.

## Lo que no se midió

- **El costo del int8 en precisión.** Está medida la mitad float32, en el split de test (14 fotos,
  24 carteles), con `yolo val` sobre `bus_sign_v6_yolo11n.pt`:

  | | P | R | mAP50 | mAP50-95 |
  |---|---|---|---|---|
  | float32, test | 0,838 | 0,667 | **0,781** | 0,391 |

  La otra mitad **no se pudo correr**: el `model_imx.onnx` que deja el export (la simulación del
  int8) no carga fuera del contenedor del export. Necesita los operadores propios de Sony —
  `mct_quantizers:ActivationPOTQuantizer` y `EdgeMDT:MultiClassNMSWithIndices` — y las dos librerías
  que los registran se pisan entre sí (`Failed to add kernel for WeightsLUTSymmetricQuantizer …
  Conflicting with a registered kernel`) en todas las combinaciones de versiones que se probaron
  (mct-quantizers 1.6 y 1.7 contra edge-mdt-cl < 1.1). El camino que queda es correr la validación
  **dentro de la imagen Docker del export**, donde el juego de versiones ya está resuelto.
- **La calle.** Todo esto es contra una pantalla. Falta un ómnibus real, de día, en movimiento.
- **El consumo.** Ni corriente ni temperatura, y la Pi 3 B+ no es la placa final.
