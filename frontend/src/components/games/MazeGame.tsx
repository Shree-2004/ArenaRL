import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position { x: number; y: number; }

interface MazeGameProps {
  playerNumber: 1 | 2;
  onGameEnd?: (won: boolean, time: number) => void;
  agentControlled?: boolean;
  agentAction?: 'up' | 'down' | 'left' | 'right' | null;
  isFullscreen?: boolean;
  autoStart?: boolean;
  sharedMaze?: number[][];
  onMazeGenerated?: (maze: number[][]) => void;
  onPlayAgain?: () => void;
}

const MAZE_SIZE = 15;

function generateMaze(size: number): number[][] {
  const maze = Array(size).fill(null).map(() => Array(size).fill(1));
  const carve = (x: number, y: number) => {
    maze[y][x] = 0;
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
        maze[y + dy / 2][x + dx / 2] = 0; carve(nx, ny);
      }
    }
  };
  carve(1, 1);
  maze[1][1] = 0; maze[size - 2][size - 2] = 0;
  return maze;
}

function findPath(maze: number[][], start: Position, goal: Position): Position[] {
  const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [start] }];
  const visited = new Set<string>([`${start.x},${start.y}`]);
  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (pos.x === goal.x && pos.y === goal.y) return path;
    for (const dir of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
      const nx = pos.x + dir.x, ny = pos.y + dir.y, key = `${nx},${ny}`;
      if (nx >= 0 && nx < MAZE_SIZE && ny >= 0 && ny < MAZE_SIZE && maze[ny][nx] === 0 && !visited.has(key)) {
        visited.add(key); queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
      }
    }
  }
  return [];
}

