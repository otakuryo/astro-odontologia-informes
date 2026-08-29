# Guía de impresión

Protocolo de control de calidad para los cuatro formatos clínicos (ODO-F01 a ODO-F04). La fidelidad en milímetros, el espacio de pluma y el resultado en fotocopia **no** se cubren con pruebas unitarias: hay que imprimir de verdad.

Hay dos salidas distintas. No las mezcle:

1. **PDF del panel** — captura de las hojas, imposición (1-up, duplicar o cuadernillo) y descarga. La escala 100 % se comprueba **en el visor de PDF**, no en el diálogo de impresión del navegador.
2. **Imprimir hoja** (`window.print()`) — solo la hoja que está en pantalla, sin pliego impuesto. Sigue siendo la alternativa si la captura falla (sobre todo en Safari).

## Diseño frente a papel

- **Diseño** (Carta, A5 o A6): tamaño de la hoja clínica en pantalla. Es el radiogroup de la barra (`?papel=`, `localStorage odo-paper-size`, `html[data-paper-size]`). **A4 no es un diseño**: no existe hoja A4 en pantalla.
- **Papel de salida** (Carta, A4, A5 o A6): tamaño de cada página del PDF. Se elige en **Opciones**.
- **Nunca se escala.** Solo hay disposición si el diseño y el papel coinciden (1-up) o si hay un anidamiento ISO de un escalón: A5 sobre A4, o A6 sobre A5 (duplicar y cuadernillo). Carta×A4 y A6×A4 (4-up) no están disponibles.

## Antes de imprimir

- En la barra, elija el **diseño**: **Carta** (215,9 × 279,4 mm), **A5** (148 × 210 mm) o **A6** (105 × 148 mm). La previsualización en pantalla cambia de tamaño. El valor se recuerda entre formatos.
- En **Opciones**, elija el **papel de salida**, la disposición y los formatos. El formato de la página actual parte marcado. La lista no puede quedar vacía.
- **Duplicar** y **cuadernillo** van siempre en **apaisado** (la orientación del panel queda bloqueada: «Automática (apaisado)»).
- Una sola hoja clínica por formato. **No imprima el catálogo** (`/`): es la portada de Diente Dientitos y sigue sin imprimirse.

## Rutas

| Código | Ruta | Contenido |
| --- | --- | --- |
| ODO-F01 | `/formatos/expedientes/` | Expedientes / folios |
| ODO-F02 | `/formatos/paciente-rx-tx/` | Paciente, Rx, Tx, notas |
| ODO-F03 | `/formatos/eventos/` | Cuatro paneles de evento |
| ODO-F04 | `/formatos/paciente-imagen/` | Diagrama dental vectorial, leyenda R/A/V/O y notas |

Cada ruta genera exactamente **1/1**. No hay paginación clínica. Puede forzar el diseño con `?papel=a5`, `?papel=a6` o `?papel=carta`.

## Navegadores de QA

Pruebe cada formato en:

1. **Chromium** (Chrome, Edge u otro basado en Chromium) — PDF del panel e Imprimir hoja.
2. **Safari** — **a mano**. `html-to-image` puede fallar; el panel muestra una alerta daisyUI y hay que usar **Imprimir hoja**. No hay e2e de Safari en este proyecto.

No suba `@playwright/test` por encima de 1.61.1: Chromium de 1.62 no se instala en macOS 13.

## Protocolo PDF (panel de exportación)

Haga esta pasada en Chromium. En Safari, si la captura falla, pase al protocolo de **Imprimir hoja**.

1. Abra un formato, elija el **diseño** en la barra y pulse **Opciones**.
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
- [ ] Sombra de pantalla, barra, selector de diseño, **Opciones** y el panel no aparecen en el PDF.

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
- [ ] Sombra de pantalla, selector de diseño, «Descargar PDF», «Imprimir hoja» y «Opciones» no aparecen en el papel ni en el PDF.

## Revisión médica

Antes de usar estos formatos en consulta, un profesional clínico debe revisar textos, recuentos, leyenda y flujo de escritura. Hasta esa validación, las hojas son maquetas de trabajo, no un expediente homologado.

## Datos de pacientes (demo)

**No introduzca datos reales de pacientes** en esta demostración. No hay autenticación, cifrado, consentimiento informado ni retención controlada. Cualquier anotación en una captura, PDF o impresora compartida se considera dato expuesto.

## Fuera de alcance (backlog)

No forman parte del QA actual. No implementar ahora:

- Diseño **A4** en pantalla.
- 4-up A6 sobre A4.
- Media Carta.
- Dos-up secuencial (hojas distintas lado a lado, sin duplicar ni cuadernillo).
- Creep, marcas de corte y sangrado.
- PDF vectorial puro (la exportación actual rasteriza a PNG).
- Quitar `window.print()`.
- Impresión del catálogo `/`.
- daisyUI dentro de `.sheet`.
