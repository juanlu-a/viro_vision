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
mientras esté activo el dispositivo vigila y anuncia lo que aparece (§7.4.6).

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
medición de throughput BLE (§7.2.1) mostró que el enlace de baja energía no puede mover una imagen
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

**Evidencia.** Medido sobre la placa, con el ciclo completo disparado por el botón físico:

| Etapa | Tiempo desde el gesto |
|---|---|
| Click del botón; el modo cambia a ómnibus | 0 |
| Vigilancia iniciada | 5 ms |
| El OCR devuelve la lectura | 1,27 s |
| Se anuncia «Ómnibus 115, Luis Braille» | **1,27 s** |

Lecturas posteriores en régimen: 971 ms, 1001 ms y 1006 ms.

**Conclusión operativa: el costo es el OCR.** La detección ocurre dentro del sensor de la cámara, no
consume CPU de la placa y no aparece en el presupuesto de tiempo: el sensor entrega cajas
delimitadoras a 15 cuadros por segundo mientras el procesador hace otra cosa.

**Costo de arranque.** Desde el encendido del servicio, el dispositivo responde a una consulta de
salud a los **7 segundos** y el modo ómnibus queda operativo a los **47 segundos**; los 40 segundos
intermedios son la carga de los modelos de OCR. Un reinicio del servicio sin apagar la placa reduce
el total a unos 24 segundos. Por eso los modelos se cargan al arrancar y no al apretar el botón: un
botón que contesta un minuto más tarde es, a los efectos del usuario, un botón roto.

### 7.2.5 El acelerador es el sensor de la cámara, no un módulo externo

**Problema.** El diseño original incorporaba un acelerador Coral TPU conectado por USB, con el
detector ejecutándose sobre él en formato TensorFlow Lite.

**Evidencia.** El sensor Sony IMX500 de la cámara oficial ejecuta el detector **dentro del propio
sensor**. La conversión del modelo entrenado arroja una ocupación de **7,12 MB sobre los 8 MB
disponibles en el chip (90 %)**, con verificación explícita de que el modelo entra. El sensor procesa
a **15 cuadros por segundo sin consumir CPU ni memoria de la placa**.

**Decisión.** El Coral sale del diseño. La consecuencia es doble: se elimina un componente, su costo
y su consumo, y se libera el único puerto USB de la placa. El camino TensorFlow Lite se abandona en
favor de ONNX y del formato propio del sensor.

**Consecuencia no deseada, documentada.** La ocupación del 90 % del chip implica que **sólo cabe un
modelo**, lo que condiciona directamente la elección del detector (§7.4.3).

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
| Coral TPU por USB | Reemplazado por la inferencia en el sensor (§7.2.5) |
| Realce de contraste (CLAHE) sobre el recorte del cartel | **Empeoró** el acierto del número: de 0,875 a 0,771 |
| Variante separada de la aplicación para pruebas internas | Con tres desarrolladores, cambiar de versión desde la plataforma de distribución alcanza; una segunda aplicación exige su propia ficha y su propia revisión |

## 7.3 El dispositivo

### 7.3.1 Componentes

| Función | Componente | Estado |
|---|---|---|
| Cómputo | Raspberry Pi Zero 2 W | **Sustituida temporalmente** por una Pi 3 B+ prestada |
| Visión | Raspberry Pi AI Camera (sensor Sony IMX500, 12 MP, inferencia en el sensor) | Integrada |
| Entrada | Pulsador táctil en GPIO 5 | Integrado y verificado |
| Audio | Salida PWM por GPIO (provisoria) → conversor digital-analógico I2S | **Pendiente** el conversor definitivo |
| Alimentación | Waveshare UPS HAT (C) + batería LiPo | Adquirida, sin integrar |
| Carcasa | Impresión 3D sobre la patilla | **Pendiente** |

**Sobre la placa en uso.** El conector de cámara de la Raspberry Pi Zero 2 W se dañó durante el
desarrollo y el trabajo continuó sobre una Raspberry Pi 3 B+ prestada. Es una sustitución
funcionalmente adecuada (mismo sistema operativo, misma interfaz de cámara) pero **con un
controlador de radio distinto**, lo que invalida la comparabilidad de cualquier medición de
Bluetooth realizada sobre ella. Este informe declara explícitamente esa limitación en cada medición
afectada.

