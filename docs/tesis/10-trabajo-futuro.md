# 10. Trabajo futuro

Este capítulo reúne las líneas de trabajo que surgen de las limitaciones del prototipo (sec. 7.9) y de los objetivos que quedaron fuera del alcance del proyecto. Se agrupan en cinco ejes: el hardware, el reconocimiento de líneas de ómnibus, el reconocimiento de productos, los objetivos opcionales y la preparación del sistema para su uso real.

## 10.1 Hardware

El tamaño y el peso del dispositivo actual están determinados por componentes de propósito general: una Raspberry Pi Zero 2 W, un módulo de alimentación que se apila sobre ella con sus propios conectores, separadores y tornillos, y una cámara unida por un cable plano. La carcasa mide 89,2 × 28,5 × 39,8 mm sin el brazo del auricular (sec. 7.3.5) y buena parte de ese volumen corresponde a conectores, separadores y espacios de montaje que el dispositivo no necesita. El paso siguiente es diseñar una placa dedicada, que integre en un solo circuito el procesador (o un módulo de cómputo compacto), la gestión de la batería, la salida de audio y el pulsador, y que reciba la cámara sin el recorrido actual del cable. Con ella el dispositivo podría ser más liviano y compacto, y la carcasa podría diseñarse en torno a la forma de la patilla y no del conjunto de placas.

La autonomía estimada con la batería actual de 1000 mAh es de 1,5 a 2 horas de uso activo (sec. 7.3.3), lo que alcanza para pruebas pero no para una jornada. Una celda de 2000 mAh duplicaría la autonomía estimada, a cambio de unos 16 g más; con una placa dedicada, el espacio liberado podría destinarse a una batería mayor sin aumentar el tamaño total. Antes de elegirla conviene medir el consumo real con un medidor en serie, que reemplace las estimaciones de terceros con las que se trabajó.

La salida de audio debe pasar de la señal PWM de un pin de propósito general a un amplificador digital por I2S (por ejemplo, un MAX98357A) o a un amplificador analógico pequeño (como un PAM8302), capaz de entregar la corriente que requiere el auricular (sec. 7.3.6). El traslado de la salida PWM a los pines 12 y 14 con una resistencia y un capacitor en serie, propuesto en el PR #130 y pendiente de prueba, protege el pin pero no resuelve el volumen. Con esa etapa resuelta puede incorporarse el transductor de conducción ósea de 14 mm previsto en la carcasa, que deja los oídos libres para los sonidos del entorno, un aspecto importante para una persona ciega en la vía pública.

Para un uso diario, queda evaluar materiales más resistentes que el PLA para la carcasa.

## 10.2 Reconocimiento de líneas de ómnibus

La prioridad es evaluar el sistema en condiciones reales. Esto implica construir un conjunto de evaluación con fotografías tomadas por el propio dispositivo en paradas reales, a partir de la evidencia que ya registra el modo ómnibus (sec. 7.4.9), y realizar la prueba en la calle con y sin zoom digital, midiendo a qué distancia se anuncia la línea (sec. 7.4.10). Sobre ese conjunto deben documentarse las métricas del detector reentrenado en la GPU V100 y medirse el costo de la cuantización a 8 bits, con el contenedor del fabricante ya preparado (sec. 7.4.5).

La cobertura debe extenderse a las zonas donde el procesamiento local es más necesario. En la periferia de Montevideo esto significa incorporar al entrenamiento y a la evaluación carteles de líneas con letras, que hoy el sistema admite pero no tiene medidas (sec. 7.4.13). En el interior y en las líneas suburbanas e interdepartamentales significa, además, ampliar el catálogo con los datos de otras empresas y departamentos, y generar los anuncios pregrabados correspondientes; sin esa ampliación, el sistema no anuncia esas líneas aunque lea el cartel.

Si la prueba en la calle muestra que el límite está en el detector, que desde lejos no encuentra el cartel, el zoom puede extenderse a la zona de entrada del detector, para que el sensor también analice el ómnibus detectado con mayor resolución (sec. 7.4.10).

## 10.3 Reconocimiento de productos

El modo supermercado necesita un respaldo local que cumpla por completo el requisito de funcionamiento sin conexión (ADR 0001). El candidato es un modelo multimodal pequeño ejecutado en el teléfono, por ejemplo de la familia Gemma, cuya precisión y latencia deben evaluarse sobre productos reales (sec. 7.5.5). Esa evaluación requiere el conjunto de evaluación con la canasta básica fotografiada por el propio dispositivo, que permitirá además comparar los modelos de nube con métricas reproducibles (sec. 7.5.4).

El alcance puede ampliarse de los alimentos al resto de los productos de supermercado, como los de limpieza e higiene personal, en los que confundir un producto con otro tiene consecuencias para la salud. La ampliación requiere ajustar la instrucción al modelo y verificar que se mantengan la precisión y el tiempo de respuesta.

## 10.4 Objetivos opcionales

Quedan como trabajo futuro dos funcionalidades que no se implementaron: el único objetivo opcional del proyecto, la selección por señalamiento (sec. 2.2.3), y la lectura de etiquetas, que figuraba en la propuesta original.

El primero es la selección por señalamiento: que, ante varios productos en la imagen, el sistema anuncie sólo el que el usuario señala o toca con el dedo índice. Requiere detectar la mano y la punta del dedo en la imagen y relacionarla con el producto más cercano, y reduce la cantidad de información que el usuario debe escuchar en una góndola con muchos productos.

El segundo es la lectura de etiquetas mediante OCR, para obtener información complementaria del producto, como la variedad, el sabor, la presentación o la fecha de vencimiento. En parte ya la resuelve el modelo de visión, que devuelve un campo de detalle (sec. 7.5.2), pero una lectura dedicada permitiría responder preguntas concretas sobre la etiqueta y funcionar sin conexión.

## 10.5 Preparación para el uso real

Antes de que el sistema pueda ser usado por personas ajenas al equipo, deben realizarse las pruebas de usabilidad con personas ciegas o con baja visión, que permitan ajustar los tiempos del botón, el contenido y el orden de los anuncios y el volumen (sec. 7.2.6). Las instrucciones de uso deben ofrecerse en un formato accesible, por ejemplo como un audio dentro de la aplicación.

En cuanto a la seguridad, una versión distribuible necesita una clave de red distinta para cada unidad y un token por sesión en el servidor HTTP del dispositivo (sec. 7.3.2), y deben rotarse las credenciales que circularon durante el desarrollo (sec. 8.7.7). Por último, la distribución en Android requiere activar la cuenta de Google Play, cuyo flujo de publicación ya está configurado (sec. 8.5), y la tarjeta de memoria del dispositivo debe poder reconstruirse desde una imagen reproducible (sec. 8.7.7).
