# 4. Marco teórico: secciones a incorporar

> Este archivo contiene **las secciones nuevas y las ampliaciones** del capítulo 4. Las secciones ya
> redactadas en el documento vigente (Inteligencia Artificial, Machine Learning, Deep Learning,
> Visión por Computadora, Desarrollo móvil multiplataforma, Arquitectura Bridge→JSI, Justificación de
> React Native y API de accesibilidad) se conservan sin cambios y no se repiten aquí.

## 4.x Evaluación de modelos de reconocimiento

Toda comparación entre alternativas de reconocimiento necesita un criterio numérico común. Las
cuatro métricas que este trabajo utiliza se construyen sobre la matriz de confusión, es decir, sobre
el cruce entre lo que el sistema respondió y lo que correspondía responder: verdaderos positivos
(VP), falsos positivos (FP), verdaderos negativos (VN) y falsos negativos (FN).

| Métrica | Definición | Qué significa en ViroVision |
|---|---|---|
| **Exhaustividad** (*recall*) | VP / (VP + FN) | De todos los ómnibus o productos realmente presentes, cuántos el sistema detectó. Mide **lo que se escapa**: perder un ómnibus tiene un costo alto para el usuario |
| **Precisión** (*precision*) | VP / (VP + FP) | De todo lo que el sistema anunció, cuánto era correcto. Mide **los anuncios falsos**: para un usuario ciego, un número de línea inventado es peor que un «no pude leerlo» |
| **Exactitud** (*accuracy*) | (VP + VN) / total | La proporción global de aciertos. Útil para comparar alternativas entre sí bajo idénticas condiciones |
| **F1** | 2 · (precisión · exhaustividad) / (precisión + exhaustividad) | Media armónica de ambas. Resume el equilibrio en un solo número, apto para tablas comparativas |

La asimetría entre precisión y exhaustividad es una decisión de producto y no estadística. En un
sistema cuya única salida es la voz y cuyo usuario no puede contrastar el resultado con la escena,
**un error silencioso es recuperable y un error afirmado no lo es**: el usuario que no recibe
respuesta vuelve a intentar, mientras que el usuario al que se le anuncia una línea equivocada sube
al ómnibus equivocado. Esto lleva a privilegiar la precisión sobre la exhaustividad cuando ambas
compiten, y a preferir el silencio informado («no pude leerlo») sobre la respuesta insegura.

### Métricas específicas de detección de objetos

En detección no basta con clasificar: hay que localizar. La correspondencia entre una caja predicha y
una caja real se establece mediante la **intersección sobre unión** (*Intersection over Union*, IoU),
el cociente entre el área de solapamiento y el área de la unión de ambas cajas. Una predicción se
considera verdadero positivo si su IoU con una caja real supera un umbral.

De ahí se derivan:

- **AP** (*Average Precision*): el área bajo la curva precisión-exhaustividad de una clase.
- **mAP** (*mean Average Precision*): el promedio del AP sobre todas las clases. Se reporta
  habitualmente como **mAP@0,5** (umbral de IoU fijo en 0,5, criterio heredado de PASCAL VOC) y como
  **mAP@0,5:0,95** (promedio sobre umbrales de 0,5 a 0,95 en pasos de 0,05, criterio introducido por
  COCO y considerablemente más exigente, porque premia la exactitud de la localización).

Un detector puede tener un mAP@0,5 alto y un mAP@0,5:0,95 mucho menor: eso indica que encuentra los
objetos pero sus cajas no se ajustan con precisión a sus bordes. En un pipeline como el de ViroVision,
donde la salida del detector alimenta un recorte que luego se lee, la calidad del ajuste importa
directamente.

## 4.x Detección de objetos en una etapa: la familia YOLO

> *Esta sección amplía el apartado existente «Detección de objetos (Object Detection)».*

### De dos etapas a una etapa

