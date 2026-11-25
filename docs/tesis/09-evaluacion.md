# 9. Evaluación

Este capítulo evalúa el sistema terminado. El capítulo 7 describió cada componente con las mediciones que justificaron sus decisiones de diseño; aquí se reúnen los resultados que indican qué tan bien funciona el conjunto, con los conjuntos de datos sobre los que se obtuvieron, la forma en que se calcula cada métrica y los límites de lo que esas cifras permiten afirmar. Se presentan primero el enfoque, los conjuntos de datos y las métricas, luego los resultados por caso de uso y del enlace con el dispositivo, la verificación del software, el grado de cumplimiento de los requisitos de la sec. 2.3 y, por último, las amenazas a la validez.

## 9.1 Enfoque de la evaluación

El objetivo específico 7 (sec. 2.4.2) pide evaluar el prototipo en tres dimensiones: la precisión del reconocimiento, el tiempo de respuesta y la utilidad para el usuario. La precisión se mide sobre conjuntos de datos anotados, y el tiempo, con mediciones sobre el dispositivo y con la telemetría del sistema en uso. La utilidad para el usuario no se evaluó, porque las pruebas con personas ciegas no se realizaron (sec. 9.9). El equipo agregó un criterio que el objetivo no nombra, la confiabilidad del software, que se evalúa con las pruebas automatizadas y las revisiones de código (sec. 9.7).

Las mediciones se hicieron en tres entornos distintos, y conviene distinguirlos porque sus resultados no son intercambiables. La precisión de los pipelines se midió en la computadora de desarrollo, sobre imágenes fijas; los tiempos de respuesta, sobre el dispositivo real, en su mayoría frente a videos reproducidos en una pantalla; y el comportamiento en uso, con la telemetría que la aplicación registra mientras el equipo usa el sistema. Sólo una prueba se hizo en la calle (sec. 9.4.4).

Como criterio general, el proyecto prioriza la precisión de lo que se anuncia frente a la exhaustividad (sec. 3.2 y RNF-03): para quien no ve, un anuncio equivocado puede llevarlo a subir al ómnibus incorrecto, mientras que un anuncio que no se hace sólo lo deja como estaba antes de usar el sistema. Por eso, además de la tasa de acierto, se informa la precisión de los anuncios cuando el dato existe.


## 9.2 Conjuntos de datos

La evaluación usa cuatro conjuntos de datos, cada uno con un alcance distinto.

El primero es la partición de validación del conjunto de entrenamiento del detector, sobre la que se calculan las métricas de detección. Pertenece a la versión 7 del conjunto find-bus-sign, de 395 fotografías, cuya partición no quedó registrada en el repositorio, y es además la partición con la que se eligió la mejor época del entrenamiento (sec. 7.3.3 y 7.3.4). La versión anterior del detector se evaluó sobre la partición de prueba de la versión 6, de 14 imágenes con 24 carteles.

El segundo es el conjunto propio que se construyó para evaluar el pipeline completo de ómnibus, anotado con lo que el sistema debe decir, cuya composición se resume en la Tabla 36 y en el anexo 13.11. Es independiente de las imágenes de entrenamiento, salvo por las 14 imágenes tomadas de Roboflow: pertenecen a la partición de prueba de la versión 6 y no se usaron para entrenar los detectores de esa versión, pero como la partición de la versión 7 no quedó registrada, no puede asegurarse lo mismo para el detector reentrenado.

Tabla 36: Composición del conjunto de evaluación del pipeline de ómnibus.

| **Propiedad** | **Valor** |
|---|---|
| Imágenes | 117 |
| Con ómnibus presente | 102 |
| Con cartel legible | 68 |
| Con número esperado | 48 |
| Con destino esperado | 56 |
| Procedencia | tres videos (45 / 32 / 26 imágenes) y el conjunto de prueba de Roboflow (14) |

Cada fila registra la imagen, el número y el destino esperados, la presencia de ómnibus y de cartel, y una nota con el texto literal del cartel cuando difiere de la denominación oficial.

Los tres videos de origen provienen de redes sociales y no de la cámara del dispositivo; se usaron sólo para la evaluación académica y no se redistribuyen. Por ese origen, todas las métricas obtenidas sobre este conjunto corresponden a imágenes distintas de las de uso real. La construcción de un conjunto de evaluación con fotografías tomadas por el propio dispositivo es la principal tarea pendiente de este componente; la evidencia que guarda el modo ómnibus (sec. 7.3.9) se incorporó para ese fin.

El tercero es la imagen de referencia del modo supermercado: una única fotografía de alto contraste de un producto, de 768 × 1024 píxeles, sobre la que se compararon los modelos de nube con cinco corridas por modelo (sec. 7.4.2). El conjunto de evaluación del modo, formado por los productos de la canasta básica fotografiados con el propio dispositivo, no está construido (sec. 7.4.5).

El cuarto son los eventos de telemetría registrados por la aplicación entre el 9 de septiembre y el 23 de noviembre de 2026, que incluyen el tiempo de cada etapa de una lectura (sec. 9.7.4). Provienen del uso del sistema por el equipo durante el desarrollo, con un único teléfono, y no de un protocolo de prueba diseñado.


## 9.3 Métricas y su cálculo

La sec. 3.2 define las métricas de clasificación en términos de verdaderos y falsos positivos y negativos. Aplicarlas al sistema exige precisar, para cada una, qué se cuenta (la unidad) y sobre cuántos casos se calcula (el denominador). La Tabla 37 lo resume.

Tabla 37: Métricas de la evaluación, con su unidad y su denominador.

