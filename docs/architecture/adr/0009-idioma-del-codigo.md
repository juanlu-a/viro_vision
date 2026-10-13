# ADR 0009 — El código en inglés, la app y la tesis en español

- **Status:** Accepted (2026-09-09)
- **Date:** 2026-09-09
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** app, hardware, backend, convenciones
- **Relates to:** [ADR 0003](0003-enlace-placa-telefono.md),
  [ADR 0007](0007-botones-fisicos-modos-de-operacion.md),
  [ADR 0008](0008-proxy-propio-para-claves-de-nube.md)

## Contexto

Hasta hoy la regla era mixta y estaba escrita así en las convenciones: **identificadores en inglés,
comentarios y cadenas en español**, con los sustantivos del dominio en español aun dentro de código
inglés (`BusReading.numero`, `ProductoLeido.marca`). La regla nació de algo razonable —la tesis es en
español y los comentarios explican decisiones que se discutieron en español— pero la frontera nunca
quedó donde decía.

Lo que se acumuló:

- **La frontera no se sostuvo.** Empezó en los identificadores y terminó en los nombres de archivo
  (`reconocerProducto.ts`, `fotoDeLaPlaca.ts`, `nucleo.py`), en los métodos (`escribirModo`,
  `leerEstado`), en los campos de tipos (`direccion.puerto`), en los eventos de telemetría
  (`lectura.fallo`) y en los flags del daemon (`--sin-camara`). No había una línea, había una
  pendiente.
- **Las dos mitades de un mismo contrato quedaron en idiomas distintos.** `providers/anthropic.ts`
  arma `max_tokens` y `content_block_delta` —inglés, porque lo fija la API— y los envuelve en
  `interpretarErrorHttp` y `ESPERA_POR_DEFECTO_S`. Lo mismo del lado de la placa: `capture_file` de
  picamera2 dentro de `capturar_jpeg`. Cada archivo hacía dos saltos de idioma por pantalla.
- **Tres personas, un solo repo, y un lector futuro.** El proyecto va a ser leído por el tutor, por
  el tribunal y —si sirve— por quien lo retome. El código con vocabulario mezclado obliga a saber los
  dos idiomas para leer una línea; la tesis en español no.

Al mismo tiempo hay una parte del sistema que **tiene** que estar en español y no es negociable: lo
que la persona ciega escucha. La voz es la interfaz (ADR 0001), y la app se usa en Montevideo.

## Decisión

**Todo el código va en inglés. La app le habla en español al usuario y la tesis se escribe en
español.**

En inglés, sin excepciones:

- identificadores, nombres de archivo y de módulo, comentarios y docblocks;
- descripciones de tests y nombres de funciones de test;
- nombres de rama y mensajes de commit y de PR, de acá en adelante (los 71 commits anteriores quedan
  como están: reescribir la historia por cosmética no vale la pena);
- **las fronteras**, que es la parte que cuesta y donde estaba la mitad del problema: el protocolo
  BLE (`{"cmd":"measure"}`, `{"t":"start"}`, `device_ms`), los endpoints HTTP de la placa
  (`/health`, `/measure/<n>`, `/photos/latest`), los flags del daemon (`--no-ap`) y el esquema de
  Supabase (tabla `events`, columnas `occurred_at`/`phone`/`type`/`detail`, y el vocabulario de
  eventos `reading.ok`, `ble.connected`).

En español, porque lo lee o lo escucha una persona:

- los **valores** de `app/src/i18n/es.ts` — las claves son inglesas;
- el prompt del modo supermercado (`services/vision/providers/prompts.ts`): su respuesta se lee en
  voz alta, así que pedirle al modelo que conteste en español es parte del producto, no del código.
  Los **nombres de campo** del schema sí son ingleses (`kind`, `brand`, `detail`);
- las etiquetas de los modelos del selector, que se muestran en pantalla;
- **toda la documentación**: `docs/`, los ADRs, `README.md`, la skill `virovision` y la tesis;
- los nombres propios de la marca (Azul Profundo, Verde Lectura, Gris Niebla).

## Consecuencias

**A favor**

- Un archivo se lee en un solo idioma. La API externa y el código que la envuelve dejan de alternar.
- La frontera es enunciable en una línea —"¿lo lee una persona o lo lee una máquina?"— y por eso se
  puede sostener. La anterior no lo era.
- El esquema de telemetría queda consultable con un vocabulario: las filas viejas se traducen en la
  misma migración, así que una consulta no necesita `type in ('reading.ok','lectura.ok')`.

**En contra, y aceptado**

- **Un diff enorme de una sola vez** (~150 archivos). Se hace en un solo PR a propósito: las dos
  puntas del protocolo BLE y del esquema tienen que moverse juntas, y una migración por partes deja
  ventanas donde la app y la placa hablan distinto.
- **La historia de `git blame` se corta** en los archivos renombrados. Se mitiga con `git mv` (Git
  sigue los renombres) y con `--follow`, pero los cambios dentro de cada archivo quedan bajo este
  commit.
- **Un paso manual en la microSD.** El script de arranque `/boot/firmware/modo-red.sh` tiene
  `--sin-ap` hardcodeado —lo usa para escribir el drop-in de modo desarrollo cuando existe el archivo
  `SIN-AP`—, así que volver a ese modo sin editarlo deja al daemon sin arrancar. Está en FAT: se
  arregla con la tarjeta puesta en cualquier computadora, sin entrar a la placa.
- **Los comentarios pierden algo de matiz.** Estaban escritos por hablantes nativos de español y
  varios contaban un fallo concreto con precisión. La traducción conserva el hecho y la consecuencia;
  el tono, en parte.
- **Los ADRs y la documentación quedan en español citando símbolos en inglés.** Es la mezcla que se
  acepta, y es la buena: el texto que explica el porqué se lee entero en un idioma, y los símbolos
  son nombres propios del código.

## Alternativas consideradas

- **Dejarlo como estaba.** Es lo más barato hoy y lo más caro cada semana: la pendiente ya se había
  deslizado dos veces y no había un criterio con el que frenarla.
- **Todo en español, incluidos los identificadores.** Coherente con la tesis, pero pelea con cada
  librería, cada API y cada convención del ecosistema (`useEffect`, `buildRequest`, `capture_file`),
  y deja al proyecto ilegible para cualquiera fuera del Río de la Plata.
- **Inglés en el código pero dejar las fronteras en español** (el protocolo BLE, el esquema). Era la
  opción sin riesgo operativo: no había que reinstalar el daemon ni migrar la tabla. Se descartó
  porque el contrato entre la app y la placa es justamente donde la mezcla más molesta —los dos lados
  se leen juntos— y porque el costo de moverlo sólo crece con cada unidad de hardware y cada fila de
  telemetría.
