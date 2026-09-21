# Sistema editorial

Referencia de tokens, lienzo e impresión, y responsabilidades de los componentes compartidos. Los seis formatos clínicos se maquetan sobre este sistema común.

## Lienzo e impresión

| Medida | Carta | A5 | A6 |
| --- | --- | --- | --- |
| Formato | Vertical (predeterminado) | Vertical | Vertical |
| Página | 215,9 × 279,4 mm | 148 × 210 mm | 105 × 148 mm |
| `@page` | `letter portrait` | `A5 portrait` | `A6 portrait` |
| Margen seguro | 12 mm | 8 mm | 5,5 mm |
| Área útil | 191,9 × 255,4 mm | 132 × 194 mm | 94 × 137 mm |
| Encabezado clínico | 28 mm (4 campos en una fila) | 34 mm (campos en 2 × 2) | 28 mm (campos en 2 × 2) |
| Pie documental | 9 mm | 7 mm | 5,5 mm |
| Cuerpo | El resto del área útil (`minmax(0, 1fr)`), sin saltos internos | Igual | Igual |

El **tamaño de hoja** (Carta / A5 / A6, `DesignSizeId`) se elige en `PrintToolbar` en el desplegable **Papel**. Se guarda en `localStorage` (`odo-paper-size`) y puede forzarse con `?papel=a5`, `?papel=a6` o `?papel=carta`. El panel de exportación llama **Diseño** a ese mismo tamaño. `.sheet` usa las mismas dimensiones en milímetros que `@page`. En pantalla, `.sheet-preview` / `.sheet-preview__scaler` pueden **escalar visualmente** la hoja (`--preview-scale` y `transform: scale`, origen `top left`) para que quepa a lo ancho; en escritorio ancho (≥ hoja) la escala es 1. **La impresión y el PDF no escalan**: `@media print` y `captureSheet` fuerzan `transform: none` (y `zoom: 1` en el clon de html-to-image) para salir al 100 %. **A4 no es un tamaño de hoja en pantalla**. A4 sí es un **papel de salida** del PDF (A5 sobre A4 duplicado o en cuadernillo) desde el panel de exportación.

## Estilo visual de la hoja

El tamaño de hoja y el **estilo visual** son ejes independientes. El estilo no cambia milímetros ni retícula.

| Eje | En la barra | En el panel de exportación | API | Persistencia |
| --- | --- | --- | --- | --- |
| Tamaño de hoja (Carta / A5 / A6) | **Papel** | **Diseño** | `DesignSizeId`, `?papel=`, `html[data-paper-size]` | `odo-paper-size` |
| Estilo visual de `.sheet` | **Estilo visual** | (no se elige ahí) | `VisualThemeId`, `?estilo=`, `html[data-visual-theme]` | `odo-visual-theme` |

`VisualThemeId`: `normal` | `rounded` | `glass`. Etiquetas: Normal, Rounded, Glassmorfismo. Las tres pieles son mutuamente excluyentes (`html[data-visual-theme]`); no combinan Rounded + Glass. El query `?estilo=` gana sobre `localStorage`. Alias: `glassmorfismo` → `glass`, `redondeado` → `rounded`.

El estilo visual aplica **solo** a la hoja clínica (`.sheet` y descendientes). Catálogo, páginas legales y cromo daisyUI (`.web-chrome`) no cambian.

**Glass** no usa `backdrop-filter`: html-to-image no lo rasteriza en PNG. La piel Glass pinta con `color-mix`, degradado en `--sheet-bg` y `--panel-shadow`. En `@media print`, `--radius-sheet` pasa a 0 (el papel es rectangular); radios internos, fondos y sombras se conservan.

Registro y captura: `src/lib/visual-theme.ts` (`VISUAL_THEMES`, `normalizeVisualTheme`, `sheetCaptureUrl`). Pieles: `src/styles/visual-themes.css`. FOUC y `data-visual-theme` en `PrintDocumentLayout`. Selector en `PrintToolbar`. La captura inlinea fondo, borde, radio y sombra de `.sheet`, `.outlined-panel`, `.rx-cell`, `.tx-area` e `.imagen-notas` en `prepareSheetForCapture`. `captureSheet` / `captureFormatByUrl` admiten `{ background: 'opaque' | 'transparent' }` (opaco por defecto para el PDF; transparente solo vacía el papel `--sheet-bg` para PNG para editar). El ZIP de PNG se empaqueta en el cliente con `fflate` (`src/scripts/export-png.ts`).