| **Métrica** | **Unidad** | **Cómo se calcula** | **Denominador** |
|---|---|---|---|
| Precisión y exhaustividad del detector | Caja delimitadora | Una detección es correcta si su IoU con una caja anotada de la misma clase alcanza 0,5 | Detecciones del modelo (precisión) o cajas anotadas (exhaustividad) de la partición de validación |
| mAP@0,5 y mAP@0,5:0,95 del detector | Caja delimitadora | Área bajo la curva precisión-exhaustividad, promediada por clase; la segunda promedia además sobre umbrales de IoU de 0,5 a 0,95 | Partición de validación |
| Precisión, exhaustividad y F1 del cartel | Imagen | Una imagen con cartel anotado es un verdadero positivo si el pipeline recorta un cartel en ella; F1 es la media armónica de precisión y exhaustividad | Imágenes en las que se recortó un cartel (precisión) o con cartel anotado (exhaustividad), entre las 117 del conjunto |
| Acierto del número | Imagen | El número anunciado coincide con el esperado, después de normalizar mayúsculas y espacios; una imagen en la que no se anuncia nada cuenta como error | Las 48 imágenes con número esperado |
| Precisión del número | Imagen | Imágenes con el número correcto, sobre las imágenes en las que se anunció algún número, incluidas las que no tenían número esperado | Imágenes con un número anunciado |
| Acierto del destino | Imagen | El destino anunciado coincide con el esperado | Las 56 imágenes con destino esperado |
| Lectura completa | Imagen | Número y destino correctos a la vez; si el cartel no tiene destino esperado, se exige que no se anuncie ninguno | Las 48 imágenes con número esperado |
| Acierto del modo supermercado | Lectura | Los tres campos (tipo, marca y detalle) coinciden con el producto | Corridas sobre la imagen de referencia |
| Tiempos | Ejecución | Mediana, y percentil 90 cuando hay suficientes muestras | Ejecuciones de cada medición |

Las métricas de acierto del pipeline no son la exactitud de la sec. 3.2, que se calcula como (VP + VN) / total sobre todos los casos. Se calculan sólo sobre las imágenes en las que había algo que leer, es decir, sobre los casos positivos, y equivalen a una exhaustividad de la lectura: miden qué fracción de los carteles legibles se leyó correctamente. Por eso se las denomina tasas de acierto y no exactitud. La precisión del número completa esa medida desde el lado de los anuncios, porque cuenta también los números equivocados anunciados en imágenes sin un número esperado.


## 9.4 Resultados del modo ómnibus

Esta sección presenta los resultados del modo ómnibus en tres niveles: el detector solo, el pipeline completo sobre el conjunto de evaluación y el sistema funcionando en el dispositivo.


### 9.4.1 El detector y el costo de la cuantización

La primera versión del detector, entrenada en CPU, se evaluó en precisión flotante de 32 bits sobre la partición de prueba de su conjunto (14 imágenes, 24 carteles). Su precisión era aceptable, 0,838, pero la exhaustividad de 0,667 indicaba que no encontraba uno de cada tres carteles, y el mAP@0,5:0,95 de 0,391 mostraba que, aun cuando los encontraba, las cajas se ajustaban mal a ellos. En el modo vigilancia, un cartel que no se detecta es un ómnibus que no se anuncia, y una caja mal ajustada es un recorte que puede dejar afuera el primer dígito del número (sec. 7.3.6). Esos dos problemas, junto con la evidencia de que 40 épocas no alcanzaban para que el entrenamiento terminara de mejorar, fueron los que justificaron el reentrenamiento en la V100 (sec. 7.3.4).

La Tabla 38 compara las dos versiones.

Tabla 38: Métricas del detector antes y después del reentrenamiento en la V100.

| **Versión** | **Datos y entrenamiento** | **Evaluación** | **Precisión** | **Exhaustividad** | **mAP@0,5** | **mAP@0,5:0,95** |
|---|---|---|---|---|---|---|
| CPU, septiembre de 2026 | 140 imágenes, 40 épocas | Prueba (14 imágenes) | 0,838 | 0,667 | 0,781 | 0,391 |
| V100, 15 de octubre de 2026 | 395 imágenes, 120 épocas | Validación, época 105 | 0,940 | 0,926 | 0,967 | 0,739 |
| V100, 15 de octubre de 2026 | 395 imágenes, 120 épocas | Validación, época 120 | 0,938 | 0,936 | 0,952 | 0,730 |

Fuente: registros de entrenamiento de Ultralytics de cada corrida (docs/mediciones/2026-10-15-reentreno-v100/results.csv para la V100).

La mejora alcanza a todas las métricas. La exhaustividad pasa de 0,667 a 0,926 y el mAP@0,5:0,95 casi se duplica, de 0,391 a 0,739, lo que sugiere cajas mejor ajustadas al cartel. La comparación es, sin embargo, indicativa y no exacta, porque las dos versiones no se evaluaron sobre las mismas imágenes: la primera sobre la partición de prueba de su conjunto, y la segunda sobre la partición de validación del conjunto ampliado, que es además la que se usó para elegir la mejor época. Esa elección no explica la diferencia: en la última época, que no se eligió por su resultado, las métricas son prácticamente las mismas.

Por clase, el ómnibus se detecta algo mejor que el cartel (Figura 23), con un mAP@0,5 de 0,979 frente a 0,955, lo que es esperable porque el cartel es un objeto más pequeño y su aspecto cambia con el brillo de los LED. La matriz de confusión (Figura 24) confirma que el detector casi no confunde una clase con la otra: detecta con la clase correcta el 99% de los ómnibus y el 91% de los carteles de validación. Sus errores son, sobre todo, detecciones donde no hay nada: de los falsos positivos, el 62% son carteles y el 38% ómnibus. Un cartel falso no llega por sí solo a un anuncio, porque su lectura tiene que coincidir con el catálogo de líneas (sec. 7.3.8).

<!-- imagen del Doc: ../mediciones/2026-10-15-reentreno-v100/BoxPR_curve.png -->

