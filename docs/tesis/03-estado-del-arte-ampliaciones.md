# 3. Estado del arte: apartados a completar

> Este archivo contiene la redacción de los cuatro apartados que figuran como pendientes en el
> documento vigente. Los apartados ya redactados (hardware para sistemas embebidos, dispositivos de
> asistencia para personas con discapacidad visual y accesibilidad en frameworks multiplataforma) se
> conservan sin cambios.
>
> **Nota de trabajo:** las referencias bibliográficas citadas en este capítulo deben verificarse
> contra la fuente original antes de la entrega final, y completarse con el listado del capítulo 11.

## 3.x Técnicas de OCR para reconocimiento de líneas de ómnibus

El reconocimiento del cartel frontal de un ómnibus pertenece a la categoría del **texto en escenas
naturales** (*scene text recognition*), sustancialmente más difícil que el OCR de documentos. En un
documento escaneado el texto es oscuro sobre fondo claro, está alineado con los ejes de la imagen y
la iluminación es uniforme. En una escena urbana no se cumple ninguna de esas condiciones.

### Particularidades del dominio

Cuatro características distinguen este problema y condicionan las técnicas aplicables:

**a) Displays de matriz de LEDs.** Los carteles frontales de la flota metropolitana son, en su
mayoría, matrices de diodos emisores ámbar o rojos sobre fondo negro. Esto produce tres efectos
adversos simultáneos: los caracteres están formados por puntos discretos y no por trazos continuos,
de modo que un reconocedor entrenado sobre tipografías impresas debe generalizar a una
representación discretizada; la emisión propia genera saturación y halo alrededor de los trazos, que
tiende a fundir caracteres contiguos; y la frecuencia de refresco del display puede interactuar con
el tiempo de exposición de la cámara produciendo franjas oscuras o caracteres parcialmente apagados
en la captura.

**b) Movimiento y distancia.** El vehículo está en movimiento y la captura se realiza a decenas de
metros. El cartel ocupa, por lo tanto, una fracción muy pequeña del cuadro y puede presentar
desenfoque de movimiento.

**c) Variabilidad de iluminación.** El mismo cartel debe leerse a plena luz solar, en contraluz y de
noche, condiciones en las que la relación de contraste entre el LED y el fondo varía en órdenes de
magnitud.

**d) Competencia de texto irrelevante.** El cuadro contiene matrícula, carteles laterales,
publicidad y señalización de la vía. Un OCR aplicado sobre el cuadro completo produce múltiples
transcripciones de las cuales sólo una es la buscada.

### Aproximaciones documentadas

La literatura sobre texto en escenas naturales ofrece dos grandes líneas, ambas aplicables:

**Detección seguida de reconocimiento.** Es el paradigma dominante desde la adopción del aprendizaje
profundo. Un detector de texto localiza las regiones (CRAFT, Baek et al. 2019; DBNet, Liao et al.
2020) y un reconocedor las transcribe (CRNN con pérdida CTC, Shi et al. 2017). La ventaja para este
dominio es la modularidad: el detector puede reemplazarse o ajustarse sin reentrenar el reconocedor.

**Detección de objeto seguida de recorte y reconocimiento.** En dominios donde el texto aparece
siempre dentro de un contenedor visual reconocible, es más eficaz **detectar primero el contenedor**
mediante un detector de objetos, recortar, y aplicar el OCR sólo sobre el recorte. Este es el
esquema consolidado en el problema análogo y mucho más estudiado del **reconocimiento automático de
matrículas** (*Automatic License Plate Recognition*, ALPR), donde la secuencia detectar vehículo,
detectar matrícula, rectificar y leer es el patrón de referencia. La literatura de ALPR es la fuente
metodológica más cercana al problema de este trabajo, tanto por la estructura del pipeline como por
las condiciones de captura, y de ella proviene la práctica de utilizar la geometría del contenedor
para descartar candidatos.

El presente trabajo adopta esta segunda aproximación, con dos adaptaciones propias del dominio: el
uso de la relación de aspecto del cartel como filtro para descartar los carteles laterales y de sólo
número, y la reparación de la transcripción contra un catálogo cerrado de líneas y destinos.

