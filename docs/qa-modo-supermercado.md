# QA del modo supermercado

Cómo probar el modo supermercado de punta a punta, y en qué orden. Está partido por **qué necesita
cada bloque**, porque buena parte se puede hacer hoy y el resto depende de cosas que sólo se hacen
una vez (claves, proyecto de Supabase).

Doble propósito: los pasos 8 y 9 **son** la corrida que alimenta el dataset de evaluación de la
tesis (ADR 0006). No son sólo QA.

> **VoiceOver encendido en todo lo que diga "con VoiceOver".** Un modo que funciona mirando la
> pantalla y no funciona con el lector de pantalla es un modo que no funciona: la voz es la interfaz
> (ADR 0001), y el texto en pantalla es el registro.

---

## Bloque A — sin nada nuevo (la clave de Gemini que ya está)

Necesita **rebuild nativo**: cambiaron los permisos en `app.json`, y eso no entra por Fast Refresh.

```sh
cd app
npx expo run:ios --device "iPhone de Juan"
```

### 1. La cámara (la de la placa: desde el 2026-09-08 es la única)

- [ ] Inicio → **Activar modo supermercado**. Se anuncia por voz.
- [ ] La línea *Dispositivo* de arriba llega a **listo, con su red**. Hasta que llegue, **Leer con el
      dispositivo** está deshabilitado — es lo esperado, no una falla.
- [ ] **Leer con el dispositivo** con un producto real frente a la cámara de la placa → se anuncia
      **tipo, marca y detalle** ("arroz Saman, Blue Patna 1 kg").
- [ ] En pantalla aparece *Última lectura* con sus campos, y **nada más**: ni tiempo, ni modelo, ni
      texto crudo, ni la foto. Eso ahora va a los logs de Supabase.

### 2. Sin dispositivo (el caso que reemplazó al del permiso denegado)

- [ ] Apagar la placa → la línea *Dispositivo* pasa a **no encontrado; prendelo y acercalo** y
      **Leer con el dispositivo** queda deshabilitado.
- [ ] Con VoiceOver sobre el botón deshabilitado, el hint dice qué falta (dispositivo prendido y
      cerca, o buscarlo desde la pestaña Dispositivo). Un control apagado sin explicación es el
      defecto que este paso busca.
- [ ] iOS **no** pide permiso de cámara ni de fotos en ningún momento: salieron del manifiesto con
      `expo-image-picker`. Si aparece alguno, quedó un plugin viejo y hay que rehacer el prebuild.

### 3. El tamaño de la foto

- [ ] La placa entrega el JPEG ya a 1024 px y calidad 70; la app no la vuelve a tocar. Si la lectura
      empeora o encarece, el lugar de mirar es `hardware/raspi/virovision/camera.py`, no la app.

### 4. Con VoiceOver

- [ ] Recorrer Inicio con swipes. Orden esperado: estado del dispositivo → modo actual → botón
      ómnibus → botón supermercado → Leer con el dispositivo → resultados.
- [ ] El **selector de modelo** está en Ajustes (desde el 2026-09-04): el disparador se anuncia como
      "Modelo seleccionado: <modelo>" y el menú como "Seleccionar modelo", `radiogroup` con `checked`.
- [ ] Elegir otro modelo en Ajustes y volver a Inicio: la lectura siguiente tiene que salir por **ese**
      modelo. Ya no se muestra en pantalla, así que se confirma en los logs de Supabase. Es lo que el
      Provider garantiza y lo que dos hooks separados romperían.
- [ ] El botón principal **muta** entre "Leer con el dispositivo" y "Leyendo…" — no se intercambia por
      otro botón. Si el foco se pierde al leer, eso es la trampa ya documentada.
- [ ] Agrandar el tipo del sistema (Ajustes → Pantalla y brillo → Tamaño del texto) y confirmar que
      ninguna etiqueta queda recortada.

### 5. Sin internet (la restricción de ADR 0001)

- [ ] Modo avión → modo supermercado → leer: se anuncia **"Sin conexión a internet…"**. No rompe, no
      se queda callado.
- [ ] Modo avión → **modo ómnibus** → leer: **sigue leyendo**. Es el camino local, y que funcione sin
      red es la restricción dura del proyecto.