Figura 23: Curva precisión-exhaustividad del detector reentrenado, por clase y para ambas clases, sobre la partición de validación.

Fuente: elaboración propia, a partir de los registros de entrenamiento de Ultralytics.

<!-- imagen del Doc: ../mediciones/2026-10-15-reentreno-v100/confusion_matrix_normalized.png -->

Figura 24: Matriz de confusión normalizada del detector reentrenado sobre la partición de validación. Cada columna corresponde a la clase real y cada fila a la clase predicha.

Fuente: elaboración propia, a partir de los registros de entrenamiento de Ultralytics.

Estas métricas miden al detector solo. La evaluación del pipeline completo sobre las 117 imágenes de evaluación (sec. 9.4.2) no se repitió con el detector reentrenado, por lo que el efecto de la mejora sobre la lectura del número y del destino no está cuantificado.

Para cargarlo en el sensor, el modelo se convierte a enteros de 8 bits mediante cuantización posterior al entrenamiento: los pesos se redondean a enteros con factores de escala por canal y algunas activaciones se conservan en 16 bits. La calibración no implica reentrenamiento. El supresor de no máximos queda incorporado en el modelo convertido, con umbrales fijos de confianza 0,25 e intersección sobre unión 0,7. En la primera conversión documentada, la del detector de una clase entrenado sobre la versión 6, la calibración usó las 28 imágenes de validación de esa versión y el tamaño pasó de 5,2 MB a 2,64 MB; como el archivo de pesos de Ultralytics guarda los pesos en media precisión (16 bits), el paso a 8 bits reduce el tamaño a la mitad. Para la conversión del detector reentrenado, que es el que usa el dispositivo, no quedó registrado qué imágenes se usaron para la calibración.

El costo en precisión de esa cuantización no se pudo medir. El modelo convertido no puede cargarse fuera del entorno provisto por el fabricante, porque requiere operadores propietarios cuyas bibliotecas entraron en conflicto entre sí en todas las combinaciones de versiones probadas. La solución, un contenedor con el entorno del fabricante y un script que compara el modelo flotante contra el entero sobre la misma partición y con la misma métrica, está preparada en el repositorio y pendiente de ejecución. Es el riesgo abierto más relevante de este componente.

### 9.4.2 El pipeline completo sobre el conjunto de evaluación

La Tabla 39 presenta el resultado del pipeline completo con la configuración que adoptó el dispositivo, el detector de una etapa y dos clases, junto al esquema de dos etapas descartado por la memoria del sensor (sec. 7.3.5). La medición vigente es del 12 de octubre de 2026, con el reconocedor latino, el margen vertical de 0,06 y las reglas del catálogo de la sec. 7.3.8, en la computadora de desarrollo y con el detector entrenado en CPU.

Tabla 39: Tasas de acierto del pipeline completo sobre las 117 imágenes del conjunto de evaluación (12 de octubre de 2026).

| **Detector** | **Número (48)** | **Destino (56)** | **Lectura completa (48)** | **Detección (mediana)** |
|---|---|---|---|---|
| Una etapa, dos clases (el del dispositivo) | 91,7% | 85,7% | 87,5% | 18 ms |
| Dos etapas | 91,7% | 89,3% | 91,7% | 35 ms |

Fuente: README del repositorio bus-banner-recognizer, sección *Results*, y anexo 13.10.

Con 48 imágenes, cada imagen vale 2,1 puntos de lectura completa, por lo que la diferencia de 4,2 puntos entre los dos esquemas son dos imágenes. Una sola imagen, el cartel nocturno de la línea 109, cambia el resultado del número entre versiones de las bibliotecas (sec. 7.3.5). Las cifras deben leerse, por lo tanto, como un orden de magnitud: con esta configuración el pipeline lee correctamente el número en unas nueve de cada diez imágenes con número esperado, y el número y el destino a la vez en algo menos.

La precisión del número, que no se guardó para la medición del 12 de octubre, sí está disponible para la del 16 de septiembre con el mismo detector y sin las reglas del catálogo: 0,935, con una exhaustividad de 0,896 y un F1 de 0,915 (resultados guardados del repositorio de visión, results/single_v006). Es decir, de cada cien números anunciados, unos seis eran incorrectos antes de que el catálogo filtrara las lecturas que no corresponden a una línea existente. El catálogo debería reducir esa proporción, pero la reducción no se midió. En la misma medición, el detector encontró el cartel en el 97,1% de las imágenes que lo tenían, con una precisión de 0,776 por imagen (anexo 13.10).

La configuración que corre en el dispositivo no coincide con ninguna de las dos filas: usa el detector reentrenado en la V100 y cuantizado a 8 bits, que no se evaluó con el pipeline completo, con imágenes de la cámara y no de videos (sec. 9.9).


### 9.4.3 Latencia en el dispositivo

La primera medición del ciclo completo se hizo el 15 de septiembre de 2026 sobre la Raspberry Pi 3 B+ prestada, con la misma cámara y disparando el modo con el botón físico (docs/mediciones/2026-09-15-omnibus-en-placa.md). La Tabla 40 muestra el tiempo de cada etapa.

Tabla 40: Primera medición del ciclo completo del modo ómnibus en la placa (Raspberry Pi 3 B+, 15 de septiembre de 2026).


| **Etapa** | **Tiempo desde el gesto** |
|---|---|
| Clic del botón; el modo cambia a ómnibus | 0 |
| Vigilancia iniciada | 5 ms |
| El OCR devuelve la lectura | 1,27 s |
| Se anuncia “Ómnibus 115, Luis Braille” | 1,27 s |

