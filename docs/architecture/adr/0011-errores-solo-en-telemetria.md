# ADR 0011 — Los errores van a la telemetría, nunca al usuario

- **Status:** Accepted (2026-10-06)
- **Date:** 2026-10-06
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** app, accesibilidad, telemetría, placa
- **Relates to:** [ADR 0001](0001-offline-first-on-device-inference.md),
  [ADR 0008](0008-proxy-propio-para-claves-de-nube.md),
  [ADR 0010](0010-modo-oscuro-unico.md)

## Contexto

El 2026-09-08 lo técnico salió de las pantallas y el 2026-09-09 llegó la telemetría (`events` en
Supabase). Pero quedaban caminos por los que el **texto de un error** seguía llegando a la persona:
la lectura fallida decía `La nube no respondió (VISION_HTTP_500)`, la foto fallida leía en voz alta
`the device did not answer in 4 s`, la red decía la IP de la placa o el texto del sistema, y los
avisos de la placa (`unknown command: say`, la salida de `nmcli`) se mostraban y se decían tal cual,
en inglés, con la voz en español. Y al revés: errores que nadie registraba — `console.*`, promesas
rechazadas sin `catch` en los callbacks BLE, una pantalla que explotaba al dibujarse, los `catch`
silenciosos del cliente Bluetooth y todo lo que la placa sólo escribía en su journal.

El pedido del equipo fue explícito: **la app no muestra errores; cualquier error o log va a Supabase
para que lo leamos nosotros, y el usuario no se entera**.

## Decisión

1. **El texto de un error nunca llega a la pantalla ni a la voz.** Ni el mensaje, ni el código, ni
   la IP, ni lo que dice la placa. Se registra en la telemetría (`errorDetail()` lo acota) y ahí se
   lee.
2. **Lo que sí llega es una frase fija, en lenguaje llano, que dice qué hacer** — «No pude leer.
   Probá de nuevo.», «El dispositivo no pudo sacar la foto. Probá de nuevo.». No es un error
   mostrado: es la interfaz. Para quien no ve la pantalla, el silencio después de apretar el botón
   es indistinguible de un dispositivo roto (es la queja que originó el ADR 0007), así que callar
   del todo no es una opción.
3. **Los avisos de falla interna se callan del todo**: el aviso de la placa (`device.warning`) y la
   escritura de modo fallida (`device.modeFailed`) ya no se dicen ni se muestran; la pestaña
   Dispositivo pierde el panel de «último aviso».
4. **Todo error que nadie registraba ahora se registra**: `console.*` (`app.log`, con presupuesto por
   sesión), promesas rechazadas sin manejar (`app.error`, sólo en release para no tapar el aviso de
   desarrollo), errores de dibujo (`app.renderError`, con un `ErrorBoundary` raíz que muestra una
   pantalla neutra y «Volver a empezar»), los `catch` del cliente BLE (`ble.monitorError`,
   `ble.readFailed`) y **los logs de la placa**: un handler de `logging` (`log_relay.py`) manda las
   líneas WARNING o más graves como eventos `{t:'log'}` por BLE, la app las guarda como `device.log`.
5. La telemetría arranca **antes que cualquier pantalla** (a nivel de módulo en `_layout.tsx`), y un
   error no fatal en release se queda en la telemetría en vez de seguir al manejador por defecto.

## Consecuencias

- La telemetría pasa a ser **el único lugar** donde se ve por qué falló algo. Si está caída, no hay
  diagnóstico: por eso la función ahora valida evento por evento y reintenta fila por fila, para que
  un evento malo no tire un lote entero.
- Las frases de guía viven en `i18n/es.ts` y no llevan detalle. Hay dos frases de red: una para lo
  que se arregla solo («Sigo intentando») y otra para lo que no (sin credenciales, sin módulo WiFi),
  con el remedio.
- Un test que espere el texto de un error en lo que se dice está mal por construcción
  (`readingService.test.ts` lo verifica al revés).
- Lo que la placa registra mientras ningún teléfono escucha se guarda (las últimas 20 líneas) y se
  manda en la primera lectura de `status` de la conexión siguiente; con más de 10 por minuto, se
  cuentan y se descartan (`drop`).
