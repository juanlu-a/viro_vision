# 3. Estado del arte

En esta sección se realiza una revisión de trabajos académicos y soluciones tecnológicas existentes relacionados con los principales componentes del proyecto: dispositivos de asistencia para personas con discapacidad visual, elementos de hardware que se consideren relevantes, técnicas de visión por computadora aplicadas a la accesibilidad, sistemas de OCR para reconocimiento de texto en imágenes reales, y modelos de detección de objetos para implementación en dispositivos embebidos.

## 3.1 Hardware para sistemas embebidos de visión, audio y procesamiento

En esta sección haremos un análisis de las distintas opciones manejadas para construir el dispositivo, tanto desde el punto de vista del procesamiento como pensando en la interacción entre el usuario y el producto final. Consideraremos la posibilidad de utilizar el celular como dispositivo de asistencia, a modo de “tercerizar” el procesamiento de la imágen y limitar la responsabilidad del dispositivo a la toma de imágenes, la comunicación con el celular y la reproducción del audio. No se descarta realizar todo el procesamiento en el dispositivo final, a modo de evaluar la solución como un producto *standalone.* 

### 3.1.1 Microprocesador y microcontrolador

**ESP32**

La ESP32 es un microcontrolador de bajo consumo desarrollado por Espressif. Está pensado para aplicaciones IoT y sistemas embebidos donde se requiere controlar sensores, comunicarse mediante Wi-Fi o Bluetooth y ejecutar tareas relativamente simples en tiempo real. Tiene muy bajo costo, aproximadamente 10 dólares o menos, muy bajo consumo energético, y un tamaño muy reducido, además de variantes comunes con Wi-Fi y Bluetooth.  
Sin embargo, sus recursos de procesamiento son muy limitados para visión artificial, además de tener poca memoria RAM, lo que restringe el tamaño y la calidad de las imágenes que se pueden procesar. Esto, y que las opciones de cámaras que soporta son limitadas (solo cámaras sencillas) hacen que sea difícil de elegir como el microcontrolador.

**Jetson Nano**

La Jetson Nano es una computadora de placa única, orientada específicamente a aplicaciones de inteligencia artificial. Incorpora una GPU NVIDIA que permite acelerar redes neuronales mediante CUDA. Tiene una capacidad altísima de procesamiento y permite ejecutar modelos complejos (YOLO, OCR, modelos multimodales) además de ser compatible con múltiples cámaras de alta resolución.  
Sin embargo, su tamaño, precio elevado y alto consumo energético hacen inviable la aplicación a nuestro proyecto, ya que debemos desarrollar un dispositivo lo más barato posible, portatil y fácil de transportar. La potencia adicional no justifica el incremento de costo, consumo y tamaño 

**Raspberry Pi Zero 2 W + Coral TPU accelerator**

La Raspberry Pi Zero 2 W es una computadora de placa única que ejecuta Linux y combina un tamaño reducido con una capacidad de procesamiento suficiente para aplicaciones de visión artificial livianas. Su tamaño compacto, bajo consumo energético y gran cantidad de cámaras la hacen una candidata estelar. Además, permite ejecutar modelos locales mediante TensorFlow Lite u OpenCV, siendo compatible con aceleradores como Coral TPU.  
Si bien tiene desventajas como contar con menor potencia que una Raspberry Pi 5, su capacidad se ve potenciada cuando se cuenta con el acelerador Coral TPU.**  
**La Raspberry Pi Zero 2 W representa un equilibrio entre costo, tamaño y capacidad de procesamiento. Además, permite implementar y comparar las dos arquitecturas distintas, permitiendo hacer el procesamiento en el dispositivo o teniendo capacidad de enviar datos al celular a través de WiFi o BLE para ser procesados en él, siendo así la elegida por el grupo.

### 3.1.2 Cámara

**Cámara ESP32 (OV2640 / OV5640)**

Las cámaras utilizadas habitualmente con ESP32 están diseñadas para aplicaciones IoT donde el costo y el consumo son prioritarios. Por eso son muy económicas tanto en precio como en consumo. Sin embargo, la calidad de imagen es limitada (incluso la propia ESP32 obliga frecuentemente a reducir resolución o aumentar la compresión JPEG debido a sus limitaciones de memoria), cosa que no nos podemos permitir pensando en el reconocimiento de ómnibus a una distancia considerable. Por esto último, tampoco es conveniente que en muchos casos utilicen un enfoque fijo.

**Cámara USB genérica**

