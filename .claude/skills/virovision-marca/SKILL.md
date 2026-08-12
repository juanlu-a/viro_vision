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
| Verde Lectura | `#1FB57A` | **primario**: botones, foco, estado confirmado. Arco derecho |
| Azul Sensor | `#1256D4` | **secundario**: superficies, enlaces, datos. Arco izquierdo |
| Azul Profundo | `#061D3A` | pupila, texto, fondos oscuros |
| Gris Niebla | `#F4F6F8` | fondo base |

Variantes sobre oscuro: `#4D9BFF` / `#2BD69A` / pupila blanca. Proporción: 70 % neutros, 20 %
Verde Lectura, 10 % Azul Sensor.

Modos, tal cual el manual:

| | claro | oscuro |
|---|---|---|
| fondo | `#F4F6F8` | `#061D3A` |
| superficie | `#FFFFFF` | `#0E2B4F` |
| texto / secundario | `#061D3A` / `#33475E` | `#E8EFF7` / `#9FB8D4` |
| acento / 2.º | `#1FB57A` / `#1256D4` | `#2BD69A` / `#4D9BFF` |

**El piso de contraste del acento es 4.5:1, y lo fija el manual**, no la app: "el verde es el
acento de acción en los dos modos y se aclara a `#2BD69A` en oscuro para mantener 4.5:1".

## ⚠️ Regla crítica: relleno y texto NO pueden ser el mismo verde

`app/src/constants/theme.ts` sigue el manual al pie de la letra salvo donde se aclara. Lo que sí
hay que entender antes de tocar un color es la **separación de roles**:

| token | rol | claro | oscuro |
|---|---|---|---|
| `primary` | **relleno** (botón, chip de ícono) | `#1FB57A` | `#2BD69A` |
| `onPrimary` | texto/glifo *encima* del relleno | `#061D3A` | `#061D3A` |
| `primaryEdge` | borde del relleno | `#105E3F` | `#2BD69A` |
| `success` | **texto** verde (rótulos de estado) | `#105E3F` | `#2BD69A` |

En oscuro `primary` y `success` coinciden. En claro **no pueden**: medido contra WCAG,

| Combinación | Contraste | |
|---|---|---|
| Verde Lectura como texto sobre Gris Niebla | **2.44:1** | falla |
| blanco sobre Verde Lectura (botón) | **2.64:1** | falla |
| Azul Profundo sobre Verde Lectura (el botón del manual) | **6.39:1** | pasa |
| Azul Sensor sobre Azul Profundo | **2.66:1** | falla |

No es un error del manual: un logo no es texto y WCAG no le exige contraste a un símbolo. Pero
ViroVision es para personas con baja visión, así que el verde de marca va donde el manual lo pone
—rellenos— y los rótulos verdes usan el mismo tono llevado hasta AAA.

Un detalle que se pasa por alto: el relleno verde sobre el fondo claro da 2.44:1, por debajo del
**3:1 que WCAG 1.4.11 le pide al *límite* de un control**. Se resuelve contorneando el botón
(`primaryEdge`, 7.19:1), no aclarando el fondo ni oscureciendo la marca.

**Antes de tocar cualquier color, corré `npm test -- theme`.** El test verifica cada regla de
arriba, incluidas las que dicen "esto falla": si un día pasaran, hay que revisar la decisión.

### Desviación deliberada: superficies azuladas en modo claro

El manual pide superficie `#FFFFFF`. La app usa `#E4EDFB` (12 % de Azul Sensor sobre blanco) para
las tarjetas, y reserva el blanco para lo que va *encima* de una tarjeta. Motivo: con superficies
blancas sobre Gris Niebla, el azul de la marca no aparecía en ningún lado del modo claro, y el
manual le asigna justamente el rol de superficie. Es la única desviación de color vigente.

## Tipografía

- Títulos: **Space Grotesk Bold**, 32–72 px, tracking −2 %
- Texto: **IBM Plex Sans** Regular/SemiBold, **mínimo 17 px**
- Datos: **IBM Plex Mono** (números de línea, porcentajes, distancias)

Las tres están embebidas en el binario vía el plugin `expo-font` de `app.json`, no cargadas en
runtime: un cambio de fuente a mitad del arranque es un salto de layout. Se referencian por
`Fonts.display` / `Fonts.sans` / `Fonts.sansBold` / `Fonts.mono` en `constants/theme.ts`.

⚠️ **Nunca combines estas familias con `fontWeight`.** Cada peso es un archivo propio; pedir además
un peso dispara negrita sintética en Android. Para cambiar de peso se cambia de familia.

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

El símbolo de la app son **dos archivos**, no uno recoloreado (`symbol-light.png` /
`symbol-dark.png`, generados desde `symbol-light.svg` / `symbol-dark.svg`): el manual define la
pupila Azul Profundo sobre claro y blanca sobre oscuro, y una sola imagen no cumple las dos cosas.
`ScreenHeader` elige según el esquema activo.

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