**Sobre el audio.** La salida actual es audio por modulación de ancho de pulso redirigida a pines de
propósito general, suficiente para verificar el camino completo pero no para uso real. La limitación
es eléctrica y está documentada: un pin de propósito general entrega **16 mA**, mientras que un
auricular de 16 a 32 ohmios demanda del orden de **100 mA continuos**, seis veces el límite. El
destino es un conversor digital-analógico I2S, cuya integración exige además reubicar el pulsador,
que hoy ocupa uno de los pines necesarios. El volumen se limita al 90 % y no al 100 % porque la
salida PWM satura en el extremo superior, y la distorsión es peor que un volumen menor.

**Sobre el enfoque.** El sensor tiene **enfoque manual**. Las primeras capturas salieron
desenfocadas; el procedimiento quedó documentado como paso obligatorio de puesta en marcha, con una
herramienta auxiliar que calcula un puntaje de nitidez para ajustar el anillo contra un cartel
situado a 10-20 metros.

### 7.3.2 El daemon

El software del dispositivo es un servicio en Python de **4421 líneas** repartidas en 16 módulos,
con **86 pruebas automatizadas**. Su diseño separa un **núcleo independiente del transporte** (que
conoce los comandos, los modos y las transferencias) de los adaptadores que lo conectan al mundo: el
adaptador BLE sobre BlueZ, el servidor HTTP, la cámara y el audio.

Esa separación habilitó una herramienta de desarrollo decisiva: un **emulador** que ejecuta el mismo
núcleo sobre la pila Bluetooth de macOS, lo que permite desarrollar y probar la aplicación móvil
contra un dispositivo simulado, sin depender de la disponibilidad física de la placa.

El servicio expone además un pequeño servidor HTTP en el punto de acceso propio, con cuatro rutas:
consulta de salud, generación de datos de prueba, captura y entrega de la última fotografía
(1024 píxeles de lado mayor, calidad 70; aproximadamente 35 KB en 200 a 235 ms incluyendo la
captura) y recepción de audio para su reproducción.

**Configuración.** Las banderas de ejecución viven en un archivo de configuración del sistema, fuera
del paquete del servicio, de modo que sobreviven tanto a las actualizaciones como al cambio entre los
dos modos de operación descritos en §7.3.4.

**Seguridad del enlace.** Desde septiembre el dispositivo arranca con el emparejamiento Bluetooth
deshabilitado. Ninguna característica del perfil requiere autenticación, por lo que la aplicación
nunca necesitó un vínculo persistente, y deshabilitarlo elimina los diálogos de emparejamiento que
el sistema operativo del teléfono presentaba al usuario.

### 7.3.3 Energía y autonomía

El presupuesto energético está estimado a partir de mediciones de terceros sobre el mismo hardware,
**pendiente de verificación con instrumental propio**:

| Estado | Consumo estimado |
|---|---|
| Espera (BLE anunciando, sin video) | 0,5 – 0,6 W |
| Activo (cámara, punto de acceso y detección en el sensor) | 2 – 3 W, pico ~0,6 A |

| Celda | Dimensiones | Autonomía estimada |
|---|---|---|
| LiPo 2000 mAh | 50 × 34 × 10 mm, ~36 g | 3 – 4 h |
| LiPo 1000 mAh (incluida con el módulo) | 40 × 30 × 8 mm, ~20 g | 1,5 – 2 h |

**Estado real: el consumo no está medido.** Falta instrumentar la línea de alimentación con un
medidor en serie y leer el monitor de corriente que incorpora el módulo de alimentación; en
consecuencia, el campo de batería de la telemetría del dispositivo se reporta como nulo. Poder
anunciar el nivel de batería por voz es, en este proyecto, un requisito de accesibilidad y no una
comodidad: el usuario no puede consultar un indicador luminoso.

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
procedimiento de despliegue descrito en §8.7.

Como vía intermedia, el proyecto incorporó una herramienta que **apaga el punto de acceso a través
del enlace de control**, tras lo cual la placa vuelve sola a la red conocida y el acceso remoto queda
disponible sin abrir el dispositivo ni manipular la tarjeta. Medido sobre la placa: **cinco segundos
de punta a punta**.

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

