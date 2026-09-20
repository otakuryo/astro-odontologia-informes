import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atlasToUserSpace, splitSubpaths, subpathBBox } from '../src/lib/tooth-sprite/path-data';

export type HatchBBox = {
  h: number;
  w: number;
};

const ATLAS_WIDTH = 1774;
const ATLAS_HEIGHT = 887;
const THRESHOLD_PCT = '70%';
const TEMPLATE_CROP_X = 100;
const TEMPLATE_CROP_W = 64;
const LEFT_X = 8;

type M3Id = 'upper_tooth_profiles_m3' | 'upper_occlusal_m3' | 'lower_tooth_profiles_m3' | 'lower_occlusal_m3';

type GlyphSpec = {
  id: M3Id;
  category: string;
  cropY: number;
  cropH: number;
  targetH: number;
  flipY: boolean;
  placeY: number;
};

const GLYPHS: readonly GlyphSpec[] = [
  {
    id: 'upper_tooth_profiles_m3',
    category: 'upper_tooth_profiles',
    cropY: 255,
    cropH: 95,
    targetH: 165,
    flipY: false,
    placeY: 51,
  },
  {
    id: 'upper_occlusal_m3',
    category: 'upper_occlusal',
    cropY: 345,
    cropH: 58,
    targetH: 97,
    flipY: false,
    placeY: 231,
  },
  {
    id: 'lower_tooth_profiles_m3',
    category: 'lower_tooth_profiles',
    cropY: 926,
    cropH: 95,
    targetH: 170,
    flipY: true,
    placeY: 345,
  },
  {
    id: 'lower_occlusal_m3',
    category: 'lower_occlusal',
    cropY: 878,
    cropH: 58,
    targetH: 86,
    flipY: true,
    placeY: 537,
  },
];

export function isHatchFragment(bbox: HatchBBox): boolean {
  return bbox.h <= 4 && bbox.w >= 15;
}

function targetWidth(spec: GlyphSpec): number {
  return Math.round((TEMPLATE_CROP_W * spec.targetH) / spec.cropH);
}

async function run(cmd: string, args: string[]): Promise<void> {
  const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    const detail = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    throw new Error(`${cmd} ${args.join(' ')} falló (${code})${detail ? `\n${detail}` : ''}`);
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  const proc = Bun.spawn(['which', cmd], { stdout: 'pipe', stderr: 'pipe' });
  return (await proc.exited) === 0;
}

function stripHatchFromD(d: string): string | null {
  const kept = splitSubpaths(d).filter((part) => !isHatchFragment(atlasToUserSpace(subpathBBox(part))));
  if (kept.length === 0) {
    return null;
  }
  return kept.join(' ');
}

function filterHatchInSvg(svg: string): string {
  return svg.replace(/<path\b([^>]*?)\bd="([^"]*)"/g, (full, attrs: string, d: string) => {
    const cleaned = stripHatchFromD(d);
    if (!cleaned) {
      return `<!-- hatch omitido -->`;
    }
    if (cleaned === d) {
      return full;
    }
    return `<path${attrs}d="${cleaned}"`;
  });
}

function wrapPotraceSvg(pathMarkup: string): string {
  return `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="${ATLAS_WIDTH}.000000pt" height="${ATLAS_HEIGHT}.000000pt" viewBox="0 0 ${ATLAS_WIDTH}.000000 ${ATLAS_HEIGHT}.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,${ATLAS_HEIGHT}.000000) scale(0.100000,-0.100000)"
fill="#000000" stroke="none">
${pathMarkup}
</g>
</svg>
`;
}

function toPotracePoint(x: number, y: number): [number, number] {
  return [Math.round(x * 10), Math.round((ATLAS_HEIGHT - y) * 10)];
}

function polygonToPath(points: Array<[number, number]>): string {
  if (points.length < 3) {
    return '';
  }
  const cmds = points.map(([x, y], index) => {
    const [px, py] = toPotracePoint(x, y);
    return `${index === 0 ? 'M' : 'L'}${px} ${py}`;
  });
  return `${cmds.join(' ')} Z`;
}

function loadPgm(buffer: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  let offset = 0;
  const readLine = (): string => {
    let line = '';
    while (offset < buffer.length) {
      const ch = buffer[offset++]!;
      if (ch === 10) {
        break;
      }
      if (ch !== 13) {
        line += String.fromCharCode(ch);
      }
    }
    return line;
  };

  const magic = readLine();
  if (magic !== 'P5') {
    throw new Error(`PGM no soportado: ${magic}`);
  }

  let header = readLine();
  while (header.startsWith('#')) {
    header = readLine();
  }
  const [width, height] = header.split(/\s+/).map(Number);
  const maxVal = Number.parseInt(readLine(), 10);
  if (!width || !height || !Number.isFinite(maxVal)) {
    throw new Error('cabecera PGM inválida');
  }

  return { width, height, pixels: buffer.subarray(offset, offset + width * height) };
}