Cada ruta de formato genera **una sola hoja**. No hay paginación clínica: el pie lleva `1/1`.

En pantalla la hoja blanca se centra sobre un fondo neutro (`.is-print-document`). El cromo (catálogo, barra, sombras de preview, pie legal) desaparece al imprimir; la hoja sale al tamaño de papel, sin el `scale` de la preview. El catálogo (`/`) no es un documento de hoja: está marcado como `.is-catalog` y se oculta con `@media print`. `window.print()` en un formato imprime solo la hoja en pantalla, no el pliego impuesto del PDF.

`box-sizing: border-box` es global. Los paneles usan `break-inside: avoid`. `print-color-adjust: exact` es una mejora; el significado no depende de que el navegador conserve el color.

## Tokens

Definidos en `src/styles/tokens.css` (valores en milímetros salvo la holgura de pantalla). `:root` es Carta; `html[data-paper-size="a5"]` y `html[data-paper-size="a6"]` redefinen tipografía, espacios, grosores y lienzo. Esa escala se aplica a `.sheet`; `html` usa `font-size: 16px` para que el cromo daisyUI (unidades `rem`) no se comprima al cambiar Carta, A5 o A6.

Los tokens de **piel visual** también viven en `tokens.css` (Normal: radios 0, fondos opacos). `html[data-visual-theme]` en `src/styles/visual-themes.css` los redefine para Rounded y Glass. No hardcodees radios ni fondos en un componente de hoja.

### Paleta

| Token | Uso |
| --- | --- |
| `--ink` (`#17233B`) | Texto, bordes y marcas de escritura |
| `--accent-teal` (`#1F7A7A`) | Acento de jerarquía, códigos de formato |
| `--accent-coral` (`#E56B6F`) | Acento de título y marcador Rojo |
| `--paper` | Fondo de hoja |
| `--screen-bg` | Fondo de la vista de pantalla |
| `--fill-faint` y tintes | Fondos de tinta mínima (nunca bloques oscuros) |

### Tipografía

Fuentes variables servidas en local con Fontsource:

- Títulos: **Manrope Variable** (`--font-display`)
- Cuerpo y etiquetas: **Source Sans 3 Variable** (`--font-body`)

El carácter más llamativo se limita a títulos en versales, numeración del catálogo y reglas de acento. No hay ornamentos ni apariencia de panel de control.

### Escala espacial y grosores

- Espaciado: `--space-1` (1 mm) a `--space-12` (12 mm), más `--write-line` (7,5 mm) para renglones manuscritos.
- `--stroke-outer` (0,5 mm): borde de panel y de hoja útil.
- `--stroke-rule` (0,32 mm): separación de encabezado.
- `--stroke-inner` (0,2 mm): divisiones internas.
- `--stroke-write` (0,16 mm): líneas de escritura.
- `--stroke-accent` (1,1 mm): subrayado coral del título.

### Piel visual

| Token | Uso |
| --- | --- |
| `--radius-sheet` | Radio de `.sheet` (0 al imprimir: el papel es rectangular) |
| `--radius-panel` | Radio de `OutlinedPanel` |
| `--radius-cell` | Radio de `.rx-cell`, `.tx-area`, `.imagen-notas` |
| `--sheet-bg` | Fondo de `.sheet` |
| `--panel-bg` | Fondo del recuadro del panel |
| `--panel-title-bg` | Fondo del título del panel |
| `--panel-border-color` | Borde del panel |
| `--panel-shadow` | Sombra del panel (`none` en Normal) |
| `--cell-bg` | Fondo de casilla |
| `--cell-border-color` | Borde de casilla |

Superficies que los consumen: `.sheet`, `OutlinedPanel` (incluido el título), `.rx-cell` / `.tx-area` / `.imagen-notas`. No: odontograma SVG, `LegendMarker`, `ManualField`, `DocumentFooter` (solo regla).

Glass no usa `backdrop-filter`.

### Hojas de estilo