Los primeros sistemas de detección basados en redes convolucionales resolvían el problema en **dos
etapas**: un primer módulo proponía regiones candidatas de la imagen y un segundo clasificaba cada
propuesta. Esta familia, integrada por R-CNN (Girshick et al., 2014), Fast R-CNN (Girshick, 2015) y
Faster R-CNN (Ren et al., 2015), alcanzó precisiones altas, pero su costo computacional es
proporcional al número
de propuestas evaluadas, lo que dificulta su uso en tiempo real y, con más razón, en hardware
embebido.

Los detectores **de una etapa** eliminan la fase de propuesta: una única pasada de la red produce
simultáneamente las coordenadas de las cajas y las probabilidades de clase para toda la imagen. YOLO
(Redmon et al., 2016) y SSD (Liu et al., 2016) son los representantes fundacionales de esta familia.
La contrapartida clásica era una menor precisión, especialmente sobre objetos pequeños; buena parte
de la evolución posterior se orientó a cerrar esa brecha, incluida la función de pérdida focal
introducida con RetinaNet (Lin et al., 2017) para compensar el desbalance entre fondo y objeto.

Para ViroVision la elección es forzada por el contexto de uso: el modo ómnibus exige evaluar **cada
cuadro de video** dentro de un dispositivo alimentado por batería. Un detector de dos etapas no es
una alternativa viable en ese presupuesto.

### Anclas y ausencia de anclas

Los detectores de una etapa clásicos predicen desplazamientos respecto de un conjunto de **cajas de
referencia** (*anchor boxes*) de tamaños y proporciones predefinidos. Ese diseño introduce
hiperparámetros sensibles al dominio (cuántas anclas, de qué proporciones) que deben ajustarse al
conjunto de datos.

Las arquitecturas **sin anclas** (*anchor-free*), como FCOS (Tian et al., 2019), predicen
directamente las distancias desde cada posición del mapa de características a los bordes del objeto,
eliminando esos hiperparámetros y reduciendo el número de predicciones a procesar. Las versiones
recientes de YOLO adoptaron este enfoque, lo que simplifica tanto el entrenamiento como la
exportación a formatos de inferencia embebida.

### Supresión de no-máximos

Un detector produce múltiples cajas superpuestas para un mismo objeto. La **supresión de no-máximos**
(*Non-Maximum Suppression*, NMS) es el postprocesamiento que conserva, para cada grupo de cajas
solapadas por encima de un umbral de IoU, únicamente la de mayor confianza. Es un paso barato en una
CPU convencional pero no trivial cuando la inferencia ocurre dentro de un acelerador: en ese caso la
supresión debe formar parte del modelo convertido, con sus umbrales fijados en tiempo de exportación
y no ajustables en ejecución, una restricción que este trabajo encuentra de manera concreta (§7.4.5).

### La familia YOLO y sus variantes de tamaño

> *El documento vigente ya describe el funcionamiento general de YOLO, su entrenamiento sobre COCO y
> la disponibilidad de variantes de distinto tamaño. Se agrega aquí lo que resulta determinante para
> las decisiones de este proyecto.*

Las implementaciones actuales de la familia ofrecen el mismo modelo en varios tamaños, identificados
por un sufijo: *nano*, *small*, *medium*, *large* y *extra-large*. Todas comparten la arquitectura y
difieren en el ancho y la profundidad de la red, lo que traduce directamente una relación entre
precisión, memoria y latencia.

Esta escalabilidad es la propiedad que hace a la familia apta para un proyecto como éste, porque
permite usar **el mismo modelo en dos roles distintos**: una variante grande como herramienta de
trabajo sobre una estación de escritorio (por ejemplo, para generar anotaciones automáticas que luego
se revisan manualmente) y la variante más pequeña como modelo desplegado en el dispositivo. La
elección de la variante *nano* en este trabajo, sin embargo, no obedece a un compromiso de precisión
sino a una restricción dura del acelerador (§7.4.3).

### Aprendizaje por transferencia y ajuste fino

