# 7. Desarrollo

Este capítulo describe la construcción del sistema. Se presenta primero la arquitectura general, luego las decisiones de diseño que la determinaron, junto con la evidencia que las respalda, y por último la implementación de cada componente: el dispositivo y su carcasa, el reconocimiento de líneas de ómnibus, el reconocimiento de productos y la aplicación móvil. En cada caso se describen los problemas encontrados durante el desarrollo, las alternativas evaluadas y la solución adoptada.

## 7.1 Arquitectura del sistema

### 7.1.1 Visión general

ViroVision está compuesto por tres elementos técnicos y por la persona que lo utiliza:

1. El dispositivo, montado en la patilla de unos lentes. Está formado por una computadora de placa única, una cámara con capacidad de inferencia en el propio sensor, un botón físico y una salida de audio. Captura el entorno y reproduce la respuesta.
1. La aplicación móvil, que se ejecuta en el teléfono del usuario. Gestiona la vinculación con el dispositivo, aporta capacidad de procesamiento cuando es necesaria, resuelve la síntesis de voz y ofrece la configuración del sistema.
1. Los servicios de nube, que son opcionales y se utilizan sólo en el modo supermercado: un intermediario propio que resguarda las credenciales y, detrás de él, un modelo de lenguaje con capacidad de visión.
1. El usuario, que interactúa mediante un botón y recibe la información por voz. La pantalla del teléfono no forma parte del uso habitual; se utiliza para la configuración y para que un acompañante vidente pueda verificar el resultado.

La división de responsabilidades responde a la restricción principal del proyecto (ADR 0001): las funciones esenciales deben funcionar sin conexión a internet. Por ese motivo el modo ómnibus, que además es el más sensible a la latencia, se resuelve dentro del dispositivo, mientras que la nube se utiliza en el modo supermercado, donde la ganancia de precisión justifica la dependencia y donde el usuario se encuentra, en general, en un lugar con cobertura.

### 7.1.2 Modos de operación

El sistema funciona como una máquina de estados de tres modos que se controla con un único botón (ADR 0007):

| **Gesto** | **Efecto** |
|---|---|
| Un clic | Entra en modo ómnibus desde cualquier estado; si el sistema ya está en modo ómnibus, repite el último anuncio |
| Doble clic | Entra en modo supermercado desde cualquier estado y solicita una lectura |
| Pulsación larga | Vuelve al estado de espera |

En una primera versión, pasar de un modo a otro exigía volver antes al estado de espera. Esa restricción se eliminó porque, para una persona que no ve la pantalla, presionar el botón y no obtener respuesta se interpreta como una falla del dispositivo. Desde entonces cada gesto lleva directamente a un modo. Por el mismo motivo, el doble clic solicita una lectura aunque el sistema ya esté en modo supermercado: el usuario que repite el gesto está pidiendo una nueva lectura.

El sistema no emite audio que el usuario no haya solicitado. En el modo supermercado la solicitud es cada doble clic; en el modo ómnibus la solicitud es el propio modo, y mientras está activo el dispositivo vigila la escena y anuncia los ómnibus que aparecen (sec. 7.4.9).

### 7.1.3 Los tres flujos de reconocimiento

El proyecto evaluó dos arquitecturas de procesamiento: resolver todo en el dispositivo, como producto autónomo, o derivar el procesamiento de imagen al teléfono. La Raspberry Pi se eligió, entre otras razones, porque permite implementar y comparar ambas. El resultado de esa comparación es que cada caso de uso terminó en un extremo distinto: en el modo ómnibus se resuelve todo en el dispositivo, en el modo supermercado se deriva al teléfono y de allí a la nube.

<!-- imagen del Doc -->

Figura: Arquitectura en modo ómnibus

<!-- imagen del Doc -->

Figura: Arquitectura en modo supermercado

### 7.1.4 Comunicación entre componentes

La comunicación entre el dispositivo y el teléfono utiliza dos canales. La medición del enlace Bluetooth de baja energía (BLE, sec. 7.2.1) mostró que ese enlace no puede transportar una fotografía en el tiempo disponible, pero resulta adecuado para los mensajes que deben llegar siempre y con baja latencia: la pulsación del botón, el cambio de modo y el estado del dispositivo. Por ello se separaron dos planos:

1. Plano de control, sobre BLE (GATT). La conexión permanece activa y se restablece automáticamente si se pierde. Transporta eventos pequeños.
1. Plano de datos, sobre WiFi y bajo demanda. El dispositivo crea un punto de acceso propio; la aplicación se une a él con las credenciales que recibe por BLE y descarga la fotografía por HTTP. El teléfono mantiene su conexión de datos móviles, por lo que puede comunicarse con la nube mientras está unido a la red del dispositivo.

En este esquema la aplicación es la que solicita los datos: el dispositivo informa que hay una fotografía disponible y la aplicación decide cuándo descargarla. De esta manera el dispositivo se mantiene simple y la recuperación ante un fallo de red queda a cargo de un único componente.

#### Perfil GATT

El dispositivo expone un servicio con identificador 4380c500-7ca3-4e37-b27d-f60e8d8d73d1 y seis características. Los identificadores son de 128 bits y se generaron aleatoriamente, ya que los valores abreviados de 16 bits que suelen aparecer en los ejemplos pertenecen al rango reservado por el Bluetooth SIG y no deben utilizarse en un perfil propio.

| **Característica** | **Propiedades** | **Contenido** |
|---|---|---|
| mode | lectura · notificación · escritura | Entero sin signo de 8 bits: 0 espera, 1 ómnibus, 2 supermercado |
| control | escritura | Comando en JSON (photo, mode, status, audio, say, ap, measure) |
| event | notificación | Evento en JSON, máximo 180 bytes |
| transfer | notificación | Transferencia binaria fragmentada (en desuso desde el rediseño del enlace) |
| status | lectura · notificación | Estado del dispositivo: versión, temperatura, tiempo de actividad, batería, cámara, red y punto de acceso |
| wifi | lectura | Credenciales del punto de acceso del dispositivo |

El límite de 180 bytes por evento y el fragmento de 182 bytes se derivan de la unidad máxima de transmisión (ATT MTU) que negocia iOS, de 185 bytes, de los cuales tres corresponden a la cabecera del protocolo. El estado del dispositivo se notifica cada 15 segundos.

La definición del perfil existe en el servicio del dispositivo y en la aplicación, y una prueba automatizada falla si ambas copias dejan de coincidir.

## 7.2 Decisiones de diseño y su evidencia

Esta sección reúne las decisiones que determinaron la arquitectura. Para cada una se presenta el problema que la originó, las alternativas consideradas, la evidencia obtenida y la solución adoptada. Se incluyen sólo las decisiones respaldadas por una medición o por una prueba sobre el hardware.

### 7.2.1 Transporte de la imagen entre el dispositivo y el teléfono

El diseño original enviaba la fotografía del dispositivo al teléfono por BLE, mediante la característica transfer. Antes de implementarlo se fijó un criterio de aceptación: una imagen de 53.000 bytes debía llegar en menos de 2 segundos, lo que equivale a un caudal de al menos 27 KB/s. El valor surge del tiempo total que se fijó para una lectura en modo supermercado, de 3 a 4 segundos.

Se realizaron cinco transferencias contra un iPhone con la aplicación instalada, con la radio WiFi del dispositivo encendida y apagada:

| **Condición** | **Corridas (ms)** | **Mediana** | **Caudal** |
|---|---|---|---|
| WiFi del dispositivo apagada | 3580, 3660, 4470, 4520, 5010 | 4470 ms | 11,8 KB/s |
| WiFi del dispositivo encendida | 4080, 4260, 4440, 4490, 6150 | 4440 ms | 11,9 KB/s |

El resultado quedó 2,2 veces por debajo del criterio, y la radio WiFi no influyó en él. El caudal observado coincide con el envío de una notificación de 182 bytes por cada intervalo de conexión de 15 ms (182 / 0,015 = 12,1 KB/s), por lo que el límite lo impone el enlace y no el teléfono. El controlador de radio de la placa no implementa la extensión de longitud de datos (*Data Length Extension*) y cada paquete de radio transporta 27 bytes útiles. También se probó reducir el tamaño de fragmento a 95 y a 47 bytes, y en ambos casos el caudal empeoró, de modo que el problema no se resolvía ajustando parámetros.

Como alternativa se transfirió el mismo archivo por HTTP sobre la radio WiFi del dispositivo, con una mediana de 46 ms, unas cien veces más rápido. Se decidió entonces mantener BLE como plano de control y usar WiFi como plano de datos (ADR 0003). Con este enlace híbrido, el tiempo estimado de una lectura de supermercado pasó de 6 a 9 segundos a entre 3 y 3,5 segundos.

Las mediciones se realizaron sobre una Raspberry Pi Zero 2 W. Entre el 9 y el 18 de septiembre de 2026 el desarrollo continuó sobre una Raspberry Pi 3 B+ prestada, con otro controlador de radio, y las mediciones de radio de ese período no son comparables con estas. Desde el 19 de septiembre el dispositivo volvió a ser una Zero 2 W, con el mismo controlador (BCM43438), por lo que estas cifras vuelven a ser representativas (sec. 7.3.6).

### 7.2.2 Selección del modelo de visión para el modo supermercado

Luego de la exploración de modelos locales (sec. 7.2.8) se decidió resolver el modo supermercado con un modelo de visión en la nube, y fue necesario elegir el proveedor. Se esperaba que el criterio de selección fuera la precisión. Para comparar se realizaron cinco corridas por modelo, espaciadas 7 segundos, con una imagen de 768×1024 píxeles (53 KB). Las corridas se ejecutaron con el mismo código de la aplicación, reemplazando únicamente el transporte:

| **Modelo** | **Mínimo** | **Mediana** | **Máximo** | **Dispersión** | **Acierto** |
|---|---|---|---|---|---|
| qwen/qwen3.8-27b | 764 ms | 846 ms | 1087 ms | 1,4× | 5/5 |
| gpt-5.6-luna | 1410 ms | 1668 ms | 2490 ms | 1,8× | 5/5 |
| gemini-3.5-flash-lite | 2820 ms | 10.649 ms | 32.586 ms | 11,6× | 5/5 |

Los tres modelos devolvieron correctamente los tres campos en las quince corridas, de modo que la precisión no permitió diferenciarlos. El criterio pasó a ser la latencia y, en particular, su dispersión. Un modelo cuya mediana es aceptable pero cuyo peor caso es doce veces mayor genera, para un usuario que no ve la pantalla, una espera que no se distingue de una aplicación bloqueada, lo que descartó a gemini-3.5-flash-lite.

Entre los dos modelos restantes, qwen/qwen3.8-27b tiene la mitad de la latencia y menor dispersión, pero se eligió gpt-5.6-luna como modelo por defecto por la cuota de uso. qwen/qwen3.8-27b se utiliza a través de Groq, cuyo plan gratuito admite unas cuatro lecturas por minuto, y una persona que recorre una góndola realiza del orden de dos a cuatro lecturas por minuto. Con ese modelo por defecto, la lectura que excede el límite falla, y para el usuario eso es peor que una respuesta 800 ms más lenta. qwen/qwen3.8-27b se mantiene como alternativa en el selector de la aplicación (sec. 7.2.7). La justificación está registrada junto a la definición del modelo por defecto (app/src/services/vision/product.ts).

El costo por lectura con el modelo seleccionado es de aproximadamente USD 0,0003 (1138 tokens de entrada y 35 de salida), por lo que mil lecturas cuestan menos de medio dólar y el costo dejó de ser una restricción. También se observó que reducir el tamaño de la imagen disminuye los tokens pero no la latencia.

La medición utilizó una única imagen de alto contraste, por lo que representa un caso favorable y no una estimación de la precisión en una góndola real. El conjunto de evaluación con fotografías tomadas por el propio dispositivo sigue pendiente (sec. 7.5.4).

### 7.2.3 Resguardo de las credenciales de nube

En una aplicación Expo, las variables de configuración que usa el código JavaScript se incorporan al binario como constantes, y pueden recuperarse inspeccionando el paquete instalable. Como la aplicación se distribuye mediante un enlace público de pruebas, cualquier clave incluida en ella quedaría expuesta.

