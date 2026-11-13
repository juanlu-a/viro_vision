# 10. Trabajo futuro

*[El resto del capítulo, pendiente de redacción.]*

## 10.1 Amplificación del audio del dispositivo

El prototipo entrega el audio sin amplificador: el transductor de conducción ósea de 4 Ω se conecta
al pin 12 de la placa a través de una resistencia de 260 Ω y un capacitor de 47 µF (sec. 7.3.1). La
decisión se tomó con el tutor el 12 de noviembre de 2026, con la carcasa ya impresa y sin un
amplificador disponible ese día (ADR 0012). Su costo es el **volumen**, audible en un ambiente
silencioso y probablemente insuficiente en la calle. **No es la batería**: contra lo que podría
suponerse, la salida directa es la alternativa que menos consume. Según el cálculo del ADR 0012, aún no
medido, la rama disipa unos 10 mW mientras suena, entre el 0,4 y el 0,6 % del consumo de la placa en
modo activo, y de esa potencia sólo 0,16 mW llegan al transductor; el resto se disipa en la
resistencia que protege el pin.

**La prueba del circuito RC y su límite.** Se probaron dos circuitos con el mismo transductor y el
mismo software. El primero, una resistencia de 100 Ω sin capacitor, produjo apenas un pitido
perceptible, con un pico de corriente que además superaba el límite del pin. El segundo, el circuito
RC en serie que quedó en el prototipo (260 Ω y 47 µF), funciona: la voz se oye y se entiende, pero sólo
con el transductor apoyado y en un ambiente silencioso. El límite no es de ajuste sino de fondo.
Cualquier circuito pasivo alimentado por un pin GPIO está acotado por la corriente del pin: con 16 mA
sobre 4 Ω, la potencia máxima que puede llegar al transductor es de (0,016 A)² · 4 Ω ≈ 1 mW, aun sin
resistencia en serie. El circuito actual entrega unos 0,16 mW, de modo que optimizar sus componentes
ganaría como mucho unos 8 dB, mientras que un amplificador clase D alimentado a 5 V entrega hasta 3 W,
unos 40 dB más. Un transductor de conducción ósea, menos eficiente que un parlante en el oído, no
alcanza con menos de un milivatio a hacerse oír sobre el ruido del tránsito, que es el ambiente de uso
del modo ómnibus. Por eso la salida directa es **inviable para el uso real** y sólo se justifica en
el prototipo; la conclusión no depende del valor de los componentes (ADR 0012). Las potencias son
calculadas y el volumen se evaluó de oído, sin medición de nivel sonoro.

Se evaluaron las siguientes alternativas. Las cifras provienen de hojas de datos y de vendedores, y
están pendientes de medición propia:

| Alternativa | Entrada | Potencia máxima en 4 Ω | Consumo en reposo | Tamaño | Observaciones |
|---|---|---|---|---|---|
| Salida directa (actual) | PWM | ~0,16 mW | nulo con el PWM detenido | dos componentes | menor consumo, volumen bajo |
| Seguidor complementario de dos transistores | PWM | 5 a 18 mW | nulo | cuatro componentes | 15 a 20 dB más que la salida directa |
| LM386 | analógica | unos cientos de mW (clase AB) | ~4 mA más el indicador luminoso | grande | menos eficiente; su ganancia de 200 amplifica el ruido del PWM |
| PAM8403, módulo mini | analógica | ~3 W (clase D) | ~10 mA | 21 × 18 × 3,4 mm | disponible en Uruguay; amplifica el ruido del PWM |
| PAM8302 | analógica | ~2,5 W (clase D) | ~4 mA | 15 × 20 mm | sin oferta local encontrada |
| MAX98357A | digital (I2S) | ~3,2 W (clase D) | ~2,4 mA; menos de 1 µA apagado | 18 × 19 mm | elimina el ruido del PWM; importado |
| Circuito original de los auriculares | Bluetooth o USB | suficiente | alto | similar al de la placa | descartado: el amplificador está integrado en un chip que incluye radio, cargador y lector de tarjetas |

La alternativa recomendada es el **MAX98357A**. Recibe el audio en formato digital por I2S, de modo
que elimina el ruido de cuantización del PWM que los amplificadores analógicos reproducen, y su
entrada de apagado permite que el dispositivo lo active sólo al hablar, con un consumo en reposo
despreciable. Usa los mismos pines que la salida actual (GPIO 18, 19 y 21), más la alimentación de
5 V; su integración consiste en reemplazar la resistencia y el capacitor por el módulo y cambiar una
línea de la configuración de arranque. El modelo de la carcasa v0.29 deja libre, junto al conector
GPIO, un espacio de unos 26 × 24 mm y 7 mm de alto, suficiente para el módulo. Si la carcasa debiera
reimprimirse, convendría reservar ese espacio de forma explícita.

En todas las alternativas el consumo mientras el dispositivo habla crece con el volumen, del orden
de 0,1 a 0,5 W según la estimación del ADR 0012. Queda pendiente medirlo junto con el consumo general
de la placa (sec. 7.3.3).