Entrenar un detector desde cero exige volúmenes de datos inalcanzables para un proyecto de esta
escala. La práctica estándar es el **aprendizaje por transferencia**: partir de un modelo
preentrenado sobre un conjunto grande y general, como COCO (Lin et al., 2014), con sus 80
categorías de objetos cotidianos, y continuar su entrenamiento sobre el conjunto específico del
dominio. Las capas
iniciales, que aprendieron detectores de bordes, texturas y formas genéricas, se reutilizan; las
capas finales se especializan.

El procedimiento aporta además una ventaja secundaria que este proyecto aprovecha: como COCO ya
incluye la categoría *bus*, el modelo preentrenado localiza ómnibus **sin ningún entrenamiento
adicional**, lo que permitió construir un pipeline funcional antes de tener un conjunto de datos
propio, y generar anotaciones automáticas para esa clase.

### Aumentación de datos y su límite en dominios con texto

La **aumentación de datos** consiste en generar variantes sintéticas de las imágenes de entrenamiento
(rotaciones, cambios de escala, alteraciones de color, recortes, composiciones de varias imágenes)
para que el modelo aprenda invarianzas y no memorice el conjunto. Es una técnica estándar y
especialmente valiosa cuando el conjunto de datos es pequeño.

Tiene, sin embargo, un límite que es directamente relevante para este trabajo: **las
transformaciones deben preservar la semántica del objeto**. La reflexión horizontal, habitual en
detección de objetos genéricos, es contraproducente cuando el objeto contiene texto, porque produce
ejemplos de entrenamiento con caracteres espejados que no existen en el dominio real. Del mismo modo,
una perturbación agresiva del tono elimina precisamente la señal cromática que distingue un display
LED del resto de la escena. La selección de qué aumentaciones aplicar es, por lo tanto, una decisión
de dominio y no una configuración por defecto (§7.4.3).

## 4.x Reconocimiento óptico de caracteres

> *Esta sección amplía el apartado existente «Reconocimiento Óptico de Caracteres (OCR)».*

Los sistemas modernos de OCR basados en aprendizaje profundo no resuelven el problema en un solo
paso, sino en una **arquitectura de dos etapas**:

**1. Detección de texto.** Localiza las regiones de la imagen que contienen texto, devolviendo cajas
o polígonos. Los enfoques predominantes son la predicción de mapas de afinidad entre caracteres
de CRAFT (Baek et al., 2019) y la binarización diferenciable de un mapa de probabilidad de DBNet
(Liao et al., 2020), esta última particularmente eficiente porque traslada al entrenamiento un paso de
umbralización que tradicionalmente era un postprocesamiento costoso.

**2. Reconocimiento de texto.** Transcribe el contenido de cada región detectada. La arquitectura de
referencia es la red convolucional-recurrente CRNN (Shi et al., 2017): una parte convolucional extrae
características de la imagen recortada, una parte recurrente modela la secuencia, y la salida se
alinea con la transcripción mediante **clasificación temporal conexionista** (*Connectionist Temporal
Classification*, CTC; Graves et al., 2006), una función de pérdida que permite entrenar sin necesidad
de conocer la correspondencia exacta entre cada columna de píxeles y cada carácter.

Frente a estos sistemas, los motores clásicos basados en segmentación de caracteres y clasificación
individual, cuyo representante canónico es Tesseract (Smith, 2007) y que sigue siendo la línea de
base habitual, son notoriamente más frágiles ante iluminación variable, tipografías no convencionales y
ángulos de captura no frontales, que son exactamente las condiciones del problema de este trabajo.

Las familias de modelos **PP-OCR** (Du et al., 2020) y sus versiones sucesivas son sistemas
completos y deliberadamente livianos que combinan ambas etapas y están pensados para ejecución en
dispositivos con recursos limitados, lo que las convierte en candidatas naturales para este proyecto.

### Dos propiedades del reconocedor que importan en la práctica