Las lecturas siguientes demoraron 971, 1.001 y 1.006 ms. Sobre la Raspberry Pi Zero 2 W, el 22 de septiembre y con el mismo video de la línea 115, la línea se anunció 1,6 segundos después de que el sensor detectó el ómnibus, tras dos lecturas de OCR de 932 y 583 ms, con 75 cuadros cada 5 segundos y detecciones en el 95% de ellos (docs/SESSION-LOG.md, 22 de septiembre de 2026). Las dos cifras no se miden desde el mismo punto: en la Pi 3 B+ se cuenta desde el botón y en la Zero 2 W desde que el sensor detecta el ómnibus.

En ambos casos el tiempo está dominado por el OCR, de entre 583 y 1.006 ms por lectura, porque la detección se ejecuta en el sensor sin costo para la placa. El anuncio de presencia, que no espera al OCR, llega antes. Las dos mediciones se hicieron con un video en pantalla y con un único cartel, la línea 115, por lo que no representan la variedad de carteles ni de condiciones de luz de una parada real.


### 9.4.4 Zoom digital y prueba de campo

La única prueba del modo ómnibus en la calle se hizo el 19 de octubre de 2026, antes de incorporar el zoom. El sistema detectó el ómnibus desde lejos, pero leyó el cartel sólo con el vehículo prácticamente encima, demasiado tarde para que el usuario pueda hacerle una seña a uno que no se detiene. La prueba no se repitió con mediciones de distancia ni con varias líneas, y es el resultado más importante de este capítulo para juzgar el modo ómnibus: todas las demás cifras se obtuvieron sobre imágenes fijas o videos en una pantalla, en los que el cartel ocupa más píxeles que a la distancia real.

El zoom digital (sec. 7.3.10) se midió en la placa el 22 de octubre de 2026, con la Zero 2 W y contra un video de la línea 115 en pantalla (docs/mediciones/2026-10-22-zoom-omnibus.md). La Tabla 41 resume el resultado.

Tabla 41: Medición del zoom digital en la placa (22 de octubre de 2026).


| **Qué** | **Resultado** |
|---|---|
| Zoom con el cartel en cuadro | 2,0× |
| Cuadros con detecciones, por intervalo de 5 s | entre 68 y 75, a 15 cuadros por segundo |
| Cartel lejano (~10 px de alto; el mínimo sin zoom es 22 px) | anunciado a los 7,6 s, tras tres lecturas ilegibles |
| Cartel más cercano | anunciado a 1,0 s, con una lectura |
| Modo de sensor completo (hasta 4×) | 10 cuadros por segundo, 65 MB libres de 415 y la cámara se bloqueó |

Con el zoom, el sistema anunció un cartel de unos 10 píxeles de alto, menos de la mitad de la altura mínima que necesita sin zoom, aunque tardó 7,6 segundos y tres lecturas ilegibles en lograrlo. El modo de sensor completo, que permitiría llegar a 4×, se descartó porque redujo la tasa de cuadros y bloqueó la cámara. La prueba en la calle con y sin zoom, midiendo a qué distancia se anuncia la línea, está pendiente, y de ella depende saber si el modo ómnibus es útil en una parada real (sec. 9.9).


## 9.5 Resultados del modo supermercado

La precisión del modo supermercado se midió con una sola imagen de alto contraste: los tres modelos comparados devolvieron correctamente los tres campos en las cinco corridas de cada uno, quince de quince (sec. 7.4.2). El resultado muestra que los modelos son capaces de la tarea, pero no estima la precisión en una góndola real, con productos parecidos, envases arrugados, luz desfavorable y el encuadre que da una cámara en la patilla de unos lentes. El conjunto de evaluación con fotografías del dispositivo, sobre el que se calcularían exhaustividad, precisión, exactitud y F1, no está construido (sec. 7.4.5).

El tiempo de respuesta sí puede estimarse con datos de uso. La telemetría registra por separado la duración de cada etapa de una lectura, y la Tabla 42 resume los eventos registrados hasta el 23 de noviembre de 2026.

Tabla 42: Duración de las etapas de una lectura del modo supermercado, según la telemetría (9 de septiembre a 23 de noviembre de 2026).

| **Etapa** | **Lecturas** | **Mediana** | **Percentil 90** |
|---|---|---|---|
| Descarga de la fotografía desde el dispositivo | 110 | 282 ms | 900 ms |
| Consulta al modelo gpt-5.6-luna (por defecto) | 81 | 1.941 ms | 3.072 ms |
| Consulta al modelo qwen/qwen3.8-27b | 27 | 1.142 ms | 1.861 ms |
| Síntesis de voz en la nube (sólo con salida por el dispositivo) | 38 | 2.128 ms | 2.842 ms |
| Envío del audio al dispositivo (envíos exitosos) | 38 | 230 ms | 657 ms |

Fuente: tabla de eventos de la telemetría (sec. 8.6.2), eventos photo.ok, reading.ok, audio.synthesis y audio.send; consulta y resultados en docs/mediciones/2026-11-23-telemetria-supermercado.md.

La telemetría no registra el ciclo completo de una lectura con un único cronómetro, por lo que el tiempo total se estima sumando las medianas de cada etapa, lo que da un valor aproximado. Con la salida por el teléfono, que usa la voz del sistema sin demora apreciable, una lectura con el modelo por defecto demora unos 2,2 segundos desde que se pide la fotografía, lo que sugiere que cabe en el objetivo de 3 a 4 segundos (RNF-02), aunque falta confirmarlo con una medición del ciclo completo. Con la salida por el dispositivo, la síntesis en la nube y el envío del audio suman unos 2,4 segundos más, y la lectura llega a unos 4,6 segundos, por encima del objetivo. Según esta estimación, el objetivo se alcanza sólo con la salida por el teléfono, y la síntesis en la nube es la etapa que habría que acelerar, por ejemplo sintetizando en el teléfono y enviando el audio ya generado. A esos tiempos se suma el del gesto y su llegada por BLE, que no se registra.

