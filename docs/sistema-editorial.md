# Sistema editorial

Referencia de tokens, lienzo e impresión, y responsabilidades de los componentes compartidos. Los cuatro formatos clínicos se maquetan en una fase posterior; esta ficha describe el sistema común ya disponible.

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

El tamaño de **diseño** se elige en `PrintToolbar` (Carta / A5 / A6). Se guarda en `localStorage` (`odo-paper-size`) y puede forzarse con `?papel=a5`, `?papel=a6` o `?papel=carta`. `.sheet` usa las mismas dimensiones en milímetros que `@page`. En pantalla, `.sheet-preview` / `.sheet-preview__scaler` pueden **escalar visualmente** la hoja (`--preview-scale` y `transform: scale`, origen `top left`) para que quepa a lo ancho; en escritorio ancho (≥ hoja) la escala es 1. **La impresión y el PDF no escalan**: `@media print` y `captureSheet` fuerzan `transform: none` (y `zoom: 1` en el clon de html-to-image) para salir al 100 %. **A4 no es un diseño**: no hay hoja A4 en pantalla. A4 sí es un **papel de salida** del PDF (A5 sobre A4 duplicado o en cuadernillo) desde el panel de exportación.

Cada ruta de formato genera **una sola hoja**. No hay paginación clínica: el pie lleva `1/1`.

En pantalla la hoja blanca se centra sobre un fondo neutro (`.is-print-document`). El cromo (catálogo, barra, sombras de preview) desaparece al imprimir; la hoja sale al tamaño de papel, sin el `scale` de la preview. El catálogo (`/`) no es un documento de hoja: está marcado como `.is-catalog` y se oculta con `@media print`. `window.print()` imprime solo la hoja en pantalla, no el pliego impuesto del PDF.

`box-sizing: border-box` es global. Los paneles usan `break-inside: avoid`. `print-color-adjust: exact` es una mejora; el significado no depende de que el navegador conserve el color.

## Tokens

Definidos en `src/styles/tokens.css` (valores en milímetros salvo la holgura de pantalla). `:root` es Carta; `html[data-paper-size="a5"]` y `html[data-paper-size="a6"]` redefinen tipografía, espacios, grosores y lienzo. Esa escala se aplica a `.sheet`; `html` usa `font-size: 16px` para que el cromo daisyUI (unidades `rem`) no se comprima al cambiar Carta, A5 o A6.

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

### Hojas de estilo

| Fichero | Responsabilidad |
| --- | --- |
| `src/styles/tokens.css` | Paleta, tipografía, escala, grosores y dimensiones del lienzo (Carta, A5 y A6) |
| `src/styles/base.css` | Caja, tipografía base (raíz 16 px, `text-size-adjust`), `overflow-x` de pantalla, vista de hoja centrada y preview a escala (`--preview-scale` solo en `@media screen`) |
| `src/styles/print.css` | `@page` de respaldo, ocultación de cromo de pantalla, reset del envoltorio de preview (tamaño auto, sin transform ni overflow recortado) y ajuste de color |
| `src/styles/web.css` | Cromo de botones y panel de exportación en pantalla (Tailwind + daisyUI, tema `odo`: `button`, `join`, `navbar`, `modal`, `fieldset`, `label`, `radio`, `checkbox`, `alert`). No es el sistema de las hojas. Variables acotadas a `.web-chrome`. |

Las hojas imprimibles no usan framework CSS: la composición es Grid y Flexbox sobre `tokens.css`. daisyUI no entra en `.sheet` ni en los formatos clínicos.

## Viewport y cromo de pantalla

Meta viewport idéntico en el catálogo (`/`) y en los formatos: `width=device-width, initial-scale=1`. No se usa `maximum-scale=1`, `user-scalable=no` ni `viewport-fit=cover` (el pellizco de Safari sigue activo).

La raíz `html` mantiene `font-size: 16px` (no cambia al elegir Carta / A5 / A6) y `text-size-adjust: 100%` (`-webkit-text-size-adjust` incluido). En `.web-chrome`, `input` / `select` / `textarea` quedan a `16px` para que iOS no haga zoom al enfocar radios o casillas. En `@media screen`, `html` y `body` usan `overflow-x: clip` y `overflow-y: auto` (la hoja en milímetros no define el ancho de página) y `min-height: 100dvh` con respaldo `100vh`.

El `<head>` del catálogo y de los formatos lo emite `SeoHead`: viewport `width=device-width, initial-scale=1`, description, canonical, iconos `favicon.ico` + `favicon.png`, `rel="describedby"` hacia `/llms.txt`, Open Graph y JSON-LD (`WebSite` + `FAQPage` en `/`; en formatos, sin `FAQPage`).

