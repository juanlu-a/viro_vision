# 4. Estado del arte

En esta sección se realiza una revisión de trabajos académicos y soluciones tecnológicas existentes relacionados con los principales componentes del proyecto: dispositivos de asistencia para personas con discapacidad visual, elementos de hardware que se consideren relevantes, técnicas de visión por computadora aplicadas a la accesibilidad, sistemas de OCR para reconocimiento de texto en imágenes reales, y modelos de detección de objetos para implementación en dispositivos embebidos.

## 4.1 Hardware para sistemas embebidos de visión, audio y procesamiento

En esta sección haremos un análisis de las distintas opciones manejadas para construir el dispositivo, tanto desde el punto de vista del procesamiento como pensando en la interacción entre el usuario y el producto final. Consideraremos la posibilidad de utilizar el celular como dispositivo de asistencia, a modo de “tercerizar” el procesamiento de la imágen y limitar la responsabilidad del dispositivo a la toma de imágenes, la comunicación con el celular y la reproducción del audio. No se descarta realizar todo el procesamiento en el dispositivo final, a modo de evaluar la solución como un producto *standalone.*

### 4.1.1 Microprocesador y microcontrolador

**ESP32**

La ESP32 es un microcontrolador de bajo consumo desarrollado por Espressif. Está pensado para aplicaciones IoT y sistemas embebidos donde se requiere controlar sensores, comunicarse mediante Wi-Fi o Bluetooth y ejecutar tareas relativamente simples en tiempo real. Tiene muy bajo costo, consumo energético y tamaño, además de variantes comunes con Wi-Fi y Bluetooth. Sin embargo, sus recursos de procesamiento son limitados para aplicaciones de visión artificial, además de tener poca memoria RAM, lo que restringe el tamaño y la calidad de las imágenes que se pueden procesar. Esto, y que las opciones de cámaras que soporta también son limitadas (solo cámaras sencillas) hacen que sea difícil de elegir como el microcontrolador. \[45\]

**Jetson Nano**

La Jetson Nano es una computadora de placa única, orientada específicamente a aplicaciones de inteligencia artificial. Incorpora una GPU NVIDIA que permite acelerar redes neuronales mediante CUDA. Tiene una capacidad de procesamiento considerable y permite ejecutar modelos complejos (YOLO, OCR, modelos multimodales) además de ser compatible con múltiples cámaras de alta resolución.\[46\] Sin embargo, si bien es más pequeña que una PC tradicional, tiene un tamaño considerable para el proyecto que se busca desarrollar, además de un precio elevado y un alto consumo energético. Esto hace inviable su aplicación a este proyecto, que requiere un dispositivo lo más barato posible y portátil. La potencia adicional no justifica el incremento de costo, consumo y tamaño.

**Raspberry Pi Zero 2 W**

La Raspberry Pi Zero 2 W es una computadora de placa única que ejecuta Linux y combina un tamaño reducido con una capacidad de procesamiento suficiente para aplicaciones de visión artificial livianas. Su tamaño compacto, su bajo consumo energético y la variedad de cámaras compatibles por el conector CSI la hacen una candidata muy adecuada. Su desventaja es la potencia: tiene bastante menos capacidad de cómputo y memoria (512 MB) que una Raspberry Pi 5, lo que obliga a desligar de su CPU la parte más costosa del reconocimiento.\[47\]

En el diseño original se preveía que el reconocimiento fuera ejecutado en un acelerador Coral TPU: El Coral TPU es un circuito integrado de aplicación específica (ASIC) de tamaño pequeño, diseñado por Google para ejecutar tareas de inferencia de forma local, con modelos de machine learning en formato TensorFlow Lite \[43\]. Este elemento dejó de ser necesario cuando se incorporó una cámara que ejecuta el detector dentro del propio sensor (sec. 3.1.2), y el Acelerador Coral salió del diseño el 2026-09-07 (ADR 0006; sec. 7.2.5), reduciendo el tamaño del dispositivo final y minimizando la latencia que provocaba la conexión por USB.\[43\]

La Raspberry Pi Zero 2 W representa un equilibrio entre costo, tamaño y capacidad de procesamiento. Además, permite implementar y comparar las dos arquitecturas, haciendo el procesamiento en el dispositivo o enviando datos al celular por WiFi o BLE para procesarlos en él, y por eso fue la elegida para el proyecto.\[47\]