**El alfabeto del reconocedor.** Un reconocedor se entrena sobre un repertorio de caracteres fijo. Un
repertorio muy amplio (diseñado, por ejemplo, para escritura ideográfica) es más pesado y no
necesariamente cubre los caracteres del idioma objetivo: la **Ñ** y las vocales acentuadas pueden
estar ausentes. Elegir el reconocedor adecuado al alfabeto del dominio es una decisión con impacto
medible, tanto en precisión como en tamaño del modelo (§7.4.7).

**La resolución de entrada del detector de texto.** El detector de texto opera sobre la imagen
reescalada a un tamaño de trabajo. Cuando ese tamaño no corresponde al contenido (una franja ancha y
baja, como el cartel frontal de un ómnibus) el detector puede fragmentar una línea de texto en
regiones inconexas, y el reconocedor transcribe entonces fragmentos sin sentido. El ajuste de este
parámetro es específico de la geometría del objeto.

## 4.x Inteligencia artificial en el borde

> *Esta sección amplía el apartado existente «Modelos de Inteligencia Artificial en el borde (Edge
> AI)», cuyo contenido introductorio se conserva.*

### Plataformas de cómputo embebido

Las plataformas disponibles para ejecutar inferencia fuera de un servidor se agrupan en tres
categorías con perfiles muy distintos:

| Categoría | Ejemplo | Perfil |
|---|---|---|
| **Microcontrolador** | ESP32 | Consumo mínimo (decenas de mW), costo mínimo, memoria de decenas a cientos de KB. Admite únicamente redes muy reducidas |
| **Computadora de placa única (SBC)** | Raspberry Pi Zero 2 W, Pi 3/4/5 | Sistema operativo completo, memoria de cientos de MB a GB, consumo de 0,5 a 5 W. Ejecuta redes medianas en CPU, con latencias del orden del segundo |
| **SBC con GPU integrada** | NVIDIA Jetson | Capacidad de inferencia muy superior, con consumo y costo proporcionalmente mayores |

La diferencia decisiva entre un microcontrolador y una computadora de placa única no es sólo la
potencia bruta sino la **disponibilidad de ecosistema**: bibliotecas de visión, runtimes de
inferencia y controladores de cámara existen, compilados y mantenidos, para sistemas operativos
completos, y no para entornos con decenas de KB de memoria.

### Aceleradores de inferencia

Cuando la CPU de la plataforma no alcanza, se recurre a hardware especializado:

- **Unidades de procesamiento tensorial (TPU) externas**, conectadas por USB o PCIe, que ejecutan
  redes cuantizadas a enteros de 8 bits con un consumo muy bajo. Su limitación es que ocupan un
  puerto y agregan un componente, un costo y un consumo al dispositivo.
- **Unidades de procesamiento neuronal (NPU) integradas** en el sistema en chip del dispositivo.
- **Inferencia dentro del propio sensor de imagen.** Es la categoría más reciente y la que este
  trabajo emplea. El sensor Sony IMX500 incorpora un procesador de inferencia en el mismo
  encapsulado que el sensor de imagen: el modelo se carga en su memoria interna y el sensor entrega,
  además del cuadro de video, **el resultado de la inferencia ya calculado**. La consecuencia
  arquitectónica es significativa: la detección deja de aparecer en el presupuesto de cómputo y de
  latencia del procesador principal, que queda libre para otras tareas.

La contrapartida de esta última categoría es una restricción estricta de recursos. La memoria
disponible en el chip es del orden de unos pocos megabytes y debe alojar simultáneamente el modelo y
el runtime, lo que en la práctica limita tanto el tamaño del modelo como la **cantidad** de modelos
que pueden residir en el sensor. Además, sólo un subconjunto acotado de arquitecturas cuenta con
herramientas de conversión soportadas.

### Cuantización

La **cuantización** reduce la precisión numérica de los pesos y activaciones de una red, típicamente
de punto flotante de 32 bits a enteros de 8 bits, mediante factores de escala que mapean el rango
real a los 256 valores disponibles (Jacob et al., 2018). El beneficio es triple: el modelo ocupa
aproximadamente una cuarta parte, la aritmética entera es sustancialmente más rápida, y muchos
aceleradores **sólo** ejecutan aritmética entera.

