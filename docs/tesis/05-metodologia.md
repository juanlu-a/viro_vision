# 5. Metodología

## 5.1 Enfoque general

El proyecto se desarrolló siguiendo un enfoque ágil, iterativo e incremental. En lugar de definir por completo el sistema antes de construirlo, se trabajó en ciclos cortos en los que se implementaba una capacidad, se la medía contra el hardware o el servicio real, y el resultado de esa medición alimentaba la planificación del ciclo siguiente.

Esta elección responde a las características del problema. ViroVision combina tres dominios (una aplicación móvil, un dispositivo embebido y modelos de visión por computadora) en los que una cantidad considerable de incógnitas no puede calcularse a priori, por ejemplo: cuánto tarda una notificación BLE en cruzar de una Raspberry Pi a un iPhone, cuánto ocupa un detector cuantizado dentro del sensor de la cámara o cuánta latencia agrega un proxy entre la aplicación y un proveedor de nube. Estas incógnitas debían medirse. El método de trabajo del equipo consistió, entonces, en convertir cada incógnita de diseño en un experimento acotado, correrlo, y documentar el resultado junto con la decisión que provocó.

Las decisiones técnicas principales se respaldaron, siempre que fue posible, con una medición o una prueba sobre el hardware; la excepción documentada es la elección de React Native (sec. 7.5.1). Cada decisión relevante quedó escrita en un documento de decisión (ADR, ver sec. 5.3) que consigna el contexto, las alternativas evaluadas, la evidencia y las consecuencias. Cuando la evidencia posterior contradijo una decisión previa, el ADR se enmendó con fecha en lugar de reescribirse, dejando visible el cambio de rumbo.

## 5.2 Organización del proyecto

### 5.2.1 División de tareas

El equipo se organizó por pilar, y no por capas horizontales, porque cada uno de los tres pilares exige un entorno de trabajo distinto (un teléfono con development build, una placa accesible por SSH, una GPU para entrenar). La Tabla 7 muestra el reparto.

Tabla 7: Responsabilidad principal de cada integrante del equipo.

| **Integrante** | **Responsabilidad principal** |
|---|---|
| Juan Lucas Abreu | Aplicación móvil, daemon de la placa, integración y despliegue |
| Magalí Dellapiazza | Desarrollo de detectores del ómnibus y de los carteles, construcción y etiquetado del dataset, comparación de motores de OCR |
| Francisco Tauber | Entrenamiento de modelos en máquina virtual, construcción y etiquetado de dataset, pruebas de usuario y relevamiento |

La división por pilar tuvo un costo conocido y aceptado: el conocimiento profundo de cada pilar quedó concentrado en una persona. El mecanismo que se adoptó para compensarlo fue documental (sec. 5.3): todo lo que un integrante aprendía sobre su pilar se escribía en el repositorio, de modo que el resto del equipo pudiera retomarlo sin depender de una transferencia oral.

La frontera entre pilares se trató como un contrato explícito. El protocolo BLE, los endpoints HTTP de la placa y el catálogo de anuncios pregrabados están definidos una vez y duplicados a ambos lados de la frontera; en varios casos, un test automatizado falla si las dos copias se desincronizan (sec. 7.5). La frontera se verifica con pruebas automatizadas en lugar de confiarse a la memoria de los integrantes.

### 5.2.2 Enfoque de desarrollo

El desarrollo avanzó de manera incremental, con una regla de prioridad que se mantuvo a lo largo de todo el proyecto: la funcionalidad no se considera terminada hasta medirla. Una funcionalidad se consideraba terminada cuando funcionaba contra el hardware o el servicio real, no cuando pasaba sus pruebas unitarias. Esto llevó a que varias decisiones se revirtieran después de la primera medición, y esa reversión forma parte del registro del proyecto.

Los tres ejemplos más claros de este patrón:

1. El transporte de la foto. Se diseñó el enlace suponiendo que BLE alcanzaría para mover una imagen de 53 KB. Se escribió el umbral *antes* de medir (53 KB en menos de 2 s) y la medición lo incumplió por un factor de 2,2. El resultado fue rediseñar el enlace en dos planos: BLE para control, WiFi para datos (sec. 7.1.5).
1. El runtime de inferencia en el teléfono. El ADR 0004 proponía embeber un modelo multimodal en la aplicación. Un *spike*, término de las metodologías ágiles para un experimento acotado en el tiempo cuyo único producto es la información necesaria para decidir, de dos días, midió los cuatro caminos posibles y mostró que la limitación estaba en la librería y no en el teléfono; el ADR quedó superado en la práctica por el ADR 0006, que reemplazó “un runtime para todo” por “un pipeline por caso de uso”.
1. El acelerador de hardware. El diseño original incluía un Coral TPU por USB. La llegada de la AI Camera con sensor Sony IMX500 (que ejecuta el detector dentro del propio sensor) lo dejó sin función, y el Coral salió del diseño.

### 5.2.3 Priorización de tareas

Se priorizaron los riesgos cuyo fallo invalidaba el resto del trabajo. Ese criterio ordenó el trabajo en torno a los riesgos técnicos con mayor incertidumbre, que se atacaron primero aunque no fueran los entregables más visibles.

Concretamente, el enlace entre la placa y el teléfono y la viabilidad de la inferencia local se resolvieron antes que la interfaz de usuario, porque un resultado negativo en cualquiera de los dos habría obligado a replantear la arquitectura completa. En cambio, funcionalidades de valor cierto pero sin riesgo (la pantalla de ajustes, el selector de modelo) se postergaron hasta que la arquitectura estuvo confirmada por mediciones.

Un segundo criterio fue el presupuesto de tiempo de respuesta. El equipo fijó desde el inicio que el ciclo completo del modo supermercado (del gesto del usuario al audio) debía caber en 3 a 4 segundos (ADR 0003). El valor es un criterio propio: no lo planteó el usuario entrevistado ni proviene de una referencia de tiempos de respuesta, sino de considerar que el usuario está quieto frente a la góndola y que una espera de más de unos pocos segundos sin respuesta no se distingue de una falla; validarlo con usuarios queda pendiente (sec. 9.9). Ese presupuesto funcionó como criterio de aceptación de cada componente: una alternativa que no cabía en su parte del presupuesto quedaba descartada sin más discusión.

### 5.2.4 Gestión de cambios

Los cambios de rumbo se gestionaron mediante enmiendas fechadas a los documentos de decisión. La regla es que un ADR (*Architectural Decision Record* o Registro de Decisión de Arquitectura) aceptado no se reescribe ni se borra: se le agrega una sección de actualización que dice qué cambió, cuándo y por qué. De ese modo el documento conserva el razonamiento original (incluido el que resultó equivocado) y el lector puede reconstruir la trayectoria de la decisión.

La Tabla 8 reúne los cambios más significativos registrados por este mecanismo.

Tabla 8: Cambios de rumbo más significativos, registrados como enmiendas a los ADR.

| **Fecha** | **Cambio** | **Documento** |
|---|---|---|
| 10 de agosto de 2026 | La nube pasa de estar prohibida a ser un acelerador opcional, manteniendo lo local como respaldo garantizado (acordado en reunión con el director) | ADR 0001, enmienda |
| 22 de agosto de 2026 | Se abandona “un único runtime de inferencia” a favor de un pipeline por caso de uso | ADR 0004 superado por ADR 0006 |
| 30 de agosto de 2026 | El modo supermercado pasa a resolverse en la nube, con respaldo local pendiente | ADR 0006, actualización |
| 7 de septiembre de 2026 | Se descarta el Coral TPU; el acelerador es el sensor IMX500; el OCR pasa a PP-OCRv5 vía ONNX | ADR 0006, enmienda |
| 9 de septiembre de 2026 | Todo el código pasa a inglés para mantener coherencia; la documentación permanece en español | ADR 0009 |
| 11 de septiembre de 2026 | El alcance del modo supermercado se amplía de canasta básica a cualquier alimento; la canasta pasa a ser el conjunto de evaluación | ADR 0006, actualización |
| 14 de septiembre de 2026 | La aplicación se publica con un solo tema y una sola línea de estado | ADR 0010 |
| 6 de octubre de 2026 | Los errores dejan de mostrarse o decirse al usuario: van a la telemetría, y el usuario escucha una frase fija | ADR 0011 |
| 6 y 7 de octubre de 2026 | El modo ómnibus sólo anuncia lo que el catálogo de líneas conoce, y el catálogo completa la mitad del cartel que el OCR no leyó | ADR 0006, actualización |
| 19 de octubre de 2026 | Zoom digital del procesador de imagen sobre el cartel, para leerlo de más lejos | ADR 0006, actualización |
| 21 y 22 de octubre de 2026 | Se prueba leer el cartel con la caja del detector sin márgenes; en las pruebas del equipo se sigue perdiendo a veces el primer dígito y los márgenes vuelven el 22 de octubre | ADR 0006, actualización |

