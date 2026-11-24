# 6. Planificación

El proyecto se desarrolló en un período de aproximadamente nueve meses, desde marzo de 2026 hasta el 30 de noviembre de 2026, fecha límite de entrega. El desarrollo se planificó para cerrar a mediados de noviembre, reservando deliberadamente las últimas dos semanas para integración final, corrección de defectos y pruebas conjuntas de los tres pilares.

Aunque la metodología de trabajo fue ágil (sec. 5.1), se complementó con una línea de referencia temporal (anexo 13.1): un desglose de entregables con estimación de complejidad y tiempo, y un cronograma de hitos que ordena las dependencias entre pilares. El sentido de esa línea de referencia en un proyecto iterativo no era fijar el contenido de cada semana, sino hacer visibles las dependencias duras (qué no puede empezar hasta que otra cosa termine) y las paralelizaciones posibles, lo que permitió que tres personas trabajaran sobre tres dominios distintos sin bloquearse.

## 6.1 Estructura del desglose y medición del avance

El desglose de entregables se organizó en épicas y subtareas. A cada subtarea se le asignó una estimación de complejidad y de tiempo, de las que se derivó un peso ponderado. El avance del proyecto se calculó entonces como la relación entre los pesos alcanzados y el total, y no como una apreciación subjetiva del equipo.

Esta mecánica fue la base de la instancia formal de justificación de 30% de avance: al momento de esa entrega la planilla registraba 211 puntos ponderados totales y 99 alcanzados (46,9%), cifra que el equipo utilizó para justificar un avance superior al 30% exigido, argumentando que las etapas fundacionales (validación del problema con usuarios, priorización de casos de uso, selección tecnológica y planificación) ya estaban cerradas con evidencia verificable.

## 6.2 Etapa 0: investigación y validación (marzo a junio de 2026)

La primera etapa estuvo orientada a validar que el problema existía antes de comprometerse con una solución técnica, y a delimitar el alcance.

Actividades principales:

1. Relevamiento con la población objetivo: encuesta distribuida con apoyo de la UNCU (26 respuestas) y entrevista semiestructurada a un usuario ciego.
1. Análisis cuantitativo y cualitativo de las respuestas. El resultado ordenó las prioridades del proyecto: en transporte, el problema más reportado fue saber qué línea se aproxima; en supermercados, la lectura de precios y vencimientos y la identificación de productos.
1. Revisión de soluciones existentes (OrCam MyEye, Microsoft Seeing AI, Google Lookout) y de sus limitaciones en el contexto local.
1. Redacción de la propuesta: problema, alcance, objetivos generales y específicos, entregables.
1. Primer trazado del estado del arte y del marco teórico.

Esta etapa produjo además las dos restricciones que gobiernan todo el diseño posterior: la accesibilidad como criterio de diseño y no como una capa, y el funcionamiento sin conectividad para las capacidades esenciales.

## 6.3 Etapa 1: andamiaje y arquitectura inicial (julio de 2026)

Con el alcance definido, la segunda etapa construyó la infraestructura sobre la que iba a correr todo lo demás. El criterio fue tener, lo antes posible, un camino completo desde el repositorio hasta un teléfono real.

1. Estructura del monorepo con los tres pilares.
1. Aplicación móvil inicial en React Native (Expo), con una pantalla accesible y síntesis de voz funcionando.
1. Integración continua: análisis estático, verificación de tipos, pruebas y compilación de prueba en cada *pull request*.
1. Primeros documentos de decisión: ADR 0001 (offline-first, inferencia local) y ADR 0002 (capa de cuenta).
1. Definición del modelo de dos ramas y del flujo de trabajo (sec. 5.5).

Dos resultados de esta etapa condicionaron el resto del proyecto. El primero fue la regla de no apilar *pull requests*, aprendida a costa de un conflicto de fusión. El segundo fue la decisión, tomada a fines de julio, de publicar la aplicación sin inicio de sesión: el núcleo del producto es offline y una cuenta no agregaba valor al usuario, de modo que la capa de autenticación quedó implementada pero archivada.

## 6.4 Etapa 2: exploración técnica y definición de pipelines (agosto de 2026)

Esta etapa concentró el mayor riesgo técnico del proyecto: determinar qué se puede ejecutar localmente y qué no.