### 6. La espera por cuota

- [ ] Sacar lecturas seguidas hasta agotar el cupo (17/min en Gemini). Cuando el limitador tiene que
      esperar, **se anuncia** "Esperando cupo del modelo. Sigo en N s." Antes esperaba en silencio, y
      para quien no ve la pantalla eso era indistinguible de una app colgada.

> ⚠️ **Al medir latencia, espaciá las corridas.** Sostener pedidos satura el tier gratuito y a partir
> de la tercera lectura seguida *cualquier* modelo salta a 20-80 s. Eso mide la cuota, no el modelo.

---

## Bloque B — con las claves de OpenAI y Groq

Las claves van a `app/.env` (ver `app/.env.example`). **Nunca a un commit ni a un chat.**

- Groq: gratis, sin tarjeta → <https://console.groq.com>
- OpenAI: necesita crédito → <https://platform.openai.com>. **Poné el tope de gasto antes de generar
  la clave**: es la única red de seguridad que no depende de que nuestro código esté bien (ADR 0008).

### 7. El selector

- [ ] Con las cuatro claves, el selector ofrece **cuatro modelos** (el quinto, Arnaldo Castro, está
      documentado y no implementado).
- [ ] Elegir uno, cerrar la app por completo y volver a abrirla → **sigue elegido**. Se persiste.
- [ ] Con VoiceOver, el selector se anuncia como grupo de radio y dice cuál está marcado.

### 8. Verificar cada proveedor contra la API real ✅ *(hecho el 2026-09-02, salvo Anthropic)*

> Los tres proveedores con clave se verificaron contra la API real y **los tres pasan**: responden,
> devuelven los tres campos y aciertan. Los números y los dos hallazgos que corrigieron el código
> están en [`pruebas-y-decisiones.md`](pruebas-y-decisiones.md). Queda pendiente sólo
> `claude-haiku-4-5`, que necesita tarjeta. Lo de abajo se conserva como receta para cuando se
> agregue un proveedor nuevo.

Los proveedores de OpenAI y Groq están escritos **contra los docs, no contra la API real**. Esta base
tiene el estándar contrario a propósito: el de Gemini está verificado contra la API, y por eso
encontró que el discriminador es `event_type` y no `type` — algo que los docs no dicen y que descarta
todos los eventos **en silencio**. Esto es lo que hay que confirmar:

- [ ] **`gpt-5.6-luna` responde y devuelve los tres campos.** Si vuelve vacío pero sin error, el
      sospechoso es la lectura de eventos, no el modelo.
- [ ] **`reasoning_effort: 'none'` no da 400 y efectivamente baja la latencia.** Medir, no asumir:
      es lo que separa 3 s de 30 s.
- [ ] **`max_completion_tokens` y `stream_options` no dan 400 en Groq.** Su compat layer es de
      OpenAI, pero no está documentado explícitamente.
- [ ] **`qwen/qwen3.8-27b` acepta `json_schema` junto con una imagen.** El doc de structured outputs
      y el de visión son páginas distintas y ninguna cruza los dos casos. Si da 400, el fallback es
      `{ type: 'json_object' }` **y** nombrar los campos en el prompt.
- [ ] **La forma del error de cuota** en cada uno, para confirmar que se detecta como
      `quota_exceeded` y que se extraen los segundos.

### 9. La corrida de comparación (= el dataset de evaluación)

> ⚠️ **Este bloque no se puede correr desde la app desde el 2026-09-08.** La fototeca era lo que
> permitía pasarle *la misma* foto a varios modelos, y se retiró con la cámara del teléfono
> (ADR 0006, actualización 2026-09-08). Hasta reponer una entrada de prueba detrás de una bandera, la
> corrida va **fuera de la app**: el set de fotos guardado, contra el proxy, un modelo por vuelta.

- [ ] Elegir **10 productos de canasta básica** reales y sacarles foto **una sola vez** cada uno.
- [ ] Para cada foto, correrla contra **los cuatro modelos** con la MISMA imagen — si cada modelo
      viera una foto distinta, la comparación mediría fotos, no modelos.