Las cámaras USB ofrecen una amplia variedad de resoluciones y calidades, conectándose mediante el puerto USB. Entre sus ventajas se incluyen la gran disponibilidad comercial, la variedad (precios, calidad, enfoque automático o no) y lo fácil que se pueden reemplazar en caso de cualquier problema. Sin embargo, muchas tienen mayor consumo que las cámaras diseñadas para microcontroladores, ya que son fabricadas con una computadora de escritorio en mente. Por si fuera poco, ocupan el puerto USB, lo que dificulta el uso simultáneo del Coral TPU en una Raspberry Pi Zero 2 W.

**Raspberry Pi Camera module 3**

La Camera Module 3 es la cámara oficial de Raspberry Pi basada en el sensor Sony IMX708 de 12 MP e incorpora enfoque automático. Esto nos proporcionaría una excelente calidad de imagen y compatibilidad con la Raspberry Zero 2 W, ya que tiene integración directa mediante el conector CSI, sin ocupar el puerto USB, dejando este libre para el acelerador Coral TPU. Al ser parte del ecosistema de Raspberry, cuenta con buena documentación y soporte.  
Si bien el precio de este módulo es más caro que las cámaras de la ESP32, no es prohibitivo, y no está demás decir que el cable flex requiere cierto cuidado mecánico en el diseño del dispositivo, pero no son obstáculos que no se puedan sortear al momento de diseñar la estructura que lo encapsule todo.

### 3.1.3 Conclusiones

Se seleccionó la plataforma **Raspberry Pi Zero 2 W** debido a que ofrece un equilibrio adecuado entre costo, tamaño, consumo energético y capacidad de procesamiento. Su compatibilidad con el acelerador **Coral TPU** permite evaluar algoritmos de visión artificial mediante procesamiento local, mientras que su conectividad Wi-Fi posibilita comparar esta arquitectura con alternativas basadas en procesamiento remoto utilizando un teléfono móvil. Asimismo, la utilización de la **Raspberry Pi Camera Module 3** garantiza una captura de imágenes de alta calidad mediante una interfaz CSI dedicada, liberando el puerto USB para futuros aceleradores de inteligencia artificial y mejorando la precisión esperada de los modelos de reconocimiento. 

  

## 3.2 Dispositivos de asistencia para personas con discapacidad visual

Los dispositivos de asistencia para personas con discapacidad visual han evolucionado desde soluciones mecánicas simples como el bastón blanco, hasta sistemas tecnológicamente sofisticados que incorporan visión por computadora e IA. Entre las soluciones más conocidas se encuentran OrCam MyEye, un dispositivo que se monta en los lentes y utiliza CV para leer texto, reconocer caras y productos; Microsoft Seeing AI, una aplicación móvil que describe el entorno, lee documentos y reconoce personas; y Google Lookout, otra aplicación móvil orientada a describir el entorno del usuario en tiempo real. Estas soluciones, si bien avanzadas, presentan limitaciones en el contexto uruguayo como el costo elevado (OrCam supera los USD 4.000), la dependencia de servicios en la nube con conectividad permanente, y la falta de adaptación al sistema de transporte público local.

  

## 3.3 Accesibilidad en frameworks de desarrollo multiplataforma

Uno de los desafíos documentados en la literatura sobre frameworks de desarrollo multiplataforma (Cross-Platform Development Frameworks, CPDF) es que, si bien reducen el esfuerzo de desarrollo al compartir código entre plataformas, no siempre logran exponer el 100% de las capacidades de accesibilidad nativa de cada sistema operativo.

El trabajo de Mascetti et al. (2020), "Developing Accessible Mobile Applications with Cross-Platform Development Frameworks" (presentado en ACM ASSETS 2020, disponible en arXiv:2005.06875), realiza un análisis sistemático de frameworks CPDF (entre ellos React Native y Xamarin) evaluando en qué medida sus APIs de accesibilidad cubren las funcionalidades completas expuestas nativamente por las APIs de accesibilidad de iOS (UIAccessibility) y Android (Accessibility API). Los autores concluyen que estos frameworks exponen únicamente un subconjunto de las capacidades de accesibilidad nativas, y que lograr una paridad completa de accesibilidad (equivalente a una app 100% nativa) requiere en muchos casos escribir módulos de código nativo específicos por plataforma (native modules) para cubrir los elementos de interfaz personalizados o comportamientos avanzados de lectores de pantalla, lo cual "niega parcialmente las ventajas" de usar un framework multiplataforma en primer lugar.

Este hallazgo es relevante para ViroVision porque condiciona directamente el diseño de la aplicación: no alcanza con adoptar React Native y asumir que la accesibilidad "viene incluida"; es necesario un proceso de verificación activa. En consecuencia, la estrategia de desarrollo del proyecto contempla:

  

