---
name: doc_update_google
description: Actualiza el Google Doc oficial de la tesis de ViroVision con lo último de main. Lee todo lo que entró desde la última publicación (PRs, bitácora, mediciones, ADRs), lo redacta en docs/tesis con el estilo de la tesis, verifica que cada comentario del director quede resuelto, revisa la coherencia del documento entero y publica en el Doc sección por sección. Usala cuando el usuario invoque /doc_update_google o pida "pasar los cambios al Doc oficial".
---

# Actualizar el Doc oficial de la tesis

El repositorio (`docs/tesis/*.md`) es la fuente de verdad y el Google Doc es la superficie que lee el
director. Esta skill los pone al día en un solo recorrido: **lo que entró a `main` llega al
Markdown, el Markdown queda coherente y sin comentarios del director sin atender, y el Doc queda
igual al Markdown.**

- Doc oficial: `19Bki4iWc6h48yO6PNMBeEueIF4Gj3ApodsjWADizKWs` (*ViroVision PFC v2 (completo)*).
- Director: **Sebastián García Parra**; en los comentarios del Doc figura como `Sebastian Garcia`.
- Herramientas: `docs/tesis/build.py`, `sync_doc.py`, `img_insert.py` y `toc_style.py`. Su uso
  detallado está en `docs/tesis/README.md` ("Publicar en el Doc").
- Estado de la última publicación: `docs/tesis/doc-sync.json`.
- Registro de los comentarios del director: `docs/tesis/revision-director.md`.

Antes de empezar, cargá la skill `virovision` y leé `docs/tesis/README.md` entero. Las reglas de
redacción de ese README son obligatorias y esta skill no las repite todas.

## 0. Preparación

1. **Rama.** Creá `docs/doc-update-AAAA-MM-DD` desde `origin/staging` al día, **en un worktree**
   del scratchpad (`git worktree add`). Otras sesiones comparten el checkout principal y pueden
   cambiarte de rama. Si hay un PR abierto de una corrida anterior (`gh pr list --head
   'docs/doc-update-'`), partí de esa rama y no de `staging`, o el Doc perdería esos cambios.
2. **Qué hay en `main`.** `git fetch origin` y comparar `origin/main` con `origin/staging`. Lo que se
   documenta es lo que está en `main`. Si `staging` tiene commits que tocan `docs/tesis/` o
   funciones nuevas que todavía no salieron a `main`, listalos y preguntale al usuario una sola vez
   si se incluyen.
3. **Desde cuándo.** Leé `docs/tesis/doc-sync.json` (`main_sha`, `published_sha`, `date`). Si no
   existe, es la primera corrida: el punto de partida es la última entrada de `docs/SESSION-LOG.md`
   que diga que se publicó en el Doc.

## 1. Leer todo lo que cambió

Leé, desde `main_sha` hasta `origin/main`:

- `git log --first-parent main_sha..origin/main` y cada PR mergeado (`gh pr view N --json
  title,body,files`), el código incluido cuando el PR cambia un comportamiento que la tesis describe;
- las entradas nuevas de `docs/SESSION-LOG.md`, `docs/PROJECT-STATUS.md`, `docs/mediciones/` y los
  ADRs nuevos o enmendados;
- los cambios en `docs/tesis/` que hicieron otras sesiones.

Para cada cambio, decidí dónde va en la tesis: el capítulo y la sección que ya hablan del tema, o una
sección nueva sólo si no hay ninguna. Una medición nueva no borra la anterior: se comparan. Un
comportamiento que cambió se cuenta como decisión (qué se hacía, qué se observó, qué se cambió y
por qué), no como lista de cambios.

## 2. Traer lo que el equipo editó directo en el Doc

El equipo también escribe en el Doc. Si se publica sin traer esas ediciones, se borran.

1. `read_doc` del Doc oficial con `commentsIncluded: true`. El resultado es grande y se guarda en un
   archivo: `jq '.content' archivo > doc.json`.
2. Armá un worktree en `published_sha` (lo último que se publicó), copiale el `sync_doc.py` actual
   en `docs/tesis/` y corré ahí `python3 sync_doc.py doc.json /dev/null --report --reinsert auto`.
   Como compara el Doc con lo último publicado, cada `REPLACE` que aparezca es **una edición del
   equipo en el Doc**.