- [ ] Anotar por corrida: modelo, tiempo, y si acertó `tipo`, `marca` y `detalle` **por separado**.
      Separados y no como un acierto único: el tipo decide si el producto sirve y la marca sólo cuál
      de los que sirven.
- [ ] **Espaciar las corridas.** Ver la advertencia del bloque A.
- [ ] Volcar los números en `docs/pruebas-y-decisiones.md`.

---

## Bloque C — con el proxy desplegado

Pasos previos en [`supabase.md`](supabase.md). Resumen: crear el proyecto, `supabase secrets set` por
proveedor, `supabase functions deploy vision`, y `EXPO_PUBLIC_VISION_PROXY_URL` en `app/.env`.

### 10. Que la guarda funciona

```sh
curl -sS -X POST "$EXPO_PUBLIC_VISION_PROXY_URL" \
  -H 'content-type: application/json' \
  -d '{"provider":"gemini","url":"https://example.com/","body":{}}'
```

- [ ] Responde **400 "El destino no corresponde al proveedor"**. Si reenviara, el proxy sería un SSRF
      que le entrega la clave al primero que la pida.
- [ ] Con `provider` inexistente → 400.
- [ ] Con un secret sin cargar → **503 nombrando cuál falta** (no un 500 genérico).

### 11. Que la clave no está en el binario

- [ ] **Vaciar las cuatro `EXPO_PUBLIC_*_API_KEY` de `app/.env`**, dejando sólo
      `EXPO_PUBLIC_VISION_PROXY_URL`. Rebuild.
- [ ] La app **sigue ofreciendo los cuatro modelos** y las lecturas funcionan. Ése es el build
      distribuible.
- [ ] `strings` sobre el binario **no** encuentra ninguna clave:

```sh
strings ~/Library/Developer/Xcode/DerivedData/ViroVision-*/Build/Products/*/ViroVision.app/ViroVision \
  | grep -E 'AIza|sk-|gsk_'
```

- [ ] Con el proxy caído (borrar la función o cortar la red): se anuncia el error, **no** rompe, y el
      modo ómnibus sigue leyendo.

---

## Bloque D — el archivo de audio (apagado por defecto)

`EXPO_PUBLIC_AUDIO_FILE_ENABLED=1` en `app/.env`, más clave de OpenAI o proxy. Está apagado a
propósito: hoy nada consume el archivo, y prenderlo es pagar una llamada por cada lectura.

### 12.

- [ ] Con la bandera prendida, después de una lectura aparece la fila **Audio guardado** con una ruta
      `file://…/lecturas/lectura-….mp3`.
- [ ] **El anuncio por voz sigue siendo inmediato**, sin esperar al archivo. Si se nota una demora
      entre la lectura y la voz, el `void` del camino crítico se rompió.
- [ ] Cortar la red **después** de la lectura (o poner una clave inválida): el usuario **igual escucha
      el producto** y sólo falta la fila del archivo. Ésa es la propiedad que importa.
- [ ] Con la bandera apagada, la fila no aparece y no se hace ninguna llamada al TTS.

---

## Bloque E — con la pantalla bloqueada (el caso real del producto)

Es **el** bloque: el usuario lleva el teléfono bloqueado en el bolsillo y opera con el botón de la
placa. El 2026-09-10 esto no funcionaba y nadie lo había probado así. Ver la actualización de
[ADR 0003](architecture/adr/0003-enlace-placa-telefono.md).

Necesita **rebuild nativo** (cambió `app.json`) y el proyecto de Supabase con telemetría, porque
**con el teléfono bloqueado no hay consola**: la única evidencia es la tabla `events`.

```sh
cd app
npx expo run:ios --device "iPhone de Juan"
```

### 13. La preparación

- [ ] Anotar la hora. En la tabla, buscar el `app.start` del arranque y **anotar su `session`**: es
      lo que después distingue "iOS suspendió la app" de "iOS la mató".
- [ ] Placa prendida, app abierta, línea *Dispositivo* en **listo, con su red**, modo supermercado
      activo, un producto real frente a la cámara.
- [ ] VoiceOver **encendido**.
- [ ] Una lectura en primer plano que salga bien. Es la línea base: sin ella, un fallo bloqueado no
      dice nada.