### La restricción del vocabulario cerrado

Una propiedad que distingue favorablemente este problema del OCR general es que **el conjunto de
respuestas válidas es finito y conocido**: una red de transporte metropolitana tiene un número
acotado de líneas y de destinos, publicados como datos abiertos. Esto permite aplicar corrección por
similitud de cadenas sobre la salida del reconocedor, técnica que reduce sustancialmente el efecto
de errores de un solo carácter. Es el mismo principio que en ALPR se aplica con las restricciones de
formato de las matrículas.

### Alternativa descartada: clasificación directa

Una aproximación alternativa consistiría en tratar cada línea como una **clase** y entrenar un
clasificador de imágenes sobre el cartel completo. Se descarta por tres razones: exigiría un conjunto
de entrenamiento con ejemplos suficientes de cada una de las 145 líneas, incluidas las de baja
frecuencia; no generalizaría a cambios de recorrido o a líneas nuevas sin reentrenamiento; y perdería
el destino, que es información relevante para el usuario cuando una misma línea tiene ramales
distintos. El OCR, en cambio, es independiente del repertorio de líneas.

### Brecha identificada

No se encontró trabajo publicado específico sobre reconocimiento de líneas de ómnibus del sistema de
transporte metropolitano de Montevideo, ni conjuntos de datos públicos de carteles frontales de esa
flota. La construcción de un conjunto de datos propio, etiquetado manualmente, es en consecuencia
parte del aporte de este trabajo (§7.4.2).

## 3.x Reconocimiento de productos en supermercados

El reconocimiento de productos en góndola es un problema con literatura consolidada, impulsado
principalmente por aplicaciones de gestión de inventario y de cumplimiento de planogramas en el
sector minorista, y de manera secundaria por aplicaciones de asistencia.

### Por qué es un problema difícil

La dificultad del dominio es de naturaleza distinta a la del reconocimiento de objetos genéricos:

**Granularidad fina.** Dos productos de la misma marca que difieren en variedad o en tamaño son
visualmente casi idénticos, pero constituyen respuestas distintas. El problema es de clasificación de
grano fino y no de categorización.

**Cardinalidad alta y cambiante.** Un supermercado maneja decenas de miles de referencias, y los
envases cambian de diseño con frecuencia. Un clasificador entrenado sobre un catálogo cerrado
requiere reentrenamiento permanente.

**Escenas densas.** Los productos en góndola aparecen agrupados, con oclusión parcial y en múltiples
orientaciones. Este es precisamente el problema que motivó el conjunto de datos **SKU-110K** (Goldman
et al., 2019), construido para detección en escenas densamente pobladas.

**Escasez de datos etiquetados en condiciones reales.** Los conjuntos disponibles suelen contener
imágenes de estudio, mientras que las capturas reales tienen iluminación de tienda, reflejos sobre
envases plastificados y ángulos arbitrarios. Conjuntos como **Freiburg Groceries** (Jund et al.,
2016) y **Grocery Store Dataset** (Klasson et al., 2019) documentan esta brecha, y el segundo se
orienta explícitamente a aplicaciones de asistencia.

### Aproximaciones

**Código de barras.** Es la vía más precisa y la que la industria utiliza, pero **no es utilizable
por una persona ciega sin asistencia**: requiere localizar un código pequeño en una posición
arbitraria del envase, que es exactamente la tarea que la persona no puede realizar. Las aplicaciones
comerciales de lectura de códigos para usuarios ciegos recurren a guiado por audio, con un costo
considerable de tiempo por producto.

**Recuperación por similitud visual.** Se extrae un vector de características de la imagen y se busca
el vecino más cercano en una base de productos. Escala bien ante la incorporación de productos
nuevos, pero exige mantener una base de referencia actualizada.

**Detección y clasificación supervisada.** Un detector localiza los productos y un clasificador los
identifica. Es la aproximación de los conjuntos citados, y su limitación es el catálogo cerrado.

