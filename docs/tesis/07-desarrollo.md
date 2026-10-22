# 7. Desarrollo

Este capítulo describe la construcción del sistema: su arquitectura, las decisiones de diseño con la
evidencia que las sustenta, y la implementación de cada uno de los tres pilares. El orden es
deliberado: primero la arquitectura general, luego las decisiones que la determinaron (porque casi
todas provienen de una medición y no de una preferencia), y recién después la implementación de cada
componente.

## 7.1 Arquitectura del sistema

### 7.1.1 Visión general

ViroVision está compuesto por tres elementos y una persona:

1. **El dispositivo**, montado en la patilla de unos lentes: una computadora de placa única con una
   cámara con acelerador de inferencia en el sensor, un botón físico y una salida de audio. Captura
   el entorno y reproduce la respuesta.
2. **La aplicación móvil**, que corre en el teléfono del usuario: gestiona la vinculación con el
   dispositivo, aporta capacidad de procesamiento cuando hace falta, resuelve la síntesis de voz y
   ofrece la configuración accesible del sistema.
3. **Los servicios de nube**, opcionales y limitados a un caso de uso: un proxy propio que resguarda
   las credenciales y, detrás de él, un modelo de lenguaje con visión.
4. **El usuario**, que interactúa exclusivamente mediante **un botón y la voz**. La pantalla del
   teléfono no es parte del circuito de uso: existe para configuración y para acompañantes videntes.

`[FIGURA 7.1: Arquitectura general del sistema. Dispositivo, teléfono y nube, con los dos planos de
comunicación (BLE para control, WiFi para datos) y la salida de audio.]`

La división de responsabilidades responde a la restricción fundacional del proyecto (ADR 0001): **las
capacidades esenciales deben funcionar sin conectividad a internet**. Por eso el modo ómnibus, que
además es el más sensible a la latencia, se resuelve **íntegramente dentro del dispositivo**, y la
nube se usa únicamente en el modo supermercado, donde la ganancia de precisión justifica la
dependencia y donde el usuario está, por definición, en un lugar con cobertura.

### 7.1.2 Modos de operación

El sistema es una **máquina de estados de tres modos** que se gobierna con un único control físico
(ADR 0007):

| Gesto | Efecto |
|---|---|
| Un click | Entra en **modo ómnibus** desde cualquier estado |
| Doble click | Entra en **modo supermercado** desde cualquier estado **y solicita una lectura** |
| Pulsación larga | Vuelve al estado de **espera** |

`[FIGURA 7.2: Máquina de estados de los modos de operación. Transiciones entre espera, ómnibus y
supermercado según el gesto del botón.]`

Dos propiedades de este diseño merecen destacarse porque son decisiones de accesibilidad y no de
implementación. La primera: **un gesto nombra un modo, no un paso**. En una versión inicial, pasar
de un modo a otro exigía volver primero al estado de espera; se eliminó porque, para quien no ve la
pantalla, apretar dos veces y que no ocurra nada se interpreta como un botón roto, no como un gesto
faltante. La segunda: **el doble click siempre solicita una lectura**, aunque el sistema ya estuviera
en modo supermercado, porque el usuario que repite el gesto está pidiendo que se lea otra vez.

El sistema **nunca emite audio no solicitado**. Los dos modos difieren en qué significa "solicitado":
en supermercado, el usuario pide una lectura puntual; en ómnibus, el modo mismo es la solicitud, y
mientras esté activo el dispositivo vigila y anuncia lo que aparece (sec. 7.4.9).

### 7.1.3 Los tres flujos de reconocimiento

`[FIGURA 7.3: Los tres flujos de reconocimiento por caso de uso. Ómnibus con procesamiento parcial,
ómnibus con procesamiento completo en el dispositivo, y supermercado con procesamiento en la nube.
Transcripción del diagrama acordado por el equipo, disponible en documents/logicas-casos-de-uso.pdf]`

El proyecto evaluó dos arquitecturas de procesamiento: resolver todo en el dispositivo, como
producto autónomo, o derivar el procesamiento de imagen al teléfono. La Raspberry Pi se eligió, entre
otras razones, porque permite **implementar y comparar ambas**. El resultado de esa comparación es
que cada caso de uso terminó en un extremo distinto: **ómnibus resuelve todo en el dispositivo**,
**supermercado deriva al teléfono y de allí a la nube**.

### 7.1.4 Comunicación entre componentes

El hallazgo que define la arquitectura de comunicación es que **un único canal no alcanza**. La
medición de throughput BLE (sec. 7.2.1) mostró que el enlace de baja energía no puede mover una imagen
en el tiempo disponible, pero es exactamente el canal adecuado para lo que sí debe estar siempre
vivo: avisar que se apretó el botón, informar un cambio de modo, reportar estado. De ahí la
separación en **dos planos**:

- **Plano de control: BLE (GATT), permanente.** Conexión siempre activa, con reconexión automática.
  Transporta eventos pequeños y de baja latencia.
- **Plano de datos: WiFi, bajo demanda.** El dispositivo levanta un punto de acceso; la aplicación
  se une a él con las credenciales que recibió por BLE y descarga la fotografía por HTTP. El
  teléfono conserva su conexión a datos móviles, de modo que puede alcanzar la nube mientras está
  unido a la red del dispositivo.

Una consecuencia de diseño importante: **la aplicación siempre tira, nunca el dispositivo empuja**.
El dispositivo informa que hay algo disponible y la aplicación decide cuándo y cómo obtenerlo. Esto
mantiene al dispositivo simple y hace que la recuperación ante un fallo de red sea responsabilidad
de un solo lado.

#### Perfil GATT

El dispositivo expone un servicio con identificador `4380c500-7ca3-4e37-b27d-f60e8d8d73d1` y seis
características. Los identificadores son de 128 bits generados aleatoriamente: los valores
abreviados de 16 bits que se usan habitualmente en ejemplos pertenecen al rango reservado por el
Bluetooth SIG y no deben emplearse en un perfil propio.

| Característica | Propiedades | Contenido |
|---|---|---|
| `mode` | lectura · notificación · escritura | Entero sin signo de 8 bits: 0 espera, 1 ómnibus, 2 supermercado |
| `control` | escritura | Comando en JSON (`photo`, `mode`, `status`, `audio`, `say`, `ap`, `measure`) |
| `event` | notificación | Evento en JSON, **máximo 180 bytes** |
| `transfer` | notificación | Transferencia binaria fragmentada (en desuso desde el rediseño del enlace) |
| `status` | lectura · notificación | Telemetría del dispositivo: versión, temperatura, tiempo de actividad, batería, cámara, red, punto de acceso |
| `wifi` | lectura | Credenciales del punto de acceso del dispositivo |

El límite de 180 bytes por evento y el tamaño de fragmento de 182 bytes no son arbitrarios: iOS
negocia una unidad máxima de transmisión (ATT MTU) de 185 bytes, y tres de ellos los consume la
cabecera del protocolo. La telemetría de estado se notifica cada 15 segundos.

La definición del perfil está duplicada a ambos lados de la frontera (en el daemon de la placa y en
la aplicación) y una prueba automatizada falla si las dos copias se desincronizan.

`[FIGURA 7.4: Diagrama de secuencia de una lectura en modo supermercado. Desde el doble click del botón
hasta la reproducción del audio, mostrando el cruce entre los dos planos de comunicación.]`

`[FIGURA 7.5: Diagrama de secuencia de una lectura en modo ómnibus. Muestra que el ciclo se cierra
íntegramente dentro del dispositivo, sin participación del teléfono ni de la nube.]`

## 7.2 Decisiones de diseño y su evidencia

Esta sección documenta las decisiones que determinaron la arquitectura. Cada una se presenta con el
problema que la originó, la evidencia que se recogió y la consecuencia que tuvo. El criterio de
inclusión es que exista una medición o una prueba en hardware detrás.

### 7.2.1 El enlace BLE no alcanza para transportar la imagen

**Problema.** El diseño original transportaba la fotografía del dispositivo al teléfono por BLE, a
través de la característica `transfer`. Antes de construirlo, el equipo escribió el umbral de
aceptación: una imagen de **53 000 bytes en menos de 2 segundos**, es decir un caudal de al menos
~27 KB/s. Ese umbral se deriva del presupuesto de tiempo total del modo supermercado (3 a 4
segundos).

**Medición.** Cinco corridas contra un iPhone con la aplicación instalada, con la radio WiFi del
dispositivo encendida y apagada:

| Condición | Corridas (ms) | Mediana | Caudal |
|---|---|---|---|
| WiFi del dispositivo apagada | 3580, 3660, 4470, 4520, 5010 | **4470 ms** | 11,8 KB/s |
| WiFi del dispositivo encendida | 4080, 4260, 4440, 4490, 6150 | **4440 ms** | 11,9 KB/s |

**El umbral se incumple por un factor de 2,2**, y la presencia de la radio WiFi no es la causa.

**Causa raíz.** El caudal observado no es ruido: **11,8 KB/s es exactamente una notificación de 182
bytes por cada intervalo de conexión de 15 ms** (182 / 0,015 = 12,1 KB/s). El techo lo impone el
enlace y no el receptor. El controlador de radio del dispositivo no implementa *Data Length
Extension*, por lo que cada paquete de radio transporta 27 bytes útiles. Se verificó además que
**reducir el tamaño de fragmento empeora el resultado** (95 bytes y 47 bytes dan caudales menores),
lo que descarta la optimización por ajuste de parámetros.

**Contraprueba.** El mismo archivo de 53 000 bytes, transferido por HTTP sobre la radio WiFi del
mismo dispositivo, se descarga con una mediana de **46 ms**, aproximadamente **cien veces más
rápido**.

**Decisión.** BLE queda como plano de control y WiFi como plano de datos. El presupuesto de tiempo
resultante del modo supermercado pasa de estimarse en 6 a 9 segundos (sólo BLE) a **3 a 3,5
segundos** con el enlace híbrido.

**Limitación declarada.** Estas mediciones corresponden al controlador de radio de la placa original.
Desde que el proyecto trabaja sobre una placa prestada con un controlador distinto, **ninguna
medición de radio realizada sobre esta última es comparable**, y la validación definitiva del enlace
deberá repetirse sobre el hardware final.

### 7.2.2 El modo supermercado se resuelve en la nube

**Problema.** Tras el *spike* de visión local, la pregunta era qué proveedor usar y con qué criterio
elegirlo. La hipótesis inicial del equipo era que el criterio sería la precisión.

**Medición.** Cinco corridas por modelo, espaciadas 7 segundos, con una imagen de 768×1024 píxeles
(53 KB), ejecutadas **con el código de la propia aplicación** (reemplazando únicamente el transporte)
y no con una réplica del cliente:

| Modelo | Mínimo | **Mediana** | Máximo | Dispersión | Acierto |
|---|---|---|---|---|---|
| `qwen/qwen3.8-27b` | 764 ms | **846 ms** | 1087 ms | 1,4× | 5/5 |
| `gpt-5.6-luna` | 1410 ms | **1668 ms** | 2490 ms | 1,8× | 5/5 |
| `gemini-3.5-flash-lite` | 2820 ms | **10 649 ms** | 32 586 ms | **11,6×** | 5/5 |

**Hallazgo principal: la precisión no separó a los modelos.** Las quince corridas devolvieron los
tres campos correctos. Con la precisión empatada, el criterio de selección pasó a ser la latencia y,
más precisamente, **la dispersión**: un modelo cuya mediana es aceptable pero cuyo peor caso es doce
veces la mediana produce, para un usuario que no ve la pantalla, una espera indistinguible de una
aplicación colgada.

