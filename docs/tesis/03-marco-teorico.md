# 3. Marco teórico

## 3.1 Inteligencia artificial

La inteligencia artificial (*artificial intelligence*, AI), abreviada IA en español, es un campo de la informática dedicado al desarrollo de sistemas capaces de realizar tareas asociadas con capacidades de la inteligencia humana, como el aprendizaje, el razonamiento, la comprensión del lenguaje y la interpretación de información visual. Estas capacidades se implementan mediante procedimientos computacionales y no implican que los sistemas reproduzcan el funcionamiento de la mente humana.

Sus antecedentes modernos se remontan, entre otros trabajos, al artículo *Computing Machinery and Intelligence*, publicado por Alan Turing en 1950. En él se planteó la posibilidad de que las máquinas manifestaran un comportamiento inteligente y se propuso el denominado juego de imitación, posteriormente conocido como prueba de Turing. Esta prueba evalúa si un interrogador puede distinguir, mediante una conversación escrita, las respuestas de una máquina de las de una persona; no constituye una demostración de que la máquina piense como un ser humano.

El establecimiento de la IA como campo de investigación suele situarse en el encuentro de Dartmouth de 1956. Su propuesta, redactada en 1955 por John McCarthy, Marvin Minsky, Nathaniel Rochester y Claude Shannon, ya utilizaba el término *artificial intelligence* y planteaba investigar cómo las máquinas podían utilizar el lenguaje, formar conceptos y resolver problemas. Por ello, este encuentro representa un hito fundacional del campo, más que la creación de una única "primera inteligencia artificial".

En las décadas posteriores se desarrollaron sistemas especializados en tareas concretas. Un hito fue la victoria de Deep Blue, de IBM, sobre el campeón mundial de ajedrez Garry Kasparov en 1997. Este resultado mostró la capacidad de un sistema para superar el desempeño humano en una tarea delimitada, sin implicar una capacidad general para resolver cualquier problema.

Posteriormente, el aumento de la capacidad de cómputo, la disponibilidad de grandes conjuntos de datos y los avances en los métodos de aprendizaje favorecieron el desarrollo del aprendizaje profundo (*deep learning)*. Un ejemplo relevante para la visión por computadora fue el trabajo de Krizhevsky, Sutskever y Hinton, *AlexNet*, publicado en 2012: una red neuronal profunda logró mejorar considerablemente los resultados de clasificación de imágenes en ImageNet, utilizando entrenamiento acelerado mediante unidades de procesamiento gráfico (*graphics processing units*, GPU), procesadores capaces de realizar numerosos cálculos en paralelo.

Más recientemente, la IA generativa (*generative AI*), orientada a producir contenido como texto, imágenes o audio, y los modelos multimodales (*multimodal models*), capaces de procesar diferentes tipos de datos, han ampliado las aplicaciones de estas tecnologías. Estos avances conviven con sistemas especializados en tareas como el reconocimiento de imágenes y la detección de objetos.

Dentro de este campo, el aprendizaje automático (*machine learning*, ML) comprende los métodos que aprenden patrones a partir de datos. El aprendizaje profundo (*deep learning*, DL), a su vez, es una subcategoría del aprendizaje automático basada en redes neuronales con múltiples capas de procesamiento. Sus fundamentos se desarrollan en las secciones 3.1.1 y 3.1.2.

### 3.1.1 Machine Learning

El aprendizaje automático (*machine learning*, ML) es una subdisciplina de la inteligencia artificial que permite desarrollar sistemas que aprenden patrones a partir de datos, sin definir explícitamente todas las reglas necesarias para resolver una tarea. El resultado de este aprendizaje es un modelo: una representación matemática de relaciones presentes en los datos que permite generar predicciones ante nuevas entradas. En este contexto, una predicción puede ser tanto un valor numérico como la identificación de una categoría; por ejemplo, determinar si una imagen contiene un ómnibus.

Para comprender cómo aprende un modelo, es necesario definir sus parámetros (*parameters*): valores internos que se ajustan durante el aprendizaje y determinan cómo se transforman las entradas en resultados. En modelos como las redes neuronales, algunos de estos parámetros son los pesos (*weights*), coeficientes que multiplican las entradas de una operación y regulan su contribución al resultado. También pueden existir términos de sesgo (*bias*), que agregan un valor independiente de esas entradas. Por lo tanto, los pesos son un tipo de parámetro, pero ambos términos no son equivalentes.

