# 2. Descripción del proyecto


## 2.1 Alcance

El proyecto consiste en el diseño y desarrollo de un sistema de asistencia para personas con baja o nula visión, capaz de reconocer visualmente objetos de interés mediante técnicas de Computer Vision, Machine Learning e Inteligencia Artificial. El sistema estará orientado a la identificación de líneas de ómnibus metropolitanos y de productos de supermercado pertenecientes a la canasta básica. 

La solución contempla un dispositivo con cámara (acoplado a una patilla de lentes) que capture el entorno, procese la información visual y proporcione al usuario retroalimentación auditiva en tiempo real. Además, se prevé su integración con una aplicación móvil, que funcionará como apoyo para la conectividad, el procesamiento y la interacción con el sistema. 

El alcance incluye el desarrollo del prototipo funcional, el entrenamiento o ajuste de modelos de reconocimiento, la vinculación con la aplicación móvil y la validación básica de funcionamiento en escenarios representativos de uso. No necesariamente abarca una implementación comercial final ni una cobertura exhaustiva de todos los objetos posibles del entorno, sino una solución enfocada en casos de uso concretos y relevantes para la autonomía cotidiana del usuario. 

## 2.2 Objetivos del proyecto


### 2.2.1 Objetivo general

Desarrollar un dispositivo de asistencia para personas con baja visión que permita reconocer líneas de ómnibus metropolitanos y productos de la canasta básica mediante técnicas de Computer Vision, Machine Learning e Inteligencia Artificial, brindando feedback auditivo y acoplándose a una aplicación móvil para mejorar la conectividad, el procesamiento y la experiencia de uso.

### 2.2.2 Objetivos específicos

  - Diseñar la arquitectura general del sistema, módulo de reconocimiento y aplicación móvil.
  - Diseñar e implementar el dispositivo físico para la toma de imágenes.


  - Implementar un mecanismo de captura y procesamiento de imágenes orientado a la detección e identificación de líneas de ómnibus, incorporando técnicas de OCR, así como el reconocimiento de productos de supermercado de la canasta básica. 


  - Entrenar, ajustar (*fine-tuning*) o integrar modelos de Machine Learning adecuados para el reconocimiento de los objetos definidos.


  - Desarrollar un sistema de retroalimentación auditiva que comunique al usuario, de forma clara y oportuna, el objeto identificado.


  - Integrar el dispositivo con una aplicación móvil que permita gestionar la conectividad, apoyar el procesamiento y facilitar la interacción con el usuario.


  - Evaluar el funcionamiento del prototipo en escenarios de uso representativos, considerando precisión de reconocimiento, tiempo de respuesta y utilidad para el usuario. 


  - Diseñar e implementar un criterio de priorización para la retroalimentación auditiva en escenarios con múltiples ómnibus detectados, de modo que el sistema comunique en primer lugar la línea más relevante según su posición o proximidad, pudiendo informar adicionalmente la presencia de otras líneas sin generar sobrecarga auditiva en el usuario. 

### 2.2.3 Objetivos opcionales

  - Implementar una funcionalidad de selección por señalamiento que permita que, en el caso de los productos de la canasta básica, la respuesta auditiva comunique únicamente el objeto que el usuario esté apuntando o tocando con su dedo índice entre los elementos detectados, a fin de reducir respuestas innecesarias y mejorar la experiencia de uso. 


  - Incorporar la lectura de etiquetas o información textual de productos de la canasta básica mediante OCR, a fin de identificar características complementarias del producto, como su variedad, sabor o presentación. 

## 2.3 Entregables del proyecto

El proyecto contempla los siguientes entregables:

1.  **Documento de contexto y problema****  
    **Análisis de la situación de personas con discapacidad visual, incluyendo contexto en Uruguay, estadísticas y problemáticas principales.
2.  **Estado del arte****  
    **Revisión de trabajos y soluciones existentes hasta la fecha en Computer Vision, OCR y dispositivos asistivos.
3.  **Relevamiento con usuarios****  
    **Entrevistas realizadas con transcripciones en anexos y análisis sobre necesidades reales.
4.  **Documento de requisitos****  
    **Definición de requisitos funcionales, no funcionales, restricciones y/o riesgos del sistema.