**Hallazgos secundarios.** El costo por lectura con el modelo seleccionado es de aproximadamente
**USD 0,0003** (1138 tokens de entrada y 35 de salida); mil lecturas cuestan menos de medio dólar, lo
que retira el costo como restricción del proyecto. Y sobre el tamaño de imagen: **los tokens escalan
con el tamaño, la latencia no**, de modo que reducir la resolución para "ir más rápido" no funciona.

**Limitación declarada.** La medición usó una única imagen sintética de alto contraste. Es un piso de
dificultad, no una estimación de la precisión del sistema en góndola real. La construcción del
conjunto de evaluación con fotografías del propio dispositivo sigue pendiente.

### 7.2.3 Las credenciales de nube no pueden viajar en la aplicación

**Problema.** Las variables de configuración expuestas al código JavaScript de una aplicación Expo
**no son variables de entorno: son constantes compiladas dentro del binario**. Una inspección de
cadenas sobre el paquete instalable las recupera. Dado que el proyecto distribuye la aplicación por
un enlace público de pruebas, cualquier clave incluida en el binario es una clave publicada.

**Decisión.** Se interpuso un **proxy propio** entre la aplicación y los proveedores, implementado
como función serverless. Es deliberadamente simple: recibe el cuerpo que el cliente ya construyó, le
agrega la cabecera de autenticación desde el almacén de secretos del servidor y devuelve la
respuesta del proveedor **sin interpretarla**, incluido el flujo de eventos. Esto evita duplicar del
lado del servidor la lógica de cada proveedor: agregar un modelo es un cambio en la aplicación, no
un despliegue.

**Costo medido.** El salto adicional agrega aproximadamente **150 ms** al modelo más rápido y queda
dentro de la varianza natural del más lento.

**Alcance honesto de la medida.** El proxy no está autenticado, porque la aplicación no tiene inicio
de sesión y la clave anónima viajaría igualmente en el binario. Lo que el proxy compra no es volver
el servicio inabusable, sino **poder rotar o cortar una credencial en segundos sin publicar una
versión de la aplicación**. Las defensas efectivas son tres: una lista blanca de destinos (que es lo
único que impide que el servicio se convierta en un reenviador que entregue la credencial a quien
solicite una redirección a su propio servidor), un limitador por dirección de origen, y un tope de
gasto configurado en la consola de cada proveedor.

### 7.2.4 El modo ómnibus corre íntegramente en el dispositivo

**Problema.** El modo ómnibus es el más sensible a la latencia (un ómnibus que ya pasó no sirve de
nada) y es también el que más probablemente se use sin cobertura, en una parada a la intemperie. El
ADR 0001 lo mantiene como camino local por defecto.

**Evidencia.** Medido el 2026-09-15 sobre una Raspberry Pi 3 B+ prestada (la Zero 2 W tenía el
conector de la cámara roto), con la misma cámara y el ciclo completo disparado por el botón físico
(`docs/mediciones/2026-09-15-omnibus-en-placa.md`):

| Etapa | Tiempo desde el gesto |
|---|---|
| Click del botón; el modo cambia a ómnibus | 0 |
| Vigilancia iniciada | 5 ms |
| El OCR devuelve la lectura | 1,27 s |
| Se anuncia «Ómnibus 115, Luis Braille» | **1,27 s** |

Lecturas posteriores en régimen: 971 ms, 1001 ms y 1006 ms.

En la Raspberry Pi Zero 2 W, la placa definitiva, el 2026-09-22 y contra el mismo video del 115, la
línea se anunció **1,6 s** después de que el sensor vio el ómnibus, tras dos lecturas de OCR de 932 y
583 ms, con 75 cuadros cada 5 s y detecciones en el 95 % de ellos (`docs/SESSION-LOG.md`,
2026-09-22). Las dos cifras no se miden desde el mismo punto: la de la Pi 3 B+ cuenta desde el botón,
la de la Zero 2 W desde que el sensor ve el ómnibus.

**Conclusión operativa: el costo es el OCR.** La detección ocurre dentro del sensor de la cámara, no
consume CPU de la placa y no aparece en el presupuesto de tiempo: el sensor entrega cajas
delimitadoras a 15 cuadros por segundo mientras el procesador hace otra cosa.

**Costo de arranque.** En la Pi 3 B+ (2026-09-15), desde el encendido del servicio, el dispositivo
responde a una consulta de salud a los **7 segundos** y el modo ómnibus queda operativo a los **47
segundos**; los 40 segundos intermedios son la carga de los modelos de OCR. En la Zero 2 W, después
de reordenar el arranque, la placa anuncia por BLE a los 16,2 s, la cámara está lista a los 21,3 s y el
OCR a los 33,6 s, contados desde el kernel (`docs/SESSION-LOG.md`, 2026-10-06, cont. 3). Un reinicio del servicio sin apagar la placa reduce
el total a unos 24 segundos. Por eso los modelos se cargan al arrancar y no al apretar el botón: un
botón que contesta un minuto más tarde es, a los efectos del usuario, un botón roto.

### 7.2.5 El acelerador es el sensor de la cámara, no un módulo externo

**Problema.** El diseño original incorporaba un acelerador Coral TPU conectado por USB, con el
detector ejecutándose sobre él en formato TensorFlow Lite.

**Evidencia.** El sensor Sony IMX500 de la cámara oficial ejecuta el detector **dentro del propio
sensor**. La conversión del modelo entrenado arroja una ocupación de **7,12 MB sobre los 8 MB
disponibles en el chip (90 %)**, con verificación explícita de que el modelo entra. El sensor procesa
a **15 cuadros por segundo sin consumir CPU ni memoria de la placa**.

**Decisión.** El Coral sale del diseño (ADR 0006, enmienda del 7 de septiembre de 2026). La
consecuencia es doble: se elimina un componente, su costo y su consumo, y se libera el único puerto USB
de la placa. El camino TensorFlow Lite se abandona en favor de ONNX y del formato propio del sensor.
La decisión se tomó y se mantuvo sobre la placa definitiva, la Raspberry Pi Zero 2 W: el detector no
usa memoria ni procesador de la placa, que en este modelo dispone de unos 415 MB de memoria útil, y
eso deja la CPU entera para el recorte y el reconocimiento de texto.

**Un segundo uso del procesador de imagen.** El sensor no sólo detecta: el procesador de imagen de la
placa puede recortar la zona del sensor que se entrega como imagen sin alterar lo que ve el detector,
que sigue observando el campo completo. Sobre esa propiedad se construyó en octubre un **zoom digital
sobre el cartel** (ADR 0006, actualización del 19 de octubre de 2026), que en la Zero 2 W llega hasta
2x; el modo de máxima resolución, que permitiría 4x, se descartó en esta placa porque redujo la tasa a
10 cuadros por segundo, dejó 65 MB de memoria libres y bloqueó la cámara (prueba del 22 de octubre de
2026).

**Consecuencia no deseada, documentada.** La ocupación del 90 % del chip implica que **sólo cabe un
modelo**, lo que condiciona directamente la elección del detector (sec. 7.4.4).

### 7.2.6 Calibración de la interacción física

**Problema.** Los valores iniciales de los tiempos del botón se tomaron de las convenciones de
interfaces de escritorio y producían fallos de reconocimiento de gestos.

**Decisión y evidencia.**

| Constante | Antes | Ahora | Fundamento |
|---|---|---|---|
| Antirrebote | 50 ms | **15 ms** | El parámetro es una cota superior de lo corto que puede ser un click; 50 ms colapsaba el doble click en uno solo. 15 ms cubre el rebote mecánico típico del pulsador utilizado |
| Ventana de doble click | 0,4 s | **0,6 s** | 0,4 s es la cifra de un ratón de escritorio; el gesto sobre un dispositivo montado en la sien es más lento |
| Umbral de pulsación larga | 0,8 s | 0,8 s | Sin cambios |

**Verificación en hardware.** Treinta gestos consecutivos (once dobles, diez simples y nueve
largos) **sin un solo error de reconocimiento**. En la misma sesión, el primer doble click desde el
estado de espera cambió de modo y descargó la fotografía en 164 ms.

**Limitación declarada.** Estos tiempos son una primera calibración hecha por personas videntes. El
ajuste definitivo requiere las pruebas de usabilidad con usuarios ciegos previstas para la etapa
final.

### 7.2.7 Decisiones de producto tomadas por accesibilidad

Tres decisiones no provienen de una medición de rendimiento sino del criterio de accesibilidad, y se
documentan porque tuvieron costo:

**Dos modelos en el selector, no cinco.** El selector de modelo de nube es un grupo de opciones que
se recorre secuencialmente con el lector de pantalla: **cada opción adicional es un gesto más entre
la persona y la lectura que está pidiendo**. Dos modelos cubren la elección real que existe (el más
rápido y el más robusto) y dos opciones que funcionaban correctamente se retiraron por este motivo.

**Un solo tema visual (ADR 0010).** Se retiró el selector de tema claro/oscuro. La verificación de
contraste que acompaña la decisión es automatizada: el color de advertencia alcanza una relación de
**10,97:1** sobre el fondo, por encima del nivel AAA de WCAG (7:1) que corresponde exigir por
tratarse de color de texto.

**Menos pantalla.** En dos etapas se retiró de la interfaz toda la información de diagnóstico
(tiempos, modelo que respondió, texto crudo del reconocedor, botones de medición). La razón, escrita
en el propio código, es que se trataba de una consola de diagnóstico incrustada en la interfaz de una
aplicación destinada a personas que no la ven. Esa información no se perdió: se derivó a telemetría.

### 7.2.8 Alternativas evaluadas y descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Modelo multimodal embebido en el teléfono (Gemma vía LiteRT-LM) | La capacidad de visión no funcionó en iOS con tres modelos distintos, de 756 MB a 2,5 GB |
| Modelo multimodal embebido vía ExecuTorch | Funciona, pero 3 GB de descarga inicial, ~4 s de carga y **6,4 s por inferencia**, muy por encima del presupuesto |
| Audio por Bluetooth Classic (A2DP) | Agrega 150 a 250 ms de codificación y comparte antena con BLE y WiFi |
| Coral TPU por USB | Reemplazado por la inferencia en el sensor (sec. 7.2.5) |
| Realce de contraste (CLAHE) sobre el recorte del cartel | **Empeoró** el acierto del número: de 0,875 a 0,771 |
| Variante separada de la aplicación para pruebas internas | Con tres desarrolladores, cambiar de versión desde la plataforma de distribución alcanza; una segunda aplicación exige su propia ficha y su propia revisión |

## 7.3 El dispositivo

### 7.3.1 Componentes

| Función | Componente | Estado |
|---|---|---|
| Cómputo | Raspberry Pi Zero 2 W | En uso (desde el 19 de septiembre de 2026, ver abajo) |
| Visión | Raspberry Pi AI Camera (sensor Sony IMX500, 12 MP, inferencia en el sensor) | Integrada |
| Entrada | Pulsador en GPIO 5; en la carcasa, pulsador SMD de 4 × 4 × 1 mm con tecla impresa | Integrado y verificado; el de la carcasa, pendiente de verificar |
| Audio | Salida PWM por GPIO (provisoria) hacia un transductor de conducción ósea de 14 mm; destino: conversor digital-analógico I2S | **Pendiente** la etapa definitiva |
| Alimentación | Waveshare UPS HAT (C) + batería LiPo 803040 de 1000 mAh | Integrada; el nivel de batería llega a la aplicación (sec. 7.3.3) |
| Carcasa | VIA Clara, dos mitades a presión impresas en 3D sobre la patilla | v0.9 integrada al repositorio; v0.12 en desarrollo (sec. 7.3.5) |

