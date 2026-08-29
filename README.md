# Formatos odontológicos imprimibles

Sitio estático en [Astro](https://astro.build) para cuatro documentos clínicos independientes, pensados para escritura a mano e impresión en hoja Carta. El índice no forma parte del expediente: cada formato se imprime por separado.

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
| `bun run test:e2e` | Reservado para las pruebas Playwright de impresión (aún no configuradas) |

## Rutas

| Ruta | Documento | Código |
| --- | --- | --- |
| `/` | Catálogo de previsualización (no imprimible) | — |
| `/formatos/expedientes/` | Expedientes / Folios | `ODO-F01` |
| `/formatos/paciente-rx-tx/` | Paciente · Rx / Tx / Notas | `ODO-F02` |
| `/formatos/eventos/` | Eventos | `ODO-F03` |
| `/formatos/paciente-imagen/` | Paciente · Imagen y leyenda | `ODO-F04` |

Cada ruta de formato imprime **una sola hoja Carta vertical** (215,9 × 279,4 mm) con 12 mm de margen seguro.

## Documentación editorial

El sistema de tokens, dimensiones y responsabilidades de componentes está en [`docs/sistema-editorial.md`](docs/sistema-editorial.md).