function isInk(pixels: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }
  return pixels[y * width + x]! < 128;
}

const MOORE_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const MOORE_DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const MIN_COMPONENT_PIXELS = 40;

function floodComponent(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  seen: Uint8Array,
): Array<[number, number]> {
  const stack: Array<[number, number]> = [[startX, startY]];
  const cells: Array<[number, number]> = [];
  seen[startY * width + startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    cells.push([x, y]);
    for (let i = 0; i < 8; i++) {
      const nx = x + MOORE_DX[i]!;
      const ny = y + MOORE_DY[i]!;
      if (!isInk(pixels, width, height, nx, ny)) {
        continue;
      }
      const index = ny * width + nx;
      if (seen[index]) {
        continue;
      }
      seen[index] = 1;
      stack.push([nx, ny]);
    }
  }

  return cells;
}

function topLeftCell(cells: Array<[number, number]>): [number, number] {
  let best = cells[0]!;
  for (const cell of cells) {
    if (cell[1] < best[1] || (cell[1] === best[1] && cell[0] < best[0])) {
      best = cell;
    }
  }
  return best;
}

function traceMoore(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
): Array<[number, number]> {
  const contour: Array<[number, number]> = [[startX, startY]];
  let x = startX;
  let y = startY;
  let back = 6;

  for (let step = 0; step < width * height; step++) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dir = (back + i) % 8;
      const nx = x + MOORE_DX[dir]!;
      const ny = y + MOORE_DY[dir]!;
      if (!isInk(pixels, width, height, nx, ny)) {
        continue;
      }
      x = nx;
      y = ny;
      back = (dir + 5) % 8;
      found = true;
      break;
    }

    if (!found) {
      break;
    }
    if (x === startX && y === startY) {
      break;
    }
    contour.push([x, y]);
  }

  return contour;
}

function traceAtlasContours(pixels: Uint8Array, width: number, height: number): string[] {
  const seen = new Uint8Array(width * height);
  const paths: string[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (seen[index] || !isInk(pixels, width, height, x, y)) {
        continue;
      }

      const cells = floodComponent(pixels, width, height, x, y, seen);
      if (cells.length < MIN_COMPONENT_PIXELS) {
        continue;
      }

      const [sx, sy] = topLeftCell(cells);
      const d = polygonToPath(traceMoore(pixels, width, height, sx, sy));
      if (!d) {
        continue;
      }
      const cleaned = stripHatchFromD(d);
      if (cleaned) {
        paths.push(cleaned);
      }
    }
  }

  return paths;
}

function rectPath(x: number, y: number, w: number, h: number): string {
  const [x0, yTop] = toPotracePoint(x, y);
  const [x1, yBot] = toPotracePoint(x + w, y + h);
  return `M${x0} ${yBot} L${x1} ${yBot} L${x1} ${yTop} L${x0} ${yTop} Z`;
}

async function removeHatch(src: string, dest: string, work: string): Promise<void> {
  const ink = join(work, 'ink.png');
  const hatch = join(work, 'hatch.png');
  const core = join(work, 'core.png');
  const halo = join(work, 'halo.png');
  const away = join(work, 'away.png');

  await run('magick', [src, '-colorspace', 'Gray', '-threshold', THRESHOLD_PCT, '-negate', ink]);
  await run('magick', [ink, '-morphology', 'Open', 'Rectangle:15x1', hatch]);
  await run('magick', [ink, hatch, '-compose', 'Minus_Src', '-composite', core]);
  await run('magick', [core, '-morphology', 'Dilate', 'Disk:2', halo]);
  await run('magick', [hatch, halo, '-compose', 'Minus_Src', '-composite', away]);
  await run('magick', [ink, away, '-compose', 'Minus_Src', '-composite', '-negate', dest]);
}

async function vectorizeWithPotrace(pngPath: string, svgPath: string, work: string): Promise<void> {
  const pbm = join(work, 'atlas.pbm');
  await run('magick', [pngPath, '-threshold', '50%', pbm]);
  await run('potrace', [pbm, '-s', '-o', svgPath]);
  const svg = filterHatchInSvg(await Bun.file(svgPath).text());
  await Bun.write(svgPath, svg);
}

