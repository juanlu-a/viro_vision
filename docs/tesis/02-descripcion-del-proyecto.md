# 2. Descripción del proyecto

## 2.1 Alcance

El proyecto consiste en el diseño y desarrollo de un sistema de asistencia para personas con baja o nula visión, capaz de reconocer visualmente objetos de interés mediante técnicas de visión por computadora, aprendizaje automático e inteligencia artificial. El sistema está orientado a la identificación de líneas de ómnibus metropolitanos y de productos de supermercado. El alcance original del segundo caso comprendía los productos de la canasta básica. En una primera prueba con el dispositivo real, el modelo identificó, dentro del tiempo de respuesta fijado, los productos de la canasta básica que se probaron, por lo que el alcance se amplió a cualquier alimento y la canasta básica se mantuvo como conjunto de evaluación; la medición sistemática sobre ese conjunto queda pendiente (sec. 7.5.4).

La solución comprende un dispositivo con cámara (acoplado a una patilla de lentes) que captura imágenes del entorno, procesa la información visual y proporciona al usuario retroalimentación auditiva en tiempo real. El dispositivo se integra con una aplicación móvil, que funciona como apoyo para la conectividad, el procesamiento y la interacción con el sistema.

El alcance incluye el desarrollo del prototipo funcional, el entrenamiento o ajuste de modelos de reconocimiento, la vinculación con la aplicación móvil y la validación básica de funcionamiento en escenarios representativos de uso. No necesariamente abarca una implementación comercial final ni una cobertura exhaustiva de todos los objetos posibles del entorno, sino una solución enfocada en casos de uso concretos y relevantes para la autonomía cotidiana del usuario.

## 2.2 Objetivos del proyecto

### 2.2.1 Objetivo general

Desarrollar un dispositivo de asistencia para personas con baja visión que permita reconocer líneas de ómnibus metropolitanos y productos del supermercado mediante técnicas de visión por computadora, aprendizaje automático e inteligencia artificial, brindando retroalimentación auditiva y acoplándose a una aplicación móvil para mejorar la conectividad, el procesamiento y la experiencia de uso.

### 2.2.2 Objetivos específicos

1. Diseñar la arquitectura general del sistema, módulo de reconocimiento y aplicación móvil.
1. Diseñar e implementar el dispositivo físico para la toma de imágenes.

1. Implementar un mecanismo de captura y procesamiento de imágenes orientado a la detección e identificación de líneas de ómnibus, incorporando técnicas de OCR, así como el reconocimiento de productos de supermercado.

1. Entrenar, ajustar (*fine-tuning*) e integrar modelos de aprendizaje automático adecuados para el reconocimiento de los objetos definidos.

1. Desarrollar un sistema de retroalimentación auditiva que comunique al usuario, de forma clara y concreta, el objeto identificado.

1. Integrar el dispositivo con una aplicación móvil que permita gestionar la conectividad, apoyar el procesamiento y facilitar la interacción con el usuario.

1. Evaluar el funcionamiento del prototipo en escenarios de uso representativos, considerando precisión de reconocimiento, tiempo de respuesta y utilidad para el usuario.

1. Diseñar e implementar un criterio de priorización para la retroalimentación auditiva en escenarios con múltiples ómnibus detectados, de modo que el sistema comunique en primer lugar la línea más relevante según su posición o proximidad, pudiendo informar adicionalmente la presencia de otras líneas sin generar sobrecarga auditiva en el usuario.

### 2.2.3 Objetivos opcionales

1. Implementar una funcionalidad de selección por señalamiento que permita que, en el caso de los productos de supermercado, la respuesta auditiva comunique únicamente el objeto que el usuario esté apuntando o tocando con su dedo índice entre los elementos detectados, a fin de reducir respuestas innecesarias y mejorar la experiencia de uso.

Este objetivo no se implementó en el prototipo y se retoma como trabajo futuro (sec. 10.5).

## 2.3 Entregables del proyecto

El proyecto comprendió los siguientes entregables:

1. Documento de contexto y problema: análisis de la situación de personas con discapacidad visual, incluyendo contexto en Uruguay, estadísticas y problemáticas principales.
1. Estado del arte: revisión de trabajos y soluciones existentes hasta la fecha en visión por computadora, OCR y dispositivos asistivos.
1. Relevamiento con usuarios: una entrevista, cuya transcripción se incluye en el anexo 12.4, y un cuestionario distribuido por la UNCU, con el análisis de las necesidades relevadas.
1. Documento de requisitos: definición de requisitos funcionales, no funcionales, restricciones y riesgos del sistema, que se incluye en el anexo 12.12.
1. Diseño de arquitectura: descripción de la arquitectura del sistema, componentes y flujo de información.
1. Prototipo del dispositivo físico: implementación de un dispositivo funcional con cámara y salida de audio.
1. Sistema de visión por computadora: desarrollo e integración de modelos para reconocimiento de ómnibus y productos.
1. Sistema de retroalimentación auditiva: implementación del mecanismo de comunicación auditiva con el usuario.
1. Aplicación móvil: desarrollo de la aplicación para conectividad, configuración e interacción.
1. Integración del sistema completo: integración de todos los módulos en un sistema funcional.
1. Validación del prototipo: pruebas preliminares y evaluación de desempeño; la validación sistemática en condiciones reales de uso queda pendiente (sec. 7.9).
1. Informe final de tesis: documento completo que describe el proyecto, desarrollo y resultados.
1. Presentación y demo: exposición final del proyecto y demostración funcional del sistema.

### 2.3.1 Planilla de seguimiento y cronograma

Como soporte de la planificación y seguimiento del proyecto, el equipo mantiene una planilla de trabajo compartida (anexo 12.1) organizada en dos hojas complementarias. La primera detalla el desglose completo del proyecto por épicas (Tareas generales, Desarrollo de dispositivo físico, Desarrollo de sistema de reconocimiento y Desarrollo de aplicación móvil), especificando para cada subtarea su descripción y estado de avance actual. La segunda hoja traduce este desglose en un diagrama de Gantt, que ubica cada tarea en el tiempo y permite visualizar la carga de trabajo en paralelo entre los integrantes del equipo.

Entre los principales hitos planificados se encuentran: la compra y validación del hardware (cámara, computadora de placa única y auricular) junto con el modelado 3D de la carcasa; la generación de los datasets y el entrenamiento del modelo de reconocimiento de líneas de ómnibus y productos; y el desarrollo e integración de la aplicación móvil, incluyendo las pruebas de accesibilidad con lectores de pantalla nativos y de usabilidad con usuarios ciegos. El cronograma proyecta la finalización del desarrollo hacia mediados de noviembre de 2026, dejando un margen de aproximadamente dos semanas antes de la fecha límite (30 de noviembre) para integración final, corrección de errores y pruebas de conjunto.

Al 12 de noviembre de 2026, la carcasa está terminada: su versión final, la 0.29, se imprimió y se armó con todo el hardware (sec. 7.3.5).

## 2.4 Antecedentes y contexto

La discapacidad visual representa una de las condiciones que más impacta en la autonomía cotidiana de las personas. Según el Informe mundial sobre la visión de la Organización Mundial de la Salud, al menos 2.200 millones de personas en el mundo tienen alguna forma de deficiencia visual, de las cuales al menos 1.000 millones presentan una deficiencia que podría haberse prevenido o que aún no ha recibido tratamiento \[102\]. La ceguera y la baja visión limitan severamente la capacidad de las personas para desenvolverse de forma independiente en entornos urbanos y domésticos.

### 2.4.1 Discapacidad visual en Uruguay

En Uruguay, según el Censo de Población de 2011 del Instituto Nacional de Estadística, 517.771 personas, el 15,9% de la población, declararon tener alguna discapacidad \[103\]. La Unión Nacional de Ciegos del Uruguay (UNCU) es la institución referente en el país para las personas con discapacidad visual, brindando apoyo, formación y representación a sus asociados.

Para complementar estos datos con información directa del colectivo, se distribuyó un cuestionario a través de la Unión Nacional de Ciegos del Uruguay (UNCU) a su red de voluntarios, obteniendo 26 respuestas de personas con discapacidad visual o vinculadas a ella (preguntas 1 a 4, anexo 12.2.1) \[76\]. Se trata de una muestra de conveniencia y autoseleccionada, por lo que sus resultados describen a los participantes y no pueden generalizarse al conjunto de las personas con discapacidad visual del país. No todas las preguntas fueron respondidas por los 26 participantes: las preguntas sobre transporte público y supermercados tuvieron 25 respuestas, y los porcentajes de cada pregunta se calculan sobre la cantidad de respuestas que recibió. El cuestionario relevó tanto aspectos demográficos generales (vínculo con la discapacidad visual, tipo de condición, rango etario y zona de residencia) como la percepción de los propios encuestados respecto a su independencia cotidiana y a las barreras que enfrentan en Uruguay.