1.  Priorizar el uso de componentes estándar de React Native (View, Text, TouchableOpacity, Image, etc.) correctamente anotados con las propiedades de accesibilidad (accessibilityLabel, accessibilityRole, accessibilityHint), que sí heredan el comportamiento nativo esperado por VoiceOver y TalkBack.
2.  Evitar o minimizar el uso de componentes de interfaz altamente personalizados (gráficos dibujados a medida, gestos no estándar) que son precisamente el punto débil identificado por Mascetti et al., y en los casos donde sean imprescindibles, evaluar la implementación de módulos nativos puntuales.
3.  Incluir pruebas de accesibilidad específicas con los lectores de pantalla nativos de cada plataforma (VoiceOver en iOS, TalkBack en Android) como etapa formal del desarrollo, en lugar de asumir su funcionamiento correcto por default, tarea reflejada en el desglose de tareas del proyecto (hito "Pruebas de accesibilidad con lectores de pantalla nativos").
4.  Complementar la validación técnica con pruebas de usabilidad reales junto a usuarios ciegos o con baja visión, dado que la accesibilidad técnica (API correctamente implementada) no garantiza por sí sola una buena experiencia de uso.

  

### 3.3.1 Integración con el sistema de reconocimiento y el dispositivo físico

  

A diferencia de una aplicación convencional que reproduce su audio por el altavoz general del teléfono, ViroVision cuenta con un auricular físico propio, integrado al dispositivo, por el cual se reproduce exclusivamente el audio generado por la aplicación (los resultados del reconocimiento vía texto a voz). El resto del audio del celular (llamadas, notificaciones de otras apps, reproducción de música, el propio lector de pantalla del sistema (VoiceOver/TalkBack)) continúa saliendo por la ruta de audio habitual del dispositivo (altavoz, auriculares personales del usuario, etc.), sin verse forzado a pasar por el auricular de ViroVision.

Esta separación de canales de audio es, en sí misma, una decisión de accesibilidad relevante: evita que el usuario deba compartir un único canal auditivo entre el sistema operativo y la aplicación, reduciendo el riesgo de superposición o confusión entre la voz del lector de pantalla y la retroalimentación de ViroVision. En términos de implementación, esto requiere enrutar explícitamente el audio de salida de la aplicación hacia el dispositivo de audio correspondiente (en lugar de dejarlo en la salida de audio por defecto del sistema), utilizando las APIs de sesión/enrutamiento de audio de cada plataforma (AVAudioSession en iOS, AudioManager/AudioDeviceInfo en Android) o una librería de React Native que exponga selección de dispositivo de salida (por ejemplo, react-native-track-player o expo-av).

  

Cabe destacar además que, dado que Bluetooth Low Energy (BLE) (el protocolo usado para la comunicación de datos y control con el dispositivo físico) no está diseñado para transmitir audio en tiempo real por su bajo ancho de banda, la transmisión de audio hacia el auricular requiere un canal separado (por ejemplo, un perfil de Bluetooth Classic como A2DP/HFP, o una conexión cableada, según la decisión de hardware que tome el equipo). Esto implica que el dispositivo ViroVision maneja, en la práctica, dos canales de comunicación distintos con el celular: uno de datos (BLE) y uno de audio, lo cual debe quedar reflejado en el diseño de la arquitectura de integración app-dispositivo.

## 3.4 Técnicas de OCR para reconocimiento de líneas de ómnibus

El reconocimiento del cartel frontal de un ómnibus pertenece a la categoría del **texto en escenas
naturales** (*scene text recognition*), sustancialmente más difícil que el OCR de documentos. En un
documento escaneado el texto es oscuro sobre fondo claro, está alineado con los ejes de la imagen y
la iluminación es uniforme. En una escena urbana no se cumple ninguna de esas condiciones.

## 3.5 Reconocimiento de productos en supermercados

El reconocimiento de productos en góndola es un problema con literatura consolidada, impulsado
principalmente por aplicaciones de gestión de inventario y de cumplimiento de planogramas en el
sector minorista, y de manera secundaria por aplicaciones de asistencia.

## 3.6 Modelos de detección de objetos en tiempo real para cómputo en el borde

La ejecución de detectores de objetos sobre hardware embebido es un área con producción abundante,
organizada alrededor del compromiso entre precisión, latencia, memoria y consumo.

## 3.7 Protocolos de comunicación entre dispositivo y teléfono

La elección del protocolo de comunicación entre un dispositivo embebido portátil y un teléfono es una
decisión de arquitectura con literatura técnica establecida, gobernada por el compromiso entre
consumo energético, caudal y latencia de establecimiento.
