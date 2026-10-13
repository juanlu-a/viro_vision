# 5. Metodología

## 5.1 Enfoque general

El proyecto se desarrolló siguiendo un enfoque **ágil, iterativo e incremental**. En lugar de
definir por completo el sistema antes de construirlo, se trabajó en ciclos cortos en los que se
implementaba una capacidad, se la medía contra el hardware o el servicio real, y el resultado de esa
medición alimentaba la planificación del ciclo siguiente.

Esta elección no fue estilística sino una consecuencia del problema. ViroVision combina tres
dominios (una aplicación móvil, un dispositivo embebido y modelos de visión por computadora) en los
que buena parte de las preguntas importantes **no se pueden contestar en el papel**: cuánto tarda
una notificación BLE en cruzar de una Raspberry Pi a un iPhone, cuánto ocupa un detector cuantizado
dentro del sensor de la cámara, o cuánta latencia agrega un proxy entre la aplicación y un proveedor
de nube son preguntas que sólo responde una medición. El método de trabajo del equipo consistió,
entonces, en **convertir cada duda de diseño en un experimento acotado**, correrlo, y documentar el
resultado junto con la decisión que provocó.

De ahí surge la característica más distintiva del proceso: a lo largo del proyecto, **ninguna
decisión técnica relevante se tomó por preferencia**. Cada una tiene detrás un número, un registro
de ejecución o una prueba en hardware, y quedó escrita en un documento de decisión (ADR, ver §5.3)
que consigna el contexto, las alternativas evaluadas, la evidencia y las consecuencias. Cuando la
evidencia posterior contradijo una decisión previa, el ADR no se reescribió: se **enmendó con
fecha**, dejando visible el cambio de rumbo.

## 5.2 Organización del proyecto

### 5.2.1 División de tareas

El equipo se organizó **por pilar**, y no por capas horizontales, porque cada uno de los tres
pilares exige un entorno de trabajo distinto (un teléfono con *development build*, una placa
accesible por SSH, una GPU para entrenar):

| Integrante | Responsabilidad principal |
|---|---|
| Juan Lucas Abreu | Aplicación móvil, daemon de la placa, integración y despliegue |
| Magalí Dellapiazza | Pilar de Machine Learning: detector del cartel, construcción y etiquetado del dataset, comparación de motores de OCR |
| Francisco Tauber | Verificación en Android, pruebas de usuario y relevamiento |

La división por pilar tuvo un costo conocido y aceptado: el conocimiento profundo de cada pilar
quedó concentrado en una persona. El mecanismo que se adoptó para compensarlo fue **documental**
(§5.3): todo lo que un integrante aprendía sobre su pilar se escribía en el repositorio, de modo que
el resto del equipo pudiera retomarlo sin depender de una transferencia oral.

La frontera entre pilares se trató como un **contrato explícito**. El protocolo BLE, los endpoints
HTTP de la placa y el catálogo de anuncios pregrabados están definidos una vez y duplicados a
ambos lados de la frontera; en varios casos, un test automatizado falla si las dos copias se
desincronizan (§7.6). Un contrato verificado por una prueba es preferible a un contrato confiado a
la memoria de dos personas que trabajan en repositorios distintos.

### 5.2.2 Enfoque de desarrollo

El desarrollo avanzó de manera incremental, con una regla de prioridad que se mantuvo a lo largo de
todo el proyecto: **lo que no se puede medir, no está hecho**. Una funcionalidad se consideraba
terminada cuando funcionaba contra el hardware o el servicio real, no cuando pasaba sus pruebas
unitarias. Esto llevó a que varias decisiones se revirtieran después de la primera medición, y esa
reversión es parte del registro del proyecto y no un accidente que se oculta.

Los tres ejemplos más claros de este patrón:

1. **El transporte de la foto.** Se diseñó el enlace suponiendo que BLE alcanzaría para mover una
   imagen de 53 KB. Se escribió el umbral *antes* de medir (53 KB en menos de 2 s) y la medición lo
   incumplió por un factor de 2,2. El resultado fue rediseñar el enlace en dos planos: BLE para
   control, WiFi para datos (§7.2).