Existen dos estrategias:

- **Cuantización posterior al entrenamiento** (*post-training quantization*): se parte del modelo ya
  entrenado y se determinan los factores de escala a partir de un conjunto pequeño de datos de
  calibración. No hay reentrenamiento ni retropropagación. Es rápida y es la que este trabajo emplea.
- **Entrenamiento consciente de la cuantización** (*quantization-aware training*): simula el efecto
  de la cuantización durante el entrenamiento, de modo que el modelo aprenda a tolerarla. Produce
  mejores resultados a costa de un ciclo de entrenamiento completo.

La cuantización **tiene un costo en precisión**, cuya magnitud depende del modelo y del dominio y no
puede asumirse despreciable: debe medirse comparando el modelo cuantizado contra el original sobre el
mismo conjunto de evaluación y con la misma métrica.

### Formatos de intercambio

Un modelo entrenado en un framework debe convertirse para ejecutarse en otro entorno. Los formatos
relevantes son **ONNX** (*Open Neural Network Exchange*), un formato abierto e independiente de
framework con runtimes disponibles para múltiples arquitecturas, incluida ARM de 64 bits; **TensorFlow
Lite**, orientado a móviles y microcontroladores; y los **formatos propietarios de cada acelerador**,
que constituyen el último paso de la cadena de conversión.

Un aspecto práctico rara vez discutido y que este trabajo encuentra de manera directa: la
disponibilidad de una biblioteca **compilada para la arquitectura y la versión de lenguaje de la
plataforma destino** puede ser un criterio de selección más determinante que la precisión del modelo.
Un runtime sin distribución para la placa no es una alternativa, por buenos que sean sus resultados.

### Presupuesto energético

En un dispositivo alimentado por batería el consumo es una restricción de diseño de primer orden. El
presupuesto se descompone en el consumo en reposo (que determina cuánto dura el dispositivo sin
usarse) y el consumo en actividad, dominado por la cámara, la radio y la inferencia. La autonomía
resultante se obtiene relacionando la capacidad de la celda con el consumo medio ponderado por el
perfil de uso esperado, y **debe verificarse con instrumentación y no estimarse**, porque las cifras
publicadas corresponden a configuraciones que rara vez coinciden con la del dispositivo construido.

## 4.x Comunicación inalámbrica de corto alcance

### Bluetooth Low Energy y GATT

**Bluetooth Low Energy** (BLE) es un protocolo diseñado para intercambiar cantidades pequeñas de
datos con un consumo energético mínimo, y explícitamente **no** para transferencia sostenida de
volumen. Su modelo de datos es el **GATT** (*Generic Attribute Profile*): un periférico expone uno o
más **servicios**, cada uno con **características** identificadas por un UUID, sobre las que el
central puede leer, escribir o suscribirse para recibir notificaciones.

Cuatro parámetros determinan el rendimiento real de un enlace BLE:

- **Intervalo de conexión.** El tiempo entre eventos de conexión sucesivos. Los sistemas operativos
  móviles lo negocian según sus propias políticas de energía y no lo ceden al desarrollador.
- **ATT MTU.** La unidad máxima de transmisión de la capa de atributos, que acota el tamaño útil de
  cada notificación. Se negocia al conectar.
- **Data Length Extension** (DLE). Introducida en la especificación Bluetooth 4.2, permite que un
  paquete de radio transporte hasta 251 bytes de carga útil en lugar de los 27 originales. **Es una
  capacidad del controlador de radio**: un controlador que no la implementa fragmenta cada
  notificación en múltiples paquetes de radio, con la sobrecarga correspondiente.
- **Capa física.** La especificación 5.0 introdujo un modo de 2 Mbps, también dependiente del
  controlador.

