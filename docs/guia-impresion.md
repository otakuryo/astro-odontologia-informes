# Guía de impresión

Protocolo de control de calidad para los cuatro formatos clínicos (ODO-F01 a ODO-F04). La fidelidad en milímetros, el espacio de pluma y el resultado en fotocopia **no** se cubren con pruebas unitarias: hay que imprimir de verdad.

Hay tres salidas distintas. No las mezcle:

1. **PDF del panel** — captura de las hojas, imposición (1-up, duplicar o cuadernillo) y descarga. La escala 100 % se comprueba **en el visor de PDF**, no en el diálogo de impresión del navegador.
2. **PNG para editar** — ZIP de PNG a 300 dpi **sin fondo de hoja** (`--sheet-bg`, incluido el degradado Glass). Un PNG por formato marcado, al tamaño de **Diseño**, 1-up vertical. El papel de salida, la disposición y la orientación **no** entran. Siempre ZIP, aunque haya un solo formato. Los rellenos de paneles, casillas, títulos y odontograma se conservan.
3. **Imprimir hoja** (`window.print()`) — solo la hoja que está en pantalla, sin pliego impuesto. Sigue siendo la alternativa si la captura falla (sobre todo en Safari).

## Tamaño de hoja frente a estilo visual

Son ejes independientes. No los mezcle.

- **Tamaño de hoja** (Carta, A5 o A6): `DesignSizeId`, `?papel=`, `html[data-paper-size]`. En la barra se llama **Papel**. En el panel de exportación se llama **Diseño**. **A4 no es un tamaño de hoja en pantalla**.
- **Estilo visual** de `.sheet`: `VisualThemeId` (`normal` | `rounded` | `glass`), `?estilo=`, `html[data-visual-theme]`, persistencia `odo-visual-theme`. Etiquetas: Normal, Rounded, Glassmorfismo. El query `?estilo=` gana sobre `localStorage`. Alias: `glassmorfismo` → `glass`, `redondeado` → `rounded`.
- El estilo visual aplica **solo** a la hoja clínica. Catálogo, páginas legales y cromo daisyUI no cambian.
- Las tres pieles son mutuamente excluyentes. No combinan Rounded + Glass.
- **Glass** no usa `backdrop-filter` (html-to-image no lo rasteriza). Fondos y sombras van con `color-mix` y `--panel-shadow`.

## Diseño frente a papel

- **Diseño** (Carta, A5 o A6): tamaño de la hoja clínica en pantalla. En la barra es el radiogroup **Papel** (`?papel=`, `localStorage odo-paper-size`, `html[data-paper-size]`). **A4 no es un diseño**: no existe hoja A4 en pantalla.
- **Papel de salida** (Carta, A4, A5 o A6): tamaño de cada página del PDF. Se elige en **Opciones**.
- **Nunca se escala.** Solo hay disposición si el diseño y el papel coinciden (1-up) o si hay un anidamiento ISO de un escalón: A5 sobre A4, o A6 sobre A5 (duplicar y cuadernillo). Carta×A4 y A6×A4 (4-up) no están disponibles.
- **Descargar PDF** permanece habilitado. Si el papel de salida del panel deja de ser imponible (al cambiar **Papel** en la barra o al pulsar descargar), se realinea al diseño en 1-up. El panel sigue alertando en cruces imposibles elegidos ahí, sin apagar el botón.

## Antes de imprimir

- En la barra, elija el **papel** (tamaño de hoja): **Carta** (215,9 × 279,4 mm), **A5** (148 × 210 mm) o **A6** (105 × 148 mm). La previsualización en pantalla cambia de tamaño. El valor se recuerda entre formatos.
- En la barra, elija el **estilo visual**: **Normal**, **Rounded** o **Glassmorfismo**. Solo pinta `.sheet`. Puede forzarlo con `?estilo=rounded`, `?estilo=glass` o los alias `redondeado` y `glassmorfismo`. Glass no usa `backdrop-filter`.
- En **Opciones**, elija el **papel de salida**, la disposición y los formatos. El formato de la página actual parte marcado. La lista no puede quedar vacía. **PNG para editar** usa solo **Diseño** (tamaño de cada hoja) y **Formatos** (los marcados, en el orden de la lista); la piel es la del documento vivo.
- **Duplicar** y **cuadernillo** van siempre en **apaisado** (la orientación del panel queda bloqueada: «Automática (apaisado)»).
- Una sola hoja clínica por formato. **No imprima el catálogo** (`/`): es la portada de Diente Dientitos y sigue sin imprimirse.