En el desarrollo y uso de un modelo se distinguen dos procesos fundamentales:

1. **Entrenamiento (*training*):** proceso mediante el cual se aprende a partir de un conjunto de datos (*dataset*), es decir, una colección de ejemplos. En los modelos parametrizados, este proceso ajusta los parámetros según un objetivo de aprendizaje. En el aprendizaje supervisado, dicho ajuste puede guiarse mediante una función de pérdida (*loss function*), que cuantifica la discrepancia entre las predicciones y las respuestas esperadas.
1. **Inferencia (*inference*):** utilización del modelo entrenado para obtener resultados a partir de nuevas entradas. A diferencia del entrenamiento, la inferencia no implica por sí misma modificar los parámetros del modelo. Por ejemplo, procesar una nueva imagen para determinar qué objetos aparecen en ella corresponde a una operación de inferencia.

La finalidad del entrenamiento es que el modelo pueda generalizar (*generalization*), es decir, producir predicciones adecuadas sobre datos que no se utilizaron para ajustarlo. Cuando aprende particularidades de los ejemplos de entrenamiento y obtiene resultados deficientes ante nuevos datos, se produce sobreajuste (*overfitting*).

Entre los principales paradigmas de aprendizaje automático se encuentran:

1. **Aprendizaje supervisado (*supervised learning*):** utiliza ejemplos etiquetados. Una etiqueta (*label*) es la respuesta de referencia asociada a una entrada; por ejemplo, la categoría del objeto presente en una imagen.
1. **Aprendizaje no supervisado (*unsupervised learning*):** busca patrones o estructuras en datos que no incluyen respuestas de referencia, como la formación de grupos de ejemplos similares.
1. **Aprendizaje por refuerzo (*reinforcement learning*):** un agente, entendido como el sistema que selecciona acciones, aprende mediante su interacción con un entorno. Recibe recompensas, señales numéricas que valoran los resultados de sus acciones, y busca maximizar la recompensa acumulada.
### 3.1.2 Deep Learning y redes neuronales

El aprendizaje profundo (*deep learning*, DL) es una subcategoría del aprendizaje automático basada en redes neuronales artificiales (*artificial neural networks*) con múltiples capas de procesamiento. Estas redes toman una inspiración general de la interconexión de las neuronas biológicas, aunque constituyen modelos matemáticos y no reproducciones del cerebro humano.

Una neurona artificial es una unidad de cálculo que recibe valores numéricos, los combina mediante pesos e incorpora un término de sesgo, conceptos definidos en la sección 4.1.1. A continuación, aplica una función de activación (*activation function*), que transforma el resultado y permite introducir relaciones no lineales. La combinación de estas unidades permite representar patrones más complejos que los que podría describir una única operación lineal.

Las neuronas se organizan en capas (*layers*): una capa de entrada recibe los datos, las capas intermedias u ocultas (*hidden layers*) realizan transformaciones y una capa de salida produce el resultado. La organización de estas capas y sus conexiones constituye la arquitectura de la red (*network architecture*). Durante el entrenamiento se ajustan sus parámetros para resolver la tarea planteada.

La composición de múltiples capas permite aprender representaciones jerárquicas de los datos. En el procesamiento de imágenes, las primeras capas pueden identificar características simples, como bordes y texturas, mientras que las posteriores combinan esta información para representar formas y patrones más complejos. Así, las características relevantes se aprenden a partir de ejemplos, sin necesidad de definirlas todas manualmente. Estas representaciones permiten abordar tareas de visión por computadora, como la clasificación de imágenes y la detección de objetos, a partir de características aprendidas durante el entrenamiento.

El DL ha demostrado resultados destacados en reconocimiento de imágenes, procesamiento de lenguaje natural (*natural language processing*, NLP), que comprende tareas de análisis y generación de lenguaje humano, y síntesis de audio, es decir, generación de señales sonoras. En particular, constituye una de las bases tecnológicas de las soluciones modernas de visión por computadora (*computer vision*), campo dedicado a extraer información de imágenes y videos.