3. Incorporá cada una al Markdown de la rama, respetando lo que escribió el equipo. Si el repo también
   cambió esa sección, combiná las dos versiones a mano. Ante una contradicción de contenido, preguntá.

## 3. Los comentarios del director

Cada comentario y cada acotación del director tienen que quedar atendidos en el texto. Esto **se
hace antes de publicar**: al reemplazar una sección se pierde el anclaje de los comentarios sobre
ese texto.

1. Del `doc.json`, los comentarios de `Sebastian Garcia` (los `OPEN` y también los `RESOLVED` que no
   estén en el registro), con `commentId`, `plainTextQuote`, `headPost.content`, `replies` y la fecha.
   Sumá los comentarios generales que el usuario pase en el pedido, por ejemplo copiados de WhatsApp.
2. Para cada uno, ubicá el texto en el Markdown y verificá si está resuelto. Si no lo está:
   - si se resuelve redactando, resolvelo en la rama;
   - si falta un dato que sólo tiene el equipo, dejá un `[PENDIENTE: …]` en el lugar exacto;
   - si no corresponde, anotá el motivo, que el usuario va a tener que explicarle al director.
3. Mantené `docs/tesis/revision-director.md` con una fila por comentario: `commentId`, fecha, texto
   citado (corto), comentario, estado (`resuelto`, `pendiente del equipo` o `no corresponde`) y dónde
   quedó (sec. X.Y). Un comentario nunca se borra del registro, sólo cambia de estado. Los pedidos
   generales también van, con el origen "mensaje" en lugar del `commentId`.
4. Los comentarios en el Doc **no se marcan como resueltos** sin pedido del usuario. Si lo pide, se
   hace desde Chrome con el perfil jlabreu24 y una respuesta breve e informal que diga dónde quedó,
   sin mencionar ADRs.

## 4. Coherencia y estilo del documento entero

No alcanza con que cada párrafo nuevo esté bien: el documento tiene que leerse como uno solo.

- **Estilo** (README de la tesis): tercera persona o impersonal ("el equipo", "se optó por"), nunca
  primera persona; **sin raya larga** (comas, dos puntos o paréntesis); prosa narrativa y continua,
  sin listas telegráficas ni tono de informe automático; comillas “”; cita numérica antes del punto
  ([45].); números en formato español (coma decimal, punto de miles); referencias como "sec. 7.4.6";
  toda cifra con su fuente; lo que falta se declara y no se omite; ninguna credencial transcrita.
- **No sonar a robot.** Nada de "Cabe destacar", "Es importante mencionar", "En resumen" al final de
  cada sección, enumeraciones de tres adjetivos ni frases que repiten el título. Conectar los
  párrafos con lo que se decidió y por qué, como escribe el equipo en el resto del Doc.
- **Coherencia.** El mismo dato tiene el mismo valor en todos los capítulos (latencias, cantidades,
  precisión, costos, fechas). Revisá con `grep` cada cifra que tocaste. Los términos se usan
  igual en todo el documento: "discapacidad visual (ceguera o baja visión)", "el dispositivo", "la
  aplicación", "modo ómnibus" y "modo supermercado". La estructura que anuncia 1.2 coincide con los
  capítulos reales. Los estados de requisitos (9.8) coinciden con lo que dicen 7 y 9. Lo pendiente
  en el capítulo 10 y en las limitaciones (9.9) coincide con los `[PENDIENTE]` del texto. El mismo
  contenido no se repite en dos capítulos: se cita.
- **Orden.** Cada sección nueva va donde el lector la espera, dentro del orden de su capítulo
  (capítulo 7: de la arquitectura a cada componente; capítulo 9: datos, métricas, resultados por caso
  de uso y amenazas a la validez).
- **Tablas y figuras.** «Tabla N: título.» arriba, «Figura N: título.» abajo, numeración global y
  correlativa, y cada una citada en el texto. Una figura nueva con fuente en el repo se marca con
  `<!-- imagen del Doc: figuras/x.png -->`, con la ruta relativa a `docs/tesis`, para que
  `img_insert.py` la publique.
- `python3 docs/tesis/build.py` tiene que pasar: controla la raya larga, los títulos de tabla, la
  numeración y las citas. Además, verificá por script que ninguna "sec. X.Y", "anexo X.Y", "Tabla N"
  o "Figura N" apunte a algo que no existe.