## Rutas

| Código | Ruta | Contenido |
| --- | --- | --- |
| ODO-F01 | `/formatos/expedientes/` | Expedientes / folios |
| ODO-F02 | `/formatos/paciente-rx-tx/` | Paciente, Rx, Tx, notas |
| ODO-F03 | `/formatos/eventos/` | Cuatro paneles de evento |
| ODO-F04 | `/formatos/paciente-imagen/` | Diagrama dental vectorial, leyenda R/A/V/O y notas |

Cada ruta genera exactamente **1/1**. No hay paginación clínica. Puede forzar el tamaño de hoja con `?papel=a5`, `?papel=a6` o `?papel=carta`, y el estilo visual con `?estilo=rounded`, `?estilo=glass` o `?estilo=normal` (`html[data-visual-theme]`, tipo `VisualThemeId`).

## Navegadores de QA

Pruebe cada formato en:

1. **Chromium** (Chrome, Edge u otro basado en Chromium) — PDF del panel, PNG para editar e Imprimir hoja.
2. **Safari** — **a mano**. `html-to-image` puede fallar; el panel muestra una alerta daisyUI y hay que usar **Imprimir hoja**. No hay e2e de Safari en este proyecto.

No suba `@playwright/test` por encima de 1.61.1: Chromium de 1.62 no se instala en macOS 13.

## Protocolo PDF (panel de exportación)

Haga esta pasada en Chromium. En Safari, si la captura falla, pase al protocolo de **Imprimir hoja**.

1. Abra un formato, elija el **papel** (tamaño de hoja) y el **estilo visual** en la barra y pulse **Opciones**.
2. Elija **papel**, **disposición** y **formatos**. Combinaciones habituales de QA:
   - Mismo tamaño: diseño A5, papel A5, 1-up vertical → una página A5.
   - **Duplicar**: diseño A5, papel A4, duplicar → una página A4 apaisada con la misma hoja a izquierda y derecha.
   - **Cuadernillo**: diseño A5, papel A4, los cuatro formatos en orden de catálogo → dos páginas A4 apaisadas (un pliego, cara y dorso).
3. Pulse **Descargar PDF**. Abra el fichero en el visor.
4. Imprima desde el **visor de PDF** (no desde el diálogo web del sitio). Escala **100 %**. No use «ajustar a la página» ni el zoom del visor como si fuera escala de impresión.
5. **Cuadernillo y duplicar**: dúplex, **voltear por el lado corto**. El pliego es apaisado; el lado corto es el lomo al plegar.
6. Compruebe el recuento de páginas y el tamaño (Carta, A4, A5 o A6) en las propiedades del PDF.

### Lista de comprobación (PDF)

- [ ] El PDF tiene el número de páginas esperado (1-up y duplicar: una por formato; cuadernillo de 4 formatos: 2 páginas).
- [ ] El tamaño de página coincide con el **papel de salida**, no con un «ajustar a A4» del visor.
- [ ] Escala 100 % en el visor: las hojas clínicas coinciden con el diseño (Carta, A5 o A6) y no están encogidas.
- [ ] Duplicar: la misma hoja a ambos lados, sin escala.
- [ ] Cuadernillo: dúplex lado corto; al plegar, el orden de lectura es 1-2-3-4.
- [ ] Sombra de pantalla, barra, selector de papel, selector de estilo visual, **Opciones**, el panel, el pie legal (`.site-footer`) y el aviso de uso (`UsageNotice`) no aparecen en el PDF.
- [ ] El PDF muestra la piel elegida (Normal / Rounded / Glass) en `.sheet`. Glass no depende de `backdrop-filter`.

## Protocolo PNG para editar

Haga esta pasada en Chromium. El control está en **Opciones** (`PNG para editar`), no en la barra.

1. Abra un formato, elija el **papel** (tamaño de hoja / **Diseño**) y el **estilo visual** en la barra y pulse **Opciones**.
2. Marque los formatos en el orden deseado. El papel de salida, la disposición y la orientación **no** cambian el ZIP.
3. Pulse **PNG para editar**. Descomprima el ZIP (un PNG por formato marcado; un solo formato también va en ZIP).
4. Abra un PNG sobre un **fondo de color**: los paneles, casillas y títulos se ven opacos; los márgenes de la hoja son transparentes. El cromo web (barra, panel, pie legal) no aparece.

### Lista de comprobación (PNG para editar)

