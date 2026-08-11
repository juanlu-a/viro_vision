# Marca ViroVision

Manual de marca y fuentes del símbolo. **Éstas son las fuentes**: los PNG de
`app/assets/images/` se generan a partir de los SVG de acá, no al revés.

- [`virovision-manual-de-marca.pdf`](virovision-manual-de-marca.pdf) — **el manual completo**, en
  la versión presentable (sirve para la tesis y para mostrarle al tutor).
- [`virovision-marca.md`](virovision-marca.md) — las mismas reglas en texto plano: símbolo,
  geometría, paleta, tipografía y usos incorrectos.
- `virovision-marca.dc.html` · `virovision-marca-export.zip` — el documento fuente de Claude Design
  y su exportación completa. Para re-importarlo o modificarlo, ver la skill `virovision-marca`
  (`.claude/skills/virovision-marca/SKILL.md`), que tiene el prompt del MCP.
- `virovision-logo.svg` — símbolo a color sobre fondo claro.
- `virovision-logo-mono.svg` — versión monocroma (`currentColor`).
- `virovision-app-icon.svg` — ícono de app 1024 tal como lo exportó el manual.

Derivados para la app, generados desde la geometría del manual:

| SVG | PNG en la app | Notas |
|---|---|---|
| `icon.svg` | `assets/images/icon.png` | Cuadrado completo **sin redondear**: iOS aplica su propia máscara, y dejar las esquinas transparentes las mostraría en negro. Símbolo al 64 % según el manual. |
| `android-icon-foreground.svg` | `android-icon-foreground.png` | Símbolo al **50 %**, no 64 %: el launcher de Android recorta hasta ~66 % del lienzo y a 64 % los arcos quedarían al borde del recorte. |
| `android-icon-background.svg` | `android-icon-background.png` | Azul profundo liso. |
| `android-icon-monochrome.svg` | `android-icon-monochrome.png` | Un solo color plano: Android lo tiñe según el tema del sistema. |
| `splash-icon.svg` | `splash-icon.png` | Sólo el símbolo; el fondo lo pone el plugin de splash. |
| `favicon.svg` | `favicon.png` | Con fondo y esquinas redondeadas, va sobre la pestaña del navegador. |

## Regenerar los PNG

Sin dependencias extra — `qlmanage` viene con macOS:

```sh
qlmanage -t -s 1024 -o . icon.svg && mv icon.svg.png icon.png
```

## Pendiente

El **design system de la app todavía no sigue esta paleta**. `app/src/constants/theme.ts` usa
verde `#22C55E` sobre negro, mientras el manual define azul `#1256D4`, verde `#1FB57A` y azul
profundo `#061D3A`. Hoy el ícono y la app no combinan. Alinearlos es parte de **A1 / ADR 0005**
(design system y estándares de accesibilidad) — y hay que verificar el contraste de la paleta
nueva contra WCAG antes de adoptarla, que en esta app no es negociable.
