---
name: diseno-pagina
description: Guía para páginas de formato clínico y páginas web del libro odontológico. Una ruta nueva bajo src/pages/formatos/ usa PrintDocumentLayout, que ya incluye PrintToolbar, el selector de estilo visual y el script FOUC de html[data-visual-theme] y ?estilo=. Catálogo y legales usan WebPageLayout sin estilo visual. Incluye la receta para un cuarto VisualThemeId (VISUAL_THEMES más CSS). Usar al crear o editar páginas de formato, PrintDocumentLayout, WebPageLayout o al añadir un tema visual.
---

# Diseño de página

## Formato clínico nuevo

Una ruta bajo `src/pages/formatos/` es **una sola hoja**. Envuélvela en `PrintDocumentLayout`. No montes `PrintToolbar`, no dupliques el selector de estilo visual, no copies los scripts FOUC, no importes `visual-themes.css` ni `print.css` en la página.

`PrintDocumentLayout` ya aporta:

- `html` con `data-paper-size` y `data-visual-theme` (valores iniciales `letter` y `normal`)
- Script inline FOUC de `?papel=` / `odo-paper-size`
- Script inline FOUC de `?estilo=` / `odo-visual-theme` (el query gana sobre `localStorage`)
- `PrintToolbar`: radiogroup **Estilo visual** (`VisualThemeId`) y radiogroup **Papel** (`DesignSizeId`)
- Import de `tokens.css`, `visual-themes.css` y `print.css`
- `.sheet`, cabecera clínica, `slot` y pie documental

Patrón (igual que `src/pages/formatos/paciente-rx-tx.astro`):

```astro
---
import PrintDocumentLayout from '../../layouts/PrintDocumentLayout.astro';
import MiFormato from '../../components/formats/MiFormato.astro';
import { seoForFormat } from '../../lib/site';
---

<PrintDocumentLayout
  title="Título · ODO-F0X"
  description={seoForFormat('ODO-F0X')}
  documentTitle="TÍTULO EN HOJA"
  code="ODO-F0X"
>
  <MiFormato />
</PrintDocumentLayout>
```

El cuerpo clínico vive en `src/components/formats/`. Sigue `custom-skills/diseno-componente/SKILL.md`.

## Catálogo y legales

Usa `WebPageLayout`. **No** hay estilo visual: no importes `visual-themes.css`, no pongas `data-visual-theme`, no montes `PrintToolbar`, no leas `?estilo=`.

- Catálogo (`src/pages/index.astro`): `WebPageLayout` con `isCatalog`. Cuerpo `.is-catalog` / `.web-chrome`. Se oculta al imprimir.
- Aviso legal, privacidad, cookies, FAQ: `WebPageLayout` sin `isCatalog`. Páginas web normales; no son hoja clínica.

daisyUI solo en `.web-chrome`. No tematiza `.sheet` porque esas páginas no tienen `.sheet`.

## Tamaño frente a estilo

No renombres el tamaño de hoja. En la barra se llama **Papel** (`?papel=`, `html[data-paper-size]`, `DesignSizeId`). En el panel de exportación se llama **Diseño**. El estilo visual es otro eje: `VisualThemeId`, query `estilo`, `html[data-visual-theme]`.

| `VisualThemeId` | Etiqueta | Query |
| --- | --- | --- |
| `normal` | Normal | omitido o `?estilo=normal` |
| `rounded` | Rounded | `?estilo=rounded` (`redondeado` también) |
| `glass` | Glassmorfismo | `?estilo=glass` (`glassmorfismo` también) |

Pieles mutuamente excluyentes. No combines Rounded + Glass. Glass no usa `backdrop-filter`.

El estilo visual aplica solo a `.sheet`. Catálogo, legales y cromo daisyUI no cambian.

Al elegir un tema distinto de `normal`, la barra sincroniza la URL (`history.replaceState`) con `?estilo=`. `normal` quita el parámetro. Persistencia: `odo-visual-theme`.

## Receta: cuarto tema

No implementes un cuarto estilo salvo que te lo pidan. Si lo piden, no combines pieles existentes: añade una tercera alternativa excluyente (el registro pasará a cuatro ids).

1. **Registro** — `src/lib/visual-theme.ts`, array `VISUAL_THEMES`:

   ```ts
   { id: 'nuevo', label: 'Nuevo' },
   ```

   `VisualThemeId` se infiere del array. Añade alias en `VISUAL_THEME_ALIASES` si hace falta (`nuevoidioma: 'nuevo'`). `isVisualThemeId` solo acepta el id canónico, no el alias.

2. **FOUC** — el script inline de `src/layouts/PrintDocumentLayout.astro` duplica el mapa de alias. Añade la misma clave ahí. Si el query o `localStorage` no coinciden, el fallback sigue siendo `normal`.

3. **Barra** — `PrintToolbar` itera `VISUAL_THEMES`. No añadas un cuarto botón a mano.

4. **CSS** — `src/styles/visual-themes.css`, bloque excluyente:

   ```css
   html[data-visual-theme='nuevo'] {
     --radius-sheet: …;
     --radius-panel: …;
     --radius-cell: …;
     --sheet-bg: …;
     --panel-bg: …;
     --panel-title-bg: …;
     --panel-border-color: …;
     --panel-shadow: …;
     --cell-bg: …;
     --cell-border-color: …;
   }
   ```

   Si los radios deben encoger en A5/A6, añade `html[data-visual-theme='nuevo'][data-paper-size='a5']` (y `a6`), como Rounded y Glass. No toques `--page-width` ni la retícula.

5. **Prohibido en la piel** — `backdrop-filter`. html-to-image no lo rasteriza. Usa `color-mix`, degradados en `--sheet-bg` y sombras en `--panel-shadow`.

6. **Impresión** — no anules `--radius-sheet: 0` de `@media print` en `.sheet`: el papel físico es rectangular. Radios internos, fondos y sombras sí se conservan.

7. **Captura** — `sheetCaptureUrl` ya pone `estilo` con el `VisualThemeId` canónico. Si la piel pinta superficies nuevas, extiende `prepareSheetForCapture` (skill `diseno-componente`).

8. **Pruebas** — actualiza `src/lib/visual-theme.test.ts` (ids, etiquetas, alias, `sheetCaptureUrl`). No ejecutes la batería global salvo que te lo pidan.

## Encoding

Prosa y UI en UTF-8 con glifos reales. Ids de fichero y API en ASCII (`diseno-pagina`, `estilo`, `VisualThemeId`).