2. **El runtime de inferencia en el teléfono.** El ADR 0004 proponía embeber un modelo multimodal en
   la aplicación. Un *spike* de dos días midió los cuatro caminos posibles y mostró que el problema
   no era el teléfono sino la librería; el ADR quedó superado en la práctica por el ADR 0006, que
   reemplazó "un runtime para todo" por "un pipeline por caso de uso".
3. **El acelerador de hardware.** El diseño original incluía un Coral TPU por USB. La llegada de la
   AI Camera con sensor Sony IMX500 (que ejecuta el detector dentro del propio sensor) lo dejó sin
   función, y el Coral salió del diseño.

### 5.2.3 Priorización de tareas

La priorización se organizó alrededor de una pregunta: **¿qué es lo que, si falla, invalida el
resto?** Ese criterio ordenó el trabajo en torno a los riesgos técnicos con mayor incertidumbre,
que se atacaron primero aunque no fueran los entregables más visibles.

Concretamente, el enlace entre la placa y el teléfono y la viabilidad de la inferencia local se
resolvieron antes que la interfaz de usuario, porque un resultado negativo en cualquiera de los dos
habría obligado a replantear la arquitectura completa. En cambio, funcionalidades de valor cierto
pero sin riesgo (la pantalla de ajustes, el selector de modelo) se postergaron hasta que la
arquitectura estuvo confirmada por mediciones.

Un segundo criterio fue el **presupuesto de tiempo de respuesta**. El equipo fijó desde el inicio
que el ciclo completo del modo supermercado (del gesto del usuario al audio) debía caber en 3 a 4
segundos, y ese presupuesto funcionó como criterio de aceptación de cada componente: una alternativa
que no cabía en su parte del presupuesto quedaba descartada sin más discusión.

### 5.2.4 Gestión de cambios

Los cambios de rumbo se gestionaron mediante **enmiendas fechadas a los documentos de decisión**. La
regla es que un ADR aceptado no se reescribe ni se borra: se le agrega una sección de actualización
que dice qué cambió, cuándo y por qué. De ese modo el documento conserva el razonamiento original
(incluido el que resultó equivocado) y el lector puede reconstruir la trayectoria de la decisión.

Los cambios más significativos registrados por este mecanismo fueron:

| Fecha | Cambio | Documento |
|---|---|---|
| 2026-08-10 | La nube pasa de estar prohibida a ser un **acelerador opcional**, manteniendo lo local como respaldo garantizado (acordado en reunión con el director) | ADR 0001, enmienda |
| 2026-08-22 | Se abandona "un único runtime de inferencia" a favor de **un pipeline por caso de uso** | ADR 0004 superado por ADR 0006 |
| 2026-08-30 | El modo supermercado pasa a resolverse **en la nube**, con respaldo local pendiente | ADR 0006, actualización |
| 2026-09-07 | Sale el **Coral TPU**; el acelerador es el sensor **IMX500**; el OCR pasa a PP-OCRv5 vía ONNX | ADR 0006, enmienda |
| 2026-09-09 | Todo el código pasa a **inglés**; la documentación permanece en español | ADR 0009 |
| 2026-09-11 | El alcance del modo supermercado se **amplía** de canasta básica a cualquier alimento; la canasta pasa a ser el conjunto de evaluación | ADR 0006, actualización |
| 2026-09-14 | La aplicación se publica con **un solo tema** y una sola línea de estado | ADR 0010 |

## 5.3 Documentación del proyecto

La documentación no se dejó para el final: **vive en el repositorio, versionada junto al código**, y
se actualiza en el mismo *pull request* que introduce el cambio que la motiva. El repositorio define
para esto cinco tipos de documento con roles distintos:

**a) Registros de decisión de arquitectura (ADR).** Un archivo por decisión, en
`docs/architecture/adr/`, con el formato clásico: contexto, decisión, alternativas consideradas,
consecuencias y estado (`Proposed` / `Accepted`). Al cierre de este informe existen diez ADRs, de
los cuales cinco están aceptados y cuatro permanecen como propuestos a la espera de validación
formal con el director. La numeración tiene un hueco declarado: el ADR 0005 (estándares de *design
system* y accesibilidad) está identificado como pendiente de escritura.