5.  **Diseño de arquitectura****  
    **Descripción de la arquitectura del sistema, componentes y flujo de información.
6.  **Prototipo del dispositivo físico****  
    **Implementación de un dispositivo funcional con cámara y salida de audio.
7.  **Sistema de visión por computadora (*****Computer Vision)*****  
    **Desarrollo e integración de modelos para reconocimiento de ómnibus y productos.
8.  **Sistema de retroalimentación auditiva****  
    **Implementación del mecanismo de comunicación auditiva con el usuario.
9.  **Aplicación móvil****  
    **Desarrollo de la aplicación para conectividad, configuración e interacción.
10.  **Integración del sistema completo****  
    **Integración de todos los módulos en un sistema funcional.
11.  **Validación del prototipo****  
    **Pruebas en escenarios reales y evaluación de desempeño.
12.  **Documentación técnica y manual de usuario****  
    **Documentación del sistema y guía de uso.
13.  **Informe final de tesis****  
    **Documento completo que describe el proyecto, desarrollo y resultados.
14.  **Presentación y demo****  
    **Exposición final del proyecto y demostración funcional del sistema.

### 2.3.1 Planilla de seguimiento y cronograma

Como soporte de la planificación y seguimiento del proyecto, el equipo mantiene una planilla de trabajo compartida (enlace) organizada en dos hojas complementarias. La primera detalla el desglose completo del proyecto por épicas (Tareas generales, Desarrollo de dispositivo físico, Desarrollo de sistema de reconocimiento y Desarrollo de aplicación móvil), especificando para cada subtarea su descripción y estado de avance actual. La segunda hoja traduce este desglose en un diagrama de Gantt, que ubica cada tarea en el tiempo y permite visualizar la carga de trabajo en paralelo entre los integrantes del equipo.

Entre los principales hitos planificados se encuentran: la compra y validación del hardware (cámara, microprocesador y auricular) junto con el modelado 3D de la carcasa; la generación de los datasets y el entrenamiento del modelo de reconocimiento de líneas de ómnibus y productos; y el desarrollo e integración de la aplicación móvil, incluyendo las pruebas de accesibilidad con lectores de pantalla nativos y de usabilidad con usuarios ciegos. El cronograma proyecta la finalización del desarrollo hacia mediados de noviembre de 2026, dejando un margen de aproximadamente dos semanas antes de la fecha límite (30 de noviembre) para integración final, corrección de errores y pruebas de conjunto.

## 2.4 Antecedentes y contexto

La discapacidad visual representa una de las condiciones que más impacta en la autonomía cotidiana de las personas. Según la Organización Mundial de la Salud (OMS), en 2023 al menos 2.200 millones de personas en el mundo tienen alguna forma de deficiencia visual, de las cuales al menos 1.000 millones podrían haberse prevenido o aún no han recibido tratamiento. La ceguera y la baja visión limitan severamente la capacidad de las personas para desenvolverse de forma independiente en entornos urbanos y domésticos.

### 2.4.1 Discapacidad visual en Uruguay

En Uruguay, según datos del Segundo Censo Nacional de Personas con Discapacidad realizado por el Ministerio de Desarrollo Social (MIDES) en 2011, aproximadamente el 7,6% de la población mayor de 6 años presenta algún tipo de discapacidad, siendo la discapacidad visual una de las más prevalentes. La Unión Nacional de Ciegos del Uruguay (UNCU), fundada en 1948, es la institución referente en el país para las personas con discapacidad visual, brindando apoyo, formación y representación a sus asociados.

Para complementar estos datos con información directa del colectivo, se distribuyó un cuestionario a través de la Unión Nacional de Ciegos del Uruguay (UNCU) a su red de voluntarios, obteniendo 26 respuestas de personas con discapacidad visual o vinculadas a ella (ver Figuras 1 a 4, Anexo). El cuestionario relevó tanto aspectos demográficos generales (vínculo con la discapacidad visual, tipo de condición, rango etario y zona de residencia) como la percepción de los propios encuestados respecto a su independencia cotidiana y a las barreras que enfrentan en Uruguay. 