## 5.3 Documentación del proyecto

La documentación no se dejó para el final: vive en el repositorio, versionada junto al código, y se actualiza en el mismo *pull request* que introduce el cambio que la motiva. El repositorio define para esto seis tipos de documento con roles distintos:

a) Registros de decisión de arquitectura (ADR). Un archivo por decisión, en docs/architecture/adr/, con el formato clásico: contexto, decisión, alternativas consideradas, consecuencias y estado (propuesto, aceptado o reemplazado). Existen once ADR escritos (del 0001 al 0012). Diez están aceptados y uno, el 0004, figura como reemplazado por el 0006, el estado que corresponde a una decisión superada por otra posterior. Los ADR 0003, 0006 y 0007 permanecieron como propuestos, a la espera de validación con el director, hasta el 24 de noviembre de 2026, cuando se cerraron a partir de su revisión del informe. La numeración tiene un hueco: el ADR 0005 (estándares de *design system* y accesibilidad) no llegó a escribirse como registro de decisión, y sus contenidos quedaron cubiertos por el manual de marca (anexo 13.5) y por las reglas de accesibilidad descritas en la sec. 7.6.

b) Bitácora de sesiones (docs/SESSION-LOG.md). Un registro cronológico de qué se hizo cada día y, sobre todo, por qué. Es la fuente narrativa principal de la que se derivó el capítulo de planificación de este informe.

c) Estado vigente (docs/PROJECT-STATUS.md). Una foto del estado actual de cada pilar, que se reescribe cuando el estado cambia. A diferencia de la bitácora, que sólo crece, este documento siempre describe el presente.

d) Campañas de medición (docs/mediciones/). Un archivo por campaña, con una regla explícita: una campaña no se edita después de corrida. Cada archivo contiene el método y el montaje, las limitaciones declaradas *antes* de los números, los datos crudos de cada corrida, y lo que explícitamente no se midió. La separación de responsabilidades está escrita en el propio repositorio: el análisis y la decisión van al informe de tesis, los números completos que la respaldan quedan en la campaña. Este informe cita esas campañas como fuente primaria.

e) Base de conocimiento para asistentes de IA (.claude/skills/). El equipo utilizó un asistente de programación basado en modelos de lenguaje como herramienta de desarrollo. Para que ese asistente trabajara con el contexto correcto (y no reconstruyera de cero el estado del proyecto en cada sesión) se versionó en el repositorio una base de conocimiento estructurada que el asistente carga obligatoriamente al inicio de cada sesión de trabajo. Contiene el contexto del proyecto, un índice de decisiones con su estado y sus enmiendas, las convenciones de código y de ramas, y guías operativas (por ejemplo, cómo acceder a la placa y qué errores ya se cometieron al hacerlo).

En cuanto a la base de conocimiento del punto e), tratar el contexto del proyecto como un artefacto versionado (revisable en un *pull request*, con historial, y sujeto a la misma regla de actualización que el resto de la documentación) resultó ser una condición necesaria para que la asistencia automatizada fuera útil en un proyecto con decisiones acumuladas y reversiones. Sin ese contexto, el asistente proponía sistemáticamente caminos ya descartados con evidencia. El reparto de trabajo siguió un criterio fijo. El asistente escribía código, pruebas y borradores de documentación a partir de instrucciones del equipo; las decisiones de diseño, las mediciones sobre el hardware, el armado del dispositivo, el etiquetado de los datos y las pruebas de uso las hizo el equipo. Ningún cambio llegó a la rama principal sin que un integrante lo revisara en su *pull request* y sin pasar las pruebas automatizadas, y los cambios de mayor peso pasaron además por la revisión multimodelo descrita en el punto f). Las cifras que se reportan en este informe provienen de mediciones y de resultados guardados en los repositorios, no de estimaciones del asistente. [PENDIENTE: que el equipo confirme o ajuste este párrafo.]

