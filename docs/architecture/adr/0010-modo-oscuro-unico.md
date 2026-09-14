# ADR 0010 — Un solo tema (oscuro) y una sola línea de estado del dispositivo

- **Status:** Accepted (2026-09-14)
- **Date:** 2026-09-14
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** app, accesibilidad, marca
- **Relates to:** [ADR 0003](0003-enlace-placa-telefono.md),
  [ADR 0007](0007-botones-fisicos-modos-de-operacion.md)

## Contexto

La app nació con un **selector de tema** (según el sistema / claro / oscuro) persistido en
AsyncStorage, y con los dos temas del manual de marca verificados por `theme.test.ts`. Sostenerlo
costaba más de lo que parecía: una preferencia guardada, el splash retenido hasta leerla para no
pintar con un esquema y saltar al otro, un `ThemePreferenceProvider` arriba de toda la app, dos
archivos del símbolo, y **dos sistemas de estilo** (tokens de React Native y clases de NativeWind)
que había que empujar a la vez para que «Claro» no dejara mitad de la app en oscuro.

Y la persona para la que está hecha la app no lo usa. La interfaz es la voz (ADR 0001, ADR 0003 §2);
quien tiene algo de visión residual se beneficia de **un** contraste alto y estable, no de elegirlo.
El manual de marca define el oscuro como el modo del ícono y del splash (Azul Profundo).

En paralelo, la pantalla de Inicio repetía información: un título de sección «RECONOCIMIENTO», una
línea con el estado del dispositivo («listo, con su red» / «conectado por Bluetooth, sin red» / …)
y un rótulo «Modo actual» con el modo en tamaño de titular. La pestaña Dispositivo ya existe para
decir si el dispositivo está, y decirlo en dos lugares con dos vocabularios era un tablero de
diagnóstico dentro de una app para gente que no lo ve.

## Decisión

1. **La app se publica sólo en modo oscuro.** Se retiran el selector, la preferencia guardada y el
   provider. `useTheme()` devuelve `Colors.dark`; `global.css` define la paleta oscura en `:root` sin
   clase que alternar; `app.json` fija `userInterfaceStyle: "dark"`. La paleta clara **sigue en
   `colors.js` y sigue verificada**: es la del manual y la usa el material de la tesis, pero ninguna
   pantalla la renderiza.
2. **Una sola línea de estado del dispositivo, en la pestaña Dispositivo, y significa «listo para
   usar».** «Conectado» en verde sólo cuando el enlace BLE está y la red WiFi de la placa responde.
   Si el enlace está pero la red no, dice **«Conectado (falta el WiFi)» en ámbar**, y nada más: el
   porqué y el remedio siguen en el aviso de abajo. Sin enlace BLE no hay conexión parcial posible
   —las credenciales y la dirección llegan por él—, así que ese caso es el «Sin conectar» / «Se
   perdió la conexión» de siempre.
3. **Inicio muestra sólo el nombre del modo**, en tamaño de cuerpo. Se van el título de sección, la
   línea del dispositivo y el rótulo «Modo actual». El lector de pantalla conserva el rótulo («Modo:
   Esperando»), porque «Esperando» solo no dice qué espera. La pista del botón «Leer con el
   dispositivo» sigue diciendo qué falta y manda a la pestaña Dispositivo.

Para el ámbar se agrega el token `warning` (`#FFC857` en oscuro, 10.97:1 sobre el fondo; `#6E4400`
en claro, 7.79:1), con su aserción en `theme.test.ts`. Es color de **texto**, así que se le exige AAA.

## Consecuencias

- Menos superficie: desaparecen `features/theme/`, `services/storage/themePreference.ts` y los hooks
  `use-color-scheme`. El splash ya no espera a nada.
- La lógica del rótulo vive en `features/device/connectionLabel.ts`, con test: si alguien vuelve a
  cablear «Conectado» al estado BLE, el test lo dice antes que el usuario.
- **Si algún día hace falta un tema claro** (por ejemplo, para un usuario con fotofobia invertida),
  la paleta y los tests ya están: lo que hay que volver a construir es la preferencia y quién la
  empuja a NativeWind, que es exactamente lo que este ADR retira.
