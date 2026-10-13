# 6. Planificación

El proyecto se desarrolla en un período de aproximadamente nueve meses, desde **marzo de 2026** hasta
el **30 de noviembre de 2026**, fecha límite de entrega. El desarrollo se planificó para cerrar a
**mediados de noviembre**, reservando deliberadamente las últimas dos semanas para integración
final, corrección de defectos y pruebas conjuntas de los tres pilares.

Aunque la metodología de trabajo es ágil (§5.1), se complementó con una **línea de referencia
temporal**: un desglose de entregables con estimación de complejidad y tiempo, y un cronograma de
hitos que ordena las dependencias entre pilares. El sentido de esa línea de referencia en un
proyecto iterativo no es fijar el contenido de cada semana, sino hacer visibles las **dependencias
duras** (qué no puede empezar hasta que otra cosa termine) y las **paralelizaciones posibles**, que
es lo que permite que tres personas trabajen sobre tres dominios distintos sin bloquearse.

`[FIGURA 6.1: Diagrama de Gantt, vista mensual del proyecto, marzo a noviembre de 2026, con las
cinco etapas y los hitos de entrega.]`

`[FIGURA 6.2: Diagrama de Gantt con dependencias e hitos. Muestra qué tareas bloquean a cuáles
entre los tres pilares.]`

## 6.1 Estructura del desglose y medición del avance

El desglose de entregables se organiza en épicas y subtareas. A cada subtarea se le asigna una
estimación de **complejidad** y de **tiempo**, de las que se deriva un **peso ponderado**. El avance
del proyecto se calcula entonces como la relación entre los pesos alcanzados y el total, y no como
una apreciación subjetiva del equipo.

Esta mecánica fue la base de la instancia formal de avance: al momento de esa entrega la planilla
registraba **211 puntos ponderados totales y 99 alcanzados (46,9 %)**, cifra que el equipo utilizó
para justificar un avance superior al 30 % exigido, argumentando que las etapas fundacionales
(validación del problema con usuarios, priorización de casos de uso, selección tecnológica y
planificación) ya estaban cerradas con evidencia verificable.

## 6.2 Etapa 0: investigación y validación (marzo a junio de 2026)

La primera etapa estuvo orientada a **validar que el problema existía** antes de comprometerse con
una solución técnica, y a delimitar el alcance.

Actividades principales:

- Relevamiento con la población objetivo: encuesta distribuida con apoyo de la UNCU (**26
  respuestas**) y entrevista en profundidad a un usuario ciego.
- Análisis cuantitativo y cualitativo de las respuestas. El resultado ordenó las prioridades del
  proyecto: en transporte, el problema más reportado fue **saber qué línea se aproxima**; en
  supermercados, la lectura de precios y vencimientos y la identificación de productos.
- Revisión de soluciones existentes (OrCam MyEye, Microsoft Seeing AI, Google Lookout) y de sus
  limitaciones en el contexto local.
- Redacción de la propuesta: problema, alcance, objetivos generales y específicos, entregables.
- Primer trazado del estado del arte y del marco teórico.

Esta etapa produjo además las dos restricciones que gobiernan todo el diseño posterior: **la
accesibilidad como criterio de diseño y no como una capa**, y el **funcionamiento sin conectividad**
para las capacidades esenciales.

## 6.3 Etapa 1: andamiaje y arquitectura inicial (julio de 2026)

Con el alcance definido, la segunda etapa construyó la infraestructura sobre la que iba a correr
todo lo demás. El criterio fue tener, lo antes posible, un camino completo desde el repositorio
hasta un teléfono real.

- Estructura del monorepo con los tres pilares.
- Aplicación móvil inicial en React Native (Expo), con una pantalla accesible y síntesis de voz
  funcionando.
- Integración continua: análisis estático, verificación de tipos, pruebas y compilación de prueba en
  cada *pull request*.
- Primeros documentos de decisión: **ADR 0001** (offline-first, inferencia local) y **ADR 0002**
  (capa de cuenta).
- Definición del modelo de dos ramas y del flujo de trabajo (§5.5).

Dos resultados de esta etapa condicionaron el resto del proyecto. El primero fue la regla de no
apilar *pull requests*, aprendida a costa de un conflicto de fusión. El segundo fue la decisión,
tomada a fines de julio, de **publicar la aplicación sin inicio de sesión**: el núcleo del producto
es offline y una cuenta no agregaba valor al usuario, de modo que la capa de autenticación quedó
implementada pero archivada.

## 6.4 Etapa 2: exploración técnica y definición de pipelines (agosto de 2026)

Esta etapa concentró el mayor riesgo técnico del proyecto: determinar **qué se puede ejecutar
localmente y qué no**.

