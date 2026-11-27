# El informe de tesis

El documento vive en dos lugares y cada uno tiene un rol distinto.

| Dónde | Qué manda ahí |
|---|---|
| **Este directorio** | **Los capítulos 1 a 13.** Es la fuente de verdad: lo que está acá es el texto correcto |
| **El Google Doc** | La **carátula** y el **índice**, que no se pueden escribir en Markdown (la carátula lleva el logo como imagen y el índice es un campo vivo de Docs). Y es la superficie donde el equipo lee, comenta y sugiere |

**[ViroVision PFC v2 (completo)](https://docs.google.com/document/d/19Bki4iWc6h48yO6PNMBeEueIF4Gj3ApodsjWADizKWs/edit)** en la carpeta *Documentos* del Drive del proyecto.

## Archivos

| Archivo | Estado |
|---|---|
| `01-introduccion.md` | Del documento original |
| `02-descripcion-del-proyecto.md` | Contexto y relevamiento, requisitos (traídos del anexo en la revisión del director de noviembre de 2026), objetivos, alcance y entregables, en ese orden |
| `03-marco-teorico.md` | Reescrito por el equipo en el Doc (noviembre de 2026): IA, métricas, YOLO, OCR, Edge AI, comunicación inalámbrica, audio y WCAG |
| `04-estado-del-arte.md` | Del original, más los apartados que estaban vacíos |
| `05-metodologia.md` | Nuevo |
| `06-planificacion.md` | Nuevo |
| `07-desarrollo.md` | Diseño y desarrollo: de la arquitectura a cada componente, con sus decisiones y las mediciones que las justifican, resumidas |
| `08-despliegue.md` | Nuevo |
| `09-evaluacion.md` | Nuevo (noviembre de 2026): conjuntos de datos, métricas con su unidad y denominador, resultados por caso de uso, cumplimiento de requisitos y amenazas a la validez |
| `10-conclusiones.md` | Marcador; se escribe al final |
| `11-trabajo-futuro.md` | Nuevo |
| `12-bibliografia.md` | Nuevo, pendiente de verificar contra las fuentes |
| `13-anexo.md` | Del original, más el material nuevo |

## Convenciones de redacción

- **Tercera persona.** Se admite «el equipo» y las formas impersonales («se optó por», «se midió»).
  Nunca primera persona.
- **Sin raya larga.** No se usa el guion largo de estilo inglés. Se emplean comas, dos puntos o
  paréntesis. `build.py` falla si aparece uno.
- **Números en formato español**: coma decimal y punto de miles.
- **Referencias internas como «sec. 7.4.6»**, no con el signo de párrafo (decisión del equipo en el
  Doc, 2026-09-18).
- **Toda cifra tiene fuente.** Cada número remite a un ADR, a una campaña de `docs/mediciones/` o a
  un resultado guardado del repositorio de visión.
- **Lo pendiente se declara.** Lo que no está hecho o no está medido se dice, no se omite.
- **Ninguna credencial se transcribe.** Se nombra la deuda, no el valor.
- **Comillas “” y cita antes del punto** (convención del equipo en el Doc, 2026-11-17): “así”, y
  «… del proyecto \[45\].». Las citas son numéricas, \[n\], y remiten a la lista única del capítulo 12.
- **La bibliografía es una sola lista numerada**, sin subtítulos por tema: si se agrupara, el Doc
  reiniciaría la numeración en cada grupo y las citas dejarían de coincidir. Una fuente nueva se
  agrega al final, para no correr la numeración de las que ya se citan.
- **Toda tabla lleva número y título, arriba, y se cita desde el texto** (pedido del director, noviembre de
  2026): «Tabla N: título.» en la línea anterior a la tabla, numeración global y correlativa, y en el
  texto «la Tabla N muestra…» o «(Tabla N)», nunca «la tabla anterior». La fuente, si la hay, va debajo.
  `build.py` falla si una tabla no tiene título, si la numeración salta o si una tabla o una figura
  no se cita en ninguna parte, y genera `build/lists.md` con la lista de tablas y la de figuras, que
  van en el Doc junto al índice.
- **Las figuras van en el cuerpo**, junto al párrafo que las cita, con numeración global y
  correlativa: «Figura N: título.» debajo de la imagen y, en el párrafo siguiente, «Fuente: …». Sólo
  las muy grandes o las complementarias van además, o únicamente, en el anexo. En el Markdown la
  imagen se marca con `<!-- imagen del Doc: ruta -->`; las fuentes de las figuras nuevas están en
  `figuras/` o en la campaña de `docs/mediciones/` que corresponda.

## Marcadores

- `[FIGURA: …]` marca una figura por producir, con la descripción de qué debe mostrar.
- `[PENDIENTE: …]` marca un dato que falta y que debe completarse antes de la entrega.

## Publicar en el Doc

```sh
python3 build.py              # todo el cuerpo
python3 build.py --chapter 7  # un solo capítulo
```

Deja el `.md` y el `.html` en `build/`. El HTML es lo que se pega en el Doc: el comando que imprime
al final lo pone en el portapapeles con el formato que Docs entiende, de modo que los títulos y las
tablas llegan como títulos y tablas.

En el Doc, para reemplazar una sección:

1. Ir a la sección con el **panel de esquema** (un clic).
2. Poner el cursor al principio del título, seleccionar hasta el final de la sección, y **borrar**.
3. Con el cursor en el hueco: `cmd+alt+0` (texto normal) y `cmd+\` (borrar formato).
4. Recién ahí pegar con `cmd+v`.
5. Seleccionar lo pegado y ponerle **Times New Roman** y `cmd+shift+j`.
6. Si cambiaron los títulos, clic en el índice y botón de actualizar.

### Las tres trampas, que ya costaron dos documentos

- **Pegar encima de la selección hace que el texto herede el formato del punto de inserción.** Se
  borra primero y se pega después, con el paso 3 en el medio. Si no, el capítulo entero sale en rojo
  cursiva.
- **No tipear nunca dentro de Docs, ni siquiera para buscar.** Si un diálogo no tomó el foco, lo que
  se escribe cae en el cuerpo del documento. Pasó dos veces y las dos terminó incrustado en la
  carátula.
- **No deshacer a ciegas.** Borrar el cuerpo y pegar son operaciones separadas: unos pocos `cmd+z`
  seguidos se llevan también la carátula y el índice. Ante la duda, *Archivo → Historial de
  versiones*, que guarda todo.

### Publicar por la API, sección por sección (desde el 2026-10-22)

Con el conector de Google Docs, `sync_doc.py` reemplaza en el Doc **sólo las secciones que cambiaron**,
de abajo hacia arriba, sin tocar la carátula, el índice, las imágenes que el equipo agregó en el Doc
ni los comentarios de las secciones que no cambian. El ciclo es:

1. Leer el Doc con `read_doc` y quedarse con el objeto `content` (`jq '.content'`).
2. `python3 sync_doc.py doc.json batch.json --reinsert auto --delete-orphans --max-chars 25000` arma
   la tanda siguiente; con `--report` lista qué secciones difieren.
3. Mandar `batch.json` con `update_doc`, **siempre con su `writeControl`**: si alguien editó el Doc
   en el medio, Google rechaza la tanda entera y se vuelve al paso 1.
4. Repetir hasta que el script diga `ops=0`. Al final, actualizar el índice a mano (la API no lo
   refresca).

Desde el 2026-11-18 el script reescribe sólo los párrafos y las celdas de tabla que cambiaron, cuando la
estructura de la sección coincide (mismos párrafos, ítems y tablas). Si no coincide, reemplaza la sección
entera. Con `--reinsert auto` también reescribe las secciones cuyas únicas imágenes son figuras con
fuente en el repositorio: las que el Markdown marca `<!-- imagen del Doc: figuras/x.png -->` (ruta
relativa a `docs/tesis`, así que `../mediciones/...` también sirve; `ancho=450` fija el ancho en
puntos). Las reconoce por el texto del epígrafe y no por el número, que cambia cada vez que se agrega
una figura. Después, `python3 img_insert.py doc.json img.json <sha>` las vuelve a poner sobre su
epígrafe, bajándolas de GitHub en ese commit (el repo es público, así que el commit tiene que estar
pusheado). Los diagramas que el equipo dibujó en el Doc (marcados `<!-- imagen del Doc -->`, sin ruta)
nunca se borran: en esas secciones el script reescribe sólo el texto entre una imagen y la otra, y
para eso los marcadores del Markdown tienen que coincidir en cantidad con las imágenes del Doc. La API
de Docs limita las escrituras por minuto: ante el error de cuota hay que esperar y reintentar.

Desde el 2026-11-25 el script empareja las secciones del Markdown con las del Doc por alineación
global (la subsecuencia común de mayor peso), y no buscando hacia adelante el primer título que
coincide. El método anterior, ante la reestructura de la revisión del director, saltaba de 2.3 a los
requisitos del anexo y daba el documento entero por movido. Lo que sí se movió aparece como `NEW` (en
su lugar nuevo) más `ORPHAN` (la copia vieja en el Doc), y `--delete-orphans` borra la copia vieja.
Una `ORPHAN-IMG` (una copia vieja con imágenes del Doc) nunca se borra sola: hay que mover antes la
imagen, o confirmar que es una figura del repo, y recién entonces pasarla en `--delete-orphan-img
"7.4.5 "`. Las secciones nuevas al final del documento y las huérfanas del final también se aplican.

El script salta a propósito las secciones que todavía no hay que pisar (hoy, la 13.2.3, que en el Doc
tiene una copia de la tabla agregada a mano: ver `SKIP` en el código). Antes de publicar sigue valiendo la
regla de abajo: traer primero al repo lo que se haya editado directo en el Doc. La skill
`/doc_update_google` hace todo el recorrido: lee lo que entró a `main`, trae las ediciones del equipo,
atiende los comentarios del director (registro en `revision-director.md`), revisa la coherencia y
publica. Su estado queda en `doc-sync.json`.

Los saltos de página antes de cada capítulo son párrafos vacíos con estilo de título 1 al final de la sección anterior. El script nunca los borra: al reescribir o eliminar una sección se detiene antes de ellos (desde el 2026-11-25, cuando una corrida grande borró cuatro y hubo que reponerlos).

### Actualizar el índice

La API de Docs no puede actualizar el índice. Se actualiza desde Chrome, con el perfil jlabreu24:
se hace clic dentro del índice y se pulsa el botón "Actualizar índice" que aparece a su izquierda.
La actualización mezcla fuentes (las líneas nuevas quedan en Arial 11 y el resto en Times New Roman
12), por lo que después hay que uniformarlas:

1. Leer el Doc con `read_doc` y quedarse con el objeto `content`.
2. `python3 toc_style.py doc.json batch.json` arma la tanda. Por defecto toma la fuente y el tamaño
   mayoritarios en el índice; con `--font` y `--size` se fijan a mano. Sólo cambia la fuente y el
   tamaño, y vuelve a poner la negrita donde estaba, porque el cambio de fuente la borra.
3. Mandar `batch.json` con `update_doc`, con su `writeControl`. Si el script informa `ops=0`, el
   índice ya está uniforme.

### Traer el Doc al repo cuando el equipo editó mucho

Si el equipo reescribió secciones enteras en el Doc, conviene importar el Doc completo antes de
editar: se arma el Markdown de cada capítulo desde `read_doc` y se verifica con
`sync_doc.py --report` que no quede ninguna sección distinta. Así se hizo el 2026-11-09 (ver la
bitácora). Si después se renombra un título, hay que renombrarlo primero en el Doc (`replaceAllText`):
el script empareja secciones por título y, con un título nuevo, insertaría la sección sin borrar la
vieja.

## Trabajar en paralelo

Docs resuelve solo la edición simultánea, así que varias personas pueden escribir a la vez en
secciones distintas. Lo único que no se puede hacer con alguien adentro es **reemplazar el cuerpo
entero**, porque eso sí pisa todo.

Como el repo es la fuente de verdad, **un cambio hecho directamente en el Doc hay que traerlo acá**,
o la próxima publicación lo borra. El orden correcto es: leer el Doc, incorporar al `.md` lo que
haya cambiado, y recién entonces publicar.

## Pendientes del documento

- Las figuras marcadas.
- Las columnas reales del tablero de Trello (§5.4).
- El registro completo de reuniones con el director (§5.6).
- Verificar la bibliografía contra las fuentes (capítulo 12).
- Conclusiones y trabajo futuro.
