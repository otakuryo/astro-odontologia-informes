---
name: diseno-componente
description: Guía para crear o editar componentes de hoja clínica en src/components/document/ y src/components/formats/. Obliga tokens de estilo visual (--radius-sheet, --radius-panel, --radius-cell, --sheet-bg, --panel-bg, --panel-title-bg, --panel-border-color, --panel-shadow, --cell-bg, --cell-border-color), prohíbe backdrop-filter, daisyUI dentro de .sheet y radios o fondos hardcodeados, y enseña a extender prepareSheetForCapture. Usar al añadir o modificar OutlinedPanel, casillas Rx/Tx, notas, paneles o cualquier superficie de .sheet, VisualThemeId o html[data-visual-theme].
---

# Diseño de componente de hoja

Aplica al crear o editar ficheros bajo `src/components/document/` o `src/components/formats/`.

No aplica a cromo web (`src/components/web/`), catálogo, páginas legales ni daisyUI.

## Tamaño frente a estilo

Son ejes independientes. No los mezcles ni los renombres.

| Eje | En la barra | API | Atributo |
| --- | --- | --- | --- |
| Tamaño de hoja (Carta / A5 / A6) | **Papel** | `DesignSizeId`, `?papel=` | `html[data-paper-size]` |
| Estilo visual de `.sheet` | **Estilo visual** | `VisualThemeId`, `?estilo=` | `html[data-visual-theme]` |

El panel de exportación llama **Diseño** al tamaño de hoja. No toques `DesignSizeId`. En la barra, **Papel** y **Estilo visual** son desplegables daisyUI (`dropdown` + `menu` con `listbox` / `option`), no un radiogroup. daisyUI sigue prohibido dentro de `.sheet`.

`VisualThemeId`: `normal` | `rounded` | `glass`. Etiquetas: Normal, Rounded, Glassmorfismo. Pieles mutuamente excluyentes: no combines Rounded + Glass. El query `?estilo=` gana sobre `localStorage` (`odo-visual-theme`). Alias: `glassmorfismo` → `glass`, `redondeado` → `rounded`.

El estilo visual aplica **solo** a `.sheet` y descendientes. No tematizes catálogo, legales ni `.web-chrome`.

## Tokens obligatorios

Valores por defecto (Normal: radio 0, fondos opacos) en `src/styles/tokens.css`. Las pieles redefinen en `src/styles/visual-themes.css` según `html[data-visual-theme]`. No copies esos valores a un componente.

| Token | Uso |
| --- | --- |
| `--radius-sheet` | Radio de `.sheet` (en `@media print` se fuerza a 0: el papel es rectangular) |
| `--radius-panel` | Radio de `OutlinedPanel` |
| `--radius-cell` | Radio de casillas (`.rx-cell`, `.tx-area`, `.imagen-notas`) |
| `--sheet-bg` | Fondo de `.sheet` |
| `--panel-bg` | Fondo del recuadro del panel |
| `--panel-title-bg` | Fondo del título del panel |
| `--panel-border-color` | Borde del panel |
| `--panel-shadow` | Sombra del panel (`none` en Normal) |
| `--cell-bg` | Fondo de casilla |
| `--cell-border-color` | Borde de casilla |

Medidas, tipografía y grosores siguen en milímetros (`--space-*`, `--stroke-*`, `--fs-*`). El estilo visual no altera la retícula.

## Superficies que consumen tokens de piel

| Superficie | Dónde | Tokens |
| --- | --- | --- |
| `.sheet` | `src/styles/base.css`, `src/styles/print.css` | `--sheet-bg`, `--radius-sheet` |
| `OutlinedPanel` | `src/components/document/OutlinedPanel.astro` | `--panel-bg`, `--radius-panel`, `--panel-border-color`, `--panel-shadow` |
| Título de panel | `.outlined-panel__title` | `--panel-title-bg`, `--panel-border-color` |
| `.rx-cell` / `.tx-area` | `PacienteRxTxFormat.astro`, `print.css` | `--cell-bg`, `--cell-border-color`, `--radius-cell` |
| `.imagen-notas` | `PacienteImagenFormat.astro`, `print.css` | igual que casilla |

## Superficies que no tematizan

No les pongas radio, fondo de piel ni sombra de tema:

- odontograma SVG (`Odontogram`)
- `LegendMarker` (patrones en tinta; el color es refuerzo)
- `ManualField` (renglón de pluma)
- `DocumentFooter` (solo regla superior con `--stroke-inner` y `--ink`)

## Prohibido

- `backdrop-filter` (incluido el «cristal» de Glass). html-to-image no lo rasteriza en PNG. Glass usa `color-mix`, degradado en `--sheet-bg` y `--panel-shadow`.
- daisyUI, Tailwind o clases `btn` / `join` / `modal` **dentro** de `.sheet`. El cromo va en `.web-chrome`.
- `border-radius`, `background` o `box-shadow` hardcodeados (`0`, `8px`, `#fff`, `rgba(...)`) en un componente de hoja. Usa el token.
- `border: none` en paneles o casillas (rompe la fotocopia). Conserva `--stroke-*` y el token de color de borde.
- Combinar Rounded y Glass, o apilar dos `data-visual-theme`.

## Receta al añadir una superficie pintada

1. Reutiliza `OutlinedPanel` si es un recuadro con título. No clones su CSS.
2. Si es una casilla nueva, copia el patrón de `.rx-cell`: `border`, `background` y `border-radius` con tokens de celda.
3. En `@media print` (`src/styles/print.css`), añade la clase a la lista que reafirma borde, fondo y radio con tokens (nunca `border: none`).
4. Extiende la captura (siguiente sección).

Ejemplo mínimo de casilla:

```css
.mi-casilla {
  border: var(--stroke-inner) solid var(--cell-border-color);
  background: var(--cell-bg);
  border-radius: var(--radius-cell);
}
```

## Captura: extender `prepareSheetForCapture`

Fichero: `src/scripts/capture-sheet.ts`. html-to-image clona el nodo y no copia el CSS calculado de radios, fondos y sombras. Si añades una superficie con radio, fondo o sombra, inclúyela en el selector y **inlinea** las mismas propiedades que las superficies actuales.

Lista actual (el `root` es `.sheet`):

```ts
const themeSurfaces = [
  root,
  ...root.querySelectorAll('.outlined-panel, .rx-cell, .tx-area, .imagen-notas'),
];
```

Por cada elemento, copiar desde `getComputedStyle`:

- `background` / `backgroundColor` / `backgroundImage` (y size, position, repeat)
- `border` / `borderColor` / `borderStyle` / `borderWidth`
- `borderRadius`
- `boxShadow`
- `printColorAdjust = 'exact'`

Si el título del panel (u otra franja interior) tiene fondo propio y no queda cubierto por el padre, añádelo al selector (p. ej. `.outlined-panel__title`).

Usa `snapshotInline` para poder restaurar. No inventes otro mecanismo.

La URL de captura ya lleva tamaño y piel: `sheetCaptureUrl(path, design, theme)` pone `?papel=` y `?estilo=` (`src/lib/visual-theme.ts`). No reconstruyas esa query a mano.

## Encoding

Comentarios, `aria-label` y cadenas de UI en UTF-8 con glifos reales (`ñ`, `á`, `¿`). Identificadores de fichero y API en ASCII (`estilo`, `VisualThemeId`).
