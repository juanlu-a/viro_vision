# QA de los avisos de sistema

Cómo probar, de punta a punta, que **cada cosa que ViroVision dice sale por donde corresponde**.

Está escrito después de dos días en que este camino falló tres veces seguidas y las tres en
silencio: la app entregada sin la placa, un lazo de realimentación que no decía nada, y una escritura
BLE que impedía unirse al WiFi y se reportaba como «no se pudo conectar a la red». Por eso cada
bloque dice **qué prueba** y **a dónde mirar si falla** — el síntoma de este subsistema casi nunca
está donde está la causa.

> **Corrido por primera vez el 2026-09-17 y el camino crítico pasó**: con la salida en «En el
> dispositivo», el teléfono **se une al WiFi de la placa** —que era el bug— y los modos, el chirp y
> las lecturas salen por el parlante mientras la conexión y la red las dice el teléfono. Lo que queda
> sin correr entero es el bloque 4, el de que las fallas hagan ruido.

> **La voz es la interfaz.** Si un paso no suena, no está «casi bien»: está roto. Silencio y
> dispositivo muerto son indistinguibles para quien no ve la pantalla (ADR 0001).

## El reparto que se está probando (ADR 0003, act. 2026-09-17)

| lo dice **siempre** el teléfono | lo dice la placa **si el ajuste está en dispositivo** |
|---|---|
| conectado · se perdió la conexión | los modos: espera · ómnibus · supermercado |
| red lista · la red falló | el chirp al pedir una lectura |
| los avisos de la propia placa | las lecturas de cada modo |
| no pude avisarle el modo | la confirmación del ajuste · «probar audio» |

La regla, para no tener que memorizar la tabla: **el enlace y la red son del teléfono** (cuando se
anuncian, el dispositivo recién existe y el usuario está emparejando con el teléfono en la mano); la
placa dice lo que se escucha **con los anteojos puestos y el teléfono guardado**.

---

## Bloque 0 — dejar las dos mitades alineadas

**No saltear.** La causa raíz de los tres fallos fue siempre la misma: la app y la placa en versiones
distintas. TestFlight publica **sólo la app**; la placa no se actualiza sola.

```sh
# 1. Bajar el AP para recuperar SSH. La app del teléfono TIENE que estar cerrada.
cd hardware/raspi
./.venv-mac/bin/python tools/ap.py
ping -c2 virovision.local            # vuelve a la WiFi conocida

# 2. El daemon, al día con el repo
tar czf /tmp/vv.tgz --exclude=__pycache__ virovision tools
scp /tmp/vv.tgz virovision@virovision.local:/tmp/
ssh virovision@virovision.local 'sudo systemctl stop virovision &&
  tar xzf /tmp/vv.tgz -C /home/virovision/virovision/ &&
  sudo systemctl start virovision'

# 3. Los clips: exactamente los que el catálogo pide, ni uno más
python3 tools/make_system_announcements.py
scp -r announcements/system virovision@virovision.local:/tmp/sysclips
ssh virovision@virovision.local 'sudo rm -f /home/virovision/announcements/system/*.wav &&
  sudo install -m 644 -o virovision -g virovision /tmp/sysclips/*.wav /home/virovision/announcements/system/'

# 4. Volver a modo producto (no existe SIN-AP, así que alcanza con reiniciar)
ssh virovision@virovision.local 'sudo reboot'
```

- [ ] `./.venv-mac/bin/python tools/say.py --list` y la carpeta de la placa tienen **los mismos
      nombres**. Si sobra alguno de un lado, eso solo ya es el bug.
- [ ] En el teléfono, el build de TestFlight es el último (la fecha, no «el que tenía»).

---

## Bloque 1 — la placa sola, sin teléfono