- [ ] El ZIP tiene un PNG por formato marcado; los nombres llevan `01-`, `02-`… y `-sin-fondo`.
- [ ] Cada PNG es el tamaño de **Diseño** (Carta, A5 o A6), 1-up vertical, 300 dpi.
- [ ] Sobre un fondo de color: márgenes de hoja transparentes; paneles y casillas opacos.
- [ ] Sombra de pantalla, barra, selector de papel, selector de estilo visual, **Opciones**, el panel, el pie legal y el aviso de uso no aparecen en el PNG.

## Protocolo Imprimir hoja (cada formato, cada navegador)

Solo la hoja en pantalla. No impone pliego. Haga las dos pasadas, en este orden:

1. **PDF del navegador** — Imprimir → Guardar como PDF (o «Abrir en Vista Previa» en Safari). Abra el PDF y compruebe que hay **una sola página** del **diseño** elegido (Carta, A5 o A6).
2. **Impresora real** — La misma hoja, primero a **color** y después a **escala de grises** (o fotocopia monocroma del PDF).

En el diálogo del navegador: el **mismo tamaño de papel** que el diseño, orientación **vertical**, escala **100 %**, **sin** cabeceras ni pies automáticos, margen mínimo o «ninguno».

### Lista de comprobación (Imprimir hoja)

- [ ] Una hoja exacta; no hay segunda página en blanco ni recorte a media hoja.
- [ ] Escala 100 %: la hoja coincide con el diseño (Carta, A5 o A6); no está encogida ni ampliada.
- [ ] Cabeceras y pies del navegador ausentes.
- [ ] Margen seguro respetado en los cuatro lados; nada de trazo ni texto pegado al borde del papel. El margen seguro va dibujado en la hoja (12 mm en Carta, 8 mm en A5, 5,5 mm en A6).
- [ ] Bordes de paneles, casillas y marcadores visibles; no recortados.
- [ ] Líneas de escritura con espacio de pluma suficiente (campos de cabecera, folios, notas, equivalencias). En A6 el renglón es más corto: compruebe que sigue siendo usable.
- [ ] Códigos `ODO-F01` … `ODO-F04`, `REV. 01` y `1/1` legibles en el pie.
- [ ] En ODO-F04, la leyenda se distingue **sin color**: **R** sólido, **A** rayado diagonal, **V** puntos, **O** círculo vacío, más las siglas. El color es un refuerzo, no el único canal.
- [ ] En ODO-F04, los 52 numerales FDI del diagrama dental son legibles en el PDF.
- [ ] Sombra de pantalla, selector de papel, selector de estilo visual, «Descargar PDF», «Imprimir hoja», «Opciones», el pie legal (`.site-footer`) y el aviso de uso (`UsageNotice`) no aparecen en el papel ni en el PDF.

## Revisión médica

Las plantillas **no** están homologadas en ningún país. El aval odontológico de partida no es certificación, expediente clínico oficial ni producto sanitario. Pueden usarse en cualquier territorio; quien las use debe revisarlas de forma independiente (textos, recuentos, leyenda y flujo de escritura) y comprobar que el uso es lícito donde ejerza. No las presente como homologadas ni como producto sanitario. El sitio no se hace responsable, en la máxima medida permitida por la ley, del uso inadecuado.

## Datos de pacientes (demo)

El sitio no captura datos clínicos: no hay cuentas ni fichas en servidor. El PDF se genera en el navegador. **No introduzca datos reales de pacientes** en esta demostración. No hay autenticación, cifrado, consentimiento informado ni retención controlada. Cualquier anotación en una captura, PDF o impresora compartida se considera dato expuesto.

El pie legal (`.site-footer`) y el aviso de uso del catálogo (`UsageNotice`) no deben aparecer en la impresión ni en el PDF clínico.

## Fuera de alcance (backlog)

No forman parte del QA actual. No implementar ahora:

- Diseño **A4** en pantalla.
- 4-up A6 sobre A4.
- Media Carta.
- Dos-up secuencial (hojas distintas lado a lado, sin duplicar ni cuadernillo).
- Creep, marcas de corte y sangrado.
- PDF vectorial puro (la exportación actual rasteriza a PNG).
- SDK, Connect o Apps de Canva (el ZIP de PNG para editar es la vía de edición; no hay integración).
- Quitar `window.print()`.
- Impresión del catálogo `/`.
- daisyUI dentro de `.sheet`.
- `backdrop-filter` en la hoja clínica.