f) Revisión multimodelo antes de integrar. Los cambios de peso se sometieron, antes de abrir el *pull request*, a un flujo de revisión con varios modelos de lenguaje en paralelo. Fueron cambios en el servicio del dispositivo, en el enlace o en el pipeline, la documentación extensa y el modelo 3D de la carcasa. El flujo reparte el cambio entre varios revisores, que sólo reportan hallazgos clasificados por severidad; el número de revisores y la división del trabajo entre ellos dependieron del alcance: sobre un cambio acotado, todos revisaron el mismo diff con modelos distintos (Opus, Sonnet y Haiku, de Anthropic, y Codex, de OpenAI), y en la revisión de toda la base de código fueron cinco revisores, cada uno sobre una parte (sec. 9.7.2). Los hallazgos se deduplican, se corrigen los críticos y los mayores, y la revisión se repite sobre lo corregido hasta que una vuelta sale limpia. Los hallazgos coincidentes entre revisores se priorizaron. Sobre la carcasa (versión 0.9, 14 de octubre) la revisión encontró, en tres vueltas, trabas que no enganchaban lo suficiente, un volumen sin reservar para el cable plano de la cámara y un orden de armado imposible, todo antes de imprimir. Sobre la documentación se usó para contrastar el texto con el código y detectar lo que había quedado desactualizado o sin mencionar. El flujo no reemplaza la revisión humana del *pull request*: la antecede y la acota.

La regla que cierra el circuito está escrita en la raíz del repositorio: al terminar cada sesión o cada tarea se actualiza la base de conocimiento: la bitácora siempre, el estado vigente si cambió, la base de contexto si cambió la forma de trabajar, y un ADR nuevo si hubo una decisión.

## 5.4 Herramientas de gestión

La gestión del proyecto se apoyó en tres herramientas con funciones deliberadamente distintas, para evitar que la misma información viviera en dos lugares y se desincronizara:

Trello (tablero *Organización / Alcance*): es la herramienta de gestión de alcance y seguimiento del equipo: organiza el trabajo en tarjetas agrupadas por estado (*To do*, *In process*, *Product Review* y *Done*) y es el espacio donde se discute y se acuerda qué se hace, antes de que exista código. Se eligió por su bajo costo de adopción: los tres integrantes ya lo conocían, no requiere configuración previa y el tablero se lee de un vistazo, que es exactamente lo que necesita un equipo pequeño que se coordina de manera asíncrona.

Planilla de entregables y cronograma (Google Sheets): contiene el desglose completo de entregables en épicas y subtareas, con una estimación de complejidad, tiempo y peso ponderado para cada una, además del diagrama de Gantt. Su función es cuantificar el avance: el porcentaje de progreso del proyecto se calcula, y no se declara por percepción, como la suma de los pesos alcanzados sobre el total.

GitHub: además del control de versiones, funcionó como herramienta de gestión de facto del trabajo técnico: cada unidad de trabajo terminada es un *pull request* numerado, revisable y trazable. Al 17 de noviembre de 2026 el repositorio registra 126 *pull requests* integrados: 95 hacia staging, 28 de staging hacia main (cada uno, una versión publicada) y 3 hacia ramas intermedias de la etapa inicial. La rama de integración (staging) acumula 132 *commits*; como los *pull requests* se integran comprimidos en un único *commit* (*squash merge*), la cantidad de *commits* es del mismo orden que la de *pull requests*. La bitácora de sesiones referencia cada hito por su número de PR.

## 5.5 Control de versiones y flujo de trabajo

El proyecto se organiza como un monorepo con los tres pilares en un mismo repositorio (app/, hardware/, ml/) más la documentación (docs/) y el backend (supabase/). Los tres pilares se mantienen juntos porque las fronteras entre ellos cambian con frecuencia, y un cambio de protocolo que toca la aplicación y el daemon simultáneamente debe poder revisarse y fusionarse como una sola unidad. El pipeline de visión de ómnibus es la excepción: vive en un repositorio propio (bus-banner-recognizer), porque su ciclo de trabajo (entrenar, evaluar, exportar) es independiente del ciclo de la aplicación, y se consume desde la placa como una dependencia instalable.

