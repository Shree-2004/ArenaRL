import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Game2048Props {
  playerNumber: 1 | 2;
  onGameEnd?: (score: number) => void;
  agentControlled?: boolean;
  agentAction?: 'up' | 'down' | 'left' | 'right' | null;
  isFullscreen?: boolean;
  autoStart?: boolean;
  onPlayAgain?: () => void;
  onMove?: (reasoning: string) => void;
}

const GRID_SIZE = 4;

// Vibrant HSL-based tile colors
const TILE_STYLES: Record<number, { bg: string; fg: string; glow?: string }> = {
  2: { bg: '#f1f0e8', fg: '#776e65' },
  4: { bg: '#ede0c8', fg: '#776e65' },
  8: { bg: '#f2b179', fg: '#fff', glow: '#f2b17966' },
  16: { bg: '#f59563', fg: '#fff', glow: '#f5956366' },
  32: { bg: '#f67c5f', fg: '#fff', glow: '#f67c5f88' },
  64: { bg: '#f65e3b', fg: '#fff', glow: '#f65e3baa' },
  128: { bg: '#edcf72', fg: '#fff', glow: '#edcf72bb' },
  256: { bg: '#edcc61', fg: '#fff', glow: '#edcc61bb' },
  512: { bg: '#edc850', fg: '#fff', glow: '#edc850cc' },
  1024: { bg: '#edc53f', fg: '#fff', glow: '#edc53fdd' },
  2048: { bg: '#edc22e', fg: '#fff', glow: '#edc22eff' },
};

function getTileStyle(v: number) {
  return TILE_STYLES[v] || { bg: '#3c3a32', fg: '#fff', glow: '#ffffff44' };
}

function createGrid(): number[][] {
  const g = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
  addTile(g); addTile(g); return g;
}

function addTile(g: number[][]): boolean {
  const empty: [number, number][] = [];
  for (let i = 0; i < GRID_SIZE; i++) for (let j = 0; j < GRID_SIZE; j++) if (g[i][j] === 0) empty.push([i, j]);
  if (empty.length === 0) return false;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4; return true;
}

function canMove(g: number[][]): boolean {
  for (let i = 0; i < GRID_SIZE; i++)
    for (let j = 0; j < GRID_SIZE; j++) {
      if (g[i][j] === 0) return true;
      if (j < GRID_SIZE - 1 && g[i][j] === g[i][j + 1]) return true;
      if (i < GRID_SIZE - 1 && g[i][j] === g[i + 1][j]) return true;
    }
  return false;
}