export function MazeGame({
  playerNumber, onGameEnd, agentControlled = false, agentAction,
  isFullscreen = false, autoStart = false, sharedMaze, onMazeGenerated, onPlayAgain,
}: MazeGameProps) {
  const [maze, setMaze] = useState<number[][]>(() => sharedMaze || generateMaze(MAZE_SIZE));
  const [position, setPosition] = useState<Position>({ x: 1, y: 1 });
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set(['1,1']));

  const pathRef = useRef<Position[]>([]);
  const pathIndexRef = useRef(0);
  const positionRef = useRef(position);
  const goalPosition = useMemo(() => ({ x: MAZE_SIZE - 2, y: MAZE_SIZE - 2 }), []);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { if (!sharedMaze && onMazeGenerated) onMazeGenerated(maze); }, [maze, sharedMaze, onMazeGenerated]);
  useEffect(() => {
    if (sharedMaze) { setMaze(sharedMaze); if (agentControlled) { pathRef.current = findPath(sharedMaze, { x: 1, y: 1 }, goalPosition); pathIndexRef.current = 1; } }
  }, [sharedMaze, agentControlled, goalPosition]);

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver || !isPlaying) return;
    setPosition(prev => {
      let nx = prev.x, ny = prev.y;
      if (direction === 'up') ny -= 1; else if (direction === 'down') ny += 1;
      else if (direction === 'left') nx -= 1; else nx += 1;
      if (nx < 0 || nx >= MAZE_SIZE || ny < 0 || ny >= MAZE_SIZE || maze[ny][nx] === 1) return prev;
      const newPos = { x: nx, y: ny };
      positionRef.current = newPos;
      setVisited(v => new Set([...v, `${nx},${ny}`]));
      if (nx === goalPosition.x && ny === goalPosition.y) {
        setGameOver(true); setHasWon(true); setIsPlaying(false);
        const time = startTime ? Date.now() - startTime : 0;
        onGameEnd?.(true, time);
      }
      return newPos;
    });
  }, [gameOver, isPlaying, maze, goalPosition, startTime, onGameEnd]);

  useEffect(() => {
    if (autoStart && !isPlaying && !gameOver) {
      setIsPlaying(true); setStartTime(Date.now());
      if (agentControlled) { pathRef.current = findPath(maze, { x: 1, y: 1 }, goalPosition); pathIndexRef.current = 1; }
    }
  }, [autoStart, isPlaying, gameOver, maze, goalPosition, agentControlled]);

  useEffect(() => {
    if (agentControlled || !isPlaying || gameOver) return;
    const keys = playerNumber === 1 ? { up: 'w', down: 's', left: 'a', right: 'd' } : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const down = (e: KeyboardEvent) => {
      if (e.key === keys.up || e.key === keys.up.toUpperCase()) { e.preventDefault(); move('up'); }
      else if (e.key === keys.down || e.key === keys.down.toUpperCase()) { e.preventDefault(); move('down'); }
      else if (e.key === keys.left || e.key === keys.left.toUpperCase()) { e.preventDefault(); move('left'); }
      else if (e.key === keys.right || e.key === keys.right.toUpperCase()) { e.preventDefault(); move('right'); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [agentControlled, playerNumber, isPlaying, gameOver, move]);

  useEffect(() => {
    if (!agentControlled || !isPlaying || gameOver) return;
    const ai = setInterval(() => {
      const path = pathRef.current; const index = pathIndexRef.current; const cur = positionRef.current;
      if (index < path.length) {
        const next = path[index];
        if (next.x > cur.x) move('right'); else if (next.x < cur.x) move('left');
        else if (next.y > cur.y) move('down'); else if (next.y < cur.y) move('up');
        pathIndexRef.current = index + 1;
      }
    }, 100);
    return () => clearInterval(ai);
  }, [agentControlled, isPlaying, gameOver, move]);

  useEffect(() => { if (!agentControlled || !agentAction || !isPlaying || gameOver) return; move(agentAction); }, [agentAction, agentControlled, isPlaying, gameOver, move]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const interval = setInterval(() => { if (startTime) setElapsedTime(Date.now() - startTime); }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, gameOver, startTime]);

  const resetGame = () => {
    const newMaze = generateMaze(MAZE_SIZE);
    setMaze(newMaze); if (onMazeGenerated) onMazeGenerated(newMaze);
    setPosition({ x: 1, y: 1 }); positionRef.current = { x: 1, y: 1 };
    setVisited(new Set(['1,1']));
    setGameOver(false); setHasWon(false); setIsPlaying(true);
    setStartTime(Date.now()); setElapsedTime(0);
    if (agentControlled) { pathRef.current = findPath(newMaze, { x: 1, y: 1 }, goalPosition); pathIndexRef.current = 1; }
    onPlayAgain?.();
  };

  const containerSize = isFullscreen ? Math.min(window.innerWidth / 2 - 40, 450) : 360;
  const cellSize = containerSize / MAZE_SIZE;
  const formatTime = (ms: number) => `${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}s`;

  const playerColor = playerNumber === 1 ? '#7c3aed' : '#059669';
  const playerGlow = playerNumber === 1 ? '#7c3aed88' : '#05966988';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>Time: <span className="font-mono text-primary">{formatTime(elapsedTime)}</span></span>
        <span>Steps: <span className="font-mono text-primary">{visited.size - 1}</span></span>
      </div>

      <div
        className={cn("relative rounded-2xl overflow-hidden border-4 shadow-2xl")}
        style={{ width: containerSize, height: containerSize, borderColor: `${playerColor}66`, background: '#0d1117' }}
      >
        {/* Maze walls & corridors */}
        {maze.map((row, y) => row.map((cell, x) => (
          <div key={`${x}-${y}`} className="absolute"
            style={{
              width: cellSize, height: cellSize, left: x * cellSize, top: y * cellSize,
              backgroundColor: cell === 1 ? '#1e293b' : (visited.has(`${x},${y}`) ? `${playerColor}18` : 'transparent'),
              borderRadius: cell === 1 ? '2px' : 0
            }}
          >
            {cell === 1 && <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} />}
          </div>
        )))}

        {/* Goal star */}
        <div className="absolute flex items-center justify-center animate-pulse"
          style={{ width: cellSize, height: cellSize, left: goalPosition.x * cellSize, top: goalPosition.y * cellSize }}
        >
          <div className="w-full h-full rounded-sm flex items-center justify-center text-base" style={{ background: '#facc1540', boxShadow: '0 0 12px #facc1580' }}>⭐</div>
        </div>

        {/* Player */}
        <div className="absolute transition-all duration-100"
          style={{ width: cellSize, height: cellSize, left: position.x * cellSize, top: position.y * cellSize }}
        >
          <div className="w-full h-full rounded-full"
            style={{ backgroundColor: playerColor, boxShadow: `0 0 8px ${playerGlow}, 0 0 16px ${playerGlow}` }}
          />
        </div>

        {/* Win Overlay */}
        {hasWon && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <div className="text-center p-8 rounded-3xl bg-white/5 border border-white/10">
              <div className="text-5xl mb-2">⭐</div>
              <div className="text-3xl font-black text-yellow-400 italic mb-2">ESCAPED!</div>
              <div className="text-lg font-mono text-white/60 mb-6">{formatTime(elapsedTime)}</div>
              <Button onClick={resetGame} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 rounded-xl">
                <RotateCcw className="w-4 h-4" /> New Maze
              </Button>
            </div>
          </div>
        )}
      </div>

      {!agentControlled && isPlaying && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {playerNumber === 1 ? 'W / A / S / D' : 'Arrow Keys'}
        </p>
      )}
    </div>
  );
}