Para desarrollar una solución específica no es necesario entrenar una red desde cero. Un modelo preentrenado (*pretrained model*) es aquel cuyos parámetros ya fueron ajustados utilizando un conjunto de datos anterior. Estos parámetros pueden servir como punto de partida para una nueva tarea. Por ejemplo, una red entrenada con un conjunto amplio de imágenes puede haber aprendido características visuales útiles para reconocer objetos distintos de los considerados originalmente.

El aprovechamiento de este conocimiento se denomina aprendizaje por transferencia (*transfer learning*). Una forma de aplicarlo es el ajuste fino (*fine-tuning*), que consiste en continuar el entrenamiento de un modelo preentrenado, actualizando algunos o todos sus parámetros entrenables con datos de la tarea de destino. De este modo, el aprendizaje comienza desde una configuración que ya reconoce patrones visuales, en lugar de partir de parámetros inicializados sin ese conocimiento previo.

En detección de objetos, este procedimiento permite especializar un modelo en determinadas clases, entendidas como las categorías que debe identificar. Para ello se utilizan imágenes anotadas que indican tanto la clase de cada objeto como su ubicación mediante rectángulos delimitadores (*bounding boxes*). Cuando las categorías de destino difieren de las originales, también se adapta la salida del detector para representar las clases requeridas.

Un ejemplo de este procedimiento es partir de YOLO11n preentrenado y ajustarlo para detectar dos clases de interés: ómnibus y carteles de ómnibus. El entrenamiento reutiliza los parámetros compatibles del modelo original y los adapta mediante ejemplos de ambas categorías. Así, se obtiene un detector especializado a partir de una red que ya posee capacidades de reconocimiento visual. La familia YOLO se desarrolla en la sección 3.4; los detalles del entrenamiento realizado corresponden al capítulo de implementación.

## 3.2 Evaluación de modelos de reconocimiento

Toda comparación entre alternativas de reconocimiento necesita un criterio numérico común. Las cuatro métricas que este trabajo utiliza se construyen sobre la matriz de confusión, es decir, sobre el cruce entre lo que el sistema respondió y lo que correspondía responder: verdaderos positivos (VP), falsos positivos (FP), verdaderos negativos (VN) y falsos negativos (FN).

| **Métrica** | **Definición** | **Qué significa en ViroVision** |
|---|---|---|
| **Exhaustividad** (*recall*) | VP / (VP + FN) | De todos los ómnibus o productos realmente presentes, cuántos el sistema detectó. Mide **lo que se escapa**: perder un ómnibus tiene un costo alto para el usuario. |
| **Precisión** (*precision*) | VP / (VP + FP) | De todo lo que el sistema anunció, cuánto era correcto. Mide los **anuncios falsos**: para un usuario ciego, un número de línea inventado es peor que un "no pude leerlo" |
| **Exactitud** (*accuracy*) | (VP + VN) / total | La **proporción global de aciertos**. Útil para comparar alternativas entre sí bajo idénticas condiciones. |
| **F1** | 2 · (precisión · exhaustividad) / (precisión + exhaustividad) | **Media armónica** de ambas. Resume el equilibrio en un solo número, apto para tablas comparativas. |

La prioridad asignada a la precisión frente a la exhaustividad responde a una decisión de diseño basada en las consecuencias de los errores para el usuario. En un sistema que comunica los reconocimientos mediante la voz, la persona ciega puede no disponer de una forma inmediata de contrastar la información recibida con la escena. Anunciar una línea equivocada puede llevar a la persona a subir a un ómnibus equivocado. Por ello, se prioriza la fiabilidad de los reconocimientos anunciados, sin desconocer que una omisión también puede hacer perder una oportunidad de viaje. Cuando no se obtiene una lectura suficientemente fiable, se prefiere una respuesta explícita como "no pude leerlo", que informa la limitación y permite considerar un nuevo intento, antes que comunicar un resultado incierto.

## 3.3 Visión por computadora

La visión por computadora (*computer vision*, CV) es un campo de la inteligencia artificial dedicado a extraer información de imágenes y videos. Comprende tareas como la clasificación de imágenes, la detección de objetos y el reconocimiento de texto. Para resolverlas puede emplear diferentes métodos, entre ellos el aprendizaje automático (*machine learning*, ML) y el aprendizaje profundo (*deep learning*, DL).

