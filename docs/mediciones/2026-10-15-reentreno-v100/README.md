# Reentrenamiento del detector en la GPU V100 (15 de octubre de 2026)

Corrida de Ultralytics que produjo el detector de dos clases que usa el dispositivo. Se entrenó en el servidor con
GPU NVIDIA Tesla V100 que facilitó Arnaldo Castro S.A. Los parámetros salen de los argumentos guardados en los pesos
(`best.pt`) y las métricas, de `results.csv`. Los pesos no se commitean por su tamaño (5,5 MB) y los tiene el equipo.

## Configuración

| Parámetro | Valor |
|---|---|
| Fecha | 2026-10-15 (UTC) |
| Ultralytics | 8.4.177 |
| Modelo de partida | `yolo11n.pt`, preentrenado sobre COCO |
| Datos | `find-bus-sign-7/data.yaml` (Roboflow, versión 7), 395 imágenes |
| Clases | `bus`, `bus_sign` |
| Épocas / paciencia | 120 / 100 |
| Lote / tamaño de imagen | 16 / 640 |
| Optimizador | AdamW, elegido por `optimizer="auto"`; lr0 0,001667, lrf 0,01, sin `cos_lr` |
| close_mosaic | 10 |
| hsv_h / hsv_s / hsv_v | 0,015 / 0,7 / 0,4 |
| degrees / shear / perspective | 0 / 0 / 0 |
| translate / scale / mosaic / mixup | 0,1 / 0,5 / 1,0 / 0 |
| fliplr / flipud | 0 / 0 |
| Duración | 264 s, las 120 épocas |

Salvo los reflejos, que se desactivaron, la corrida usa los valores por defecto de la biblioteca y no los de
`HYPERPARAMETERS` en `scripts/train.py` de bus-banner-recognizer. La tesis lo aclara en las secciones 7.4.3 y 12.7.

## Métricas de validación

| Época | Precisión | Exhaustividad | mAP@0,5 | mAP@0,5:0,95 |
|---|---|---|---|---|
| 105 (mejor, la de `best.pt`) | 0,940 | 0,926 | 0,967 | 0,739 |
| 120 (última) | 0,938 | 0,936 | 0,952 | 0,730 |

- mAP@0,5 por clase en la mejor época: `bus` 0,979, `bus_sign` 0,955.
- Matriz de confusión normalizada:
  - Detecciones con la clase correcta: `bus` 0,99, `bus_sign` 0,91.
  - Carteles detectados como ómnibus: 0,06.
  - Falsos positivos sobre el fondo: 62% como cartel, 38% como ómnibus.

Para comparar, el detector entrenado en CPU (140 imágenes, 40 épocas) daba sobre su partición de prueba de
14 imágenes: P 0,838, R 0,667, mAP@0,5 0,781 y mAP@0,5:0,95 0,391. Las particiones son distintas, así que la
comparación es indicativa (tesis, sec. 7.4.5).

Con este detector **no** se repitió la evaluación del pipeline completo sobre las 117 imágenes de evaluación. La
última medición de ese conjunto es la del 12 de octubre, con el modelo entrenado en CPU.

## Archivos

- `results.csv`: métricas y pérdidas por época.
- `results.png`: pérdidas y métricas por época (figura de la tesis, sec. 7.4.3).
- `BoxPR_curve.png` y `confusion_matrix_normalized.png`: figuras de la tesis, sec. 7.4.5.
- `BoxP_curve.png`, `BoxR_curve.png` y `BoxF1_curve.png`: curvas según el umbral de confianza (anexo 12.7).