### 4.1.2 Cámara

**Cámara ESP32 (OV2640 / OV5640)**

Las cámaras utilizadas habitualmente con ESP32 están diseñadas para aplicaciones IoT donde el costo y el consumo son prioritarios, por eso son muy económicas tanto en precio como en consumo. Sin embargo, la calidad de imagen es limitada (incluso la propia ESP32 obliga frecuentemente a reducir resolución o aumentar la compresión JPEG debido a sus limitaciones de memoria), algo que el proyecto no puede permitirse pensando en el reconocimiento de ómnibus a una distancia considerable.

**Cámara USB genérica**

Las cámaras USB ofrecen una amplia variedad de resoluciones y calidades, conectándose mediante el puerto USB. Entre sus ventajas se incluyen la gran disponibilidad comercial, la variedad (precios, calidad, enfoque automático o no) y lo fácil que se pueden reemplazar en caso de cualquier problema. Sin embargo, muchas tienen mayor consumo que las cámaras diseñadas para microcontroladores, ya que son fabricadas con una computadora de escritorio en mente. Además, para conectarlas habría que ocupar el único puerto USB de datos de la Raspberry Pi Zero 2 W.

**Raspberry Pi Camera module 3**

La Camera Module 3 es la cámara oficial de Raspberry Pi basada en el sensor Sony IMX708 de 12 MP e incorpora enfoque automático. Esto proporcionaría una excelente calidad de imagen y compatibilidad con la Raspberry Zero 2 W, ya que tiene integración directa mediante el conector CSI, sin ocupar el puerto USB. Al ser parte del ecosistema de Raspberry, cuenta con buena documentación y soporte.\[48\] Si bien el precio de este módulo es más caro que las cámaras de la ESP32, no es prohibitivo, y no está demás decir que el cable flex requiere cierto cuidado mecánico en el diseño del dispositivo, pero no son obstáculos que no se puedan sortear al momento de diseñar la estructura que lo encapsule todo.

**Raspberry Pi AI Camera (Sony IMX500)**

La AI Camera es una cámara oficial de Raspberry Pi basada en el sensor Sony IMX500 de 12,3 MP, que integra un acelerador de redes neuronales en el propio sensor, con 8 MB de memoria para el modelo\[37\], \[38\]. El detector corre ahí, a la frecuencia de cuadro de la cámara, y la placa recibe directamente las cajas detectadas junto con la imagen, sin gastar CPU ni memoria propias. Se conecta por puerto CSI (*Camera Serial Interface* o Interfaz de cámara serial), como la Camera Module 3, y no ocupa el puerto USB. Sus límites son dos: el enfoque es manual (un anillo que se ajusta una vez) y en el sensor cabe una sola red, ya que un YOLO11n ocupa el 90% de esa memoria (sec. 7.2.5). Su integración con el conjunto de software de cámara de Raspberry Pi permite implementar modelos de redes neuronales propios con un esfuerzo mínimo. El precio es mayor que el de la Camera Module 3, pero esta última necesitaba sí o sí el Coral TPU para ejecutar la inferencia, mientras que la AI Camera funciona por sí misma, sin agregados.\[38\]

### 4.1.3 Conclusiones

Se seleccionó la plataforma Raspberry Pi Zero 2 W debido a que ofrece un equilibrio adecuado entre costo, tamaño, consumo energético y capacidad de procesamiento, y porque su conectividad WiFi y BLE posibilita comparar el procesamiento local con alternativas basadas en un teléfono móvil. La cámara elegida es la Raspberry Pi AI Camera (Sony IMX500): se conecta por la interfaz CSI dedicada y ejecuta el detector dentro del sensor, lo que cubre el papel que en el diseño original tenía el acelerador Coral TPU. Con eso el acelerador externo dejó de hacer falta y salió del diseño (ADR 0006, 2026-09-07; sec. 7.2.5), con un componente, un costo y un consumo menor. La compra de la AI Camera se decidió para evaluar la potencia del módulo y evitar sumar el Coral TPU al producto final, de modo de obtener un dispositivo más compacto y barato. La Camera Module 3 queda como alternativa evaluada y no se usa.

## 4.2 Dispositivos de asistencia para personas con discapacidad visual

**Microsoft Seeing AI** es una aplicación gratuita concebida para personas ciegas o con baja visión. Su documentación describe funciones de lectura, descripción de fotografías e identificación de productos. Representa un enfoque centrado en aprovechar la cámara y las capacidades del teléfono para comunicar información visual.\[53\]