**Conjunto de dos clases.** Para la variante de un único modelo (§7.4.3) se requería además la clase
`bus`. Etiquetar a mano 140 imágenes adicionales por segunda vez era evitable: las cajas de ómnibus
se generaron mediante **pseudo-etiquetado** con un modelo YOLO11x preentrenado sobre COCO (que ya
contiene la categoría `bus`) y **se revisaron manualmente una por una**. Se conservó la misma
partición.

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
Metropolitano de la Intendencia de Montevideo: **503 pares** de número y destino, con **145 números
de línea** y **256 destinos** distintos. Cumple dos funciones: reparar la salida del OCR por
similitud (§7.4.7) y generar el repertorio de anuncios pregrabados.

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

**Estado real del entrenamiento, declarado con precisión.** Las dos corridas efectivamente
ejecutadas (el detector de una clase y el de dos clases) se entrenaron con una configuración más
conservadora: **40 épocas, lote de 16, sobre CPU**. La configuración de 120 épocas documentada arriba
es la que el script define y **todavía no se ejecutó**.

El proyecto cuenta con acceso a un servidor con GPU NVIDIA Tesla V100 facilitado por Arnaldo Castro
S.A., **cuyo acceso ya está disponible y aún no se utilizó**. Completar el entrenamiento en esa GPU,
con la configuración completa, es trabajo inmediato de la etapa final y no un resultado ya obtenido.
Las métricas que se reportan a continuación corresponden, por lo tanto, a los modelos entrenados en
CPU con 40 épocas, y deben leerse como un **piso** y no como el techo de lo alcanzable.

### 7.4.4 La decisión del detector de dos clases

Esta es la decisión de modelado central del pipeline y se toma contra una restricción de hardware, no
contra una métrica.

**Las dos alternativas.**

- **Dos etapas:** un YOLO11n preentrenado sobre COCO localiza el ómnibus (categoría `bus`, ya
  presente en COCO), y un segundo YOLO11n ajustado localiza el cartel dentro de él. Dos modelos, dos
  inferencias por cuadro.
- **Una etapa:** un único YOLO11n ajustado sobre **dos clases** (`bus_sign` y `bus`). Un modelo, una
  inferencia.

**Comparación sobre las 117 imágenes de evaluación:**

| Detector | Margen vertical | Número | Destino | Lectura completa | Detección (mediana) |
|---|---|---|---|---|---|
| Dos etapas | 0,12 | 91,7 % | 75,0 % | **87,5 %** | 38 ms |
| Dos etapas | **0,06** | 89,6 % | **76,8 %** | **87,5 %** | 38 ms |
| Una etapa (dos clases) | 0,12 | 85,4 % | 69,6 % | 79,2 % | 21 ms |
| Una etapa (dos clases) | **0,06** | **89,6 %** | 71,4 % | 83,3 % | **21 ms** |

**Lectura de la tabla.** El esquema de dos etapas lee mejor: aventaja al de una etapa en **4,2 puntos
de lectura completa** y en **5,4 puntos de destino**. El ajuste de los márgenes de recorte (§7.4.5)
cerró aproximadamente la mitad de la brecha en lectura completa, pero no cerró nada de la diferencia
en destino.

**Y sin embargo se eligió el de una clase única de dos categorías.** La razón es que **el sensor sólo
admite un modelo cargado**: la ocupación del chip llega al 90 % con uno solo (§7.2.5), y el segundo
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

El recorte se expande alrededor de la caja del cartel con tres márgenes relativos independientes:
izquierdo, derecho y vertical. Se evaluó una grilla de **72 combinaciones** sobre las 117 imágenes de
evaluación.

**El margen vertical.** El efecto es **monótono**, promediado sobre el resto de la grilla:

| Margen vertical | 0,06 | 0,12 | 0,18 | 0,24 |
|---|---|---|---|---|
| Lectura completa | **0,819** | 0,812 | 0,810 | 0,770 |

Un margen vertical generoso incorpora el marco del cartel y las filas de LEDs vecinas, y el
reconocedor las interpreta como trazos. El valor se redujo de 0,12 a 0,06.

**Los márgenes laterales son asimétricos**: 0,18 a la izquierda y 0,06 a la derecha, es decir, el
izquierdo es **tres veces** el derecho. El fundamento es específico del dominio: **en los carteles de
Montevideo el número de línea está a la izquierda**, y es el dato que no se puede perder.