**b) Bitácora de sesiones (`docs/SESSION-LOG.md`).** Un registro cronológico de qué se hizo cada
día y, sobre todo, **por qué**. Es la fuente narrativa principal de la que se derivó el capítulo de
planificación de este informe.

**c) Estado vigente (`docs/PROJECT-STATUS.md`).** Una foto del estado actual de cada pilar, que se
reescribe cuando el estado cambia. A diferencia de la bitácora, que sólo crece, este documento
siempre describe el presente.

**d) Campañas de medición (`docs/mediciones/`).** Un archivo por campaña, con una regla explícita:
**una campaña no se edita después de corrida**. Cada archivo contiene el método y el montaje, las
limitaciones declaradas *antes* de los números, los datos crudos de cada corrida, y lo que
explícitamente no se midió. La separación de responsabilidades está escrita en el propio repositorio:
el análisis y la decisión van al informe de tesis, los números completos que la respaldan quedan en
la campaña. Este informe cita esas campañas como fuente primaria.

**e) Base de conocimiento para asistentes de IA (`.claude/skills/`).** El equipo utilizó un
asistente de programación basado en modelos de lenguaje como herramienta de desarrollo. Para que ese
asistente trabajara con el contexto correcto (y no reconstruyera de cero el estado del proyecto en
cada sesión) se versionó en el repositorio una **base de conocimiento estructurada** que el
asistente carga obligatoriamente al inicio de cada sesión de trabajo. Contiene el contexto del
proyecto, un índice de decisiones con su estado y sus enmiendas, las convenciones de código y de
ramas, y guías operativas (por ejemplo, cómo acceder a la placa y qué errores ya se cometieron al
hacerlo).

Esta última pieza merece una observación metodológica. Tratar el contexto del proyecto como un
artefacto versionado (revisable en un *pull request*, con historial, y sujeto a la misma regla de
actualización que el resto de la documentación) resultó ser una condición necesaria para que la
asistencia automatizada fuera útil en un proyecto con decisiones acumuladas y reversiones. Sin ese
contexto, el asistente proponía sistemáticamente caminos ya descartados con evidencia.

La regla que cierra el circuito está escrita en la raíz del repositorio: **al terminar cada sesión o
cada tarea se actualiza la base de conocimiento**: la bitácora siempre, el estado vigente si cambió,
la base de contexto si cambió la forma de trabajar, y un ADR nuevo si hubo una decisión.

## 5.4 Herramientas de gestión

La gestión del proyecto se apoyó en tres herramientas con funciones deliberadamente distintas, para
evitar que la misma información viviera en dos lugares y se desincronizara:

**Trello**, tablero *Organización / Alcance*. Es la herramienta de gestión de alcance y
seguimiento del equipo: organiza el trabajo en tarjetas agrupadas por estado, y es el espacio donde
se discute y se acuerda **qué se hace**, antes de que exista código. Se eligió por su bajo costo de
adopción: los tres integrantes ya lo conocían, no requiere configuración previa y el tablero se lee
de un vistazo, que es exactamente lo que necesita un equipo chico que se coordina de manera asíncrona.

> `[PENDIENTE: completar con las columnas reales del tablero, la cantidad de tarjetas y el criterio
> de etiquetado. El tablero es privado y no pudo ser consultado al momento de redactar esta sección.]`

**Planilla de entregables y cronograma (Google Sheets).** Contiene el desglose completo de
entregables en épicas y subtareas, con una estimación de **complejidad**, **tiempo** y **peso
ponderado** para cada una, además del diagrama de Gantt. Su función es cuantificar el avance: el
porcentaje de progreso del proyecto no se declara por percepción sino que se calcula como la suma de
los pesos alcanzados sobre el total. En la instancia de avance del 30 % esta planilla registraba
**211 puntos ponderados totales y 99 alcanzados**, es decir un **46,9 %**, cifra con la que el
equipo justificó un avance superior al exigido.

**GitHub.** Además del control de versiones, funcionó como herramienta de gestión de facto del
trabajo técnico: cada unidad de trabajo terminada es un *pull request* numerado, revisable y
trazable. Al cierre de este informe el proyecto acumula **89 pull requests** y 94 *commits* en la
rama principal, y la bitácora de sesiones referencia cada hito por su número de PR.

