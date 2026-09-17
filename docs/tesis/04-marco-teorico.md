# 4. Marco teórico


## 4.1 Inteligencia artificial

La inteligencia artificial (IA) es un campo de la informática que busca desarrollar sistemas capaces de realizar tareas que normalmente requieren inteligencia humana, como el reconocimiento de patrones, la comprensión del lenguaje, la toma de decisiones y el aprendizaje a partir de la experiencia. Desde sus orígenes en la década de 1950, la IA ha evolucionado significativamente, impulsada por el aumento de la capacidad de cómputo y la disponibilidad de grandes volúmenes de datos.

### 4.1.1 Machine Learning

El aprendizaje automático (Machine Learning o ML) es una subdisciplina de la IA que permite a los sistemas aprender y mejorar a partir de la experiencia sin ser programados explícitamente para cada tarea. Los algoritmos de ML identifican patrones en grandes conjuntos de datos y construyen modelos estadísticos que permiten realizar predicciones o tomar decisiones. Se distinguen principalmente tres paradigmas: aprendizaje supervisado (el modelo aprende de ejemplos etiquetados), aprendizaje no supervisado (el modelo descubre patrones sin etiquetas) y aprendizaje por refuerzo (el modelo aprende a través de la interacción con el entorno y retroalimentación de recompensas).

### 4.1.2 Deep Learning y redes neuronales

El aprendizaje profundo (Deep Learning o DL) es una subcategoría del ML basada en redes neuronales artificiales con múltiples capas de procesamiento. Estas redes, inspiradas en el funcionamiento del cerebro humano, son capaces de aprender representaciones jerárquicas de los datos, desde características simples en las capas iniciales hasta representaciones más abstractas en las capas profundas. El DL ha demostrado resultados sobresalientes en tareas de reconocimiento de imágenes, procesamiento de lenguaje natural y síntesis de audio, constituyendo la base tecnológica de las soluciones modernas de visión por computadora.

*[PENDIENTE: apartado asignado a Magalí Dellapiazza.]*
## 4.2 Evaluación de modelos de reconocimiento

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

## 4.3 Visión por computadora

La visión por computadora (Computer Vision o CV) es un campo de la IA que desarrolla técnicas para que las máquinas puedan interpretar y comprender el contenido visual del mundo, incluyendo imágenes y videos. Los avances en redes neuronales convolucionales (Convolutional Neural Networks o CNNs) han transformado radicalmente las capacidades de la CV, permitiendo alcanzar niveles de precisión comparables o superiores a los humanos en tareas de clasificación y detección de objetos.

  

### 4.3.1 Detección de objetos

La detección de objetos es una tarea de CV que consiste en identificar y localizar uno o más objetos dentro de una imagen, indicando su clase y posición mediante coordenadas (bounding boxes). A diferencia de la clasificación de imágenes, que asigna una única etiqueta a toda la imagen, la detección de objetos puede identificar múltiples instancias de diferentes clases en una misma imagen. Algoritmos como YOLO (You Only Look Once) han sido especialmente relevantes en aplicaciones de tiempo real por su velocidad y precisión, siendo candidatos naturales para implementaciones en dispositivos embebidos.

Modelos YOLO (You Only Look Once)

YOLO, acrónimo de *You Only Look Once*, es una familia de modelos de inteligencia artificial orientada principalmente a tareas de visión por computadora, en particular a la detección de objetos en imágenes y video. A diferencia de otros enfoques más tradicionales, YOLO realiza la detección en una sola pasada sobre la imagen, identificando tanto la clase del objeto como su ubicación mediante una caja delimitadora o *bounding box*. Esta característica lo convierte en un enfoque especialmente relevante para aplicaciones que requieren procesamiento en tiempo real o baja latencia.

Las versiones modernas de YOLO, como YOLO11, se utilizan como modelos base para distintas tareas de visión por computadora, incluyendo detección de objetos, segmentación, clasificación, estimación de pose y detección de objetos orientados. En el caso de detección, los modelos preentrenados suelen estar entrenados sobre el dataset COCO, que contiene 80 categorías de objetos comunes. Esto permite que el modelo ya tenga una capacidad inicial para reconocer elementos frecuentes del entorno, como personas, autos, ómnibus, bicicletas, animales y otros objetos cotidianos.