En esta tesis, el desarrollo de los fundamentos de visión por computadora se centra en los métodos basados en aprendizaje profundo, particularmente en las redes neuronales utilizadas para detectar objetos y reconocer texto. Este enfoque permite comprender el funcionamiento de los modelos estudiados y su adaptación mediante aprendizaje por transferencia. La detección de objetos se desarrolla en la sección 3.3.1, la familia YOLO en la sección 3.4 y el reconocimiento óptico de caracteres en la sección 3.5.

Para su procesamiento, una imagen digital se representa mediante valores numéricos organizados espacialmente. Cada píxel es un elemento de la imagen que contiene información de intensidad o color. En una imagen en color RGB, esta información se distribuye en tres canales correspondientes al rojo, verde y azul (*red, green, blue*). Esta representación permite proporcionar imágenes como entrada a los modelos de aprendizaje automático.

Entre las arquitecturas utilizadas para analizar imágenes se encuentran las redes neuronales convolucionales (*convolutional neural networks*, CNN). Estas redes emplean operaciones de convolución: cálculos que aplican pequeños conjuntos de pesos, denominados filtros, sobre distintas regiones de la entrada. Durante el entrenamiento, los filtros aprenden a responder a patrones visuales útiles para la tarea. La aplicación de sucesivas capas permite combinar patrones locales y construir representaciones más complejas, siguiendo el aprendizaje jerárquico descrito en la sección 3.1.2.

### 3.3.1 Detección de objetos

La detección de objetos (*object detection*) es una tarea de visión por computadora que consiste en identificar y localizar uno o más objetos dentro de una imagen. Para cada objeto detectado, el modelo indica su clase, es decir, la categoría a la que lo asigna, y su posición mediante un rectángulo delimitador (*bounding box*). Este rectángulo se describe mediante coordenadas que permiten establecer su ubicación y extensión dentro de la imagen.

A diferencia de la clasificación de imágenes, que asigna categorías a la imagen en su conjunto, la detección permite localizar distintas instancias de objetos. Una instancia es una aparición individual de una categoría: por ejemplo, dos ómnibus presentes en una fotografía constituyen dos instancias de la misma clase. El detector puede proporcionar un rectángulo independiente para cada uno, así como identificar objetos de diferentes clases dentro de la misma escena.

Además de la clase y la ubicación, los detectores suelen proporcionar una puntuación de confianza (*confidence score*), que expresa el grado de confianza del modelo en cada predicción. Se puede establecer un umbral de confianza, entendido como un valor mínimo de aceptación, para descartar predicciones con puntuaciones inferiores. Esta puntuación no garantiza que una detección sea correcta: el desempeño del modelo debe comprobarse mediante su evaluación sobre imágenes de referencia.

Entre los enfoques utilizados para resolver esta tarea se encuentra la familia YOLO, cuyo funcionamiento se desarrolla en la sección 3.4.

### 3.3.2 Detección de objetos en una etapa: la familia YOLO

YOLO, acrónimo de *You Only Look Once*, es una familia de modelos basados en redes neuronales profundas utilizada para la detección de objetos en imágenes y videos. Su propuesta original plantea obtener las ubicaciones de los objetos y sus categorías mediante una única evaluación de la red sobre la imágen completa.

Este enfoque se denomina detección en una etapa (*one-stage object detection*). A diferencia de los detectores de dos etapas, que primero generan regiones candidatas y después las clasifican y refinan, los detectores de una etapa predicen directamente las ubicaciones y las clases a partir de las características de la imagen. Esto no significa que la red tenga una sola capa, sino que no requiere una etapa separada de generación de propuestas de regiones.

Durante la inferencia, el modelo recibe una imagen y produce predicciones de objetos. Cada predicción incluye la clase asignada, una puntuación de confianza y las coordenadas de un rectángulo delimitador (*bounding box*). Estas coordenadas permiten localizar el objeto y determinar la extensión de la región que ocupa en la imagen. Pueden expresarse, por ejemplo, mediante las posiciones de las esquinas superior izquierda e inferior derecha, o mediante el centro, el ancho y el alto del rectángulo. Las predicciones pueden filtrarse mediante un umbral de confianza para conservar aquellas que cumplen el criterio de aceptación establecido.