Los resultados evidencian que la independencia cotidiana de las personas ciegas o con baja visión depende fuertemente del entorno y del apoyo de terceros, más que de una limitación estrictamente individual (Figura 5). Entre las principales barreras identificadas por los propios encuestados se destacan el mal estado de las veredas (92,3%), la falta de empatía o conocimiento social por parte del entorno (73,1%), la falta de señalización sonora (69,2%) y los cruces de calle poco accesibles (61,5%) (Figura 6), lo que confirma que gran parte de las dificultades reportadas están asociadas a la infraestructura urbana y a la falta de adaptación del entorno, más que a la ausencia de herramientas tecnológicas. Asimismo, la mitad de los encuestados señala la falta de información digital accesible como una barrera relevante (50%), mientras que la dependencia de otras personas y la falta de información en braille son percibidas como barreras algo menos determinantes (26,9% y 30,8% respectivamente).

Esta percepción se ve confirmada por las respuestas abiertas del cuestionario ante la pregunta sobre en qué situaciones se necesita más ayuda externa (Anexo): la mayoría de los encuestados menciona espontáneamente el transporte público y las compras en supermercados como los contextos donde más se requiere asistencia de terceros, junto con el cruce de calles y avenidas, una tarea que, si bien excede el alcance de este proyecto, refuerza la magnitud de las barreras urbanas identificadas. En cuanto a las herramientas de accesibilidad disponibles, los resultados muestran el grado de conocimiento y uso de las mismas (Figura 7), así como el nivel de confiabilidad percibido (Figura 8). 

La combinación de estos resultados cuantitativos y cualitativos evidencia oportunidades concretas de mejora en las soluciones actualmente disponibles en el país, y sirve como punto de partida para justificar el enfoque de este proyecto en dos de las actividades cotidianas más mencionadas por los propios encuestados: el uso del transporte público y las compras en supermercados.

### 2.4.2 Problemática en el transporte público

El transporte público representa uno de los mayores desafíos para las personas con discapacidad visual en Uruguay. La identificación de la línea de ómnibus correcta en una parada concurrida es una tarea compleja cuando no se cuenta con visión. Los sistemas actuales de información en las paradas, en su mayoría visuales, no proporcionan retroalimentación auditiva de manera consistente. Esto genera una dependencia significativa de otras personas para realizar desplazamientos urbanos que, para la mayoría de la población, son completamente autónomos.

Los resultados del cuestionario UNCU confirman esta problemática de forma concreta. Si bien la mayoría de los encuestados utiliza transporte público de forma habitual (Figura 9), solo un 8% considera bastante fácil identificar qué ómnibus o línea se aproxima, mientras que un 32% lo califica como muy difícil y un 40% señala que depende del lugar o la situación (Figura 10); es decir, prácticamente ningún encuestado percibe esta tarea como sencilla en todos los contextos. \[NUEVO\] Esto es coherente con lo observado en la pregunta general sobre situaciones donde se necesita más ayuda externa (Anexo), donde el transporte público fue, junto con el cruce de calles, el contexto mencionado con mayor frecuencia por los encuestados. Para resolver esta dificultad, el método más utilizado es preguntar a otra persona en la parada (72% de los encuestados), seguido a distancia por el uso de aplicaciones móviles y por el reconocimiento de referencias del lugar (24% cada uno); solo un 20% cuenta con la ayuda del conductor o guarda, y apenas un 16% logra identificar la línea a partir de información sonora (Figura 11), lo que confirma que la estrategia predominante sigue siendo la asistencia humana informal antes que cualquier recurso tecnológico o accesible por sí mismo. 

Esta fuerte dependencia de terceros se traduce también en los mayores problemas reportados al usar el transporte público: un 64% de los encuestados señala que su principal dificultad es saber qué línea se aproxima, mientras que un 32% menciona la falta de información sonora y un 28% señala tanto la dificultad para saber dónde está la parada como para saber cuándo bajar (Figura 14). 

Los testimonios recogidos en las preguntas abiertas del cuestionario (Anexo) ilustran esta realidad con situaciones concretas: encuestados relatan quedar desorientados al no ser avisados de su parada, choferes que detienen el vehículo lejos del cordón dificultando el ascenso o descenso, casos de discriminación o cobro indebido del boleto pese a manifestar su condición de persona ciega, y situaciones de haber abordado por error una línea distinta a la indicada, debiendo recurrir a un taxi para completar el trayecto. En conjunto, estos resultados cuantitativos y cualitativos refuerzan la necesidad de una solución que permita identificar la línea de ómnibus de forma autónoma y en tiempo real, reduciendo tanto la dependencia de terceros como el margen de error y la incertidumbre asociados a los métodos actuales.

