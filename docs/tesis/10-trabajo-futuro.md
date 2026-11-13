# 10. Trabajo futuro

Este capítulo reúne las líneas de trabajo que surgen de las limitaciones del prototipo (sec. 7.9) y de los objetivos que quedaron fuera del alcance del proyecto. Se agrupan en seis ejes: el hardware, la amplificación del audio, el reconocimiento de líneas de ómnibus, el reconocimiento de productos, los objetivos opcionales y la preparación del sistema para su uso real.

## 10.1 Hardware

El tamaño y el peso del dispositivo actual están determinados por componentes de propósito general: una Raspberry Pi Zero 2 W, un módulo de alimentación que se apila sobre ella con sus propios conectores, separadores y tornillos, y una cámara unida por un cable plano. La carcasa mide 89,2 × 28,5 × 39,8 mm sin el brazo del auricular (sec. 7.3.5) y buena parte de ese volumen corresponde a conectores, separadores y espacios de montaje que el dispositivo no necesita. El paso siguiente es diseñar una placa dedicada, que integre en un solo circuito el procesador (o un módulo de cómputo compacto), la gestión de la batería, la salida de audio y el pulsador, y que reciba la cámara sin el recorrido actual del cable. Con ella el dispositivo podría ser más liviano y compacto, y la carcasa podría diseñarse en torno a la forma de la patilla y no del conjunto de placas.

La autonomía estimada con la batería actual de 1000 mAh es de 1,5 a 2 horas de uso activo (sec. 7.3.3), lo que alcanza para pruebas pero no para una jornada. Una celda de 2000 mAh duplicaría la autonomía estimada, a cambio de unos 16 g más; con una placa dedicada, el espacio liberado podría destinarse a una batería mayor sin aumentar el tamaño total. Antes de elegirla conviene medir el consumo real con un medidor en serie, que reemplace las estimaciones de terceros con las que se trabajó.

La salida de audio necesita un amplificador: en el prototipo el transductor de conducción ósea se conecta directamente a un pin de propósito general y se oye con volumen bajo. El análisis y las alternativas se presentan en la sec. 10.2.

Para un uso diario, queda evaluar materiales más resistentes que el PLA para la carcasa.

## 10.2 Amplificación del audio del dispositivo

El prototipo entrega el audio sin amplificador: el transductor de conducción ósea de 4 ohmios se conecta al pin 12 de la placa a través de una resistencia de 260 ohmios y un capacitor de 47 µF (sec. 7.3.1). La decisión se tomó con el director de la tesis el 12 de noviembre de 2026, con la carcasa ya impresa y sin un amplificador disponible ese día (ADR 0012). Su costo es el volumen, audible en un ambiente silencioso y probablemente insuficiente en la calle. No es la batería: contra lo que podría suponerse, la salida directa es la alternativa que menos consume. Según el cálculo del ADR 0012, aún no medido, la rama disipa unos 10 mW mientras suena, entre el 0,4 y el 0,6 % del consumo de la placa en modo activo, y de esa potencia sólo 0,16 mW llegan al transductor; el resto se disipa en la resistencia que protege el pin.

Se probaron dos circuitos con el mismo transductor y el mismo software. El primero, una resistencia de 100 ohmios sin capacitor, produjo apenas un pitido perceptible, con un pico de corriente que además superaba el límite del pin. El segundo, el circuito RC en serie que quedó en el prototipo (260 ohmios y 47 µF), funciona: la voz se oye y se entiende, pero sólo con el transductor apoyado y en un ambiente silencioso. El límite no es de ajuste sino de fondo. Cualquier circuito pasivo alimentado por un pin GPIO está acotado por la corriente del pin: con 16 mA sobre 4 ohmios, la potencia máxima que puede llegar al transductor es de (0,016 A)² · 4 ohmios ≈ 1 mW, aun sin resistencia en serie. El circuito actual entrega unos 0,16 mW, de modo que optimizar sus componentes ganaría como mucho unos 8 dB, mientras que un amplificador clase D alimentado a 5 V entrega hasta 3 W, unos 40 dB más. Un transductor de conducción ósea, menos eficiente que un parlante en el oído, no alcanza con menos de un milivatio a hacerse oír sobre el ruido del tránsito, que es el ambiente de uso del modo ómnibus. Por eso la salida directa es inviable para el uso real y sólo se justifica en el prototipo; la conclusión no depende del valor de los componentes (ADR 0012). Las potencias son calculadas y el volumen se evaluó de oído, sin medición de nivel sonoro.

Se evaluaron las siguientes alternativas. Las cifras provienen de hojas de datos y de vendedores, y están pendientes de medición propia:

| Alternativa | Entrada | Potencia máxima en 4 ohmios | Consumo en reposo | Tamaño | Observaciones |
|---|---|---|---|---|---|
| Salida directa (actual) | PWM | ~0,16 mW | nulo con el PWM detenido | dos componentes | menor consumo, volumen bajo |
| Seguidor complementario de dos transistores | PWM | 5 a 18 mW | nulo | cuatro componentes | 15 a 20 dB más que la salida directa |
| LM386 | analógica | unos cientos de mW (clase AB) | ~4 mA más el indicador luminoso | grande | menos eficiente; su ganancia de 200 amplifica el ruido del PWM |
| PAM8403, módulo mini | analógica | ~3 W (clase D) | ~10 mA | 21 × 18 × 3,4 mm | disponible en Uruguay; amplifica el ruido del PWM |
| PAM8302 | analógica | ~2,5 W (clase D) | ~4 mA | 15 × 20 mm | sin oferta local encontrada |
| MAX98357A | digital (I2S) | ~3,2 W (clase D) | ~2,4 mA; menos de 1 µA apagado | 18 × 19 mm | elimina el ruido del PWM; importado |
| Circuito original de los auriculares | Bluetooth o USB | suficiente | alto | similar al de la placa | descartado: el amplificador está integrado en un chip que incluye radio, cargador y lector de tarjetas |

