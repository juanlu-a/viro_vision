# ADR 0012: El audio del prototipo sale del GPIO sin amplificador

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-12
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber), con el
  tutor, Ing. MSc. Sebastián García Parra
- **Tags:** placa, audio, consumo, carcasa
- **Relates to:** [ADR 0003](0003-enlace-placa-telefono.md) (actualización 2026-10-22: audio PWM),
  [ADR 0007](0007-botones-fisicos-modos-de-operacion.md)

## Contexto

La Raspberry Pi Zero 2 W no tiene salida de audio analógica. Desde el 2026-09-11 el sonido sale por
modulación de ancho de pulso (PWM) redirigida a pines del conector GPIO con el overlay `audremap`,
como solución provisional; el destino previsto era un amplificador I2S (MAX98357A), nunca
instalado.

El 2026-11-10 se determinó que el transductor de conducción ósea que va en la carcasa, extraído de
unos auriculares comerciales, tiene una impedancia de **4 Ω** y no de 16 a 32 Ω como se suponía. Con
la resistencia de 100 Ω que llevaba en serie, al transductor le llegaba un 4 % de la tensión del pin
(4 / 104), lo que explica el volumen casi nulo observado, y el pico de corriente (3,3 V / 104 Ω, unos
32 mA) superaba los 16 mA que admite un pin de propósito general.