Prueba la mitad de abajo antes de sumarle capas. Con la app **cerrada**:

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/ap.py --status     # ap True, ip 10.42.0.1:8080, credenciales
./.venv-mac/bin/python tools/say.py --all       # los avisos, uno por uno
```

- [ ] `--status` dice `ap True` y publica `ssid/password/ip/port`.
- [ ] **Se escuchan todos** por el parlante. *Sale con la voz de Mónica, la misma de los anuncios de
      ómnibus: si alguno suena con otra voz o cortado, es el clip y no el camino.*
- [ ] `say.py` no reporta ningún error de la placa.

> **Si no suena nada pero `say.py` no da error**, mirá el journal:
> `ssh virovision@virovision.local 'journalctl -u virovision -n 30 | grep -E "control ←|playing|missing"'`.
> `control ←` sin `playing` = el clip no está. `playing` sin sonido = parlante o volumen.

---

## Bloque 2 — con el teléfono, salida en **«En el teléfono»**

Es la línea de base: así funcionaba antes de todo esto, y tiene que seguir igual.

- [ ] Conectar → **«Dispositivo conectado»** por el teléfono.
- [ ] Se une al WiFi → **«Red con el dispositivo lista»** por el teléfono.
- [ ] Cambiar de modo (app y botón) → anuncio por el teléfono.
- [ ] Doble click → chirp por el teléfono, y la lectura del modo por el teléfono.

---

## Bloque 3 — salida en **«En el dispositivo»**: lo que se arregló

Ajustes → *Dónde se escucha* → **En el dispositivo**.

- [ ] La **confirmación del ajuste sale por la placa**. Es la verificación en el acto: si sale por el
      teléfono, la placa no está lista y el resto del bloque va a fallar.
- [ ] **«Probar audio»** sale por la placa.
- [ ] Desconectar y reconectar: **«Dispositivo conectado» y «Red con el dispositivo lista» salen por
      el TELÉFONO**, aunque el ajuste diga dispositivo. Es el reparto nuevo, no una falla.
- [ ] **El teléfono se une al WiFi de la placa.** *Éste es el bug del 2026-09-17: con la salida en
      dispositivo, la escritura BLE del aviso competía con la lectura de la característica `wifi` y
      el teléfono se quedaba sin credenciales.*
- [ ] Cambiar de modo desde la app → anuncio **por la placa**.
- [ ] Cambiar de modo con el **botón físico** → anuncio por la placa.
- [ ] Doble click → chirp **por la placa**, y la lectura del modo por la placa.
- [ ] Modo ómnibus frente a un cartel → la línea, por la placa, como ya venía.

> **Si el WiFi no se une con la salida en dispositivo y sí con la salida en teléfono**, volvió el bug
> de la carrera: mirá `services/ble/serialize.ts` y si alguna operación de característica nueva quedó
> fuera de la cola.

---

## Bloque 4 — que las fallas se escuchen

Lo más importante y lo que siempre se saltea: que **fallar haga ruido**.

- [ ] Apagar la placa con la app conectada → **«Se perdió la conexión…»** por el teléfono.
- [ ] Sacar un clip de la placa a mano y pedirlo → la placa contesta `missing notice: <archivo>` y el
      aviso lo dice el **teléfono**. *Esto es lo que convierte «no se escucha nada» en un diagnóstico.*
      ```sh
      ssh virovision@virovision.local 'sudo mv /home/virovision/announcements/system/mode_idle.wav /tmp/'
      # …probar, y después devolverlo
      ```
- [ ] Con VoiceOver encendido, ningún aviso pisa al lector de pantalla (`mixWithOthers`).

---

## Lo que NO es un bug

- **Cambiar de modo con el botón sin el teléfono conectado no se anuncia.** El aviso viaja
  placa → app → placa. Está anotado como deuda; moverlo a la placa exige que la app se calle para las
  transiciones cuyo origen es el botón, o se dice dos veces.
- **Con la salida en dispositivo, la conexión y la red igual salen por el teléfono.** Es el diseño.
- **Si el build no puede sintetizar**, elegir «dispositivo» se confirma por el teléfono: la frase que
  hay que decir es justamente que la lectura de supermercado no va a poder llegar a la placa.

## Ver también

- [ADR 0003](architecture/adr/0003-enlace-placa-telefono.md), actualizaciones del 15, 16 y 17 de septiembre.
- [`placa-acceso.md`](../.claude/skills/virovision/references/placa-acceso.md) — cómo entrar a la placa y las trampas ya pisadas.
- [`qa-modo-supermercado.md`](qa-modo-supermercado.md) — el otro camino de punta a punta.