De la combinación de estos parámetros surge una cota superior de caudal que **es una propiedad del
enlace y no del software**. Un cálculo elemental (tamaño de notificación dividido por intervalo de
conexión) permite estimarla, y cuando la medición coincide con ese cálculo queda establecido que el
límite es estructural y que no hay optimización de software que lo supere. Reducir el tamaño de
fragmento, contra la intuición, empeora el resultado, porque el número de eventos de conexión (y no
el de bytes) es el factor limitante.

Para el audio, BLE clásico no es un transporte viable: la transmisión de audio por Bluetooth usa
perfiles de Bluetooth Classic como A2DP, que introducen latencia de codificación del orden de
centenares de milisegundos y que, en un dispositivo que además mantiene BLE y WiFi activos, compiten
por la misma antena en la banda de 2,4 GHz.

### WiFi como plano de datos

Cuando un dispositivo embebido debe transferir imágenes, WiFi ofrece caudales dos a tres órdenes de
magnitud superiores a BLE, a costa de un consumo considerablemente mayor y de un tiempo de
establecimiento de conexión no despreciable. La arquitectura habitual en dispositivos sin
infraestructura de red disponible es que **el dispositivo publique su propio punto de acceso** y el
teléfono se una a él bajo demanda.

Esta topología presenta un problema práctico relevante para una aplicación que también necesita
alcanzar servicios de nube: al unirse a una red sin salida a internet, el sistema operativo del
teléfono puede enrutar todo su tráfico por esa interfaz y perder la conectividad de datos móviles. La
solución es configurar el punto de acceso para que **no anuncie puerta de enlace ni servidor de
nombres**, de modo que el teléfono lo trate como una red de alcance local y conserve su ruta por
defecto.

### El patrón de dos planos

De lo anterior se desprende un patrón arquitectónico aplicable a cualquier dispositivo embebido que
deba combinar interacción de baja latencia con transferencia ocasional de volumen: **separar el plano
de control del plano de datos**. BLE, permanentemente conectado y de consumo mínimo, transporta
eventos y comandos; WiFi, activado bajo demanda, transporta las cargas útiles grandes. El plano de
control es además el que transporta las credenciales y la señalización necesarias para establecer el
plano de datos, lo que elimina toda configuración manual por parte del usuario.

## 4.x Síntesis de voz y gestión de audio como interfaz

### Síntesis de voz

La **síntesis de voz a partir de texto** (*Text-to-Speech*, TTS) convierte texto en señal de audio.
Las opciones disponibles para una aplicación móvil son tres, con perfiles diferentes:

| Opción | Latencia | Requiere red | Calidad |
|---|---|---|---|
| Voz del sistema operativo | Baja e inmediata | No | Aceptable; depende de la voz instalada |
| Síntesis de nube | Segundos, variable | Sí | Superior, con control de prosodia y de variante regional |
| Audio pregrabado | Nula | No | Máxima, pero limitada a un repertorio cerrado |

La tercera opción merece atención en sistemas asistivos. Cuando el conjunto de enunciados posibles es
finito y conocido de antemano (los números de línea de una red de transporte, un catálogo cerrado de
avisos de sistema) **pregrabar es estrictamente superior**: elimina la latencia, elimina la
dependencia de red y garantiza la pronunciación correcta de nombres propios, que es precisamente
donde los sintetizadores fallan. El costo es de almacenamiento, que en el orden de decenas de
megabytes resulta irrelevante en una tarjeta de memoria.

Un aspecto específico del español rioplatense: los sintetizadores de nube aplican por defecto una
fonética que no corresponde al idioma cuando el texto contiene marcas o nombres propios de origen
extranjero, lo que exige indicar explícitamente la variante lingüística deseada.

### Sesión de audio y ejecución en segundo plano

Los sistemas operativos móviles gestionan el audio mediante una **sesión** que declara la intención
de la aplicación: si reproduce o graba, y **cómo debe comportarse frente al audio de otras
aplicaciones**. Las políticas disponibles son mezclar, atenuar el resto (*ducking*) o interrumpirlo.

