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

El tamaño de **diseño** se elige en `PrintToolbar` (Carta / A5 / A6). Se guarda en `localStorage` (`odo-paper-size`) y puede forzarse con `?papel=a5`, `?papel=a6` o `?papel=carta`. La previsualización en pantalla usa las mismas dimensiones que `@page`. **A4 no es un diseño**: no hay hoja A4 en pantalla. A4 sí es un **papel de salida** del PDF (A5 sobre A4 duplicado o en cuadernillo) desde el panel de exportación.

Cada ruta de formato genera **una sola hoja**. No hay paginación clínica: el pie lleva `1/1`.

En pantalla la hoja blanca se centra sobre un fondo neutro (`.is-print-document`). Al imprimir desaparecen el catálogo, la barra (selector de diseño, Descargar PDF, Imprimir hoja, Opciones) y las sombras. El catálogo (`/`) no es un documento de hoja: está marcado como `.is-catalog` y se oculta con `@media print`. `window.print()` imprime solo la hoja en pantalla, no el pliego impuesto del PDF.

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
| `src/styles/base.css` | Caja, tipografía base y vista de pantalla (hoja centrada) |
| `src/styles/print.css` | `@page` de respaldo, ocultación de cromo de pantalla y ajuste de color |
| `src/styles/web.css` | Cromo de botones y panel de exportación en pantalla (Tailwind + daisyUI, tema `odo`: `button`, `join`, `navbar`, `modal`, `fieldset`, `label`, `radio`, `checkbox`, `alert`). No es el sistema de las hojas. Variables acotadas a `.web-chrome`. |

Las hojas imprimibles no usan framework CSS: la composición es Grid y Flexbox sobre `tokens.css`. daisyUI no entra en `.sheet` ni en los formatos clínicos.

## Variante C (encabezado y pie)

Banda superior compacta: título del formato más cuatro campos manuscritos (`Clínica / profesional`, `Paciente`, `Folio / expediente`, `Fecha`). Pie con código (`ODO-F01` … `ODO-F04`), `REV. 01` y `1/1`.

Los campos clínicos son **líneas vacías** para pluma. Están prohibidos `<input>` y `<textarea>` en esos campos.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| `PrintDocumentLayout` | Documento HTML completo: fuentes, estilos, barra de impresión, hoja, encabezado, `slot` clínico y pie. El atributo `data-paper-size` del `html` elige Carta, A5 o A6. Props: `title` (pestaña), `documentTitle`, `code`, `revision` y `page` opcionales. |
| `ClinicalHeader` | Banda de cabecera. En Carta, cuatro campos en una fila; en A5 y A6, retícula 2 × 2. Prop `title`; etiquetas de los cuatro campos opcionales, resueltas con `ManualField`. |
| `DocumentFooter` | Pie documental. Prop `code`; `revision` por defecto `REV. 01`; `page` por defecto `1/1`. |
| `ManualField` | Etiqueta + renglón(es) de escritura. `wide` ensancha el campo; `multiline` dibuja tres renglones. |
| `OutlinedPanel` | Recuadro de borde exterior grueso. `title` opcional; el contenido va en el `slot`. `break-inside: avoid`. |
| `LegendMarker` | Marcador de leyenda con patrón y sigla: `rojo` = `R` sólido, `azul` = `A` rayado diagonal, `verde` = `V` con puntos, `otro` = `O` vacío. Incluye etiqueta y línea de equivalencia clínica vacía. |
| `SiteNavbar` | Barra de botones daisyUI (`navbar` + `btn` / `join`): enlace al catálogo, selector de diseño, Descargar PDF, Imprimir hoja y Opciones. Solo cromo de pantalla; no entra en `.sheet`. |
| `PrintToolbar` | Compone `SiteNavbar` con el join Carta / A5 / A6 (diseño, no A4), Descargar PDF (`btn-primary`), Imprimir hoja (`btn-ghost`, `window.print()`) y Opciones. Monta `ExportPanel`. Visible solo en pantalla. No se usa en el catálogo. |
| `ExportPanel` | Diálogo daisyUI (`modal`) de exportación: diseño sincronizado con el radiogroup, papel de salida, disposición, orientación y lista ordenable de formatos. El PDF se genera en el cliente; no redibuja `.sheet`. |
| `Odontogram` | Diagrama dental vectorial FDI (52 dientes, glifo de círculo + equis) para el recuadro IMAGEN de ODO-F04. SVG estático, sin estado por superficie. |

El catálogo (`src/pages/index.astro`) enlaza las cuatro rutas con `btn` daisyUI y no monta `PrintDocumentLayout` ni `PrintToolbar`. Los formatos clínicos y la hoja (`.sheet`) no usan daisyUI.

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