**Modelos multimodales de lenguaje y visión.** Es la aproximación más reciente y la que este trabajo
adopta para el modo supermercado. Un modelo entrenado sobre corpus masivos de imagen y texto
responde en lenguaje natural sobre el contenido de una fotografía, **sin catálogo previo y sin
entrenamiento específico del dominio**. Sus ventajas para este caso de uso son que no requiere
mantener una base de productos, que generaliza a envases no vistos y a productos sueltos o a granel
que ningún catálogo de códigos cubre, y que puede devolver información estructurada (tipo, marca,
presentación) en lugar de un identificador. Sus desventajas son la dependencia de conectividad, la
latencia y el costo por consulta, y la imposibilidad de auditar el origen de una respuesta.

### Aplicaciones de asistencia existentes

Las herramientas comerciales de asistencia visual descritas en el apartado de dispositivos de
asistencia incorporan reconocimiento de productos con distintos alcances: identificación por código
de barras con guiado por audio, descripción general de escena, y lectura de texto de etiqueta. Las
limitaciones relevantes para el contexto de este trabajo son el costo del hardware dedicado, la
dependencia de servicios de nube sin modo de respaldo local y la ausencia de adaptación al catálogo
de productos disponible en el mercado uruguayo.

### Brecha identificada

No existe un conjunto de evaluación público de productos de la canasta básica uruguaya en condiciones
de góndola real. La construcción de ese conjunto, con fotografías tomadas por el propio dispositivo,
es una tarea pendiente de este trabajo y un aporte potencial para trabajos posteriores.

## 3.x Modelos de detección de objetos en tiempo real para cómputo en el borde

La ejecución de detectores de objetos sobre hardware embebido es un área con producción abundante,
organizada alrededor del compromiso entre precisión, latencia, memoria y consumo.

### Familias de arquitecturas eficientes

**MobileNet** (Howard et al., 2017; Sandler et al., 2018) introdujo la convolución separable en
profundidad como mecanismo para reducir drásticamente el número de operaciones respecto de una
convolución estándar, y parametrizó la red con multiplicadores de ancho y de resolución que permiten
recorrer explícitamente la curva de compromiso. Se emplea habitualmente como red troncal de
detectores livianos, típicamente en combinación con SSD.

**EfficientNet** y **EfficientDet** (Tan y Le, 2019; Tan et al., 2020) formalizaron el escalado
compuesto: en lugar de aumentar sólo la profundidad, el ancho o la resolución, se escalan de manera
conjunta según una relación fija. EfficientDet agrega una red de fusión de características
bidireccional y ponderada, y se publica como una familia escalonada que cubre desde configuraciones
de muy bajo costo hasta configuraciones de alta precisión.

**La familia YOLO** ocupa el lugar dominante en aplicaciones de tiempo real. Sus versiones recientes
ofrecen variantes de tamaño escalonado con una misma arquitectura, adoptan diseños sin anclas, e
incorporan herramientas de exportación a formatos de inferencia embebida como parte del propio
ecosistema, lo que reduce significativamente el costo de llevar un modelo entrenado a un dispositivo.

### Plataformas de ejecución y sus estudios comparativos

La literatura comparativa sobre plataformas de borde evalúa habitualmente cuatro familias: CPU de
computadora de placa única, aceleradores externos por USB, unidades de procesamiento neuronal
integradas y, más recientemente, **sensores de imagen con inferencia incorporada**. La conclusión
recurrente de estos estudios es que la comparación no puede hacerse sólo por latencia de inferencia:
el costo de transferir el cuadro desde el sensor hasta el acelerador, el consumo energético de esa
transferencia y la ocupación del bus resultan determinantes en dispositivos alimentados por batería.

La categoría de inferencia en el sensor es la que altera de manera más significativa ese balance,
porque elimina la transferencia: el resultado de la inferencia se entrega junto con el cuadro. Su
contrapartida es una restricción estricta de memoria en el chip y un conjunto acotado de
arquitecturas con conversión soportada, lo que traslada la decisión desde *qué modelo es más preciso*
hacia *qué modelo cabe y se puede convertir*. Este trabajo encuentra esa restricción de manera
directa y documenta su consecuencia sobre el diseño del detector (§7.4.4).

