# Diente Dientitos

Diente Dientitos es un sitio estático en [Astro](https://astro.build) de ficheros odontológicos imprimibles (expedientes, Rx/Tx, eventos y diagrama dental) para rellenar a mano o descargar en PDF. El catálogo (`/`) es la portada de marca y no se imprime: cada formato sale en una sola hoja. Antes de elegir formato, el catálogo muestra un aviso de plantilla no homologada (`UsageNotice`); ese aviso no entra en la hoja clínica ni en el PDF. daisyUI solo se usa en la navegación y la configuración en pantalla; no forma parte de las hojas clínicas.

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

## Páginas legales

Astro está configurado con `trailingSlash: always`: estas rutas llevan barra final.

| Ruta | Página |
| --- | --- |
| `/aviso-legal/` | Aviso legal |
| `/politica-de-privacidad/` | Política de privacidad |
| `/cookies/` | Cookies |
| `/preguntas-frecuentes/` | Preguntas frecuentes |

## Variable `PUBLIC_GITHUB_URL`

Opcional. Solo se acepta una URL **HTTPS** cuyo host sea exactamente `github.com`. El formato está documentado en [`.env.example`](.env.example). Si la variable falta, está vacía o no cumple esa regla, el sitio **oculta** el enlace a GitHub y muestra el correo de contacto.

En Netlify: **Site settings → Environment variables** → `PUBLIC_GITHUB_URL`. Las variables con prefijo `PUBLIC_` se inyectan en **tiempo de compilación**; hay que reconstruir el sitio (`rebuild`) después de cambiarla. No configures una URL de repositorio inventada.

## Analítica

La analítica permitida **hoy** es **Netlify Web Analytics**: procede de los registros (logs) de la CDN, sin JavaScript de cliente ni cookies. **Umami no está integrado**. Antes de activar Umami u otro proveedor hay que actualizar la política de privacidad y la página de cookies publicadas.

## Documentación editorial

El sistema de tokens, dimensiones y responsabilidades de componentes está en [`docs/sistema-editorial.md`](docs/sistema-editorial.md).

## Licencia

Este proyecto se distribuye bajo la [Apache License 2.0](LICENSE) (`Apache-2.0`). El aviso de atribución está en [`NOTICE`](NOTICE) (`Copyright 2026 Agustin`). Puedes usarlo, modificarlo y redistribuirlo, incluso con fines comerciales, siempre que conserves el aviso de copyright y una copia de la licencia.