La alternativa recomendada es el MAX98357A. Recibe el audio en formato digital por I2S, de modo que elimina el ruido de cuantización del PWM que los amplificadores analógicos reproducen, y su entrada de apagado permite que el dispositivo lo active sólo al hablar, con un consumo en reposo despreciable. Usa los mismos pines que la salida actual (GPIO 18, 19 y 21), más la alimentación de 5 V; su integración consiste en reemplazar la resistencia y el capacitor por el módulo y cambiar una línea de la configuración de arranque. El modelo de la carcasa v0.29 deja libre, junto al conector GPIO, un espacio de unos 26 × 24 mm y 7 mm de alto, suficiente para el módulo. Si la carcasa debiera reimprimirse, convendría reservar ese espacio de forma explícita.

En todas las alternativas el consumo mientras el dispositivo habla crece con el volumen, del orden de 0,1 a 0,5 W según la estimación del ADR 0012. Queda pendiente medirlo junto con el consumo general de la placa (sec. 7.3.3).

## 10.3 Reconocimiento de líneas de ómnibus

La prioridad es evaluar el sistema en condiciones reales. Esto implica construir un conjunto de evaluación con fotografías tomadas por el propio dispositivo en paradas reales, a partir de la evidencia que ya registra el modo ómnibus (sec. 7.4.9), y realizar la prueba en la calle con y sin zoom digital, midiendo a qué distancia se anuncia la línea (sec. 7.4.10). Sobre ese conjunto deben documentarse las métricas del detector reentrenado en la GPU V100 y medirse el costo de la cuantización a 8 bits, con el contenedor del fabricante ya preparado (sec. 7.4.5).

La cobertura debe extenderse a las zonas donde el procesamiento local es más necesario. En la periferia de Montevideo esto significa incorporar al entrenamiento y a la evaluación carteles de líneas con letras, que hoy el sistema admite pero no tiene medidas (sec. 7.4.13). En el interior y en las líneas suburbanas e interdepartamentales significa, además, ampliar el catálogo con los datos de otras empresas y departamentos, y generar los anuncios pregrabados correspondientes; sin esa ampliación, el sistema no anuncia esas líneas aunque lea el cartel.

Si la prueba en la calle muestra que el límite está en el detector, que desde lejos no encuentra el cartel, el zoom puede extenderse a la zona de entrada del detector, para que el sensor también analice el ómnibus detectado con mayor resolución (sec. 7.4.10).

## 10.4 Reconocimiento de productos

El modo supermercado necesita un respaldo local que cumpla por completo el requisito de funcionamiento sin conexión (ADR 0001). El candidato es un modelo multimodal pequeño ejecutado en el teléfono, por ejemplo de la familia Gemma, cuya precisión y latencia deben evaluarse sobre productos reales (sec. 7.5.5). Esa evaluación requiere el conjunto de evaluación con la canasta básica fotografiada por el propio dispositivo, que permitirá además comparar los modelos de nube con métricas reproducibles (sec. 7.5.4).

El alcance puede ampliarse de los alimentos al resto de los productos de supermercado, como los de limpieza e higiene personal, en los que confundir un producto con otro tiene consecuencias para la salud. La ampliación requiere ajustar la instrucción al modelo y verificar que se mantengan la precisión y el tiempo de respuesta.

## 10.5 Objetivos opcionales

Quedan como trabajo futuro dos funcionalidades que no se implementaron: el único objetivo opcional del proyecto, la selección por señalamiento (sec. 2.2.3), y la lectura de etiquetas, que figuraba en la propuesta original.

El primero es la selección por señalamiento: que, ante varios productos en la imagen, el sistema anuncie sólo el que el usuario señala o toca con el dedo índice. Requiere detectar la mano y la punta del dedo en la imagen y relacionarla con el producto más cercano, y reduce la cantidad de información que el usuario debe escuchar en una góndola con muchos productos.

El segundo es la lectura de etiquetas mediante OCR, para obtener información complementaria del producto, como la variedad, el sabor, la presentación o la fecha de vencimiento. En parte ya la resuelve el modelo de visión, que devuelve un campo de detalle (sec. 7.5.2), pero una lectura dedicada permitiría responder preguntas concretas sobre la etiqueta y funcionar sin conexión.

## 10.6 Preparación para el uso real

Antes de que el sistema pueda ser usado por personas ajenas al equipo, deben realizarse las pruebas de usabilidad con personas ciegas o con baja visión, que permitan ajustar los tiempos del botón, el contenido y el orden de los anuncios y el volumen (sec. 7.2.6). Las instrucciones de uso deben ofrecerse en un formato accesible, por ejemplo como un audio dentro de la aplicación.

En cuanto a la seguridad, una versión distribuible necesita una clave de red distinta para cada unidad y un token por sesión en el servidor HTTP del dispositivo (sec. 7.3.2), y deben rotarse las credenciales que circularon durante el desarrollo (sec. 8.7.7). Por último, la distribución en Android requiere activar la cuenta de Google Play, cuyo flujo de publicación ya está configurado (sec. 8.5), y la tarjeta de memoria del dispositivo debe poder reconstruirse desde una imagen reproducible (sec. 8.7.7).