export function Game2048({
  playerNumber, onGameEnd, agentControlled = false, agentAction,
  isFullscreen = false, autoStart = false, onPlayAgain, onMove,
}: Game2048Props) {
  const [grid, setGrid] = useState<number[][]>(() => createGrid());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isHumanTurn, setIsHumanTurn] = useState(true);

  const gridRef = useRef(grid);
  const movingRef = useRef(false);
  const scoreRef = useRef(score);
  const isHumanTurnRef = useRef(true);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { isHumanTurnRef.current = isHumanTurn; }, [isHumanTurn]);

  const slide = (arr: number[]): { result: number[], added: number } => {
    const f = arr.filter(x => x !== 0); const out: number[] = []; let added = 0; let i = 0;
    while (i < f.length) {
      if (i + 1 < f.length && f[i] === f[i + 1]) { out.push(f[i] * 2); added += f[i] * 2; i += 2; }
      else { out.push(f[i]); i++; }
    }
    while (out.length < GRID_SIZE) out.push(0);
    return { result: out, added };
  };

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right'): boolean => {
    if (movingRef.current) return false;
    movingRef.current = true;
    let didMove = false;
    setGrid(prev => {
      const g = prev.map(r => [...r]); let addScore = 0;
      if (dir === 'left') { for (let i = 0; i < GRID_SIZE; i++) { const { result, added } = slide(g[i]); if (result.join() !== g[i].join()) didMove = true; g[i] = result; addScore += added; } }
      else if (dir === 'right') { for (let i = 0; i < GRID_SIZE; i++) { const { result, added } = slide([...g[i]].reverse()); const r = result.reverse(); if (r.join() !== g[i].join()) didMove = true; g[i] = r; addScore += added; } }
      else if (dir === 'up') { for (let j = 0; j < GRID_SIZE; j++) { const { result, added } = slide(g.map(r => r[j])); if (result.join() !== g.map(r => r[j]).join()) didMove = true; for (let i = 0; i < GRID_SIZE; i++) g[i][j] = result[i]; addScore += added; } }
      else { for (let j = 0; j < GRID_SIZE; j++) { const col = g.map(r => r[j]).reverse(); const { result, added } = slide(col); const res = result.reverse(); const orig = g.map(r => r[j]); if (res.join() !== orig.join()) didMove = true; for (let i = 0; i < GRID_SIZE; i++) g[i][j] = res[i]; addScore += added; } }
      if (didMove) {
        addTile(g);
        setScore(s => { const ns = s + addScore; setBest(b => Math.max(b, ns)); scoreRef.current = ns; return ns; });
        if (!canMove(g)) { setGameOver(true); onGameEnd?.(scoreRef.current + addScore); }
      }
      movingRef.current = false; return didMove ? g : prev;
    });
    return didMove;
  }, [onGameEnd]);

  useEffect(() => { if (autoStart && !gameStarted && !gameOver) setGameStarted(true); }, [autoStart, gameStarted, gameOver]);

  // Human keyboard
  useEffect(() => {
    if (agentControlled || !gameStarted || gameOver) return;
    const keys = playerNumber === 1 ? { up: 'w', down: 's', left: 'a', right: 'd' } : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const down = (e: KeyboardEvent) => {
      if (!isHumanTurnRef.current) return;
      if (e.key === keys.up || e.key === keys.up.toUpperCase()) { e.preventDefault(); if (move('up')) setIsHumanTurn(false); }
      else if (e.key === keys.down || e.key === keys.down.toUpperCase()) { e.preventDefault(); if (move('down')) setIsHumanTurn(false); }
      else if (e.key === keys.left || e.key === keys.left.toUpperCase()) { e.preventDefault(); if (move('left')) setIsHumanTurn(false); }
      else if (e.key === keys.right || e.key === keys.right.toUpperCase()) { e.preventDefault(); if (move('right')) setIsHumanTurn(false); }
    };
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down);
  }, [agentControlled, playerNumber, gameStarted, gameOver, move]);

  const evalMove = useCallback((dir: 'up' | 'down' | 'left' | 'right', g: number[][]): number => {
    const test = g.map(r => [...r]); let sc = 0; let moved = false;
    const sl = (arr: number[]) => { const f = arr.filter(x => x !== 0); const out: number[] = []; let add = 0; let i = 0; while (i < f.length) { if (i + 1 < f.length && f[i] === f[i + 1]) { out.push(f[i] * 2); add += f[i] * 2; i += 2; } else { out.push(f[i]); i++; } } while (out.length < GRID_SIZE) out.push(0); return { out, add }; };
    if (dir === 'left') { for (let i = 0; i < GRID_SIZE; i++) { const { out, add } = sl(test[i]); if (out.join() !== test[i].join()) moved = true; sc += add; } }
    else if (dir === 'right') { for (let i = 0; i < GRID_SIZE; i++) { const { out, add } = sl([...test[i]].reverse()); if (out.join() !== [...test[i]].reverse().join()) moved = true; sc += add; } }
    else if (dir === 'up') { for (let j = 0; j < GRID_SIZE; j++) { const { out, add } = sl(test.map(r => r[j])); if (out.join() !== test.map(r => r[j]).join()) moved = true; sc += add; } }
    else { for (let j = 0; j < GRID_SIZE; j++) { const { out, add } = sl(test.map(r => r[j]).reverse()); if (out.join() !== test.map(r => r[j]).reverse().join()) moved = true; sc += add; } }
    if (!moved) return -1000;
    if (dir === 'down') sc += 50; if (dir === 'right') sc += 30;
    let empty = 0; for (let i = 0; i < GRID_SIZE; i++) for (let j = 0; j < GRID_SIZE; j++) if (test[i][j] === 0) empty++;
    return sc + empty * 10;
  }, []);

  // AI agent
  useEffect(() => {
    if (!agentControlled || !gameStarted || gameOver) return;
    const ai = setInterval(() => {
      if (movingRef.current) return;
      const g = gridRef.current;
      const dirs = ['down', 'right', 'left', 'up'] as const;
      let best = dirs[0]; let bestSc = -Infinity;
      for (const d of dirs) { const s = evalMove(d, g); if (s > bestSc) { bestSc = s; best = d; } }
      if (bestSc > -1000) { if (onMove) onMove(`2048 AI → ${best} (score: ${bestSc})`); move(best); }
    }, 300);
    return () => clearInterval(ai);
  }, [agentControlled, gameStarted, gameOver, move, evalMove, onMove]);

  // Human turn agent response
  useEffect(() => {
    if (agentControlled || !gameStarted || gameOver || isHumanTurn) return;
    const t = setTimeout(() => {
      if (movingRef.current) return;
      const g = gridRef.current;
      const dirs = ['down', 'right', 'left', 'up'] as const;
      let best = dirs[0]; let bestSc = -Infinity;
      for (const d of dirs) { const s = evalMove(d, g); if (s > bestSc) { bestSc = s; best = d; } }
      if (bestSc > -1000) move(best);
      setIsHumanTurn(true);
    }, 500);
    return () => clearTimeout(t);
  }, [agentControlled, gameStarted, gameOver, isHumanTurn, move, evalMove]);

  useEffect(() => { if (!agentControlled || !agentAction || !gameStarted || gameOver) return; move(agentAction); }, [agentAction, agentControlled, gameStarted, gameOver, move]);

  const resetGame = () => {
    const g = createGrid(); setGrid(g); gridRef.current = g;
    setScore(0); scoreRef.current = 0; setGameOver(false); setGameStarted(true); setIsHumanTurn(true); onPlayAgain?.();
  };

  const containerSize = isFullscreen ? Math.min(window.innerWidth / 2 - 40, 400) : 320;
  const cellSize = (containerSize - 40) / GRID_SIZE;
  const playerColor = playerNumber === 1 ? '#7c3aed' : '#0891b2';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>Score: <span className="font-mono text-sm text-primary">{score}</span></span>
        <span>Best: <span className="font-mono text-sm text-yellow-400">{best}</span></span>
      </div>

      <div
        className="p-3 rounded-2xl shadow-2xl border-4"
        style={{ width: containerSize, background: '#bbada0', borderColor: `${playerColor}66` }}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
          {grid.flat().map((value, i) => {
            const ts = value ? getTileStyle(value) : null;
            return (
              <div key={i}
                className={cn("rounded-xl flex items-center justify-center font-black transition-all duration-150 select-none")}
                style={{
                  width: cellSize, height: cellSize,
                  backgroundColor: ts ? ts.bg : '#cdc1b4',
                  color: ts ? ts.fg : 'transparent',
                  fontSize: value >= 1000 ? cellSize * 0.22 : value >= 100 ? cellSize * 0.28 : cellSize * 0.35,
                  boxShadow: ts?.glow ? `0 0 16px ${ts.glow}, inset 0 1px 0 rgba(255,255,255,0.3)` : 'inset 0 2px 4px rgba(0,0,0,0.1)',
                  transform: value ? 'scale(1)' : 'scale(0.97)'
                }}
              >
                {value !== 0 && value}
              </div>
            );
          })}
        </div>
      </div>

      {gameOver && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xl font-black text-destructive">Game Over!</div>
          <Button onClick={resetGame} size="sm" className="gap-2"><RotateCcw className="w-4 h-4" /> Play Again</Button>
        </div>
      )}
      {!agentControlled && gameStarted && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">{playerNumber === 1 ? 'W/A/S/D' : 'Arrow Keys'}</p>
      )}
    </div>
  );
}