- **Reunión de seguimiento con el director (10 de agosto).** De ella surgió la propuesta de una
  pasarela de modelos que permita derivar una inferencia a la nube cuando hay cobertura y eso aporta
  precisión, manteniendo lo local como respaldo garantizado. Se formalizó como enmienda al ADR 0001.
- **Spike de visión local (12 y 13 de agosto).** Se midieron los cuatro caminos posibles de
  inferencia multimodal sobre un teléfono real. El hallazgo estructural fue que la limitación no
  estaba en el hardware del teléfono sino en el estado de las librerías disponibles.
- **Definición de pipelines por caso de uso (ADR 0006)** y del **modelo de interacción por gestos
  del botón físico (ADR 0007)**, acordados en reunión de equipo.
- Identidad visual y manual de marca.
- Primer envío a distribución interna y configuración de los dos canales de publicación.

Al cierre de la etapa quedó definida la arquitectura que el proyecto sostiene hasta hoy: **el modo
ómnibus se resuelve localmente y el modo supermercado en la nube**, cada uno con su propio pipeline.

## 6.5 Etapa 3: integración, hardware y medición (septiembre de 2026)

La etapa en la que el sistema pasó de componentes separados a un producto que funciona de punta a
punta, y en la que se concentran las campañas de medición que sustentan el capítulo 7.

- **Modo supermercado completo** y **ADR 0008**: las claves de los proveedores de nube salen del
  binario de la aplicación y pasan a un proxy propio.
- **Campaña de medición de modelos de nube (2 de septiembre).** Cambió dos decisiones de producto y
  puso en evidencia tres defectos que no eran visibles de otro modo.
- **ADR 0003 y campaña de throughput BLE (4 y 5 de septiembre).** El resultado obligó a rediseñar el
  enlace: BLE como plano de control, WiFi como plano de datos.
- **Dispositivo físico**: daemon en la Raspberry Pi, botón físico, alimentación con batería, cámara
  con inferencia en el sensor.
- **Camino de ómnibus** integrado desde el repositorio de visión hasta la placa.
- **ADR 0009** (idioma del código) y **ADR 0010** (un solo tema).
- **Hito principal de la etapa (15 de septiembre): el modo ómnibus corre entero en la placa, con
  1,27 segundos entre el gesto del usuario y la línea anunciada.**

## 6.6 Etapa 4: validación en campo y cierre (octubre a noviembre de 2026)

La etapa final, en ejecución al momento de redactar este informe, comprende:

- **Pruebas en campo reales**: una parada de ómnibus con vehículos en movimiento y una góndola de
  supermercado. Toda la evaluación del modo ómnibus realizada hasta ahora se hizo contra video
  reproducido en pantalla, y cerrar esa brecha es la prioridad de la etapa.
- **Construcción del conjunto de evaluación del modo supermercado**, con fotografías tomadas por el
  propio dispositivo.
- **Medición del costo de la cuantización INT8** del detector, hoy no cuantificado.
- **Entrenamiento del detector en la GPU** puesta a disposición por Arnaldo Castro. El acceso al
  servidor ya está disponible; los entrenamientos realizados hasta la fecha corrieron en CPU.
- **Cierre del hardware**: conversor digital-analógico I2S para el audio, lectura del monitor de
  batería, medición del consumo real y diseño e impresión de la carcasa.
- **Pruebas de usabilidad con usuarios ciegos** y ajuste de los tiempos de interacción.
- **Documentación final**, presentación y demostración.
- Dos semanas de reserva antes del 30 de noviembre para integración, corrección y pruebas conjuntas.

## 6.7 Riesgos identificados y su tratamiento

| Riesgo | Estado | Mitigación adoptada |
|---|---|---|
| El enlace inalámbrico no alcanza para mover la imagen | **Materializado** | Medido antes de depender de él; rediseño a dos planos (§7.2) |
| La inferencia multimodal local no es viable en el teléfono | **Materializado** | Spike de dos días; se adoptó un pipeline por caso de uso |
| Rotura del hardware de desarrollo | **Materializado** | El conector de cámara de la placa original se rompió; se continuó sobre una placa prestada, dejando constancia de que las mediciones de radio no son transferibles |
| Dependencia de servicios de nube con cuota gratuita | Vigente | Proxy propio que permite rotar o cortar una clave sin publicar una versión; tope de gasto configurado en cada proveedor |
| Pausa automática del proyecto de backend por inactividad | **Materializado** | Documentado como riesgo operativo; requiere actividad periódica |
| La precisión del detector cuantizado es desconocida | Vigente | Receta de validación preparada; medición pendiente (§7.4) |
| Evaluación realizada sobre video y no sobre la calle | Vigente | Prioridad de la etapa 4 |
