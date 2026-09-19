export type PathBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const ATLAS_HEIGHT = 887;
const ATLAS_SCALE = 0.1;

const ARITY: Record<string, number> = {
  M: 2,
  m: 2,
  L: 2,
  l: 2,
  C: 6,
  c: 6,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  Z: 0,
  z: 0,
};

type Token =
  | { kind: 'cmd'; cmd: string; start: number; end: number }
  | { kind: 'num'; value: number; start: number; end: number };

type ParsedCmd = {
  cmd: string;
  params: number[];
  start: number;
  end: number;
};

type Point = [number, number];

type Bounds = {
  has: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function isCommand(ch: string): boolean {
  return 'MmCcLlHhVvZz'.includes(ch);
}

function isSeparator(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',';
}

const NUMBER_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

function readNumber(d: string, start: number): { value: number; end: number } | null {
  NUMBER_RE.lastIndex = start;
  const match = NUMBER_RE.exec(d);
  if (!match || match.index !== start) {
    return null;
  }

  const value = Number.parseFloat(match[0]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return { value, end: start + match[0].length };
}

function tokenize(d: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < d.length) {
    const ch = d[i]!;
    if (isSeparator(ch)) {
      i++;
      continue;
    }

    if (isCommand(ch)) {
      tokens.push({ kind: 'cmd', cmd: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    const num = readNumber(d, i);
    if (num) {
      tokens.push({ kind: 'num', value: num.value, start: i, end: num.end });
      i = num.end;
      continue;
    }

    i++;
  }

  return tokens;
}

function parseCommands(d: string): ParsedCmd[] {
  const tokens = tokenize(d);
  const cmds: ParsedCmd[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (tok.kind !== 'cmd') {
      i++;
      continue;
    }

    const rawCmd = tok.cmd;
    i++;

    if (rawCmd === 'Z' || rawCmd === 'z') {
      cmds.push({ cmd: rawCmd, params: [], start: tok.start, end: tok.end });
      continue;
    }

    const arity = ARITY[rawCmd];
    if (arity === undefined) {
      continue;
    }

    let first = true;
    while (i < tokens.length && tokens[i]!.kind === 'num') {
      let cmd = rawCmd;
      if (!first && rawCmd === 'M') {
        cmd = 'L';
      } else if (!first && rawCmd === 'm') {
        cmd = 'l';
      }

      const groupStart = first ? tok.start : tokens[i]!.start;
      const params: number[] = [];
      for (let k = 0; k < arity; k++) {
        const next = tokens[i];
        if (!next || next.kind !== 'num') {
          break;
        }
        params.push(next.value);
        i++;
      }

      if (params.length !== arity) {
        break;
      }

      cmds.push({
        cmd,
        params,
        start: groupStart,
        end: tokens[i - 1]!.end,
      });
      first = false;
    }
  }

  return cmds;
}

function createBounds(): Bounds {
  return { has: false, minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

function addPoint(bounds: Bounds, x: number, y: number): void {
  if (!bounds.has) {
    bounds.has = true;
    bounds.minX = x;
    bounds.maxX = x;
    bounds.minY = y;
    bounds.maxY = y;
    return;
  }

  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0],
    mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1],
  ];
}

function addCubic(bounds: Bounds, p0: Point, p1: Point, p2: Point, p3: Point): void {
  addPoint(bounds, p0[0], p0[1]);
  addPoint(bounds, p3[0], p3[1]);

  for (const axis of [0, 1] as const) {
    const a = -p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis];
    const b = 2 * p0[axis] - 4 * p1[axis] + 2 * p2[axis];
    const c = -p0[axis] + p1[axis];
    const roots: number[] = [];

    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) {
        roots.push(-c / b);
      }
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        roots.push((-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a));
      }
    }

    for (const t of roots) {
      if (t > 0 && t < 1) {
        const [x, y] = bezier(p0, p1, p2, p3, t);
        addPoint(bounds, x, y);
      }
    }
  }
}

export function splitSubpaths(d: string): string[] {
  const cmds = parseCommands(d);
  if (cmds.length === 0) {
    return [];
  }

  const slices: Array<{ start: number; end: number }> = [];
  let start = cmds[0]!.start;
  let end = cmds[0]!.end;

  for (let i = 1; i < cmds.length; i++) {
    const cmd = cmds[i]!;
    if (cmd.cmd === 'M' || cmd.cmd === 'm') {
      slices.push({ start, end });
      start = cmd.start;
    }
    end = cmd.end;
  }

  slices.push({ start, end });
  return slices.map((slice) => d.slice(slice.start, slice.end).trim()).filter((part) => part.length > 0);
}

export function subpathBBox(d: string): PathBBox {
  const cmds = parseCommands(d);
  const bounds = createBounds();
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of cmds) {
    switch (cmd.cmd) {
      case 'M': {
        x = cmd.params[0]!;
        y = cmd.params[1]!;
        startX = x;
        startY = y;
        addPoint(bounds, x, y);
        break;
      }
      case 'm': {
        x += cmd.params[0]!;
        y += cmd.params[1]!;
        startX = x;
        startY = y;
        addPoint(bounds, x, y);
        break;
      }
      case 'L': {
        x = cmd.params[0]!;
        y = cmd.params[1]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'l': {
        x += cmd.params[0]!;
        y += cmd.params[1]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'H': {
        x = cmd.params[0]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'h': {
        x += cmd.params[0]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'V': {
        y = cmd.params[0]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'v': {
        y += cmd.params[0]!;
        addPoint(bounds, x, y);
        break;
      }
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = cmd.params;
        addCubic(bounds, [x, y], [x1!, y1!], [x2!, y2!], [x3!, y3!]);
        x = x3!;
        y = y3!;
        break;
      }
      case 'c': {
        const [dx1, dy1, dx2, dy2, dx, dy] = cmd.params;
        addCubic(
          bounds,
          [x, y],
          [x + dx1!, y + dy1!],
          [x + dx2!, y + dy2!],
          [x + dx!, y + dy!],
        );
        x += dx!;
        y += dy!;
        break;
      }
      case 'Z':
      case 'z': {
        x = startX;
        y = startY;
        break;
      }
    }
  }

  if (!bounds.has) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    w: bounds.maxX - bounds.minX,
    h: bounds.maxY - bounds.minY,
  };
}

export function atlasToUserSpace(bbox: PathBBox): PathBBox {
  const maxY = bbox.y + bbox.h;
  return {
    x: bbox.x * ATLAS_SCALE,
    y: ATLAS_HEIGHT - maxY * ATLAS_SCALE,
    w: bbox.w * ATLAS_SCALE,
    h: bbox.h * ATLAS_SCALE,
  };
}
