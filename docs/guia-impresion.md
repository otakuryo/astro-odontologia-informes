# Guía de impresión

Protocolo de control de calidad para los cuatro formatos clínicos (ODO-F01 a ODO-F04). La fidelidad en milímetros, el espacio de pluma y el resultado en fotocopia **no** se cubren con pruebas unitarias: hay que imprimir de verdad.

## Antes de imprimir

- Papel **Carta** (215,9 × 279,4 mm), orientación **vertical**.
- Escala **100 %**. No use «ajustar a la página», «encajar» ni ningún zoom del diálogo de impresión.
- **Desactive** las cabeceras y los pies automáticos del navegador (fecha, título, URL, número de página del sistema). El documento ya lleva pie propio (`ODO-F0n`, `REV. 01`, `1/1`).
- Margen del diálogo: si el navegador lo ofrece, deje el margen al mínimo o en «ninguno»; el margen seguro de **12 mm** va dibujado en la hoja.
- Una sola hoja por formato. **No imprima el catálogo** (`/`). Esa página es solo un índice en pantalla.

## Rutas

| Código | Ruta | Contenido |
| --- | --- | --- |
| ODO-F01 | `/formatos/expedientes/` | Expedientes / folios |
| ODO-F02 | `/formatos/paciente-rx-tx/` | Paciente, Rx, Tx, notas |
| ODO-F03 | `/formatos/eventos/` | Cuatro paneles de evento |
| ODO-F04 | `/formatos/paciente-imagen/` | Imagen y leyenda R/A/V/O |

Cada ruta genera exactamente **1/1**. No hay paginación clínica.

## Navegadores de QA

Pruebe cada formato en:

1. **Chromium** (Chrome, Edge u otro basado en Chromium)
2. **Safari**

En ambos, abra el formato, pulse Imprimir y siga el protocolo de abajo. No suba `@playwright/test` por encima de 1.61.1 en este proyecto: Chromium de 1.62 no se instala en macOS 13.

## Protocolo (cada formato, cada navegador)

Haga las dos pasadas, en este orden:

1. **PDF** — Imprimir → Guardar como PDF (o «Abrir en Vista Previa» en Safari). Abra el PDF y compruebe que hay **una sola página** Carta.
2. **Impresora real** — La misma hoja, primero a **color** y después a **escala de grises** (o fotocopia monocroma del PDF).

### Lista de comprobación

- [ ] Una hoja exacta; no hay segunda página en blanco ni recorte a media hoja.
- [ ] Escala 100 %: la hoja coincide con Carta; no está encogida ni ampliada.
- [ ] Cabeceras y pies del navegador ausentes.
- [ ] Margen seguro de 12 mm respetado en los cuatro lados; nada de trazo ni texto pegado al borde del papel.
- [ ] Bordes de paneles, casillas y marcadores visibles; no recortados.
- [ ] Líneas de escritura con espacio de pluma suficiente (campos de cabecera, folios, notas, equivalencias).
- [ ] Códigos `ODO-F01` … `ODO-F04`, `REV. 01` y `1/1` legibles en el pie.
- [ ] En ODO-F04, la leyenda se distingue **sin color**: **R** sólido, **A** rayado diagonal, **V** puntos, **O** círculo vacío, más las siglas. El color es un refuerzo, no el único canal.
- [ ] Sombra de pantalla y botón «Imprimir hoja» no aparecen en el papel ni en el PDF.

## Revisión médica

Antes de usar estos formatos en consulta, un profesional clínico debe revisar textos, recuentos, leyenda y flujo de escritura. Hasta esa validación, las hojas son maquetas de trabajo, no un expediente homologado.

## Datos de pacientes (demo)

**No introduzca datos reales de pacientes** en esta demostración. No hay autenticación, cifrado, consentimiento informado ni retención controlada. Cualquier anotación en una captura, PDF o impresora compartida se considera dato expuesto.

## Fuera de alcance (decidido)

- Formato **A4**.
- Impresión conjunta de los cuatro formatos en un solo trabajo.
- Generación **programática de PDF** (la salida es la impresión del navegador).

Esas variantes no forman parte del QA actual.