Una de las versiones de esta familia es YOLO11, desarrollada por Ultralytics. Sus modelos de detección se ofrecen en diferentes tamaños, que permiten considerar distintas relaciones entre capacidad de detección y requisitos de procesamiento. YOLO11n (*nano*) corresponde a la variante de menor tamaño de esta versión. El tiempo de inferencia depende también del hardware, la resolución de entrada y el entorno de ejecución, por lo que utilizar un detector de una etapa no garantiza por sí mismo un funcionamiento en tiempo real.

Ultralytics proporciona modelos YOLO11 de detección preentrenados sobre el dataset COCO (*Common Objects in Context*), un conjunto de datos que, para esta tarea, incluye 80 categorías, entre ellas la clase ómnibus. Sus parámetros constituyen un punto de partida para adaptar el detector a otras categorías o a condiciones específicas de uso mediante el aprendizaje por transferencia y el ajuste fino descritos en la sección 3.1.2.

Para realizar esta adaptación se utiliza un conjunto de imágenes anotadas con las clases y los rectángulos delimitadores de los objetos de interés. El entrenamiento ajusta los parámetros del modelo a la tarea de destino, permitiendo obtener un detector especializado a partir de los pesos preentrenados.

YOLO11 ofrece cinco tamaños de modelo de detección, identificados por una letra: n (nano), s (small), m (medium), l (large) y x (extra large). Todos comparten la misma arquitectura y difieren en la cantidad de capas y de canales, y por lo tanto en la cantidad de parámetros y en el cálculo necesario por imagen. La tabla resume los valores publicados por Ultralytics para entradas de 640×640 píxeles, con el mAP@0,5:0,95 sobre el conjunto de validación de COCO:

| **Modelo** | **Parámetros (millones)** | **Operaciones (GFLOPs)** | **mAP@0,5:0,95 (COCO)** |
|---|---|---|---|
| YOLO11n | 2,6 | 6,5 | 39,5 |
| YOLO11s | 9,4 | 21,5 | 47,0 |
| YOLO11m | 20,1 | 68,0 | 51,5 |
| YOLO11l | 25,3 | 86,9 | 53,4 |
| YOLO11x | 56,9 | 194,9 | 54,7 |

Fuente: documentación de modelos YOLO11 de Ultralytics. Pasar de la variante n a la x mejora el mAP en unos 15 puntos, a cambio de unas 22 veces más parámetros y 30 veces más operaciones. En un dispositivo con recursos limitados el tamaño suele estar determinado por la memoria disponible antes que por la precisión deseada; en este proyecto, la memoria del sensor de la cámara sólo admite la variante n (sec. 7.4.3). La variante x se utilizó, en cambio, fuera del dispositivo, para generar etiquetas de entrenamiento (sec. 7.4.2).

La comparación con otras alternativas se presenta en el apartado 3.6 del estado del arte. La justificación de la elección del modelo y los detalles de su entrenamiento para el proyecto se desarrollan en el capítulo 7.

### 3.3.3 Reconocimiento óptico de caracteres

El reconocimiento óptico de caracteres (*optical character recognition*, OCR) es una tecnología que permite convertir el texto contenido en una imagen en una secuencia de caracteres digitales. Su entrada puede ser una página escaneada, una fotografía o un recorte que contenga texto. El resultado puede almacenarse, buscarse, compararse y utilizarse en otros procesos informáticos.

Los sistemas de OCR pueden utilizar modelos de aprendizaje profundo (*deep learning*) previamente entrenados para reconocer patrones visuales de escritura. Durante la inferencia, el reconocedor recibe una imagen que contiene texto y utiliza los parámetros ya aprendidos para producir una secuencia de caracteres digitales. Este uso no requiere entrenar nuevamente el modelo ni modificar sus parámetros.

Para comprender su funcionamiento, conviene distinguir la detección de texto (*text detection*) del reconocimiento de texto (*text recognition*). La detección localiza las regiones de escritura y las delimita mediante rectángulos o polígonos. El reconocimiento interpreta esas regiones y genera su contenido como texto digital. Una organización habitual combina ambas tareas y puede incorporar operaciones adicionales, como corregir la orientación de la escritura.