**Sobre la placa en uso.** El conector de cámara de la primera Raspberry Pi Zero 2 W se dañó durante
el desarrollo, y entre el 9 y el 18 de septiembre de 2026 el trabajo continuó sobre una Raspberry Pi
3 B+ prestada. Era una sustitución funcionalmente adecuada (mismo sistema operativo, misma interfaz de
cámara) pero **con un controlador de radio distinto**. Desde el 19 de septiembre el dispositivo vuelve
a ser una Zero 2 W, con el mismo controlador de radio (BCM43438, Bluetooth 4.2 sin extensión de
longitud de datos) sobre el que se midió el enlace en sec. 7.2.1, de modo que esas mediciones vuelven a
ser representativas. La placa actual no tiene puerto Ethernet y su WiFi opera sólo en 2,4 GHz. Las
cifras tomadas sobre la Pi 3 B+ se identifican como tales donde aparecen; en particular, el costo de
arranque en frío del modo ómnibus de sec. 7.2.4 (47 segundos) es de esa placa, y las cifras vigentes de
la Zero 2 W están en sec. 7.3.2.

**Sobre el audio.** La salida actual es audio por modulación de ancho de pulso redirigida a pines de
propósito general (señal en el pin físico 32, masa en el 34), suficiente para verificar el camino
completo, con voz audible en un auricular, pero no para uso real. La limitación es eléctrica y está
documentada: un pin de propósito general entrega **16 mA**, mientras que un auricular de 16 a 32
ohmios demanda del orden de **100 mA continuos**, seis veces el límite. La carcasa aloja un
**transductor de conducción ósea de 14 mm**, que es el destino físico del sonido; la etapa que lo
maneje está pendiente. El destino electrónico es un conversor digital-analógico I2S, cuya integración
exige además reubicar el pulsador, que hoy ocupa uno de los pines necesarios. El volumen se limita al
90 % y no al 100 % porque la salida PWM satura en el extremo superior, y la distorsión es peor que un
volumen menor.

**Sobre el enfoque.** El sensor tiene **enfoque manual**. Las primeras capturas salieron
desenfocadas; el procedimiento quedó documentado como paso obligatorio de puesta en marcha, con una
herramienta auxiliar que calcula un puntaje de nitidez para ajustar el anillo contra un cartel
situado a 10-20 metros.

### 7.3.2 El daemon

El software del dispositivo es un servicio en Python de **4915 líneas** repartidas en 22 archivos
(21 módulos y el archivo de paquete), con **195 pruebas automatizadas** que pasan y 2 que se omiten
fuera de la placa, en 18 archivos de prueba (recuento del 22 de octubre de 2026 sobre
`hardware/raspi/`). Su diseño separa un **núcleo independiente del transporte** (que
conoce los comandos, los modos y las transferencias) de los adaptadores que lo conectan al mundo: el
adaptador BLE sobre BlueZ, el servidor HTTP, la cámara y el audio.

Esa separación habilitó una herramienta de desarrollo decisiva: un **emulador** que ejecuta el mismo
núcleo sobre la pila Bluetooth de macOS, lo que permite desarrollar y probar la aplicación móvil
contra un dispositivo simulado, sin depender de la disponibilidad física de la placa.

El servicio expone además un pequeño servidor HTTP en el punto de acceso propio, con cinco rutas
(`http_server.py`): consulta de salud, generación de datos de prueba, captura y entrega de la última
fotografía (1024 píxeles de lado mayor, calidad 70; aproximadamente 35 KB en 200 a 235 ms incluyendo
la captura), recepción de audio para su reproducción y entrega de la evidencia del modo ómnibus (cada
cuadro y cada recorte que leyó el reconocedor de texto, sólo después de que el dispositivo los anunció
por BLE). Esta última ruta es temporal: el equipo decidió retirarla antes de la versión final, porque
se trata de fotografías de la vía pública con personas.

**Secuencia de arranque.** El 5 de octubre de 2026 el dispositivo dejó de ser visible por completo:
un bloqueo de software del Bluetooth, guardado por el sistema y restituido en cada arranque, dejaba al
servicio reiniciándose sin anunciar nunca. El arreglo llevó a revisar el arranque entero con una regla
única, **anunciar primero**: el teléfono sólo puede encontrar el dispositivo cuando éste anuncia, y
todo lo que se interponga antes lo vuelve invisible. El servicio levanta el bloqueo antes de
arrancar, depende sólo de la pila Bluetooth (ya no espera a la red), registra el perfil y anuncia, y
recién después inicia la cámara y el punto de acceso. Se eliminaron además los componentes del
sistema que sólo servían en el primer arranque, la comprobación previa del servidor DHCP (3,0 s por
cada unión del teléfono) y una importación de la biblioteca de visión que congelaba el servicio 13
segundos; el reconocedor de texto se carga en un proceso aparte. Medido sobre la Zero 2 W desde el
inicio del núcleo:

| Hito | Antes | Después |
|---|---|---|
| El dispositivo anuncia por BLE | 27,0 s | **16,2 s** |
| Punto de acceso disponible | ~29 s | 21,7 s |
| Cámara con el detector lista | 31,4 s | 21,3 s |
| Reconocedor de texto listo (modo ómnibus operativo) | 44,0 s | **33,6 s** |

Fuente: bitácora del proyecto, 6 de octubre de 2026. Con el arranque nuevo el teléfono se conectó
0,3 s después del primer anuncio. Un modo ómnibus pedido antes de que el reconocedor esté listo no
queda en silencio: el dispositivo dice «preparando la lectura» y empieza a vigilar solo cuando puede.

**Configuración.** Las banderas de ejecución viven en un archivo de configuración del sistema, fuera
del paquete del servicio, de modo que sobreviven tanto a las actualizaciones como al cambio entre los
dos modos de operación descritos en sec. 7.3.4.

**Seguridad del enlace.** Desde septiembre el dispositivo arranca con el emparejamiento Bluetooth
deshabilitado. Ninguna característica del perfil requiere autenticación, por lo que la aplicación
nunca necesitó un vínculo persistente, y deshabilitarlo elimina los diálogos de emparejamiento que
el sistema operativo del teléfono presentaba al usuario.

### 7.3.3 Energía y autonomía

El presupuesto energético está estimado a partir de mediciones de terceros sobre el mismo hardware,
**pendiente de verificación con instrumental propio**:

| Estado | Consumo estimado |
|---|---|
| Espera (BLE anunciando, sin video) | 0,5 a 0,6 W |
| Activo (cámara, punto de acceso y detección en el sensor) | 2 a 3 W, pico ~0,6 A |

| Celda | Dimensiones | Autonomía estimada |
|---|---|---|
| LiPo 1000 mAh (incluida con el módulo; la que aloja la carcasa) | 40 × 30 × 8 mm, ~20 g | 1,5 a 2 h |
| LiPo 2000 mAh (mejora posible) | 50 × 34 × 10 mm, ~36 g | 3 a 4 h |

**La batería está integrada y se lee** desde el 6 de octubre de 2026. El módulo de alimentación
incorpora un monitor INA219, que el dispositivo lee por I2C (bus 1, dirección 0x43, confirmada
escaneando el bus). Se lee sólo la tensión de la celda; el porcentaje se obtiene de la curva de
descarga de una batería LiPo y se suaviza para que no oscile con la carga. El valor viaja en el estado
del dispositivo por BLE y la aplicación lo presenta en la pestaña del dispositivo. Poder anunciar el
nivel de batería por voz es, en este proyecto, un requisito de accesibilidad y no una comodidad: el
usuario no puede consultar un indicador luminoso.

**Estado real: el consumo no está medido.** Falta instrumentar la línea de alimentación con un medidor
en serie para reemplazar las estimaciones de terceros de la tabla por mediciones propias y, con ellas,
la autonomía real.

### 7.3.4 Los dos modos de operación del dispositivo

Un dispositivo terminado son unos lentes con un botón: no tiene teclado, ni pantalla, ni alguien que
le administre la red. Durante el desarrollo, en cambio, ese mismo hardware tiene que ser alcanzable
para desplegar, depurar y medir. Las dos exigencias son incompatibles sobre una sola radio: en modo
producto la placa **levanta su propio punto de acceso**, que es al que se une el teléfono, y mientras
ese punto de acceso está activo la placa abandonó cualquier otra red, de modo que **no hay acceso
remoto por la red doméstica**.

El proyecto resolvió esa tensión con un **interruptor explícito** en lugar de dejar el dispositivo
permanentemente en modo desarrollo, que habría sido cómodo y habría producido mediciones que no
corresponden al producto:

| Estado del interruptor | Modo | Consecuencia |
|---|---|---|
| Presente | **Desarrollo** | La placa se une a la red conocida. Hay acceso remoto e internet. La aplicación informa «red apagada» |
| Ausente | **Producto** | La placa levanta su punto de acceso al arrancar (ADR 0003). No hay acceso remoto por la red doméstica |

Tres propiedades de este diseño merecen señalarse, porque son decisiones y no detalles de
implementación:

**a) El interruptor vive en la partición de arranque, que es FAT.** Se lee y se escribe desde
cualquier computadora con la tarjeta puesta, sin herramientas especiales y sin entrar al dispositivo.
Es la consecuencia de una regla que el proyecto adoptó después de quedarse sin acceso más de una vez:
**un dispositivo sin pantalla tiene que ser gobernable sin entrar en él**.

**b) La configuración efectiva se regenera en cada arranque.** Un servicio lee el interruptor y
escribe la bandera con la que arranca el daemon. Esa configuración generada no se edita a mano,
porque el siguiente arranque la sobrescribe. Lo que se cambia es el interruptor.

**c) El enlace de control funciona igual en los dos modos.** Es deliberado: el plano de control no
puede depender del modo de red, o el dispositivo quedaría mudo justamente cuando hay un problema de
red. Tiene, sin embargo, un **costo de diagnóstico** que conviene dejar escrito: desde el teléfono
los dos modos se ven idénticos, de modo que una placa en modo producto que se creía en desarrollo no
da ninguna señal de estarlo. Ocurrió, y el síntoma fue la ausencia de síntoma.

La consecuencia de fondo de esta decisión es que **un dispositivo en modo producto sólo se puede
actualizar desde la tarjeta o a través del enlace de control**. Esa restricción no es un inconveniente
del entorno de desarrollo: es el comportamiento correcto del producto, y es la que dio forma al
procedimiento de despliegue descrito en sec. 8.7.

Como vía intermedia, el proyecto incorporó una herramienta que **apaga el punto de acceso a través
del enlace de control**, tras lo cual la placa vuelve sola a la red conocida y el acceso remoto queda
disponible sin abrir el dispositivo ni manipular la tarjeta. Medido sobre la placa: **cinco segundos
de punta a punta**.

### 7.3.5 La carcasa

**Requisitos.** La carcasa tiene que alojar el conjunto real de componentes sobre la patilla de unos
lentes, cerrar sin tornillos (para abrirse y cerrarse durante el desarrollo sin herramientas),
proteger el flex de la cámara, dejar accesibles la llave de encendido, la carga y la tarjeta de
memoria, y presentar **un único botón localizable al tacto**. Es un componente de accesibilidad y no
sólo de protección: quien la usa no puede ver dónde está el botón ni de qué lado está el encendido.

