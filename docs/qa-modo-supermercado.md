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

### 1. La cámara

- [ ] Inicio → **Activar modo supermercado**. Se anuncia por voz.
- [ ] **Sacar foto y leer** → iOS pide permiso de cámara **con el texto en español** ("ViroVision usa
      la cámara para sacar la foto del cartel del ómnibus o del producto…"). Si sale el texto genérico
      de Apple, el plugin no aplicó y hay que rehacer el prebuild.
- [ ] Sacar la foto de un producto real → se anuncia **tipo, marca y detalle** ("arroz Saman, Blue
      Patna 1 kg").
- [ ] En pantalla aparecen *Última lectura*, *Modelo* y *Tiempo*.

### 2. El permiso denegado (el caso que antes no decía nada)

- [ ] Rechazar el permiso cuando iOS lo pide → **se anuncia** "ViroVision necesita permiso para usar
      la cámara. Aceptalo cuando el teléfono lo pida."
- [ ] Ajustes del iPhone → ViroVision → Cámara → apagar. Volver a intentar → se anuncia el **otro**
      mensaje, el que manda a Ajustes y recuerda que la fototeca sigue disponible.
- [ ] Con el permiso apagado, **Elegir foto de la fototeca** sigue funcionando. Es la salida, por eso
      no se esconde.

### 3. El achique de la foto

- [ ] Anotar el *Tiempo* de tres lecturas con la cámara, **espaciadas** (ver la advertencia de abajo).
- [ ] Comparar contra los 2-3 s medidos el 30/08/2026 con fotos de la fototeca
      (`docs/pruebas-y-decisiones.md`). Debería ser igual o mejor: antes se subía la foto entera.
- [ ] Si empeoró, el sospechoso es el redimensionado en sí, no la red — se mide aparte.

### 4. Con VoiceOver

- [ ] Recorrer Inicio con swipes. Orden esperado: modo actual → botón ómnibus → botón supermercado →
      **selector de modelo** → Sacar foto → Elegir de la fototeca → resultados.
- [ ] El selector aparece **justo después** del botón que activa el modo: es la razón por la que está
      ahí y no en Ajustes.
- [ ] El botón principal **muta** entre "Sacar foto y leer" y "Leyendo…" — no se intercambia por otro
      botón. Si el foco se pierde al leer, eso es la trampa ya documentada.
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

### 8. Verificar cada proveedor contra la API real ⚠️

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

- [ ] Elegir **10 productos de canasta básica** reales y sacarles foto **una sola vez** cada uno.
- [ ] Para cada foto, correrla contra **los cuatro modelos** usando **Elegir foto de la fototeca** —
      por eso la fototeca no se sacó: con la cámara cada modelo vería una foto distinta y la
      comparación mediría fotos, no modelos.
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

## Qué NO cubre este documento

- **El hardware.** Los dos casos de ómnibus del diagrama
  ([`documents/logicas-casos-de-uso.pdf`](../documents/logicas-casos-de-uso.pdf)) están en stand by y
  el enlace BLE/WiFi no existe. Que el `.mp3` llegue al parlante del dispositivo no se puede probar
  todavía, y puede terminar no haciendo falta: es materia de ADR 0003.
- **El fallback local de supermercado.** Sigue pendiente (Gemma 3 1B con visión). Hoy, sin internet,
  el modo avisa y no lee — excepción acotada y documentada a ADR 0001.