**Google Lookout** utiliza la cámara y los sensores de dispositivos Android para reconocer texto y objetos. Incluye modos destinados a texto, documentos, exploración y etiquetas de alimentos. Sus funciones varían según idioma, región y modo; por ejemplo, el reconocimiento de etiquetas de alimentos contempla una descarga de datos para funcionamiento sin conexión en los países donde está disponible. Por ello, no corresponde describir toda la aplicación como dependiente permanentemente de Internet.\[54\]

**OrCam MyEye** representa un enfoque basado en un dispositivo de asistencia dedicado. Su manual describe lectura de texto y funciones de reconocimiento de caras y productos, con activación mediante gestos o controles. Estas capacidades deben atribuirse a la versión documentada, sin extrapolar precios o funciones entre todos los modelos comerciales.\[55\]

Los antecedentes muestran que la asistencia visual puede resolverse mediante un teléfono o mediante hardware dedicado. Sin embargo, sus funciones generales no demuestran por sí solas un desempeño adecuado para identificar líneas y destinos del transporte público uruguayo. Esa adecuación requiere pruebas específicas. La oportunidad de especialización de ViroVision se sitúa en los casos de uso locales y en la integración de reconocimiento y respuesta auditiva, no en afirmar que los antecedentes carecen de OCR o reconocimiento de productos \[53\], \[54\], \[55\].

## 4.3 Accesibilidad en frameworks de desarrollo multiplataforma

Uno de los desafíos documentados en la literatura sobre frameworks de desarrollo multiplataforma (Cross-Platform Development Frameworks, CPDF) es que, si bien reducen el esfuerzo de desarrollo al compartir código entre plataformas, no siempre logran exponer el 100% de las capacidades de accesibilidad nativa de cada sistema operativo.

El trabajo de Mascetti et al. (2020), "Developing Accessible Mobile Applications with Cross-Platform Development Frameworks" (presentado en ACM ASSETS 2020, disponible en arXiv:2005.06875), realiza un análisis sistemático de frameworks CPDF (entre ellos React Native y Xamarin) evaluando en qué medida sus APIs de accesibilidad cubren las funcionalidades completas expuestas nativamente por las APIs de accesibilidad de iOS (UIAccessibility) y Android (Accessibility API). Los autores concluyen que estos frameworks exponen únicamente un subconjunto de las capacidades de accesibilidad nativas, y que lograr una paridad completa de accesibilidad (equivalente a una app 100% nativa) requiere en muchos casos escribir módulos de código nativo específicos por plataforma (native modules) para cubrir los elementos de interfaz personalizados o comportamientos avanzados de lectores de pantalla, lo cual "niega parcialmente las ventajas" de usar un framework multiplataforma en primer lugar.

Este hallazgo es relevante para ViroVision porque condiciona directamente el diseño de la aplicación: no alcanza con adoptar React Native y asumir que la accesibilidad "viene incluida"; es necesario un proceso de verificación activa. En consecuencia, la estrategia de desarrollo del proyecto contempla:

1. Priorizar el uso de componentes estándar de React Native (View, Text, TouchableOpacity, Image, etc.) correctamente anotados con las propiedades de accesibilidad (accessibilityLabel, accessibilityRole, accessibilityHint), que sí heredan el comportamiento nativo esperado por VoiceOver y TalkBack.
1. Evitar o minimizar el uso de componentes de interfaz altamente personalizados (gráficos dibujados a medida, gestos no estándar) que son precisamente el punto débil identificado por Mascetti et al., y en los casos donde sean imprescindibles, evaluar la implementación de módulos nativos puntuales.
1. Incluir pruebas de accesibilidad específicas con los lectores de pantalla nativos de cada plataforma (VoiceOver en iOS, TalkBack en Android) como etapa formal del desarrollo, en lugar de asumir su funcionamiento correcto por default, tarea reflejada en el desglose de tareas del proyecto (hito "Pruebas de accesibilidad con lectores de pantalla nativos").
1. Complementar la validación técnica con pruebas de usabilidad reales junto a usuarios ciegos o con baja visión, dado que la accesibilidad técnica (API correctamente implementada) no garantiza por sí sola una buena experiencia de uso.

**React Native**