La barra es flex propio (`.print-toolbar`, `__home`, `__controls`, `__actions`); no usa `navbar-start` / `center` / `end`. El enlace de inicio (`.print-toolbar__home`) lleva el logo de **Diente Dientitos** a 24 px (`object-fit: contain` en un recuadro oscuro redondeado) y la etiqueta `homeLabel` (por defecto `Diente Dientitos`). Bajo `40rem` (640 px) los botones de acción son solo iconos Lucide y el texto (`.print-toolbar__label`, también el de marca) se recorta con clip; el nombre accesible se conserva para lectores de pantalla. El texto de marca vuelve a verse desde `min-width: 40.01rem`. Queda un solo enlace al catálogo; no hay segundo «Home» ni menú hamburguesa. El catálogo pasa a una columna a `720px` y, en viewport estrecho, reduce el padding a 24 px y el título a ~28 px. El panel de exportación (`modal-box`) usa `w-11/12 max-w-lg max-h-[90vh]`; los `join` de diseño y papel pueden partir línea para que Carta / A4 / A5 / A6 no recorten.

Los formatos clínicos y `.sheet` siguen en milímetros: no se remaquetan para móvil. Lo responsivo es el cromo de pantalla y una preview a escala. `--preview-scale: min(1, (100vw - 2 * var(--space-screen)) / var(--page-width))`. El scaler ocupa `calc(var(--page-*) * var(--preview-scale))` para que el `transform` no deje hueco. Impresión y captura PDF siguen al 100 %.

## Variante C (encabezado y pie)

Banda superior compacta: título del formato más cuatro campos manuscritos (`Clínica / profesional`, `Paciente`, `Folio / expediente`, `Fecha`). Pie con código (`ODO-F01` … `ODO-F04`), `REV. 01` y `1/1`.

Los campos clínicos son **líneas vacías** para pluma. Están prohibidos `<input>` y `<textarea>` en esos campos.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| `PrintDocumentLayout` | Documento HTML completo: fuentes, estilos, `SeoHead`, barra de impresión, envoltorio de preview (`.sheet-preview` / `.sheet-preview__scaler`), hoja, encabezado, `slot` clínico y pie. El atributo `data-paper-size` del `html` elige Carta, A5 o A6. Props: `title` (pestaña), `description`, `documentTitle`, `code`, `revision` y `page` opcionales. |
| `SeoHead` | Meta viewport, title, description, canonical, iconos, `describedby`, Open Graph y JSON-LD. Lo usan el catálogo y `PrintDocumentLayout`. |
| `ClinicalHeader` | Banda de cabecera. En Carta, cuatro campos en una fila; en A5 y A6, retícula 2 × 2. Prop `title`; etiquetas de los cuatro campos opcionales, resueltas con `ManualField`. |
| `DocumentFooter` | Pie documental. Prop `code`; `revision` por defecto `REV. 01`; `page` por defecto `1/1`. |
| `ManualField` | Etiqueta + renglón(es) de escritura. `wide` ensancha el campo; `multiline` dibuja tres renglones. |
| `OutlinedPanel` | Recuadro de borde exterior grueso. `title` opcional; el contenido va en el `slot`. `break-inside: avoid`. |
| `LegendMarker` | Marcador de leyenda con patrón y sigla: `rojo` = `R` sólido, `azul` = `A` rayado diagonal, `verde` = `V` con puntos, `otro` = `O` vacío. Incluye etiqueta y línea de equivalencia clínica vacía. |
| `SiteNavbar` | Barra flex daisyUI (`.print-toolbar`): enlace de marca a `/` (logo 24 px + `homeLabel` = Diente Dientitos), slots de papel y acciones. En estrecho el texto de marca se recorta como `.print-toolbar__label`. Solo cromo de pantalla; no entra en `.sheet`. |
| `PrintToolbar` | Compone `SiteNavbar` con el join Carta / A5 / A6 (diseño, no A4), Descargar PDF (`btn-primary`), Imprimir hoja (`btn-ghost`, `window.print()`) y Opciones. Monta `ExportPanel`. Visible solo en pantalla. No se usa en el catálogo. |
| `ExportPanel` | Diálogo daisyUI (`modal`) de exportación: `modal-box` `w-11/12 max-w-lg`; joins de diseño/papel con wrap. Diseño sincronizado con el radiogroup, papel de salida, disposición, orientación y lista ordenable de formatos. El PDF se genera en el cliente; no redibuja `.sheet`. |
| `Odontogram` | Diagrama dental vectorial FDI (52 dientes, glifo de círculo + equis) de ODO-F04, con cuadrado NOTAS al pie del panel. SVG estático, sin estado por superficie. |

El catálogo (`src/pages/index.astro`) es la portada de **Diente Dientitos**: logo, marca, definición, lista desde `CATALOG_FORMATS` y FAQ. Enlaza las cuatro rutas con `btn` daisyUI y no monta `PrintDocumentLayout` ni `PrintToolbar`. Los formatos clínicos y la hoja (`.sheet`) no usan daisyUI.

## Códigos documentales

| Ruta | Código |
| --- | --- |
| `/formatos/expedientes/` | `ODO-F01` |
| `/formatos/paciente-rx-tx/` | `ODO-F02` |
| `/formatos/eventos/` | `ODO-F03` |
| `/formatos/paciente-imagen/` | `ODO-F04` |

## Leyenda en escala de grises

El color es un refuerzo, no el único canal:

1. **Rojo / R**: círculo de relleno sólido.
2. **Azul / A**: círculo con rayado diagonal.
3. **Verde / V**: círculo con puntos.
4. **Otro / O**: círculo vacío.

Junto a cada marcador hay una línea para anotar la equivalencia clínica (el significado de cada color no está fijado en el brief).