La detección del objeto que contiene texto también debe distinguirse de estas tareas. Por ejemplo, un detector de objetos puede localizar un cartel de ómnibus y permitir obtener un recorte de su imagen. Esto determina dónde está el cartel, pero no qué dice. El reconocedor recibe la imagen del recorte y produce una secuencia de caracteres, como "103 RUTA 8 KM 21". Si la entrada ya contiene una línea de texto adecuadamente delimitada, puede procesarse directamente mediante reconocimiento; en otros casos, puede ser necesario detectar primero las regiones de escritura dentro del recorte.

La calidad de la imagen también influye en el resultado. El tamaño reducido de los caracteres, el contraste insuficiente, la inclinación y el ruido (variaciones de brillo o color que dificultan distinguir los trazos) pueden provocar errores, más especialmente en esta aplicación donde los banners son paneles LED (cuadrilla de puntos). El preprocesamiento (*preprocessing*) comprende operaciones que preparan la imagen antes del reconocimiento, como cambiar su tamaño, reducir ruido o corregir su inclinación. Su utilidad depende de las características de la entrada y debe evaluarse, ya que no garantiza una mejora en todos los casos.

Finalmente, reconocer caracteres no equivale a interpretar o validar su significado. Obtener "L32 MANGA" como texto digital es distinto de identificar "L32" como una línea de ómnibus y "MANGA" como su destino. El posprocesamiento (*postprocessing*) permite aplicar reglas, diccionarios o información contextual para revisar la lectura y reducir confusiones entre caracteres, como "O" y "0". Estas operaciones complementan el reconocimiento visual, pero no garantizan que toda lectura sea correcta.

Las herramientas existentes se presentan en el apartado 3.4 del estado del arte. Su comparación experimental y la selección utilizada en el sistema se desarrollan en el apartado 7.4.7.

## 3.4 Inteligencia artificial en el borde

La computación en el borde (Edge Computing) se refiere al procesamiento de datos cerca de la fuente de generación, en lugar de enviarlos a servidores remotos en la nube. En el contexto de la IA, esto implica ejecutar modelos de inferencia directamente en dispositivos de recursos limitados, como microcontroladores o computadoras de placa única. Esta aproximación ofrece ventajas críticas para aplicaciones de asistencia: latencia reducida (respuesta en tiempo real sin depender de conectividad), privacidad de los datos (el procesamiento ocurre localmente) y funcionamiento offline.

Los modelos Gemma de Google se evaluaron en el *spike* de visión local del 2026-08-12/13, sobre un iPhone 15 Pro (docs/spike-vision-local.md). Gemma 3 1B generó texto localmente en 910 ms, a 13,4 tokens por segundo, con LiteRT-LM; la visión con ese runtime falló en iOS por un defecto de la librería. El modelo multimodal más chico, Gemma 4 E2B (3 GB), sí leyó el cartel por ExecuTorch, pero con un total de ~6,4 s y sin coordenadas para priorizar entre varios ómnibus. El ADR 0006 (2026-08-22, enmendado el 2026-09-07) cerró la pregunta por caso de uso: en ómnibus no hay LLM, y la detección la hace un YOLO11n cuantizado a int8 dentro del sensor IMX500 de la cámara, seguido de recorte y OCR en la placa (sec. 7.4); en supermercado el modelo de visión corre en la nube (sec. 7.5). Gemma no se evaluó sobre la Raspberry Pi Zero 2 W. Para el respaldo local del modo supermercado no se llegó a incorporar ningún modelo: un modelo multimodal pequeño, por ejemplo de la familia Gemma, es la alternativa identificada, pero su evaluación sobre productos reales quedó como trabajo futuro (sec. 7.5.5).

*\[PENDIENTE: apartado asignado a Magalí Dellapiazza.\]*

*Esta sección amplía el apartado existente «Modelos de Inteligencia Artificial en el borde (Edge AI)», cuyo contenido introductorio se conserva.*

## 3.5 Comunicación inalámbrica de corto alcance

El paradigma de Internet de las Cosas (IoT) interconecta dispositivos físicos equipados con sensores, capacidad de procesamiento perimetral y conectividad, permitiéndoles interactuar con su entorno y coordinarse con sistemas distribuidos. En el contexto de redes de sensores y plataformas embebidas, la transmisión eficiente de la información capturada requiere de protocolos de comunicación especializados que operen sobre los modelos de red estándar (como TCP/IP). La selección e implementación de estos protocolos depende de un compromiso de diseño crítico entre el volumen de la carga útil (*payload*), el ancho de banda disponible, la tolerancia a la latencia y las severas restricciones energéticas del hardware.

