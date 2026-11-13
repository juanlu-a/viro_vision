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
minutos. Aun si el audio sonara de forma continua, los 13 mW la reducirían en **menos de un minuto**.
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