### Efecto de la cuantización

Existe consenso en la literatura en que la cuantización a enteros de 8 bits reduce el tamaño del
modelo a aproximadamente una cuarta parte con una pérdida de precisión habitualmente pequeña sobre
conjuntos de referencia generales. La advertencia metodológica, sin embargo, es que **esa pérdida no
es transferible entre dominios**: un modelo ajustado sobre objetos pequeños y de bajo contraste,
como el cartel de un ómnibus a distancia, puede degradarse considerablemente más que sobre un
conjunto de referencia. La medición del costo de cuantización sobre el conjunto de evaluación propio
es, por lo tanto, un paso necesario y no una verificación opcional.

## 3.x Protocolos de comunicación entre dispositivo y teléfono

La elección del protocolo de comunicación entre un dispositivo embebido portátil y un teléfono es una
decisión de arquitectura con literatura técnica establecida, gobernada por el compromiso entre
consumo energético, caudal y latencia de establecimiento.

### Alternativas consideradas

| Protocolo | Consumo | Caudal útil | Adecuación al caso |
|---|---|---|---|
| **BLE (GATT)** | Muy bajo | Decenas de KB/s en el mejor caso | Adecuado para control y eventos; insuficiente para imagen |
| **Bluetooth Classic (SPP)** | Medio | Cientos de KB/s | Soporte limitado en iOS sin programa de accesorios del fabricante |
| **Bluetooth Classic (A2DP)** | Medio | Suficiente para audio | Introduce latencia de codificación; compite por la antena |
| **WiFi en modo punto de acceso** | Alto mientras está activo | Del orden de MB/s | Adecuado para imagen y audio bajo demanda |
| **WiFi Direct** | Alto | Del orden de MB/s | Soporte desigual entre plataformas móviles |
| **Conexión cableada** | Nulo adicional | Alto | Incompatible con el formato de unos lentes |

### El límite de caudal de BLE

La bibliografía técnica sobre rendimiento de BLE coincide en que el caudal efectivo de una conexión
está determinado por tres parámetros: el **intervalo de conexión**, el **número de paquetes por
evento de conexión** y el **tamaño de carga útil por paquete**, este último dependiente de si el
controlador implementa *Data Length Extension* (introducida en la especificación Bluetooth 4.2) y de
la capa física en uso (la especificación 5.0 añadió un modo de 2 Mbps).

La consecuencia práctica, ampliamente documentada, es que **el caudal alcanzable en un enlace
concreto puede diferir en un orden de magnitud del máximo teórico del protocolo**, según las
capacidades del controlador de radio y según las políticas de gestión de energía del sistema
operativo móvil, que fija el intervalo de conexión sin ceder ese control a la aplicación. De ello se
desprende una recomendación metodológica que este trabajo adopta: **el caudal de un enlace BLE debe
medirse sobre el hardware y el sistema operativo de destino, y no estimarse a partir de la
especificación**.

### Arquitecturas híbridas

La combinación de un enlace permanente de bajo consumo para señalización y un enlace de alta
capacidad activado bajo demanda para las cargas útiles grandes es un patrón consolidado en
dispositivos que capturan imagen, y es el que emplean habitualmente las cámaras de acción y las
cámaras fotográficas con conectividad. El enlace de bajo consumo transporta además las credenciales
necesarias para establecer el de alta capacidad, lo que elimina la configuración manual por parte del
usuario. Este trabajo adopta ese patrón, con la particularidad de que la decisión se toma a partir de
una medición propia del enlace y no por analogía (§7.2.1).

### Consideración específica para el caso de uso

Un aspecto poco tratado en la bibliografía general y relevante para este dominio es que una
aplicación de asistencia **necesita alcanzar servicios de nube mientras está unida a la red local del
dispositivo**. La configuración habitual de un punto de acceso anuncia puerta de enlace y servidor de
nombres, lo que lleva al sistema operativo del teléfono a enrutar todo el tráfico por esa interfaz y
a perder la conectividad de datos móviles. La solución consiste en configurar el punto de acceso como
una red de alcance estrictamente local (§7.1.4).