El 2026-11-12 la salida se mudó al pin 12 (GPIO 18, `pins_18_19`), del lado de la microSD, donde la
carcasa tiene lugar para los componentes en serie (PR #130). Con el circuito corregido el audio
funciona, pero **se oye muy bajo**. Se evaluaron cinco formas de amplificarlo (ver *Alternativas*).
Ninguna llegaba el mismo día con la carcasa ya impresa, y el equipo lo consultó con el tutor.

## Pruebas realizadas

Las dos pruebas usaron el mismo transductor de 4 Ω y el mismo software (`audremap`, PCM al 100 %,
`speaker-test`, `aplay` y la prueba de audio de la aplicación). La única variable fue el circuito
entre el pin y el transductor.

| Fecha | Circuito | Resultado |
|---|---|---|
| 2026-11-07 | pin 32 (GPIO 12) → 100 Ω → transductor → pin 34 (GND), sin capacitor | Sólo un pitido apenas perceptible. El software quedó descartado como causa (overlay cargado, GPIO 12 en función PWM0, reproducción sin errores en ambos canales). |
| 2026-11-12 | pin 12 (GPIO 18) → 260 Ω → 47 µF → transductor → pin 14 (GND): **circuito RC en serie** | **Funciona**: la voz se oye y se entiende, pero con volumen muy bajo, sólo con el transductor apoyado y en un ambiente silencioso. |

El circuito RC resolvió los dos defectos del primero: el pico de corriente queda dentro del límite
del pin y la continua deja de circular. Lo que **no puede resolver es el volumen**, y la razón es de
fondo, no de ajuste.

### La limitante del volumen: un techo de alrededor de 1 mW

Cualquier circuito pasivo entre un pin GPIO y el transductor está acotado por la corriente que el pin
puede entregar. Con el límite de 16 mA de un pin de propósito general, la potencia máxima que podría
llegar a una carga de 4 Ω, aun con una resistencia en serie nula, es:

P = I² · R = (0,016 A)² · 4 Ω ≈ **1 mW**

Ése es el techo teórico; el circuito RC entrega unos **0,16 mW** porque la corriente alterna de la
rama es de ±6,25 mA, no de 16 mA. Ajustar la resistencia acerca al techo, pero el techo mismo queda
lejos de lo necesario:

| Fuente | Potencia en el transductor (estimada) |
|---|---|
| Circuito RC actual (260 Ω + 47 µF) | ~0,16 mW |
| Techo de cualquier circuito pasivo desde un GPIO (16 mA en 4 Ω) | ~1 mW, unos 8 dB más que el actual |
| Amplificador clase D a 5 V (PAM8403, MAX98357A) | hasta 2,5 a 3,2 W, unos 40 dB más que el actual |

Un transductor de conducción ósea transmite el sonido por vibración del hueso y es menos eficiente
que un parlante en el oído: los auriculares de los que se extrajo lo manejan con un amplificador
integrado, y con ese amplificador se oía con claridad. Con menos de un milivatio, el transductor
queda **inviable para el uso real** del dispositivo: el modo ómnibus se usa en la calle, junto al
ruido del tránsito y de los propios ómnibus, que es precisamente el ambiente donde el anuncio no puede
perderse. Ningún valor de resistencia ni de capacitor cambia esa conclusión: hace falta una etapa
con alimentación propia que entregue potencia, es decir, un amplificador.

Las cifras de potencia son calculadas; el volumen se evaluó de oído, sin medición de nivel sonoro.

## Decisión

**El prototipo queda con el transductor conectado directo al pin, sin amplificador**:

```
pin 12 (GPIO 18) ──[ 260 Ω ]──[+ 47 µF − ]── transductor de 4 Ω ── pin 14 (GND)
```

- La **resistencia de 260 Ω** limita el pico de corriente a 3,3 V / 264 Ω, unos **12,5 mA**, dentro
  del límite del pin.
- El **capacitor electrolítico de 47 µF** (positivo hacia el pin) bloquea la componente continua: el
  PWM en silencio queda en un ciclo de trabajo del 50 %, que equivale a una continua de 1,65 V que, sin
  el capacitor, circularía todo el tiempo por la resistencia y el transductor. Con 264 Ω forma un
  filtro pasa altos con corte en 1 / (2π · 264 Ω · 47 µF) ≈ **13 Hz**, muy por debajo de la voz.
- El volumen bajo se acepta como limitación del prototipo y la amplificación se documenta como
  **trabajo futuro**.

## Consumo de la salida directa

Cálculo, **no medido** (pendiente: un multímetro en serie con el transductor durante una lectura).

**Peor caso:** el PWM conmuta de 0 a 3,3 V con ciclo del 50 %. Con el capacitor cargado a la tensión
media (1,65 V), la corriente alterna por la rama es de ±1,65 V / 264 Ω = **±6,25 mA**, con un valor
eficaz de 6,25 mA.

| Magnitud | Valor |
|---|---|
| Potencia total en la rama (6,25 mA² × 264 Ω) | **~10 mW** |
| Potencia que llega al transductor (6,25 mA² × 4 Ω) | ~0,16 mW |
| Corriente media que entrega el pin (6,25 mA durante la mitad del tiempo) | ~3,1 mA a 3,3 V |
| Vista desde la batería, con pérdidas de conversión de ~20 % (estimadas) | ~13 mW, unos 3,4 mA a 3,7 V |
| Consumo de la placa en modo activo (`hardware/README.md`, fuentes de terceros) | 2 a 3 W |
| **Peso de la salida de audio sobre el total** | **0,4 a 0,6 %** |

Con la batería de 1000 mAh (3,7 Wh) y un consumo de 2,5 W, la autonomía estimada es de unos 89
minutos, el extremo inferior del rango de 1,5 a 2 h que estima la tesis (sec. 7.3.3). Aun si el audio sonara de forma continua, los 13 mW la reducirían en **menos de un minuto**.
Como el audio sólo suena durante los anuncios, el efecto real es todavía menor.

**El dato contraintuitivo:** la salida directa es la opción **que menos consume**, no la que más. Su
costo es el volumen, no la batería. El transductor recibe 0,16 mW de los 10 mW de la rama: el resto se
disipa en la resistencia, que es el precio de no superar el límite del pin.

**Comparación con el circuito anterior** (pin 32, 100 Ω, sin capacitor): la continua circulaba
siempre que el PWM estuviera activo, con 1,65 V / 104 Ω = 15,9 mA de media y unos **52 mW**, el
quíntuple que ahora, con picos de 32 mA que superaban el límite del pin.

**Supuesto a verificar:** que el controlador de audio detiene el PWM cuando no hay nada sonando. Si
lo mantuviera conmutando en silencio, los ~10 mW serían permanentes mientras el dispositivo está
encendido. Sigue siendo menos del 1 % del total.

## Alternativas evaluadas (trabajo futuro)

Potencias, consumos en reposo y tamaños de las hojas de datos y de vendedores, **sin medir**. El
espacio libre en la carcasa v0.29, calculado desde el modelo, es de unos **26 × 24 mm y 7 mm de
alto** entre el bolsillo del botón y los postes del lado de la microSD (9,1 mm sobre la placa,
menos los componentes bajos). Precios relevados en Uruguay el 2026-11-12.

| Opción | Entrada | Potencia máx. en 4 Ω | Reposo | Tamaño | Soldaduras | Disponibilidad |
|---|---|---|---|---|---|---|
| **Directo (decisión)** | PWM, pin 12 | ~0,16 mW | 0 (con el PWM detenido) | 2 componentes | 4 | hecho |
| Seguidor complementario (NPN + PNP, p. ej. BC337/BC327) | PWM, pin 12 | ~5 a 18 mW (resistencia de 22 a 10 Ω) | 0 | 4 componentes | ~8 | componentes de uso general |
| LM386 (módulo) | analógica (PWM) | unos cientos de mW, clase AB | ~4 mA más el LED del módulo | grande con potenciómetro y bornera | 5 | electronica.uy, $140 |
| PAM8403 (módulo mini, sin potenciómetro) | analógica (PWM) | ~3 W, clase D | ~10 mA | ~21 × 18 × 3,4 mm | 5 | MercadoLibre, $140 a $250 |
| PAM8302 | analógica (PWM) | ~2,5 W, clase D | ~4 mA | ~15 × 20 mm | 5 | sin oferta local encontrada |
| **MAX98357A** | digital (I2S) | ~3,2 W, clase D | ~2,4 mA; < 1 µA apagado | ~18 × 19 mm | 7 | MercadoLibre, ~$1.600, importado |
| Placa original de los auriculares (chip JieLi) | Bluetooth o USB | suficiente | alto (radio y cargador integrados) | ~ la de la Pi | ≥ 4 | ya disponible |

Notas por opción:

- **Seguidor complementario.** Dos transistores repiten la señal PWM con más corriente, alimentados
  desde 5 V; no consumen en reposo porque nunca conducen a la vez. Mejora el volumen unos 15 a 20 dB,
  lejos de un amplificador integrado.
- **Amplificadores analógicos (LM386, PAM8403, PAM8302).** No requieren cambios de software: toman la
  señal del mismo pin 12. Amplifican también el ruido de cuantización del PWM. El LM386 es clase AB:
  consume más para el mismo volumen y su ganancia de 200 vuelve audible el soplido. El PAM8403 es
  estéreo; se usaría un canal, con el transductor entre L+ y L−, ninguno a masa. Sólo la versión mini,
  sin potenciómetro, entra en la carcasa.
- **MAX98357A.** Es el destino técnico: recibe audio digital por I2S, de modo que elimina el ruido
  del PWM, y su pin de apagado permite que el daemon lo encienda sólo para hablar. Usa los pines 12,
  35 y 40 (GPIO 18, 19 y 21), más 5 V y masa; se configura con `dtoverlay=max98357a` en lugar del
  `audremap`. La salida es diferencial: ningún borne del transductor va a masa.
- **Placa original de los auriculares.** Toda la amplificación está dentro del chip principal, que
  integra Bluetooth, cargador y lector de microSD: no se puede aislar el amplificador. Conectada por
  USB a la computadora no se enumeró como dispositivo (su conector USB-C es sólo de carga; los datos
  están en pads de prueba) y por Bluetooth contradice la decisión de no usar A2DP (sec. 7.2.8 de la
  tesis, ADR 0003). Descartada.

En consumo, todos los amplificadores cuestan **más** que la salida directa, y lo que consumen al
hablar crece con el volumen (del orden de 0,1 a 0,5 W, estimado). Con uno clase D y su pin de
apagado manejado por el daemon, el costo en reposo es despreciable.

## Consecuencias

- **El volumen del dispositivo es bajo**, audible en un ambiente silencioso y probablemente
  insuficiente en la calle. Las pruebas con usuarios del modo ómnibus deben considerarlo, o hacerse
  con la salida por el teléfono, que la app ya permite elegir.
- **El consumo de la salida de audio es despreciable** frente al de la placa (menos del 1 %).
- **El pin 35 (GPIO 19) queda como salida** por el overlay, aunque no se use: nada puede conectarse
  ahí.
- **Camino a futuro:** instalar el MAX98357A en los mismos pines, sacar la resistencia y el
  capacitor, y cambiar una línea de `config.txt`. Si hay que reimprimir la carcasa, reservar el
  espacio de ~18 × 19 × 3 mm junto al conector GPIO.

## Fuentes

- [MAX98357A, hoja de datos (Analog Devices)](https://www.mouser.com/datasheet/2/256/MAX98357A-MAX98357B-271244.pdf)
- [PAM8403, dimensiones del módulo mini (Envistia Mall)](https://envistiamall.com/blogs/learn/pam8403-2-channel-stereo-class-d-audio-power-amplifier-user-guide)
- [Módulo LM386 (electronica.uy)](https://www.electronica.uy/producto/robotica/modulos-audio/modulo-amplificador-audio-lm386/)
- [PAM8403 en MercadoLibre Uruguay](https://listado.mercadolibre.com.uy/pam-8403)
- Consumo de la placa: `hardware/README.md`, sección de alimentación (fuentes de terceros, pendiente
  de medir).

## Actualización 2026-11-18: PAM8403 instalado

**El prototipo ya no queda sin amplificador.** Con el volumen de la salida directa inviable para el
uso real (ver *La limitante del volumen*), el equipo consiguió dos módulos **PAM8403 mini** (uno de
repuesto) y el 2026-11-18 instaló uno entre la placa y el transductor:

| PAM8403 | Raspberry Pi |
|---|---|
| 5V | pin 2 (5 V) |
| GND de alimentación | pin 6 |
| entrada (un canal) | pin 12 (GPIO 18) |
| GND de entrada | pin 14 |
| salida + y − del mismo canal | los dos cables del transductor, ninguno a masa |

La **resistencia de 260 Ω y el capacitor de 47 µF se retiraron**: el módulo trae sus propios
capacitores de entrada. El otro canal queda sin conectar. El software no cambia: la señal sigue
saliendo por PWM del pin 12.

**Resultado:** el problema se invirtió. Al nivel con que arrancaba el daemon (90 %, elegido para la
salida directa) el transductor sonaba **demasiado fuerte**. Como el dispositivo no tiene botones de
volumen, se agregaron:

- un parche para bajarlo desde la microSD sin SSH (archivo `VOLUMEN` en `bootfs`, `boot/modo-red.sh`);
- el **control de volumen en Ajustes de la app**, con el nivel guardado en la placa (comando
  `volume`, campo `vol` de `status`; ADR 0003, actualización del 2026-11-18);
- un nivel por defecto de **50 %** en lugar de 90 % para una placa a la que nadie le eligió uno.

**Consumo:** el PAM8403 suma unos 10 mA en reposo (~50 mW, alrededor del 2 % de la placa en modo
activo), porque la versión mini no expone el pin de apagado, más lo que entrega al hablar, que crece
con el volumen. Sigue sin medir. El ruido de cuantización del PWM se amplifica junto con la voz; el
MAX98357A sigue siendo el destino para eliminarlo.


## Actualización 2026-11-19: saturación, soplido y el filtro de entrada

Con el PAM8403 instalado aparecieron dos problemas que el volumen del software no resolvía. Esta
sección registra cómo se diagnosticaron y en qué orden se resolvieron, porque cada intento descartó
una hipótesis.

### Problema 1: todo el audio salía saturado

**Causa.** El pin 12 no entrega audio analógico: entrega una onda cuadrada de 0 a 3,3 V que conmuta
a alta frecuencia, y el audio va codificado en el ancho de los pulsos. Bajar el volumen cambia el
ancho, no la amplitud: cada pulso sigue siendo de 3,3 V. El PAM8403, con una ganancia fija de 24 dB,
espera una señal de nivel de línea, unas diez veces menor, y recibía esa onda completa. Por eso
saturaba a cualquier volumen. Usar otro pin no cambia nada: la Zero 2 W no tiene ninguna salida
analógica, y cualquier pin entregaría la misma onda.

**Solución.** Un filtro RC a la entrada del amplificador, que cumple dos funciones: atenúa la señal
hasta el nivel que el amplificador espera y elimina la conmutación de alta frecuencia, dejando pasar
la voz. Es el mismo principio del filtro que las Raspberry Pi con conector de auriculares traen en su
placa.

### Problema 2: un soplido fuerte e indefinido al terminar cada audio

**Causa.** El PWM sigue conmutando después de que termina la reproducción. Con el transductor
conectado directo al pin no se oía; amplificado, era un soplido fuerte que no se detenía.

**Solución, en el software** (PR #137). El daemon desconecta el pin cuando la salida lleva 1 s sin
reproducir nada (GPIO 18 como salida en nivel bajo, `pinctrl set 18 op dl`) y lo devuelve al PWM
(`pinctrl set 18 a5`) justo antes del próximo audio; también lo desconecta al arrancar. La espera de
1 s evita un chasquido entre los clips de un mismo anuncio de ómnibus (`audio.PwmGate`). Como efecto
adicional, el pin deja de consumir mientras no suena nada.

### Los intentos, en orden

| # | Circuito entre el pin 12 y la entrada del PAM8403 | Resultado |
|---|---|---|
| 1 | directo | voz saturada y soplido fuerte al terminar cada audio |
| 2 | directo, con el pin desconectado entre audios (PR #137) | desaparece el soplido posterior; sigue la saturación |
| 3 | 10 kΩ en serie | la saturación baja, pero no alcanza |
| 4 | 20 kΩ en serie | sin saturación, pero la voz se oye lejana y con un soplido fuerte durante todo el audio: la resistencia atenúa por igual la voz y el ruido |
| 5 | 20 kΩ y 47 µF entre la entrada y masa | descartado por cálculo: es unas 20.000 veces la capacidad necesaria y cortaría también la voz |
| 6 | 20 kΩ y 1 nF entre la entrada y masa | mejora notable; queda soplido audible |
| 7 | **filtro de dos etapas** (abajo) | **funciona muy bien**: voz clara y soplido muy reducido |

Junto con el filtro, el **volumen del dispositivo se lleva al máximo** desde la aplicación. Con el
filtro a la entrada, el volumen del software no cambia cuánto ruido entra al amplificador sino cuánta
voz va mezclada en la señal: al 50 % la voz es la mitad y el ruido el mismo. La intensidad final la
fijan las resistencias del filtro.

### El circuito final

```
pin 12 ──[ 10 kΩ ]──●──[ 10 kΩ ]──●── entrada L del PAM8403
                    │             │
                [4,7 nF]     [1 nF] [1 nF]
                    │             │
pin 14 ─────────────●─────────────●── GND de entrada del PAM8403

pin 2 ── 5V del PAM8403        pin 6 ── GND de alimentación del PAM8403
salida L+ y L− ── transductor de 4 Ω (ninguno de los dos a masa)
```

- **Primera etapa:** 10 kΩ y 4,7 nF (código 472), corte en ~3,4 kHz.
- **Segunda etapa:** 10 kΩ y dos capacitores de 1 nF (código 102) en paralelo, 2 nF, corte en ~8 kHz.
- **Respuesta del conjunto** (calculada sin la impedancia de entrada del amplificador): −3 dB en
  ~2,1 kHz, −7 dB en 4 kHz, −25 dB en 20 kHz y −50 dB en 100 kHz. La voz conserva su
  inteligibilidad, como en una llamada telefónica, y la conmutación del PWM, a cientos de kHz, queda
  atenuada en más de 50 dB.
- **Montaje sin placa:** la primera resistencia va en el cable, cubierta con termocontraíble; los
  capacitores y la segunda resistencia, soldados sobre los pads del módulo. El conjunto entró en la
  carcasa v0.29, con muy poco margen.
- **Componentes:** resistencias de 10 kΩ y capacitores cerámicos de un kit de uso general; sin polaridad.

### Lo que queda

- **Ruido residual.** Parte del ruido del PWM es ruido de cuantización que cae dentro de la banda de
  la voz, y ningún filtro lo elimina sin eliminar también la voz. Es audible en silencio, aunque ya
  no molesta. Sólo desaparece con una salida digital: el MAX98357A, o un conversor PCM5102A por I2S
  delante del mismo PAM8403.
- **Consumo:** el PAM8403 suma unos 10 mA en reposo (sin pin de apagado en la versión mini) más lo
  que entrega al hablar. Sin medir.
- **Despliegue sin red.** El control de volumen y la desconexión del pin llegaron a la placa por la
  microSD (`virovision-update.tgz`, PR #136), porque la placa estaba sin SSH.