1. Reunión de seguimiento con el director (10 de agosto). De ella surgió la propuesta de una pasarela de modelos que permita derivar una inferencia a la nube cuando hay cobertura y eso aporta precisión, manteniendo lo local como respaldo garantizado. Se formalizó como enmienda al ADR 0001.
1. Spike de visión local (12 y 13 de agosto). Se midieron los cuatro caminos posibles de inferencia multimodal sobre un teléfono real. El hallazgo estructural fue que la limitación no estaba en el hardware del teléfono sino en el estado de las librerías disponibles.
1. Definición de pipelines por caso de uso (ADR 0006) y del modelo de interacción por gestos del botón físico (ADR 0007), acordados en reunión de equipo.
1. Identidad visual y manual de marca.
1. Primer envío a distribución interna y configuración de los dos canales de publicación.

Al cierre de la etapa quedó definida la arquitectura que el proyecto sostuvo hasta el final: el modo ómnibus se resuelve localmente y el modo supermercado en la nube, cada uno con su propio pipeline.

## 6.5 Etapa 3: integración, hardware y medición (septiembre de 2026)

La etapa en la que el sistema pasó de componentes separados a un producto que funciona de punta a punta, y en la que se concentran las campañas de medición que sustentan el capítulo 7.

1. Modo supermercado completo y ADR 0008: las claves de los proveedores de nube salen del binario de la aplicación y pasan a un proxy propio.
1. Campaña de medición de modelos de nube (2 de septiembre). Cambió dos decisiones de producto y puso en evidencia tres defectos que no eran visibles de otro modo.
1. ADR 0003 y campaña de throughput BLE (4 y 5 de septiembre). El resultado obligó a rediseñar el enlace: BLE como plano de control, WiFi como plano de datos.
1. Dispositivo físico: daemon en la Raspberry Pi, botón físico, alimentación con batería, cámara con inferencia en el sensor.
1. Camino de ómnibus integrado desde el repositorio de visión hasta la placa.
1. ADR 0009 (idioma del código) y ADR 0010 (un solo tema).
1. Hito principal de la etapa (15 de septiembre): el modo ómnibus corre entero en la placa, con 1,27 segundos entre el gesto del usuario y la línea anunciada.

## 6.6 Etapa 4: validación en campo y cierre (octubre a noviembre de 2026)

La etapa final comprendió las tareas siguientes; para cada una se indica su estado al cierre de este informe.

- Pruebas en campo reales: una parada de ómnibus con vehículos en movimiento y una góndola de supermercado. Salvo una prueba de campo preliminar el 19 de octubre de 2026 (sec. 7.3.10), la evaluación del modo ómnibus se hizo contra video reproducido en pantalla, y cerrar esa brecha fue la prioridad de la etapa. Parcial: la prueba sistemática en la calle no se realizó (sec. 9.4.4).
- Construcción del conjunto de evaluación del modo supermercado, con fotografías tomadas por el propio dispositivo. No realizada (sec. 9.5).
- Medición del costo de la cuantización INT8 del detector, que no se pudo realizar porque el modelo convertido sólo se carga en el entorno del fabricante (sec. 9.4.1).
- Entrenamiento del detector en la GPU puesta a disposición por Arnaldo Castro. Realizado: se ejecutó el 15 de octubre, con 395 fotografías y 120 épocas; el primer ajuste fino, en CPU, había usado 140 imágenes y 40 épocas. El mAP@0,5:0,95 del detector pasó de 0,391 a 0,739 (sec. 7.3.4 y 9.4.1).
- Alcance de lectura del cartel: zoom digital del procesador de imagen sobre el cartel (19 de octubre, probado en la placa el 22) y ajuste de los márgenes del recorte (21 y 22 de octubre). Realizado y medido contra video; sin prueba en la calle.
- Cierre del hardware: la lectura del monitor de batería quedó integrada el 6 de octubre y el arranque bajó a 16 segundos hasta que la placa es visible para el teléfono. La carcasa se diseñó en OpenSCAD y se iteró sobre impresiones de prueba desde el 14 de octubre; la versión 0.20 se imprimió y se armó con todo el hardware el 30 de octubre, y la versión final, la 0.29, se imprimió y se armó (sec. 7.2.8). El audio sale por PWM hacia un amplificador PAM8403, con un filtro de entrada de dos etapas, y de ahí al transductor de conducción ósea (sec. 7.2.2). Realizado, salvo la medición del consumo real, que queda pendiente.
- Pruebas de usabilidad con usuarios ciegos y ajuste de los tiempos de interacción. No realizadas (sec. 9.9).
- Documentación final, presentación y demostración. Documentación realizada; presentación y demostración, previstas para la defensa.
- Dos semanas de reserva antes del 30 de noviembre para integración, corrección y pruebas conjuntas. Realizada: en ellas se hizo la integración del producto completo y sus ajustes (sec. 7.5.10) y la segunda revisión del código (sec. 9.7.5).

