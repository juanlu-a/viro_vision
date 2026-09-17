# El informe de tesis

El documento vive en dos lugares y cada uno tiene un rol distinto.

| Dónde | Qué manda ahí |
|---|---|
| **Este directorio** | **Los capítulos 1 a 12.** Es la fuente de verdad: lo que está acá es el texto correcto |
| **El Google Doc** | La **carátula** y el **índice**, que no se pueden escribir en Markdown (la carátula lleva el logo como imagen y el índice es un campo vivo de Docs). Y es la superficie donde el equipo lee, comenta y sugiere |

**[ViroVision PFC v2 (completo)](https://docs.google.com/document/d/19Bki4iWc6h48yO6PNMBeEueIF4Gj3ApodsjWADizKWs/edit)** en la carpeta *Documentos* del Drive del proyecto.

## Archivos

| Archivo | Estado |
|---|---|
| `01-introduccion.md` | Del documento original |
| `02-descripcion-del-proyecto.md` | Del documento original: alcance, objetivos, entregables, antecedentes |
| `03-estado-del-arte.md` | Del original, más los cuatro apartados que estaban vacíos |
| `04-marco-teorico.md` | Del original, más métricas, YOLO, OCR, Edge AI, comunicación inalámbrica, audio y WCAG |
| `05-metodologia.md` | Nuevo |
| `06-planificacion.md` | Nuevo |
| `07-desarrollo.md` | Nuevo, el capítulo central |
| `08-despliegue.md` | Nuevo |
| `09-conclusiones.md`, `10-trabajo-futuro.md` | Marcadores; se escriben al final |
| `11-bibliografia.md` | Nuevo, pendiente de verificar contra las fuentes |
| `12-anexo.md` | Del original, más el material nuevo |

## Convenciones de redacción

- **Tercera persona.** Se admite «el equipo» y las formas impersonales («se optó por», «se midió»).
  Nunca primera persona.
- **Sin raya larga.** No se usa el guion largo de estilo inglés. Se emplean comas, dos puntos o
  paréntesis. `build.py` falla si aparece uno.
- **Números en formato español**: coma decimal y punto de miles.
- **Toda cifra tiene fuente.** Cada número remite a un ADR, a una campaña de `docs/mediciones/` o a
  un resultado guardado del repositorio de visión.
- **Lo pendiente se declara.** Lo que no está hecho o no está medido se dice, no se omite.
- **Ninguna credencial se transcribe.** Se nombra la deuda, no el valor.

## Marcadores

- `[FIGURA N: …]` marca una figura por producir, con la descripción de qué debe mostrar.
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
- Verificar la bibliografía contra las fuentes (capítulo 11).
- Conclusiones y trabajo futuro.