En una aplicación convencional, atenuar el resto es la elección razonable. En una aplicación
asistiva **no lo es**, porque el audio del resto del sistema incluye al **lector de pantalla**, que
es la interfaz del usuario: atenuarlo lo vuelve inaudible a mitad de enunciado e interrumpirlo lo
corta. La política correcta es la mezcla.

El segundo problema es la **ejecución en segundo plano**. Un dispositivo externo que solicita una
acción despierta a la aplicación por una notificación del sistema, pero el tiempo de ejecución
concedido es breve y puede no alcanzar para completar un ciclo que involucra red y síntesis. La
estrategia establecida para extenderlo es mantener **audio efectivamente en reproducción** durante la
operación, lo que señala al sistema operativo que la aplicación está cumpliendo una función audible
legítima. Conviene que ese audio sea una señal real de nivel muy bajo y no silencio digital, que es
el caso que los sistemas operativos detectan y penalizan con mayor frecuencia.

### Señales acústicas no verbales

En interfaces auditivas, las **señales acústicas breves** (*earcons*) cumplen funciones que la voz
cumple peor: confirmar inmediatamente que una acción se registró, indicar el comienzo de una
operación, o señalar un cambio de estado. Su ventaja frente a un enunciado hablado es la latencia
(son instantáneas) y la ausencia de interferencia con el lector de pantalla. En un sistema donde el
resultado tarda segundos en llegar, una confirmación inmediata evita que el usuario repita el gesto
por creer que no fue registrado.

## 4.x Criterios de accesibilidad: WCAG

> *Esta sección complementa los apartados existentes sobre la API de accesibilidad de React Native.*

Las **Pautas de Accesibilidad para el Contenido Web** (*Web Content Accessibility Guidelines*, WCAG)
del W3C, en su versión 2.2, constituyen el marco de referencia normativo para accesibilidad digital y
se aplican, con las adaptaciones correspondientes, a interfaces móviles. Se organizan en cuatro
principios (perceptible, operable, comprensible y robusto) y en tres niveles de conformidad: A, AA y
AAA.

Los criterios que este trabajo utiliza como requisitos verificables son:

| Criterio | Exigencia | Aplicación en ViroVision |
|---|---|---|
| **1.4.3 Contraste (mínimo)**, nivel AA | 4,5:1 para texto normal; 3:1 para texto grande | Piso para todo texto |
| **1.4.6 Contraste (mejorado)**, nivel AAA | 7:1 para texto normal | Adoptado como criterio, por tratarse de una aplicación para baja visión |
| **1.4.11 Contraste no textual**, nivel AA | 3:1 para bordes de controles e indicadores de estado | Determina el diseño de los botones |
| **1.4.1 Uso del color**, nivel A | El color no puede ser el único medio para transmitir información | Origen de la regla «el estado nunca se comunica sólo por color» |
| **1.4.4 Redimensionado del texto**, nivel AA | El texto debe poder ampliarse sin pérdida de contenido | Soporte de tamaños de texto dinámicos del sistema |
| **2.5.5 Tamaño del objetivo**, nivel AAA | Área táctil suficiente | Dimensionado de los controles |

La **relación de contraste** se define entre las luminancias relativas de dos colores como
(L₁ + 0,05) / (L₂ + 0,05), donde L₁ es la luminancia del más claro. Al ser una fórmula cerrada, el
cumplimiento de estos criterios **puede verificarse automáticamente**, y este trabajo lo incorpora
como prueba automatizada que bloquea la integración ante un cambio que rompa el criterio (§7.8.1).

Una observación necesaria: el cumplimiento de WCAG es una **condición necesaria y no suficiente**.
Una interfaz puede satisfacer todos los criterios verificables y resultar inutilizable para una
persona ciega si el orden de lectura, la cantidad de gestos necesarios o la ausencia de
retroalimentación audible no se consideraron. De ahí que este proyecto trate las pruebas con lectores
de pantalla reales y con usuarios ciegos como hitos obligatorios y no como validación opcional.
