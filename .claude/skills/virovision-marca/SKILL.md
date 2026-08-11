---
name: virovision-marca
description: Manual de marca de ViroVision — símbolo, geometría, paleta, tipografía y reglas de uso, más cómo re-importar el proyecto desde Claude Design. Usalo al tocar cualquier cosa visual de la app (colores, tokens de tema, íconos, splash, tipografía), al generar assets de marca, o al preparar material visual de la tesis (portada, láminas, presentación).
---

# ViroVision — marca

Manual completo y fuentes: [`docs/brand/`](../../../docs/brand/). El PDF
(`virovision-manual-de-marca.pdf`) es la versión presentable; `virovision-marca.md` tiene las
reglas en texto plano.

## El símbolo

Dos arcos que se encuentran en un vértice inferior: **ojo abstracto y V geométrica a la vez**. El
punto central es la pupila y, a la vez, el objeto detectado. **No hay logotipo** — la marca es sólo
el símbolo.

Geometría sobre lienzo 200×200: arcos de radio 96 desde `(100,168)` hasta `(32,44)` y `(168,44)`;
trazo 18, extremos redondeados; pupila `r=17` en `(100,92)`.

## Paleta del manual

| Nombre | Hex | Rol |
|---|---|---|
| Azul Sensor | `#1256D4` | arco izquierdo, acción primaria |
| Verde Lectura | `#1FB57A` | arco derecho, estado confirmado |
| Azul Profundo | `#061D3A` | pupila, texto, fondos oscuros |
| Gris Niebla | `#F4F6F8` | fondo base |

Variantes sobre oscuro: `#4D9BFF` / `#2BD69A` / pupila blanca. Proporción: 70 % neutros, 20 % azul,
10 % verde.

## ⚠️ Regla crítica: estos hex NO son los tokens de la app

**No copies los hex del manual a `app/src/constants/theme.ts`.** Medidos contra WCAG:

| Combinación | Contraste | |
|---|---|---|
| Azul Sensor sobre Azul Profundo | **2.66:1** | falla |
| Verde Lectura sobre Gris Niebla | **2.44:1** | falla |
| blanco sobre Verde Lectura (botón) | **2.64:1** | falla |

No es un error del manual: un logo no es texto y WCAG no le exige contraste a un símbolo. Pero
ViroVision es una app para personas con baja visión, así que los tokens **conservan el tono de la
marca y ajustan la luminosidad hasta AAA (7:1)**. `app/src/constants/theme.ts` documenta cada
derivación y `theme.test.ts` la verifica automáticamente — si un token se "corrige" para coincidir
con el manual, el test falla.

**Antes de tocar cualquier color, corré `npm test -- theme`.**

### Desviación deliberada: el acento es VERDE, no el Azul Sensor

El manual asigna al **Azul Sensor** el rol de *acción primaria*. La app no lo sigue, y la decisión
se tomó mirando el resultado en pantalla: sobre un fondo Azul Profundo, un acento azul se confunde
con el fondo y la identidad se pierde — el verde es el color distintivo y casi no aparecía.

Acento: `#2BD69A` en oscuro (8.99:1 AAA, la variante del manual) y `#105E3F` en claro (7.19:1 AAA,
Verde Lectura oscurecido; el crudo `#1FB57A` da 2.44:1 y es ilegible). El azul sigue presente donde
el manual lo pone de verdad: el arco izquierdo del símbolo.

Ojo con el texto encima del relleno: **blanco sobre el verde da 1.88:1 y falla**, así que en oscuro
`onPrimary` es el azul profundo (8.99:1). En claro sí va blanco (7.79:1).

### La única desviación que queda: el verde en fondo claro

El manual define Verde Lectura `#1FB57A` y su variante para fondo oscuro `#2BD69A`, pero **no una
para fondo claro**. El crudo da **2.44:1** sobre `#F4F6F8` — ilegible. La app usa `#105E3F`
(7.19:1) como color de éxito en el tema claro. **Si el manual agrega esa variante, reemplazarla.**

## Tipografía

- Títulos: **Space Grotesk Bold**, tracking −2 %
- Texto: **IBM Plex Sans** Regular/SemiBold, **mínimo 17 px**
- Datos: **IBM Plex Mono**

*(La app todavía no carga estas fuentes; usa las del sistema. Es parte de A1 / ADR 0005.)*

## Reglas de uso

- Área de resguardo: **34 u** (un diámetro de pupila) en los cuatro lados.
- Tamaño mínimo: **24 px** en pantalla, **10 mm** impreso.
- Ícono de app: símbolo al **64 %** del lienzo, fondo `#061D3A`, radio 22 % del lado. Bajo 76 px el
  trazo pasa a 20–24 u.
- **No** recolorear fuera de la paleta, **no** deformar, **sin** sombras ni efectos, **no** usar
  sobre fondos de bajo contraste.

### Excepciones deliberadas en los assets de la app

Dos, ambas por cómo renderiza cada sistema operativo (ver `docs/brand/README.md`):

- **iOS va sin redondear.** El manual pide radio 22 %, pero iOS aplica su propia máscara: dejar las
  esquinas transparentes las mostraría en negro.
- **El frente del ícono adaptativo de Android va al 50 %, no al 64 %.** El launcher recorta hasta
  ~66 % del lienzo y a 64 % los arcos quedarían contra el borde del recorte.

## Regenerar los assets

Los PNG de `app/assets/images/` se generan desde los SVG de `docs/brand/`, no al revés.

⚠️ **`qlmanage` compone la transparencia sobre blanco.** Un símbolo sobre fondo transparente sale
con un rectángulo blanco, y la pupila —que es blanca en modo oscuro— desaparece dentro de él. Para
los assets que necesitan alfa (`splash-icon`, `android-icon-foreground`, `android-icon-monochrome`)
usá el rasterizador del repo, que deriva el alfa de una máscara y conserva el antialiasing:

```sh
cd docs/brand
python3 rasterize.py splash-icon.svg 512 ../../app/assets/images/splash-icon.png
```

Para los que llevan fondo sólido (`icon`, `android-icon-background`, `favicon`) alcanza `qlmanage`:

```sh
qlmanage -t -s 1024 -o . icon.svg && mv icon.svg.png icon.png
```

## Re-importar desde Claude Design

El manual vive también como proyecto de Claude Design. Para volver a abrirlo o modificarlo, usá el
MCP `claude_design` (`https://api.anthropic.com/v1/design/mcp`, autenticación con `/design-login`):

```
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login)
to import this project:
https://claude.ai/design/p/dc9717d5-faa9-4cc0-b73d-4a99092563c5?file=ViroVision+Marca.dc.html

Focus on these files (the whole project is readable):
- `ViroVision Marca.dc.html`

Also read these files the selection imports:
- `support.js`

Implement: `ViroVision Marca.dc.html`
```

Copia local del documento: `docs/brand/virovision-marca.dc.html`. Si cambia la marca, actualizá
**primero** los SVG fuente de `docs/brand/`, después regenerá los PNG, y recién ahí revisá si los
tokens de `theme.ts` siguen pasando `theme.test.ts`.