## 5.5 Control de versiones y flujo de trabajo

El proyecto se organiza como un **monorepo** con los tres pilares en un mismo repositorio (`app/`,
`hardware/`, `ml/`) más la documentación (`docs/`) y el backend (`supabase/`). La razón de mantener
los tres pilares juntos es que **las fronteras entre ellos cambian seguido**, y un cambio de
protocolo que toca la aplicación y el daemon simultáneamente debe poder revisarse y fusionarse como
una sola unidad. El pipeline de visión de ómnibus es la excepción: vive en un repositorio propio
(`bus-banner-recognizer`), porque su ciclo de trabajo (entrenar, evaluar, exportar) es independiente
del ciclo de la aplicación, y se consume desde la placa como una dependencia instalable.

### 5.5.1 Modelo de ramas

El repositorio mantiene dos ramas de larga vida, cada una asociada a un canal de distribución real:

- **`staging`** es la rama por defecto. Todo trabajo nuevo arranca en una rama de *feature* creada
  desde `staging` actualizado, **antes de la primera modificación**, y vuelve por *pull request*.
  Cada fusión a `staging` publica automáticamente una versión al grupo de pruebas interno.
- **`main`** es producción. Se alcanza únicamente mediante un *pull request* de `staging` a `main`,
  lo que constituye una **release** y publica al canal público.

Nunca se hacen *commits* directos sobre ninguna de las dos. Se adoptó además una regla explícita de
**no apilar pull requests**, derivada de un incidente concreto: al comienzo del proyecto se abrieron
cuatro PRs encadenados, cada uno basado en el anterior, y la resolución de conflictos al fusionarlos
consumió más tiempo que el trabajo original. Desde entonces, cada rama parte de la rama base
actualizada.

### 5.5.2 Convenciones

- **Commits** en formato *Conventional Commits* con alcance (`fix(app): …`, `feat(device): …`).
- **Idioma (ADR 0009).** Todo el código está en inglés: identificadores, nombres de archivo,
  comentarios, pruebas, ramas, *commits* y también las **fronteras** (el protocolo BLE, los
  endpoints de la placa y el esquema de la base de datos). En español queda todo lo que una persona
  lee o escucha: los textos de la interfaz, el *prompt* del modo supermercado, los anuncios de voz y
  **toda la documentación**, este informe incluido. La migración se hizo en un único *pull request*
  que tocó alrededor de 150 archivos, para no dejar el repositorio en un estado mixto; los 71
  *commits* anteriores se conservaron como estaban.
- **Verificación mínima antes de un PR**: análisis estático, verificación de tipos y la suite
  completa de pruebas.

## 5.6 Comunicación

**Con el director.** El seguimiento con el Ing. MSc. Sebastián García Parra se realizó mediante
reuniones de avance, en las que se presentaban los resultados medidos y se validaban los cambios de
rumbo. La reunión del **10 de agosto de 2026** fue determinante: de ella surgió la propuesta de
permitir la nube como acelerador opcional del camino de reconocimiento, que se formalizó como
enmienda al ADR 0001 el mismo día.

> `[PENDIENTE: el registro de reuniones del repositorio (docs/REUNIONES-TUTOR.md) sólo documenta la
> instancia del 2026-08-10. Completar con el resto de las reuniones realizadas, su fecha y los
> acuerdos alcanzados en cada una.]`

**Con el usuario.** La validación con Luciano, usuario ciego, funcionó como contraparte del
proyecto: aportó el relevamiento inicial mediante una entrevista en profundidad (transcripta
íntegramente en el anexo) y es la referencia contra la que se contrastan las decisiones de
interacción.

**Con las organizaciones de apoyo.** La Unión Nacional de Ciegos del Uruguay (UNCU) facilitó el
acceso a la población objetivo para la encuesta de relevamiento (26 respuestas). La empresa Arnaldo
Castro S.A. apoya el proyecto y puso a disposición un servidor con GPU NVIDIA Tesla V100 para el
entrenamiento de modelos.

**Interna.** La coordinación del equipo se apoyó en el tablero de Trello para el alcance y en los
*pull requests* de GitHub para el trabajo técnico, complementados con la bitácora del repositorio
como registro común de lo decidido.