### 5.5.1 Modelo de ramas

El repositorio mantiene dos ramas de larga vida, cada una asociada a un canal de distribución real:

1. staging es la rama por defecto. Todo trabajo nuevo arranca en una rama de *feature* creada desde staging actualizado, antes de la primera modificación, y vuelve por *pull request*. Cada fusión a staging publica automáticamente una versión al grupo de pruebas interno.
1. main es producción. Se alcanza únicamente mediante un *pull request* de staging a main, lo que constituye una release y publica al canal público.

Nunca se hacen *commits* directos sobre ninguna de las dos. Se adoptó además una regla explícita de no apilar pull requests, derivada de un incidente concreto: al comienzo del proyecto se abrieron cuatro PRs encadenados, cada uno basado en el anterior, y la resolución de conflictos al fusionarlos consumió más tiempo que el trabajo original. Desde entonces, cada rama parte de la rama base actualizada.

### 5.5.2 Convenciones

1. Commits en formato *Conventional Commits* con alcance (fix(app): …, feat(device): …).
1. Idioma (ADR 0009). Todo el código está en inglés: identificadores, nombres de archivo, comentarios, pruebas, ramas, *commits* y también las fronteras (el protocolo BLE, los endpoints de la placa y el esquema de la base de datos). En español queda todo lo que una persona lee o escucha: los textos de la interfaz, el *prompt* del modo supermercado, los anuncios de voz y toda la documentación, este informe incluido. La migración se hizo en un único *pull request* que tocó alrededor de 150 archivos, para no dejar el repositorio en un estado mixto; los 71 *commits* anteriores se conservaron como estaban.
1. Verificación mínima antes de un PR: análisis estático, verificación de tipos y la suite completa de pruebas.

## 5.6 Comunicación

Con el director: el seguimiento con el Ing. MSc. Sebastián García Parra se realizó mediante reuniones de avance, en las que se presentaban los resultados medidos y se validaban los cambios de rumbo. La reunión del 10 de agosto de 2026 fue determinante: de ella surgió la propuesta de permitir la nube como acelerador opcional del camino de reconocimiento, que se formalizó como enmienda al ADR 0001 el mismo día.

Con el usuario: la entrevista con Luciano, usuario ciego, aportó el relevamiento inicial y es la referencia para las decisiones de interacción. Fue una entrevista semiestructurada, transcripta íntegramente en el anexo. Las pruebas de usabilidad quedan pendientes (sec. 9.9).

Con las organizaciones de apoyo: la Unión Nacional de Ciegos del Uruguay (UNCU) facilitó el acceso a la población objetivo para la encuesta de relevamiento (26 respuestas). La empresa Arnaldo Castro S.A. apoyó el proyecto, puso a disposición un servidor con GPU NVIDIA Tesla V100 para el entrenamiento de modelos y financió la compra de los materiales del dispositivo.

Interna: la coordinación del equipo se apoyó en el tablero de Trello para el alcance y en los *pull requests* de GitHub para el trabajo técnico, complementados con la bitácora del repositorio como registro común de lo decidido.

## 5.7 Aspectos éticos

El proyecto trabajó con personas en tres momentos, y en cada uno se consideró el consentimiento y el uso de los datos. El cuestionario se distribuyó a través de la UNCU a su red de voluntarios, la participación fue voluntaria y los resultados se presentan en forma agregada, sin datos que permitan identificar a quienes respondieron [PENDIENTE: confirmar que el cuestionario no recogía nombres ni datos de contacto]. La entrevista se realizó con el acuerdo del entrevistado y de su familia, y Luciano consintió que su transcripción se publicara con su nombre en el anexo 13.4. Por último, el sistema capta imágenes de la vía pública, que pueden contener personas y matrículas y son, por lo tanto, datos personales en los términos de la Ley 18.331 \[107\]: la evidencia del modo ómnibus se guarda en un almacenamiento privado, se usa sólo para el desarrollo y debe retirarse antes de cualquier versión pública (sec. 8.6.3). La telemetría registra tiempos y resultados de las lecturas con un identificador aleatorio del teléfono, sin imágenes ni datos de identidad del usuario.