**El modelo.** Se diseñó como un modelo paramétrico en OpenSCAD (proyecto «VIA Clara», en
`hardware/case-via-clara/`), en el que cada medida del exterior se deriva de las del conjunto
interior: si una medida real resulta menor que la supuesta, la carcasa se achica sola. El conjunto,
de la cara que apoya en la cabeza a la externa, es: las cabezas de los tornillos bajo el módulo de
alimentación, el módulo, la batería de 40 × 30 × 8 mm (del lado de los contactos de resorte que
alimentan la placa), la Raspberry Pi Zero 2 W y, sobre ella, el conector de pines soldado (8,5 mm) y
los separadores hexagonales. Adelante quedan el conector de la cámara y la llave de encendido;
atrás, la tarjeta microSD y el conector de carga. El cuerpo son **dos mitades** unidas por **trabas a
presión**: cada traba es una viga que corre a lo largo de la junta, dentro de la pared, y flexiona en
el plano de la cama de impresión y no a través de las capas, que es donde una pieza impresa se rompe.
Cada viga se imprime atada por un puente fino que se corta después de imprimir. Completan el cuerpo
una corredera impresa que lleva la palanca de la llave de encendido hasta una ventana de la cara
cabeza, con un punto en relieve que marca el lado de encendido; un brazo que sostiene el transductor
de conducción ósea de 14 mm contra la cabeza; dos puentes para un elástico plano de 6 mm; y el botón,
rodeado por un anillo en bajorrelieve.

**Una iteración guiada por la impresión.** Las verificaciones del modelo se hacen contra maquetas
de los componentes, y cada impresión mostró algo que las maquetas no tenían. La tabla resume la
secuencia (bitácora del proyecto del 14 de octubre de 2026 y bitácora de la rama de la carcasa,
`feat/case-v0-10-slim`, todavía sin integrar, del 17, 21 y 22 de octubre):

| Versión | Cuerpo (mm) | Lo que mostró la impresión | Cambio en la versión siguiente |
|---|---|---|---|
| v0.8 | (modelo de partida) | sin imprimir; suponía un conjunto de 16,5 mm de espesor, frente a los ≈ 23 reales | v0.9 se rehízo sobre el conjunto real |
| v0.9 | 91,9 × 31,4 × 37,6 | impresión evaluada el 17 de octubre: encajó casi todo. Los separadores estaban del lado de la placa y no del módulo; la microSD no entraba (hubo que cortar el extremo); paredes de más; imagen girada 90°; el soporte del lente era mayor que en el plano | conjunto fijado a la mitad externa; paredes de 1,6 mm; cámara girada 90° en su plano, con el flex directo al conector |
| v0.10 | 92,9 × 28,7 × 36,6 | impresión evaluada el 21 de octubre: falló; guías de la cámara demasiado finas para la impresora (0,6 a 0,65 mm), botón contra el disipador de la placa, ranura de la microSD en espejo, brazo del auricular que no entraba, pernos traseros que se rompían | medidas reales tomadas con calibre; guías de 1,2 mm; botón alejado del disipador; microSD accesible con la carcasa cerrada; trabas traseras en lugar de pernos |
| v0.11 | 83,4 × 28,5 × 37,2 | impresión evaluada el 22 de octubre, en dos variantes (cámara integrada y con tapa aparte). La de tapa exigía demasiados ajustes; en la integrada el lente no entraba y las trabas delanteras, fundidas sobre las guías de la cámara, no flexionaban y se partieron | se descarta la variante con tapa; 5,0 mm entre la guía delantera y el frente; trabas delanteras detrás de las guías, con luz debajo |
| **v0.12** | **85,8 × 28,5 × 37,2** | en desarrollo, sin imprimir completa | (vigente) |

Tres hallazgos de esa secuencia cambiaron el diseño y no sólo una medida. **Los separadores
hexagonales asoman sólo 1,2 mm sobre la placa**, demasiado poco para fijarlos por calor sin calentar
la placa: desde la v0.11 el conjunto no se fija, lo sostiene la carcasa cerrada (alojamientos holgados
en una mitad, la pared de la otra apoyada en las cabezas de los tornillos), y se retira sin esfuerzo.
**El pulsador real de la carcasa es un SMD de 4 × 4 × 1 mm**, con un actuador de menos de 1 mm: lleva
una tecla impresa pegada encima y una tapa trasera que lo respalda en cada pulsación. Y **las piezas
finas no se imprimen**: un nervio de 0,65 mm no se reproduce aun con la máxima calidad, de modo que
ningún detalle funcional baja de tres líneas de extrusión (1,2 mm).

**Cotas de la v0.12** (`via_clara_v0_12.scad`): cuerpo de 85,8 × 28,5 × 37,2 mm (largo, ancho y alto),
con la nariz que aloja la cámara de 32,2 mm de alto; ~32,2 mm de ancho total con los puentes del
elástico y el zócalo del brazo, sin contar el brazo. Paredes de 1,6 mm a los costados y de 2,7 mm
arriba y abajo, donde viven las vigas de las trabas; ocho trabas; ventana de la llave de 5,2 × 7,4 mm;
agujero del lente de 9,4 mm de diámetro; alojamientos de los separadores redondos, de 3,4 mm de
diámetro y 1,5 de profundidad (los hexagonales de la v0.11 salieron cerrados por los perímetros de la
impresión). Seis piezas imprimibles (las dos mitades, el brazo del auricular, la tecla, la corredera y
la tapa del pulsador), más un modelo del conjunto cerrado que no se imprime y sirve para revisarlo en
el programa de laminado. Para la v0.12 se agregaron piezas de
prueba: la nariz cortada (en dos anchos de ranura para la cámara, a comparar) y la pared con los
alojamientos de los separadores, de modo de validar lo nuevo sin imprimir la carcasa entera.

**Verificación.** Un guion (`export.sh`) regenera las piezas, las imágenes y una guía con flechas
que indica para qué es cada ranura, y comprueba que cada pieza imprimible sea un único sólido apoyado
en la cama. Corre además **18 verificaciones de interferencia** entre volúmenes: las mitades entre
sí; cada mitad contra placas, batería, llave, cámara, pulsador, tornillos y separadores; la corredera
en sus dos posiciones; el recorrido del flex; el brazo; y los **caminos de armado**, no sólo la
posición final (la tecla y el pulsador entrando a su alojamiento, el conjunto bajando a sus apoyos, la
palanca entrando en la corredera, la cámara entrando en su ranura). Cada verificación tiene que dar un
volumen vacío o un contacto de volumen cero, y el guion falla si alguna no lo da. Su valor está acotado
por las maquetas: una verificación contra una medida supuesta no dice nada de la pieza real, y fue
exactamente eso lo que hizo fallar la v0.10.

**Revisión.** El equipo sometió el modelo 3D al flujo de revisión multi-modelo tackle-ticket, en el
que revisores basados en distintos modelos (Opus, Sonnet, Haiku y Codex) examinan el mismo cambio por
separado y sus hallazgos se consolidan y corrigen en rondas sucesivas. En la v0.9 (14 de octubre de
2026, tres rondas) la revisión llevó las trabas al plano de la cama, reservó el volumen del flex de la
cámara, que no tenía por dónde pasar, y agregó las verificaciones de los caminos de armado; en la
v0.11 (21 de octubre, tres rondas) encontró que los apoyos que debían sujetar el conjunto no lo
tocaban, que el lente no pasaba por el plano de la junta y que la tapa del botón no dejaba lugar a los
cables.

**Pendiente.** Imprimir y evaluar las piezas de prueba de la v0.12; medir con calibre los valores que
el modelo marca como supuestos (las cabezas de los tornillos, lo que asoma la microSD, la palanca de
la llave, el voladizo de los conectores de la placa, el pulsador con sus patas, el transductor y el
rigidizador del flex de la cámara); imprimir la carcasa completa; y verificar con ella los tiempos del
botón (sec. 7.2.6), que se calibraron con otro pulsador. Las versiones v0.10 a v0.12 se desarrollan en una
rama propia que todavía no se integró a la rama principal de desarrollo, donde está la v0.9. Los
archivos de impresión no se versionan en el repositorio: se publican en la carpeta compartida del
proyecto, una por versión, y se regeneran desde el modelo.

## 7.4 El pipeline de reconocimiento de líneas de ómnibus

Este pipeline es el componente de mayor densidad técnica del proyecto y el único que se desarrolló en
un repositorio propio (`bus-banner-recognizer`), por tener un ciclo de trabajo (construir el
conjunto de datos, entrenar, evaluar, exportar) independiente del ciclo de la aplicación. Se consume
desde el dispositivo como una dependencia instalable.

### 7.4.1 Estructura general

`[FIGURA 7.6: Los cinco pasos del pipeline de ómnibus, del cuadro de cámara al anuncio de voz.]`

```
cuadro de la cámara
  ├─ 1. detección del ómnibus            (YOLO)
  ├─ 2. detección del cartel frontal     (YOLO)
  ├─ 3. recorte del cartel               (geometría)
  ├─ 4. lectura del recorte              (OCR)
  └─ 5. interpretación y reparación      (parseo + catálogo de líneas)
       → anuncio de voz pregrabado
```

**Por qué se recorta antes de leer.** Si el OCR recibiera el cuadro completo leería también la
matrícula, los carteles laterales y la publicidad del vehículo, y el problema pasaría de "leer un
cartel" a "decidir cuál de ocho textos es el correcto". Recortar primero convierte el problema de
interpretación en un problema de geometría.

**Cómo se elige qué ómnibus anunciar.** Cuando hay varios vehículos en el cuadro se selecciona el de
mayor área (que es el más cercano) y, ante áreas equivalentes, el más centrado. La priorización que
el proyecto se planteó como requisito se resuelve, así, a partir de la geometría de la caja
delimitadora, sin un mecanismo adicional.

**Restricciones geométricas del recorte.** El cartel frontal que contiene número y destino es una
franja ancha: se exige una relación de aspecto mínima de 2,0, y se lo busca en la mitad superior del
vehículo. Esa condición descarta precisamente los carteles cuadrados (los de sólo número y los
laterales), que son los que no se quieren leer.

### 7.4.2 El conjunto de datos

**Conjunto de entrenamiento del detector.** Construido y etiquetado manualmente por Magalí
Dellapiazza en la plataforma Roboflow, versión 6 del conjunto `find-bus-sign`:

| Propiedad | Valor |
|---|---|
| Imágenes totales | **140** |
| Partición | entrenamiento 98 · validación 28 · prueba 14 |
| Clases | 1 (`bus_sign`) |
| Formato de anotación | YOLOv11 |
| Preprocesamiento | Reorientación automática, redimensión a 640×640 |
| Aumentación en el export | Ninguna |
| Licencia | Dominio público |

**Conjunto de dos clases.** Para la variante de un único modelo (sec. 7.4.4) se requería además la clase
`bus`. Etiquetar a mano 140 imágenes adicionales por segunda vez era evitable: las cajas de ómnibus
se generaron mediante **pseudo-etiquetado** con un modelo YOLO11x preentrenado sobre COCO (que ya
contiene la categoría `bus`) y **se revisaron manualmente una por una**. Se conservó la misma
partición.

**Ampliación para el reentrenamiento.** Para reentrenar el detector de dos clases en la GPU (sec. 7.4.3)
el conjunto se amplió a **unas 500 fotografías** (`docs/SESSION-LOG.md`, 2026-10-21). Su composición,
su partición y su procedencia no constan en ningún repositorio: **PENDIENTE** de documentar.

