/**
 * A* simples em grid 4-direções para mover agentes até os assentos da reunião.
 * `blocked` é uma matriz [y][x] booleana (true = intransponível).
 */
export interface GridPoint {
  x: number;
  y: number;
}

export function findPath(
  blocked: boolean[][],
  start: GridPoint,
  goal: GridPoint,
): GridPoint[] {
  const h = blocked.length;
  const w = blocked[0]?.length ?? 0;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const key = (x: number, y: number) => `${x},${y}`;
  // Permite o destino mesmo se marcado como bloqueado (assento pode coincidir com móvel).
  const passable = (x: number, y: number) =>
    inBounds(x, y) && (!blocked[y][x] || (x === goal.x && y === goal.y));

  const manhattan = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  const open = new Map<string, GridPoint>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();

  const sk = key(start.x, start.y);
  open.set(sk, start);
  gScore.set(sk, 0);
  fScore.set(sk, manhattan(start, goal));

  while (open.size > 0) {
    // nó com menor fScore
    let currentKey = '';
    let best = Infinity;
    for (const k of open.keys()) {
      const f = fScore.get(k) ?? Infinity;
      if (f < best) {
        best = f;
        currentKey = k;
      }
    }
    const current = open.get(currentKey)!;
    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(cameFrom, currentKey);
    }
    open.delete(currentKey);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const n of neighbors) {
      if (!passable(n.x, n.y)) continue;
      const nk = key(n.x, n.y);
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, currentKey);
        gScore.set(nk, tentative);
        fScore.set(nk, tentative + manhattan(n, goal));
        if (!open.has(nk)) open.set(nk, n);
      }
    }
  }
  return []; // sem caminho
}

function reconstruct(cameFrom: Map<string, string>, endKey: string): GridPoint[] {
  const path: GridPoint[] = [];
  let k: string | undefined = endKey;
  while (k) {
    const [x, y] = k.split(',').map(Number);
    path.unshift({ x, y });
    k = cameFrom.get(k);
  }
  return path;
}
