# Formatos odontológicos imprimibles

Sitio estático en [Astro](https://astro.build) para cuatro documentos clínicos independientes, pensados para escritura a mano e impresión. El índice no forma parte del expediente: cada formato se imprime por separado. daisyUI solo se usa en la navegación y la configuración en pantalla; no forma parte de las hojas clínicas.

## Requisitos

- [Bun](https://bun.com) 1.3 o superior. Es el **único** gestor de paquetes y ejecutor de este proyecto.
- No uses `npm`, `npx`, `yarn`, `pnpm` ni `node`.

Soporte oficial de Astro con Bun: [Use Bun with Astro](https://docs.astro.build/en/recipes/bun/).

## Instalación

```bash
bun install
```

## Comandos

| Comando | Descripción |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun run build` | Genera el sitio estático en `dist/` |
| `bun run preview` | Previsualiza la salida de `dist/` |
| `bun run check` | Comprueba TypeScript y las props de los componentes Astro |
| `bun run test:e2e` | Pruebas Playwright de impresión y exportación PDF |

## Rutas

| Ruta | Documento | Código |
| --- | --- | --- |
| `/` | Catálogo de previsualización (no imprimible) | — |
| `/formatos/expedientes/` | Expedientes / Folios | `ODO-F01` |
| `/formatos/paciente-rx-tx/` | Paciente · Rx / Tx / Notas | `ODO-F02` |
| `/formatos/eventos/` | Eventos | `ODO-F03` |
| `/formatos/paciente-imagen/` | Paciente · diagrama dental, leyenda y notas | `ODO-F04` |

Cada ruta de formato es **una sola hoja vertical**. En la barra elige el **diseño**: **Carta** (215,9 × 279,4 mm, predeterminado), **A5** (148 × 210 mm) o **A6** (105 × 148 mm). El margen seguro se reduce de forma proporcional (12 mm en Carta, 8 mm en A5, 5,5 mm en A6). A4 no es un diseño en pantalla: es un **papel de salida** del PDF (Opciones → duplicar o cuadernillo, p. ej. A5 sobre A4). **Descargar PDF** usa esos ajustes; **Imprimir hoja** sigue imprimiendo solo la hoja en pantalla.

## Documentación editorial

El sistema de tokens, dimensiones y responsabilidades de componentes está en [`docs/sistema-editorial.md`](docs/sistema-editorial.md).