**Conjunto de evaluación del pipeline.** Un conjunto propio, independiente del de entrenamiento,
anotado con la verdad de terreno de lo que el sistema debe decir:

| Propiedad | Valor |
|---|---|
| Imágenes | **117** |
| Con ómnibus presente | 102 |
| Con cartel legible | 68 |
| Con número esperado | 48 |
| Con destino esperado | 56 |
| Procedencia | tres videos (45 / 32 / 26 imágenes) y el conjunto de prueba de Roboflow (14) |

Cada fila registra la imagen, el número y el destino esperados, la presencia de ómnibus y de cartel,
y una nota con lo que el cartel dice literalmente cuando difiere de la denominación oficial.

**Limitación declarada, y es importante.** Los tres videos fuente son material de redes sociales, no
capturas de la cámara del dispositivo. En consecuencia, **todas las métricas de este pipeline
corresponden a imágenes de origen distinto al de producción**, y la construcción de un conjunto de
evaluación con fotografías tomadas por el propio dispositivo es la tarea de mayor valor pendiente
del pilar.

**Catálogo de líneas.** Se construyó a partir de los datos abiertos del Sistema de Transporte
Metropolitano de la Intendencia de Montevideo (`data/catalog_stm.csv`, recontado el 2026-10-22):
**504 filas**, de las cuales **502 son pares** de número y destino entre **145 números de línea** y
**255 destinos**, más dos carteles sin línea (`COCHE ESCUELA` y `FUERA DE SERVICIO`); 257 destinos
distintos en total. Cumple tres funciones: reparar la salida del OCR por similitud, decidir qué se
puede decir y completar la mitad del cartel que no se leyó (sec. 7.4.8), y generar el repertorio de
anuncios pregrabados.

### 7.4.3 El entrenamiento del detector

El detector es un **YOLO11n** ajustado por transferencia (*fine-tuning*) a partir de los pesos
preentrenados sobre COCO. La elección de la variante más pequeña de la familia no es una concesión:
**es el único tamaño que el sensor de la cámara convierte**.

Los hiperparámetros están escritos explícitamente en el script de entrenamiento del repositorio, con
su justificación, de modo que sean citables y reproducibles:

| Hiperparámetro | Valor | Fundamento |
|---|---|---|
| `epochs` | 120 | Con paciencia de 25 épocas para detención temprana |
| `imgsz` | 640 | La entrada del sensor es un encuadre de 640×640 |
| `batch` | 32 | |
| `cos_lr` | activo | Programación coseno de la tasa de aprendizaje |
| `close_mosaic` | 15 | Desactiva el mosaico en las últimas épocas |
| **`fliplr` / `flipud`** | **0,0 / 0,0** | **Espejar un cartel produce texto espejado**: la aumentación por reflexión, habitual en detección, es contraproducente cuando el objeto es texto |
| `hsv_h` | 0,01 | El ámbar o rojo del display LED es una señal cromática fuerte y no conviene perturbarla |
| `hsv_s` / `hsv_v` | 0,5 / 0,6 | Sí se perturban saturación y brillo: modelan la variabilidad de iluminación real |
| `degrees` / `shear` / `perspective` | 5,0 / 2,0 / 0,0005 | Modelan el ángulo de captura desde la vereda |
| `mixup` | 0,05 | |

**Estado real del entrenamiento, declarado con precisión.** Las dos primeras corridas (el detector
de una clase y el de dos clases, este último el 2026-09-15) se entrenaron con una configuración más
conservadora: **40 épocas, lote de 16, sobre CPU**, con las 140 imágenes de sec. 7.4.2.

Después, el detector de dos clases se **reentrenó en el servidor con GPU NVIDIA Tesla V100**
facilitado por Arnaldo Castro S.A., con **unas 500 fotografías** (`docs/SESSION-LOG.md`, 2026-10-21).
Las épocas y la configuración efectivamente usadas, las métricas de validación y la ubicación de los
pesos de ese reentrenamiento **no constan en ningún repositorio: PENDIENTE**. Las métricas que se
reportan a continuación (sec. 7.4.4 y sec. 7.4.5) corresponden, por lo tanto, a los modelos entrenados en CPU
con 40 épocas, y deben leerse como un **piso** y no como el techo de lo alcanzable.

### 7.4.4 La decisión del detector de dos clases

Esta es la decisión de modelado central del pipeline y se toma contra una restricción de hardware, no
contra una métrica.

**Las dos alternativas.**

- **Dos etapas:** un YOLO11n preentrenado sobre COCO localiza el ómnibus (categoría `bus`, ya
  presente en COCO), y un segundo YOLO11n ajustado localiza el cartel dentro de él. Dos modelos, dos
  inferencias por cuadro.
- **Una etapa:** un único YOLO11n ajustado sobre **dos clases** (`bus_sign` y `bus`). Un modelo, una
  inferencia.

**Comparación vigente sobre las 117 imágenes de evaluación** (2026-10-12, en la estación de trabajo,
con el código del PR #7 de `bus-banner-recognizer`: reconocedor `latin` y reglas del catálogo de
sec. 7.4.8; README de ese repositorio, sección "Results"):

| Detector | Número | Destino | Lectura completa | Detección (mediana) |
|---|---|---|---|---|
| Dos etapas | 91,7 % | **89,3 %** | **91,7 %** | 35 ms |
| Una etapa (dos clases) | 91,7 % | 85,7 % | 87,5 % | **18 ms** |

Una sola imagen, el cartel nocturno de la línea 109, mueve el número unos dos puntos: según un píxel
de recorte se lee `109` o `10`, y el resultado cambia entre versiones de onnxruntime y OpenCV. Son
cifras del primer modelo entrenado en CPU; el detector reentrenado en la V100 (sec. 7.4.3) no se evaluó
sobre este conjunto (**PENDIENTE**).

**Comparación anterior, del ajuste de márgenes** (septiembre de 2026, antes de las reglas del
catálogo), que muestra el efecto del margen vertical (sec. 7.4.6):

| Detector | Margen vertical | Número | Destino | Lectura completa | Detección (mediana) |
|---|---|---|---|---|---|
| Dos etapas | 0,12 | 91,7 % | 75,0 % | **87,5 %** | 38 ms |
| Dos etapas | **0,06** | 89,6 % | **76,8 %** | **87,5 %** | 38 ms |
| Una etapa (dos clases) | 0,12 | 85,4 % | 69,6 % | 79,2 % | 21 ms |
| Una etapa (dos clases) | **0,06** | **89,6 %** | 71,4 % | 83,3 % | **21 ms** |

**Lectura de las tablas.** El esquema de dos etapas lee mejor: en la medición vigente aventaja al de
una etapa en **4,2 puntos de lectura completa** y en **3,6 puntos de destino**, con el número igualado.
En la anterior, el ajuste de los márgenes de recorte (sec. 7.4.6) había cerrado aproximadamente la mitad
de la brecha en lectura completa, pero nada de la diferencia en destino. Los fallos restantes del
destino son del reconocedor, que convierte el texto de matriz de LEDs en ruido, y no de letras que
quedan fuera del recorte.

**Y sin embargo se eligió el de una clase única de dos categorías.** La razón es que **el sensor sólo
admite un modelo cargado**: la ocupación del chip llega al 90 % con uno solo (sec. 7.2.5), y el segundo
no entra. El esquema de dos etapas exige ejecutar al menos una de las dos inferencias en la CPU de
la placa, lo que destruye la propiedad que hace viable el modo vigilancia (detección continua sin
costo de CPU) y multiplica el tiempo por cuadro.

La formulación que quedó registrada en el repositorio resume el criterio: **la comparación que
importa no es entre el modelo único y el de dos etapas, sino entre el modelo único y no tener
detección continua en absoluto**, y esa comparación la gana con holgura. Se paga una pérdida
acotada de precisión en el destino a cambio de que el sistema pueda vigilar sin intervención del
usuario.

El esquema de dos etapas se conserva implementado en el repositorio y sigue siendo el camino de
referencia para ejecución sobre un equipo sin restricción de memoria, lo que permite además medir
cuánto cuesta la restricción de hardware.

### 7.4.5 Métricas del detector y costo de la cuantización

**Detección, en precisión flotante de 32 bits, sobre el conjunto de prueba** (14 imágenes, 24
carteles):

| Precisión | Exhaustividad | mAP@0,5 | mAP@0,5:0,95 |
|---|---|---|---|
| 0,838 | 0,667 | **0,781** | 0,391 |

`[FIGURA 7.7: Curva precisión-exhaustividad del detector y matriz de confusión normalizada, sobre el
conjunto de prueba.]`

**El export al sensor.** El modelo se convierte a enteros de 8 bits mediante **cuantización posterior
al entrenamiento**: los pesos en punto flotante se redondean a enteros con factores de escala por
canal, y unas pocas activaciones se conservan en 16 bits. La calibración utiliza las 28 imágenes de
la partición de validación. No hay reentrenamiento: no hay retropropagación, no hay datos nuevos y
no hay épocas adicionales. El supresor de no-máximos queda incorporado dentro del modelo convertido,
con umbrales fijos de confianza 0,25 e intersección sobre unión 0,7. El tamaño pasa de **5,2 MB a
2,64 MB**.

**Lo que no está medido, y por qué.** El costo en precisión de esa cuantización **no se cuantificó**.
El obstáculo es instrumental y está documentado: el modelo convertido no se puede cargar fuera del
contenedor provisto por el fabricante, porque requiere operadores propietarios y las bibliotecas que
los registran entran en conflicto entre sí en todas las combinaciones de versiones probadas sobre la
estación de trabajo. La solución (un contenedor con el entorno del fabricante y un script de
validación que compara punto flotante contra entero de 8 bits sobre la misma partición y con la
misma métrica) está preparada en el repositorio y pendiente de ejecución. **Es el riesgo abierto más
relevante del pilar de ML**, y está declarado como tal en el documento de decisión correspondiente.

### 7.4.6 Ajuste de la geometría del recorte

**Por qué el recorte necesita márgenes.** El detector es un modelo de **cajas delimitadoras**, no de
puntos clave: devuelve un rectángulo por objeto, y el entrenamiento le enseña a ajustarlo a los LEDs
del cartel. En los carteles de Montevideo el número de línea está a la izquierda, y el "1" es un trazo
vertical fino. Si el borde izquierdo del recorte cae sobre él, el detector de texto interno del OCR lo
pierde o lo confunde con el borde de la imagen: en la placa, el 2026-09-15, se leyó dos veces `15`
donde el cartel decía `115` (sec. 7.4.11). El problema no es el modelo sino el borde del recorte, y se
resuelve dejando aire alrededor de la caja.

El recorte se expande alrededor de la caja del cartel con tres márgenes relativos independientes:
izquierdo, derecho y vertical. Se evaluó una grilla de **72 combinaciones** sobre las 117 imágenes de
evaluación.

**El margen vertical.** El efecto es **monótono**, promediado sobre el resto de la grilla:

| Margen vertical | 0,06 | 0,12 | 0,18 | 0,24 |
|---|---|---|---|---|
| Lectura completa | **0,819** | 0,812 | 0,810 | 0,770 |

Un margen vertical generoso incorpora el marco del cartel y las filas de LEDs vecinas, y el
reconocedor, que redimensiona cada línea a una altura fija de 48 píxeles, gasta esa altura en
carrocería en vez de en letras. El valor se redujo de 0,12 a 0,06 el 2026-09-16.