Entregar las claves después de un inicio de sesión no era posible, porque la aplicación no tiene cuentas de usuario (sec. 7.6.6). Se optó por un intermediario propio entre la aplicación y los proveedores, implementado como función sin servidor (ADR 0008). La función recibe el cuerpo de la solicitud que ya construyó la aplicación, le agrega la credencial desde el almacén de secretos del servidor y devuelve la respuesta del proveedor sin modificarla. De este modo no es necesario reproducir en el servidor la lógica de cada proveedor, y agregar un modelo sólo requiere un cambio en la aplicación. El intermediario agrega aproximadamente 150 ms al modelo más rápido.

El intermediario no está autenticado, porque la aplicación no tiene inicio de sesión y cualquier clave de acceso estaría igualmente en el binario. Su ventaja es que permite rotar o desactivar una credencial sin publicar una nueva versión de la aplicación. Para limitar el abuso cuenta con una lista de destinos permitidos (que impide redirigir la credencial a un servidor ajeno), un límite de solicitudes por dirección de origen y un tope de gasto configurado en cada proveedor. En la revisión de noviembre (sec. 7.8.2) se agregaron la validación de la ruta por proveedor, el límite de tamaño del cuerpo y la cancelación de la llamada cuando el teléfono se desconecta.

### 7.2.4 Procesamiento local del modo ómnibus

El modo ómnibus es el más sensible a la latencia, porque un anuncio que llega cuando el ómnibus ya pasó no tiene utilidad. Es además el que con mayor probabilidad se usa sin cobertura: una parada a la intemperie, y en particular las zonas periféricas de Montevideo y las localidades del interior, donde la cobertura de datos móviles es más débil. Por eso el ADR 0001 lo mantiene como procesamiento local. Esas mismas zonas son las que presentan carteles más difíciles para el sistema, porque muchas de sus líneas se identifican con códigos que combinan letras y números (sec. 7.4.13).

La primera medición del ciclo completo se hizo el 15 de septiembre de 2026 sobre la Raspberry Pi 3 B+ prestada, con la misma cámara y disparando el modo con el botón físico (docs/mediciones/2026-09-15-omnibus-en-placa.md):

| **Etapa** | **Tiempo desde el gesto** |
|---|---|
| Clic del botón; el modo cambia a ómnibus | 0 |
| Vigilancia iniciada | 5 ms |
| El OCR devuelve la lectura | 1,27 s |
| Se anuncia «Ómnibus 115, Luis Braille» | 1,27 s |

Las lecturas siguientes demoraron 971, 1001 y 1006 ms. Sobre la Raspberry Pi Zero 2 W, el 22 de septiembre y con el mismo video de la línea 115, la línea se anunció 1,6 segundos después de que el sensor detectó el ómnibus, tras dos lecturas de OCR de 932 y 583 ms, con 75 cuadros cada 5 segundos y detecciones en el 95% de ellos (docs/SESSION-LOG.md, 2026-09-22). Las dos cifras no se miden desde el mismo punto: en la Pi 3 B+ se cuenta desde el botón y en la Zero 2 W desde que el sensor detecta el ómnibus.

La detección se ejecuta dentro del sensor de la cámara y no consume procesador de la placa: el sensor entrega cajas delimitadoras a 15 cuadros por segundo mientras la placa realiza el recorte y el reconocimiento de texto.

El mayor costo del procesamiento local es el arranque. En la Pi 3 B+ el modo ómnibus quedaba operativo 47 segundos después de iniciado el servicio, de los cuales 40 correspondían a la carga de los modelos de OCR. En la Zero 2 W, después de reorganizar el arranque (sec. 7.3.2), el dispositivo anuncia por BLE a los 16,2 segundos, la cámara está lista a los 21,3 y el OCR a los 33,6, contados desde el inicio del sistema. Los modelos se cargan al arrancar y no al presionar el botón, porque una respuesta que demora un minuto sería percibida por el usuario como una falla.

### 7.2.5 Inferencia en el sensor de la cámara

El diseño original incluía un acelerador Coral TPU conectado por USB, sobre el cual se ejecutaría el detector en formato TensorFlow Lite. Durante el desarrollo se incorporó la Raspberry Pi AI Camera, cuyo sensor Sony IMX500 ejecuta un modelo de detección dentro del propio sensor. La conversión del detector entrenado ocupa 7,12 MB de los 8 MB disponibles en el chip (90%) y el sensor procesa 15 cuadros por segundo sin usar procesador ni memoria de la placa.

Se decidió retirar el Coral del diseño (ADR 0006, enmienda del 7 de septiembre de 2026). Con ello se eliminó un componente, su costo y su consumo, y se liberó el único puerto USB de la placa. El formato TensorFlow Lite se reemplazó por ONNX y por el formato propio del sensor. La decisión es especialmente relevante en la Zero 2 W, que dispone de unos 415 MB de memoria útil: al no ocupar memoria ni procesador con la detección, la placa queda disponible para el recorte y el OCR.

El procesador de imagen de la placa permite además recortar la zona del sensor que se entrega como imagen sin modificar lo que observa el detector, que sigue viendo el campo completo. Sobre esa propiedad se construyó en octubre un zoom digital sobre el cartel (sec. 7.4.10).

La ocupación del 90% del chip tiene una consecuencia: en el sensor cabe un único modelo, lo que condicionó la elección del detector (sec. 7.4.4).

### 7.2.6 Calibración de la interacción física

Los tiempos iniciales del botón se tomaron de las convenciones de interfaces de escritorio y provocaban errores en el reconocimiento de los gestos; en particular, el doble clic se confundía con un clic simple. Se ajustaron así:

| **Constante** | **Antes** | **Ahora** | **Fundamento** |
|---|---|---|---|
| Antirrebote | 50 ms | 15 ms | Con 50 ms el doble clic se interpretaba como uno solo; 15 ms cubre el rebote mecánico del pulsador utilizado |
| Ventana de doble clic | 0,4 s | 0,6 s | 0,4 s es el valor habitual para un ratón; el gesto sobre un dispositivo montado en la sien es más lento |
| Umbral de pulsación larga | 0,8 s | 0,8 s | Sin cambios |

Con los valores nuevos se realizaron treinta gestos consecutivos (once dobles, diez simples y nueve largos) sin errores de reconocimiento. En la misma sesión, el primer doble clic desde el estado de espera cambió de modo y descargó la fotografía en 164 ms.

Estos tiempos fueron calibrados por personas videntes y con un pulsador distinto del que lleva la carcasa. El ajuste definitivo requiere las pruebas con usuarios ciegos previstas para la etapa final.

### 7.2.7 Decisiones de producto tomadas por accesibilidad

Algunas decisiones no surgieron de una medición de rendimiento sino del criterio de accesibilidad.

La primera se refiere al selector de modelo de nube. Ese selector se recorre opción por opción con el lector de pantalla, por lo que cada opción adicional agrega un gesto antes de llegar a la lectura. Se dejaron dos modelos, el más rápido y el más robusto, y se retiraron otros dos que funcionaban correctamente. Desde noviembre de 2026 el selector sólo se muestra en el modo desarrollo de la aplicación (sec. 7.6.5).

La segunda es el uso de un único tema visual (ADR 0010). Se retiró el selector de tema claro u oscuro y se verificó automáticamente el contraste: el color de advertencia alcanza una relación de 10,97:1 sobre el fondo, por encima del nivel AAA de WCAG (7:1) exigido para texto.

La tercera es la reducción de la información en pantalla. En dos etapas se retiró de la interfaz la información de diagnóstico (tiempos, modelo que respondió, texto sin procesar del reconocedor y botones de medición), porque correspondía a una herramienta de desarrollo dentro de una aplicación destinada a personas que no ven la pantalla. Esa información se envía a la telemetría (sec. 7.8.4).

### 7.2.8 Alternativas evaluadas y descartadas

| **Alternativa** | **Motivo del descarte** |
|---|---|
| Modelo multimodal ejecutado en el teléfono (Gemma con LiteRT-LM) | La visión no funcionó en iOS con tres modelos distintos, de 756 MB a 2,5 GB |
| Modelo multimodal ejecutado en el teléfono con ExecuTorch | Funcionó, pero requería 3 GB de descarga inicial, unos 4 s de carga y 6,4 s por inferencia, muy por encima del tiempo objetivo |
| Audio por Bluetooth Classic (A2DP) | Agrega entre 150 y 250 ms de codificación y comparte la antena con BLE y WiFi |
| Acelerador Coral TPU por USB | Reemplazado por la inferencia en el sensor (sec. 7.2.5) |
| Detector de dos etapas en el dispositivo | El segundo modelo no entra en el sensor (sec. 7.4.4) |
| Realce de contraste (CLAHE) sobre el recorte del cartel | Empeoró el acierto del número de 87,5% a 77,1% |
| Modo de sensor completo para un zoom de hasta 4x | En la Zero 2 W redujo la tasa a 10 cuadros por segundo y bloqueó la cámara (sec. 7.4.10) |
| Una segunda aplicación para pruebas internas | Con tres desarrolladores alcanza con cambiar de versión desde la plataforma de distribución; una segunda aplicación exige su propia ficha y revisión |

### 7.2.9 Elección de React Native para la aplicación móvil

La aplicación debía funcionar en iOS y Android, comunicarse con el dispositivo físico y ser utilizable por personas ciegas o con baja visión. La elección de la tecnología debía considerar estas necesidades, la experiencia del equipo y el tiempo disponible para desarrollar y mantener la solución.

Se consideraron el desarrollo nativo por plataforma y los frameworks multiplataforma, entre ellos React Native y Flutter. El desarrollo nativo permite trabajar directamente con las herramientas de cada sistema operativo, pero supone mantener dos implementaciones. Los frameworks multiplataforma permiten compartir parte del código, aunque su integración con las funciones de cada plataforma debe verificarse según las necesidades de la aplicación.

Se eligió React Native por la experiencia previa del equipo con JavaScript y React, la posibilidad de compartir código entre plataformas y la disponibilidad de bibliotecas para la comunicación Bluetooth con el dispositivo. Estos factores permitían dedicar el esfuerzo al reconocimiento, la interacción y la accesibilidad, en lugar de aprender una tecnología nueva.

La accesibilidad también formó parte de la evaluación. React Native ofrece propiedades para comunicar etiquetas, roles, estados y ayudas de interacción a VoiceOver y TalkBack \[60\], pero estas capacidades no garantizan por sí solas que una aplicación sea accesible. El estudio de Mascetti et al. documenta limitaciones en la cobertura de las APIs de accesibilidad de los frameworks analizados, lo que refuerza la necesidad de verificar los comportamientos requeridos en cada plataforma \[56\].

El desarrollo nativo se descartó por el esfuerzo de mantener dos implementaciones dentro del cronograma y con el equipo disponible. Flutter se descartó principalmente porque requería incorporar Dart y un ecosistema con el que el equipo tenía menos experiencia; esto no implica que Flutter carezca de soporte de accesibilidad, ya que también dispone de mecanismos para integrar tecnologías de asistencia \[61\].

La elección permitió compartir la lógica de la aplicación, pero no eliminó la necesidad de verificar la comunicación, la gestión del audio y la interacción con lectores de pantalla en ambos sistemas operativos. La decisión se fundamentó en la adecuación al proyecto y en la experiencia del equipo, y no en una comparación experimental entre los distintos enfoques. Los criterios de accesibilidad adoptados se desarrollan en la sección 7.7.

## 7.3 El dispositivo

### 7.3.1 Componentes