## 6.7 Riesgos identificados y su tratamiento

La Tabla 9 reúne los riesgos del proyecto. Sólo dos se identificaron al inicio, ambos técnicos y ambos tratados de la misma forma, midiendo antes de depender del supuesto; el resto apareció durante el desarrollo, a medida que se incorporaban componentes o se revisaba el código, y se registró en ese momento. El estado distingue los riesgos que se materializaron, los que siguen vigentes al cierre y los que el equipo aceptó para el prototipo de forma explícita. [PENDIENTE: el equipo debe asignar a cada riesgo una probabilidad y un impacto (por ejemplo, alto, medio o bajo); no se registraron durante el proyecto y no se agregan aquí sin su criterio.]

Tabla 9: Riesgos del proyecto, momento en que se identificaron, estado y mitigación.

| **Riesgo** | **Identificación** | **Estado** | **Mitigación adoptada** |
|---|---|---|---|
| El enlace inalámbrico no alcanza para mover la imagen | Al inicio, antes de medir | Materializado | Medido antes de depender de él; rediseño a dos planos (sec. 7.1.5) |
| La inferencia multimodal local no es viable en el teléfono | Al inicio | Materializado | Spike de dos días; se adoptó un pipeline por caso de uso |
| Rotura del hardware de desarrollo | Durante (septiembre) | Materializado | El conector de cámara de la placa original se rompió; se continuó sobre una placa prestada (Raspberry Pi 3 B+), dejando constancia de que las mediciones de radio no son transferibles. El 19 de septiembre se volvió a la Raspberry Pi Zero 2 W, y con ella vuelven a valer las mediciones de radio originales. A comienzos de noviembre la placa volvió a dañarse y se reemplazó; como toda la configuración vive en la tarjeta de memoria, la placa nueva funcionó sin reinstalar nada (sec. 7.2.10) |
| Dependencia de servicios de nube con cuota gratuita | Durante (agosto, al adoptar la nube) | Vigente | Proxy propio que permite rotar o cortar una clave sin publicar una versión; tope de gasto configurado en cada proveedor |
| Pausa automática del proyecto de backend por inactividad | Durante | Materializado | Documentado como riesgo operativo; requiere actividad periódica |
| La precisión del detector cuantizado es desconocida | Durante (septiembre, al convertir el modelo) | Vigente | Receta de validación preparada; medición pendiente (sec. 7.3) |
| Red local del dispositivo con clave fija y servidor HTTP sin autenticación | Durante (noviembre, revisión de código) | Aceptado | Con una sola unidad y sin adversario plausible en el alcance de la tesis, no se mitiga en el prototipo; para una versión distribuible, clave por unidad y token por sesión (ADR 0003, actualización del 3 de noviembre) |
| Evaluación realizada sobre video y no sobre la calle | Durante (octubre, prueba de campo) | Vigente | Prioridad de la etapa 4; la primera prueba de campo (19 de octubre) mostró que el cartel sólo se leía con el ómnibus muy cerca, lo que motivó el zoom digital |
| Proxy de visión sin autenticación, con un límite de solicitudes por dirección de origen que cada instancia de la plataforma lleva por separado | Durante (septiembre, al diseñar el proxy) | Aceptado | El abuso de la cuota de los proveedores se acota con la lista de destinos permitidos y el tope de gasto configurado en cada proveedor; aceptado para el prototipo (sec. 7.1.6 y 8.6.1) |
| Característica de control BLE sin autenticación | Durante (noviembre, revisión de código) | Aceptado | Un central cercano podría enviar comandos al dispositivo; se acepta en el prototipo, con una sola unidad, y la clave por unidad queda como trabajo futuro (sec. 7.2.3 y 11.6) |
| Función de evidencia sin sesión que guarda fotografías de la vía pública, con personas y matrículas | Durante (octubre) | Vigente | Son datos personales; la función se usa sólo durante el desarrollo, en almacenamiento privado, y debe deshabilitarse antes de la versión final (sec. 8.6.3) |