**Los márgenes laterales son asimétricos**: 0,18 a la izquierda y 0,06 a la derecha, es decir, el
izquierdo es **tres veces** el derecho. El fundamento es específico del dominio: **en los carteles de
Montevideo el número de línea está a la izquierda**, y es el dato que no se puede perder.

**Criterio metodológico explícito.** Los márgenes laterales **no** se ajustaron contra el conjunto de
evaluación, a diferencia del vertical. La razón quedó escrita en el repositorio: con 56 imágenes que
tienen destino esperado, **una sola imagen vale 1,8 puntos porcentuales**, de modo que optimizar
sobre esa grilla sería ajustar al conjunto de evaluación y no al problema. Sólo se adoptó el cambio
del margen vertical porque su efecto sobrevive al ruido y es monótono en toda la grilla.

**Los valores vigentes y dónde viven.** `SIGN_MARGINS = (0.18, 0.06, 0.06)` (izquierdo, derecho y
vertical, como fracción de la caja; `hardware/raspi/virovision/bus.py:53-61`). Son los valores por
defecto del pipeline, pero el dispositivo se los pasa explícitamente: los márgenes dependen del
modelo que dibuja la caja, y el modelo se elige en el dispositivo (`--bus-model`).

**Una prueba sin márgenes, y la vuelta.** El 2026-10-21 el equipo probó leer la caja del detector
reentrenado tal cual, con los tres márgenes en cero, bajo la hipótesis de que un detector mejor
entrenado ya no necesitaba colchón. Contra un video en pantalla el "1" entró completo, pero en otras
pruebas del equipo se siguió perdiendo a veces, y el 2026-10-22 los márgenes volvieron a los valores medidos (PR #122 de
ViroVision). Con el zoom digital (sec. 7.4.10), una lectura se descarta, sin descontarla de los intentos,
si la caja **con márgenes** queda fuera del recorte del procesador de imagen: de lo contrario el
margen izquierdo se cortaría en el borde del cuadro sin aviso y el primer dígito volvería a perderse.
La aplicación muestra exactamente el recorte que leyó el OCR, margen incluido.

### 7.4.7 La lectura: comparación de motores de OCR

Se evaluaron tres motores detrás de una misma interfaz, sobre el mismo conjunto y con los mismos
recortes:

| Motor de OCR | Número | Destino | Lectura completa | Tiempo (mediana) |
|---|---|---|---|---|
| **PP-OCRv5 vía ONNX** (el elegido; se ejecuta en la placa) | 89,6 % | **78,6 %** | **85,4 %** | **7 ms** |
| PaddleOCR 3.x con su runtime nativo | 89,6 % | 76,8 % | 79,2 % | 118 ms |
| PP-OCRv4 vía ONNX | 87,5 % | 73,2 % | 75,0 % | 81 ms |

Se incluye además Tesseract como línea de base clásica de la comparación.

**La razón que decide no es sólo la métrica.** El runtime nativo de PaddleOCR **no tiene distribución
compilada para la placa**: las versiones disponibles para ARM de 64 bits sólo alcanzan hasta Python
3.12, y el sistema operativo de la placa ejecuta Python 3.13. Ejecutar los mismos modelos exportados
a ONNX resuelve simultáneamente la disponibilidad, la precisión y la latencia. El consumo de memoria
del OCR sobre la placa es de aproximadamente **140 MB**.

**Dos ajustes de configuración con efecto desproporcionado**, que ilustran cuánto del resultado
depende de la configuración y no del modelo:

1. **El reconocedor por alfabeto.** La configuración por defecto usa un reconocedor de 18 000 clases
   pensado para chino e inglés, que **no incluye la Ñ**. El reconocedor latino tiene 503 clases, con
   Ñ y vocales acentuadas, y pesa la mitad. El cambio llevó el acierto del **número del 79 % al
   92 %** y la **lectura completa del 79 % al 88 %**, con la misma latencia.
2. **El detector de texto dentro del OCR.** Con sus parámetros por defecto fragmentaba el texto del
   cartel en trozos sin sentido (`'5'`, `'BRAI'`, `'E'`). Con el límite de lado ajustado a 320
   píxeles por el máximo, lee `('115', 'LUIS BRAILLE')` en 25 ms.

### 7.4.8 Interpretación y reparación contra el catálogo

La salida del OCR se interpreta buscando un número de dos a cuatro dígitos como línea y el texto
alfabético como destino, y luego **se valida contra el catálogo** de la STM (sec. 7.4.2: 504 filas, 145
líneas). El catálogo cumple tres funciones.

**Repara por similitud.** Corrige errores sistemáticos del reconocedor. En la primera corrida real
sobre la placa, el registro muestra la entrada `15 LUIS BRALLE` y la salida `115, LUIS BRAILLE`. La
coincidencia tolera dígitos por letras y espacios perdidos (`MEMID0ZAE` y `ME MDOZA E` son MENDOZA),
con resguardos contra elegir un destino real pero equivocado: un mínimo de cuatro letras y un margen
de 0,05 sobre el mejor lugar distinto; las variantes ortográficas del mismo lugar en los datos
abiertos no compiten entre sí.

**Decide qué se puede decir.** Desde el 2026-10-06 **sólo se dice lo que el catálogo conoce**: una
línea que no existe no se anuncia, y un destino que no coincide con ninguno no se dice. La regla salió
de una prueba en la placa en la que el sistema anunciaba "Bus 1" a partir de lecturas basura (`1M12`)
y deletreaba destinos ilegibles (`U2 NOEVR`), lo único que una voz sintética puede hacer con ese
texto. Para quien no ve, "línea 330" sola es una respuesta honesta; un destino deletreado no lo es.
Medido sobre las 117 imágenes, el destino pasó de **76,8 % a 89,3 %** (`docs/SESSION-LOG.md`,
2026-10-06, cont. 5).

**Completa la mitad que no se leyó.** Desde el 2026-10-07, cuando la confianza del OCR es menor a
**0,8**, el catálogo completa la mitad del cartel que falta, sólo si no es ambigua: un destino que
sirve **una sola línea** da esa línea (116 de los 257 destinos) y una línea con **un solo terminal**
da ese destino. Lo inferido queda marcado aparte de lo leído (`Reading.inferred`), **no vota** (la
misma lectura dudosa volvería cuadro a cuadro y se daría la razón a sí misma) y nunca reemplaza
dígitos que el OCR sí leyó (`docs/SESSION-LOG.md`, 2026-10-07; `bus_banner/catalog.py`).

### 7.4.9 El modo vigilancia

**El modo ómnibus no es una fotografía.** El usuario no ve venir el ómnibus, de modo que no puede
decidir el instante de la captura: si el sistema esperara un gesto por vehículo, el gesto llegaría
tarde. El modo se diseñó, por lo tanto, como **vigilancia continua**: mientras está activo, la cámara
permanece abierta y el detector corre en cada cuadro dentro del sensor.

La lógica de anuncio:

1. Una caja de ómnibus aparece y **persiste** durante un número de cuadros proporcional a la tasa de
   captura → se confirma la presencia y se anuncia que *se acerca un ómnibus*.
2. Cuando el cartel alcanza una altura legible (**22 píxeles**) se recorta y se lee.
3. Una lectura que el catálogo **confirma en ambos campos** se anuncia de inmediato; si no, se
   espera a que **dos lecturas coincidan**. Media lectura (sólo número o sólo destino) espera algunas
   lecturas más a que aparezca la otra mitad.
4. **Cada ómnibus se anuncia una sola vez.**

Un seguidor de objetos mantiene la identidad de cada vehículo entre cuadros y estima, comparando el
área del último tercio de su trayectoria contra el primero, si se acerca o se aleja.

**El silencio también es parte del diseño.** Hay dos temporizadores de supresión: 15 segundos para
el anuncio de presencia y 10 segundos para una misma línea recién anunciada. Se incorporaron a raíz
de un defecto observado en la primera corrida real (sec. 7.4.11).