Según los encuestados, la independencia cotidiana de una persona ciega o con baja visión depende fuertemente del entorno y del apoyo de terceros, más que de una limitación estrictamente individual (Figuras 1 y 2). Entre las principales barreras identificadas por los propios encuestados se destacan el mal estado de las veredas (92,3%), la falta de empatía o conocimiento social por parte del entorno (73,1%), la falta de señalización sonora (69,2%) y los cruces de calle poco accesibles (61,5%) (Figura 3), lo que indica que gran parte de las dificultades reportadas están asociadas a la infraestructura urbana y a la falta de adaptación del entorno, más que a la ausencia de herramientas tecnológicas. Asimismo, la mitad de los encuestados señala la falta de información digital accesible como una barrera relevante (50%), mientras que la dependencia de otras personas y la falta de información en braille son percibidas como barreras algo menos determinantes (26,9% y 30,8% respectivamente).

<!-- imagen del Doc: figuras/encuesta-p05.png -->

Figura 1: Accesibilidad percibida de Uruguay para una persona ciega o con baja visión (pregunta 5 del cuestionario).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p06.png -->

Figura 2: Independencia que puede alcanzar en su vida diaria una persona ciega o con baja visión en Uruguay (pregunta 6).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p07.png -->

Figura 3: Principales barreras para la independencia cotidiana (pregunta 7).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

Esta percepción se ve confirmada por las respuestas abiertas del cuestionario ante la pregunta sobre en qué situaciones se necesita más ayuda externa (pregunta 10, anexo 12.2.2): la mayoría de los encuestados menciona espontáneamente el transporte público y las compras en supermercados como los contextos donde más se requiere asistencia de terceros, junto con el cruce de calles y avenidas, una tarea que, si bien excede el alcance de este proyecto, refuerza la magnitud de las barreras urbanas identificadas. En cuanto a las herramientas de accesibilidad disponibles, los resultados muestran el grado de conocimiento y uso de las mismas (Figura 4), así como el nivel de confiabilidad percibido (Figura 5).

<!-- imagen del Doc: figuras/encuesta-p08.png -->

Figura 4: Métodos y herramientas de accesibilidad que los encuestados usan o conocen (pregunta 8).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p09.png -->

Figura 5: Confiabilidad percibida de las herramientas de accesibilidad disponibles (pregunta 9).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

La combinación de estos resultados cuantitativos y cualitativos evidencia oportunidades concretas de mejora en las soluciones actualmente disponibles en el país, y sirve como punto de partida para justificar el enfoque de este proyecto en dos de las actividades cotidianas más mencionadas por los propios encuestados: el uso del transporte público y las compras en supermercados.

### 2.4.2 Problemática en el transporte público

El transporte público representa uno de los mayores desafíos para las personas con discapacidad visual en Uruguay. La identificación de la línea de ómnibus correcta en una parada concurrida es una tarea compleja cuando no se cuenta con visión. Los sistemas actuales de información en las paradas, en su mayoría visuales, no proporcionan retroalimentación auditiva de manera consistente. Esto genera una dependencia significativa de otras personas para realizar desplazamientos urbanos que, para la mayoría de la población, son completamente autónomos.

Los resultados del cuestionario UNCU confirman esta problemática de forma concreta. Si bien la mayoría de los encuestados utiliza transporte público de forma habitual (Figura 6), sólo un 8% considera bastante fácil identificar qué ómnibus o línea se aproxima, mientras que un 32% lo califica como muy difícil y un 40% señala que depende del lugar o la situación (Figura 7); es decir, prácticamente ningún encuestado percibe esta tarea como sencilla en todos los contextos. Esto es coherente con lo observado en la pregunta general sobre situaciones donde se necesita más ayuda externa (pregunta 10, anexo 12.2.2), donde el transporte público fue, junto con el cruce de calles, el contexto mencionado con mayor frecuencia por los encuestados. Para resolver esta dificultad, el método más utilizado es preguntar a otra persona en la parada (72% de los encuestados), seguido a distancia por el uso de aplicaciones móviles y por el reconocimiento de referencias del lugar (24% cada uno); sólo un 20% cuenta con la ayuda del conductor o guarda, y apenas un 16% logra identificar la línea a partir de información sonora (Figura 8), lo que muestra que, entre los encuestados, la estrategia predominante sigue siendo la asistencia humana informal antes que cualquier recurso tecnológico o accesible por sí mismo.

<!-- imagen del Doc: figuras/encuesta-p11.png -->

Figura 6: Uso habitual del transporte público (pregunta 11).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p12.png -->

Figura 7: Facilidad para identificar qué ómnibus o línea se aproxima (pregunta 12).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p13.png -->

Figura 8: Métodos utilizados para identificar la línea correcta al esperar un ómnibus (pregunta 13).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

Esta fuerte dependencia de terceros se traduce también en los mayores problemas reportados al usar el transporte público: un 64% de los encuestados señala que su principal dificultad es saber qué línea se aproxima, mientras que un 32% menciona la falta de información sonora y un 28% señala tanto la dificultad para saber dónde está la parada como para saber cuándo bajar (Figura 9).