Una ventaja importante de YOLO es que ofrece variantes de distinto tamaño, desde modelos más livianos hasta modelos más grandes y precisos. Esto permite adaptar la elección del modelo según las restricciones del sistema: en dispositivos con menor capacidad de cómputo se pueden utilizar versiones más pequeñas, mientras que en entornos con más recursos se pueden emplear variantes de mayor precisión. Esta flexibilidad resulta especialmente relevante en aplicaciones móviles o de asistencia, donde la latencia, el consumo de memoria y la compatibilidad con distintos dispositivos son factores críticos.

  

## 4.4 Detección de objetos en una etapa: la familia YOLO

> *Esta sección amplía el apartado existente «Detección de objetos (Object Detection)».*

## 4.5 Reconocimiento óptico de caracteres

El Reconocimiento Óptico de Caracteres (Optical Character Recognition u OCR) es una tecnología que convierte imágenes de texto impreso o escrito a mano en texto digital editable y procesable. Los sistemas modernos de OCR basados en deep learning han superado significativamente a los métodos tradicionales, logrando altas tasas de reconocimiento incluso en condiciones de iluminación variable, ángulos de captura no ideales y tipografías diversas. En el contexto de ViroVision, el OCR es una tecnología central para la identificación de los números y nombres de líneas de ómnibus a partir de las imágenes capturadas por la cámara del dispositivo, así como para la lectura de etiquetas y textos en productos de supermercado.

*[PENDIENTE: apartado asignado a Magalí Dellapiazza.]*
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

## 4.6 Inteligencia artificial en el borde

La computación en el borde (Edge Computing) se refiere al procesamiento de datos cerca de la fuente de generación, en lugar de enviarlos a servidores remotos en la nube. En el contexto de la IA, esto implica ejecutar modelos de inferencia directamente en dispositivos de recursos limitados, como microcontroladores o computadoras de placa única. Esta aproximación ofrece ventajas críticas para aplicaciones de asistencia: latencia reducida (respuesta en tiempo real sin depender de conectividad), privacidad de los datos (el procesamiento ocurre localmente) y funcionamiento offline.

*⚠️ PENDIENTE: Completar con análisis de Google Gemma (modelo de IA de Google). Investigar: arquitectura del modelo, variantes disponibles para edge computing (Gemma 2B, etc.), rendimiento en tareas de visión, viabilidad de ejecución en el hardware seleccionado, y comparación con otras alternativas (MobileNet, EfficientDet, YOLO nano, etc.).*

*[PENDIENTE: apartado asignado a Magalí Dellapiazza.]*
> *Esta sección amplía el apartado existente «Modelos de Inteligencia Artificial en el borde (Edge
> AI)», cuyo contenido introductorio se conserva.*

## 4.7 Comunicación inalámbrica de corto alcance


## 4.8 Desarrollo móvil multiplataforma


### 4.8.1 Frameworks de desarrollo móvil multiplataforma

  

El desarrollo de aplicaciones móviles puede abordarse mediante tres estrategias principales: desarrollo nativo (código específico para cada plataforma, en Swift/Objective-C para iOS y Kotlin/Java para Android), frameworks multiplataforma basados en motor de renderizado propio (como Flutter, que usa el lenguaje Dart y el motor gráfico Impeller para dibujar cada píxel de la interfaz) y frameworks multiplataforma que traducen la interfaz a componentes nativos reales (como React Native, basado en JavaScript/TypeScript y React).

  

React Native permite escribir la lógica de la aplicación una sola vez y ejecutarla tanto en iOS como en Android, delegando el renderizado final de cada componente visual (botones, textos, listas) a los elementos nativos equivalentes de cada sistema operativo. Esto lo diferencia de motores como el de Flutter, que dibuja su propia interfaz sobre un lienzo (canvas) sin usar los widgets nativos del sistema.

  

### 4.8.2 Arquitectura: de Bridge a Bridgeless (JSI)

  