### 2.4.3 Problemática en supermercados y comercios

Las compras cotidianas en supermercados representan otro ámbito de desafío significativo para las personas con discapacidad visual. La identificación de productos específicos, la lectura de etiquetas, precios y fechas de vencimiento son tareas que requieren asistencia visual. Si bien existen aplicaciones móviles con funcionalidades de lectura de códigos de barras, estas soluciones presentan limitaciones en términos de usabilidad y cobertura de productos de la canasta básica en el contexto uruguayo.

El cuestionario distribuido por UNCU permite dimensionar esta problemática con mayor precisión. Solo un 4% de los encuestados considera muy fácil hacer compras de forma independiente en un supermercado, mientras que un 28% directamente evita concurrir solo/a y un 24% adicional lo califica como difícil (Figura 15); en conjunto, más de la mitad de los encuestados enfrenta algún grado significativo de dificultad o directamente evita la tarea. En cuanto a la orientación dentro del establecimiento, los resultados muestran las estrategias que los encuestados utilizan actualmente para desplazarse por los pasillos y ubicar productos (Figura 16), evidenciando que, al igual que en el transporte público, gran parte de la resolución de estas tareas recae en el propio usuario o en la ayuda de terceros más que en herramientas específicas del entorno. 

Respecto a las dificultades puntuales, un 84% de los encuestados señala que leer los precios es una de sus principales dificultades, seguido de la lectura de fechas de vencimiento (76%), moverse por pasillos con obstáculos (68%), y tanto identificar productos específicos como diferenciar productos similares entre sí (60% cada uno) (Figura 17). Estas cifras evidencian que las dificultades no se limitan a la localización física de los productos, sino que abarcan también el acceso a información textual crítica para tomar decisiones de compra informadas, como precios, fechas de vencimiento y la validez de promociones (44%), tareas que hoy dependen casi por completo de la lectura visual directa del envase o del cartel. 

Frente a este panorama, la validación de la herramienta propuesta resultó ampliamente positiva: un 69,2% de los encuestados la consideró muy útil y un 15,4% adicional indicó que podría serlo, alcanzando en conjunto más del 84% de respuestas favorables (Figura 18), lo que respalda la pertinencia de abordar este caso de uso como uno de los dos ejes centrales del proyecto.

### 2.4.4 Soluciones tecnológicas existentes y su contexto

Actualmente existen diversas herramientas de asistencia para personas con discapacidad visual, tales como el bastón blanco, perros guía, lectores de pantalla y aplicaciones móviles. Sin embargo, muchas de estas soluciones no están adaptadas al contexto local uruguayo o requieren dispositivos costosos de difícil acceso. El avance en técnicas de visión por computadora e inteligencia artificial ha abierto nuevas posibilidades para desarrollar dispositivos de asistencia más accesibles, precisos y adaptados a necesidades específicas. ViroVision surge en este contexto, buscando brindar una herramienta concreta para la identificación de líneas de ómnibus metropolitanos y productos de la canasta básica, dos necesidades específicas identificadas como prioritarias en el contexto uruguayo.

## 2.5 Consideraciones adicionales

El proyecto incorpora un fuerte componente de **validación con usuarios reales**, lo cual permitirá asegurar que la solución propuesta responda a necesidades concretas y no únicamente a supuestos teóricos.

Asimismo, se tendrá en cuenta el contexto local de Uruguay, buscando que la solución sea accesible, viable y relevante para el entorno en el cual será utilizada.

Se contemplarán también limitaciones de hardware, costos y procesamiento, priorizando un equilibrio entre precisión del sistema y factibilidad de implementación.

> **Nota de edición.** Los apartados «Metodología de trabajo» y «Plan de trabajo» del documento
> anterior, redactados en tiempo futuro como parte de la propuesta, quedan reemplazados por los
> capítulos 5 (Metodología) y 6 (Planificación) de este documento, que describen lo efectivamente
> realizado. Su contenido original se conserva en el historial de versiones del documento anterior.