<!-- imagen del Doc: figuras/encuesta-p16.png -->

Figura 9: Mayores problemas al usar el transporte público (pregunta 16).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

Los testimonios recogidos en las preguntas abiertas del cuestionario (pregunta 17, anexo 12.2.3) ilustran esta realidad con situaciones concretas: encuestados relatan quedar desorientados al no ser avisados de su parada, choferes que detienen el vehículo lejos del cordón dificultando el ascenso o descenso, casos de discriminación o cobro indebido del boleto pese a manifestar su condición de persona ciega, y situaciones de haber abordado por error una línea distinta a la indicada, debiendo recurrir a un taxi para completar el trayecto. En conjunto, estos resultados cuantitativos y cualitativos refuerzan la necesidad de una solución que permita identificar la línea de ómnibus de forma autónoma y en tiempo real, reduciendo tanto la dependencia de terceros como el margen de error y la incertidumbre asociados a los métodos actuales.

### 2.4.3 Problemática en supermercados y comercios

Las compras cotidianas en supermercados representan otro ámbito de desafío significativo para las personas con discapacidad visual. La identificación de productos específicos, la lectura de etiquetas, precios y fechas de vencimiento son tareas que requieren asistencia visual. Si bien existen aplicaciones móviles con funcionalidades de lectura de códigos de barras, estas soluciones presentan limitaciones en términos de usabilidad en el contexto uruguayo.

El cuestionario distribuido por UNCU permite dimensionar esta problemática con mayor precisión. Sólo un 4% de los encuestados considera muy fácil hacer compras de forma independiente en un supermercado, mientras que un 28% directamente evita concurrir solo/a y un 24% adicional lo califica como difícil (Figura 10); en conjunto, más de la mitad de los encuestados enfrenta algún grado significativo de dificultad o directamente evita la tarea. En cuanto a la orientación dentro del establecimiento, los resultados muestran las estrategias que los encuestados utilizan actualmente para desplazarse por los pasillos y ubicar productos (Figura 11), evidenciando que, al igual que en el transporte público, gran parte de la resolución de estas tareas recae en el propio usuario o en la ayuda de terceros más que en herramientas específicas del entorno.

<!-- imagen del Doc: figuras/encuesta-p18.png -->

Figura 10: Facilidad para hacer compras en un supermercado de forma independiente (pregunta 18).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

<!-- imagen del Doc: figuras/encuesta-p19.png -->

Figura 11: Formas de orientarse dentro de un supermercado (pregunta 19).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

Respecto a las dificultades puntuales, un 84% de los encuestados señala que leer los precios es una de sus principales dificultades, seguido de la lectura de fechas de vencimiento (76%), moverse por pasillos con obstáculos (68%), y tanto identificar productos específicos como diferenciar productos similares entre sí (60% cada uno) (Figura 12). Estas cifras evidencian que las dificultades no se limitan a la localización física de los productos, sino que abarcan también el acceso a información textual crítica para tomar decisiones de compra informadas, como precios, fechas de vencimiento y la validez de promociones (44%), tareas que hoy dependen casi por completo de la lectura visual directa del envase o del cartel.

<!-- imagen del Doc: figuras/encuesta-p20.png -->

Figura 12: Principales dificultades al hacer compras (pregunta 20).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (25 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

Frente a este panorama, la herramienta propuesta recibió una valoración favorable: un 69,2% de los encuestados la consideró muy útil y un 15,4% adicional indicó que podría serlo, alcanzando en conjunto más del 84% de respuestas favorables (Figura 13), lo que respalda la pertinencia de abordar este caso de uso como uno de los dos ejes centrales del proyecto.

<!-- imagen del Doc: figuras/encuesta-p21.png -->

Figura 13: Utilidad percibida de una herramienta que identifique ómnibus, productos y textos mediante audio (pregunta 21).

Fuente: cuestionario distribuido por la UNCU a su red de voluntarios (26 respuestas a esta pregunta). El cuestionario completo se presenta en el anexo 12.2.

## 2.5 Consideraciones adicionales

El relevamiento con usuarios consistió en el cuestionario distribuido por la UNCU y en una entrevista con un usuario ciego (anexo 12.4), que orientaron la definición de los casos de uso hacia necesidades concretas. Las pruebas de usabilidad del prototipo con usuarios ciegos quedan pendientes (sec. 7.9).

Asimismo, se tuvo en cuenta el contexto local de Uruguay, buscando que la solución fuera accesible, viable y relevante para el entorno en el cual se utilizaría.

Se contemplaron también las limitaciones de hardware, costos y procesamiento, priorizando un equilibrio entre la precisión del sistema y la factibilidad de implementación.