### 14. La corrida

- [ ] Botón de bloqueo. **Esperar 30 s** — probar enseguida no prueba nada, iOS todavía no suspendió.
- [ ] **Dos clicks** en el botón físico, con el teléfono guardado y la pantalla apagada.
- [ ] **Se escucha el chirp de inmediato** (< 0,5 s). Éste es el corte más importante de todo el
      bloque: si suena, la app despertó y la sesión de audio anda, y lo que falle después es el
      pipeline. Si no suena, nunca despertó y no tiene sentido mirar el resto.
- [ ] A los ~3 s **se escucha el producto** por el parlante del teléfono, con la pantalla apagada.
      **Éste es el criterio de aceptación del arreglo, y es el único.**
- [ ] VoiceOver **no** se corta ni baja de volumen mientras habla la app. Es lo que compra
      `mixWithOthers`; si se corta, el `interruptionMode` no quedó donde debía.
- [ ] Repetir el doble click **dos veces más sin desbloquear**, con productos distintos. Las tres
      tienen que salir: la segunda y la tercera son las que fallan si la app se suspende entre
      despertares.
- [ ] Desbloquear: en Inicio está la **última** lectura con su foto.

### 15. Cómo se lee la tabla (esto **es** el diagnóstico, no un extra)

- [ ] Todas las filas de la ventana bloqueada tienen `detail.app = "background"`. Si dicen
      `"active"`, el teléfono no llegó a suspender: repetir esperando más.
- [ ] Hay `ble.event` con `{t:"read"}` → **la radio despertó la app**. Si falta, el problema está en
      el enlace o en el proceso, no en el pipeline.
- [ ] Hay `reading.requested` → el orquestador entró. `ble.event` sin `reading.requested` significa
      que el disparo se perdió entre la capa nativa y JS.
- [ ] Hay `audio.session {ok:true}` → la sesión se pudo tomar. `ok:false` explica un chirp mudo.
- [ ] Hay `photo.ok`, `reading.ok`, `audio.spoken`. **El primero que falte nombra la etapa.**
- [ ] `reading.failed` con `stage:"deadline"` = se pasó de los 12 s. Mirar el `ms` de `photo.ok` y de
      `reading.ok` para saber cuál de las dos mitades se lo comió.
- [ ] **El `session` de las filas de después de desbloquear es el MISMO que el de antes de
      bloquear.** Si cambió, **iOS terminó la app** y hace falta `restoreStateIdentifier` (ADR 0003,
      pendiente anotado). Si no hay ninguna fila **y** el `session` cambió: mismo caso. Si no hay
      ninguna fila y el `session` es el mismo, la app estuvo suspendida y CoreBluetooth no la
      despertó — buscar un `ble.lost`.

### 16. Las variantes que hay que correr al menos una vez

- [ ] **En el bolsillo**, no apoyado en la mesa: descarta que fuera proximidad u orientación.
- [ ] **Con música sonando** en otra app: la lectura **mezcla**, no corta la música.
- [ ] **Bloqueado 5 minutos** antes del doble click: es el caso que distingue "suspendida" de
      "terminada", y el que decide si hay que implementar `restoreStateIdentifier`.
- [ ] **Con el chirp escuchado pero sin voz**: quiere decir que `AVSpeechSynthesizer` no respeta
      nuestra sesión. La escalera de arreglos está en la actualización del 2026-09-10 de ADR 0003
      (probar `useApplicationAudioSession`, y si no, el `.mp3` de `services/audio/synthesis.ts`).

---

## Qué NO cubre este documento

- **El hardware.** Los dos casos de ómnibus del diagrama
  ([`documents/logicas-casos-de-uso.pdf`](../documents/logicas-casos-de-uso.pdf)) están en stand by.
  Que el `.mp3` llegue al **parlante de la placa** no se puede probar todavía: falta el DAC I2S. Todo
  el audio de hoy, incluido el del bloque E, sale por el parlante del teléfono.
- **El fallback local de supermercado.** Sigue pendiente (Gemma 3 1B con visión). Hoy, sin internet,
  el modo avisa y no lee — excepción acotada y documentada a ADR 0001.