| **Función** | **Componente** | **Estado** |
|---|---|---|
| Cómputo | Raspberry Pi Zero 2 W | En uso; reemplazada por una unidad nueva el 7 de noviembre de 2026 (sec. 7.3.6) |
| Visión | Raspberry Pi AI Camera (sensor Sony IMX500, 12 MP, inferencia en el sensor) | Integrada |
| Entrada | Pulsador en GPIO 5; en la carcasa, pulsador SMD de 4 × 4 × 1 mm con tecla impresa | Integrado |
| Audio | Salida PWM por GPIO (señal en el pin físico 32, masa en el 34) hacia un auricular de 4 ohmios; destino: amplificador I2S hacia un transductor de conducción ósea de 14 mm | Provisoria; el traslado a los pines 12 y 14 con resistencia y capacitor en serie está propuesto en el PR #130, pendiente de soldar y probar (sec. 7.3.6) |
| Alimentación | Waveshare UPS HAT (C) con batería LiPo 803040 de 1000 mAh; interruptor deslizante de panel pegado a la carcasa en lugar de la llave del módulo | Integrada; el nivel de batería llega a la aplicación (sec. 7.3.3) |
| Carcasa | VIA Clara, dos mitades a presión impresas en 3D sobre la patilla, con la copa del auricular aparte | Versión final v0.29, impresa y armada; integrada al repositorio (PR #131, sec. 7.3.5) |

La salida de audio actual utiliza modulación por ancho de pulso (PWM) redirigida a pines de propósito general: en la versión integrada, la señal sale por el pin físico 32 y la masa por el 34. El PR #130, todavía no integrado, propone trasladarla a los pines físicos 12 (señal) y 14 (masa) (sec. 7.3.6). Esta salida permitió verificar el camino completo con voz audible en un auricular, pero no es adecuada para el uso real: un pin de propósito general entrega 16 mA, mientras que un auricular requiere del orden de 100 mA continuos. El volumen se limita al 90% porque la salida PWM satura en el extremo superior y la distorsión dificulta más la comprensión que un volumen menor. La solución prevista es un conversor digital-analógico con amplificador por I2S. El pulsador, en GPIO 5, no ocupa ninguno de los pines de esa interfaz; en cambio, con el traslado propuesto en el PR #130 la salida PWM pasa a usar GPIO 18 y 19, que son pines de I2S, por lo que esa salida se retiraría al incorporar el conversor.

El sensor tiene enfoque manual y las primeras capturas salieron desenfocadas. El ajuste quedó documentado como paso obligatorio de la puesta en marcha, con una herramienta auxiliar que calcula un puntaje de nitidez mientras se gira el anillo frente a un cartel ubicado a 10 o 20 metros.

### 7.3.2 El servicio del dispositivo

El software del dispositivo es un servicio en Python de 4981 líneas repartidas en 22 archivos, con 197 pruebas automatizadas que pasan y 2 que se omiten fuera de la placa (recuento del 9 de noviembre de 2026 sobre hardware/raspi/). Su diseño separa un núcleo independiente del transporte, que conoce los comandos, los modos y las transferencias, de los adaptadores que lo conectan con el exterior: el periférico BLE sobre BlueZ, el servidor HTTP, la cámara y el audio.

Esa separación permitió construir un emulador que ejecuta el mismo núcleo sobre la pila Bluetooth de macOS. Con él se pudo desarrollar y probar la aplicación contra un dispositivo simulado, sin depender de que la placa estuviera disponible, lo que resultó importante en los períodos en que la placa estuvo dañada (sec. 7.3.6).

El servicio expone un servidor HTTP en el punto de acceso propio, con cinco rutas: consulta de estado, generación de datos de prueba, captura y entrega de la última fotografía (1024 píxeles de lado mayor y calidad 70, unos 35 KB en 200 a 235 ms incluyendo la captura), recepción de audio para reproducir y entrega de la evidencia del modo ómnibus (sec. 7.4.9). Esta última ruta es una herramienta de desarrollo y se retirará antes de la versión final, porque se trata de fotografías de la vía pública que incluyen personas.

El 5 de octubre de 2026 el dispositivo dejó de ser visible desde el teléfono. La causa fue un bloqueo por software del Bluetooth que el sistema guardaba y restituía en cada arranque, de modo que el servicio se reiniciaba sin llegar nunca a anunciarse. La corrección llevó a revisar el arranque completo con un criterio: el teléfono sólo encuentra al dispositivo cuando éste anuncia, por lo que nada debe demorar ese anuncio. El servicio levanta el bloqueo antes de iniciar, depende sólo de la pila Bluetooth (ya no espera a la red), registra el perfil y anuncia, y recién después inicia la cámara y el punto de acceso. También se eliminaron componentes del sistema que sólo servían en el primer arranque, una comprobación del servidor DHCP que agregaba 3 segundos en cada conexión del teléfono y una importación de la biblioteca de visión que detenía el servicio durante 13 segundos; el reconocedor de texto pasó a cargarse en un proceso aparte. Los tiempos, medidos sobre la Zero 2 W desde el inicio del núcleo, fueron:

| **Hito** | **Antes** | **Después** |
|---|---|---|
| El dispositivo anuncia por BLE | 27,0 s | 16,2 s |
| Punto de acceso disponible | ~29 s | 21,7 s |
| Cámara con el detector lista | 31,4 s | 21,3 s |
| Reconocedor de texto listo (modo ómnibus operativo) | 44,0 s | 33,6 s |

Fuente: bitácora del proyecto, 6 de octubre de 2026. Con el arranque nuevo el teléfono se conectó 0,3 segundos después del primer anuncio. Si el usuario activa el modo ómnibus antes de que el reconocedor esté listo, el dispositivo dice «preparando la lectura» y comienza a vigilar cuando puede.

Las opciones de ejecución se guardan en un archivo de configuración del sistema, fuera del paquete del servicio, para que se conserven tanto en las actualizaciones como al cambiar entre los dos modos de operación del dispositivo (sec. 7.3.4).

Desde septiembre el dispositivo arranca con el emparejamiento Bluetooth deshabilitado. Ninguna característica del perfil requiere autenticación, por lo que la aplicación no necesita un vínculo persistente, y deshabilitarlo evita los diálogos de emparejamiento que el teléfono mostraba al usuario. La red local del dispositivo usa una clave fija y su servidor HTTP no está autenticado; con una única unidad y sin un adversario plausible en el alcance de la tesis, el equipo aceptó ese riesgo para el prototipo y dejó como trabajo futuro una clave por unidad y un token por sesión (ADR 0003, actualización del 3 de noviembre de 2026; sec. 6.7).

### 7.3.3 Energía y autonomía

El consumo se estimó a partir de mediciones de terceros sobre el mismo hardware y está pendiente de verificación con instrumental propio:

| **Estado** | **Consumo estimado** |
|---|---|
| Espera (BLE anunciando, sin video) | 0,5 a 0,6 W |
| Activo (cámara, punto de acceso y detección en el sensor) | 2 a 3 W, pico ~0,6 A |

| **Celda** | **Dimensiones** | **Autonomía estimada** |
|---|---|---|
| LiPo 1000 mAh (incluida con el módulo; la que aloja la carcasa) | 40 × 30 × 8 mm, ~20 g | 1,5 a 2 h |
| LiPo 2000 mAh (mejora posible) | 50 × 34 × 10 mm, ~36 g | 3 a 4 h |

El nivel de batería se lee desde el 6 de octubre de 2026. El módulo de alimentación incorpora un monitor INA219, que el dispositivo lee por I2C (bus 1, dirección 0x43, confirmada escaneando el bus). Se lee la tensión de la celda; el porcentaje se obtiene de la curva de descarga de una batería LiPo y se suaviza para que no oscile con la carga. El valor viaja en el estado del dispositivo por BLE y la aplicación lo muestra y lo anuncia. Para un usuario que no puede consultar un indicador luminoso, conocer el nivel de batería por voz es un requisito de accesibilidad.

Falta instrumentar la línea de alimentación con un medidor en serie para reemplazar las estimaciones de la tabla por mediciones propias y obtener la autonomía real.

### 7.3.4 Los dos modos de operación del dispositivo

El dispositivo terminado consiste en unos lentes con un botón: no tiene teclado ni pantalla, ni una persona que administre su red. Durante el desarrollo, en cambio, el mismo hardware debe ser accesible para instalar versiones nuevas, depurar y medir. Ambas exigencias son incompatibles sobre una única radio: en el uso normal la placa crea su propio punto de acceso, al que se une el teléfono, y mientras ese punto de acceso está activo la placa no está conectada a ninguna otra red, por lo que no es accesible de forma remota.

Dejar el dispositivo siempre en un modo de desarrollo habría sido más cómodo, pero las mediciones no habrían correspondido al producto. Se optó por un interruptor explícito:

| **Estado del interruptor** | **Modo** | **Consecuencia** |
|---|---|---|
| Presente | Desarrollo | La placa se une a una red conocida. Hay acceso remoto e internet. La aplicación informa «red apagada» |
| Ausente | Producto | La placa crea su punto de acceso al arrancar (ADR 0003). No hay acceso remoto por la red doméstica |

El interruptor es un archivo en la partición de arranque de la tarjeta de memoria, que usa el sistema de archivos FAT y puede leerse y escribirse desde cualquier computadora sin herramientas especiales. Esta elección surgió después de que el equipo perdiera el acceso a la placa en más de una ocasión: un dispositivo sin pantalla debe poder configurarse sin entrar en él. En cada arranque un servicio lee el interruptor y genera la configuración con la que inicia el servicio principal, por lo que esa configuración no se edita a mano.

El enlace de control funciona igual en los dos modos, de modo que el dispositivo puede comunicarse con el teléfono aun cuando hay un problema de red. Como contrapartida, desde el teléfono ambos modos se ven iguales: en una ocasión una placa que el equipo creía en modo desarrollo estaba en modo producto y no había forma de advertirlo desde la aplicación.

En modo producto, el dispositivo sólo puede actualizarse desde la tarjeta o a través del enlace de control, y esa restricción dio forma al procedimiento de despliegue descrito en la sección 8.7. Como vía intermedia, se incorporó una herramienta que apaga el punto de acceso a través del enlace de control; la placa vuelve entonces a la red conocida y queda accesible sin abrir el dispositivo. La operación completa demora unos cinco segundos.

### 7.3.5 La carcasa

La carcasa debe alojar el conjunto real de componentes sobre la patilla de unos lentes, cerrarse sin tornillos para poder abrirla durante el desarrollo, proteger el cable plano de la cámara, dejar accesibles el encendido y la carga, y ofrecer un único botón que pueda encontrarse al tacto. Para quien la usa, que no puede ver dónde está el botón ni de qué lado está el encendido, la forma de la carcasa es parte de la accesibilidad del sistema.

Se partió de un modelo de un tercero (v0.8) y se rediseñó como modelo paramétrico en OpenSCAD (proyecto «VIA Clara», en hardware/case-via-clara/). Cada medida exterior se deriva de las del conjunto interior, de modo que corregir una medida real actualiza toda la carcasa. El conjunto, de la cara que apoya en la cabeza hacia afuera, está formado por las cabezas de los tornillos bajo el módulo de alimentación, el módulo, la batería de 40 × 30 × 8 mm, la Raspberry Pi Zero 2 W y, sobre ella, el conector de pines soldado y los separadores hexagonales. El cuerpo son dos mitades unidas por trabas a presión. Cada traba es una viga que corre a lo largo de la junta, dentro de la pared, y flexiona en el plano de la cama de impresión y no a través de las capas, que es la dirección en la que una pieza impresa se rompe. Completan el diseño un brazo que sostiene el transductor de 14 mm contra la cabeza, con una tapa que se fija a presión, dos puentes para un elástico plano de 6 mm y el botón, rodeado por un anillo en bajorrelieve.

El principal problema fue que las verificaciones del modelo se hacen contra maquetas de los componentes, y cada impresión mostró algo que las maquetas no tenían. La carcasa avanzó, por lo tanto, en ciclos de impresión, armado y corrección. La tabla resume la secuencia (bitácora del proyecto, 14 de octubre a 12 de noviembre de 2026):

| **Versión** | **Lo que mostró la impresión o el armado** | **Cambio en la versión siguiente** |
|---|---|---|
| v0.8 | Sin imprimir; suponía un conjunto de 16,5 mm de espesor, frente a los ≈ 23 mm reales | v0.9 rehecha sobre el conjunto real |
| v0.9 (14 de octubre) | Encajó casi todo, pero los separadores estaban del lado de la placa, la tarjeta de memoria no entraba, las paredes eran más gruesas de lo necesario y la imagen salía girada 90° | Paredes de 1,6 mm; cámara girada en su plano |
| v0.10 (17 de octubre) | Falló: guías de la cámara de 0,65 mm que la impresora no reproduce, botón sobre el disipador de la placa, ranura de la tarjeta en espejo, pernos traseros que se rompían | Medidas tomadas con calibre; ningún detalle funcional menor a 1,2 mm; trabas traseras en lugar de pernos |
| v0.11 (21 de octubre) | Se probaron dos variantes; la de tapa separada exigía demasiados ajustes. En la integrada el lente no entraba y las trabas delanteras, unidas a las guías de la cámara, no flexionaban y se partieron | Se descarta la variante con tapa; trabas delanteras detrás de las guías |
| v0.12 a v0.15 (22 a 26 de octubre) | Piezas de prueba parciales: la ranura de la cámara, el paso del cable plano y el tamaño real de los separadores hexagonales (5,0 mm entre caras) | Alojamientos hexagonales huecos; copa redonda para el auricular; botón como cilindro pegado al pulsador |
| v0.16 a v0.19 (26 a 29 de octubre) | Los alojamientos levantaban la placa y las mitades no cerraban; el auricular no entraba en la copa | Alojamientos 2 mm más profundos; copa de 17 mm; la llave del módulo y la corredera impresa se reemplazan por un interruptor deslizante de panel, cuyos pernos de fijación se midieron con piezas de prueba |
| v0.20 (30 de octubre) | Impresa y armada con todo el hardware; el ajuste fue correcto, pero la fotografía salía girada 90° respecto de la vista del usuario | Se integra al repositorio con los archivos de impresión de todas las versiones (PR #124) |
| v0.21 y v0.22 (1 de noviembre) | Dos alternativas para corregir la orientación: girar la carcasa entera o girar sólo la cámara | Se elige girar sólo la cámara (v0.22) |
| v0.23 y v0.24 (5 de noviembre) | El cable plano de la cámara necesitaba espacio para enrollarse y la tapa del auricular no fijaba | Cámara 2 mm más lejos de las placas; tapa 1,5 mm más alta; ranura de la tarjeta corrida 1 mm. La v0.24 se imprimió con buen resultado |
| v0.25 (9 de noviembre) | Los conectores de la placa sobresalen 2,0 mm y no 0,8; la patilla del lente pasaba sobre el brazo del auricular | Carcasa más alta (39,8 mm); botón centrado; alojamientos de 5,5 mm; brazo y elástico reubicados; trabas más anchas |
| v0.26 (9 de noviembre) | La patilla todavía tocaba el brazo | 11 mm entre el elástico y el brazo, el máximo que admite la cara plana; se integra al repositorio (PR #129) |
| v0.27 (10 de noviembre) | Se separa la copa del auricular del brazo, para imprimirla como pieza aparte | Copa que se encastra en el brazo, con un canal interno para el cable; impresa con buen resultado salvo el encastre |
| v0.28 (11 de noviembre) | El encastre entre el brazo y la copa de la v0.27 quedaba flojo | Por error se supuso lo contrario y el enchufe se achicó a 5,1 mm, con lo que quedó todavía más flojo |
| v0.29 (12 de noviembre) | Se probaron enchufes de 5,8, 6,0 y 6,2 mm; el de 6,0 mm calzó correctamente | Versión final: impresa y armada con el enchufe de 6,0 mm; se integra al repositorio (PR #131) |

Varios hallazgos de esa secuencia cambiaron el diseño y no sólo una medida.

El primero fue la orientación de la cámara. Con la v0.20 armada y colocada en la patilla, la fotografía salía girada 90° respecto de la vista del usuario. En una cámara convencional bastaría con girar la imagen por software, pero en este sistema el detector YOLO se ejecuta dentro del sensor IMX500, sobre la imagen tal como la capta el sensor, antes de que llegue a la placa. El sensor permite invertir la imagen pero no girarla 90°, y girar la imagen en la placa no cambiaría lo que ve el detector. La cámara, por lo tanto, no podía quedar de costado: su orientación física dentro de la carcasa tenía que coincidir con la vista del usuario. Se imprimieron dos alternativas, girar la carcasa completa (v0.21) o girar sólo la cámara un cuarto de vuelta en su plano (v0.22), y se eligió la segunda porque conservaba el resto del diseño ya validado. El cable plano pasó a bajar por el piso de la carcasa y subir frente a la placa, y la v0.23 le dejó 2 mm más de espacio para enrollarse.

El segundo fue el encendido. El módulo de alimentación trae su propia llave deslizante, soldada sobre la placa y alejada de la pared de la carcasa. En las primeras versiones se la alcanzó con una corredera impresa que llevaba la palanca hasta una ventana, pero era una pieza más, frágil y difícil de ajustar. Se optó por desconectar la llave del módulo y cablear en su lugar un interruptor deslizante de panel, que se pega del lado de adentro de la pared con la perilla asomando por una ventana de 4,2 × 7,4 mm. La carcasa incorpora dos pernos de 2,3 mm, separados 14,8 mm, que entran en los agujeros de la pestaña del interruptor y lo ubican antes de pegarlo; esas medidas se ajustaron con cinco piezas de prueba (v0.18 a v0.20).

El tercero fue la resolución de la impresora: ningún detalle funcional baja de tres líneas de extrusión (1,2 mm), porque un nervio de 0,65 mm no se reprodujo aun con la máxima calidad. El cuarto fue el pulsador: el real es un SMD de 4 × 4 × 1 mm con un actuador de menos de 1 mm, por lo que lleva encima una tecla impresa.

Un guion (export.sh) regenera las piezas, las imágenes y una guía de armado, y comprueba que cada pieza imprimible sea un único sólido apoyado en la cama. Ejecuta además verificaciones de interferencia entre volúmenes: las mitades entre sí, cada mitad contra placas, batería, interruptor, cámara, pulsador, tornillos y separadores, el recorrido del cable plano, el brazo y los caminos de armado, y no sólo la posición final. El guion falla si alguna verificación detecta una interferencia. Su alcance está limitado por las maquetas: una verificación contra una medida supuesta no garantiza nada sobre la pieza real, y eso fue lo que hizo fallar la v0.10.

Las primeras versiones se imprimieron en una Creality Ender 3 V3 y las siguientes en una FLSUN T1 Max. El cambio se debió a la calidad de las piezas: la FLSUN dio bordes más definidos, mejor terminación superficial y soportes que se retiran con menos marcas, lo que importa en una pieza chica, con trabas y ranuras de pocas décimas de milímetro de juego. Las piezas se imprimen en PLA. La superficie exterior se imprime con textura (*fuzzy skin*), que mejora el agarre y disimula las líneas de capa; la mitad externa se imprime boca arriba, y la interna boca abajo da un exterior más prolijo, pero el borde de la junta pierde definición y las trabas enganchan peor, por lo que se recomendó quitar la textura en los primeros 3 mm y compensar el ensanchamiento de la primera capa (0,2 mm).

El equipo sometió el modelo al flujo de revisión multimodelo tackle-ticket, en el que revisores basados en distintos modelos (Opus, Sonnet, Haiku y Codex) examinan el mismo cambio por separado. En la v0.9 la revisión llevó las trabas al plano de la cama, reservó el volumen del cable plano de la cámara, que no tenía por dónde pasar, y agregó las verificaciones de los caminos de armado; en la v0.11 encontró que los apoyos que debían sujetar el conjunto no lo tocaban y que el lente no pasaba por el plano de la junta.

Los archivos de impresión de las versiones v0.9 a v0.29 están en el repositorio (hardware/case-via-clara/versions/). Con la carcasa final armada, queda pendiente verificar con ella los tiempos del botón (sec. 7.2.6).

### 7.3.6 Fallas de hardware durante el desarrollo

Varias fallas de hardware condicionaron el trabajo y se registran porque explican algunas de las mediciones de este capítulo.

El conector de cámara de la primera Raspberry Pi Zero 2 W se dañó en septiembre de 2026. Entre el 9 y el 18 de septiembre el desarrollo continuó sobre una Raspberry Pi 3 B+ prestada, con el mismo sistema operativo y la misma interfaz de cámara pero con otro controlador de radio. Desde el 19 de septiembre se volvió a una Zero 2 W. Las cifras tomadas sobre la Pi 3 B+ se identifican como tales donde aparecen. La placa actual no tiene puerto Ethernet y su WiFi opera sólo en 2,4 GHz, lo que obligó a definir las vías de acceso descritas en la sección 8.7.

El 28 de octubre, al cerrar la carcasa, el sensor de la cámara se desconectó de su propio módulo (el conector pequeño entre el sensor y la placa de la cámara, no el cable plano). El síntoma era que la placa dejaba de detectar la cámara. Volver a asentar el conector lo resolvió, y se tuvo en cuenta en las versiones siguientes de la carcasa para que no presione esa zona.

A comienzos de noviembre la Zero 2 W en uso volvió a dañarse y se reemplazó por una nueva. Como la tarjeta de memoria era la misma, la placa nueva arrancó con toda la configuración y el servicio instalado, y el sistema volvió a funcionar desde la aplicación, incluida la lectura de supermercado. La única diferencia fue el audio: en la placa nueva el auricular se escuchaba con un volumen casi nulo. Se descartó una causa de software (la configuración de audio estaba cargada, el pin correcto entregaba la señal PWM y la reproducción no daba errores). Al medir el auricular resultó ser de 4 ohmios y no de 16 a 32, como se había supuesto: con la resistencia de 100 ohmios en serie le llegaba aproximadamente el 4% de la tensión, y el pico de corriente (unos 32 mA) duplicaba lo que admite un pin de propósito general. Se propuso una resistencia de 260 ohmios, que limita el pico a unos 12,5 mA, y un capacitor de acoplamiento de 47 a 100 µF que elimina la componente continua de la señal PWM. Para que ambos componentes entren en la carcasa, el PR #130 propone trasladar la salida a los pines físicos 12 (señal) y 14 (masa), el otro par del conector con salida PWM y el más cercano a la tarjeta de memoria. El PR no está integrado: la configuración de la tarjeta de la placa ya se cambió a esos pines, pero al 12 de noviembre falta soldar el auricular con esos componentes y probarlo. Aun así, un pin de propósito general no puede entregar el volumen que necesita un auricular de 4 ohmios, por lo que la solución definitiva requiere un amplificador (sec. 10.1).

## 7.4 El pipeline de reconocimiento de líneas de ómnibus

Este pipeline es el componente de mayor complejidad técnica del proyecto y el único que se desarrolló en un repositorio propio (bus-banner-recognizer), porque su ciclo de trabajo (construir el conjunto de datos, entrenar, evaluar y exportar) es independiente del de la aplicación. El dispositivo lo utiliza como una dependencia instalable.

### 7.4.1 Estructura general

\[FIGURA 7.6: Los cinco pasos del pipeline de ómnibus, del cuadro de cámara al anuncio de voz.\]

```
cuadro de la cámara
├─ 1. detección del ómnibus            (YOLO)
├─ 2. detección del cartel frontal     (YOLO)
├─ 3. recorte del cartel               (geometría)
├─ 4. lectura del recorte              (OCR)
└─ 5. interpretación y reparación      (parseo + catálogo de líneas)
→ anuncio de voz pregrabado
```

El cartel se recorta antes de leerlo porque, si el OCR recibiera el cuadro completo, leería también la matrícula, los carteles laterales y la publicidad del vehículo, y sería necesario decidir cuál de esos textos corresponde a la línea. El recorte reduce ese problema de interpretación a un problema geométrico.

Cuando hay varios vehículos en el cuadro se selecciona el de mayor área, que es el más cercano, y ante áreas equivalentes el más centrado. De esta forma, el criterio de priorización planteado como objetivo del proyecto se resuelve a partir de la geometría de las cajas delimitadoras.

El cartel frontal que contiene número y destino es una franja ancha, por lo que se exige una relación de aspecto mínima de 2,0 y se lo busca en la mitad superior del vehículo. Esa condición descarta los carteles cuadrados (los que sólo muestran el número y los laterales), que no se quieren leer.

### 7.4.2 El conjunto de datos

El conjunto de entrenamiento del detector fue construido y etiquetado manualmente por Magalí Dellapiazza en la plataforma Roboflow (versión 6 del conjunto find-bus-sign):

| **Propiedad** | **Valor** |
|---|---|
| Imágenes totales | 140 |
| Partición | entrenamiento 98 · validación 28 · prueba 14 |
| Clases | 1 (bus_sign) |
| Formato de anotación | YOLOv11 |
| Preprocesamiento | Reorientación automática, redimensión a 640×640 |
| Aumentación en el export | Ninguna |
| Licencia | Dominio público |

Para el detector de dos clases (sec. 7.4.4) se necesitaba además la clase bus. En lugar de volver a etiquetar a mano las 140 imágenes, las cajas de ómnibus se generaron por pseudoetiquetado con un modelo YOLO11x preentrenado sobre COCO, que ya incluye la categoría bus, y se revisaron manualmente una por una. Se conservó la misma partición. Para el reentrenamiento en GPU (sec. 7.4.3) el conjunto se amplió a casi 400 fotografías.

Para evaluar el pipeline completo se construyó un conjunto propio, independiente del de entrenamiento, anotado con lo que el sistema debe decir:

| **Propiedad** | **Valor** |
|---|---|
| Imágenes | 117 |
| Con ómnibus presente | 102 |
| Con cartel legible | 68 |
| Con número esperado | 48 |
| Con destino esperado | 56 |
| Procedencia | tres videos (45 / 32 / 26 imágenes) y el conjunto de prueba de Roboflow (14) |

Cada fila registra la imagen, el número y el destino esperados, la presencia de ómnibus y de cartel, y una nota con el texto literal del cartel cuando difiere de la denominación oficial.

Los tres videos de origen provienen de redes sociales y no de la cámara del dispositivo, por lo que todas las métricas de esta sección corresponden a imágenes distintas de las de uso real. La construcción de un conjunto de evaluación con fotografías tomadas por el propio dispositivo es la principal tarea pendiente de este componente; la evidencia que guarda el modo ómnibus (sec. 7.4.9) se incorporó para ese fin.

Se construyó además un catálogo de líneas a partir de los datos abiertos del Sistema de Transporte Metropolitano de la Intendencia de Montevideo (data/catalog_stm.csv): 504 filas con 257 destinos distintos, de las cuales 502 son pares de número y destino entre 145 números de línea y las dos restantes son carteles sin línea (COCHE ESCUELA y FUERA DE SERVICIO). El catálogo se usa para corregir la salida del OCR, para decidir qué se puede anunciar y completar la parte del cartel que no se leyó (sec. 7.4.8), y para generar los anuncios pregrabados (sec. 7.4.12).

### 7.4.3 El entrenamiento del detector

El detector es un YOLO11n ajustado por aprendizaje por transferencia (*fine-tuning*) a partir de los pesos preentrenados sobre COCO. La familia YOLO11 ofrece cinco tamaños (sec. 3.3.2); se eligió el más pequeño, nano, porque es el único que entra en la memoria del sensor de la cámara una vez convertido.

Los hiperparámetros están escritos en el script de entrenamiento del repositorio, con su justificación:

| **Hiperparámetro** | **Valor** | **Fundamento** |
|---|---|---|
| epochs | 120 | Con paciencia de 25 épocas para detención temprana |
| imgsz | 640 | La entrada del sensor es un encuadre de 640×640 |
| batch | 32 |  |
| cos_lr | activo | Programación coseno de la tasa de aprendizaje |
| close_mosaic | 15 | Desactiva el mosaico en las últimas épocas |
| fliplr / flipud | 0,0 / 0,0 | Reflejar un cartel produce texto espejado, por lo que la aumentación por reflexión, habitual en detección, es contraproducente |
| hsv_h | 0,01 | El color ámbar del cartel LED es una señal fuerte y no conviene alterarla |
| hsv_s / hsv_v | 0,5 / 0,6 | La saturación y el brillo sí se alteran, para modelar la variación de la iluminación |
| degrees / shear / perspective | 5,0 / 2,0 / 0,0005 | Modelan el ángulo de captura desde la vereda |
| mixup | 0,05 |  |

El equipo no contó con una GPU durante buena parte del desarrollo. Las dos primeras corridas (el detector de una clase y el de dos clases, este último el 15 de septiembre de 2026) se entrenaron en CPU con una configuración reducida: 40 épocas y lote de 16, sobre las 140 imágenes de la sección 7.4.2. Más adelante la empresa Arnaldo Castro S.A. facilitó un servidor con GPU NVIDIA Tesla V100, y en octubre el detector de dos clases se reentrenó allí con casi 400 fotografías.

\[PENDIENTE: épocas y configuración efectivamente usadas, métricas de validación y evaluación sobre las 117 imágenes del reentrenamiento en la V100.\] Mientras esas cifras no se incorporen, las métricas de las secciones 7.4.4 y 7.4.5 corresponden a los modelos entrenados en CPU con 40 épocas, y deben leerse como un valor mínimo.

### 7.4.4 Elección entre detector de dos etapas y de una etapa

Esta es la decisión de modelado central del pipeline y estuvo determinada por una restricción de hardware. Se evaluaron dos alternativas:

- Dos etapas: un YOLO11n preentrenado sobre COCO localiza el ómnibus (la categoría bus ya existe en COCO) y un segundo YOLO11n, ajustado, localiza el cartel dentro de él. Requiere dos modelos y dos inferencias por cuadro.
- Una etapa: un único YOLO11n ajustado sobre dos clases (bus_sign y bus). Requiere un modelo y una inferencia.

La comparación vigente sobre las 117 imágenes de evaluación se realizó el 12 de octubre de 2026 en una computadora de escritorio, con el código del PR #7 de bus-banner-recognizer (reconocedor latino y reglas del catálogo de la sección 7.4.8):

| **Detector** | **Número** | **Destino** | **Lectura completa** | **Detección (mediana)** |
|---|---|---|---|---|
| Dos etapas | 91,7% | 89,3% | 91,7% | 35 ms |
| Una etapa (dos clases) | 91,7% | 85,7% | 87,5% | 18 ms |

Una sola imagen, el cartel nocturno de la línea 109, modifica el número en unos dos puntos: según un píxel de recorte se lee 109 o 10, y el resultado cambia entre versiones de onnxruntime y OpenCV. Son cifras del modelo entrenado en CPU.

Una comparación anterior, de septiembre de 2026 y previa a las reglas del catálogo, muestra además el efecto del margen vertical del recorte (sec. 7.4.6):

| **Detector** | **Margen vertical** | **Número** | **Destino** | **Lectura completa** | **Detección (mediana)** |
|---|---|---|---|---|---|
| Dos etapas | 0,12 | 91,7% | 75,0% | 87,5% | 38 ms |
| Dos etapas | 0,06 | 89,6% | 76,8% | 87,5% | 38 ms |
| Una etapa (dos clases) | 0,12 | 85,4% | 69,6% | 79,2% | 21 ms |
| Una etapa (dos clases) | 0,06 | 89,6% | 71,4% | 83,3% | 21 ms |

El esquema de dos etapas lee mejor: en la medición vigente supera al de una etapa en 4,2 puntos de lectura completa y en 3,6 puntos de destino, con el mismo resultado en el número. En la medición anterior, el ajuste de los márgenes había reducido aproximadamente a la mitad la diferencia en lectura completa, pero no la del destino. Los errores de destino restantes provienen del reconocedor, que confunde el texto de la matriz de LEDs, y no de letras que quedan fuera del recorte.

A pesar de esa diferencia se eligió el detector de una etapa, porque el sensor sólo admite un modelo: con uno solo la ocupación llega al 90% (sec. 7.2.5) y el segundo no entra. El esquema de dos etapas obligaría a ejecutar al menos una de las inferencias en el procesador de la placa, lo que impediría la detección continua sin costo de procesador en la que se basa el modo vigilancia y aumentaría el tiempo por cuadro. Por lo tanto, adoptar el esquema de dos etapas implicaba prescindir de la detección continua. Se aceptó una pérdida acotada de precisión en el destino a cambio de que el sistema pueda vigilar la escena sin intervención del usuario.

El esquema de dos etapas se conserva implementado en el repositorio como referencia para un equipo sin restricción de memoria, y permite medir cuánto cuesta la limitación del hardware.

### 7.4.5 Métricas del detector y costo de la cuantización

Las métricas de detección del modelo en precisión flotante de 32 bits, sobre el conjunto de prueba (14 imágenes, 24 carteles), son:

| **Precisión** | **Exhaustividad** | **mAP@0,5** | **mAP@0,5:0,95** |
|---|---|---|---|
| 0,838 | 0,667 | 0,781 | 0,391 |

\[FIGURA 7.7: Curva precisión-exhaustividad del detector y matriz de confusión normalizada, sobre el conjunto de prueba.\]

Para cargarlo en el sensor, el modelo se convierte a enteros de 8 bits mediante cuantización posterior al entrenamiento: los pesos se redondean a enteros con factores de escala por canal y algunas activaciones se conservan en 16 bits. La calibración utiliza las 28 imágenes de validación y no implica reentrenamiento. El supresor de no máximos queda incorporado en el modelo convertido, con umbrales fijos de confianza 0,25 e intersección sobre unión 0,7. El tamaño pasa de 5,2 MB a 2,64 MB.

El costo en precisión de esa cuantización no se pudo medir. El modelo convertido no puede cargarse fuera del entorno provisto por el fabricante, porque requiere operadores propietarios cuyas bibliotecas entraron en conflicto entre sí en todas las combinaciones de versiones probadas. La solución, un contenedor con el entorno del fabricante y un script que compara el modelo flotante contra el entero sobre la misma partición y con la misma métrica, está preparada en el repositorio y pendiente de ejecución. Es el riesgo abierto más relevante de este componente.

### 7.4.6 Ajuste de la geometría del recorte

El detector devuelve un rectángulo por objeto, ajustado durante el entrenamiento a los LEDs del cartel. En los carteles de Montevideo el número de línea está a la izquierda y el dígito «1» es un trazo vertical fino. Cuando el borde izquierdo del recorte cae sobre él, el OCR lo pierde o lo confunde con el borde de la imagen: en la placa, el 15 de septiembre, se leyó dos veces 15 donde el cartel decía 115 (sec. 7.4.11). Para evitarlo, el recorte se amplía alrededor de la caja con tres márgenes relativos: izquierdo, derecho y vertical. Se evaluó una grilla de 72 combinaciones sobre las 117 imágenes de evaluación.

El efecto del margen vertical, promediado sobre el resto de la grilla, es monótono:

| **Margen vertical** | **0,06** | **0,12** | **0,18** | **0,24** |
|---|---|---|---|---|
| Lectura completa | 0,819 | 0,812 | 0,810 | 0,770 |

Un margen vertical amplio incorpora el marco del cartel y las filas de LEDs vecinas, y el reconocedor, que lleva cada línea a una altura fija de 48 píxeles, dedica parte de esa altura a la carrocería. El valor se redujo de 0,12 a 0,06 el 16 de septiembre.

Los márgenes laterales son asimétricos, 0,18 a la izquierda y 0,06 a la derecha, porque el número de línea está a la izquierda y es el dato que no puede perderse. A diferencia del vertical, no se ajustaron contra el conjunto de evaluación: con 56 imágenes que tienen destino esperado, una sola imagen vale 1,8 puntos porcentuales, y optimizar sobre esa grilla sería ajustarse al conjunto y no al problema. Sólo se adoptó el cambio del margen vertical, cuyo efecto se mantiene en toda la grilla.

Los valores vigentes son SIGN_MARGINS = (0.18, 0.06, 0.06), como fracción de la caja (hardware/raspi/virovision/bus.py). Son los valores por defecto del pipeline, pero el dispositivo los pasa explícitamente porque dependen del modelo que dibuja la caja, y el modelo se elige en el dispositivo.

El 21 de octubre se probó usar la caja del detector reentrenado sin márgenes, con la hipótesis de que un detector mejor entrenado ya no los necesitaba. Contra un video en pantalla el «1» quedó dentro del recorte, pero en otras pruebas se siguió perdiendo, y el 22 de octubre se volvió a los márgenes medidos (PR #122). Con el zoom digital (sec. 7.4.10), una lectura se descarta si la caja con márgenes queda fuera del cuadro ampliado, ya que de lo contrario el margen izquierdo se cortaría en el borde y el primer dígito volvería a perderse.

### 7.4.7 La lectura: comparación de motores de OCR

Para leer el recorte se compararon motores de OCR detrás de una misma interfaz, sobre el mismo conjunto y con los mismos recortes:

| **Motor de OCR** | **Número** | **Destino** | **Lectura completa** | **Tiempo (mediana)** |
|---|---|---|---|---|
| PP-OCRv5 vía ONNX (elegido; se ejecuta en la placa) | 89,6% | 78,6% | 85,4% | 7 ms |
| PaddleOCR 3.x con su entorno de ejecución nativo | 89,6% | 76,8% | 79,2% | 118 ms |
| PP-OCRv4 vía ONNX (RapidOCR) | 87,5% | 73,2% | 75,0% | 81 ms |

Tesseract se consideró como línea de base clásica. \[PENDIENTE: su resultado sobre el conjunto de 117 imágenes no quedó registrado.\]

La métrica no fue el único criterio. El entorno nativo de PaddleOCR no tiene una distribución compilada para la placa: las versiones disponibles para ARM de 64 bits llegan hasta Python 3.12 y el sistema operativo de la placa usa Python 3.13. Ejecutar los mismos modelos exportados a ONNX resolvió a la vez la disponibilidad, la precisión y la latencia. El OCR ocupa unos 140 MB de memoria en la placa.

Dos ajustes de configuración tuvieron un efecto mayor que el cambio de modelo. El primero fue el reconocedor por alfabeto: la configuración por defecto usa un reconocedor de 18.000 clases pensado para chino e inglés, que no incluye la Ñ. El reconocedor latino tiene 503 clases, incluye la Ñ y las vocales acentuadas y pesa la mitad; con él, el acierto del número pasó de 79% a 92% y la lectura completa de 79% a 88%, con la misma latencia. El segundo fue el detector de texto interno del OCR, que con sus parámetros por defecto dividía el cartel en fragmentos sin sentido ('5', 'BRAI', 'E'); con el lado máximo ajustado a 320 píxeles lee ('115', 'LUIS BRAILLE') en 25 ms.

### 7.4.8 Interpretación y reparación contra el catálogo

La salida del OCR se interpreta buscando al comienzo un código de línea, formado por hasta cuatro dígitos con un prefijo de letras opcional, y tomando el resto del texto como destino. Los prefijos admitidos (CE, BT, D, E, G y L) se tomaron del catálogo de la STM, en el que 54 de los 145 códigos de línea llevan letras (por ejemplo L12, D10, G8 o CE1). Dos códigos del catálogo, G y PA, no tienen dígitos, por lo que el intérprete no los reconoce. Al interpretar el código, las letras que el OCR confunde con dígitos (O por 0, I por 1) se corrigen sólo después del prefijo. Luego la lectura se valida contra el catálogo (sec. 7.4.2).

El catálogo corrige primero los errores sistemáticos del reconocedor. En la primera ejecución sobre la placa, el registro muestra la entrada 15 LUIS BRALLE y la salida 115, LUIS BRAILLE. La comparación tolera dígitos confundidos con letras y espacios perdidos (MEMID0ZAE y ME MDOZA E se reconocen como MENDOZA), con resguardos para no elegir un destino real pero equivocado: un mínimo de cuatro letras y un margen de 0,05 sobre el siguiente lugar distinto. Las variantes ortográficas de un mismo lugar en los datos abiertos no compiten entre sí.

El catálogo decide también qué se anuncia. En una prueba sobre la placa el sistema anunció «Bus 1» a partir de lecturas sin sentido (1M12) y deletreó destinos ilegibles (U2 NOEVR). Desde el 6 de octubre de 2026 sólo se anuncia lo que el catálogo conoce: una línea que no existe no se anuncia, y un destino que no coincide con ninguno no se dice. Para una persona que no ve, «línea 330» sin destino es una respuesta útil, mientras que un destino deletreado no lo es. Sobre las 117 imágenes, el acierto del destino pasó de 76,8% a 89,3% (docs/SESSION-LOG.md, 2026-10-06).

Por último, el catálogo completa la parte del cartel que no se leyó. Desde el 7 de octubre, cuando la confianza del OCR es menor a 0,8, se completa la mitad faltante sólo si no es ambigua: un destino que corresponde a una única línea da esa línea (116 de los 257 destinos) y una línea con un único terminal da ese destino. Lo inferido se registra por separado de lo leído, no cuenta como voto (la misma lectura dudosa se repetiría cuadro a cuadro y se confirmaría a sí misma) y nunca reemplaza dígitos que el OCR sí leyó.

### 7.4.9 El modo vigilancia

El modo ómnibus no consiste en tomar una fotografía. El usuario no ve venir el ómnibus y no puede elegir el momento de la captura; si el sistema esperara un gesto por cada vehículo, el gesto llegaría tarde. Por eso el modo se diseñó como vigilancia continua: mientras está activo, la cámara permanece abierta y el detector se ejecuta en cada cuadro dentro del sensor.

La lógica de anuncio es la siguiente:

1. Cuando una caja de ómnibus aparece y se mantiene durante un número de cuadros proporcional a la tasa de captura, se confirma su presencia y se anuncia que se acerca un ómnibus.
1. Cuando el cartel alcanza una altura legible (22 píxeles), se recorta y se lee.
1. Una lectura confirmada por el catálogo en ambos campos se anuncia de inmediato; en caso contrario, se espera a que dos lecturas coincidan. Si sólo se leyó el número o el destino, se esperan algunas lecturas más a que aparezca la otra parte.
1. Cada ómnibus se anuncia una sola vez.

Un seguidor de objetos mantiene la identidad de cada vehículo entre cuadros y estima si se acerca o se aleja, comparando el área en el último tercio de su trayectoria con la del primero. Hay dos temporizadores de supresión, de 15 segundos para el anuncio de presencia y de 10 segundos para una línea recién anunciada, que se incorporaron por un defecto observado en la primera ejecución sobre la placa (sec. 7.4.11).

Desde el 12 de octubre de 2026 (PR #114) el modo guarda el cuadro y el recorte exacto que leyó el OCR, asociados al registro de telemetría de esa lectura, en un almacenamiento privado del servidor. Permiten revisar qué vio el sistema cuando anunció, o no anunció, una línea, y son la base del conjunto de evaluación con fotografías del propio dispositivo (sec. 7.4.2).

### 7.4.10 Zoom digital sobre el cartel

En una prueba de campo del 19 de octubre de 2026 el ómnibus se detectó desde lejos, pero el cartel sólo fue legible con el vehículo prácticamente encima, demasiado tarde para uno que no se detiene. La causa es la resolución: el cuadro del que sale el recorte tiene 1024 píxeles de ancho (1024×766) sobre un sensor de 4056, y un número a 20 metros ocupa del orden de 9 píxeles de alto (estimación, no medición). Ampliar el recorte después de capturarlo agranda la imagen borrosa pero no recupera el detalle.

Se evaluaron tres alternativas. El zoom óptico no es posible porque la cámara tiene lente fija. Un zoom digital fijo reduciría el campo de visión también cuando no hay ómnibus. Se eligió un zoom digital dinámico en el procesador de imagen de la placa (ADR 0006, actualización del 19 de octubre de 2026). El zoom se centra en el cartel alargado de mayor área que ve el detector y aumenta hasta que el cartel mide unos 64 píxeles de alto (más no aporta, porque el reconocedor lo lleva a 48), sin que ocupe más de la mitad del ancho del cuadro, para tolerar el movimiento de la cabeza. Si el detector pierde el cartel, el zoom se mantiene 1,5 segundos y vuelve a 1x. El detector sigue viendo el campo completo, porque su zona de entrada es un control propio del IMX500, independiente del recorte del procesador de imagen; sólo la caja que va al OCR se traduce al cuadro ampliado (hardware/raspi/virovision/zoom.py).

Medición en la placa (22 de octubre de 2026, Zero 2 W, contra un video de la línea 115 en pantalla; docs/mediciones/2026-10-22-zoom-omnibus.md):

| **Qué** | **Resultado** |
|---|---|
| Zoom con el cartel en cuadro | 2,0x |
| Cuadros con detecciones, por intervalo de 5 s | entre 68 y 76, a 15 cuadros por segundo |
| Cartel lejano (~10 px de alto; el mínimo sin zoom es 22 px) | anunciado a los 7,6 s, tras tres lecturas ilegibles |
| Cartel más cercano | anunciado a 1,0 s, con una lectura |
| Modo de sensor completo (hasta 4x) | 10 cuadros por segundo, 65 MB libres de 415 y la cámara se bloqueó |

En el modo de sensor que usa la placa el máximo práctico es 2x; el modo de sensor completo, que permitiría 4x, se descartó en la Zero 2 W. Falta la prueba en la calle, con y sin zoom, midiendo a qué distancia se anuncia la línea. Si el límite resulta ser el detector, que desde lejos no encuentra el cartel, la siguiente etapa consiste en mover también su zona de entrada hacia el ómnibus detectado.

### 7.4.11 Defectos detectados en la primera ejecución sobre el dispositivo

La primera ejecución del pipeline completo sobre la placa reveló cinco defectos que las pruebas en la computadora de desarrollo no habían mostrado, lo que confirmó la regla metodológica de la sección 5.2.2 de validar sobre el hardware real:

1. Un mismo ómnibus se anunció dos veces en un segundo. Al moverse la cámara, el seguidor perdió el vehículo y lo volvió a registrar como uno nuevo. Se agregó la supresión temporal por línea.
1. El OCR leía 15 donde el cartel decía 115, porque el borde izquierdo de la caja caía sobre el «1», un trazo fino que además queda junto al símbolo de accesibilidad para silla de ruedas que precede al número. Se aplicaron tres medidas: un margen izquierdo tres veces mayor que el derecho, medio voto para las líneas fuera del catálogo y la corrección por similitud.
1. El OCR no podía ejecutarse en el mismo hilo que la cámara. La biblioteca de captura da el sensor por perdido si nadie consume cuadros durante aproximadamente un segundo, y una lectura demora cerca de un segundo. Se separaron dos hilos comunicados por colas, lo que eliminó los errores de tiempo de espera del sensor.
1. La reproducción encadenada de audio fallaba: al solicitar dos archivos en una misma llamada al reproductor, el segundo no sonaba, y el destino nunca se escuchaba. Se pasó a una llamada por archivo, en cola.
1. El segundo intento de lectura, con la detección de texto del OCR activada, demoraba de 2 a 3 segundos en la placa. Se restringió a los casos en que la primera lectura no devolvió ni número ni destino.

### 7.4.12 Los anuncios pregrabados

El dispositivo no sintetiza voz en el modo ómnibus: reproduce archivos de audio pregrabados almacenados en su tarjeta de memoria. Son 386 archivos (los números de línea, 239 destinos y algunos mensajes generales) generados a partir del catálogo con una voz en español, a 175 palabras por minuto, en formato monoaural de 22 kHz y 16 bits, de unos 30 KB cada uno.

Se optó por audio pregrabado porque un anuncio que depende de la nube para generarse dejaría de funcionar justamente sin conexión, lo que contradice el ADR 0001. El mismo criterio se aplica a los avisos de sistema (sec. 7.6.3).

### 7.4.13 Líneas con letras y cobertura fuera del centro

El procesamiento local del modo ómnibus se justifica sobre todo fuera del centro de Montevideo: en los barrios periféricos y en las localidades del interior la cobertura de datos móviles es más débil, y es donde un sistema que dependiera de la nube dejaría de funcionar (sec. 7.2.4). En esas zonas, sin embargo, los carteles tienen un formato distinto del que domina en el centro, donde la línea es un número de dos o tres dígitos seguido del destino.

En la periferia de Montevideo circulan líneas locales y diferenciales del propio sistema metropolitano cuyo código combina letras y números (L1, L12, D10, G8, CE1, BT1, entre otras). El sistema las admite: el intérprete reconoce esos prefijos (sec. 7.4.8), el catálogo de la STM las incluye con sus destinos y hay anuncios pregrabados para ellas. Pero su reconocimiento prácticamente no está medido: de las 117 imágenes del conjunto de evaluación, sólo una corresponde a una línea con letras (la G), y la composición del conjunto de entrenamiento en ese aspecto no se relevó (sec. 7.4.2). Tampoco se evaluó si el reconocedor confunde las letras de esos prefijos con dígitos en la matriz de LEDs, que es el tipo de error que el catálogo corrige para los números.

Las líneas de otros sistemas, como las suburbanas e interdepartamentales operadas por otras empresas y las urbanas de otros departamentos, no están en el catálogo de la STM. Como el sistema sólo anuncia lo que el catálogo conoce (sec. 7.4.8), hoy esas líneas no se anuncian aunque el cartel se lea correctamente; el usuario sólo escucha que se acerca un ómnibus. Se eligió este comportamiento porque anunciar una lectura no validada lleva a errores peores (sec. 7.4.8), pero tiene como consecuencia que el sistema cubre mejor el centro, donde la conexión es menos necesaria, que la periferia y el interior. Ampliar el catálogo a esas líneas y agregar carteles periféricos a los conjuntos de entrenamiento y de evaluación es trabajo futuro (sec. 10.2).

## 7.5 El pipeline de reconocimiento de productos

### 7.5.1 Estructura

```
[Doble clic en el botón]
├─ 1. la placa captura y publica la fotografía  (HTTP sobre el punto de acceso)
├─ 2. la aplicación la descarga                 (~50 ms)
├─ 3. la envía al intermediario y de allí al modelo (~0,85 a 1,7 s)
├─ 4. el modelo devuelve tres campos             {tipo, marca, detalle}
├─ 5. la aplicación arma la frase en español
├─ 6. síntesis de voz                            (~1 a 1,5 s)
└─ 7. el audio vuelve a la placa y se reproduce   (~50 ms)
```

El tiempo total es de aproximadamente 3 segundos, dentro del objetivo de 3 a 4 segundos fijado por el equipo.

### 7.5.2 La respuesta estructurada y el orden de la frase

El modelo no devuelve un texto libre sino tres campos: tipo de producto, marca y detalle. La aplicación arma con ellos la frase que se pronuncia. El orden responde a la accesibilidad: el usuario escucha la frase completa antes de poder decidir, por lo que el dato que más distingue al producto va primero. Se dice «arroz Saman, Blue Patna 1 kg» y no «Blue Patna 1 kg, arroz». Además, cada campo puede faltar por separado, y una respuesta con dos de los tres datos sigue siendo útil.

En una prueba sobre la placa el dispositivo pronunció la palabra «null». Ocurrió al apuntar a algo que no era un alimento: el modelo respondió con un valor nulo, la aplicación no lo reconoció como respuesta válida y lo trató como texto libre. La corrección se hizo en los dos extremos: la instrucción al modelo exige devolver siempre el objeto con los tres campos, aunque estén vacíos, y la aplicación distingue el texto libre de una estructura de datos antes de enviar nada a la voz, de modo que un valor nulo, un objeto vacío o una respuesta con los nombres de los campos en otro idioma nunca se leen en voz alta.

### 7.5.3 Síntesis de voz

La síntesis utiliza por defecto la voz del sistema operativo. Cuando hay conexión puede usarse un servicio de síntesis en la nube, que genera un archivo de audio con instrucciones de pronunciación en español rioplatense. La necesidad de esas instrucciones se verificó en la placa: sin ellas, «Macarrones Adria» se pronunciaba con fonética inglesa.

### 7.5.4 Ampliación del alcance del modo supermercado

El alcance original del modo supermercado, fijado en la propuesta del proyecto, fueron los productos de la canasta básica. La delimitación respondía a que la precisión alcanzable era desconocida: un repertorio acotado permitía medir el problema y, si los modelos disponibles no alcanzaban, entrenar uno propio sobre un conjunto cerrado de productos.

Ese objetivo se cumplió. En la primera prueba con el dispositivo real, el 11 de septiembre de 2026, el modelo de nube identificó correctamente los productos de la canasta básica y también alimentos que no pertenecían a ella, entre ellos yerba suelta, sin que fuera necesario restringirlo. Mantener la canasta como límite implicaba pedirle al modelo menos de lo que podía hacer, por lo que se decidió ampliar el alcance a cualquier alimento, envasado, suelto, fresco o a granel, y a los productos de almacén (ADR 0006, actualización del 11 de septiembre de 2026). La instrucción al modelo se reescribió en ese sentido y el mensaje para cuando no se reconoce nada cambió de «no pude identificar el producto» a «Elemento no reconocible», porque el modo ya no se limita a productos envasados.

La ampliación no afectó los requisitos que el modo ya cumplía. El tiempo de respuesta sigue dentro del objetivo de 3 a 4 segundos (sec. 7.5.1), porque la latencia depende del modelo y del tamaño de la imagen y no de la amplitud de la pregunta (sec. 7.2.2), y el costo por lectura se mantiene en el orden de USD 0,0003. La estructura de la respuesta, con tipo, marca y detalle, tampoco cambió.

Con la ampliación se separaron dos conceptos que en la propuesta estaban unidos: lo que el sistema responde y lo que el sistema mide. El modo responde sobre cualquier alimento, mientras que la canasta básica se mantiene como conjunto de evaluación, es decir, como el repertorio contra el cual se reportan exhaustividad, precisión, exactitud y F1. Un conjunto acotado y reproducible es lo que permite comparar modelos entre sí, y no tiene por qué coincidir con lo que el usuario puede preguntar. Ese conjunto todavía no está construido con fotografías tomadas por el propio dispositivo (sec. 7.9).

La descripción del modo en la aplicación dice «Identifica alimentos y productos de supermercado», que es más amplia que lo que el modelo responde: ante un producto que no es un alimento, como uno de limpieza, el modelo devuelve los campos vacíos y el usuario escucha «Elemento no reconocible». Extender el modo al resto de los productos de supermercado es una ampliación posible (sec. 10.3).

### 7.5.5 Respaldo local del modo supermercado

El ADR 0001 admite la nube como acelerador siempre que exista un respaldo local. En el modo supermercado ese respaldo todavía no existe: sin conexión o sin credenciales, el sistema lo informa por voz y no realiza la lectura. El comportamiento es el previsto ante una falla, ya que el sistema no queda en silencio, pero no cumple todavía la garantía completa del ADR 0001.

Las alternativas exploradas para el respaldo fueron los modelos multimodales ejecutados en el teléfono (sec. 7.2.8): la visión con LiteRT-LM no funcionó en iOS, y con ExecuTorch el modelo más pequeño que funcionó requería 3 GB y 6,4 segundos por lectura. Un modelo multimodal pequeño, por ejemplo de la familia Gemma, sigue siendo el candidato, pero su evaluación sobre productos reales no se realizó y queda como trabajo futuro.

## 7.6 La aplicación móvil

### 7.6.1 Stack y estructura

| **Componente** | **Versión** |
|---|---|
| Expo SDK | 57 |
| React Native | 0.86 (Nueva Arquitectura, JSI) |
| React | 19 |
| TypeScript | modo estricto |

Al 9 de noviembre de 2026, el código de la aplicación (app/src) suma 140 archivos y 13.583 líneas: 102 archivos y 9.597 líneas de código, y 38 archivos y 3.986 líneas de pruebas. Está organizado en cuatro capas con una regla de dependencia en un solo sentido: componentes de interfaz, funcionalidades (con estado de React), servicios (infraestructura, sin React) y tipos compartidos. Los textos visibles están en un único módulo de internacionalización, con claves en inglés y valores en español.

### 7.6.2 Patrones de diseño recurrentes

Cinco patrones se repiten en el código y constituyen su arquitectura.

El primero es la combinación de interfaz, sustituto y selector. Cada servicio que depende de un módulo nativo expone una interfaz, un sustituto que falla de manera explícita y un selector que devuelve la implementación real si el módulo nativo está disponible. Esto permite ejecutar la aplicación completa en un entorno sin Bluetooth, como un simulador o las pruebas automatizadas, y hace que la falta de una capacidad se presente como un estado identificado y no como una excepción.

El segundo es el uso de un módulo con estado propio en lugar de un hook de React para el servicio de lectura. Inicialmente la solicitud del botón físico llegaba como estado de React y debía atravesar una cadena de actualizaciones para ejecutarse. Eso funcionaba con la aplicación en primer plano pero no con la pantalla bloqueada, que es el escenario real de uso. El módulo pasó a suscribirse directamente al cliente Bluetooth, y React lo observa mediante la API de suscripción a fuentes externas.

El tercero es la inyección de dependencias como funciones de acceso y no como valores. El servicio de lectura recibe funciones que devuelven el modelo seleccionado, la descarga de la foto o el envío de audio. Como la suscripción se instala una sola vez, si se recibiera el valor el sistema usaría siempre la configuración vigente al arrancar.

El cuarto es la separación entre las decisiones y el código nativo. Las decisiones (a qué salida enviar el audio, qué transporte usar, cómo interpretar un fragmento) son funciones puras, separadas del código que se comunica con el sistema operativo, lo que permite verificarlas con pruebas automatizadas (sec. 7.8).

El quinto son los contratos duplicados y verificados. Las definiciones que cruzan la frontera entre componentes (el perfil GATT, el catálogo de avisos, el esquema de telemetría, el registro de proveedores) existen en dos copias, y una prueba automatizada falla si dejan de coincidir.

Las restricciones de arquitectura se imponen con el analizador estático: su configuración prohíbe que los módulos de reconocimiento y de audio importen los servicios de nube o de telemetría, de acuerdo con los ADR 0001, 0006 y 0008. Antes esa restricción era un comentario en cada módulo, que no impedía violarla.

### 7.6.3 Gestión de la salida de audio

Es el subsistema más elaborado de la aplicación, porque la voz es la interfaz y una falla en él deja al usuario sin información.

La sesión de audio se configura en modo de mezcla con otras fuentes, en lugar de la opción por defecto del framework, que atenúa o interrumpe el resto del audio del sistema. En este caso el resto del audio incluye al lector de pantalla, que es la interfaz del usuario, y atenuarlo o interrumpirlo cortaría sus mensajes.

iOS concede pocos segundos de ejecución a una aplicación activada por una notificación Bluetooth, y el ciclo de lectura necesita más. Para mantener el proceso activo se reproduce en bucle un tono inaudible (40 Hz a −50 dBFS) mientras dura la lectura. Se descartó usar un archivo de silencio digital, porque es el recurso que el sistema operativo tiene más probabilidad de dejar de respetar.

Al solicitarse una lectura se reproduce un tono breve de confirmación, que le indica al usuario que el gesto se registró. Con el teléfono bloqueado en un bolsillo, ese tono es además la única forma de saber que la aplicación se activó.

Dos funciones puras deciden por dónde sale cada sonido, una para las lecturas y otra para los avisos de sistema. La elección del usuario (teléfono o dispositivo) se aplica a todo lo que suena: las lecturas de ambos modos, los avisos y la prueba de audio. Son dos funciones porque los avisos no necesitan síntesis: son archivos pregrabados en la tarjeta del dispositivo y pueden reproducirse sin internet, sin WiFi y sin credenciales. Si se usara una única función, los avisos relacionados con la red se reproducirían en el teléfono justo cuando el usuario eligió escuchar por el dispositivo. En todos los casos el teléfono funciona como respaldo, de modo que siempre se escucha una respuesta, y el motivo por el que un sonido pasó al respaldo se registra en la telemetría.

El catálogo de avisos es cerrado, y tres de ellos no tienen archivo pregrabado a propósito: el dispositivo no puede anunciar su propia ausencia; elegir el teléfono como salida envía la confirmación al teléfono; y el tercero corrige un bucle detectado en la placa. En ese caso el dispositivo respondía a un comando desconocido con un error, la aplicación convertía todo error del dispositivo en un aviso y el aviso volvía al dispositivo como otro comando. Desde entonces el dispositivo no informa sus propias fallas por esa vía.

También se detectó que, si se cambiaba la salida durante una frase, el teléfono y el dispositivo hablaban al mismo tiempo, porque cada salida podía interrumpirse a sí misma pero no a la otra. Se estableció que antes de hablar el teléfono le envía al dispositivo una orden de silencio, y antes de enviarle un aviso detiene su propia voz (ADR 0003, actualización del 18 de septiembre de 2026).

La lectura de un ómnibus se dice con su destino cuando lo hay, porque el destino distingue dos recorridos de la misma línea. Sin número se dice sólo el destino, y sin ninguno de los dos se informa que se acerca un ómnibus (app/src/features/recognition/format.ts).

Desde el ADR 0011 (6 de octubre de 2026) el texto de un error no se muestra ni se pronuncia: se registra en la telemetría (sec. 7.8.4) y el usuario escucha una frase fija, en lenguaje llano, que indica qué hacer. No se optó por omitir el mensaje, porque para quien no ve la pantalla el silencio después de presionar el botón no se distingue de un dispositivo roto.

### 7.6.4 Vinculación y gestión del enlace

La aplicación gestiona la conexión sin intervención del usuario. Se conecta al arrancar, reintenta con un retardo creciente si pierde el enlace, se une a la red WiFi del dispositivo con las credenciales recibidas por Bluetooth, espera a que el servicio responda y abandona esa red cuando el dispositivo apaga el punto de acceso. El usuario no necesita configurar la red.

Durante el desarrollo se corrigieron varios defectos de este módulo: la telemetría registraba cada notificación de estado aunque fuera idéntica a la anterior; la verificación de red se reiniciaba en cada notificación, lo que cancelaba la anterior e impedía que la red quedara lista; y la misma disponibilidad se anunciaba dos veces.

Con la salida de audio en el dispositivo, la aplicación dejó de poder unirse a la red WiFi. El anuncio de conexión, una escritura que no se esperaba, coincidía con la lectura de las credenciales, y la lectura volvía vacía. En lugar de reordenar esa llamada, el cliente Bluetooth pasó a encolar todas sus operaciones en el orden en que se solicitan (app/src/services/ble/serialize.ts), porque el mismo patrón aparecía en otros puntos del código y este tipo de defecto no genera errores visibles.

La pestaña del dispositivo muestra su nombre y, desde el 6 de octubre de 2026, el nivel de batería en texto, con un aviso por debajo del 20% (app/src/features/device/DeviceSummary.tsx). Para un usuario ciego, un indicador gráfico no aporta información.

### 7.6.5 Configuración

La pantalla de ajustes tiene cuatro bloques: el modo de la aplicación, la elección de por dónde se escucha, una descripción de lo que reconoce el sistema con un botón para probar el audio y, sólo en modo desarrollo, el selector de modelo. No tiene sección de apariencia (ADR 0010) ni de cuenta (sec. 7.6.6).

### 7.6.6 Autenticación de usuarios

La autenticación contra el servidor está implementada (correo electrónico y contraseña, con sesión persistente) pero no está conectada a la navegación, y la aplicación se publica sin inicio de sesión. La decisión, registrada en el ADR 0002, se basa en que el núcleo del producto es local y una cuenta no aporta valor al usuario. El código se conserva por si en el futuro se incorpora una sincronización opcional.

### 7.6.7 Modo producto y modo desarrollo

A medida que el sistema se probó, la pantalla de inicio acumuló información útil para el equipo pero innecesaria para el usuario: los campos de cada lectura, la fotografía del dispositivo, los ómnibus detectados con sus recortes y los mensajes de estado. Retirarla por completo habría eliminado una herramienta de trabajo del equipo, y mantenerla agregaba elementos que el lector de pantalla recorre antes de llegar al botón de lectura.

Desde el 2 de noviembre de 2026 (PR #125) la aplicación tiene dos modos, seleccionables en ajustes. En el modo producto, que es el predeterminado, la pantalla de inicio muestra el modo, sus botones y la última frase pronunciada, para que el lector de pantalla pueda volver a ella; el único mensaje de falla que se muestra es «El dispositivo no pudo sacar la foto», porque es el único que el usuario puede resolver en el momento. En el modo desarrollo se muestran además los campos de la lectura, las fotografías, los ómnibus detectados y el selector de modelo. En el modo producto la pestaña del dispositivo tampoco muestra la línea de estado de la conexión, que se comunica por voz. El modo se elige con una lista desplegable (PR #128), porque dos botones ocupaban demasiado espacio para una opción que sólo usa el equipo; al elegirlo, la aplicación lo anuncia («Modo producto»), con una demora de 600 ms para que no se superponga con el lector de pantalla que vuelve al botón. La elección se guarda en el teléfono, y cualquier valor desconocido o una falla de lectura llevan al modo producto. La decisión de qué se muestra en cada modo es una función pura con sus pruebas (app/src/features/reader/homeView.ts). La telemetría y la evidencia se registran igual en los dos modos, de modo que el equipo no pierde información al usar la aplicación como la usaría una persona ciega.

## 7.7 La accesibilidad como criterio de diseño

### 7.7.1 Fundamento

La elección de React Native se apoya en el trabajo de Mascetti et al. (2020) sobre accesibilidad en frameworks multiplataforma, que documenta que estos exponen sólo una parte de las capacidades de accesibilidad nativas. De ese resultado se derivaron tres reglas de trabajo:

1. Preferir componentes estándar correctamente anotados, que heredan el comportamiento del sistema operativo.
1. Evitar interfaces muy personalizadas, que son el punto débil identificado en ese trabajo.
1. Considerar la verificación con lectores de pantalla reales y las pruebas con personas ciegas como etapas obligatorias.

Por ejemplo, la barra de navegación es la barra nativa del sistema y no una dibujada en JavaScript, porque así hereda el manejo del foco, el rotor del lector de pantalla, los tamaños de texto dinámicos y la preferencia de movimiento reducido.

### 7.7.2 Reglas de diseño adoptadas

Cinco reglas se aplican en todo el código como criterio de aceptación de cualquier cambio de interfaz:

| **Regla** | **Implicación** |
|---|---|
| El estado nunca se comunica sólo por color | El color refuerza; el texto es lo que pronuncia el lector de pantalla |
| Un control ausente no comunica ningún estado | Un control que no se puede usar se deshabilita, con una pista que explica el motivo, en lugar de ocultarse |
| El botón cambia, no se reemplaza | Si un control se reemplaza por otro, el lector de pantalla pierde el foco |
| La voz es la interfaz | Una falla silenciosa deja al usuario esperando una respuesta que no llega |
| El silencio no es un resultado válido | Toda ejecución termina en un mensaje pronunciado |

Otras decisiones puntuales fueron:

1. Las tipografías se incluyen en el binario y no se cargan durante la ejecución, porque un cambio de fuente durante el arranque desplaza los elementos de la pantalla, lo que desorienta especialmente a una persona con baja visión.
1. El botón principal tiene borde en lugar de relleno: el verde de la marca alcanza 2,44:1 sobre el fondo claro, y el borde de un control requiere 3:1 según WCAG 1.4.11.
1. Cuando se agota la cuota de un servicio, la espera se anuncia, porque para quien no ve la pantalla una aplicación que espera no se distingue de una bloqueada.
1. Una segunda lectura solicitada durante una lectura en curso se ignora en lugar de encolarse, porque al terminar la primera la segunda correspondería a una escena que el usuario ya dejó atrás.
1. Cada lectura tiene un plazo máximo de 12 segundos, cuatro veces la mediana medida, y la descarga de la fotografía uno de 4 segundos.

### 7.7.3 La fotografía en pantalla

En el modo desarrollo la aplicación muestra la fotografía capturada por el dispositivo después de los campos del resultado. El orden responde a que la voz ya pronunció el resultado y el lector de pantalla debe llegar primero a lo que puede leer. La imagen sirve para que un usuario con resto visual o un acompañante verifique el resultado, y permite distinguir un error del modelo de una fotografía mal tomada.

El modo ómnibus no tenía un equivalente, porque el dispositivo lee de forma autónoma y por Bluetooth sólo llegaba el resultado. Desde el 12 de octubre de 2026 el dispositivo guarda, por cada ómnibus, el cuadro en que lo detectó y cada recorte del cartel que pasó al OCR, y la aplicación los descarga por WiFi (sec. 8.6.3). Desde el 13 de octubre la pantalla de inicio los muestra agrupados por ómnibus: el cuadro y, debajo de cada lectura, su texto y el recorte. El recorte es exactamente el que leyó el OCR, con sus márgenes, de modo que si el «1» de una línea quedó fuera o junto al borde, se ve en la imagen. Desde el 2 de noviembre estas imágenes sólo se muestran en el modo desarrollo (sec. 7.6.7) y, como el resto de la evidencia, se retirarán antes de la versión final.

## 7.8 Verificación

### 7.8.1 Cobertura de pruebas automatizadas

| **Componente** | **Pruebas** | **Alcance** |
|---|---|---|
| Aplicación móvil | 345 en 38 suites | Decisiones puras, contratos de frontera, contraste, orden de ejecución |
| Servicio del dispositivo | 197 (y 2 omitidas) | Núcleo independiente del transporte, gestos del botón, modos, modo ómnibus, zoom, batería, evidencia |
| Pipeline de ómnibus | 96 | Geometría del recorte, detector, seguimiento, interpretación, catálogo |

Cifras al 9 de noviembre de 2026 para la aplicación y el dispositivo (npx jest en app/ y pytest en hardware/raspi/), y al 22 de octubre de 2026 para el repositorio bus-banner-recognizer (rama feat/bus-line-reader, commit becd2f0).

Entre las pruebas, cuatro grupos reflejan mejor la orientación del proyecto. El primero verifica el contraste: implementa el cálculo de relación de contraste de WCAG y comprueba el nivel AAA (7:1) para texto, 4,5:1 para el color de acento y 3:1 para bordes de control, e incluye los límites conocidos de la paleta de marca y el motivo de cada corrección, de modo que un cambio de color que no cumpla el criterio hace fallar la compilación. El segundo verifica la lectura con la pantalla bloqueada: comprueba el orden de las etapas (confirmación acústica, envío y liberación de la sesión de audio) y no sólo el resultado, porque lo que puede fallar en ese escenario es la secuencia. El tercero cubre el enrutamiento de los avisos, incluido el caso de que nunca se devuelva al dispositivo una falla originada en él. El cuarto verifica los contratos duplicados: que la aplicación sólo nombre archivos de audio que el dispositivo tiene, que no queden archivos que nada pueda solicitar y que un comando de modo entre en una sola escritura Bluetooth.

### 7.8.2 Revisión de toda la base de código

Entre el 2 y el 3 de noviembre de 2026 se revisó la base de código completa con el flujo de revisión multimodelo (PR #126): cinco revisores en paralelo, cada uno sobre una parte (servicios de la aplicación, servicio del dispositivo, interfaz y servidor, contratos entre componentes, y pruebas e integración continua), seguidos de cuatro rondas de revisión sobre lo corregido. Los defectos encontrados no habían aparecido en las pruebas porque dependían de condiciones de uso poco frecuentes. Entre ellos:

- En la aplicación, el envío de audio a la placa no respetaba el plazo de 8 segundos; la copia de una lectura de ómnibus a la placa se enviaba aunque la salida elegida fuera el teléfono, y se escuchaban dos voces; al reconectarse, la aplicación no volvía a leer el modo del dispositivo, que podía haberse reiniciado; y sin red, la telemetría descartaba lotes completos de eventos.
- En el dispositivo, una pulsación del botón durante la carga del OCR no anunciaba «preparando la lectura»; el zoom del modo ómnibus no se deshacía antes de una foto de supermercado, que salía recortada; y una excepción al guardar la evidencia detenía la lectura.
- En el servidor, el intermediario de visión validaba el proveedor pero no la ruta, lo que permitía enviar la credencial a cualquier dirección del proveedor; además se agregaron límites de tamaño y de tiempo y un límite de solicitudes en la función de evidencia.

### 7.8.3 Pruebas dependientes del entorno de ejecución

Una prueba verificaba que, sin intermediario configurado, la solicitud se enviara directamente al proveedor. Pasaba en las computadoras del equipo y fallaba en la integración continua, porque la configuración se leía del entorno del proceso y el entorno era distinto en cada caso. La prueba dependía del entorno y no del código. Se corrigió haciendo inyectables las credenciales y el reloj que usa el limitador de solicitudes, y ese criterio se extendió al resto del código.

### 7.8.4 Telemetría como instrumento de medición

La aplicación registra eventos de ejecución en el servidor propio, con el tiempo de cada etapa por separado (descarga de la fotografía, lectura, síntesis y envío de audio) y no sólo el total, porque cada etapa falla o demora por motivos distintos. Esta información permitió detectar defectos que no se manifestaban en la interfaz y reemplazó a la información de diagnóstico que se retiró de la pantalla (sec. 7.2.7).

## 7.9 Limitaciones del prototipo

El prototipo cumple los dos casos de uso de punta a punta, pero con limitaciones que condicionan la lectura de los resultados de este capítulo:

- La evaluación del modo ómnibus se hizo sobre videos reproducidos en pantalla y sobre imágenes de redes sociales, no con el dispositivo en una parada real. La prueba en la calle, con y sin zoom, está pendiente (sec. 7.4.10).
- Las métricas del detector corresponden al modelo entrenado en CPU con 140 imágenes. Las del reentrenamiento en la GPU V100 no están documentadas, y el costo en precisión de la cuantización a 8 bits no se pudo medir (sec. 7.4.3 y 7.4.5).
- El reconocimiento de líneas con letras prácticamente no está medido, y las líneas fuera del sistema metropolitano no se anuncian (sec. 7.4.13).
- El modo supermercado depende de la nube: no tiene respaldo local (sec. 7.5.5), y su precisión se midió con una sola imagen, porque el conjunto de evaluación con fotografías del dispositivo no está construido (sec. 7.2.2 y 7.5.4).
- El audio es una salida PWM provisoria, con volumen limitado por la corriente que admite un pin de propósito general (sec. 7.3.6).
- La autonomía de la batería es una estimación a partir de mediciones de terceros (sec. 7.3.3).
- Los tiempos del botón se calibraron con personas videntes y con otro pulsador, y no se realizaron pruebas de usabilidad con personas ciegas (sec. 7.2.6).
- Existe una única unidad, con la clave de su red local fija y el servidor HTTP sin autenticación (sec. 7.3.2).
- La carcasa, aun en su versión más reciente, es un prototipo impreso en PLA, del tamaño que impone una placa de propósito general con su módulo de alimentación (sec. 7.3.5).

Las líneas de trabajo que permitirían superar estas limitaciones se presentan en el capítulo 10.