async function vectorizeFallback(pngPath: string, svgPath: string, work: string, boxes: SpriteBox[]): Promise<void> {
  const pgm = join(work, 'atlas.pgm');
  await run('magick', [pngPath, '-colorspace', 'Gray', '-depth', '8', '-threshold', '50%', pgm]);
  const { width, height, pixels } = loadPgm(new Uint8Array(await Bun.file(pgm).arrayBuffer()));
  let paths = traceAtlasContours(pixels, width, height);

  if (paths.length === 0) {
    console.error('aviso: el trazado de reserva no encontró contornos; se emiten rectángulos de caja');
    paths = boxes.map((box) => rectPath(box.x, box.y, box.width, box.height));
  }

  const markup = paths.map((d) => `<path d="${d}"/>`).join('\n');
  await Bun.write(svgPath, wrapPotraceSvg(markup));
}

type SpriteBox = {
  id: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rect: [number, number, number, number];
};

async function main(): Promise<void> {
  const root = `${import.meta.dir}/..`;
  const template = `${root}/raw/pagina-periortograma/tpl-001.png`;
  const pngOut = `${root}/raw/pagina-periortograma/icons-002.png`;
  const svgOut = `${root}/raw/pagina-periortograma/icons-002.svg`;
  const jsonOut = `${root}/raw/pagina-periortograma/icons-002-coordinates.json`;

  if (!(await Bun.file(template).exists())) {
    throw new Error(`no está la plantilla: ${template}`);
  }
  if (!(await commandExists('magick'))) {
    throw new Error('ImageMagick `magick` no está en PATH');
  }

  const work = await mkdtemp(join(tmpdir(), 'm3-atlas-'));
  const boxes: SpriteBox[] = [];

  try {
    const canvas = join(work, 'canvas.png');
    await run('magick', ['-size', `${ATLAS_WIDTH}x${ATLAS_HEIGHT}`, 'xc:white', canvas]);

    for (const spec of GLYPHS) {
      const crop = join(work, `${spec.id}-crop.png`);
      const cleaned = join(work, `${spec.id}-clean.png`);
      const glyph = join(work, `${spec.id}-glyph.png`);
      const glyphWork = join(work, spec.id);
      const width = targetWidth(spec);
      await mkdir(glyphWork, { recursive: true });

      await run('magick', [
        template,
        '-crop',
        `${TEMPLATE_CROP_W}x${spec.cropH}+${TEMPLATE_CROP_X}+${spec.cropY}`,
        '+repage',
        crop,
      ]);
      await removeHatch(crop, cleaned, glyphWork);

      const resizeArgs = [cleaned, '-resize', `${width}x${spec.targetH}!`];
      if (spec.flipY) {
        resizeArgs.push('-flip');
      }
      resizeArgs.push(glyph);
      await run('magick', resizeArgs);

      await run('magick', [
        canvas,
        glyph,
        '-geometry',
        `+${LEFT_X}+${spec.placeY}`,
        '-compose',
        'Over',
        '-composite',
        canvas,
      ]);

      boxes.push({
        id: spec.id,
        category: spec.category,
        x: LEFT_X,
        y: spec.placeY,
        width,
        height: spec.targetH,
        rect: [LEFT_X, spec.placeY, width, spec.targetH],
      });
    }

    await run('magick', [canvas, pngOut]);

    const hasPotrace = await commandExists('potrace');
    if (hasPotrace) {
      await vectorizeWithPotrace(pngOut, svgOut, work);
      console.log(`icons-002.svg vectorizado con potrace → ${svgOut}`);
    } else {
      console.error(
        'bloqueo: `potrace` no está en PATH. No se instala software del sistema. Se genera un SVG de contorno de reserva para poder fusionar el atlas; no es salida de potrace. Instala potrace (p. ej. brew install potrace) y vuelve a ejecutar: bun run scripts/build-m3-atlas.ts',
      );
      await vectorizeFallback(pngOut, svgOut, work, boxes);
    }

    const coordinates = {
      sprite_sheet: {
        file: 'icons-002.png',
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
        coordinate_system: 'origin_top_left',
        rect_format: '[x, y, width, height]',
      },
      elements: boxes,
      categories: {
        upper_tooth_profiles: 1,
        upper_occlusal: 1,
        lower_tooth_profiles: 1,
        lower_occlusal: 1,
      },
    };

    await Bun.write(jsonOut, `${JSON.stringify(coordinates, null, 2)}\n`);
    console.log(`4 glifos M3 → ${pngOut}`);
    console.log(`cajas → ${jsonOut}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await main();
}
