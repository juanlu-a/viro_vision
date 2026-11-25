# 7. Diseño y desarrollo

Este capítulo describe cómo se construyó el sistema. Se presenta primero la arquitectura general y luego cada componente: el dispositivo y su carcasa, el pipeline de reconocimiento de líneas de ómnibus, el de productos y la aplicación móvil, y por último la accesibilidad como criterio transversal. Cada decisión de diseño se presenta junto al componente al que pertenece, con el problema que la originó, las alternativas consideradas y, cuando la hubo, la medición que la justificó, en forma resumida. La evaluación del sistema terminado, con sus conjuntos de datos, sus métricas y sus límites, se presenta en el capítulo 9.

## 7.1 Arquitectura del sistema

### 7.1.1 Visión general

ViroVision está compuesto por tres elementos técnicos y por la persona que lo utiliza:

1. El dispositivo, montado en la patilla de unos lentes. Está formado por una computadora de placa única, una cámara con capacidad de inferencia en el propio sensor, un botón físico y una salida de audio. Captura el entorno y reproduce la respuesta.
1. La aplicación móvil, que se ejecuta en el teléfono del usuario. Gestiona la vinculación con el dispositivo, aporta capacidad de procesamiento cuando es necesaria, resuelve la síntesis de voz y ofrece la configuración del sistema.
1. Los servicios de nube, que se usan en el modo supermercado; en el prototipo ese modo depende de ellos (sec. 7.4.6). Están formados por un intermediario propio que resguarda las credenciales y, detrás de él, un modelo de lenguaje con capacidad de visión.
1. El usuario, que interactúa mediante un botón y recibe la información por voz. La pantalla del teléfono no forma parte del uso habitual; se utiliza para la configuración y para que un acompañante vidente pueda verificar el resultado.

La división de responsabilidades responde a la restricción principal del proyecto (ADR 0001): las funciones esenciales deben funcionar sin conexión a internet. Por ese motivo el modo ómnibus, que además es el más sensible a la latencia, se resuelve dentro del dispositivo, mientras que la nube se utiliza en el modo supermercado, donde la ganancia de precisión justifica la dependencia y donde el usuario se encuentra, en general, en un lugar con cobertura.

### 7.1.2 Modos de operación

El sistema funciona como una máquina de estados de tres modos que se controla con un único botón (ADR 0007), con los gestos de la Tabla 10.

Tabla 10: Gestos del botón del dispositivo y su efecto.

| **Gesto** | **Efecto** |
|---|---|
| Un clic | Entra en modo ómnibus desde cualquier estado; si el sistema ya está en modo ómnibus, repite el último anuncio |
| Doble clic | Entra en modo supermercado desde cualquier estado y solicita una lectura |
| Pulsación larga | Vuelve al estado de espera |

En una primera versión, pasar de un modo a otro exigía volver antes al estado de espera. Esa restricción se eliminó porque, para una persona que no ve la pantalla, presionar el botón y no obtener respuesta se interpreta como una falla del dispositivo. Desde entonces cada gesto lleva directamente a un modo. Por el mismo motivo, el doble clic solicita una lectura aunque el sistema ya esté en modo supermercado: el usuario que repite el gesto está pidiendo una nueva lectura.

El sistema no emite audio que el usuario no haya solicitado. En el modo supermercado la solicitud es cada doble clic; en el modo ómnibus la solicitud es el propio modo, y mientras está activo el dispositivo vigila la escena y anuncia los ómnibus que aparecen (sec. 7.3.9).

### 7.1.3 Los tres flujos de reconocimiento

El proyecto evaluó dos arquitecturas de procesamiento: resolver todo en el dispositivo, como producto autónomo, o derivar el procesamiento de imagen al teléfono (sec. 4.1). Sobre esa base, el diagrama de casos de uso que el equipo elaboró al comienzo del desarrollo planteaba tres flujos de reconocimiento: dos variantes del modo ómnibus, que se diferenciaban en cuánto del reconocimiento se ejecutaba en la placa y cuánto se derivaba al teléfono, y un flujo para el modo supermercado, en el que la fotografía pasa por el teléfono hacia un modelo en la nube. La elección entre las dos variantes del modo ómnibus quedó en suspenso hasta contar con el hardware para medirlas, y la Raspberry Pi se eligió, entre otras razones, porque permite implementar y comparar ambas. El resultado es que cada caso de uso terminó en un extremo distinto: el modo ómnibus se resuelve por completo en el dispositivo (sec. 7.3.2 y 7.2.6), y el modo supermercado se deriva al teléfono y de allí a la nube (sec. 7.4.2).

### 7.1.4 Comunicación entre componentes

La comunicación entre el dispositivo y el teléfono utiliza dos canales. La medición del enlace Bluetooth de baja energía (BLE, sec. 7.1.5) mostró que ese enlace no puede transportar una fotografía en el tiempo disponible, pero resulta adecuado para los mensajes que deben llegar siempre y con baja latencia: la pulsación del botón, el cambio de modo y el estado del dispositivo. Por ello se separaron dos planos:

1. Plano de control, sobre BLE (GATT). La conexión permanece activa y se restablece automáticamente si se pierde. Transporta eventos pequeños.
1. Plano de datos, sobre WiFi y bajo demanda. El dispositivo crea un punto de acceso propio; la aplicación se une a él con las credenciales que recibe por BLE y descarga la fotografía por HTTP. El teléfono mantiene su conexión de datos móviles, por lo que puede comunicarse con la nube mientras está unido a la red del dispositivo. Ese comportamiento se verificó con iPhone; en Android, el sistema puede preferir la red WiFi aunque no tenga salida a internet, y no se verificó con el dispositivo [PENDIENTE: confirmar en un teléfono Android].

Sobre la red WiFi se usa HTTP. En la medición de protocolos de la sec. 9.6, MQTT obtuvo un tiempo promedio menor, pero requiere un intermediario (*broker*) que debería ejecutarse en la placa o en el teléfono, y esa medición no permite atribuir la diferencia al protocolo; HTTP no agrega componentes, lo implementan de forma nativa el teléfono y la placa, y su latencia sobre la red del dispositivo, de 46 ms para una fotografía (sec. 7.1.5), no es la que limita el tiempo de una lectura. En este esquema la aplicación es la que solicita los datos: el dispositivo informa que hay una fotografía disponible y la aplicación decide cuándo descargarla. De esta manera el dispositivo se mantiene simple y la recuperación ante un fallo de red queda a cargo de un único componente.

#### Perfil GATT

El dispositivo expone un servicio con identificador 4380c500-7ca3-4e37-b27d-f60e8d8d73d1 y seis características. Los identificadores son de 128 bits y se generaron aleatoriamente, ya que los valores abreviados de 16 bits que suelen aparecer en los ejemplos pertenecen al rango reservado por el Bluetooth SIG y no deben utilizarse en un perfil propio. La Tabla 11 describe cada característica.

Tabla 11: Características del perfil GATT del dispositivo.

| **Característica** | **Propiedades** | **Contenido** |
|---|---|---|
| mode | lectura, notificación, escritura | Entero sin signo de 8 bits: 0 espera, 1 ómnibus, 2 supermercado |
| control | escritura, escritura sin respuesta | Comando en JSON (photo, mode, status, ap, audio con su destino, dispositivo o teléfono, volume, say, hush, restart_camera, measure) |
| event | notificación | Evento en JSON, máximo 180 bytes |
| transfer | notificación | Transferencia binaria fragmentada (en desuso desde el rediseño del enlace) |
| status | lectura, notificación | Estado del dispositivo: versión, temperatura, tiempo de actividad, batería, cámara, red y punto de acceso |
| wifi | lectura | Credenciales del punto de acceso del dispositivo |

El límite de 180 bytes por evento y el fragmento de 182 bytes se derivan de la unidad máxima de transmisión (ATT MTU) que negocia iOS, de 185 bytes, de los cuales tres corresponden a la cabecera del protocolo. El comando hush silencia el parlante del dispositivo cuando está por hablar el teléfono, y restart_camera reabre la cámara si quedó bloqueada (anexo 13.6). El estado del dispositivo se notifica cada 15 segundos.

La definición del perfil existe en el servicio del dispositivo y en la aplicación, y una prueba automatizada falla si ambas copias dejan de coincidir.

### 7.1.5 Transporte de la imagen entre el dispositivo y el teléfono

El diseño original enviaba la fotografía del dispositivo al teléfono por BLE, mediante la característica transfer. Antes de implementarlo se fijó un criterio de aceptación: una imagen de 53.000 bytes debía llegar en menos de 2 segundos, lo que equivale a un caudal de al menos 27 KB/s. El valor surge del tiempo total que se fijó para una lectura en modo supermercado, de 3 a 4 segundos.

Se realizaron cinco transferencias contra un iPhone con la aplicación instalada, con la radio WiFi del dispositivo encendida y apagada (Tabla 12).

Tabla 12: Transferencia de una imagen de 53.000 bytes por BLE, con la radio WiFi del dispositivo apagada y encendida.

| **Condición** | **Corridas (ms)** | **Mediana** | **Caudal** |
|---|---|---|---|
| WiFi del dispositivo apagada | 3.580, 3.660, 4.470, 4.520, 5.010 | 4.470 ms | 11,8 KB/s |
| WiFi del dispositivo encendida | 4.080, 4.260, 4.440, 4.490, 6.150 | 4.440 ms | 11,9 KB/s |

El resultado quedó 2,2 veces por debajo del criterio, y la radio WiFi no influyó en él. El caudal observado es compatible con una notificación de 182 bytes por intervalo de conexión de 15 ms (182 / 0,015 = 12,1 KB/s); la medición no aísla todos los factores limitantes. El controlador de radio de la placa no implementa la extensión de longitud de datos (*Data Length Extension*) y cada paquete de radio transporta 27 bytes útiles. También se probó reducir el tamaño de fragmento a 95 y a 47 bytes, y en ambos casos el caudal empeoró, de modo que el problema no se resolvía ajustando parámetros.

Como alternativa se transfirió el mismo archivo por HTTP sobre la radio WiFi del dispositivo, con una mediana de 46 ms, unas cien veces más rápido. Se decidió entonces mantener BLE como plano de control y usar WiFi como plano de datos (ADR 0003). Con este enlace híbrido, el tiempo estimado de una lectura de supermercado pasó de 6 a 9 segundos a entre 3 y 3,5 segundos. Se trata de una estimación hecha al decidir, sumando los tiempos de cada etapa; los tiempos registrados por la telemetría con el sistema terminado se presentan en la sec. 9.5.

Las mediciones se realizaron sobre una Raspberry Pi Zero 2 W. Entre el 9 y el 18 de septiembre de 2026 el desarrollo continuó sobre una Raspberry Pi 3 B+ prestada, con otro controlador de radio, y las mediciones de radio de ese período no son comparables con estas. Desde el 19 de septiembre el dispositivo volvió a ser una Zero 2 W, con el mismo controlador (BCM43438), por lo que estas cifras vuelven a ser representativas (sec. 7.2.10).

### 7.1.6 Resguardo de las credenciales de nube

En una aplicación Expo, las variables de configuración que usa el código JavaScript se incorporan al binario como constantes, y pueden recuperarse inspeccionando el paquete instalable. Como la aplicación se distribuye mediante un enlace público de pruebas, cualquier clave incluida en ella quedaría expuesta.

Entregar las claves después de un inicio de sesión no era posible, porque la aplicación no tiene cuentas de usuario (sec. 7.5.7). Se optó por un intermediario propio entre la aplicación y los proveedores, implementado como función sin servidor (ADR 0008). La función recibe el cuerpo de la solicitud que ya construyó la aplicación, le agrega la credencial desde el almacén de secretos del servidor y devuelve la respuesta del proveedor sin modificarla. De este modo no es necesario reproducir en el servidor la lógica de cada proveedor, y agregar un modelo sólo requiere un cambio en la aplicación. El intermediario agrega aproximadamente 150 ms al modelo más rápido.

El intermediario no está autenticado, porque la aplicación no tiene inicio de sesión y cualquier clave de acceso estaría igualmente en el binario. Su ventaja es que permite rotar o desactivar una credencial sin publicar una nueva versión de la aplicación. Para limitar el abuso cuenta con una lista de destinos permitidos (que impide redirigir la credencial a un servidor ajeno), un límite de solicitudes por dirección de origen, que se aplica en cada instancia de la función y no de forma global, y un tope de gasto configurado en cada proveedor. En la revisión de noviembre (sec. 9.7.2) se agregaron la validación de la ruta por proveedor, el límite de tamaño del cuerpo y la cancelación de la llamada cuando el teléfono se desconecta.

Hasta noviembre de 2026 existió una excepción a este esquema: la integración continua seguía incorporando a la compilación una clave de Gemini de nivel gratuito, aunque la aplicación ya no la usaba. La segunda revisión de la base de código la detectó y la retiró, y desde el 23 de noviembre de 2026 ninguna versión distribuida lleva credenciales de proveedores (sec. 9.7.5).

## 7.2 El dispositivo

### 7.2.1 Componentes

La Tabla 13 resume los componentes del dispositivo y su estado al cierre del informe.

Tabla 13: Componentes del dispositivo y su estado.

