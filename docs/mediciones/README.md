# Mediciones

Registro de las campañas de medición del proyecto: **los datos crudos y el método**, un archivo por
campaña, con fecha en el nombre.

Existe separado de [`../pruebas-y-decisiones.md`](../pruebas-y-decisiones.md) por la misma razón por
la que el diagrama canónico vive en un solo lugar: ahí va **el análisis y la decisión** (que es lo
que entra al documento final de la tesis) y acá los números completos que la respaldan, para que la
conclusión se pueda auditar y la medición se pueda repetir sin reconstruirla de memoria.

Regla: una campaña no se edita después de corrida. Si se vuelve a medir, es un archivo nuevo. Los
números viejos son el registro de qué se sabía cuándo, y borrarlos hace que las decisiones tomadas
con ellos parezcan arbitrarias.

| Campaña | Qué midió |
|---|---|
| [2026-09-02: modelos de supermercado](2026-09-02-modelos-supermercado.md) | Latencia, acierto, cuota, costo y efecto del tamaño de imagen de los tres proveedores con clave. |
| [2026-09-04: throughput BLE y tamaño de foto](2026-09-04-ble-throughput.md) | Si la foto del supermercado baja de la placa al teléfono por BLE en menos de 2 s (spike 0 del ADR 0003). No alcanzó: la foto va por WiFi. |
| [2026-09-15: el modo ómnibus en la placa](2026-09-15-omnibus-en-placa.md) | Latencia del camino de ómnibus entero corriendo en el dispositivo, disparado por el botón (en la Pi 3 B+ prestada). |
| [2026-10-22: el zoom digital del modo ómnibus](2026-10-22-zoom-omnibus.md) | El zoom del ISP sobre el cartel en la Zero 2 W, contra un video del 115: detecciones, tiempos de anuncio y por qué `--bus-full-res` no entra en esta placa. |

Campañas registradas fuera de esta carpeta, que se indexan acá para no perderlas:

| Campaña | Qué midió | Dónde está |
|---|---|---|
| 2026-09-22: el modo ómnibus en la Zero 2 W | Línea dicha a **1,6 s** de que el sensor ve el ómnibus (video del 115), con 75 frames cada 5 s y detecciones en el 95 %. | `docs/SESSION-LOG.md`, entrada del 2026-09-22 |
| 2026-10-12: evaluación sobre 117 imágenes | Número, destino y lectura completa: 91,7 / 89,3 / 91,7 % con dos modelos; 91,7 / 85,7 / 87,5 % con el modelo de dos clases del sensor. | README de `bus-banner-recognizer` (PR #7), sección "Results"; `docs/SESSION-LOG.md`, 2026-10-12 |