A nivel abstracto, estas comunicaciones se estructuran en diferentes patrones de intercambio de mensajes: modelos de petición-respuesta (*request-response*) para transacciones sincrónicas, esquemas de publicación-suscripción (*publish-subscribe*) orientados a eventos para enrutar telemetría de forma asíncrona, y canales bidireccionales continuos (*full-duplex*) para arquitecturas que demandan flujos de datos ininterrumpidos. La correcta orquestación de estos enfoques abstractos define la viabilidad operativa del sistema, determinando directamente su autonomía, estabilidad y tiempos de respuesta.

## 3.6 Desarrollo móvil multiplataforma

### 3.6.1 Frameworks de desarrollo móvil multiplataforma

El desarrollo de aplicaciones móviles puede abordarse mediante tres estrategias principales: desarrollo nativo (código específico para cada plataforma, en Swift/Objective-C para iOS y Kotlin/Java para Android), frameworks multiplataforma basados en motor de renderizado propio (como Flutter, que usa el lenguaje Dart y el motor gráfico Impeller para dibujar cada píxel de la interfaz) y frameworks multiplataforma que traducen la interfaz a componentes nativos reales (como React Native, basado en JavaScript/TypeScript y React).

React Native permite escribir la lógica de la aplicación una sola vez y ejecutarla tanto en iOS como en Android, delegando el renderizado final de cada componente visual (botones, textos, listas) a los elementos nativos equivalentes de cada sistema operativo. Esto lo diferencia de motores como el de Flutter, que dibuja su propia interfaz sobre un lienzo (canvas) sin usar los widgets nativos del sistema.

### 3.6.2 Arquitectura: de Bridge a Bridgeless (JSI)

Históricamente, React Native se apoyaba en un "puente" (bridge) asíncrono que serializaba mensajes en formato JSON entre el hilo de JavaScript y el hilo nativo, lo cual introducía latencia perceptible en interacciones complejas (animaciones, gestos). Desde 2024, la Nueva Arquitectura de React Native reemplaza este puente por el JSI (JavaScript Interface), una capa de interoperabilidad que permite que el código JavaScript invoque directamente métodos nativos en memoria compartida, sin serialización intermedia ("arquitectura Bridgeless").

Esto reduce significativamente la latencia de comunicación entre la capa de interfaz y la capa nativa, un aspecto relevante para ViroVision dado que la aplicación deberá reaccionar en tiempo casi real a los resultados del sistema de reconocimiento y a la retroalimentación auditiva.

### 3.6.3 API de accesibilidad de React Native

React Native expone una API de accesibilidad que permite anotar los componentes de la interfaz para que sean interpretados correctamente por los lectores de pantalla nativos:

1. **accessible**: marca un elemento (y sus hijos) como un único elemento accesible para el lector de pantalla.
1. **accessibilityLabel**: define el texto que el lector de pantalla anuncia al enfocar el elemento (independiente del texto visual mostrado en pantalla).
1. **accessibilityRole**: comunica la función del elemento (botón, imagen, encabezado, etc.), la cual se traduce internamente a los UIAccessibilityTraits de iOS y a los roles equivalentes de la API de accesibilidad de Android.
1. **accessibilityHint**: agrega una pista adicional sobre qué ocurrirá al interactuar con el elemento, útil para acciones no evidentes por el rol o la etiqueta.

Estas propiedades permiten que, en los casos donde se usan componentes estándar de React Native, VoiceOver (iOS) y TalkBack (Android) puedan leer e interactuar con la interfaz sin necesidad de código nativo adicional. Sin embargo, como se detalla en la sección de Estado del Arte, esta cobertura no es completa para todos los casos de uso.

## 3.7 Síntesis de voz y gestión de audio como interfaz

