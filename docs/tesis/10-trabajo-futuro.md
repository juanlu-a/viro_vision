# 10. Trabajo futuro

Este capítulo reúne las líneas de trabajo que surgen de las limitaciones del prototipo (sec. 7.9) y de los objetivos que quedaron fuera del alcance del proyecto. Se agrupan en seis ejes: el hardware, la amplificación del audio, el reconocimiento de líneas de ómnibus, el reconocimiento de productos, los objetivos opcionales y la preparación del sistema para su uso real.

## 10.1 Hardware

El tamaño y el peso del dispositivo actual están determinados por componentes de propósito general: una Raspberry Pi Zero 2 W, un módulo de alimentación que se apila sobre ella con sus propios conectores, separadores y tornillos, y una cámara unida por un cable plano. La carcasa mide 89,2 × 28,5 × 39,8 mm sin el brazo del auricular (sec. 7.3.5) y buena parte de ese volumen corresponde a conectores, separadores y espacios de montaje que el dispositivo no necesita. El paso siguiente es diseñar una placa dedicada, que integre en un solo circuito el procesador (o un módulo de cómputo compacto), la gestión de la batería, la salida de audio y el pulsador, y que reciba la cámara sin el recorrido actual del cable. Con ella el dispositivo podría ser más liviano y compacto, y la carcasa podría diseñarse en torno a la forma de la patilla y no del conjunto de placas.

La autonomía estimada con la batería actual de 1000 mAh es de 1,5 a 2 horas de uso activo (sec. 7.3.3), lo que alcanza para pruebas pero no para una jornada. Una celda de 2000 mAh duplicaría la autonomía estimada, a cambio de unos 16 g más; con una placa dedicada, el espacio liberado podría destinarse a una batería mayor sin aumentar el tamaño total. Antes de elegirla conviene medir el consumo real con un medidor en serie, que reemplace las estimaciones de terceros con las que se trabajó.

La salida de audio del prototipo se genera por PWM y pasa por un amplificador analógico con un filtro a la entrada. Funciona, pero conserva un ruido de fondo propio del PWM; su reemplazo por una salida digital se presenta en la sec. 10.2.

Para un uso diario, queda evaluar materiales más resistentes que el PLA para la carcasa.

## 10.2 La salida de audio del dispositivo

La salida de audio pasó por tres etapas, registradas en el ADR 0012. En la primera, el transductor de conducción ósea de 4 ohmios se conectó directamente al pin 12 a través de una resistencia de 260 ohmios y un capacitor de 47 µF. Se probaron dos circuitos con el mismo transductor y el mismo software. El primero, una resistencia de 100 ohmios sin capacitor, produjo apenas un pitido perceptible, con un pico de corriente que además superaba el límite del pin. El segundo, el circuito RC en serie de 260 ohmios y 47 µF, funcionaba: la voz se oía y se entendía, pero sólo con el transductor apoyado y en un ambiente silencioso. El límite lo fija la corriente que puede entregar el pin: con 16 mA sobre 4 ohmios, la potencia máxima que puede llegar al transductor es de (0,016 A)² · 4 ohmios ≈ 1 mW, aun sin resistencia en serie. Ese circuito entregaba unos 0,16 mW, de modo que optimizar sus componentes ganaría como mucho unos 8 dB, mientras que un amplificador clase D alimentado a 5 V entrega hasta 3 W, unos 40 dB más. Un transductor de conducción ósea no alcanza con menos de un milivatio a hacerse oír sobre el ruido del tránsito, que es el ambiente de uso del modo ómnibus. Esa salida directa era además la que menos energía consumía (unos 13 mW vistos desde la batería mientras suena, menos del 1% de la placa): su limitación era el volumen, no la batería.

En la segunda etapa, decidida con el director de la tesis el 12 de noviembre, el prototipo se mantuvo sin amplificador y la amplificación se planteó como trabajo futuro. Se evaluaron las alternativas de la tabla; las cifras provienen de hojas de datos y de vendedores, y están pendientes de medición propia:

| **Alternativa** | **Entrada** | **Potencia máxima en 4 ohmios** | **Consumo en reposo** | **Tamaño** | **Observaciones** |
|---|---|---|---|---|---|
| Salida directa | PWM | ~0,16 mW | nulo con el PWM detenido | dos componentes | menor consumo, volumen bajo |
| Seguidor complementario de dos transistores | PWM | 5 a 18 mW | nulo | cuatro componentes | 15 a 20 dB más que la salida directa |
| LM386 | analógica | unos cientos de mW (clase AB) | ~4 mA más el indicador luminoso | grande | menos eficiente; su ganancia de 200 amplifica el ruido del PWM |
| PAM8403, módulo mini (actual) | analógica | ~3 W (clase D) | ~10 mA | 21 × 18 × 3,4 mm | disponible en Uruguay; requiere filtro de entrada; amplifica el ruido de cuantización del PWM |
| PAM8302 | analógica | ~2,5 W (clase D) | ~4 mA | 15 × 20 mm | sin oferta local encontrada |
| MAX98357A | digital (I²S) | ~3,2 W (clase D) | ~2,4 mA; menos de 1 µA apagado | 18 × 19 mm | elimina el ruido del PWM; importado |
| Circuito original de los auriculares | Bluetooth o USB | suficiente | alto | similar al de la placa | descartado: el amplificador está integrado en un chip que incluye radio, cargador y lector de tarjetas |

En la tercera etapa, el 18 de noviembre, se incorporó la alternativa disponible en Uruguay en el plazo de las pruebas, un módulo PAM8403. Conectado directamente al pin saturaba, porque recibía una onda cuadrada de 3,3 V en lugar de una señal de nivel de línea, y al terminar cada audio dejaba un soplido continuo, porque el PWM sigue conmutando sin audio. El soplido posterior se resolvió en el software, desconectando el pin entre reproducciones. La saturación se resolvió con un filtro RC de dos etapas a la entrada (10 kiloohmios y 4,7 nF; 10 kiloohmios y 2 nF), con un corte calculado en unos 2 kHz y una atenuación de más de 50 dB a la frecuencia de conmutación, después de descartar una resistencia sola, que atenúa por igual la voz y el ruido, y un filtro de una etapa, que dejaba soplido audible (sec. 7.3.1). El resultado es una voz clara, con volumen suficiente y ajustable desde la aplicación.

Lo que queda pendiente es el ruido de fondo. Parte del ruido del PWM es ruido de cuantización que cae dentro de la banda de la voz y que ningún filtro elimina sin eliminar también la voz. Sólo desaparece con una salida digital, por I²S. Hay dos formas de obtenerla. La primera es el MAX98357A, que reúne en un módulo de 18 × 19 mm el conversor y un amplificador clase D, y cuya entrada de apagado permite que el dispositivo lo active sólo al hablar, con un consumo en reposo de unos 2,4 mA, menor que el del PAM8403 actual. La segunda es un conversor PCM5102A delante del mismo PAM8403, que aprovecha el amplificador ya instalado a cambio de un módulo y varias conexiones más. En ambos casos el bus I²S usa los pines que hoy ocupa la salida PWM: el GPIO 18 pasa a ser el reloj de bit (BCLK), el GPIO 19 el reloj de trama (LRCLK) y el GPIO 21 la línea de datos (DIN). La integración consiste en retirar el filtro, cablear el módulo y reemplazar una línea de la configuración de arranque. El espacio interior de la carcasa v0.29 alcanzó con justeza para el amplificador y el filtro; si se reimprimiera, convendría reservar de forma explícita el lugar del módulo de audio.

En todas las alternativas el consumo mientras el dispositivo habla crece con el volumen, del orden de 0,1 a 0,5 W según la estimación del ADR 0012. Queda pendiente medirlo junto con el consumo general de la placa (sec. 7.3.3).

## 10.3 Reconocimiento de líneas de ómnibus