**Evidencia de cada lectura.** Desde el 2026-10-12 (#114) el modo guarda el cuadro y el recorte exacto
que leyó el OCR, unidos a la fila de telemetría de esa lectura, en un almacenamiento privado del
servidor; la aplicación los muestra en su pantalla de inicio (#118). Sirven para auditar en la
estación de trabajo qué vio el sistema cuando dijo, o no dijo, una línea, y son la materia prima del
conjunto de evaluación con fotografías del propio dispositivo (sec. 7.4.2).

### 7.4.10 Zoom digital sobre el cartel

**Problema.** En una prueba de campo del 2026-10-19 el ómnibus se detectó de lejos, pero el cartel
sólo se volvió legible con el vehículo prácticamente encima, demasiado tarde para uno que no se
detiene. La causa es la resolución: el cuadro del que sale el recorte tiene 1024 píxeles de ancho
(1024×766) sobre un sensor de 4056, y un número a 20 m ocupa del orden de 9 píxeles de alto
(estimación, no medición). El reescalado del recorte agranda el borrón, no lo resuelve.

**Decisión** (ADR 0006, actualización 2026-10-19). Un **zoom digital dinámico** en el procesador de
imagen de la placa (`ScalerCrop`), centrado en el cartel de mayor área entre los alargados que ve el detector (relación de aspecto de al
menos 2, que corresponde al cartel frontal del ómnibus más cercano), hasta que el
cartel mide unos 64 píxeles de alto (más no sirve: el reconocedor redimensiona a 48) y sin que ocupe
más de la mitad del ancho del cuadro, para dejar margen al movimiento de la cabeza. Si el detector
pierde el cartel, el zoom se sostiene 1,5 s y vuelve a 1x. El detector del sensor **sigue viendo el
campo completo**, porque su zona de entrada es un control propio del IMX500, separado del recorte
del procesador de imagen; el seguimiento trabaja en ese campo completo y sólo la caja que va al OCR
se traduce al cuadro ampliado (`hardware/raspi/virovision/zoom.py`). Se descartaron el zoom óptico
(la cámara tiene lente fija) y el zoom fijo (que achicaría el campo también cuando no hay ómnibus).

**Medición en la placa** (2026-10-22, Zero 2 W, contra un video del 115 en pantalla;
`docs/mediciones/2026-10-22-zoom-omnibus.md`):

| Qué | Resultado |
|---|---|
| Zoom con el cartel en cuadro | 2,0x |
| Cuadros con detecciones, por latido de 5 s | entre 68 y 76, a 15 cuadros por segundo |
| Cartel lejano (~10 px de alto; el mínimo sin zoom es 22 px) | anunciado a los **7,6 s**, tras tres lecturas ilegibles |
| Cartel más cercano | anunciado a **1,0 s**, con una lectura |
| Modo de sensor completo (hasta 4x) | 10 cuadros por segundo, 65 MB libres de 415, la cámara se trabó: **no entra en la Zero 2 W** |

En el modo de sensor agrupado que usa la placa, el techo práctico es 2x. **Pendiente**: la prueba en
la calle, con y sin zoom, midiendo a qué distancia se anuncia la línea. Si el cuello resulta ser el
detector, que de lejos no encuentra el cartel, la segunda fase consiste en mover también su zona de
entrada hacia el ómnibus detectado.

### 7.4.11 Defectos detectados en la primera ejecución sobre el dispositivo

La primera ejecución del pipeline completo sobre la placa reveló cinco defectos que ninguna prueba
sobre la estación de trabajo había expuesto. Se documentan porque son, en conjunto, el mejor
argumento a favor de la regla metodológica de sec. 5.2.2:

1. **Un ómnibus, dos anuncios.** El anuncio salió duplicado en un segundo para un mismo vehículo: se
   movió la cámara, el seguidor perdió la pista y el vehículo volvió a entrar como uno nuevo. El
   seguidor por sí solo no alcanza; se agregó la supresión temporal por línea.
2. **El primer dígito se pierde.** El OCR leía `15` donde el cartel decía `115`: el borde izquierdo
   de la caja caía sobre el "1", un trazo fino que además queda pegado al ícono de accesibilidad para
   silla de ruedas que precede al número (sec. 7.4.6; bitácora del 15 de septiembre de 2026). Tres
   remedios simultáneos: margen izquierdo tres veces el derecho, medio voto para líneas fuera del
   catálogo, y reparación por similitud.
3. **El OCR no puede correr en el hilo de la cámara.** La biblioteca de captura da el sensor por
   perdido si nadie consume cuadros durante aproximadamente un segundo, y una pasada de OCR tarda
   cerca de un segundo. Se separó en dos hilos comunicados por colas, lo que eliminó los errores de
   tiempo de espera del sensor.
4. **La reproducción encadenada de audio falla.** Solicitar dos archivos en una misma invocación del
   reproductor falla en el segundo. Se pasó a una invocación por archivo, encoladas. Sin esta
   corrección, el destino nunca se escuchaba.
5. **El reintento con detección de texto es caro.** El segundo intento de lectura, activando la
   detección de texto dentro del OCR, cuesta 2 a 3 segundos sobre la placa; se restringió a los
   casos en que la primera pasada no devolvió ni número ni destino.

### 7.4.12 Los anuncios pregrabados

El dispositivo **no sintetiza voz**: reproduce archivos de audio pregrabados almacenados en su
tarjeta de memoria. Son **386 archivos** (los números de línea, 239 destinos y algunos genéricos)
generados a partir del catálogo con una voz en español, a 175 palabras por minuto, en formato
monoaural de 22 kHz y 16 bits, de unos 30 KB cada uno.

La razón de esta decisión es directa: **un anuncio que necesita la nube para poder decirse es un
anuncio que enmudece exactamente cuando hace falta**. Es el ADR 0001 aplicado a la capa de audio. El
mismo criterio gobierna los avisos de sistema (sec. 7.6.3).

## 7.5 El pipeline de reconocimiento de productos

### 7.5.1 Estructura

```
doble click en el botón
  ├─ 1. la placa captura y publica la fotografía  (HTTP sobre el punto de acceso)
  ├─ 2. la aplicación la descarga                 (~50 ms)
  ├─ 3. la envía al proxy y de allí al modelo      (~0,85 a 1,7 s)
  ├─ 4. el modelo devuelve tres campos             {tipo, marca, detalle}
  ├─ 5. la aplicación arma la frase en español
  ├─ 6. síntesis de voz                            (~1 a 1,5 s)
  └─ 7. el audio vuelve a la placa y se reproduce   (~50 ms)
```

Presupuesto total: **aproximadamente 3 segundos**, dentro del objetivo de 3 a 4 segundos fijado por
el equipo.

### 7.5.2 La respuesta estructurada y el orden de la frase

El modelo no devuelve prosa libre sino **tres campos separados**: tipo de producto, marca y detalle.
La aplicación arma con ellos la frase que se pronuncia, y el orden de los campos es una decisión de
accesibilidad: **quien no ve escucha la frase entera antes de poder decidir**, de modo que lo que más
discrimina va primero. Se dice *«arroz Saman, Blue Patna 1 kg»* y no *«Blue Patna 1 kg, arroz»*.

La estructura en campos tiene una segunda ventaja: **cada campo puede faltar por separado**, y decir
dos de tres sigue siendo útil. Una respuesta en prosa es correcta o no lo es; una respuesta en campos
se degrada con gracia.

Un defecto encontrado en la placa ilustra la necesidad de validar esa frontera: en una ocasión el
dispositivo pronunció literalmente la palabra «null». La corrección consistió en distinguir prosa de
estructura de datos antes de enviar nada a la voz (la prosa no se interpreta como JSON) de modo que
un valor nulo, un objeto vacío o una respuesta con las claves en otro idioma nunca se lean en voz
alta.

### 7.5.3 Síntesis de voz

La síntesis utiliza la voz del sistema operativo por defecto. Cuando hay conectividad puede usarse
opcionalmente un servicio de síntesis de nube que genera un archivo de audio, con instrucciones
explícitas de pronunciación en español rioplatense. La necesidad se verificó en la placa: sin esa
indicación, el sistema pronunciaba *«Macarrones Adria»* con fonética inglesa.

### 7.5.4 Alcance del modo y su relación con el conjunto de evaluación

El alcance original era la **canasta básica**: un repertorio acotado de productos. Esa delimitación
tenía sentido mientras la precisión alcanzable era desconocida. Medido contra el dispositivo real, el
modelo identifica correctamente cualquier alimento que se le presente, envasado o suelto.

En consecuencia se separaron dos cosas que estaban confundidas: **lo que el sistema contesta** y **lo
que el sistema mide**. El modo responde sobre cualquier alimento o producto de almacén; la canasta
básica sobrevive como **conjunto de evaluación**, es decir, como el repertorio contra el cual se
reportan exhaustividad, precisión, exactitud y F1. Ese conjunto **todavía no está construido**, y su
construcción con fotografías tomadas por el propio dispositivo es una tarea pendiente de la etapa
final.

### 7.5.5 El respaldo local, pendiente

El ADR 0001 admite la nube como acelerador **con respaldo local garantizado**. En el modo
supermercado ese respaldo **aún no existe**: sin conectividad o sin credenciales, el sistema lo
anuncia por voz y no realiza la lectura. Degrada correctamente (no falla en silencio, que es el
comportamiento prohibido) pero no cumple todavía la garantía completa del ADR 0001. Cerrar esta
excepción requiere evaluar un modelo multimodal pequeño sobre productos reales, y es trabajo
pendiente declarado.

## 7.6 La aplicación móvil

### 7.6.1 Stack y estructura

| Componente | Versión |
|---|---|
| Expo SDK | 57 |
| React Native | 0.86 (Nueva Arquitectura, JSI) |
| React | 19 |
| TypeScript | modo estricto |

Al 2026-10-22, el código de la aplicación (`app/src`) suma **133 archivos y 12 979 líneas**: 97
archivos y 9 188 líneas de código, y 36 archivos y 3 791 líneas de pruebas (contados con `wc -l`
sobre los `.ts` y `.tsx`). Está organizado en cuatro capas con una
regla de dependencia unidireccional: componentes de interfaz → funcionalidades (con estado de React)
→ servicios (infraestructura, sin React) → tipos compartidos. Los textos visibles viven en un único
módulo de internacionalización, con claves en inglés y valores en español.

### 7.6.2 Patrones de diseño recurrentes

Cinco patrones se repiten a lo largo del código y constituyen su arquitectura efectiva:

**a) Interfaz, sustituto y selector.** Cada servicio que depende de un módulo nativo expone una
interfaz, un sustituto tipado que falla de manera explícita, y un selector que devuelve la
implementación real si el módulo nativo está presente. Esto permite ejecutar la aplicación completa
en un entorno sin Bluetooth (un simulador, una suite de pruebas) y garantiza que la ausencia de una
capacidad se manifieste como **un estado etiquetado y no como una excepción no controlada**.

**b) Módulo con estado propio en lugar de hook.** El servicio de lectura dejó de ser un hook de React
durante el desarrollo, por una razón concreta: la solicitud proveniente del botón físico llegaba como
estado de React y debía atravesar una cadena de actualizaciones y efectos para llegar a ejecutarse.
Eso funciona con la aplicación en primer plano y **no funciona con la pantalla bloqueada**, que es el
escenario real de uso. Hoy el módulo se suscribe directamente al cliente Bluetooth y React lo observa
mediante la API de suscripción a fuentes externas.

**c) Dependencias inyectadas como funciones de acceso, no como valores.** La configuración del
servicio de lectura recibe funciones que resuelven el modelo seleccionado, la descarga de la foto o
el envío de audio, y no sus valores. El motivo es que la suscripción se instala una sola vez: si se
capturara el valor, el sistema usaría indefinidamente la configuración vigente en el momento del
arranque.

**d) Política pura separada del módulo nativo.** Las decisiones (a qué salida enviar el audio, qué
transporte usar, cómo interpretar un fragmento) viven en funciones puras, separadas del código que
habla con el sistema operativo. Esto es lo que hace que esas decisiones sean verificables por
pruebas automatizadas (sec. 7.8).

**e) Contratos espejados y verificados.** Las definiciones que cruzan la frontera entre repositorios
(el perfil GATT, el catálogo de avisos, el esquema de telemetría, el registro de proveedores) existen
en dos copias, y **una prueba automatizada falla si se desincronizan**.

**Las fronteras arquitectónicas se imponen con herramientas, no con comentarios.** La configuración
del analizador estático prohíbe explícitamente que los módulos de reconocimiento y de audio importen
los servicios de nube o de telemetría, materializando las restricciones de los ADR 0001, 0006 y 0008.
La justificación está escrita en el propio archivo de configuración: antes era un comentario en cada
módulo, y un comentario no detiene a nadie.

### 7.6.3 Gestión de la salida de audio

Es el subsistema más elaborado de la aplicación, porque **la voz es la interfaz** y un fallo aquí
deja al usuario sin ninguna otra vía de información.

**Sesión de audio.** Se configura explícitamente en modo de mezcla con otras fuentes, **en contra de
la recomendación por defecto del framework**, que sugiere atenuar o interrumpir el resto del audio
del sistema. El fundamento es que en este producto el resto del audio del sistema **es el lector de
pantalla**, es decir, la interfaz del usuario: atenuarlo lo baja a mitad de frase e interrumpirlo lo
corta.

**Permanencia en segundo plano.** iOS concede pocos segundos de ejecución a una aplicación despertada
por una notificación Bluetooth, y el ciclo de lectura necesita más. La solución es un **tono de
mantenimiento inaudible** (40 Hz a −50 dBFS) reproducido en bucle mientras dura la lectura: audio
efectivamente sonando es lo que mantiene el proceso vivo. Se descartó deliberadamente un archivo de
silencio digital, por ser precisamente el recurso que un sistema operativo tiene más probabilidad de
dejar de honrar.

**Señal acústica de inicio.** Al solicitarse una lectura se reproduce un breve tono de confirmación.
Cumple dos funciones: confirma al usuario que el gesto se registró, y es **el único diagnóstico
disponible** de que el sistema despertó correctamente: se escucha, o no se escucha, y ninguna
consola de desarrollo puede aportar esa información cuando el teléfono está bloqueado en un bolsillo.

**Enrutamiento.** Dos funciones puras deciden por dónde sale cada sonido: una para las lecturas y
otra para los avisos de sistema. La elección del usuario (teléfono o dispositivo) vale para todo lo
que suena: las lecturas de los dos modos, los avisos y la prueba de audio. Son dos y no una porque **un aviso no necesita síntesis**: los
avisos son archivos pregrabados que residen en la tarjeta del dispositivo, de modo que pueden decirse
sin internet, sin WiFi y sin credenciales. Unificar ambas decisiones haría que todo aviso relativo a
la red cayera al teléfono precisamente en el momento en que al usuario se le indicó que todo sale por
los anteojos.

En todos los casos **el teléfono es el respaldo, y el silencio es el único resultado prohibido**. El
motivo por el que un sonido cayó al respaldo se registra en telemetría y no se anuncia al usuario.