| Fichero | Responsabilidad |
| --- | --- |
| `src/styles/tokens.css` | Paleta, tipografía, escala, grosores, dimensiones del lienzo (Carta, A5 y A6) y valores por defecto de la piel visual |
| `src/styles/visual-themes.css` | Pieles mutuamente excluyentes según `html[data-visual-theme]` (`normal` por omisión en tokens; `rounded` y `glass`). No usa `backdrop-filter`. |
| `src/styles/base.css` | Caja, tipografía base (raíz 16 px, `text-size-adjust`), `overflow-x` de pantalla, vista de hoja centrada y preview a escala (`--preview-scale` solo en `@media screen`) |
| `src/styles/print.css` | `@page` de respaldo, ocultación de cromo de pantalla (`[data-print-hide]`, barra, catálogo), reset del envoltorio de preview (tamaño auto, sin transform ni overflow recortado), tokens de piel en `.sheet` / paneles / casillas, y ajuste de color |
| `src/styles/web.css` | Cromo de botones y panel de exportación en pantalla (Tailwind + daisyUI, tema `odo`: `button`, `join`, `navbar`, `modal`, `fieldset`, `label`, `radio`, `checkbox`, `alert`, `dropdown`, `menu`). No es el sistema de las hojas. Variables acotadas a `.web-chrome`. |
| `src/styles/legal.css` | Cromo y textos web: pie, aviso de uso, páginas legales. No incluye reglas de tamaño de papel. |

Las hojas imprimibles no usan framework CSS: la composición es Grid y Flexbox sobre `tokens.css`. daisyUI no entra en `.sheet` ni en los formatos clínicos.

## Viewport y cromo de pantalla

Meta viewport idéntico en las páginas web (`WebPageLayout`: catálogo y legales) y en los formatos: `width=device-width, initial-scale=1`. No se usa `maximum-scale=1`, `user-scalable=no` ni `viewport-fit=cover` (el pellizco de Safari sigue activo).

La raíz `html` mantiene `font-size: 16px` (no cambia al elegir Carta / A5 / A6) y `text-size-adjust: 100%` (`-webkit-text-size-adjust` incluido). En `.web-chrome`, `input` / `select` / `textarea` quedan a `16px` para que iOS no haga zoom al enfocar radios o casillas. En `@media screen`, `html` y `body` usan `overflow-x: clip` y `overflow-y: auto` (la hoja en milímetros no define el ancho de página) y `min-height: 100dvh` con respaldo `100vh`.

El `<head>` de las páginas web (`WebPageLayout`: catálogo y legales) y de los formatos lo emite `SeoHead`: viewport `width=device-width, initial-scale=1`, description, canonical, iconos `favicon.ico` + `favicon.png`, `rel="describedby"` hacia `/llms.txt`, Open Graph y JSON-LD (`WebSite` + `FAQPage` en `/`; en formatos, sin `FAQPage`).

La barra es flex propio (`.print-toolbar`, `__home`, `__controls`, `__actions`); no usa `navbar-start` / `center` / `end`. El enlace de inicio (`.print-toolbar__home`) lleva el logo de **Diente Dientitos** a 24 px (`object-fit: contain` en un recuadro oscuro redondeado) y la etiqueta `homeLabel` (por defecto `Diente Dientitos`). Bajo `40rem` (640 px) los botones de acción son solo iconos Lucide y el texto (`.print-toolbar__label`, también el de marca) se recorta con clip; el nombre accesible se conserva para lectores de pantalla. El texto de marca vuelve a verse desde `min-width: 40.01rem`. Queda un solo enlace al catálogo; no hay segundo «Home» ni menú hamburguesa. El catálogo pasa a una columna a `720px` y, en viewport estrecho, reduce el padding a 24 px y el título a ~28 px. El panel de exportación (`dialog.modal`) se limita a `100svh`; el cuerpo (`.export-panel__scroll`) hace scroll y **Cerrar**, **PNG para editar** y **Descargar PDF** quedan fijos. Los `join` de diseño y papel pueden partir línea para que Carta / A4 / A5 / A6 no recorten. Las casillas y radios desmarcados del modal llevan borde 1 px visible porque el tema `odo` no define `--border` de daisyUI. En `fieldset`, `min-inline-size: 0` evita el desborde de WebKit.

Los formatos clínicos y `.sheet` siguen en milímetros: no se remaquetan para móvil. Lo responsivo es el cromo de pantalla y una preview a escala. `--preview-scale: min(1, (100vw - 2 * var(--space-screen)) / var(--page-width))`. El scaler ocupa `calc(var(--page-*) * var(--preview-scale))` para que el `transform` no deje hueco. Impresión y captura PDF siguen al 100 %.