Históricamente, React Native se apoyaba en un "puente" (bridge) asíncrono que serializaba mensajes en formato JSON entre el hilo de JavaScript y el hilo nativo, lo cual introducía latencia perceptible en interacciones complejas (animaciones, gestos). Desde 2024, la Nueva Arquitectura de React Native reemplaza este puente por el JSI (JavaScript Interface), una capa de interoperabilidad que permite que el código JavaScript invoque directamente métodos nativos en memoria compartida, sin serialización intermedia ("arquitectura Bridgeless"). 

Esto reduce significativamente la latencia de comunicación entre la capa de interfaz y la capa nativa, un aspecto relevante para ViroVision dado que la aplicación deberá reaccionar en tiempo casi real a los resultados del sistema de reconocimiento y a la retroalimentación auditiva.

  

### 4.8.3 Justificación de la elección de React Native

  

La elección de React Native frente a Flutter o al desarrollo nativo se fundamenta en cuatro criterios:

  

1.  Accesibilidad heredada de componentes nativos: al renderizar componentes nativos reales en lugar de dibujar sobre un lienzo propio, React Native hereda (en la mayoría de los casos) el comportamiento de accesibilidad ya implementado por el sistema operativo (VoiceOver en iOS, TalkBack en Android) para esos componentes, lo cual reduce el trabajo adicional necesario comparado con frameworks basados en motores de renderizado propios, donde toda la semántica de accesibilidad debe reconstruirse manualmente elemento por elemento.
2.  Curva de aprendizaje y velocidad de desarrollo del equipo: el equipo cuenta con experiencia previa en JavaScript/React, lo que reduce el tiempo de aprendizaje comparado con adoptar Dart (Flutter) o dos bases de código nativas separadas (Swift + Kotlin), un factor crítico dado el cronograma acotado de un proyecto de fin de carrera.
3.  Madurez del ecosistema y soporte de comunicación con hardware embebido: existen librerías consolidadas y ampliamente utilizadas en producción para comunicación Bluetooth Low Energy (BLE), como react-native-ble-plx y react-native-ble-manager, que implementan el protocolo GATT (Generic Attribute Profile) necesario para la comunicación entre la aplicación y el dispositivo físico de ViroVision.
4.  Validación en producción a gran escala: React Native es utilizado en aplicaciones de uso masivo (Meta/Instagram, Microsoft, Shopify), lo que evidencia su viabilidad para aplicaciones robustas, con una comunidad activa y documentación extensa que mitiga el riesgo técnico de adoptarlo en un proyecto con recursos limitados de tiempo y equipo.

  

Se descartó el desarrollo nativo puro por requerir mantener dos bases de código independientes (duplicando el esfuerzo de implementación y testing con un equipo de tres personas), y se descartó Flutter principalmente por la curva de aprendizaje de Dart y porque, al no utilizar componentes nativos reales, requiere una reconstrucción más manual de las etiquetas y comportamientos de accesibilidad que sí vienen resueltos parcialmente en React Native.

  

### 4.8.4 API de accesibilidad de React Native

  

React Native expone una API de accesibilidad que permite anotar los componentes de la interfaz para que sean interpretados correctamente por los lectores de pantalla nativos:

  

1.  **accessible**: marca un elemento (y sus hijos) como un único elemento accesible para el lector de pantalla.

  

1.  **accessibilityLabel**: define el texto que el lector de pantalla anuncia al enfocar el elemento (independiente del texto visual mostrado en pantalla).

  

1.  **accessibilityRole**: comunica la función del elemento (botón, imagen, encabezado, etc.), la cual se traduce internamente a los UIAccessibilityTraits de iOS y a los roles equivalentes de la API de accesibilidad de Android.

  

1.  **accessibilityHint**: agrega una pista adicional sobre qué ocurrirá al interactuar con el elemento, útil para acciones no evidentes por el rol o la etiqueta.

  

Estas propiedades permiten que, en los casos donde se usan componentes estándar de React Native, VoiceOver (iOS) y TalkBack (Android) puedan leer e interactuar con la interfaz sin necesidad de código nativo adicional. Sin embargo, como se detalla en la sección de Estado del Arte, esta cobertura no es completa para todos los casos de uso.

  

## 4.9 Síntesis de voz y gestión de audio como interfaz


## 4.10 Criterios de accesibilidad: WCAG

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