**Un defecto instructivo.** El catálogo de avisos es cerrado, y tres de ellos no tienen archivo
pregrabado a propósito, cada uno por una razón distinta: el dispositivo no puede anunciar su propia
ausencia; elegir el teléfono como salida enruta la confirmación al teléfono; y el tercero corrige un
bucle infinito detectado en la placa (el dispositivo respondía a un comando desconocido con un error,
la aplicación convertía todo error del dispositivo en un aviso, y el aviso volvía al dispositivo como
otro comando). La regla que quedó es **el dispositivo no informa sus propias fallas**.

**Una voz por vez.** Cada salida sabía interrumpirse a sí misma y ninguna sabía interrumpir a la
otra: con la salida cambiada a mitad de una frase, el teléfono y el dispositivo hablaban encimados.
La regla adoptada es que **quien empieza a hablar calla al otro**: antes de hablar, el teléfono le
envía al dispositivo una orden de silencio, y antes de enviarle un aviso detiene su propia voz. Se
aplica en los dos puntos de entrega, el de las lecturas y el de los avisos, y no en cada llamador
(ADR 0003, actualización del 2026-09-18).

**La frase del ómnibus.** La lectura que llega del dispositivo se dice con su destino cuando lo hay,
porque el destino es lo que distingue dos ómnibus de la misma línea. Sin número se dice sólo el
destino, y sin ninguno de los dos se dice que se acerca un ómnibus: un anuncio vacío es el único
resultado que una interfaz de voz no puede tener (`app/src/features/recognition/format.ts`).

**Los errores no se dicen.** Desde el ADR 0011 (2026-10-06), el texto de un error nunca llega a la
pantalla ni a la voz: se registra en la telemetría (sec. 7.8.3), y la persona escucha una frase fija, en
lenguaje llano, que indica qué hacer. Callar del todo no es una opción: para quien no ve la pantalla,
el silencio después de apretar el botón es indistinguible de un dispositivo roto.

### 7.6.4 Vinculación y gestión del enlace

La aplicación gestiona la conexión sin intervención del usuario. Se conecta al arrancar, reconecta
con un retardo creciente ante la pérdida del enlace, **se une automáticamente a la red WiFi del
dispositivo** con las credenciales que recibió por Bluetooth, espera a que el servicio responda, y
abandona esa red cuando el dispositivo apaga el punto de acceso. La configuración de red que el
usuario debe realizar es **ninguna**.

Varias optimizaciones del módulo están documentadas junto al defecto que las motivó: filtrar la
telemetría repetida para no registrar cada notificación de estado idéntica, no reiniciar la
verificación de red en cada latido (lo que cancelaba la anterior y hacía que la red nunca alcanzara
el estado listo), y no anunciar dos veces la misma disponibilidad.

**Una operación Bluetooth por vez.** Con la salida en el dispositivo, la aplicación dejó de poder
unirse a la red WiFi: el anuncio de conexión, una escritura lanzada sin esperar, coincidía con la
lectura de las credenciales de la red, y la lectura volvía vacía. En lugar de reordenar esa línea,
el cliente Bluetooth pasó a **encolar todas sus operaciones en el orden en que se piden**
(`app/src/services/ble/serialize.ts`), porque la misma forma existía en otros puntos del código y
la clase de defecto no lanza ni registra nada.

La pestaña del dispositivo muestra su nombre y, desde el 2026-10-06, **el nivel de batería en
texto**, leído del monitor de corriente de la fuente (sec. 7.3.3) y con un aviso explícito por debajo del
20 % (`app/src/features/device/DeviceSummary.tsx`): para un usuario ciego una barra no existe.

### 7.6.5 Configuración

La pantalla de ajustes tiene **tres bloques y ninguno más**: el selector de modelo, la elección de
por dónde se escucha, y una descripción de qué reconoce el sistema con un botón para probar el audio.
No hay sección de apariencia (ADR 0010) ni de cuenta (la aplicación no tiene inicio de sesión).

### 7.6.6 La capa de cuenta, archivada

La autenticación contra el backend está implementada (correo electrónico y contraseña, sesión
persistida) pero **no está conectada a la navegación**: la aplicación se publica sin inicio de
sesión. La decisión, registrada en el ADR 0002, es que el núcleo del producto es local y una cuenta
no agrega valor al usuario. El código se conserva archivado y no eliminado, por si en el futuro se
incorpora una sincronización opcional.

## 7.7 La accesibilidad como criterio de diseño

### 7.7.1 Fundamento

La elección de React Native se apoya en el trabajo de Mascetti et al. (2020) sobre accesibilidad en
frameworks multiplataforma, que documenta que estos exponen únicamente **un subconjunto** de las
capacidades de accesibilidad nativas. De ese hallazgo se derivan tres reglas de trabajo, adoptadas
explícitamente por el proyecto:

1. Preferir **componentes estándar** correctamente anotados, que heredan el comportamiento del
   sistema operativo.
2. **Evitar interfaces muy personalizadas**, que son precisamente el punto débil identificado.
3. Tratar la **verificación con lectores de pantalla reales** y las **pruebas de usabilidad con
   personas ciegas** como hitos obligatorios, no como supuestos.

Consecuencia concreta: la barra de navegación es la **barra nativa** del sistema y no una dibujada en
JavaScript, porque así hereda sin costo el manejo de foco, el rotor del lector de pantalla, los
tamaños de texto dinámicos y la preferencia de movimiento reducido.

### 7.7.2 Reglas de diseño adoptadas

Cinco reglas se repiten literalmente a lo largo del código y funcionan como criterio de aceptación de
cualquier cambio de interfaz:

| Regla | Implicación |
|---|---|
| **El estado nunca se comunica sólo por color** | El color refuerza; el texto es lo que el lector de pantalla pronuncia |
| **Un control ausente no comunica ningún estado** | Un control que no se puede usar se deshabilita con una pista que explica por qué, en lugar de ocultarse |
| **El botón muta, no se reemplaza** | Si un control cambia de identidad, el lector de pantalla pierde el foco: una trampa ya experimentada |
| **La voz es la interfaz** | Un fallo silencioso deja al usuario esperando una respuesta que no llega |
| **El silencio no es un resultado disponible** | Toda ruta de ejecución termina en algo pronunciado |

Otras decisiones puntuales, cada una con su fundamento:

- **Tipografías embebidas en el binario** y no cargadas en tiempo de ejecución: un cambio de fuente a
  mitad del arranque produce un salto de maquetado, y en una aplicación para baja visión eso
  desorienta más que en cualquier otra.
- **Botón primario con borde** en lugar de relleno: el verde de marca alcanza 2,44:1 sobre el fondo
  claro, y el borde de un control requiere 3:1 según WCAG 1.4.11; el borde aporta el contraste sin
  alterar el relleno.
- **Anuncio de espera por cuota**: para quien no ve la pantalla, una aplicación que espera es
  indistinguible de una aplicación colgada, de modo que la espera se dice.
- **Una segunda lectura solicitada durante una lectura en curso se ignora y no se encola**: para
  cuando terminara la primera, la segunda correspondería a una escena que el usuario ya dejó atrás.
- **Plazo máximo de 12 segundos por lectura**, cuatro veces la mediana medida, y 4 segundos para la
  descarga de la fotografía.

### 7.7.3 La fotografía en pantalla

La aplicación muestra la fotografía capturada por el dispositivo, **después** de los campos del
resultado y no antes. La ubicación es deliberada: la voz ya pronunció el resultado y el lector de
pantalla debe llegar primero a lo que se puede leer. La imagen no cumple una función de diagnóstico
sino de verificación para usuarios con resto visual o para un acompañante: es lo único que distingue
*«el modelo se equivocó»* de *«la fotografía era del techo»*.

El modo ómnibus no tenía equivalente, porque el dispositivo lee solo y por Bluetooth sólo llegaba el
resultado. Desde el 2026-10-12 el dispositivo guarda, por cada ómnibus, el cuadro en que lo detectó y
cada recorte del cartel que pasó al OCR, y la aplicación los baja por WiFi (sec. 8.6.3). Desde el 2026-10-13, la
pantalla de inicio en modo ómnibus los muestra por ómnibus: el cuadro, y debajo de cada lectura su
texto y el recorte. Ese recorte es **exactamente el que leyó el OCR, margen incluido**, de modo que
la imagen explica la lectura: si el «1» de una línea quedó afuera o pegado al borde, se ve. Como el
resto del camino de evidencia, es una herramienta de desarrollo y se retira antes de la versión
final (`app/src/features/device/BusShots.tsx`).

## 7.8 Verificación

### 7.8.1 Cobertura de pruebas automatizadas

| Componente | Pruebas | Alcance |
|---|---|---|
| Aplicación móvil | **332** en 36 suites | Políticas puras, contratos de frontera, contraste, orden de ejecución |
| Daemon del dispositivo | **195** (y 2 omitidas) | Núcleo independiente del transporte, gestos del botón, modos, modo ómnibus, zoom, batería, evidencia |
| Pipeline de ómnibus | **96** | Geometría del recorte, detector, seguimiento, interpretación, catálogo |

Cifras al 2026-10-22, obtenidas corriendo cada suite: `npx jest` en `app/`, `pytest` en
`hardware/raspi/` y en el repositorio `bus-banner-recognizer` (rama `feat/bus-line-reader`, commit
`becd2f0`).

Las pruebas que mejor representan la orientación del proyecto son cuatro:

**Contraste verificado automáticamente.** Una suite implementa el cálculo de relación de contraste de
WCAG y verifica el nivel AAA (7:1) para texto, 4,5:1 para el color de acento y 3:1 para bordes de
control. Incluye un bloque que **documenta los límites conocidos de la paleta de marca** y por qué
cada uno se corrigió, de modo que un cambio de color que rompa el criterio falla la compilación.

**La lectura sin pantalla.** Fija el **orden** de las etapas (confirmación acústica, envío,
liberación de la sesión) y no el resultado, porque lo que puede fallar con la pantalla bloqueada es
la secuencia. Cubre la toma de la sesión de audio antes de la primera operación asíncrona, el
respaldo al teléfono, el plazo máximo, y el caso de un dispositivo con software anterior.

**El enrutamiento de avisos**, incluido el caso explícito de que nunca se devuelva al dispositivo una
queja originada en el dispositivo.

**Los contratos espejados**, que verifican que la aplicación sólo nombre archivos de audio que el
dispositivo realmente tiene, que no queden archivos en el dispositivo que nada pueda solicitar, y que
un comando de modo entre en una sola escritura Bluetooth.

### 7.8.2 Una lección metodológica sobre las pruebas

Una prueba del proyecto verificaba que, sin proxy configurado, la petición fuera directa al
proveedor. Pasaba localmente y fallaba en integración continua, porque la configuración se leía del
entorno del proceso y el entorno difería entre ambos. El diagnóstico quedó registrado: **la prueba
medía el entorno, no el código**. La corrección fue hacer inyectables tanto las credenciales como el
reloj utilizado por el limitador de tasa, criterio que se generalizó al resto del código.

### 7.8.3 Telemetría como instrumento de medición

La aplicación registra eventos de ejecución en el backend propio: 65 puntos de registro, con el
tiempo transcurrido separado **por etapa** (descarga de la fotografía, lectura, síntesis, envío de
audio) y no como un total. La razón es que son etapas que fallan y demoran por motivos distintos, y
agregadas se observan como un único «tardó». Esta instrumentación es la que permitió detectar
defectos que no se manifestaban en la interfaz, y sustituyó a la información de diagnóstico que se
retiró de la pantalla (sec. 7.2.7).