## Variante C (encabezado y pie)

Banda superior compacta: título del formato más cuatro campos manuscritos (`Clínica / profesional`, `Paciente`, `Folio / expediente`, `Fecha`). Pie con código (`ODO-F01` … `ODO-F06`), `REV. 01` y `1/1`.

Los campos clínicos son **líneas vacías** para pluma. Están prohibidos `<input>` y `<textarea>` en esos campos.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| `PrintDocumentLayout` | Documento HTML completo: fuentes, estilos (incluye `visual-themes.css`, `print.css` y `legal.css`), `SeoHead`, barra de impresión, envoltorio de preview (`.sheet-preview` / `.sheet-preview__scaler`), hoja, encabezado, `slot` clínico y pie documental. Además de la hoja, monta `SiteFooter` **fuera** de `.sheet` con `data-print-hide`. El `html` lleva `data-paper-size` (Carta, A5 o A6) y `data-visual-theme` (`VisualThemeId`). Scripts FOUC: `?papel=` y `?estilo=` ganan sobre `localStorage`. Props: `title` (pestaña), `description`, `documentTitle`, `code`, `revision` y `page` opcionales. |
| `WebPageLayout` | Páginas web (catálogo y legales): `lang=es-ES`, `SeoHead`, skip-link, cabecera «Volver al catálogo» (no en `/`), `<main id="contenido">` y `SiteFooter`. **No** importa `print.css` ni `visual-themes.css`. Sin estilo visual. |
| `SiteFooter` | Enlaces permanentes a `/aviso-legal/`, `/politica-de-privacidad/`, `/cookies/` y `/preguntas-frecuentes/`; autor Agustin; correo; Apache-2.0; GitHub condicional (`PUBLIC_GITHUB_URL`). En catálogo y formatos. Nunca dentro de `.sheet`. Lleva `data-print-hide`. |
| `UsageNotice` | Aviso breve en el catálogo **antes** de la navegación de formatos. No se inserta en hojas clínicas ni altera PDFs. |
| `SeoHead` | Meta viewport, title, description, canonical, iconos, `describedby`, Open Graph y JSON-LD. Lo usan `WebPageLayout` y `PrintDocumentLayout`. |
| `ClinicalHeader` | Banda de cabecera. En Carta, cuatro campos en una fila; en A5 y A6, retícula 2 × 2. Prop `title`; etiquetas de los cuatro campos opcionales, resueltas con `ManualField`. |
| `DocumentFooter` | Pie documental. Prop `code`; `revision` por defecto `REV. 01`; `page` por defecto `1/1`. |
| `ManualField` | Etiqueta + renglón(es) de escritura. `wide` ensancha el campo; `multiline` dibuja tres renglones. |
| `OutlinedPanel` | Recuadro de borde exterior grueso. `title` opcional; el contenido va en el `slot`. `break-inside: avoid`. Consume `--panel-bg`, `--radius-panel`, `--panel-border-color`, `--panel-shadow` y `--panel-title-bg`. |
| `LegendMarker` | Marcador de leyenda con patrón y sigla: `rojo` = `R` sólido, `azul` = `A` rayado diagonal, `verde` = `V` con puntos, `otro` = `O` vacío. Incluye etiqueta y línea de equivalencia clínica vacía. |
| `SiteNavbar` | Barra flex daisyUI (`.print-toolbar`): enlace de marca a `/` (logo 24 px + `homeLabel` = Diente Dientitos), slots de estilo visual, papel y acciones. En estrecho el texto de marca se recorta como `.print-toolbar__label`. Solo cromo de pantalla; no entra en `.sheet`. |
| `PrintToolbar` | Compone `SiteNavbar` con los desplegables daisyUI (`dropdown` / `menu`, `listbox`) **Estilo visual** (`VISUAL_THEMES`: Normal / Rounded / Glassmorfismo) y **Papel** (Carta / A5 / A6; no A4), Descargar PDF (`btn-primary`), Imprimir hoja (`btn-ghost`, `window.print()`) y Opciones. Monta `ExportPanel`. Visible solo en pantalla. No se usa en el catálogo. No duplicar este selector en una página de formato. |
| `ExportPanel` | Diálogo daisyUI (`modal`) de exportación: cuerpo con scroll y acciones fijas; joins de diseño/papel con wrap. Diseño sincronizado con el desplegable **Papel** de la barra, papel de salida, disposición, orientación y lista ordenable de formatos. **Descargar PDF** impone y descarga en el cliente. **PNG para editar** (`btn-ghost`) baja un ZIP (`fflate`) de PNG a 300 dpi sin fondo de hoja (un PNG por formato marcado, siempre ZIP). No redibuja `.sheet`. |
| `Odontogram` | Diagrama dental vectorial FDI (52 dientes, glifo de círculo + equis) de ODO-F04, con cuadrado NOTAS al pie del panel. SVG estático, sin estado por superficie. |
| `ToothSprite` | Sprite SVG **inline** de glifos dentales para el periodontograma: un `<symbol>` de contorno y otro `-solid` por diente, generado en `src/lib/tooth-sprite/symbols.generated.ts` (104 símbolos: 64 permanentes + 40 temporales). Cada hoja filtra por prefijo `permanent_` o `temporal_` según `DentitionId`. Sin PNG ni sprite externo. |
| `PerioArch` | Retícula de sondaje de una arcada. ODO-F05 (permanente): 16 columnas FDI superiores y 16 inferiores (`48…41 | 31,32,23,33,34,36,37,38`; se omite 35 y se reutiliza el glifo FDI 23). ODO-F06 (temporal): 10+10 FDI de `icons-003-temporal.json` (`55…51 | 61…65` y `85…81 | 71…75`). Bandas Facial/Lingual y glifos del sprite (`<use href="#id">`). En Facial/Lingual, **rayado = superficie cubierta por encía; zona limpia = corona visible**. |
| `PerioOcclusion` | Bloque central de oclusión entre las dos arcadas: cuatro grupos. Permanente 8…1 \| 1…8 (16 columnas); temporal 5…1 \| 1…5 (10 columnas). |
| `PerioSymbology` | Leyenda clínica del panel SIMBOLOGÍA (extracción, ausencia, caries, furcación, etc.). |