React Native permite desarrollar aplicaciones para iOS y Android compartiendo parte del código. Para la accesibilidad ofrece propiedades que describen las etiquetas, los roles y los estados de los controles. Estas propiedades permiten que VoiceOver y TalkBack comuniquen al usuario qué elemento está seleccionado y cómo puede interactuar con él. Sin embargo, el comportamiento puede variar entre plataformas, por lo que es necesario comprobar la navegación con ambos lectores de pantalla \[60\].

### 4.3.1 Integración con el sistema de reconocimiento y el dispositivo físico

A diferencia de una aplicación convencional que reproduce su audio por el altavoz general del teléfono, ViroVision cuenta con un auricular físico propio, integrado al dispositivo, por el cual se reproduce exclusivamente el audio generado por la aplicación (los resultados del reconocimiento vía texto a voz). El resto del audio del celular (llamadas, notificaciones de otras apps, reproducción de música, el propio lector de pantalla del sistema (VoiceOver/TalkBack) continúa saliendo por la ruta de audio habitual del dispositivo (altavoz, auriculares personales del usuario, etc.), sin verse forzado a pasar por el auricular de ViroVision.

Esta separación de canales de audio es, en sí misma, una decisión de accesibilidad relevante: evita que el usuario deba compartir un único canal auditivo entre el sistema operativo y la aplicación, reduciendo el riesgo de superposición o confusión entre la voz del lector de pantalla y la retroalimentación de ViroVision. En términos de implementación, esto requiere enrutar explícitamente el audio de salida de la aplicación hacia el dispositivo de audio correspondiente (en lugar de dejarlo en la salida de audio por defecto del sistema), utilizando las APIs de sesión/enrutamiento de audio de cada plataforma (AVAudioSession en iOS, AudioManager/AudioDeviceInfo en Android) o una librería de React Native que exponga selección de dispositivo de salida (por ejemplo, react-native-track-player o expo-av).

Cabe destacar además que, dado que Bluetooth Low Energy (BLE) (el protocolo usado para la comunicación de datos y control con el dispositivo físico) no está diseñado para transmitir audio en tiempo real por su bajo ancho de banda, la transmisión de audio hacia el auricular requiere un canal separado (por ejemplo, un perfil de Bluetooth Classic como A2DP/HFP). Esto implica que el dispositivo ViroVision maneja, en la práctica, dos canales de comunicación distintos con el celular: uno de datos (BLE) y uno de audio.

## 4.4 Técnicas de OCR para reconocimiento de líneas de ómnibus

El reconocimiento del cartel frontal de un ómnibus pertenece a la categoría del texto en escenas naturales (*scene text recognition*), sustancialmente más difícil que el OCR de documentos. En un documento escaneado el texto es oscuro sobre fondo claro, está alineado con los ejes de la imagen y la iluminación es uniforme. En una escena urbana no se cumple ninguna de esas condiciones.

## 4.5 Reconocimiento de productos en supermercados

El reconocimiento de productos en góndola es un problema con literatura consolidada, impulsado principalmente por aplicaciones de gestión de inventario y de cumplimiento de planogramas en el sector minorista, y de manera secundaria por aplicaciones de asistencia.

## 4.6 Modelos de detección de objetos en tiempo real para cómputo en el borde

La ejecución de detectores de objetos sobre hardware embebido es un área con producción abundante, organizada alrededor del compromiso entre precisión, latencia, memoria y consumo.

## 4.7 Protocolos de comunicación entre dispositivo y teléfono

La tecnología inalámbrica BLUETOOTH es una tecnología de transmisión sin cables de corto alcance que facilita la comunicación de datos entre dispositivos digitales, como un ordenador y una cámara digital. La tecnología BLUETOOTH tiene un radio de alcance de aproximadamente 10 m. Habitualmente sirve para conectar dos equipos entre sí, aunque algunos dispositivos pueden conectarse con varios equipos al mismo tiempo. La conexión no necesita cables ni es necesario que los dispositivos estén frente a frente, como ocurre con la tecnología de infrarrojos. Por ejemplo, puede utilizar un dispositivo guardado en una bolsa o en el bolsillo. El sistema BLUETOOTH es un estándar internacional utilizado por miles de empresas de todo el mundo y empleado por diversos fabricantes internacionales.

BLE (Bluetooth Low Energy) se creó para poder transmitir datos entre dos dispositivos durante largos periodos de tiempo, maximizando así el ahorro de batería.  Este tipo de Bluetooth se popularizó en 2010 en su versión más extendida, el BLE 4.0, que hace posibles conexiones inalámbricas de corto y medio alcance. Así, un dispositivo BLE funciona, casi siempre, en modo de suspensión, y solo se activa cuando realiza conexiones, que apenas duran milésimas de segundo. BLE se caracteriza fundamentalmente por su bajo consumo energético, al estar optimizada para transmisiones de datos periódicas o infrecuentes que maximizan la vida útil de la batería. A nivel de red, destaca por su inmediatez, estableciendo conexiones de forma significativamente más rápida que el Bluetooth clásico, y por ofrecer actualmente un mayor alcance operativo que incrementa su versatilidad topológica. Desde la perspectiva del hardware, representa una solución de bajo coste debido a la menor complejidad de sus componentes, manteniendo a su vez una amplia compatibilidad con todo el ecosistema IoT, smartphones y tablets. Esta interoperabilidad lo convierte en el protocolo ideal para orquestar la interacción con aplicaciones móviles (facilitando el seguimiento de ubicación, la vinculación de dispositivos y la gestión de notificaciones push), garantizando simultáneamente la integridad de las comunicaciones mediante mecanismos de seguridad nativos que incluyen el cifrado de datos frente a posibles ataques.

WiFi (Wi-Fi) es un estándar de LAN inalámbrica, parte de IEEE 802.11, para la comunicación entre diferentes dispositivos. Es un tipo de onda de radio, lo mismo que las redes Bluetooth y móviles, que se utiliza para la comunicación del dispositivo a pequeña escala, como en casas, centros comerciales, plazas, etc. WiFi es la forma más barata y rápida de transmisión a corta distancia que permite la navegación web , juegos en línea, transmisión de video y llamadas VOIP. En 2019, el número de dispositivos WiFi producidos superó los 310 millones.

Para maximizar el ancho de banda minimizando el consumo energético se suele utilizar una arquitectura híbrida compuesta por BLE y Wi-Fi. Este modelo de comunicación compuesto utiliza BLE para las fases de descubrimiento de red y negociación (handshake) debido a su bajo perfil de consumo. Una vez establecida la configuración, se utiliza el enlace Wi-Fi para el transporte de datos de gran volumen (como captura de imágenes o video). El sistema implementa tolerancia a fallos (failover), utilizando la conexión BLE como mecanismo de comunicación de respaldo ante la degradación o pérdida de la señal Wi-Fi.

Para el intercambio de información entre los nodos del sistema, se analizan los siguientes protocolos de comunicación y técnicas, evaluando su idoneidad en función de la latencia, el consumo energético y el ancho de banda:

1. HTTP (Hypertext Transfer Protocol): Protocolo de comunicación a nivel de aplicación basado en el modelo petición-respuesta (request/response). Opera típicamente sobre conexiones TCP. En este proyecto se evalúa como línea base comparativa debido a su alta compatibilidad y facilidad de implementación. Sin embargo, en arquitecturas de transmisión continua, introduce un overhead significativo debido a la latencia generada por el establecimiento, gestión y cierre de conexiones para cada solicitud.
1. WebSocket: Protocolo de comunicación que proporciona canales bidireccionales (full-duplex) sobre una única conexión TCP persistente. Al mantener el socket abierto, elimina el overhead de cabeceras asociado a múltiples solicitudes HTTP y reduce drásticamente la latencia, siendo el estándar adecuado para la transmisión de datos y eventos en tiempo real.
1. CoAP (Constrained Application Protocol): Protocolo de transferencia web ligero diseñado específicamente para dispositivos con recursos computacionales limitados y redes IoT. A diferencia de HTTP, opera principalmente sobre UDP, lo que minimiza el consumo de ancho de banda y energía. Mantiene una semántica REST similar a HTTP, pero con una sobrecarga de empaquetado mínima, optimizando la transmisión de paquetes pequeños.
1. MQTT (Message Queuing Telemetry Transport): Protocolo de mensajería ligero fundamentado en el patrón de arquitectura publicación/suscripción (publish/subscribe). Desacopla a los emisores de los receptores mediante el uso de un agente intermedio (en este caso, un broker Mosquitto). Es altamente eficiente para redes con ancho de banda limitado y se utiliza para el enrutamiento de telemetría y eventos de control.