| **Función** | **Componente** | **Estado** |
|---|---|---|
| Cómputo | Raspberry Pi Zero 2 W | En uso; reemplazada por una unidad nueva el 7 de noviembre de 2026 (sec. 7.2.10) |
| Visión | Raspberry Pi AI Camera (sensor Sony IMX500, 12 MP, inferencia en el sensor) | Integrada |
| Entrada | Pulsador en GPIO 5; en la carcasa, pulsador SMD de 4 × 4 × 1 mm con tecla impresa | Integrado |
| Audio | Salida PWM por GPIO (pin físico 12) hacia un amplificador PAM8403, con un filtro RC de dos etapas a la entrada, y de ahí al transductor de conducción ósea de 4 ohmios (ADR 0012) | Integrada y funcionando; queda un ruido residual propio del PWM (sec. 7.2.2) |
| Alimentación | Waveshare UPS HAT (C) con batería LiPo 803040 de 1.000 mAh; interruptor deslizante de panel pegado a la carcasa en lugar de la llave del módulo | Integrada; el nivel de batería llega a la aplicación (sec. 7.2.4) |
| Carcasa | VIA Clara, dos mitades a presión impresas en 3D sobre la patilla, con la copa del auricular aparte | Versión final v0.29, impresa y armada; integrada al repositorio (PR #131, sec. 7.2.8) |

La elección de la Raspberry Pi Zero 2 W y de la cámara se fundamenta en la sec. 4.1. La Raspberry Pi AI Camera (Sony IMX500) se conecta por la interfaz CSI dedicada y ejecuta el detector dentro del sensor, lo que cubre el papel que en el diseño original tenía el acelerador Coral TPU. Con eso el acelerador externo dejó de hacer falta y salió del diseño (ADR 0006, 7 de septiembre de 2026; sec. 7.2.6), con un componente menos y menores costo y consumo. La compra de la AI Camera se decidió para evaluar la potencia del módulo y evitar sumar el Coral TPU al producto final, de modo de obtener un dispositivo más compacto y barato. La Camera Module 3 queda como alternativa evaluada y no se usa.

El sensor tiene enfoque manual y las primeras capturas salieron desenfocadas. El ajuste quedó documentado como paso obligatorio de la puesta en marcha, con una herramienta auxiliar que calcula un puntaje de nitidez mientras se gira el anillo frente a un cartel ubicado a 10 o 20 metros.

### 7.2.2 La salida de audio

La Raspberry Pi Zero 2 W no tiene salida de audio analógica. El sonido sale por modulación de ancho de pulso (PWM, sec. 3.7) redirigida a un pin de propósito general, el pin físico 12 (GPIO 18). Hasta el 12 de noviembre de 2026 salía por el pin 32; se trasladó al 12 porque queda del lado de la tarjeta de memoria, donde la carcasa tiene lugar para componentes adicionales (PR #130). El overlay que habilita esa salida deja además el pin 35 (GPIO 19) configurado como salida, por lo que no puede conectarse nada en él.

El sistema operativo no trata ese pin como una salida de audio con un nivel de línea: lo hace conmutar entre 0 y 3,3 V y codifica el audio en el ancho de los pulsos. Lo que sale del pin es, por lo tanto, una onda cuadrada de amplitud constante, y bajar el volumen cambia el ancho de los pulsos pero no su amplitud. El transductor de conducción ósea, extraído de unos auriculares comerciales, tiene una impedancia de 4 ohmios, y un pin de propósito general entrega como máximo 16 mA, lo que limita a aproximadamente 1 mW la potencia que puede llegarle sin amplificación. Conectado al pin a través de una resistencia y un capacitor se oía, pero con un volumen insuficiente para la calle (sec. 11.2).

Desde el 18 de noviembre la señal pasa por un amplificador clase D PAM8403, alimentado con los 5 V de la placa, que entrega hasta unos 3 W y tiene una ganancia de 24 dB \[109\]. Integrarlo exigió dos correcciones. La primera fue un filtro a la entrada del amplificador, porque la onda cuadrada de 3,3 V lo saturaba a cualquier volumen: el amplificador espera una señal de nivel de línea, y se satura con poco más de medio voltio de pico a pico a la entrada, más de cinco veces menos que la onda del pin (anexo 13.12). El filtro es un pasabajos RC pasivo de segundo orden, formado por dos etapas en cascada (10 kiloohmios y 4,7 nF; 10 kiloohmios y 2 nF), que cumple dos funciones a la vez: recupera el audio eliminando la conmutación del PWM, que queda atenuada en más de 50 dB, y reduce el nivel de la señal que entra al amplificador, porque sus resistencias quedan en serie con la entrada y bajan la ganancia efectiva a unos 17,5 dB. Su corte, de unos 2,1 kHz calculado sin carga y de unos 3,5 kHz con la entrada del amplificador, conserva la inteligibilidad de la voz, como en una llamada telefónica. La Figura 14 muestra el circuito; el cálculo del filtro, su respuesta en frecuencia y los niveles de señal se presentan en el anexo 13.12. La segunda corrección fue que el servicio del dispositivo desconecte el pin cuando no suena nada, porque el PWM sigue conmutando después de cada audio y el amplificador lo convertía en un soplido continuo.

<!-- imagen del Doc: figuras/circuito-audio.png -->

Figura 14: Circuito de la salida de audio del dispositivo: el pin 12 de la placa, el filtro pasabajos RC de dos etapas, el amplificador PAM8403 y el transductor de conducción ósea.

Fuente: elaboración propia, a partir del ADR 0012 (figuras/src/audio_circuit.py).

Con el filtro a la entrada, el volumen del dispositivo se fija al máximo desde la aplicación: el volumen del software cambia cuánta voz va mezclada en la señal, pero no cuánto ruido entra al amplificador, por lo que bajarlo empeora la relación entre ambos. El ruido que queda es ruido de cuantización del PWM, que cae dentro de la banda de la voz y que ningún filtro elimina sin eliminar también la voz; sólo desaparece con una salida digital (sec. 11.2). El proceso completo y los intentos que llevaron a este circuito se registran en el ADR 0012 y se resumen en la sec. 7.2.10.

### 7.2.3 El servicio del dispositivo

El software del dispositivo es un servicio en Python de 4.981 líneas repartidas en 22 archivos (recuento del 9 de noviembre de 2026 sobre hardware/raspi/), cubierto por 220 pruebas automatizadas al 23 de noviembre de 2026 (sec. 9.7.1). Su diseño separa un núcleo independiente del transporte, que conoce los comandos, los modos y las transferencias, de los adaptadores que lo conectan con el exterior: el periférico BLE sobre BlueZ, el servidor HTTP, la cámara y el audio.

Esa separación permitió construir un emulador que ejecuta el mismo núcleo sobre la pila Bluetooth de macOS. Con él se pudo desarrollar y probar la aplicación contra un dispositivo simulado, sin depender de que la placa estuviera disponible, lo que resultó importante en los períodos en que la placa estuvo dañada (sec. 7.2.10).

El servicio expone un servidor HTTP en el punto de acceso propio, con cinco rutas: consulta de estado, generación de datos de prueba, captura y entrega de la última fotografía (1024 píxeles de lado mayor y calidad 70, unos 35 KB en 200 a 235 ms incluyendo la captura), recepción de audio para reproducir y entrega de la evidencia del modo ómnibus (sec. 7.3.9). Esta última ruta es una herramienta de desarrollo y se retirará antes de la versión final, porque se trata de fotografías de la vía pública que incluyen personas.

El 5 de octubre de 2026 el dispositivo dejó de ser visible desde el teléfono. La causa fue un bloqueo por software del Bluetooth que el sistema guardaba y restituía en cada arranque, de modo que el servicio se reiniciaba sin llegar nunca a anunciarse. La corrección llevó a revisar el arranque completo con un criterio: el teléfono sólo encuentra al dispositivo cuando éste anuncia, por lo que nada debe demorar ese anuncio. El servicio levanta el bloqueo antes de iniciar, depende sólo de la pila Bluetooth (ya no espera a la red), registra el perfil y anuncia, y recién después inicia la cámara y el punto de acceso. También se eliminaron componentes del sistema que sólo servían en el primer arranque, una comprobación del servidor DHCP que agregaba 3 segundos en cada conexión del teléfono y una importación de la biblioteca de visión que detenía el servicio durante 13 segundos; el reconocedor de texto pasó a cargarse en un proceso aparte. Los tiempos, medidos sobre la Zero 2 W desde el arranque del núcleo del sistema operativo, se presentan en la Tabla 14.

Tabla 14: Tiempos de arranque del dispositivo antes y después de reorganizar el servicio.

| **Hito** | **Antes** | **Después** |
|---|---|---|
| El dispositivo anuncia por BLE | 27,0 s | 16,2 s |
| Punto de acceso disponible | ~29 s | 21,7 s |
| Cámara con el detector lista | 31,4 s | 21,3 s |
| Reconocedor de texto listo (modo ómnibus operativo) | 44,0 s | 33,6 s |

Fuente: bitácora del proyecto, 6 de octubre de 2026.

Con el arranque nuevo el teléfono se conectó 0,3 segundos después del primer anuncio. Si el usuario activa el modo ómnibus antes de que el reconocedor esté listo, el dispositivo dice “preparando la lectura” y comienza a vigilar cuando puede.

Las opciones de ejecución se guardan en un archivo de configuración del sistema, fuera del paquete del servicio, para que se conserven tanto en las actualizaciones como al cambiar entre los dos modos de operación del dispositivo (sec. 7.2.5).

Desde septiembre el dispositivo arranca con el emparejamiento Bluetooth deshabilitado. Ninguna característica del perfil requiere autenticación, por lo que la aplicación no necesita un vínculo persistente, y deshabilitarlo evita los diálogos de emparejamiento que el teléfono mostraba al usuario. La red local del dispositivo usa una clave fija y su servidor HTTP no está autenticado; con una única unidad y sin un adversario plausible en el alcance de la tesis, el equipo aceptó ese riesgo para el prototipo y dejó como trabajo futuro una clave por unidad y un token por sesión (ADR 0003, actualización del 3 de noviembre de 2026; sec. 6.7).

### 7.2.4 Energía y autonomía

El consumo se estimó a partir de mediciones de terceros sobre el mismo hardware y está pendiente de verificación con instrumental propio (Tabla 15). La Tabla 16 estima, a partir de él, la autonomía con dos baterías posibles.

Tabla 15: Consumo estimado del dispositivo.

| **Estado** | **Consumo estimado** |
|---|---|
| Espera (BLE anunciando, sin video) | 0,5 a 0,6 W |
| Activo (cámara, punto de acceso y detección en el sensor) | 2 a 3 W, pico ~0,6 A |
| Amplificador de audio PAM8403 (hoja de datos, ADR 0012) | ~50 mW en reposo (10 mA a 5 V), más lo que entrega al hablar, que crece con el volumen |

Tabla 16: Autonomía estimada según la batería.

| **Celda** | **Dimensiones** | **Autonomía estimada** |
|---|---|---|
| LiPo 1.000 mAh (incluida con el módulo; la que aloja la carcasa) | 40 × 30 × 8 mm, ~20 g | 1,5 a 2 h |
| LiPo 2.000 mAh (mejora posible) | 50 × 34 × 10 mm, ~36 g | 3 a 4 h |

El nivel de batería se lee desde el 6 de octubre de 2026. El módulo de alimentación incorpora un monitor INA219, que el dispositivo lee por I2C (bus 1, dirección 0x43, confirmada escaneando el bus). Se lee la tensión de la celda; el porcentaje se obtiene de la curva de descarga de una batería LiPo y se suaviza para que no oscile con la carga. El valor viaja en el estado del dispositivo por BLE y la aplicación lo muestra y lo anuncia. Para un usuario que no puede consultar un indicador luminoso, conocer el nivel de batería por voz es un requisito de accesibilidad.

Falta instrumentar la línea de alimentación con un medidor en serie para reemplazar las estimaciones de las Tablas 15 y 16 por mediciones propias y obtener la autonomía real.

### 7.2.5 Los dos modos de operación del dispositivo

El dispositivo terminado consiste en unos lentes con un botón: no tiene teclado ni pantalla, ni una persona que administre su red. Durante el desarrollo, en cambio, el mismo hardware debe ser accesible para instalar versiones nuevas, depurar y medir. Ambas exigencias son incompatibles sobre una única radio: en el uso normal la placa crea su propio punto de acceso, al que se une el teléfono, y mientras ese punto de acceso está activo la placa no está conectada a ninguna otra red, por lo que no es accesible de forma remota.

Dejar el dispositivo siempre en un modo de desarrollo habría sido más cómodo, pero las mediciones no habrían correspondido al producto. Se optó por un interruptor explícito, cuyos dos estados se describen en la Tabla 17.

Tabla 17: Modos del dispositivo según el interruptor de la tarjeta de memoria.

| **Estado del interruptor** | **Modo** | **Consecuencia** |
|---|---|---|
| Presente | Desarrollo | La placa se une a una red conocida. Hay acceso remoto e internet. La aplicación informa “red apagada” |
| Ausente | Producto | La placa crea su punto de acceso al arrancar (ADR 0003). No hay acceso remoto por la red doméstica |

El interruptor es un archivo en la partición de arranque de la tarjeta de memoria, que usa el sistema de archivos FAT y puede leerse y escribirse desde cualquier computadora sin herramientas especiales. Esta elección surgió después de que el equipo perdiera el acceso a la placa en más de una ocasión: un dispositivo sin pantalla debe poder configurarse sin entrar en él. En cada arranque un servicio lee el interruptor y genera la configuración con la que inicia el servicio principal, por lo que esa configuración no se edita a mano.

El enlace de control funciona igual en los dos modos, de modo que el dispositivo puede comunicarse con el teléfono aun cuando hay un problema de red. Como contrapartida, desde el teléfono ambos modos se ven iguales: en una ocasión una placa que el equipo creía en modo desarrollo estaba en modo producto y no había forma de advertirlo desde la aplicación.

En modo producto, el dispositivo sólo puede actualizarse desde la tarjeta o a través del enlace de control, y esa restricción dio forma al procedimiento de despliegue descrito en la sec. 8.7. Como vía intermedia, se incorporó una herramienta que apaga el punto de acceso a través del enlace de control; la placa vuelve entonces a la red conocida y queda accesible sin abrir el dispositivo. La operación completa demora unos cinco segundos.

### 7.2.6 Inferencia en el sensor de la cámara

El diseño original incluía un acelerador Coral TPU conectado por USB \[43\], sobre el cual se ejecutaría el detector en formato TensorFlow Lite. Durante el desarrollo se incorporó la Raspberry Pi AI Camera, cuyo sensor Sony IMX500 ejecuta un modelo de detección dentro del propio sensor. El modelo convertido ocupa 2,64 MB y, con el entorno de ejecución del sensor, la ocupación total es de 7,12 MB sobre 8 MB (90%) \[37\], \[38\]; el sensor procesa 15 cuadros por segundo sin usar procesador ni memoria de la placa.

Se decidió retirar el Coral del diseño (ADR 0006, enmienda del 7 de septiembre de 2026). Con ello se eliminó un componente, su costo y su consumo, y se liberó el único puerto USB de la placa. El formato TensorFlow Lite se reemplazó por ONNX y por el formato propio del sensor. La decisión es especialmente relevante en la Zero 2 W, que dispone de unos 415 MB de memoria útil: al no ocupar memoria ni procesador con la detección, la placa queda disponible para el recorte y el OCR.

El procesador de imagen de la placa permite además recortar la zona del sensor que se entrega como imagen sin modificar lo que observa el detector, que sigue viendo el campo completo. Sobre esa propiedad se construyó en octubre un zoom digital sobre el cartel (sec. 7.3.10).

La ocupación del 90% del chip tiene una consecuencia: en el sensor cabe un único modelo, lo que condicionó la elección del detector (sec. 7.3.5).

### 7.2.7 Calibración de la interacción física

Los tiempos iniciales del botón se tomaron de las convenciones de interfaces de escritorio y provocaban errores en el reconocimiento de los gestos; en particular, el doble clic se confundía con un clic simple. Se ajustaron como muestra la Tabla 18.

Tabla 18: Tiempos del botón antes y después de la calibración.

| **Constante** | **Antes** | **Ahora** | **Fundamento** |
|---|---|---|---|
| Antirrebote | 50 ms | 15 ms | Con 50 ms el doble clic se interpretaba como uno solo; 15 ms cubre el rebote mecánico del pulsador utilizado |
| Ventana de doble clic | 0,4 s | 0,6 s | 0,4 s es el valor habitual para un ratón; el gesto sobre un dispositivo montado en la sien es más lento |
| Umbral de pulsación larga | 0,8 s | 0,8 s | Sin cambios |

Con los valores nuevos se realizaron treinta gestos consecutivos (once dobles, diez simples y nueve largos) sin errores de reconocimiento. En la misma sesión, el primer doble clic desde el estado de espera cambió de modo y descargó la fotografía en 164 ms.

Estos tiempos fueron calibrados por personas videntes y con un pulsador distinto del que lleva la carcasa. El ajuste definitivo requiere las pruebas con usuarios ciegos previstas para la etapa final.

### 7.2.8 La carcasa

La carcasa debe alojar el conjunto real de componentes sobre la patilla de unos lentes, cerrarse sin tornillos para poder abrirla durante el desarrollo, proteger el cable plano de la cámara, dejar accesibles el encendido y la carga, y ofrecer un único botón que pueda encontrarse al tacto. Para quien la usa, que no puede ver dónde está el botón ni de qué lado está el encendido, la forma de la carcasa es parte de la accesibilidad del sistema.

Se partió de un modelo base de terceros [PENDIENTE: autor, fuente y licencia del modelo base, con su cita en la bibliografía], que el repositorio conserva como versión de partida (v0.8), y se rediseñó como modelo paramétrico en OpenSCAD (proyecto “VIA Clara”, en hardware/case-via-clara/). Las dos mitades de la versión final miden 89,2 × 28,5 × 39,8 mm, sin contar el brazo que sostiene el transductor. Todo el conjunto, con la batería, las placas, la cámara y el transductor, va en una sola patilla, por lo que su peso condiciona la comodidad en un uso prolongado [PENDIENTE: peso del dispositivo armado, medido con balanza]. Cada medida exterior se deriva de las del conjunto interior, de modo que corregir una medida real actualiza toda la carcasa. El conjunto, de la cara que apoya en la cabeza hacia afuera, está formado por las cabezas de los tornillos bajo el módulo de alimentación, el módulo, la batería de 40 × 30 × 8 mm, la Raspberry Pi Zero 2 W y, sobre ella, el conector de pines soldado y los separadores hexagonales. El cuerpo son dos mitades unidas por trabas a presión. Cada traba es una viga que corre a lo largo de la junta, dentro de la pared, y flexiona en el plano de la cama de impresión y no a través de las capas, que es la dirección en la que una pieza impresa se rompe. Completan el diseño un brazo que sostiene el transductor de 14 mm contra la cabeza, con una tapa que se fija a presión, dos puentes para un elástico plano de 6 mm y el botón, rodeado por un anillo en bajorrelieve.

Las Figuras 15, 16, 17 y 18 muestran la versión final desde sus dos caras, el interior de la mitad externa y el despiece con los componentes.

<!-- imagen del Doc: figuras/carcasa-exterior.png -->

Figura 15: Carcasa VIA Clara v0.29, cara externa: el botón de modos con su anillo, la nariz que aloja la cámara y, en el extremo trasero, la ranura de la tarjeta de memoria, la carga y la ranura para abrir.

Fuente: elaboración propia, a partir del modelo en OpenSCAD (hardware/case-via-clara/).

<!-- imagen del Doc: figuras/carcasa-cara-cabeza.png -->

Figura 16: Carcasa VIA Clara v0.29, cara que apoya en la patilla: el lente de la cámara, la ventana del interruptor de encendido con su punto en relieve, los puentes para el elástico y el brazo con el transductor de conducción ósea.

Fuente: elaboración propia, a partir del modelo en OpenSCAD (hardware/case-via-clara/).

<!-- imagen del Doc: figuras/carcasa-interior.png -->

Figura 17: Interior de la mitad externa: las vigas y los ganchos de las trabas a presión, los alojamientos hexagonales de los separadores, los nervios de la cámara, el recorrido del cable plano y el bolsillo del pulsador.

Fuente: elaboración propia, a partir del modelo en OpenSCAD (hardware/case-via-clara/).

<!-- imagen del Doc: figuras/carcasa-despiece.png -->

Figura 18: Despiece de la carcasa con los componentes: las dos mitades, la cámara, el módulo de alimentación con la batería, la Raspberry Pi Zero 2 W, el pulsador con su tecla y el brazo del transductor.

Fuente: elaboración propia, a partir del modelo en OpenSCAD (hardware/case-via-clara/).

El principal problema fue que las verificaciones del modelo se hacen contra maquetas de los componentes, y cada impresión mostró algo que las maquetas no tenían. La carcasa avanzó, por lo tanto, en ciclos de impresión, armado y corrección. La Tabla 19 resume la secuencia (bitácora del proyecto, 14 de octubre a 12 de noviembre de 2026).

Tabla 19: Versiones de la carcasa: lo que mostró cada impresión y el cambio que motivó.

| **Versión** | **Lo que mostró la impresión o el armado** | **Cambio en la versión siguiente** |
|---|---|---|
| v0.8 | Sin imprimir; suponía un conjunto de 16,5 mm de espesor, frente a los ≈ 23 mm reales | v0.9 rehecha sobre el conjunto real |
| v0.9 (14 de octubre) | Encajó casi todo, pero los separadores estaban del lado de la placa, la tarjeta de memoria no entraba, las paredes eran más gruesas de lo necesario y la imagen salía girada 90° | Paredes de 1,6 mm; cámara girada en su plano |
| v0.10 (17 de octubre) | Falló: guías de la cámara de 0,65 mm que la impresora no reproduce, botón sobre el disipador de la placa, ranura de la tarjeta en espejo, pernos traseros que se rompían | Medidas tomadas con calibre; ningún detalle funcional menor a 1,2 mm; trabas traseras en lugar de pernos |
| v0.11 (21 de octubre) | Se probaron dos variantes; la de tapa separada exigía demasiados ajustes. En la integrada el lente no entraba y las trabas delanteras, unidas a las guías de la cámara, no flexionaban y se partieron | Se descarta la variante con tapa; trabas delanteras detrás de las guías |
| v0.12 a v0.15 (22 a 26 de octubre) | Piezas de prueba parciales: la ranura de la cámara, el paso del cable plano y el tamaño real de los separadores hexagonales (5,0 mm entre caras) | Alojamientos hexagonales huecos; copa redonda para el auricular; botón como cilindro pegado al pulsador |
| v0.16 a v0.19 (26 a 29 de octubre) | Los alojamientos levantaban la placa y las mitades no cerraban; el transductor no entraba en la copa | Alojamientos 2 mm más profundos; copa de 17 mm; la llave del módulo y la corredera impresa se reemplazan por un interruptor deslizante de panel, cuyos pernos de fijación se midieron con piezas de prueba |
| v0.20 (30 de octubre) | Impresa y armada con todo el hardware; el ajuste fue correcto, pero la fotografía salía girada 90° respecto de la vista del usuario | Se integra al repositorio con los archivos de impresión de todas las versiones (PR #124) |
| v0.21 y v0.22 (1 de noviembre) | Dos alternativas para corregir la orientación: girar la carcasa entera o girar sólo la cámara | Se elige girar sólo la cámara (v0.22) |
| v0.23 y v0.24 (5 de noviembre) | El cable plano de la cámara necesitaba espacio para enrollarse y la tapa del auricular no fijaba | Cámara 2 mm más lejos de las placas; tapa 1,5 mm más alta; ranura de la tarjeta corrida 1 mm. La v0.24 se imprimió con buen resultado |
| v0.25 (9 de noviembre) | Los conectores de la placa sobresalen 2,0 mm y no 0,8; la patilla del lente pasaba sobre el brazo del auricular | Carcasa más alta (39,8 mm); botón centrado; alojamientos de 5,5 mm; brazo y elástico reubicados; trabas más anchas |
| v0.26 (9 de noviembre) | La patilla todavía tocaba el brazo | 11 mm entre el elástico y el brazo, el máximo que admite la cara plana; se integra al repositorio (PR #129) |
| v0.27 (10 de noviembre) | Se separa la copa del auricular del brazo, para imprimirla como pieza aparte | Copa que se encastra en el brazo, con un canal interno para el cable; impresa con buen resultado salvo el encastre |
| v0.28 (11 de noviembre) | El encastre entre el brazo y la copa de la v0.27 quedaba flojo | Por error se supuso lo contrario y el enchufe se achicó a 5,1 mm, con lo que quedó todavía más flojo |
| v0.29 (12 de noviembre) | Se probaron enchufes de 5,8, 6,0 y 6,2 mm; el de 6,0 mm calzó correctamente | Versión final: impresa y armada con el enchufe de 6,0 mm; se integra al repositorio (PR #131) |

La comparación de tres versiones de la misma mitad, vistas desde el mismo ángulo, resume esa evolución (Figura 19): la v0.9 tenía alojamientos redondos para los separadores y un perfil sin la nariz de la cámara; la v0.20 incorporó los alojamientos hexagonales y la nariz de la cámara; la v0.29 es más alta, para los conectores que sobresalen de la placa, y suma el bolsillo del pulsador.

<!-- imagen del Doc: figuras/carcasa-versiones.png -->

Figura 19: Evolución de la carcasa: las dos mitades de las versiones v0.9, v0.20 y v0.29, desde el mismo ángulo. Cada imagen está ajustada a su cuadro, por lo que los tamaños no son comparables entre sí.

Fuente: elaboración propia, a partir de los archivos de impresión de cada versión (hardware/case-via-clara/versions/).

Varios hallazgos de esa secuencia significaron cambios en el diseño y no sólo un cambio de medida.

El primero fue la orientación de la cámara. Con la v0.20 armada y colocada en la patilla, la fotografía salía girada 90° respecto de la vista del usuario. En una cámara convencional bastaría con girar la imagen por software, pero en este sistema el detector YOLO se ejecuta dentro del sensor IMX500, sobre la imagen tal como la capta el sensor, antes de que llegue a la placa. El sensor permite invertir la imagen pero no girarla 90°, y girar la imagen en la placa no cambiaría lo que ve el detector. La cámara, por lo tanto, no podía quedar de costado: su orientación física dentro de la carcasa tenía que coincidir con la vista del usuario. Se imprimieron dos alternativas, girar la carcasa completa (v0.21) o girar sólo la cámara un cuarto de vuelta en su plano (v0.22), y se eligió la segunda porque conservaba el resto del diseño ya validado. El cable plano pasó a bajar por el piso de la carcasa y subir frente a la placa, y la v0.23 le dejó 2 mm más de espacio para enrollarse.

El segundo fue el encendido. El módulo de alimentación trae su propia llave deslizante, soldada sobre la placa y alejada de la pared de la carcasa. En las primeras versiones se la alcanzó con una corredera impresa que llevaba la palanca hasta una ventana, pero era una pieza más, frágil y difícil de ajustar. Se optó por desconectar la llave del módulo y cablear en su lugar un interruptor deslizante de panel, que se pega del lado de adentro de la pared con la perilla asomando por una ventana de 4,2 × 7,4 mm. La carcasa incorpora dos pernos de 2,3 mm, separados 14,8 mm, que entran en los agujeros de la pestaña del interruptor y lo ubican antes de pegarlo; esas medidas se ajustaron con cinco piezas de prueba (v0.18 a v0.20).

El tercero fue la resolución de la impresora: ningún detalle funcional baja de tres líneas de extrusión (1,2 mm), porque un nervio de 0,65 mm no se reprodujo aun con la máxima calidad. El cuarto fue el pulsador: el real es un SMD de 4 × 4 × 1 mm con un actuador de menos de 1 mm, por lo que lleva encima una tecla impresa.

El quinto fue el espacio interior. La primera versión suponía un conjunto de 16,5 mm de espesor y el real resultó de unos 23 mm; desde entonces cada medida exterior se deriva del conjunto medido y no de una estimación. Aun así, el espacio se ganó de a décimas: los conectores de la placa sobresalen 2,0 mm de su borde y no los 0,8 mm supuestos, lo que obligó a subir la carcasa a 39,8 mm; el cable plano de la cámara necesitó 2 mm más para enrollarse sin forzar el conector; y la patilla del lente pasaba por encima del brazo del auricular hasta que el elástico y el brazo quedaron separados 11 mm, el máximo que admite la cara plana. El último componente en entrar fue el amplificador de audio con su filtro (sec. 7.2.2), que no estaba previsto en el diseño: se ubicó en el hueco junto al conector de pines, del lado de la tarjeta de memoria, con la primera resistencia del filtro en el cable, cubierta con termocontraíble, y entró con muy poco margen.

El sexto fueron las trabas a presión, que deben cerrar con un clic firme, abrirse para el desarrollo y no romperse. En la v0.11 las trabas delanteras quedaron pegadas a las guías de la cámara, no podían flexionar y se partieron al cerrar; se reubicaron detrás de las guías. En la v0.23 la tapa del auricular no llegaba a encastrar y se subió 1,5 mm. En la v0.25 los ganchos se ensancharon a 7 y 5 mm y su diente pasó a 0,5 mm, para un cierre más firme. La impresión también influye en el clic: la mitad impresa boca abajo pierde definición en el borde de la junta y sus trabas enganchan peor, lo que llevó a los ajustes de impresión que se describen al final de esta sección. El brazo del transductor y su copa, que desde la v0.27 son piezas separadas, siguieron el mismo camino con el encastre entre ambos: se imprimieron tres enchufes de prueba de 5,8, 6,0 y 6,2 mm y se eligió el de 6,0 mm, que calzó sin juego.

Un guion (export.sh) regenera las piezas, las imágenes y una guía de armado, y comprueba que cada pieza imprimible sea un único sólido apoyado en la cama. Ejecuta además verificaciones de interferencia entre volúmenes: las mitades entre sí, cada mitad contra placas, batería, interruptor, cámara, pulsador, tornillos y separadores, el recorrido del cable plano, el brazo y los caminos de armado, y no sólo la posición final. El guion falla si alguna verificación detecta una interferencia. Su alcance está limitado por las maquetas: una verificación contra una medida supuesta no garantiza nada sobre la pieza real, y eso fue lo que hizo fallar la v0.10.

Las primeras versiones se imprimieron en una Creality Ender 3 V3 y las siguientes, incluida la versión final, en una FLSUN T1 Max. El cambio se debió a la calidad de las piezas: la FLSUN dio bordes más definidos, mejor terminación superficial y soportes que se retiran con menos marcas, lo que importa en una pieza chica, con trabas y ranuras de pocas décimas de milímetro de juego. Las piezas se imprimen en PLA. La superficie exterior se imprime con textura (*fuzzy skin*), que mejora el agarre y disimula las líneas de capa; la mitad externa se imprime boca arriba. La mitad interna se imprime boca abajo, lo que da un exterior más prolijo pero hace que el borde de la junta pierda definición y que las trabas enganchen peor; por eso se recomendó quitar la textura en los primeros 3 mm y compensar el ensanchamiento de la primera capa (0,2 mm).

El equipo sometió el modelo al flujo de revisión multimodelo tackle-ticket, en el que revisores basados en distintos modelos (Opus, Sonnet, Haiku y Codex) examinan el mismo cambio por separado. En la v0.9 la revisión llevó las trabas al plano de la cama de la impresora 3D, reservó el volumen del cable plano de la cámara, que no tenía por dónde pasar, y agregó las verificaciones de los caminos de armado; en la v0.11 encontró que los apoyos que debían sujetar el conjunto no lo tocaban y que el lente no pasaba por el plano de la junta.

Los archivos de impresión de las versiones v0.9 a v0.29 están en el repositorio (hardware/case-via-clara/versions/). Con la carcasa final armada, queda pendiente verificar con ella los tiempos del botón (sec. 7.2.7).

### 7.2.9 Desglose de costos

Si bien durante el desarrollo del proyecto se adquirieron y evaluaron distintos componentes de hardware para determinar su viabilidad y adecuación a los requerimientos del dispositivo, el desglose de costos contempla exclusivamente los elementos que forman parte de la versión final del prototipo. Por lo tanto, no se incluyen los gastos asociados a componentes que fueron descartados durante las etapas de investigación y experimentación, ya que estos no serían necesarios para reproducir el dispositivo.

Asimismo, se excluyen los costos asociados al entrenamiento de los modelos de reconocimiento por visión artificial utilizados, dado que estos ya se encuentran entrenados y su implementación únicamente requiere la carga de los modelos desarrollados. Por último, en lo que respecta a la fabricación mediante impresión 3D, se considera únicamente el costo de impresión del diseño definitivo, sin contabilizar las impresiones realizadas durante las iteraciones de diseño y prueba.

De esta manera, se obtiene una estimación del costo de reproducción del prototipo final, que servirá como referencia para su comparación con las soluciones existentes en las conclusiones (cap. 10). Los precios son los que pagó el equipo en Uruguay, y no se incluyen las piezas menores (tarjeta microSD, resistencia, capacitor, interruptor, pulsador y cables). La Tabla 20 presenta el desglose.

Tabla 20: Costo de reproducción del prototipo final.

| **Elemento** | **Costo (USD)** |
|---|---|
| Raspberry Pi Zero 2 W | 99,95 |
| Raspberry Pi AI Camera | 75,95 |
| Waveshare UPS HAT (C) | 23,99 |
| Transductor de conducción ósea | 10,37 |
| Impresión de la carcasa | 0,86 |
| TOTAL | 211,12 |

### 7.2.10 Fallas de hardware durante el desarrollo

Varias fallas de hardware condicionaron el trabajo y se registran porque explican algunas de las mediciones de este capítulo.

El conector de cámara de la primera Raspberry Pi Zero 2 W se dañó en septiembre de 2026. Entre el 9 y el 18 de septiembre el desarrollo continuó sobre una Raspberry Pi 3 B+ prestada, con el mismo sistema operativo y la misma interfaz de cámara pero con otro controlador de radio. Desde el 19 de septiembre se volvió a una Zero 2 W. Las cifras tomadas sobre la Pi 3 B+ se identifican como tales donde aparecen. La placa actual no tiene puerto Ethernet y su WiFi opera sólo en 2,4 GHz, lo que obligó a definir las vías de acceso descritas en la sec. 8.7.

El 28 de octubre, al cerrar la carcasa, el sensor de la cámara se desconectó de su propio módulo (el conector pequeño entre el sensor y la placa de la cámara, no el cable plano). El síntoma era que la placa dejaba de detectar la cámara. Volver a asentar el conector lo resolvió, y se tuvo en cuenta en las versiones siguientes de la carcasa para que no presione esa zona.

A comienzos de noviembre la Zero 2 W en uso volvió a dañarse y se reemplazó por una nueva. Como la tarjeta de memoria era la misma, la placa nueva arrancó con toda la configuración y el servicio instalado, y el sistema volvió a funcionar desde la aplicación, incluida la lectura de supermercado. La única diferencia fue el audio: el 7 de noviembre el transductor, conectado al pin 32 con una resistencia de 100 ohmios y sin capacitor, sólo emitía un pitido apenas perceptible. Se descartó una causa de software (la configuración de audio estaba cargada, el pin entregaba la señal PWM y la reproducción no daba errores en ninguno de los dos canales). Al medir el transductor resultó ser de 4 ohmios y no de 16 a 32, como se había supuesto: con 100 ohmios en serie le llegaba aproximadamente el 4% de la tensión, y el pico de corriente, de unos 32 mA, duplicaba el límite del pin. El 12 de noviembre se probó un circuito con 260 ohmios y 47 µF en el pin 12: la voz se oye y se entiende, pero sólo con el transductor apoyado y en un ambiente silencioso. Las potencias son calculadas y el volumen se evaluó de oído, sin medición de nivel sonoro. El límite no depende del valor de los componentes sino de la corriente que puede entregar un pin, y se analiza en la sec. 11.2. El 18 de noviembre se incorporó un amplificador PAM8403. Conectado directamente al pin, el audio salía saturado y, al terminar cada reproducción, quedaba un soplido fuerte y continuo. El soplido posterior se eliminó desconectando el pin entre audios desde el servicio del dispositivo. Para la saturación se probaron, en orden, una resistencia de 10 kiloohmios en serie (insuficiente), una de 20 kiloohmios (sin saturación, pero con la voz lejana y un soplido fuerte durante todo el audio, porque la resistencia atenúa por igual la voz y el ruido) y la misma resistencia con un capacitor de 1 nF a masa (mejora notable, con soplido audible). El circuito que quedó es un filtro de dos etapas, con el volumen del dispositivo al máximo; se montó sin placa, con la primera resistencia en el cable cubierta con termocontraíble y el resto soldado sobre el módulo, y entró en la carcasa con muy poco margen. El detalle de cada intento está en el ADR 0012.

## 7.3 El pipeline de reconocimiento de líneas de ómnibus

Este pipeline es el componente de mayor complejidad técnica del proyecto y el único que se desarrolló en un repositorio propio (bus-banner-recognizer), porque su ciclo de trabajo (construir el conjunto de datos, entrenar, evaluar y exportar) es independiente del de la aplicación. El dispositivo lo utiliza como una dependencia instalable.

### 7.3.1 Estructura general

La Figura 20 muestra los pasos del pipeline, del cuadro que entrega la cámara al anuncio de voz: el detector localiza el ómnibus y su cartel dentro del sensor, la placa recorta el cartel con márgenes, el OCR lo lee, el catálogo de líneas valida la lectura y el dispositivo reproduce los audios pregrabados.

<!-- imagen del Doc -->

Figura 20: Los pasos del pipeline de reconocimiento de líneas de ómnibus, del cuadro de la cámara al anuncio de voz.

Fuente: elaboración propia.

El cartel se recorta antes de leerlo porque, si el OCR recibiera el cuadro completo, leería también la matrícula, los carteles laterales y la publicidad del vehículo, y sería necesario decidir cuál de esos textos corresponde a la línea. El recorte reduce ese problema de interpretación a un problema geométrico.

Cuando hay varios vehículos en el cuadro se selecciona el de mayor área, que es el más cercano, y ante áreas equivalentes el más centrado. De esta forma, el criterio de priorización planteado como objetivo del proyecto se resuelve a partir de la geometría de las cajas delimitadoras.

El cartel frontal que contiene número y destino es una franja ancha, por lo que se exige una relación de aspecto mínima de 2,0 y se lo busca en la mitad superior del vehículo. El umbral se fijó por inspección de los carteles de Montevideo, en los que la franja frontal es varias veces más ancha que alta, y no a partir de una medición sobre el conjunto de datos [PENDIENTE: medir la distribución de la relación de aspecto de las cajas de cartel del conjunto de entrenamiento]. Esa condición descarta los carteles cuadrados (los que sólo muestran el número y los laterales), que no se quieren leer.

### 7.3.2 Procesamiento local del modo ómnibus

El modo ómnibus es el más sensible a la latencia, porque un anuncio que llega cuando el ómnibus ya pasó no tiene utilidad. Es además el que con mayor probabilidad se usa sin cobertura: una parada a la intemperie, y en particular las zonas periféricas de Montevideo y las localidades del interior, donde la cobertura de datos móviles es más débil. Por eso el ADR 0001 lo mantiene como procesamiento local. Esas mismas zonas son las que presentan carteles más difíciles para el sistema, porque muchas de sus líneas se identifican con códigos que combinan letras y números (sec. 7.3.13).

En la placa, la línea se anuncia entre 1,3 y 1,6 segundos después del gesto o de la detección, según el punto desde el que se mida, con lecturas de OCR de entre 583 y 1.006 ms; las mediciones se presentan en la sec. 9.4.3.

La detección se ejecuta dentro del sensor de la cámara y no consume procesador de la placa: el sensor entrega cajas delimitadoras a 15 cuadros por segundo mientras la placa realiza el recorte y el reconocimiento de texto.

El mayor costo del procesamiento local es el arranque. En la Pi 3 B+ el modo ómnibus quedaba operativo 47 segundos después de un reinicio en frío, de los cuales 40 correspondían a la carga de los modelos de OCR. En la Zero 2 W, después de reorganizar el arranque (sec. 7.2.3), el dispositivo anuncia por BLE a los 16,2 segundos, la cámara está lista a los 21,3 y el OCR a los 33,6, contados desde el arranque del núcleo del sistema operativo. Los modelos se cargan al arrancar y no al presionar el botón, porque si se cargaran con el gesto la primera respuesta demoraría unos 40 segundos más, y el usuario la percibiría como una falla.

### 7.3.3 El conjunto de entrenamiento y el catálogo de líneas

El conjunto de entrenamiento del detector fue construido y etiquetado manualmente por Magalí Dellapiazza en la plataforma Roboflow (versión 6 del conjunto find-bus-sign). La Tabla 21 resume sus propiedades.

Tabla 21: Propiedades del conjunto de entrenamiento del detector (versión 6 de find-bus-sign).

| **Propiedad** | **Valor** |
|---|---|
| Imágenes totales | 140 |
| Partición | entrenamiento 98 · validación 28 · prueba 14 |
| Clases | 1 (bus_sign) |
| Formato de anotación | YOLOv11 |
| Preprocesamiento | Reorientación automática, redimensión a 640×640 |
| Aumentación en el export | Ninguna |
| Licencia declarada en Roboflow | Dominio público (Public Domain) |

Para el detector de dos clases (sec. 7.3.5) se necesitaba además la clase bus. En lugar de volver a etiquetar a mano las 140 imágenes, las cajas de ómnibus se generaron por pseudoetiquetado con un modelo YOLO11x preentrenado sobre COCO, que ya incluye la categoría bus, y se revisaron manualmente una por una. Se conservó la misma partición. Para el reentrenamiento en GPU (sec. 7.3.4) el conjunto se amplió a 395 fotografías, en la versión 7 del mismo proyecto de Roboflow. La partición de esa versión en entrenamiento, validación y prueba no quedó registrada en el repositorio [PENDIENTE: recuperar la partición de la versión 7 desde Roboflow]. La licencia de la Tabla 21 es la que el proyecto declara en Roboflow; el origen de cada fotografía no quedó registrado. El conjunto con el que se evaluó el pipeline completo es otro, independiente de éste, y se describe en la sec. 9.2.

Se construyó además un catálogo de líneas a partir de los datos abiertos del Sistema de Transporte Metropolitano de la Intendencia de Montevideo \[75\] (data/catalog_stm.csv): 504 filas con 257 destinos distintos, de las cuales 502 son pares de número y destino entre 145 números de línea y las dos restantes son carteles sin línea (COCHE ESCUELA y FUERA DE SERVICIO). El catálogo se usa para corregir la salida del OCR, para decidir qué se puede anunciar y completar la parte del cartel que no se leyó (sec. 7.3.8), y para generar los anuncios pregrabados (sec. 7.3.12).

### 7.3.4 El entrenamiento del detector

El detector es un YOLO11n ajustado por aprendizaje por transferencia (*fine-tuning*) a partir de los pesos preentrenados sobre COCO. La familia YOLO11 ofrece cinco tamaños (sec. 3.3.2); se eligió el más pequeño, nano, porque es el único que entra en la memoria del sensor de la cámara una vez convertido.

La Tabla 22 es la configuración escrita en el script de entrenamiento del repositorio, con la justificación de cada valor. La corrida en la V100 no la aplicó por completo, como se detalla a continuación y en el anexo 13.7.

Tabla 22: Hiperparámetros del script de entrenamiento del detector y su fundamento.

| **Hiperparámetro** | **Valor** | **Fundamento** |
|---|---|---|
| epochs | 120 | Con paciencia de 25 épocas para detención temprana |
| imgsz | 640 | La entrada del sensor es un encuadre de 640×640 |
| batch | 32 | Valor por defecto del script |
| cos_lr | activo | Programación coseno de la tasa de aprendizaje |
| close_mosaic | 15 | Desactiva el mosaico en las últimas épocas |
| fliplr / flipud | 0,0 / 0,0 | Reflejar un cartel produce texto espejado, por lo que la aumentación por reflexión, habitual en detección, es contraproducente |
| hsv_h | 0,01 | El color ámbar del cartel LED es una señal fuerte y no conviene alterarla |
| hsv_s / hsv_v | 0,5 / 0,6 | La saturación y el brillo sí se alteran, para modelar la variación de la iluminación |
| degrees / shear / perspective | 5,0 / 2,0 / 0,0005 | Modelan el ángulo de captura desde la vereda |
| mixup | 0,05 | Valor por defecto del script |

El equipo no contó con una GPU durante buena parte del desarrollo. Las dos primeras corridas (el detector de una clase y el de dos clases, este último el 15 de septiembre de 2026) se entrenaron en CPU con una configuración reducida: 40 épocas y lote de 16, sobre las 140 imágenes de la sec. 7.3.3. Con tan pocas épocas el entrenamiento se detenía antes de que las métricas dejaran de mejorar, y con tan pocas imágenes el detector dejaba escapar uno de cada tres carteles del conjunto de prueba (sec. 9.4.1).

Para superar las dos limitaciones a la vez, la empresa Arnaldo Castro S.A. facilitó un servidor con una GPU NVIDIA Tesla V100, y el 15 de octubre de 2026 el detector de dos clases se reentrenó allí, partiendo otra vez de los pesos de YOLO11n preentrenados sobre COCO. El conjunto pasó a tener 395 imágenes y el entrenamiento completó las 120 épocas previstas, con lote de 16 imágenes de 640×640 píxeles, en unos cuatro minutos y medio. Esa corrida no aplicó todos los valores de la Tabla 22. Conservó la decisión que más importa para este problema, no reflejar las imágenes, pero dejó el resto de la aumentación en los valores por defecto de la biblioteca (tono 0,015, saturación 0,7, brillo 0,4, sin rotación, corte ni mezcla de imágenes), y el optimizador lo eligió la propia biblioteca: AdamW, con una tasa de aprendizaje inicial de 0,001667. Los registros de la corrida se conservan en el repositorio (docs/mediciones/2026-10-15-reentreno-v100/).

<!-- imagen del Doc -->

Figura 21: Pérdidas de entrenamiento y de validación, y métricas de validación, a lo largo de las 120 épocas del reentrenamiento en la V100.

Fuente: elaboración propia, a partir de los registros de entrenamiento de Ultralytics.

La Figura 21 muestra que las pérdidas de validación descienden hasta las últimas épocas y no muestran un aumento sostenido, lo que no indica sobreajuste en ese rango, y que las métricas se estabilizan a partir de la época 80, aproximadamente. La mejor época, medida por el mAP@0,5:0,95 de validación, fue la 105, y sus pesos son los que se convirtieron para el sensor. El efecto del reentrenamiento sobre las métricas del detector se analiza en la sec. 9.4.1.

### 7.3.5 Elección entre detector de dos etapas y de una etapa

Esta es la decisión de modelado central del pipeline y estuvo determinada por una restricción de hardware. Se evaluaron dos alternativas:

- Dos etapas: un YOLO11n preentrenado sobre COCO localiza el ómnibus (la categoría bus ya existe en COCO) y un segundo YOLO11n, ajustado, localiza el cartel dentro de él. Requiere dos modelos y dos inferencias por cuadro.
- Una etapa: un único YOLO11n ajustado sobre dos clases (bus_sign y bus). Requiere un modelo y una inferencia.

La comparación vigente sobre las 117 imágenes de evaluación se realizó el 12 de octubre de 2026 en una computadora de escritorio, con el código del PR #7 de bus-banner-recognizer (reconocedor latino y reglas del catálogo de la sec. 7.3.8). El número se calcula sobre las 48 imágenes con número esperado, el destino sobre las 56 con destino esperado, y la lectura completa, que exige acierto simultáneo en ambos campos, sobre las 48 imágenes con número esperado (sec. 9.4.2, Tabla 39, y anexo 13.10). El esquema de dos etapas obtuvo 91,7% en el número, 89,3% en el destino y 91,7% en la lectura completa, con una detección de 35 ms; el de una etapa, 91,7%, 85,7% y 87,5%, con 18 ms.


Una sola imagen, el cartel nocturno de la línea 109, modifica el número en unos dos puntos: según un píxel de recorte se lee 109 o 10, y el resultado cambia entre versiones de onnxruntime y OpenCV. Son cifras del modelo entrenado en CPU: la comparación no se repitió con el detector reentrenado ni con el modelo cuantizado que corre en el sensor, por lo que la precisión de la configuración que efectivamente usa el dispositivo no está medida (sec. 9.4.2 y 9.9).

Una comparación anterior, de septiembre de 2026 y previa a las reglas del catálogo, muestra además el efecto del margen vertical del recorte (sec. 7.3.6). Ese margen se eligió sobre el mismo conjunto de evaluación, por lo que las filas de 0,06 tienen un sesgo favorable; promediado sobre la grilla, su efecto en la lectura completa es pequeño, de 0,7 puntos (Tabla 23).

Tabla 23: Efecto del margen vertical del recorte en los dos detectores (septiembre de 2026, antes de las reglas del catálogo).

| **Detector** | **Margen vertical** | **Número** | **Destino** | **Lectura completa** | **Detección (mediana)** |
|---|---|---|---|---|---|
| Dos etapas | 0,12 | 91,7% | 75,0% | 87,5% | 38 ms |
| Dos etapas | 0,06 | 89,6% | 76,8% | 87,5% | 38 ms |
| Una etapa (dos clases) | 0,12 | 85,4% | 69,6% | 79,2% | 21 ms |
| Una etapa (dos clases) | 0,06 | 89,6% | 71,4% | 83,3% | 21 ms |

El esquema de dos etapas lee mejor: en la medición vigente supera al de una etapa en 4,2 puntos de lectura completa y en 3,6 puntos de destino, con el mismo resultado en el número. En la medición anterior, el ajuste de los márgenes había reducido aproximadamente a la mitad la diferencia en lectura completa, pero no la del destino. Los errores de destino restantes provienen del reconocedor, que confunde el texto de la matriz de LEDs, y no de letras que quedan fuera del recorte.

A pesar de esa diferencia se eligió el detector de una etapa, porque el sensor sólo admite un modelo: con uno solo la ocupación llega al 90% (sec. 7.2.6) y el segundo no entra. El esquema de dos etapas obligaría a ejecutar al menos una de las inferencias en el procesador de la placa, lo que impediría la detección continua sin costo de procesador en la que se basa el modo vigilancia y aumentaría el tiempo por cuadro. Por lo tanto, adoptar el esquema de dos etapas implicaba prescindir de la detección continua. Se aceptó una pérdida acotada de precisión en el destino a cambio de que el sistema pueda vigilar la escena sin intervención del usuario.

El esquema de dos etapas se conserva implementado en el repositorio como referencia para un equipo sin restricción de memoria, y permite medir cuánto cuesta la limitación del hardware.

### 7.3.6 Ajuste de la geometría del recorte

El detector devuelve un rectángulo por objeto, ajustado durante el entrenamiento a los LEDs del cartel. En los carteles de Montevideo el número de línea está a la izquierda y el dígito “1” es un trazo vertical fino. Cuando el borde izquierdo del recorte cae sobre él, el OCR lo pierde o lo confunde con el borde de la imagen: en la placa, el 15 de septiembre, se leyó dos veces 15 donde el cartel decía 115 (sec. 7.3.11). Para evitarlo, el recorte se amplía alrededor de la caja con tres márgenes relativos: izquierdo, derecho y vertical. Se evaluó una grilla de 72 combinaciones sobre las 117 imágenes de evaluación (anexo 13.8).

El efecto del margen vertical, promediado sobre el resto de la grilla, es monótono (Tabla 24).

Tabla 24: Lectura completa según el margen vertical, promediada sobre el resto de la grilla.

| **Margen vertical** | **0,06** | **0,12** | **0,18** | **0,24** |
|---|---|---|---|---|
| Lectura completa | 0,819 | 0,812 | 0,810 | 0,770 |

Un margen vertical amplio incorpora el marco del cartel y las filas de LEDs vecinas, y el reconocedor, que lleva cada línea a una altura fija de 48 píxeles, dedica parte de esa altura a la carrocería. El valor se redujo de 0,12 a 0,06 el 16 de septiembre. La elección se hizo sobre el conjunto de evaluación, y su efecto promedio es pequeño: 0,7 puntos de lectura completa frente a 0,12.

Los márgenes laterales son asimétricos, 0,18 a la izquierda y 0,06 a la derecha, porque el número de línea está a la izquierda y es el dato que no puede perderse. A diferencia del vertical, no se ajustaron contra el conjunto de evaluación: con 56 imágenes que tienen destino esperado, una sola imagen vale 1,8 puntos porcentuales, y optimizar sobre esa grilla sería ajustarse al conjunto y no al problema. Sólo se adoptó el cambio del margen vertical, cuyo efecto se mantiene en toda la grilla.

Los valores vigentes son SIGN_MARGINS = (0.18, 0.06, 0.06), como fracción de la caja (hardware/raspi/virovision/bus.py). Son los valores por defecto del pipeline, pero el dispositivo los pasa explícitamente porque dependen del modelo que dibuja la caja, y el modelo se elige en el dispositivo.

El 21 de octubre se probó usar la caja del detector reentrenado sin márgenes, con la hipótesis de que un detector mejor entrenado ya no los necesitaba. Contra un video en pantalla el “1” quedó dentro del recorte, pero en otras pruebas se siguió perdiendo, y el 22 de octubre se volvió a los márgenes medidos (PR #122). Con el zoom digital (sec. 7.3.10), una lectura se descarta si la caja con márgenes queda fuera del cuadro ampliado, ya que de lo contrario el margen izquierdo se cortaría en el borde y el primer dígito volvería a perderse.

### 7.3.7 La lectura: comparación de motores de OCR

Para leer el recorte se compararon motores de OCR detrás de una misma interfaz, sobre el mismo conjunto y con los mismos recortes. La comparación se midió en la computadora de desarrollo, con el detector de dos etapas; los tiempos corresponden sólo al OCR. En la placa, cada lectura demora entre 583 y 1.006 ms (sec. 7.3.2). La Tabla 25 presenta el resultado.

Tabla 25: Comparación de motores de OCR sobre los mismos recortes.

| **Motor de OCR** | **Número** | **Destino** | **Lectura completa** | **Tiempo (mediana)** |
|---|---|---|---|---|
| PP-OCRv5 vía ONNX \[39\], \[41\] (elegido; se ejecuta en la placa) | 89,6% | 78,6% | 85,4% | 7 ms |
| PaddleOCR 3.x con su entorno de ejecución nativo \[26\], \[27\] | 89,6% | 76,8% | 79,2% | 118 ms |
| PP-OCRv4 vía ONNX (RapidOCR \[28\]) | 87,5% | 73,2% | 75,0% | 81 ms |

Tesseract, el motor clásico de referencia, no se incluyó en la comparación. Está orientado a texto impreso en documentos y no a caracteres formados por puntos de LED (sec. 4.4).

La métrica no fue el único criterio. El entorno nativo de PaddleOCR no tiene una distribución compilada para la placa: las versiones disponibles para ARM de 64 bits llegan hasta Python 3.12 y el sistema operativo de la placa usa Python 3.13. Ejecutar los mismos modelos exportados a ONNX resolvió a la vez la disponibilidad, la precisión y la latencia. El OCR ocupa unos 140 MB de memoria en la placa.

Dos ajustes de configuración tuvieron un efecto mayor que el cambio de modelo. El primero fue el reconocedor por alfabeto: la configuración por defecto usa un reconocedor de 18.000 clases pensado para chino e inglés, que no incluye la Ñ. El reconocedor latino tiene 503 clases, incluye la Ñ y las vocales acentuadas y pesa la mitad; con él, con el detector de dos etapas y el margen vertical de 0,12, el acierto del número pasó de 79,2% a 91,7% y la lectura completa de 79,2% a 87,5%, con la misma latencia (anexo 13.10). El segundo fue el detector de texto interno del OCR, que con sus parámetros por defecto dividía el cartel en fragmentos sin sentido (“5”, “BRAI”, “E”); con el lado máximo ajustado a 320 píxeles lee “115” y “LUIS BRAILLE” en 25 ms.

### 7.3.8 Interpretación y reparación contra el catálogo

La salida del OCR se interpreta buscando al comienzo un código de línea, formado por hasta cuatro dígitos con un prefijo de letras opcional, y tomando el resto del texto como destino. Los prefijos admitidos (CE, BT, D, E, G y L) se tomaron del catálogo de la STM, en el que 54 de los 145 códigos de línea llevan letras (por ejemplo L12, D10, G8 o CE1). Dos códigos del catálogo, G y PA, no tienen dígitos, por lo que el intérprete no los reconoce y esas líneas nunca se anuncian. Al interpretar el código, las letras que el OCR confunde con dígitos (O por 0, I por 1) se corrigen sólo después del prefijo. Luego la lectura se valida contra el catálogo (sec. 7.3.3).

El catálogo corrige primero los errores sistemáticos del reconocedor. En la primera ejecución sobre la placa, el 15 de septiembre, el registro muestra la entrada 15 LUIS BRALLE y la salida 115, LUIS BRAILLE: la primera versión de la reparación corrigió el destino por similitud y, a partir de él, el número. Ese comportamiento es anterior a las reglas del 6 y el 7 de octubre que se describen a continuación, que ya no reemplazan dígitos leídos por el OCR; para ese caso, el remedio vigente es el margen izquierdo del recorte (sec. 7.3.6). La comparación tolera dígitos confundidos con letras y espacios perdidos (MEMID0ZAE y ME MDOZA E se reconocen como MENDOZA), con resguardos para no elegir un destino real pero equivocado: un mínimo de cuatro letras y un margen de 0,05 sobre el siguiente lugar distinto. Las variantes ortográficas de un mismo lugar en los datos abiertos no compiten entre sí.

El catálogo decide también qué se anuncia. En una prueba sobre la placa el sistema anunció “Bus 1” a partir de lecturas sin sentido (1M12) y deletreó destinos ilegibles (U2 NOEVR). Desde el 6 de octubre de 2026 sólo se anuncia lo que el catálogo conoce: una línea que no existe no se anuncia, y un destino que no coincide con ninguno no se dice. Para una persona que no ve, “línea 330” sin destino es una respuesta útil, mientras que un destino deletreado no lo es. Sobre las 117 imágenes, el acierto del destino pasó de 76,8% a 89,3% (docs/SESSION-LOG.md, 6 de octubre de 2026).

Por último, el catálogo completa la parte del cartel que no se leyó. Desde el 7 de octubre, cuando la confianza del OCR es menor a 0,8, se completa la mitad faltante sólo si no es ambigua: un destino que corresponde a una única línea da esa línea (116 de los 257 destinos) y una línea con un único terminal da ese destino. Lo inferido se registra por separado de lo leído, no cuenta como voto (la misma lectura dudosa se repetiría cuadro a cuadro y se confirmaría a sí misma) y nunca reemplaza dígitos que el OCR sí leyó.

### 7.3.9 El modo vigilancia

El modo ómnibus no consiste en tomar una fotografía. El usuario no ve venir el ómnibus y no puede elegir el momento de la captura; si el sistema esperara un gesto por cada vehículo, el gesto llegaría tarde. Por eso el modo se diseñó como vigilancia continua: mientras está activo, la cámara permanece abierta y el detector se ejecuta en cada cuadro dentro del sensor.

La lógica de anuncio es la siguiente:

1. Cuando una caja de ómnibus aparece y se mantiene durante un número de cuadros proporcional a la tasa de captura, se confirma su presencia y se anuncia que se acerca un ómnibus.
1. Cuando el cartel alcanza una altura legible (22 píxeles), se recorta y se lee.
1. Una lectura confirmada por el catálogo en ambos campos se anuncia de inmediato; en caso contrario, se espera a que dos lecturas coincidan. Si sólo se leyó el número o el destino, se esperan algunas lecturas más a que aparezca la otra parte.
1. Cada ómnibus se anuncia una sola vez.

Un seguidor de objetos (sec. 3.3.4) mantiene la identidad de cada vehículo entre cuadros y estima si se acerca o se aleja, comparando el área en el último tercio de su trayectoria con la del primero. Asocia las cajas de forma voraz, empezando por la de mayor área, con la pista de mayor superposición, siempre que la IoU alcance 0,3, y no predice el movimiento. Una pista sin detecciones durante medio segundo se da por perdida, pero se recuerda durante 5 segundos: si en ese plazo aparece una caja con IoU de al menos 0,2 con ella, la recupera con su identidad y sus anuncios. Los plazos se fijan en tiempo y se convierten a cuadros según la tasa de captura (bus_banner/tracking.py, repositorio bus-banner-recognizer; hardware/raspi/virovision/bus.py). Hay dos temporizadores de supresión, de 15 segundos para el anuncio de presencia y de 10 segundos para una línea recién anunciada, que se incorporaron por un defecto observado en la primera ejecución sobre la placa (sec. 7.3.11).

La asociación por superposición supone que la caja de un mismo vehículo cambia poco entre cuadros consecutivos. La cámara está fija respecto de quien la lleva, pero la persona mueve la cabeza, y un giro rápido desplaza todas las cajas de la imagen y puede romper la asociación. Cuando eso ocurre, el vehículo se registra como uno nuevo; la supresión temporal por línea evita que se lo anuncie dos veces, pero el anuncio de presencia puede repetirse. El efecto de los movimientos de cabeza sobre el seguidor no se midió (sec. 9.9).

Los umbrales de esta lógica responden al mismo criterio que la sec. 3.2 fija para las métricas: un anuncio equivocado es peor que uno que no se hace. El umbral de confianza del detector, de 0,25, es el valor por defecto de la biblioteca y no se ajustó; es bajo a propósito en esta etapa, porque un cartel que el detector deja pasar todavía tiene que superar dos filtros antes de anunciarse, el catálogo de líneas y la coincidencia de dos lecturas. La precisión se asegura en esos dos filtros, que descartan las lecturas que no se confirman, y no en el detector, que si fuera más estricto perdería ómnibus que nunca se anunciarían. Con el mismo criterio, el catálogo sólo completa una parte faltante del cartel cuando la confianza del OCR es menor a 0,8 y la inferencia no es ambigua (sec. 7.3.8). Ninguno de estos umbrales se optimizó contra un conjunto de datos, por la misma razón que se expone para los márgenes laterales (sec. 7.3.6).

Desde el 12 de octubre de 2026 (PR #114) el dispositivo guarda el cuadro y el recorte exacto que leyó el OCR y avisa por BLE; la aplicación los descarga por WiFi, los asocia al registro de telemetría de esa lectura y los sube, cuando hay conexión, a un almacenamiento privado del servidor (sec. 8.6.3). Permiten revisar qué vio el sistema cuando anunció, o no anunció, una línea, y son la base del conjunto de evaluación con fotografías del propio dispositivo (sec. 9.2).

### 7.3.10 Zoom digital sobre el cartel

En una prueba de campo del 19 de octubre de 2026 el ómnibus se detectó desde lejos, pero el cartel sólo fue legible con el vehículo prácticamente encima, demasiado tarde para uno que no se detiene. La causa es la resolución: el cuadro del que sale el recorte tiene 1024 píxeles de ancho (1024×766) sobre un sensor de 4056, y un número a 20 metros ocupa del orden de 9 píxeles de alto (estimación, no medición). Es la limitación más importante del modo ómnibus, porque la única prueba en la calle mostró que el sistema lee el cartel demasiado tarde, y todas las demás mediciones se hicieron contra videos en pantalla (sec. 9.9). Ampliar el recorte después de capturarlo agranda la imagen borrosa pero no recupera el detalle.

Se evaluaron tres alternativas. El zoom óptico no es posible porque la cámara tiene lente fija. Un zoom digital fijo reduciría el campo de visión también cuando no hay ómnibus. Se eligió un zoom digital dinámico en el procesador de imagen de la placa (ADR 0006, actualización del 19 de octubre de 2026). El zoom se centra en el cartel alargado de mayor área que ve el detector y aumenta hasta que el cartel mide unos 64 píxeles de alto (más no aporta, porque el reconocedor lo lleva a 48), sin que ocupe más de la mitad del ancho del cuadro, para tolerar el movimiento de la cabeza. Si el detector pierde el cartel, el zoom se mantiene 1,5 segundos y vuelve a 1×. El detector sigue viendo el campo completo, porque su zona de entrada es un control propio del IMX500, independiente del recorte del procesador de imagen; sólo la caja que va al OCR se traduce al cuadro ampliado (hardware/raspi/virovision/zoom.py).

Medido en la placa contra un video en pantalla, el zoom llegó a 2,0× y permitió anunciar un cartel de unos 10 píxeles de alto, la mitad del mínimo legible sin zoom (sec. 9.4.4).

En el modo de sensor que usa la placa el máximo práctico es 2×; el modo de sensor completo, que permitiría 4×, se descartó en la Zero 2 W. Falta la prueba en la calle, con y sin zoom, midiendo a qué distancia se anuncia la línea. Si el límite resulta ser el detector, que desde lejos no encuentra el cartel, la siguiente etapa consiste en mover también su zona de entrada hacia el ómnibus detectado.

### 7.3.11 Defectos detectados en la primera ejecución sobre el dispositivo

La primera ejecución del pipeline completo sobre la placa reveló cinco defectos que las pruebas en la computadora de desarrollo no habían mostrado, lo que confirmó la regla metodológica de la sec. 5.2.2 de validar sobre el hardware real:

1. Un mismo ómnibus se anunció dos veces en un segundo. Al moverse la cámara, el seguidor perdió el vehículo y lo volvió a registrar como uno nuevo. Se agregó la supresión temporal por línea.
1. El OCR leía 15 donde el cartel decía 115, porque el borde izquierdo de la caja caía sobre el “1”, un trazo fino que además queda junto al símbolo de accesibilidad para silla de ruedas que precede al número. Se aplicaron tres medidas: un margen izquierdo tres veces mayor que el derecho, medio voto para las líneas fuera del catálogo y la corrección por similitud.
1. El OCR no podía ejecutarse en el mismo hilo que la cámara. La biblioteca de captura da el sensor por perdido si nadie consume cuadros durante aproximadamente un segundo, y una lectura demora cerca de un segundo. Se separaron dos hilos comunicados por colas, lo que eliminó los errores de tiempo de espera del sensor.
1. La reproducción encadenada de audio fallaba: al solicitar dos archivos en una misma llamada al reproductor, el segundo no sonaba, y el destino nunca se escuchaba. Se pasó a una llamada por archivo, en cola.
1. El segundo intento de lectura, con la detección de texto del OCR activada, demoraba de 2 a 3 segundos en la placa. Se restringió a los casos en que la primera lectura no devolvió ni número ni destino.

### 7.3.12 Los anuncios pregrabados

El dispositivo no sintetiza voz en el modo ómnibus: reproduce archivos de audio pregrabados almacenados en su tarjeta de memoria. Son 386 archivos, 147 de números de línea y 239 de destinos, generados a partir del catálogo con una voz en español, a 175 palabras por minuto, en formato WAV monoaural de 22 kHz y 16 bits. Se generaron el 14 de septiembre de 2026 con el catálogo de ese momento; la diferencia entre los 239 archivos de destino y los 257 destinos del catálogo actual (sec. 7.3.3) no se analizó. Los avisos de sistema son archivos aparte, con la misma voz y el mismo formato (sec. 7.5.4).

Se optó por audio pregrabado porque un anuncio que depende de la nube para generarse dejaría de funcionar justamente sin conexión, lo que contradice el ADR 0001. El mismo criterio se aplica a los avisos de sistema (sec. 7.5.4).

### 7.3.13 Líneas con letras y cobertura fuera del centro

El procesamiento local del modo ómnibus se justifica sobre todo fuera del centro de Montevideo: en los barrios periféricos y en las localidades del interior la cobertura de datos móviles es más débil, y es donde un sistema que dependiera de la nube dejaría de funcionar (sec. 7.3.2). En esas zonas, sin embargo, los carteles tienen un formato distinto del que domina en el centro, donde la línea es un número de dos o tres dígitos seguido del destino.

En la periferia de Montevideo circulan líneas locales y diferenciales del propio sistema metropolitano cuyo código combina letras y números (L1, L12, D10, G8, CE1, BT1, entre otras). El sistema las admite: el intérprete reconoce esos prefijos (sec. 7.3.8), el catálogo de la STM las incluye con sus destinos y hay anuncios pregrabados para ellas. Pero su reconocimiento prácticamente no está medido: de las 117 imágenes del conjunto de evaluación, sólo una corresponde a una línea con letras, la G, que por no tener dígitos el intérprete no reconoce y el sistema nunca anuncia (sec. 7.3.8); además, la composición del conjunto de entrenamiento en ese aspecto no se relevó (sec. 7.3.3). Tampoco se evaluó si el reconocedor confunde las letras de esos prefijos con dígitos en la matriz de LEDs, que es el tipo de error que el catálogo corrige para los números.

Las líneas de otros sistemas, como las suburbanas e interdepartamentales operadas por otras empresas y las urbanas de otros departamentos, no están en el catálogo de la STM. Como el sistema sólo anuncia lo que el catálogo conoce (sec. 7.3.8), hoy esas líneas no se anuncian aunque el cartel se lea correctamente; el usuario sólo escucha que se acerca un ómnibus. Se eligió este comportamiento porque anunciar una lectura no validada lleva a errores peores (sec. 7.3.8), pero tiene como consecuencia que el sistema cubre mejor el centro, donde la conexión es menos necesaria, que la periferia y el interior. Ampliar el catálogo a esas líneas y agregar carteles periféricos a los conjuntos de entrenamiento y de evaluación es trabajo futuro (sec. 11.3).

## 7.4 El pipeline de reconocimiento de productos

### 7.4.1 Estructura

<!-- imagen del Doc -->

Figura 22: Pasos de una lectura en el modo supermercado, del doble clic en el botón a la reproducción del audio en el dispositivo.

Fuente: elaboración propia.

La Figura 22 muestra las etapas de una lectura: el doble clic llega a la aplicación por BLE, la aplicación descarga la fotografía por la red WiFi del dispositivo, la envía al modelo de visión a través del intermediario propio, arma la frase con la respuesta y la reproduce en el teléfono o, sintetizada en la nube, en el dispositivo. El objetivo del equipo era que el ciclo completo cupiera en 3 a 4 segundos (RNF-02). Los tiempos de cada etapa registrados por la telemetría se presentan en la sec. 9.5: según la suma de las medianas de cada etapa, con la salida por el teléfono el ciclo cabe en ese objetivo, y con la salida por el dispositivo lo excede, por el tiempo de la síntesis en la nube; el ciclo completo no se midió con un único cronómetro.

### 7.4.2 Selección del modelo de visión para el modo supermercado

La elección del modelo pasó por cuatro etapas.

La primera fue explorar modelos que se ejecutaran en el propio teléfono, que era lo que proponía el ADR 0004. El 12 y el 13 de agosto de 2026 se probaron modelos de la familia Gemma \[40\] sobre un iPhone 15 Pro (docs/spike-vision-local.md). Con LiteRT-LM \[42\], Gemma 3 1B generó texto en 910 ms, pero la visión falló con los tres modelos probados, de 756 MB a 2,5 GB. Con ExecuTorch \[44\], el modelo multimodal Gemma 4 E2B sí reconoció la imagen, pero requería 3 GB de descarga, unos 4 segundos de carga y unos 6,4 segundos por lectura, por encima del tiempo objetivo (sec. 5.2.3 y 7.7). En la misma exploración, un modelo de la nube devolvió el primer fragmento de la respuesta en menos de un segundo.

La segunda etapa fue la decisión de usar la nube. Desde el planteo del ADR 0006 regía una restricción: el modelo debía ser gratuito, porque exigirle al usuario crear una cuenta y cargar credenciales propias habría contradicho la accesibilidad del producto. El 30 de agosto el equipo decidió que el modo supermercado se resolviera con un modelo de visión en la nube (ADR 0006, actualización del 30 de agosto de 2026). Fue una excepción acotada al ADR 0001: se aplica sólo a este modo, cuya latencia admite unos segundos y cuyo usuario suele estar en un lugar con cobertura, y queda pendiente un respaldo local (sec. 7.4.6). Con la restricción de gratuidad, la elección se limitaba a Gemini. El primer modelo por defecto fue gemini-3.6-flash, pero tardaba entre 34 y 47 segundos, porque los modelos de esa línea realizan un paso de razonamiento aunque la respuesta sea breve; ese mismo día se cambió por gemini-3.5-flash-lite, que en esas primeras pruebas respondió en 2 a 3 segundos con el mismo acierto.

La tercera etapa, el 1 de septiembre, fue ampliar los candidatos. La gratuidad dejó de ser una restricción para el proyecto, que pasó a pagar el uso para poder comparar los modelos más rápidos disponibles, pero se mantuvo para el usuario final: las claves se resguardan en un intermediario propio y el usuario no carga ninguna credencial (ADR 0006, actualización del 1 de septiembre de 2026; ADR 0008; sec. 7.1.6). Se incorporaron gpt-5.6-luna, de OpenAI, el modelo más pequeño y económico de su familia con visión y respuestas estructuradas; un modelo de Anthropic; y qwen, un modelo abierto servido por Groq sobre hardware dedicado a la inferencia, que interesaba como contraste con los modelos propietarios.

La cuarta etapa fue la comparación entre los tres proveedores con clave disponible, en la que se esperaba que el criterio de selección fuera la precisión. El modelo de Anthropic incorporado en la etapa anterior, claude-haiku-4-5, quedó fuera de la comparación porque su proveedor exige una tarjeta de crédito para emitir una clave y el equipo no la obtuvo, de modo que nunca se lo pudo invocar (docs/mediciones/2026-09-02-modelos-supermercado.md). Para comparar se realizaron cinco corridas por modelo, espaciadas 7 segundos, con una imagen de 768×1024 píxeles (53 KB, el tamaño de la captura de referencia en ese momento; la captura actual ocupa unos 35 KB, sec. 7.2.3). Las corridas se ejecutaron con el mismo código de la aplicación, reemplazando únicamente el transporte (Tabla 26).

Tabla 26: Latencia y acierto de los modelos de visión candidatos para el modo supermercado (cinco corridas por modelo).

| **Modelo** | **Mínimo** | **Mediana** | **Máximo** | **Dispersión** | **Acierto** |
|---|---|---|---|---|---|
| qwen/qwen3.8-27b | 764 ms | 846 ms | 1.087 ms | 1,4× | 5/5 |
| gpt-5.6-luna | 1.410 ms | 1.668 ms | 2.490 ms | 1,8× | 5/5 |
| gemini-3.5-flash-lite | 2.820 ms | 10.649 ms | 32.586 ms | 11,6× | 5/5 |

Los tres modelos devolvieron correctamente los tres campos en las quince corridas, de modo que la precisión no permitió diferenciarlos. El criterio pasó a ser la latencia y, en particular, su dispersión. Un modelo cuya mediana ya supera los 10 segundos, muy por encima del objetivo de 3 a 4 segundos, y cuyo peor caso llega a 32,6 segundos genera, para un usuario que no ve la pantalla, una espera que no se distingue de una aplicación bloqueada, lo que descartó a gemini-3.5-flash-lite. Esta medición, con cinco corridas espaciadas, reemplazó a la cifra de 2 a 3 segundos del 30 de agosto, que provenía de pocas muestras favorables.

Entre los dos modelos restantes, qwen/qwen3.8-27b tiene la mitad de la latencia y menor dispersión, pero se eligió gpt-5.6-luna como modelo por defecto por la cuota de uso. qwen/qwen3.8-27b se utiliza a través de Groq, cuyo plan gratuito admite unas cuatro lecturas por minuto, y una persona que recorre una góndola realiza del orden de dos a cuatro lecturas por minuto. Con ese modelo por defecto, la lectura que excede el límite falla, y para el usuario eso es peor que una respuesta 800 ms más lenta. qwen/qwen3.8-27b se mantiene como alternativa en el selector de la aplicación (sec. 7.6.3). La justificación está registrada junto a la definición del modelo por defecto (app/src/services/vision/product.ts).

El costo por lectura con el modelo seleccionado es de aproximadamente USD 0,0003 (1.138 *tokens* de entrada y 35 de salida), por lo que mil lecturas cuestan menos de medio dólar y el costo dejó de ser una restricción. También se observó que reducir el tamaño de la imagen disminuye los *tokens* pero no la latencia.

La medición utilizó una única imagen de alto contraste, por lo que representa un caso favorable y no una estimación de la precisión en una góndola real. El conjunto de evaluación con fotografías tomadas por el propio dispositivo sigue pendiente (sec. 7.4.5).

### 7.4.3 La respuesta estructurada y el orden de la frase

El modelo no devuelve un texto libre sino tres campos: tipo de producto, marca y detalle. La aplicación arma con ellos la frase que se pronuncia. El orden responde a la accesibilidad: el usuario escucha la frase completa antes de poder decidir, por lo que el tipo de producto va primero, porque es el dato que decide si el producto le sirve; la marca va después, porque distingue entre productos del mismo tipo, y el detalle al final. Se dice “arroz Saman, Blue Patna 1 kg” y no “Blue Patna 1 kg, arroz”. Este orden es una hipótesis de diseño del equipo: no se validó con el usuario entrevistado ni con otras personas ciegas, y es una de las decisiones que las pruebas con usuarios deben confirmar (sec. 9.9). Además, cada campo puede faltar por separado, y una respuesta con dos de los tres datos sigue siendo útil.

En una prueba sobre la placa el dispositivo pronunció la palabra “null”. Ocurrió al apuntar a algo que no era un alimento: el modelo respondió con un valor nulo, la aplicación no lo reconoció como respuesta válida y lo trató como texto libre. La corrección se hizo en los dos extremos: la instrucción al modelo exige devolver siempre el objeto con los tres campos, aunque estén vacíos, y la aplicación distingue el texto libre de una estructura de datos antes de enviar nada a la voz, de modo que un valor nulo, un objeto vacío o una respuesta con los nombres de los campos en otro idioma nunca se leen en voz alta.

### 7.4.4 Síntesis de voz

La síntesis utiliza por defecto la voz del sistema operativo. Cuando hay conexión puede usarse un servicio de síntesis en la nube, que genera un archivo de audio con instrucciones de pronunciación en español rioplatense. La necesidad de esas instrucciones se verificó en la placa: sin ellas, “Macarrones Adria” se pronunciaba con fonética inglesa.

### 7.4.5 Ampliación del alcance del modo supermercado

El alcance original del modo supermercado, fijado en la propuesta del proyecto, fueron los productos de la canasta básica. La delimitación respondía a que la precisión alcanzable era desconocida: un repertorio acotado permitía medir el problema y, si los modelos disponibles no alcanzaban, entrenar uno propio sobre un conjunto cerrado de productos.

Esa medición sistemática no se realizó. Lo que hubo fue una primera prueba informal con el dispositivo real, el 11 de septiembre de 2026, en la que el modelo de nube identificó correctamente los productos de la canasta básica y también alimentos que no pertenecían a ella, entre ellos yerba suelta, sin que fuera necesario restringirlo. Mantener la canasta como límite implicaba pedirle al modelo menos de lo que podía hacer, por lo que se decidió ampliar el alcance a cualquier alimento, envasado, suelto, fresco o a granel, y a los productos de almacén (ADR 0006, actualización del 11 de septiembre de 2026). La instrucción al modelo se reescribió en ese sentido y el mensaje para cuando no se reconoce nada cambió de “no pude identificar el producto” a “Elemento no reconocible”, porque el modo ya no se limita a productos envasados.

La ampliación no cambió el diseño del modo. Su efecto sobre la latencia no se midió: la instrucción nueva puede cambiar la longitud de la respuesta, aunque la latencia depende sobre todo del modelo y del tamaño de la imagen y no de la amplitud de la pregunta (sec. 7.4.2), y el costo por lectura se mantiene en el orden de USD 0,0003; los tiempos medidos con el sistema terminado se presentan en la sec. 9.5. La estructura de la respuesta, con tipo, marca y detalle, tampoco cambió.

Con la ampliación se separaron dos conceptos que en la propuesta estaban unidos: lo que el sistema responde y lo que el sistema mide. El modo responde sobre cualquier alimento, mientras que la canasta básica se mantiene como conjunto de evaluación, es decir, como el repertorio contra el cual se reportarán exhaustividad, precisión, exactitud y F1 cuando se construya. Un conjunto acotado y reproducible es lo que permite comparar modelos entre sí, y no tiene por qué coincidir con lo que el usuario puede preguntar. Ese conjunto todavía no está construido con fotografías tomadas por el propio dispositivo (sec. 9.9).

Hasta noviembre de 2026, la descripción del modo en la aplicación decía “Identifica alimentos y productos de supermercado”, una promesa más amplia que lo que el modelo responde: ante un producto que no es un alimento, como uno de limpieza, el modelo devuelve los campos vacíos y el usuario escucha “Elemento no reconocible”. La descripción se corrigió a “Identifica productos alimenticios”, y la instrucción al modelo se alineó con la misma expresión (“Sos un asistente que identifica productos alimenticios”), de modo que la pantalla y el modelo prometen lo mismo. Extender el modo al resto de los productos de supermercado es una ampliación posible (sec. 11.4).

### 7.4.6 Respaldo local del modo supermercado

El ADR 0001 admite la nube como acelerador siempre que exista un respaldo local. En el modo supermercado ese respaldo todavía no existe: sin conexión o sin credenciales, el sistema lo informa por voz y no realiza la lectura. El comportamiento es el previsto ante una falla, ya que el sistema no queda en silencio, pero no cumple todavía la garantía completa del ADR 0001.

Las alternativas exploradas para el respaldo fueron los modelos multimodales ejecutados en el teléfono (sec. 7.7): la visión con LiteRT-LM no funcionó en iOS, y con ExecuTorch el modelo más pequeño que funcionó requería 3 GB y 6,4 segundos por lectura. Un modelo multimodal pequeño, por ejemplo de la familia Gemma, sigue siendo el candidato, pero su evaluación sobre productos reales no se realizó y queda como trabajo futuro.

## 7.5 La aplicación móvil

### 7.5.1 Elección de React Native para la aplicación móvil

La aplicación debía funcionar en iOS y Android, comunicarse con el dispositivo físico y ser utilizable por personas ciegas o con baja visión. La elección de la tecnología debía considerar estas necesidades, la experiencia del equipo y el tiempo disponible para desarrollar y mantener la solución.

Se consideraron el desarrollo nativo por plataforma y los frameworks multiplataforma, entre ellos React Native y Flutter. El desarrollo nativo permite trabajar directamente con las herramientas de cada sistema operativo, pero supone mantener dos implementaciones. Los frameworks multiplataforma permiten compartir parte del código, aunque su integración con las funciones de cada plataforma debe verificarse según las necesidades de la aplicación.

Se eligió React Native por la experiencia previa del equipo con JavaScript y React, la posibilidad de compartir código entre plataformas y la disponibilidad de bibliotecas para la comunicación Bluetooth con el dispositivo. Estos factores permitían dedicar el esfuerzo al reconocimiento, la interacción y la accesibilidad, en lugar de aprender una tecnología nueva.

La accesibilidad también formó parte de la evaluación. React Native ofrece propiedades para comunicar etiquetas, roles, estados y ayudas de interacción a VoiceOver y TalkBack \[60\], pero estas capacidades no garantizan por sí solas que una aplicación sea accesible. El estudio de Mascetti et al. documenta limitaciones en la cobertura de las APIs de accesibilidad de los frameworks analizados, lo que refuerza la necesidad de verificar los comportamientos requeridos en cada plataforma \[56\].

El desarrollo nativo se descartó por el esfuerzo de mantener dos implementaciones dentro del cronograma y con el equipo disponible. Flutter se descartó principalmente porque requería incorporar Dart y un ecosistema con el que el equipo tenía menos experiencia; esto no implica que Flutter carezca de soporte de accesibilidad, ya que también dispone de mecanismos para integrar tecnologías de asistencia \[61\].

La elección permitió compartir la lógica de la aplicación, pero no eliminó la necesidad de verificar la comunicación, la gestión del audio y la interacción con lectores de pantalla en ambos sistemas operativos. La decisión se fundamentó en la adecuación al proyecto y en la experiencia del equipo, y no en una comparación experimental entre los distintos enfoques. Los criterios de accesibilidad adoptados se desarrollan en la sec. 7.6.

### 7.5.2 Stack y estructura

La Tabla 27 resume las versiones de los componentes principales de la aplicación.

Tabla 27: Componentes principales de la aplicación móvil.

| **Componente** | **Versión** |
|---|---|
| Expo SDK | 57 |
| React Native | 0.86 (Nueva Arquitectura, JSI) |
| React | 19 |
| TypeScript | modo estricto |

Al 9 de noviembre de 2026, el código de la aplicación (app/src) suma 140 archivos y 13.583 líneas: 102 archivos y 9.597 líneas de código, y 38 archivos y 3.986 líneas de pruebas. Está organizado en cuatro capas con una regla de dependencia en un solo sentido: componentes de interfaz, funcionalidades (con estado de React), servicios (infraestructura, sin React) y tipos compartidos. Los textos visibles están en un único módulo de internacionalización, con claves en inglés y valores en español.

### 7.5.3 Patrones de diseño recurrentes

Cinco patrones se repiten en el código y constituyen su arquitectura.

El primero es la combinación de interfaz, sustituto y selector. Cada servicio que depende de un módulo nativo expone una interfaz, un sustituto que falla de manera explícita y un selector que devuelve la implementación real si el módulo nativo está disponible. Esto permite ejecutar la aplicación completa en un entorno sin Bluetooth, como un simulador o las pruebas automatizadas, y hace que la falta de una capacidad se presente como un estado identificado y no como una excepción.

El segundo es el uso de un módulo con estado propio en lugar de un hook de React para el servicio de lectura. Inicialmente la solicitud del botón físico llegaba como estado de React y debía atravesar una cadena de actualizaciones para ejecutarse. Eso funcionaba con la aplicación en primer plano pero no con la pantalla bloqueada, que es el escenario real de uso. El módulo pasó a suscribirse directamente al cliente Bluetooth, y React lo observa mediante la API de suscripción a fuentes externas.

El tercero es la inyección de dependencias como funciones de acceso y no como valores. El servicio de lectura recibe funciones que devuelven el modelo seleccionado, la descarga de la foto o el envío de audio. Como la suscripción se instala una sola vez, si se recibiera el valor el sistema usaría siempre la configuración vigente al arrancar.

El cuarto es la separación entre las decisiones y el código nativo. Las decisiones (a qué salida enviar el audio, qué transporte usar, cómo interpretar un fragmento) son funciones puras, separadas del código que se comunica con el sistema operativo, lo que permite verificarlas con pruebas automatizadas (sec. 9.7).

El quinto son los contratos duplicados y verificados. Las definiciones que cruzan la frontera entre componentes (el perfil GATT, el catálogo de avisos, el esquema de telemetría, el registro de proveedores) existen en dos copias, y una prueba automatizada falla si dejan de coincidir.

Las restricciones de arquitectura se imponen con el analizador estático: su configuración prohíbe que los módulos de reconocimiento y de audio importen los servicios de nube o de telemetría, de acuerdo con los ADR 0001, 0006 y 0008. Antes esa restricción era un comentario en cada módulo, que no impedía violarla.

### 7.5.4 Gestión de la salida de audio

Es el subsistema más elaborado de la aplicación, porque la voz es la interfaz y una falla en él deja al usuario sin información.

La sesión de audio se configura en modo de mezcla con otras fuentes, en lugar de la opción por defecto del framework, que atenúa o interrumpe el resto del audio del sistema. En este caso el resto del audio incluye al lector de pantalla, que es la interfaz del usuario, y atenuarlo o interrumpirlo cortaría sus mensajes.

iOS concede pocos segundos de ejecución a una aplicación activada por una notificación Bluetooth, y el ciclo de lectura necesita más. Para mantener el proceso activo se reproduce en bucle un tono inaudible (40 Hz a −50 dBFS) mientras dura la lectura. Se descartó usar un archivo de silencio digital, porque es el recurso que el sistema operativo tiene más probabilidad de dejar de respetar. El recurso tiene un riesgo para una publicación en la App Store: las pautas de revisión de Apple admiten la ejecución en segundo plano para reproducir audio, y un tono inaudible puede interpretarse como un uso de ese modo para otro fin. La aplicación se distribuye por TestFlight, cuya revisión la aprobó, pero esa revisión no equivale a la de la tienda, y el riesgo queda declarado para una publicación futura (sec. 11.6).

Al solicitarse una lectura se reproduce un tono breve de confirmación, que le indica al usuario que el gesto se registró. Con el teléfono bloqueado en un bolsillo, ese tono es además la única forma de saber que la aplicación se activó.

A diferencia de una aplicación convencional, que reproduce su audio por el parlante del teléfono, ViroVision puede reproducir las respuestas en el transductor de conducción ósea del dispositivo. Esa posibilidad es una decisión de accesibilidad: el lector de pantalla y el resto del audio del teléfono siguen su ruta habitual, mientras que las respuestas de ViroVision pueden escucharse por el dispositivo, lo que reduce la superposición entre la voz del lector de pantalla y la del reconocimiento. El audio hacia el dispositivo viaja por la red WiFi y no por Bluetooth: BLE, en su modo de datos, no transporta audio continuo, el perfil LE Audio que lo permite requiere un soporte que la placa no ofrece \[70\], y un perfil de Bluetooth Classic se descartó por la latencia de codificación y por compartir la antena con BLE y WiFi (sec. 7.7).

Dos funciones puras deciden por dónde sale cada sonido, una para las lecturas y otra para los avisos de sistema. La elección del usuario (teléfono o dispositivo) se aplica a todo lo que suena: las lecturas de ambos modos, los avisos y la prueba de audio. Son dos funciones porque los avisos no necesitan síntesis: son archivos pregrabados en la tarjeta del dispositivo y pueden reproducirse sin internet, sin WiFi y sin credenciales. Si se usara una única función, los avisos relacionados con la red se reproducirían en el teléfono justo cuando el usuario eligió escuchar por el dispositivo. En todos los casos el teléfono funciona como respaldo, de modo que siempre se escucha una respuesta, y el motivo por el que un sonido pasó al respaldo se registra en la telemetría.

El catálogo de avisos es cerrado, y los avisos que no tienen archivo pregrabado lo son a propósito, por tres motivos. Primero, el dispositivo no puede anunciar su propia ausencia, por lo que la pérdida del enlace la dice el teléfono. Segundo, la confirmación de que se eligió el teléfono como salida se escucha, por definición, en el teléfono. Tercero, los avisos del enlace y de la red se escuchan mientras el usuario empareja el dispositivo con el teléfono en la mano, y enviarlos por el mismo enlace interfería con la lectura de las credenciales de la red (sec. 7.5.5). Por otra parte, las fallas del dispositivo no forman parte del catálogo, y esa exclusión corrige un bucle detectado en la placa: el dispositivo respondía a un comando desconocido con un error, la aplicación convertía todo error del dispositivo en un aviso y el aviso volvía al dispositivo como otro comando. Desde entonces el dispositivo no informa sus propias fallas por esa vía.

También se detectó que, si se cambiaba la salida durante una frase, el teléfono y el dispositivo hablaban al mismo tiempo, porque cada salida podía interrumpirse a sí misma pero no a la otra. Se estableció que antes de hablar el teléfono le envía al dispositivo una orden de silencio, y antes de enviarle un aviso detiene su propia voz (ADR 0003, actualización del 18 de septiembre de 2026).

La lectura de un ómnibus se dice con su destino cuando lo hay, porque el destino distingue dos recorridos de la misma línea. Sin número se dice sólo el destino, y sin ninguno de los dos se informa que se acerca un ómnibus (app/src/features/recognition/format.ts).

Desde el ADR 0011 (6 de octubre de 2026) el texto de un error no se muestra ni se pronuncia: se registra en la telemetría (sec. 9.7.4) y el usuario escucha una frase fija, en lenguaje llano, que indica qué hacer. No se optó por omitir el mensaje, porque para quien no ve la pantalla el silencio después de presionar el botón no se distingue de un dispositivo roto.

### 7.5.5 Vinculación y gestión del enlace

La aplicación gestiona la conexión sin intervención del usuario. Se conecta al arrancar, reintenta con un retardo creciente si pierde el enlace, se une a la red WiFi del dispositivo con las credenciales recibidas por Bluetooth, espera a que el servicio responda y abandona esa red cuando el dispositivo apaga el punto de acceso. El usuario no necesita configurar la red.

Durante el desarrollo se corrigieron varios defectos de este módulo: la telemetría registraba cada notificación de estado aunque fuera idéntica a la anterior; la verificación de red se reiniciaba en cada notificación, lo que cancelaba la anterior e impedía que la red quedara lista; y la misma disponibilidad se anunciaba dos veces.

Con la salida de audio en el dispositivo, la aplicación dejó de poder unirse a la red WiFi. El anuncio de conexión, una escritura que no se esperaba, coincidía con la lectura de las credenciales, y la lectura volvía vacía. En lugar de reordenar esa llamada, el cliente Bluetooth pasó a encolar todas sus operaciones en el orden en que se solicitan (app/src/services/ble/serialize.ts), porque el mismo patrón aparecía en otros puntos del código y este tipo de defecto no genera errores visibles.

La pestaña del dispositivo muestra su nombre y, desde el 6 de octubre de 2026, el nivel de batería en texto, con un aviso por debajo del 20% (app/src/features/device/DeviceSummary.tsx). Para un usuario ciego, un indicador gráfico no aporta información.

### 7.5.6 Configuración

La pantalla de ajustes tiene cinco bloques: el modo de la aplicación, la elección de por dónde se escucha, el volumen del dispositivo, una descripción de lo que reconoce el sistema con un botón para probar el audio y, sólo en modo desarrollo, el selector de modelo. No tiene sección de apariencia (ADR 0010) ni de cuenta (sec. 7.5.7).

### 7.5.7 Autenticación de usuarios

La autenticación contra el servidor está implementada (correo electrónico y contraseña, con sesión persistente) pero no está conectada a la navegación, y la aplicación se publica sin inicio de sesión. La decisión, registrada en el ADR 0002, se basa en que el núcleo del producto es local y una cuenta no aporta valor al usuario. El código se conserva por si en el futuro se incorpora una sincronización opcional.

### 7.5.8 Modo producto y modo desarrollo

A medida que el sistema se probó, la pantalla de inicio acumuló información útil para el equipo pero innecesaria para el usuario: los campos de cada lectura, la fotografía del dispositivo, los ómnibus detectados con sus recortes y los mensajes de estado. Retirarla por completo habría eliminado una herramienta de trabajo del equipo, y mantenerla agregaba elementos que el lector de pantalla recorre antes de llegar al botón de lectura.

Desde el 2 de noviembre de 2026 (PR #125) la aplicación tiene dos modos, seleccionables en ajustes. En el modo producto, que es el predeterminado, la pantalla de inicio muestra el modo, sus botones y la última frase pronunciada, para que el lector de pantalla pueda volver a ella; la única falla que se muestra en pantalla es una frase fija, “El dispositivo no pudo sacar la foto”, porque es el único que el usuario puede resolver en el momento. En el modo desarrollo se muestran además los campos de la lectura, las fotografías, los ómnibus detectados y el selector de modelo. En el modo producto la pestaña del dispositivo tampoco muestra la línea de estado de la conexión, que se comunica por voz. El modo se elige con una lista desplegable (PR #128), porque dos botones ocupaban demasiado espacio para una opción que sólo usa el equipo; al elegirlo, la aplicación lo anuncia (“Modo producto”), con una demora de 600 ms para que no se superponga con el lector de pantalla que vuelve al botón. La elección se guarda en el teléfono, y cualquier valor desconocido o una falla de lectura llevan al modo producto. La decisión de qué se muestra en cada modo es una función pura con sus pruebas (app/src/features/reader/homeView.ts). La telemetría y la evidencia se registran igual en los dos modos, de modo que el equipo no pierde información al usar la aplicación como la usaría una persona ciega.

### 7.5.9 Retroalimentación auditiva continua

Como el usuario no ve la pantalla, todo cambio de estado del sistema que le importe se comunica con un sonido o una frase. Una acción sin respuesta audible no se distingue de una falla, por lo que el criterio adoptado fue que ninguna acción del usuario ni ningún cambio relevante del sistema quede en silencio. La Tabla 28 resume lo que se escucha en cada situación. Los avisos de enlace, red, modo, preparación, tono de inicio y salida de audio forman un catálogo cerrado (app/src/features/audio/notices.ts); los resultados, los errores y la espera por cuota son frases que arma el servicio de lectura.

Tabla 28: Lo que el usuario escucha en cada situación y qué lo reproduce.

| **Situación** | **Lo que se escucha** | **Quién lo reproduce** |
|---|---|---|
| El dispositivo queda listo para usarse (modo producto) | “Dispositivo emparejado”, una sola vez (sec. 7.5.10) | Siempre el teléfono |
| Se establece el enlace y queda lista la red WiFi (modo desarrollo) | “Dispositivo conectado” y luego “Red con el dispositivo lista” | Siempre el teléfono |
| Se pierde el enlace, o la red WiFi falla o no sirve | “Se perdió la conexión con el dispositivo. Buscalo de nuevo” o un aviso de que se sigue intentando | Siempre el teléfono |
| Cambio de modo con el botón | “Esperando. Reconocimiento apagado”, “Modo ómnibus activado” o “Modo supermercado activado” | El teléfono o el dispositivo, según la salida elegida |
| Modo ómnibus pedido antes de que el OCR esté cargado | “Modo ómnibus. Preparando la lectura, esperá unos segundos” | Ídem |
| Pedido de una lectura de supermercado | Un tono breve de confirmación | Ídem |
| Resultado de una lectura | La frase del producto o de la línea y el destino | Ídem |
| Cambio de la salida de audio y prueba de audio | “Dónde se escucha: en el dispositivo” (o en el teléfono) y una frase de prueba | Ídem |
| Un error o una espera por cuota | Una frase fija en lenguaje llano, sin el texto técnico del error (ADR 0011) | Siempre el teléfono |

La división entre los dos reproductores responde a cuándo ocurre cada aviso. Los relacionados con el enlace y la red se escuchan mientras el usuario está emparejando el dispositivo, con el teléfono en la mano, y además el dispositivo no puede anunciar su propia ausencia; por eso los dice siempre el teléfono. Las frases de error y de espera también las dice el teléfono, porque se generan con la síntesis de voz del sistema y no tienen un archivo pregrabado en el dispositivo. El resto se escucha con los lentes puestos y el teléfono guardado, y sale por donde el usuario eligió (sec. 7.5.4). Los avisos de sistema y los anuncios de líneas están pregrabados en la tarjeta de memoria del dispositivo (sec. 7.3.12), de modo que se escuchan sin conexión a internet. El resultado de una lectura de supermercado, en cambio, se sintetiza en la nube cuando la salida elegida es el dispositivo; si esa síntesis no está disponible, se dice por el teléfono.

En el modo ómnibus el dispositivo habla por su cuenta, sin intervención del teléfono: anuncia que se acerca un ómnibus cuando confirma su presencia y luego la línea y el destino, una sola vez por vehículo (sec. 7.3.9). Para no saturar al usuario, el sistema no emite audio que no haya sido solicitado por un gesto o por el modo activo (sec. 7.1.2).

La retroalimentación auditiva convive con el lector de pantalla del teléfono, que también habla. La sesión de audio se configura para mezclarse con él en lugar de interrumpirlo (sec. 7.5.4), y cuando una acción de la interfaz genera un anuncio propio, éste se demora lo necesario para no superponerse con la lectura del lector de pantalla, como en el cambio de modo de la aplicación (sec. 7.5.8). La salida física de estos sonidos en el dispositivo, un transductor de conducción ósea que deja los oídos libres para los sonidos de la calle, se describe en la sec. 7.2.2, y la evolución de esa salida en la sec. 11.2.

### 7.5.10 Ajustes a partir del uso del producto completo

Con la carcasa final armada y el audio del dispositivo funcionando, el equipo usó el sistema como lo usaría una persona ciega: encender el dispositivo, abrir la aplicación y alternar entre los modos con el botón. Ese uso, en noviembre de 2026, mostró cuatro defectos que las pruebas por componente no habían revelado, porque todos dependían del orden en que ocurren los eventos al combinarse el teléfono, la red y el dispositivo. Se corrigieron en dos cambios (PR #140, del 20 de noviembre, y PR #141, del 23 de noviembre de 2026), y los tres primeros se verificaron sobre el dispositivo con la versión distribuida por TestFlight.

El primero fue que iOS pedía permiso para unirse a la red “ViroVision” cada vez que se encendía el dispositivo y se abría la aplicación, aunque el teléfono ya se hubiera unido antes. La causa estaba en el orden de los tiempos: tras encenderse, el dispositivo levanta su punto de acceso unos segundos después de anunciarse por Bluetooth, y el teléfono tarda cerca de diez segundos en volver por su cuenta a una red ya conocida, mientras que la aplicación sólo esperaba unos dos segundos antes de pedirle la red al sistema, y iOS muestra el permiso cada vez que se le pide una red en la que el teléfono no está. Se optó por recordar en el teléfono qué red del dispositivo ya se había aceptado y, para esa red, esperar a que el sistema se reasocie solo, hasta 20 segundos, en lugar de pedírsela (app/src/services/storage/joinedNetwork.ts y app/src/services/wifi/join.ts). El pedido explícito queda para una lectura de supermercado que necesita la fotografía. La limitación que permanece es que, si el teléfono está conectado al WiFi de la casa, iOS no lo abandona por su cuenta, y en ese caso el permiso sigue apareciendo al usar el modo supermercado.

El segundo fue un error de cámara en la primera lectura de supermercado después de conectar, que desaparecía al cerrar y abrir la aplicación. La telemetría (sec. 9.7.4) mostró que no era una única causa. En el caso registrado el 20 de noviembre a las 12:16, la red y la cámara estaban listas, pero el pedido de la fotografía llegó en el mismo instante en que el dispositivo pasaba del modo ómnibus al de supermercado, y la captura coincidió con el bucle de cuadros del modo ómnibus, que todavía no había liberado la cámara; la captura quedó bloqueada, la cámara no pudo reiniciarse y el servicio se reinició, lo que explica que el problema desapareciera al reconectar. En otros casos la fotografía se pedía mientras el teléfono todavía se estaba uniendo a la red del dispositivo, o mientras la cámara terminaba de cargar su firmware después del encendido. La corrección actúa en los dos extremos: en el dispositivo, la captura espera hasta 4 segundos a que el modo ómnibus libere la cámara (hardware/raspi/virovision/bus.py); en la aplicación, la lectura espera a que el cambio de modo llegue al dispositivo, a que la red esté lista (con el aviso “Conectando con el dispositivo” si la espera supera los 3 segundos) y reintenta mientras la cámara se inicia, todo dentro de un tope de 30 segundos por lectura (app/src/features/reader/readingService.ts). Cuando la espera no alcanza, el usuario escucha una frase fija que distingue la red de la cámara, en lugar del genérico “no se pudo sacar la foto” (ADR 0011).

El tercero fue la superposición de audios al cambiar de modo. Si el usuario pasaba de supermercado a ómnibus mientras una lectura estaba en curso, el resultado de supermercado, por ejemplo “elemento no reconocido”, se escuchaba encima de “modo ómnibus activado” y de los anuncios de líneas. Nada cancelaba la lectura pendiente (la consulta a la nube, la síntesis y el envío al dispositivo), y en el dispositivo la cola de anuncios de ómnibus empezaba a sonar sin esperar a que terminara el audio anterior. Se estableció que un cambio de modo detiene la voz del teléfono y la del dispositivo y cancela la lectura en curso, que termina en silencio; que cada audio enviado al dispositivo indica el modo para el que se generó, y el dispositivo descarta el que corresponde a un modo que ya se dejó; y que la cola de anuncios espera a que termine la frase anterior (hardware/raspi/virovision/audio.py y http_server.py). Con el mismo criterio, la aplicación descarta los anuncios de ómnibus que llegan después de haber salido de ese modo.

El cuarto no era una falla sino una cuestión de claridad. Al conectar, la aplicación decía dos frases, “Dispositivo conectado” cuando se establecía el enlace Bluetooth y “Red con el dispositivo lista” cuando quedaba lista la red WiFi. Para el equipo esa distinción es útil, porque separa un problema de Bluetooth de uno de red; para el usuario, en cambio, eran dos pasos de algo que parecía poder fallar todavía, sin nada que hacer entre uno y otro. Desde el 23 de noviembre de 2026 el modo producto dice una sola frase, “Dispositivo emparejado”, cuando el dispositivo está listo para usarse, y el modo desarrollo conserva las dos (app/src/features/device/pairedNotice.ts). Se consideró listo el momento en que la red del dispositivo responde, porque es lo que necesita el modo supermercado; pero como el modo ómnibus funciona sin esa red, la frase también se dice cuando el teléfono está en otra red y, como último recurso, a los 25 segundos de establecido el enlace, de modo que una conexión nunca quede en silencio (sec. 7.5.9). Si la red falla, se escucha sólo el aviso de la falla, y “Dispositivo emparejado” recién cuando la red vuelve, para que no parezca que la falla se resolvió.

Los cuatro casos comparten una característica: cada componente funcionaba bien por separado, y el defecto aparecía en la secuencia completa de encender, conectar y cambiar de modo. Esto refuerza la regla metodológica de la sec. 5.2.2 de validar sobre el hardware real, y la utilidad de la telemetría para reconstruir esa secuencia cuando el usuario sólo puede describir lo que escuchó.

## 7.6 La accesibilidad como criterio de diseño

### 7.6.1 Fundamento

Las reglas de trabajo para la accesibilidad se derivan del trabajo de Mascetti et al. \[56\] sobre accesibilidad en frameworks multiplataforma, que documenta que estos exponen sólo una parte de las capacidades de accesibilidad nativas. Las reglas son tres:

1. Preferir componentes estándar correctamente anotados, que heredan el comportamiento del sistema operativo.
1. Evitar interfaces muy personalizadas, que son el punto débil identificado en ese trabajo.
1. Considerar la verificación con lectores de pantalla reales y las pruebas con personas ciegas como etapas obligatorias.

Por ejemplo, la barra de navegación es la barra nativa del sistema y no una dibujada en JavaScript, porque así hereda el manejo del foco, el rotor del lector de pantalla, los tamaños de texto dinámicos y la preferencia de movimiento reducido.

### 7.6.2 Reglas de diseño adoptadas

Cinco reglas, reunidas en la Tabla 29, se aplican en todo el código como criterio de aceptación de cualquier cambio de interfaz.

Tabla 29: Reglas de diseño accesible adoptadas como criterio de aceptación.

| **Regla** | **Implicación** |
|---|---|
| El estado nunca se comunica sólo por color | El color refuerza; el texto es lo que pronuncia el lector de pantalla |
| Un control ausente no comunica ningún estado | Un control que no se puede usar se deshabilita, con una pista que explica el motivo, en lugar de ocultarse |
| El botón cambia, no se reemplaza | Si un control se reemplaza por otro, el lector de pantalla pierde el foco |
| La voz es la interfaz | Una falla silenciosa deja al usuario esperando una respuesta que no llega |
| El silencio no es un resultado válido | Toda ejecución termina en un mensaje pronunciado |

Otras decisiones puntuales fueron:

1. Las tipografías se incluyen en el binario y no se cargan durante la ejecución, porque un cambio de fuente durante el arranque desplaza los elementos de la pantalla, lo que desorienta especialmente a una persona con baja visión.
1. El verde de la marca no alcanza sobre el fondo claro la relación de 3:1 que WCAG 1.4.11 exige al borde de un control (llega a 2,44:1) \[57\], por lo que el botón principal lleva un contorno verde más oscuro que sí la cumple, con 7,19:1.
1. Cuando se agota la cuota de un servicio, la espera se anuncia, porque para quien no ve la pantalla una aplicación que espera no se distingue de una bloqueada.
1. Una segunda lectura solicitada durante una lectura en curso se ignora en lugar de encolarse, porque al terminar la primera la segunda correspondería a una escena que el usuario ya dejó atrás. Es una excepción conocida a la regla de que ninguna acción quede en silencio (sec. 7.5.9): el gesto no tiene una respuesta propia, aunque el usuario escucha enseguida el resultado de la lectura en curso, y el pedido ignorado se registra en la telemetría.
1. Una vez descargada la fotografía, la consulta de supermercado tiene un plazo de 12 segundos, unas cuatro veces el ciclo de unos 3 segundos previsto en el ADR 0003, recortado a lo que quede del tope general. Cada intento de descarga de la fotografía tiene un plazo de hasta 7 segundos, recortado también a lo que quede del tope, y la preparación y la consulta, con todas sus esperas, un tope conjunto de unos 30 segundos (sec. 7.5.10). Si vence uno de esos plazos, el usuario escucha una frase fija, porque una lectura que se prolonga hasta que el sistema detiene la aplicación es una lectura que el usuario nunca escucha. La entrega del audio al dispositivo, que incluye la síntesis en la nube y el envío, tiene un plazo aparte de 8 segundos; si vence, el resultado se dice por el teléfono.

### 7.6.3 Decisiones de producto tomadas por accesibilidad

Algunas decisiones no surgieron de una medición de rendimiento sino del criterio de accesibilidad.

La primera se refiere al selector de modelo de nube. Ese selector se recorre opción por opción con el lector de pantalla, por lo que cada opción adicional agrega un gesto antes de llegar a la lectura. Se dejaron dos modelos, el más rápido y el predeterminado, que no depende de la cuota del plan gratuito (sec. 7.4.2), y se retiraron otros dos que funcionaban correctamente. Desde noviembre de 2026 el selector sólo se muestra en el modo desarrollo de la aplicación (sec. 7.5.6).

La segunda es el uso de un único tema visual (ADR 0010). Se retiró el selector de tema claro u oscuro y se verificó automáticamente el contraste: el color de advertencia alcanza una relación de 10,97:1 sobre el fondo, por encima del nivel AAA de WCAG (7:1) exigido para texto.

La tercera es la reducción de la información en pantalla. En dos etapas se retiró de la interfaz la información de diagnóstico (tiempos, modelo que respondió, texto sin procesar del reconocedor y botones de medición), porque correspondía a una herramienta de desarrollo dentro de una aplicación destinada a personas que no ven la pantalla. Esa información se envía a la telemetría (sec. 9.7.4).

### 7.6.4 La fotografía en pantalla

En el modo desarrollo la aplicación muestra la fotografía capturada por el dispositivo después de los campos del resultado. El orden responde a que la voz ya pronunció el resultado y el lector de pantalla debe llegar primero a lo que puede leer. La imagen sirve para que un usuario con resto visual o un acompañante verifique el resultado, y permite distinguir un error del modelo de una fotografía mal tomada.

El modo ómnibus no tenía un equivalente, porque el dispositivo lee de forma autónoma y por Bluetooth sólo llegaba el resultado. Desde el 12 de octubre de 2026 el dispositivo guarda, por cada ómnibus, el cuadro en que lo detectó y cada recorte del cartel que pasó al OCR; la aplicación los descarga por WiFi y luego los sube al almacenamiento privado del servidor (sec. 7.3.9 y 8.6.3). Desde el 13 de octubre la pantalla de inicio los muestra agrupados por ómnibus: el cuadro y, debajo de cada lectura, su texto y el recorte. El recorte es exactamente el que leyó el OCR, con sus márgenes, de modo que si el “1” de una línea quedó fuera o junto al borde, se ve en la imagen. Desde el 2 de noviembre estas imágenes sólo se muestran en el modo desarrollo (sec. 7.5.8) y, como el resto de la evidencia, se retirarán antes de la versión final.

## 7.7 Alternativas evaluadas y descartadas

A lo largo del desarrollo se evaluaron alternativas que no llegaron al sistema final. Varias se describen en la sección del componente correspondiente; la Tabla 30 las reúne con el motivo de su descarte, para que se lean en conjunto. En la mayoría de los casos el descarte no se debió a que la alternativa fuera peor en abstracto, sino a una restricción concreta del proyecto: la memoria del sensor, la potencia de la placa, el tiempo de respuesta objetivo o la cantidad de personas del equipo.

Tabla 30: Alternativas evaluadas y descartadas, con el motivo del descarte.

| **Alternativa** | **Motivo del descarte** |
|---|---|
| Modelo multimodal ejecutado en el teléfono (Gemma con LiteRT-LM) | La visión no funcionó en iOS con tres modelos distintos, de 756 MB a 2,5 GB |
| Modelo multimodal ejecutado en el teléfono con ExecuTorch | Funcionó, pero requería 3 GB de descarga inicial, unos 4 s de carga y 6,4 s por inferencia, muy por encima del tiempo objetivo |
| Audio por Bluetooth Classic (A2DP) | Agrega entre 150 y 250 ms de codificación y comparte la antena con BLE y WiFi |
| Acelerador Coral TPU por USB | Reemplazado por la inferencia en el sensor (sec. 7.2.6) |
| Detector de dos etapas en el dispositivo | El segundo modelo no entra en el sensor (sec. 7.3.5) |
| Realce de contraste (CLAHE) sobre el recorte del cartel | Empeoró el acierto del número de 87,5% a 77,1% |
| Modo de sensor completo para un zoom de hasta 4× | En la Zero 2 W redujo la tasa a 10 cuadros por segundo y bloqueó la cámara (sec. 7.3.10) |
| Una segunda aplicación para pruebas internas | Con tres desarrolladores alcanza con cambiar de versión desde la plataforma de distribución; una segunda aplicación exige su propia ficha y revisión |