### Sprite de dientes

Los glifos del periodontograma se incrustan con `ToothSprite` (`<svg aria-hidden="true" style="display:none">`). Cada entrada produce el contorno (`fill: currentColor`, todos los subpaths) y la capa `-solid` (solo el primer subpath de cada path, para pintar `var(--paper)` debajo). Los paths van envueltos en `<g transform="translate(0,887) scale(0.1,-0.1)">`, el mismo transform del atlas Potrace. No hay `<use href="/sprite.svg#...">`. Cada formato emite solo el prefijo de su dentición (`permanent_` en ODO-F05, `temporal_` en ODO-F06).

`src/lib/tooth-sprite/symbols.generated.ts` es un fichero **generado**: no se edita a mano. `src/lib/tooth-sprite/symbols.ts` es solo una fachada de ese generado. Para regenerarlo:

```bash
bun run sprite:teeth
```

El script lee los dos atlas canónicos:

- `raw/pagina-periortograma/icons-003-permanent.svg`
- `raw/pagina-periortograma/icons-003-permanent-coordinates.json`
- `raw/pagina-periortograma/icons-003-temporal.svg`
- `raw/pagina-periortograma/icons-003-temporal-coordinates.json`

Asigna cada path a la caja que lo contiene (tolerancia 2 px) con `assignAtlas`. Si hay cajas vacías o un path cae en varias cajas, falla **antes de escribir**. La salida tiene exactamente 104 entradas: 64 permanentes (`permanent_<fdi>_profile` / `permanent_<fdi>_occlusal` para 32 FDI; superior 18…11 | 21…28; inferior 48…41 | 31…38) y 40 temporales (`temporal_<fdi>_profile` / `temporal_<fdi>_occlusal` para 20 FDI de `icons-003-temporal.json`; superior 55…51 | 61…65; inferior 85…81 | 71…75).

Cada FDI usa su glifo propio. `periodontogram.ts` resuelve la columna a esos IDs de forma directa: no se espejan hemiarcadas ni se clonan terceros molares. Facial y Lingual reutilizan el perfil canónico del mismo FDI. Como el atlas fuente dibuja todos los perfiles con la raíz hacia arriba, `PerioArch` aplica `scale(1 -1)` únicamente a los perfiles Facial/Lingual de la arcada inferior: así la corona mira hacia arriba y la raíz queda abajo, dentro de la mitad rayada que representa la superficie cubierta por encía. La vista oclusal no se invierte.