La síntesis de voz (*text-to-speech*, TTS) convierte un texto en una señal de audio que reproduce el habla. Los sistemas actuales realizan el proceso en dos etapas: primero analizan el texto (normalizan números y abreviaturas y determinan la pronunciación de cada palabra) y luego generan la señal de audio. Los sistemas más recientes se basan en redes neuronales, que producen una voz más natural que los métodos anteriores por concatenación de fragmentos grabados.

Los sistemas operativos móviles incluyen un motor de síntesis que funciona sin conexión y es el mismo que utilizan los lectores de pantalla. También existen servicios de síntesis en la nube, que suelen ofrecer voces más naturales y permiten indicar el acento o la pronunciación, a cambio de requerir conexión y de agregar latencia. Una tercera alternativa, cuando el repertorio de frases es cerrado y conocido de antemano, es generar los audios con anticipación y reproducirlos como archivos, lo que no requiere conexión ni procesamiento en el momento.

Para una persona ciega o con baja visión, el audio es el canal principal de información. Esto plantea requisitos que no aparecen en una aplicación convencional. El primero es la convivencia con el lector de pantalla (VoiceOver en iOS, TalkBack en Android), que también habla: la aplicación debe decidir si su voz interrumpe, atenúa o se mezcla con la del lector, y una mala elección corta los mensajes que el usuario necesita para navegar. Los sistemas operativos gestionan esta convivencia mediante sesiones de audio, que definen cómo se combina el sonido de una aplicación con el del resto del sistema. El segundo es la latencia: entre el pedido del usuario y la respuesta no hay otra forma de saber que el sistema está trabajando, por lo que una espera larga se percibe como una falla. El tercero es la brevedad y el orden de los mensajes: el usuario escucha la frase completa antes de poder actuar, de modo que conviene decir primero el dato que más información aporta.

La aplicación de estos criterios en el sistema (la elección entre la voz del sistema, la síntesis en la nube y los audios pregrabados, y la configuración de la sesión de audio) se describe en las secciones 7.4.12, 7.5.3 y 7.6.3.

## 3.8 Criterios de accesibilidad: WCAG

Las Pautas de Accesibilidad para el Contenido Web (*Web Content Accessibility Guidelines*, WCAG) del W3C, en su versión 2.2, constituyen el marco de referencia normativo para accesibilidad digital y se aplican, con las adaptaciones correspondientes, a interfaces móviles. Se organizan en cuatro principios (perceptible, operable, comprensible y robusto) y en tres niveles de conformidad: A, AA y AAA.

Los criterios que este trabajo utiliza como requisitos verificables son:

| **Criterio** | **Exigencia** | **Aplicación en ViroVision** |
|---|---|---|
| **1.4.3 Contraste (mínimo)**, nivel AA | 4,5:1 para texto normal; 3:1 para texto grande | Piso para todo texto |
| **1.4.6 Contraste (mejorado)**, nivel AAA | 7:1 para texto normal | Adoptado como criterio, por tratarse de una aplicación para baja visión |
| **1.4.11 Contraste no textual**, nivel AA | 3:1 para bordes de controles e indicadores de estado | Determina el diseño de los botones |
| **1.4.1 Uso del color**, nivel A | El color no puede ser el único medio para transmitir información | Origen de la regla «el estado nunca se comunica sólo por color» |
| **1.4.4 Redimensionado del texto**, nivel AA | El texto debe poder ampliarse sin pérdida de contenido | Soporte de tamaños de texto dinámicos del sistema |
| **2.5.5 Tamaño del objetivo**, nivel AAA | Área táctil suficiente | Dimensionado de los controles |

La **r**elación de contraste se define entre las luminancias relativas de dos colores como (L₁ + 0,05) / (L₂ + 0,05), donde L₁ es la luminancia del más claro. Al ser una fórmula cerrada, el cumplimiento de estos criterios puede verificarse automáticamente, y este trabajo lo incorpora como prueba automatizada que bloquea la integración ante un cambio que rompa el criterio (sec. 7.8.1).

Una observación necesaria: el cumplimiento de WCAG es una condición necesaria y no suficiente. Una interfaz puede satisfacer todos los criterios verificables y resultar inutilizable para una persona ciega si el orden de lectura, la cantidad de gestos necesarios o la ausencia de retroalimentación audible no se consideraron. De ahí que este proyecto trate las pruebas con lectores de pantalla reales y con usuarios ciegos como hitos obligatorios y no como validación opcional.