- Si el cambio es grande (secciones nuevas, cifras, reestructura), corré `tackle-review` sobre la
  rama antes de publicar.

## 5. PR

- Actualizá `docs/tesis/doc-sync.json` con `main_sha` (el `origin/main` revisado), la fecha y el
  `published_sha`. Este último lo escribís después de publicar (paso 6), con el commit de la rama que
  quedó en el Doc.
- Actualizá la knowledgebase (`docs/SESSION-LOG.md` y, si corresponde, `PROJECT-STATUS`), commiteá
  con Conventional Commits (`docs(thesis): ...`) y abrí el PR a `staging`: título y descripción en
  inglés y **sin ninguna atribución de IA** (ni trailers ni "Generated with").
- Pusheá antes de publicar: `img_insert.py` baja las imágenes de GitHub desde ese commit.

## 6. Publicar en el Doc

Desde el worktree de la rama:

1. `read_doc` (sin comentarios alcanza), `jq '.content'` a `doc.json`.
2. `python3 docs/tesis/sync_doc.py doc.json batch.json --report --reinsert auto --delete-orphans
   --max-chars 25000`. Antes de mandar nada, leé el reporte:
   - `REPLACE` y `RETITLE` son secciones que cambiaron;
   - `NEW` son secciones nuevas o movidas;
   - `ORPHAN` es una sección del Doc que el Markdown ya no tiene en ese lugar (se movió o se sacó). Si
     aparecen muchísimas, el emparejamiento falló: no publiques, investigá;
   - `ORPHAN-IMG` es lo mismo con imágenes del Doc adentro. Nunca se borra solo. Si sus imágenes
     son figuras del repo, o el equipo ya las movió a mano, se borra con `--delete-orphan-img
     "7.4.5 "`; si no, pedile al usuario que mueva la imagen en el Doc (cortar y pegar) y repetí;
   - `SKIP-IMG` es una sección con imágenes cuya estructura no se pudo emparejar. Se actualiza a mano
     o se ajusta el Markdown para que los marcadores `<!-- imagen del Doc -->` coincidan con las
     imágenes del Doc.
3. Mandá `batch.json` con `update_doc`, **siempre con su `writeControl`**. Si Google la rechaza
   porque alguien editó en el medio, volvé al paso 1. Ante el error de cuota, esperá y reintentá.
4. Repetí 1 a 3 hasta que el script diga `ops=0`. Con una reestructura grande son muchas tandas (la
   del 2026-11-24 suma cerca de 1 MB de solicitudes). Avisale al usuario el tamaño antes de empezar.
5. `python3 docs/tesis/img_insert.py doc.json img.json <sha pusheado>` vuelve a poner las figuras del
   repo sobre su epígrafe. Mandalo igual que una tanda. Es idempotente: no repite imágenes.
6. El índice: la API no lo actualiza. Desde Chrome (perfil jlabreu24, verificá la cuenta antes de
   tocar nada), clic en el índice y "Actualizar índice"; después `toc_style.py` para uniformar la
   fuente. La lista de tablas y la de figuras salen de `docs/tesis/build/lists.md`.
7. Verificá: un último `read_doc` y `--report` tienen que dar sin operaciones, salvo las que
   explicaste. Escribí `published_sha` en `doc-sync.json` y pusheá.

## 7. Cierre

Contale al usuario, sin rodeos:

- qué cambios de `main` entraron a la tesis y en qué secciones;
- el estado de los comentarios del director: cuántos quedaron resueltos, cuántos pendientes del
  equipo (con la lista) y cuántos no corresponden (con el motivo);
- qué se publicó en el Doc y qué quedó para hacer a mano (imágenes, índice);
- el link del PR.

## Reglas que no se negocian

- Nunca se publica sin traer antes las ediciones del equipo (paso 2) ni sin registrar los comentarios
  del director (paso 3).
- Nunca se reemplaza el cuerpo entero del Doc ni se tipea dentro del Doc desde Chrome (ver las tres
  trampas del README).
- La carátula y el índice viven sólo en el Doc: el script empieza en "1. Introducción" y no los toca.
- No se inventan datos para cerrar un comentario: lo que falta va como `[PENDIENTE: …]`.