Las cifras corresponden al uso del sistema por el equipo durante el desarrollo, con un único teléfono y en distintas condiciones de red, y no a un protocolo de prueba. Son, aun así, la medición más cercana al uso real de la que se dispone, y reemplazan a la estimación de entre 3 y 3,5 segundos que se hizo al diseñar el enlace (sec. 7.1.5).


## 9.6 Resultados del enlace y del dispositivo

El enlace entre el dispositivo y el teléfono se evaluó en dos momentos. El primero fue la comparación de protocolos de aplicación sobre la red WiFi, realizada al comienzo del proyecto, cuyo resultado se muestra en la Figura 25. MQTT obtuvo el menor tiempo promedio, del orden de 1,2 segundos, seguido por WebSocket y HTTP, entre 1,5 y 2 segundos, y por BLE, algo por encima de 2 segundos; CoAP superó los 10 segundos, el máximo de la escala, en varias de las mediciones. Las demás gráficas de la medición se presentan en el anexo 13.3.

<!-- imagen del Doc: figuras/rtt-promedio-por-protocolo.png ancho=450 -->

Figura 25: Tiempo de ida y vuelta promedio por protocolo de comunicación.

Fuente: mediciones del equipo.

Estos valores deben tomarse con cautela. Un tiempo de ida y vuelta de uno o dos segundos en una red local es varios órdenes de magnitud mayor que el esperable, que es de milisegundos, lo que indica que la medición no aisló el protocolo: probablemente incluye el establecimiento de la conexión, el tamaño de los mensajes, que incluían imágenes y audio, y la carga de la placa. Las condiciones de la medición (la red utilizada, el tamaño de los mensajes y la cantidad de repeticiones) no quedaron registradas, por lo que el resultado no se puede reproducir y permite, a lo sumo, una comparación aproximada entre protocolos. Por esa razón no se usó para elegir el protocolo: la elección de HTTP se basó en que no requiere componentes adicionales (sec. 7.1.4).

El segundo momento fue la medición que decidió la arquitectura del enlace, realizada con criterios de aceptación escritos antes de medir (sec. 7.1.5). Una fotografía de 53 KB tardó una mediana de 4.470 ms por BLE, 2,2 veces por encima del criterio de 2 segundos, y 46 ms por HTTP sobre la red del dispositivo. Esa diferencia de dos órdenes de magnitud, a diferencia de la anterior, no depende de los detalles de la medición, y llevó a separar el plano de control del de datos.

Sobre el dispositivo se midieron además el arranque y la interacción física. Después de reorganizar el arranque, el dispositivo se anuncia por BLE a los 16,2 segundos, la cámara está lista a los 21,3 y el modo ómnibus queda operativo a los 33,6, contados desde el arranque del núcleo del sistema operativo (Tabla 14, sec. 7.2.3). Con los tiempos del botón recalibrados se realizaron treinta gestos consecutivos sin errores de reconocimiento, en una prueba con personas videntes y con un pulsador distinto del de la carcasa (sec. 7.2.7). El consumo y la autonomía de la batería no se midieron: las cifras de la sec. 7.2.4 son estimaciones a partir de mediciones de terceros.


## 9.7 Verificación del software

### 9.7.1 Cobertura de pruebas automatizadas

La Tabla 43 resume las pruebas automatizadas de cada componente.

Tabla 43: Pruebas automatizadas por componente.

| **Componente** | **Pruebas** | **Alcance** |
|---|---|---|
| Aplicación móvil | 397 (345 en 38 suites al 9 de noviembre) | Decisiones puras, contratos de frontera, contraste, orden de ejecución |
| Servicio del dispositivo | 220 (197 y 2 omitidas al 9 de noviembre) | Núcleo independiente del transporte, gestos del botón, modos, modo ómnibus, zoom, batería, evidencia |
| Pipeline de ómnibus | 96 | Geometría del recorte, detector, seguimiento, interpretación, catálogo |

Cifras al 23 de noviembre de 2026 para la aplicación y el dispositivo, con las del 9 de noviembre entre paréntesis (npx jest en app/ y pytest en hardware/raspi/; sec. 9.7.5), y al 22 de octubre de 2026 para el repositorio bus-banner-recognizer (rama feat/bus-line-reader, commit becd2f0).

Entre las pruebas, cuatro grupos reflejan mejor la orientación del proyecto. El primero verifica el contraste: implementa el cálculo de relación de contraste de WCAG y comprueba el nivel AAA (7:1) para texto, 4,5:1 para el color de acento y 3:1 para bordes de control, e incluye los límites conocidos de la paleta de marca y el motivo de cada corrección, de modo que un cambio de color que no cumpla el criterio hace fallar la compilación. El segundo verifica la lectura con la pantalla bloqueada: comprueba el orden de las etapas (confirmación acústica, envío y liberación de la sesión de audio) y no sólo el resultado, porque lo que puede fallar en ese escenario es la secuencia. El tercero cubre el enrutamiento de los avisos, incluido el caso de que nunca se devuelva al dispositivo una falla originada en él. El cuarto verifica los contratos duplicados: que la aplicación sólo nombre archivos de audio que el dispositivo tiene, que no queden archivos que nada pueda solicitar y que un comando de modo entre en una sola escritura Bluetooth.

### 9.7.2 Revisión de toda la base de código

