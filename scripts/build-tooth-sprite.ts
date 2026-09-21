import { atlasToUserSpace, splitSubpaths, subpathBBox } from '../src/lib/tooth-sprite/path-data';

const TOLERANCE_PX = 2;

export type SpriteBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rect: [number, number, number, number];
};

type SpriteCoordinates = {
  elements: SpriteBox[];
};

export type ToothSymbol = {
  viewBox: string;
  outline: string[];
  solid: string[];
};

export type AtlasAssignment = {
  symbols: Record<string, ToothSymbol>;
  assigned: number;
  omitted: number;
  empty: string[];
  ambiguous: number;
};

const EXPECTED_SYMBOL_COUNT = 64;

const root = `${import.meta.dir}/..`;
const svgPath = `${root}/raw/pagina-periortograma/icons-003-permanent.svg`;
const jsonPath = `${root}/raw/pagina-periortograma/icons-003-permanent-coordinates.json`;
const outPath = `${root}/src/lib/tooth-sprite/symbols.generated.ts`;

export function extractPathD(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path\b[^>]*\bd="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) {
    paths.push(match[1] ?? '');
  }
  return paths;
}

function normalizeD(d: string): string {
  return d.replace(/[\s,]+/g, ' ').trim();
}

function boxContains(box: SpriteBox, pathBox: { x: number; y: number; w: number; h: number }): boolean {
  return (
    pathBox.x >= box.x - TOLERANCE_PX &&
    pathBox.y >= box.y - TOLERANCE_PX &&
    pathBox.x + pathBox.w <= box.x + box.width + TOLERANCE_PX &&
    pathBox.y + pathBox.h <= box.y + box.height + TOLERANCE_PX
  );
}

function emitSymbols(symbols: Record<string, ToothSymbol>): string {
  const lines = [
    '// Generado por scripts/build-tooth-sprite.ts. No editar a mano.',
    '// Regenerar: bun run sprite:teeth',
    '',
    'export const TOOTH_SYMBOLS: Record<string, { viewBox: string; outline: string[]; solid: string[] }> = {',
  ];

  for (const [id, symbol] of Object.entries(symbols)) {
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    viewBox: ${JSON.stringify(symbol.viewBox)},`);
    lines.push('    outline: [');
    for (const d of symbol.outline) {
      lines.push(`      ${JSON.stringify(d)},`);
    }
    lines.push('    ],');
    lines.push('    solid: [');
    for (const d of symbol.solid) {
      lines.push(`      ${JSON.stringify(d)},`);
    }
    lines.push('    ],');
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function snippet(d: string): string {
  const compact = normalizeD(d);
  return compact.length > 80 ? `${compact.slice(0, 80)}…` : compact;
}

export function assignAtlas(
  paths: string[],
  boxes: SpriteBox[],
  indexOffset = 0,
  log = true,
): AtlasAssignment {
  const assigned = new Map<string, string[]>();
  for (const box of boxes) {
    assigned.set(box.id, []);
  }

  let omitted = 0;
  let ambiguous = 0;

  for (const [index, raw] of paths.entries()) {
    const userBox = atlasToUserSpace(subpathBBox(raw));
    const hits = boxes.filter((box) => boxContains(box, userBox));

    if (hits.length !== 1) {
      omitted += 1;
      if (hits.length > 1) {
        ambiguous += 1;
      }
      const reason =
        hits.length === 0
          ? 'no cae en ninguna caja'
          : `cae en ${hits.length} cajas (${hits.map((box) => box.id).join(', ')})`;
      if (log) {
        console.error(`path omitido [${index + indexOffset}]: ${reason} — ${snippet(raw)}`);
      }
      continue;
    }

    assigned.get(hits[0]!.id)!.push(raw);
  }

  const symbols: Record<string, ToothSymbol> = {};
  const empty: string[] = [];

  for (const box of boxes) {
    const outline = (assigned.get(box.id) ?? []).map(normalizeD);
    const solid = (assigned.get(box.id) ?? []).map((raw) => {
      const first = splitSubpaths(raw)[0];
      return normalizeD(first ?? raw);
    });

    if (outline.length === 0) {
      empty.push(box.id);
    }

    symbols[box.id] = {
      viewBox: box.rect.join(' '),
      outline,
      solid,
    };
  }

  return { symbols, assigned: paths.length - omitted, omitted, empty, ambiguous };
}

async function readAtlas(svgFile: string, jsonFile: string): Promise<{ paths: string[]; boxes: SpriteBox[] }> {
  if (!(await Bun.file(svgFile).exists()) || !(await Bun.file(jsonFile).exists())) {
    throw new Error(`falta el atlas ${svgFile} o ${jsonFile}`);
  }

  const svg = await Bun.file(svgFile).text();
  const coords = (await Bun.file(jsonFile).json()) as SpriteCoordinates;
  return { paths: extractPathD(svg), boxes: coords.elements };
}

async function main(): Promise<void> {
  const atlas = await readAtlas(svgPath, jsonPath);
  const result = assignAtlas(atlas.paths, atlas.boxes);
  const ids = Object.keys(result.symbols);

  if (result.empty.length > 0) {
    console.error(`cajas sin paths: ${result.empty.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (result.ambiguous > 0) {
    console.error(`asignación ambigua: ${result.ambiguous} paths caen en varias cajas`);
    process.exitCode = 1;
    return;
  }

  if (ids.length !== EXPECTED_SYMBOL_COUNT) {
    console.error(`se esperaban ${EXPECTED_SYMBOL_COUNT} símbolos, hay ${ids.length}`);
    process.exitCode = 1;
    return;
  }

  await Bun.write(outPath, emitSymbols(result.symbols));

  console.log(
    `${ids.length} símbolos, ${result.assigned} paths asignados, ${result.omitted} omitidos → ${outPath}`,
  );
}

if (import.meta.main) {
  await main();
}