La prioridad es evaluar el sistema en condiciones reales. Esto implica construir un conjunto de evaluación con fotografías tomadas por el propio dispositivo en paradas reales, a partir de la evidencia que ya registra el modo ómnibus (sec. 7.4.9), y realizar la prueba en la calle con y sin zoom digital, midiendo a qué distancia se anuncia la línea (sec. 7.4.10). Sobre ese conjunto deben documentarse las métricas del detector reentrenado en la GPU V100 y medirse el costo de la cuantización a 8 bits, con el contenedor del fabricante ya preparado (sec. 7.4.5).

La cobertura debe extenderse a las zonas donde el procesamiento local es más necesario. En la periferia de Montevideo esto significa incorporar al entrenamiento y a la evaluación carteles de líneas con letras, que el sistema admite pero cuyo reconocimiento aún no se midió de forma suficiente (sec. 7.4.13). En el interior y en las líneas suburbanas e interdepartamentales significa, además, ampliar el catálogo con los datos de otras empresas y departamentos, y generar los anuncios pregrabados correspondientes; sin esa ampliación, el sistema no anuncia esas líneas aunque lea el cartel.

Si la prueba en la calle muestra que el límite está en el detector, que desde lejos no encuentra el cartel, el zoom puede extenderse a la zona de entrada del detector, para que el sensor también analice el ómnibus detectado con mayor resolución (sec. 7.4.10).

## 10.4 Reconocimiento de productos

El modo supermercado necesita un respaldo local que cumpla por completo el requisito de funcionamiento sin conexión (ADR 0001). El candidato es un modelo multimodal pequeño ejecutado en el teléfono, por ejemplo de la familia Gemma, cuya precisión y latencia deben evaluarse sobre productos reales (sec. 7.5.5). Esa evaluación requiere el conjunto de evaluación con la canasta básica fotografiada por el propio dispositivo, que permitirá además comparar los modelos de nube con métricas reproducibles (sec. 7.5.4).

El alcance puede ampliarse de los alimentos al resto de los productos de supermercado, como los de limpieza e higiene personal, en los que confundir un producto con otro tiene consecuencias para la salud. La ampliación requiere ajustar la instrucción al modelo y verificar que se mantengan la precisión y el tiempo de respuesta.

## 10.5 Objetivos opcionales

Quedan como trabajo futuro dos funcionalidades que no se implementaron: el único objetivo opcional del proyecto, la selección por señalamiento (sec. 2.2.3), y la lectura de etiquetas.

La primera es la selección por señalamiento: que, ante varios productos en la imagen, el sistema anuncie sólo el que el usuario señala o toca con el dedo índice. Requiere detectar la mano y la punta del dedo en la imagen y relacionarla con el producto más cercano, y reduce la cantidad de información que el usuario debe escuchar en una góndola con muchos productos.

La segunda es la lectura de etiquetas mediante OCR, para obtener información complementaria del producto, como la variedad, el sabor, la presentación o la fecha de vencimiento. En parte ya la resuelve el modelo de visión, que devuelve un campo de detalle (sec. 7.5.2), pero una lectura dedicada permitiría responder preguntas concretas sobre la etiqueta y funcionar sin conexión.

## 10.6 Preparación para el uso real

Antes de ampliar el uso del sistema a personas ciegas no vinculadas al proyecto, deben realizarse las pruebas de usabilidad con personas ciegas o con baja visión, que permitan ajustar los tiempos del botón, el contenido y el orden de los anuncios y el volumen (sec. 7.2.6). Las instrucciones de uso deben ofrecerse en un formato accesible, por ejemplo como un audio embebido en la aplicación.

En cuanto a la seguridad, una versión distribuible necesita una clave de red distinta para cada unidad, un *token* por sesión en el servidor HTTP del dispositivo y autenticación en la característica de control BLE (sec. 7.3.2), y deben rotarse las credenciales que circularon durante el desarrollo (sec. 8.7.7). Por último, la distribución en Android requiere activar la cuenta de Google Play, cuyo flujo de publicación ya está configurado (sec. 8.5), y la tarjeta de memoria del dispositivo debe poder reconstruirse desde una imagen reproducible (sec. 8.7.7).