Entre el 2 y el 3 de noviembre de 2026 se revisó la base de código completa con el flujo de revisión multimodelo (PR #126). A diferencia del uso habitual del flujo, en el que cuatro revisores examinan el mismo cambio (sec. 5.3), la base se repartió en cinco partes (servicios de la aplicación, servicio del dispositivo, interfaz y servidor, contratos entre componentes, y pruebas e integración continua), cada una asignada a un revisor basado en uno de los tres modelos de Anthropic; Codex no se ejecutó en esa revisión. Siguieron cuatro rondas de revisión sobre lo corregido. Los defectos encontrados no habían aparecido en las pruebas porque dependían de condiciones de uso poco frecuentes. Entre ellos:

- En la aplicación, el envío de audio a la placa no respetaba el plazo de 8 segundos; la copia de una lectura de ómnibus a la placa se enviaba aunque la salida elegida fuera el teléfono, y se escuchaban dos voces; al reconectarse, la aplicación no volvía a leer el modo del dispositivo, que podía haberse reiniciado; y sin red, la telemetría descartaba lotes completos de eventos.
- En el dispositivo, una pulsación del botón durante la carga del OCR no anunciaba “preparando la lectura”; el zoom del modo ómnibus no se deshacía antes de una foto de supermercado, que salía recortada; y una excepción al guardar la evidencia detenía la lectura.
- En el servidor, el intermediario de visión validaba el proveedor pero no la ruta, lo que permitía enviar la credencial a cualquier dirección del proveedor; además se agregaron límites de tamaño y de tiempo y un límite de solicitudes en la función de evidencia.

### 9.7.3 Pruebas dependientes del entorno de ejecución

Una prueba verificaba que, sin intermediario configurado, la solicitud se enviara directamente al proveedor. Pasaba en las computadoras del equipo y fallaba en la integración continua, porque la configuración se leía del entorno del proceso y el entorno era distinto en cada caso. La prueba dependía del entorno y no del código. Se corrigió haciendo inyectables las credenciales y el reloj que usa el limitador de solicitudes, y ese criterio se extendió al resto del código.

### 9.7.4 Telemetría como instrumento de medición

La aplicación registra eventos de ejecución en el servidor propio, con el tiempo de cada etapa por separado (descarga de la fotografía, lectura, síntesis y envío de audio) y no sólo el total, porque cada etapa falla o demora por motivos distintos. Esta información permitió detectar defectos que no se manifestaban en la interfaz y reemplazó a la información de diagnóstico que se retiró de la pantalla (sec. 7.6.3).

### 9.7.5 Segunda revisión completa y retiro de las claves de la aplicación

El 23 de noviembre de 2026, con el producto ya completo, se repitió la revisión de toda la base de código (PR #145 y PR #146). Esta vez sí participó Codex junto a los tres modelos de Anthropic: Opus revisó la aplicación y el servicio del dispositivo, Sonnet los servicios de la aplicación, Haiku las funciones del servidor, la integración continua y las pruebas del dispositivo, y Codex hizo una pasada transversal centrada en defectos de corrección. Después de cada corrección, Opus y Codex revisaron sólo lo modificado, para detectar defectos introducidos por los propios arreglos. Como en la primera revisión, del 2 y 3 de noviembre (sec. 9.7.2), los defectos no se manifestaban en las pruebas porque dependían de una secuencia de eventos poco frecuente, pero varios tenían consecuencias directas sobre lo que escucha el usuario.

El hallazgo de mayor gravedad fue de seguridad. Desde la puesta en marcha del intermediario propio (ADR 0008) ninguna solicitud de la aplicación iba directo a un proveedor, pero la integración continua seguía pasando al compilado una credencial de Gemini guardada como secreto del repositorio. Como las variables públicas de Expo se copian dentro del código de la aplicación, cada versión distribuida por TestFlight y cada paquete instalable de Android generado por la integración continua llevaba esa credencial legible, aunque no la usara. Se eliminó el secreto, se retiraron de los flujos de compilación las cuatro credenciales de proveedores, y se cambió la aplicación para que sólo las lea en una compilación de desarrollo: en una compilación de distribución el empaquetador reemplaza la condición por un valor falso y descarta el texto de la credencial. Se verificó compilando el paquete de producción con credenciales ficticias, que no aparecieron en el resultado, mientras que la dirección del intermediario sí. El modo supermercado usa hoy los modelos de OpenAI y Qwen (este último servido por Groq), ambos a través del intermediario, de modo que la aplicación ya no necesita ninguna credencial.

En la aplicación se corrigieron cuatro defectos que afectaban la retroalimentación auditiva. La cola que ordena las operaciones Bluetooth (sec. 7.5.5) esperaba indefinidamente a una operación colgada, y con ella quedaban detenidos la confirmación acústica del botón y la orden que silencia el dispositivo antes de que hable el teléfono; ahora la cola sigue adelante a los 5 segundos y quien pidió la operación recibe un error a los 10. Un cambio de modo durante la carga inicial del modelo de OCR dejaba el botón de lectura deshabilitado hasta el siguiente cambio de modo. Cuando la red del dispositivo fallaba de manera persistente, cada latido de estado, uno cada 15 segundos, repetía la frase de falla y podía volver a mostrar el permiso de iOS para unirse a la red; desde entonces la falla se dice una vez y el reintento es silencioso, y esa decisión se separó en un módulo propio con pruebas (app/src/features/device/networkCheck.ts). Por último, el error del dispositivo cuando el modo ómnibus no puede arrancar, por ejemplo porque la cámara no inició, sólo llegaba a la telemetría, y el usuario, que ya había escuchado “preparando la lectura”, quedaba en silencio; ahora escucha una frase fija con la acción que puede tomar, coherente con el ADR 0011.

En el dispositivo, el defecto más visible era que repetir la última lectura con un clic en el modo ómnibus la hacía sonar siempre por el parlante del dispositivo, aunque la salida elegida fuera el teléfono, de modo que quien escuchaba por el teléfono no oía nada. También se corrigió que un arranque del modo ómnibus que llegaba después de haber salido del modo dejara el detector funcionando, que dos reproducciones simultáneas superpusieran sus voces, que se capturara una fotografía que nadie iba a recibir y que la actualización del código desde la microSD pudiera dejar el servicio a medio instalar. El archivo de volumen de la microSD, un parche previo al control de volumen desde la aplicación (sec. 7.5.6), se retiró, porque si quedaba en la tarjeta anulaba el nivel elegido por el usuario en cada arranque.

En el servidor, las funciones de telemetría y de evidencia leían el cuerpo completo de la solicitud antes de comprobar su tamaño, y la de telemetría no tenía límite de solicitudes por dirección. Se unificaron en un módulo compartido el límite de solicitudes, la lectura acotada del cuerpo y la identificación del cliente, que antes estaban copiados en cada función, y la función de evidencia dejó de permitir que una solicitud sobrescribiera una imagen ya guardada. En la integración continua, los textos que se insertaban en los comandos (las notas de una versión y el mensaje de un commit) pasaron a leerse como variables de entorno, para que no pudieran ejecutarse como código, y el permiso del token de GitHub quedó en sólo lectura.

Las pruebas automatizadas pasaron de 345 a 397 en la aplicación y de 197 a 220 en el servicio del dispositivo entre el 9 y el 23 de noviembre de 2026 (sec. 9.7.1). Además, las pruebas del dispositivo que dependían de esperas de tiempo fijo, y que por eso podían fallar en un servidor de integración continua cargado, se reescribieron para sincronizarse con eventos, y las que sólo comprobaban que no se produjera una excepción pasaron a verificar el comportamiento esperado.

## 9.8 Cumplimiento de los requisitos

La Tabla 44 presenta el estado de cada requisito de la sec. 2.3 al cierre de este informe y la evidencia que lo respalda. Un requisito figura como cumplido cuando está implementado y verificado por el equipo; “en laboratorio” indica que la verificación se hizo con videos o imágenes y no en el entorno real de uso. Las pruebas con usuarios ciegos, que no se realizaron, pueden modificar varios de ellos, en particular los que dependen de la percepción del usuario.

Tabla 44: Estado de los requisitos al cierre del informe.

| **Código** | **Estado** | **Evidencia** |
|---|---|---|
| RF-01 | Cumplido en laboratorio | Modo vigilancia probado en la placa contra videos (sec. 7.3.9 y 9.4.3) |
| RF-02 | Cumplido en laboratorio | Lectura completa de 87,5% sobre el conjunto de evaluación; en la única prueba en la calle, el cartel se leyó tarde (sec. 9.4.2 y 9.4.4) |
| RF-03 | Cumplido | Selección por área de la caja delimitadora (sec. 7.3.1); no se midió con varios ómnibus reales |
| RF-04 | Implementado; reconocimiento sin verificar sobre un conjunto representativo | Quince de quince lecturas correctas sobre una sola imagen (sec. 9.5) |
| RF-05 | Cumplido | Treinta gestos sin errores (sec. 9.6); calibrado con personas videntes |
| RF-06 | Cumplido | sec. 7.1.2 |
| RF-07 | Cumplido | sec. 7.2.4 y 7.5.5 |
| RF-08 | Cumplido con iPhone | sec. 7.5.5 y 7.5.10; no verificado con Android |
| RF-09 | Cumplido | sec. 7.5.4 y 7.5.6 |
| RF-10 | No cumplido en el modo producto | La imagen sólo se muestra en el modo desarrollo, como herramienta del equipo (sec. 7.6.4) |
| RNF-01 | Cumplido | Detección en el sensor y OCR en la placa, sin conexión (sec. 7.3.2 y 7.2.6) |
| RNF-02 | Estimado: dentro del objetivo con salida por el teléfono, fuera con salida por el dispositivo | Suma de medianas por etapa: unos 2,2 s por el teléfono y unos 4,6 s por el dispositivo, sin el gesto ni su llegada por BLE; falta medir el ciclo completo (sec. 9.5) |
| RNF-03 | Cumplido | Sólo se anuncia lo que el catálogo confirma (sec. 7.3.8 y 7.3.9) |
| RNF-04 | Cumplido | sec. 7.1.2 |
| RNF-05 | Parcial | Contraste verificado de forma automatizada (sec. 9.7.1); sin pruebas con usuarios de lectores de pantalla |
| RNF-06 | Cumplido | Ninguna credencial en los paquetes distribuidos desde el 23 de noviembre de 2026 (sec. 7.1.6 y 9.7.5) |
| RNF-07 | Cumplido | Unos USD 0,0003 por lectura (sec. 7.4.2) |
| RNF-08 | Cumplido | sec. 7.5.4 y 7.6.3 |
| RNF-09 | Cumplido; autonomía no medida | sec. 7.2.4 y 7.2.8 |
| RNF-10 | Parcial | La evidencia se guarda en un almacenamiento privado, restringido al equipo, y debe retirarse antes de una versión pública (sec. 8.6.3 y 5.7); no se hizo un análisis formal de cumplimiento de la ley [PENDIENTE: base legal y registro de la base de datos, si corresponde] |
| RNF-11 | Cumplido | Costo de reproducción de 211,12 USD (sec. 7.2.9); la comparación con los productos comerciales se presenta en el cap. 10 |


## 9.9 Amenazas a la validez

El prototipo funciona de punta a punta en pruebas de laboratorio. Esta sección reúne las razones por las que los resultados anteriores pueden no reflejar su desempeño en el uso real, agrupadas según el tipo de amenaza, para que cada cifra del capítulo se lea con su alcance.

### 9.9.1 Validez externa: del laboratorio a la calle

La amenaza principal es que el modo ómnibus casi no se evaluó en su entorno de uso. Las tasas de acierto provienen de imágenes extraídas de videos de redes sociales y de Roboflow, y los tiempos, de videos reproducidos en una pantalla; la única prueba en la calle mostró que el cartel se leía con el ómnibus prácticamente encima (sec. 9.4.4). En una parada real influyen la distancia, el ángulo, la velocidad del vehículo, la luz del día o de la noche, los reflejos y la oclusión por otros vehículos o personas, ninguno de los cuales está representado de forma controlada en el conjunto de evaluación. La prueba en la calle, con y sin zoom, midiendo a qué distancia se anuncia la línea, es la evaluación pendiente más importante del proyecto.

La configuración que corre en el dispositivo tampoco es la que se evaluó. Las tasas de acierto del pipeline corresponden al detector entrenado en CPU, en precisión flotante y en la computadora de desarrollo. El dispositivo usa el detector reentrenado en la V100, cuantizado a 8 bits y ejecutado en el sensor, y ni la evaluación del pipeline con ese detector ni el costo en precisión de la cuantización se pudieron medir (sec. 9.4.1). La precisión de lo que efectivamente anuncia el dispositivo no está, por lo tanto, cuantificada.

El modo supermercado tiene la misma limitación de forma más marcada: su precisión se midió con una sola imagen favorable (sec. 9.5). Además, el reconocimiento de líneas con letras, propias de la periferia, prácticamente no está medido, y las líneas fuera del sistema metropolitano no se anuncian (sec. 7.3.13), por lo que los resultados describen mejor el centro de Montevideo que las zonas donde el procesamiento local más se justifica.

### 9.9.2 Validez interna: cómo se construyeron los conjuntos

El conjunto de evaluación del modo ómnibus tiene 117 imágenes, pero 103 provienen de sólo tres videos (45, 32 y 26 imágenes). Los cuadros de un mismo video son muy parecidos entre sí, porque muestran los mismos ómnibus, con la misma luz y desde el mismo lugar, de modo que el tamaño efectivo de la muestra es mucho menor que 117 y los porcentajes tienen una incertidumbre mayor que la que sugiere ese número. Con 48 imágenes con número esperado, además, cada imagen vale 2,1 puntos porcentuales.

La partición de la versión 7 del conjunto de entrenamiento no quedó registrada en el repositorio. En consecuencia, las 14 imágenes del conjunto de evaluación tomadas de Roboflow podrían haberse usado para entrenar el detector reentrenado, y las métricas del detector antes y después del reentrenamiento no son comparables en sentido estricto: se calcularon sobre particiones distintas, que incluso podrían solaparse con las imágenes de entrenamiento (sec. 9.4.1). La mejora de 0,391 a 0,739 en el mAP@0,5:0,95 indica una tendencia, no una magnitud exacta. Las métricas del detector reentrenado se calcularon además sobre la partición con la que se eligió la mejor época, aunque la última época, que no se eligió por su resultado, da cifras prácticamente iguales.

La sec. 3.1.1 advierte que una decisión tomada mirando el resultado sobre la partición de prueba sesga esa medición. El proyecto lo respetó sólo en parte. El margen vertical del recorte se eligió sobre el propio conjunto de evaluación, por lo que su efecto está sesgado a favor, aunque es pequeño (0,7 puntos, sec. 7.3.6); los márgenes laterales y los umbrales de la lógica de anuncio, en cambio, deliberadamente no se ajustaron contra ese conjunto (sec. 7.3.6 y 7.3.9). Las reglas del catálogo se desarrollaron mirando errores observados en la placa y en el conjunto, por lo que su mejora sobre el destino, de 76,8% a 89,3%, también puede estar sobreestimada.

### 9.9.3 Validez de constructo: si se mide lo que importa

Las tasas de acierto miden si el sistema lee bien un cartel en una imagen, pero no si el usuario sube al ómnibus correcto. Entre una y otra cosa intervienen el momento del anuncio, que puede llegar tarde (sec. 9.4.4), el seguidor de objetos, que puede romper la identidad de un vehículo cuando la persona gira la cabeza (sec. 7.3.9), y la decisión de anunciar o no una lectura dudosa. El tiempo del modo supermercado se estimó sumando medianas de etapas, no midiendo el ciclo completo (sec. 9.5). Y varias decisiones de interacción son hipótesis del equipo que no se validaron con usuarios: el orden de la frase del producto (sec. 7.4.3), los tiempos del botón, calibrados con personas videntes y con otro pulsador (sec. 7.2.7), y el presupuesto de 3 a 4 segundos (RNF-02).

### 9.9.4 Lo que no se evaluó

No se realizaron pruebas de usabilidad con personas ciegas, por lo que el objetivo específico de evaluar la utilidad del prototipo para el usuario (sec. 2.4.2) se cumple sólo en parte. La autonomía de la batería es una estimación a partir de mediciones de terceros (sec. 7.2.4), y el peso del dispositivo no se midió (sec. 7.2.8). El audio, con el amplificador y el filtro, tiene un volumen suficiente evaluado de oído, sin medición de nivel sonoro, y conserva un ruido de fondo propio del PWM (sec. 7.2.2). La aplicación sólo se probó con el dispositivo en iPhone.

### 9.9.5 Limitaciones del prototipo que condicionan su uso

Algunas limitaciones no afectan la validez de las mediciones pero sí el uso del prototipo fuera del desarrollo. El modo supermercado depende de la nube y no tiene respaldo local (sec. 7.4.6). La evidencia del modo ómnibus son fotografías de la vía pública que pueden contener personas y matrículas, es decir, datos personales; su uso se limita al desarrollo y debe retirarse antes de cualquier versión pública (sec. 8.6.3). Existe una única unidad, con la clave de su red local fija y el servidor HTTP sin autenticación (sec. 7.2.3). La carcasa es un prototipo impreso en PLA, del tamaño que impone una placa de propósito general con su módulo de alimentación (sec. 7.2.8).

Las líneas de trabajo que permitirían superar estas limitaciones se presentan en el capítulo 11.