El atlas permanente mantiene los 32 FDI canónicos y sus 64 símbolos, pero ODO-F05 no renderiza el FDI 35: la arcada superior conserva 16 columnas y la inferior también usa 16 (`48…41 | 31,32,23,33,34,36,37,38`), reutilizando el mismo glifo FDI 23 en ambas arcadas. ODO-F06 no remapea: la columna izquierda inferior es `8.5` (`temporal_85_profile`).

Los originales `icons-001` / `icons-002` (atlas y clones M3) no alimentan este flujo.

### Atlas permanente canónico (icons-003)

Los 32 dientes permanentes (perfil y oclusal) viven en un atlas limpio. `bun run sprite:teeth` lo consume para generar `symbols.generated.ts`:

- `raw/pagina-periortograma/icons-003-permanent.svg`
- `raw/pagina-periortograma/icons-003-permanent-coordinates.json` (`elements[]` con 64 IDs `permanent_<fdi>_profile` y `permanent_<fdi>_occlusal`)
- `raw/pagina-periortograma/icons-003-permanent.png` (rasterización del mismo SVG, no una copia recortada del PNG original)

Los originales `icons-003.svg`, `icons-003.png`, `icons-003-coordinates.json` e `icons-003-disposicion.json` se conservan como referencia. No se regeneran a partir del atlas permanente ni se sobrescriben.

Criterio canónico de selección (el original duplica glifos y etiqueta mal el 22):

| FDI canónico | Glifo de `icons-003` | Excluido |
| --- | --- | --- |
| 11 | `11_duplicate` (segundo 11) | el primer 11 |
| 21 | `21` | — |
| 22 | `21_duplicate` (relabelado) | — (el original no tiene 22) |
| 26 | `26` | `26_duplicate` |
| 32 | `32` | `32_duplicate` |
| 41 | `41_duplicate` | el primer 41 |

El atlas conserva solo dentición permanente, en el orden clínico de `icons-003-disposicion.json`: superior 18…11 \| 21…28 e inferior 48…41 \| 31…38. No se espejan hemiarcadas ni se clonan terceros molares; la corrección vertical inferior se aplica al render, no al atlas. Cada columna se parte en caja de perfil y caja oclusal, ampliadas para no recortar raíces ni oclusales. El SVG limpio omite cabeceras, números FDI, dentición temporal, símbolos auxiliares y los cuatro glifos sobrantes.

El catálogo (`src/pages/index.astro`) usa `WebPageLayout` (`isCatalog`): logo, marca, definición, `UsageNotice`, lista desde `CATALOG_FORMATS`, FAQ y `SiteFooter`. Enlaza las seis rutas de formato con `btn` daisyUI y no monta `PrintDocumentLayout` ni `PrintToolbar`. Los formatos clínicos y la hoja (`.sheet`) no usan daisyUI.

## Cromo legal y hoja clínica

El cromo legal (enlaces del pie, `.site-footer`, skip-link y `UsageNotice`) y la hoja clínica (`.sheet`) están separados. En `@media print`, `data-print-hide` y `print.css` (y las reglas equivalentes de `legal.css`) se ocultan los enlaces legales, el pie web, el skip-link y el aviso de uso; la hoja clínica no lleva avisos legales. `SiteFooter` nunca se monta dentro de `.sheet`. Las páginas legales **sí** pueden imprimirse como páginas normales: `WebPageLayout` no carga tamaño de papel.

## Códigos documentales

| Ruta | Código |
| --- | --- |
| `/formatos/expedientes/` | `ODO-F01` |
| `/formatos/paciente-rx-tx/` | `ODO-F02` |
| `/formatos/eventos/` | `ODO-F03` |
| `/formatos/paciente-imagen/` | `ODO-F04` |
| `/formatos/periodontograma/` | `ODO-F05` |
| `/formatos/periodontograma-temporal/` | `ODO-F06` |

## Leyenda en escala de grises

El color es un refuerzo, no el único canal:

1. **Rojo / R**: círculo de relleno sólido.
2. **Azul / A**: círculo con rayado diagonal.
3. **Verde / V**: círculo con puntos.
4. **Otro / O**: círculo vacío.

Junto a cada marcador hay una línea para anotar la equivalencia clínica (el significado de cada color no está fijado en el brief).