**Criterio metodológico explícito.** Los márgenes laterales **no** se ajustaron contra el conjunto de
evaluación, a diferencia del vertical. La razón quedó escrita en el repositorio: con 56 imágenes que
tienen destino esperado, **una sola imagen vale 1,8 puntos porcentuales**, de modo que optimizar
sobre esa grilla sería ajustar al conjunto de evaluación y no al problema. Sólo se adoptó el cambio
del margen vertical porque su efecto sobrevive al ruido y es monótono en toda la grilla.

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
alfabético como destino, y luego **se repara contra el catálogo de 503 pares** por similitud. Este
paso no es cosmético: corrige errores sistemáticos del reconocedor. En la primera corrida real sobre
la placa, el registro muestra la entrada `15 LUIS BRALLE` y la salida `115, LUIS BRAILLE`.

### 7.4.9 El modo vigilancia

**El modo ómnibus no es una fotografía.** El usuario no ve venir el ómnibus, de modo que no puede
decidir el instante de la captura: si el sistema esperara un gesto por vehículo, el gesto llegaría
tarde. El modo se diseñó, por lo tanto, como **vigilancia continua**: mientras está activo, la cámara
permanece abierta y el detector corre en cada cuadro dentro del sensor.

La lógica de anuncio:

1. Una caja de ómnibus aparece y **persiste** durante un número de cuadros proporcional a la tasa de
   captura → se confirma la presencia y se anuncia que *se acerca un ómnibus*.
2. Cuando el cartel alcanza una altura legible (**22 píxeles**) se recorta y se lee.
3. Cuando **dos lecturas coinciden** en el número, se anuncia la línea y el destino.
4. **Cada ómnibus se anuncia una sola vez.**

Un seguidor de objetos mantiene la identidad de cada vehículo entre cuadros y estima, comparando el
área del último tercio de su trayectoria contra el primero, si se acerca o se aleja.

**El silencio también es parte del diseño.** Hay dos temporizadores de supresión: 15 segundos para
el anuncio de presencia y 10 segundos para una misma línea recién anunciada. Se incorporaron a raíz
de un defecto observado en la primera corrida real (§7.4.10).

### 7.4.10 Defectos detectados en la primera ejecución sobre el dispositivo

La primera ejecución del pipeline completo sobre la placa reveló cinco defectos que ninguna prueba
sobre la estación de trabajo había expuesto. Se documentan porque son, en conjunto, el mejor
argumento a favor de la regla metodológica de §5.2.2:

1. **Un ómnibus, dos anuncios.** El anuncio salió duplicado en un segundo para un mismo vehículo: se
   movió la cámara, el seguidor perdió la pista y el vehículo volvió a entrar como uno nuevo. El
   seguidor por sí solo no alcanza; se agregó la supresión temporal por línea.
2. **El primer dígito se pierde.** El OCR leía `15` donde el cartel decía `115`, porque el primer
   dígito se funde visualmente con el ícono de accesibilidad para silla de ruedas que precede al
   número. Tres remedios simultáneos: margen izquierdo tres veces el derecho, medio voto para líneas
   fuera del catálogo, y reparación por similitud.
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

### 7.4.11 Los anuncios pregrabados

El dispositivo **no sintetiza voz**: reproduce archivos de audio pregrabados almacenados en su
tarjeta de memoria. Son **386 archivos** (los números de línea, 239 destinos y algunos genéricos)
generados a partir del catálogo con una voz en español, a 175 palabras por minuto, en formato
monoaural de 22 kHz y 16 bits, de unos 30 KB cada uno.

La razón de esta decisión es directa: **un anuncio que necesita la nube para poder decirse es un
anuncio que enmudece exactamente cuando hace falta**. Es el ADR 0001 aplicado a la capa de audio. El
mismo criterio gobierna los avisos de sistema (§7.6.3).

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

La aplicación tiene **118 archivos de código y 10 827 líneas**, organizados en cuatro capas con una
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
pruebas automatizadas (§7.8).

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
otra para los avisos de sistema. Son dos y no una porque **un aviso no necesita síntesis**: los
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

## 7.8 Verificación

### 7.8.1 Cobertura de pruebas automatizadas

| Componente | Pruebas | Alcance |
|---|---|---|
| Aplicación móvil | **282** en 30 suites | Políticas puras, contratos de frontera, contraste, orden de ejecución |
| Daemon del dispositivo | **86** | Núcleo independiente del transporte, gestos del botón, modos |
| Pipeline de ómnibus | **65** | Geometría del recorte, interpretación, catálogo, evaluación |

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
retiró de la pantalla (§7.2.7).
