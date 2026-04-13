import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position { x: number; y: number; }

interface SnakeGameProps {
  playerNumber: 1 | 2;
  onGameEnd?: (score: number) => void;
  agentControlled?: boolean;
  agentAction?: 'up' | 'down' | 'left' | 'right' | null;
  isFullscreen?: boolean;
  autoStart?: boolean;
  onPlayAgain?: () => void;
  onMove?: (reasoning: string) => void;
}

const GRID = 20;
const CELL = 18;
const SPEED = 130;
const P1_COLOR = '#7c3aed';
const P2_COLOR = '#0891b2';

export function SnakeGame({
  playerNumber, onGameEnd, agentControlled = false, agentAction,
  isFullscreen = false, autoStart = false, onPlayAgain, onMove,
}: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('right');
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);

  const dirRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(score);

  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { dirRef.current = direction; }, [direction]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const genFood = useCallback((s: Position[]) => {
    let f: Position;
    do { f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }; }
    while (s.some(seg => seg.x === f.x && seg.y === f.y));
    return f;
  }, []);

  const reset = useCallback(() => {
    const init = [{ x: 10, y: 10 }];
    const f = genFood(init);
    setSnake(init); snakeRef.current = init;
    setFood(f); foodRef.current = f;
    setDirection('right'); dirRef.current = 'right';
    setGameOver(false); setScore(0); scoreRef.current = 0;
    setIsPlaying(true);
    onPlayAgain?.();
  }, [genFood, onPlayAgain]);

  useEffect(() => { if (autoStart && !isPlaying && !gameOver) setIsPlaying(true); }, [autoStart, isPlaying, gameOver]);

  // Keyboard
  useEffect(() => {
    if (agentControlled) return;
    const keys = playerNumber === 1
      ? { up: 'w', down: 's', left: 'a', right: 'd' }
      : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

    const down = (e: KeyboardEvent) => {
      const cur = dirRef.current;
      if ((e.key === keys.up || e.key === keys.up.toUpperCase()) && cur !== 'down') { setDirection('up'); dirRef.current = 'up'; }
      else if ((e.key === keys.down || e.key === 'ArrowDown') && cur !== 'up') { setDirection('down'); dirRef.current = 'down'; }
      else if ((e.key === keys.left || e.key === 'ArrowLeft') && cur !== 'right') { setDirection('left'); dirRef.current = 'left'; }
      else if ((e.key === keys.right || e.key === 'ArrowRight') && cur !== 'left') { setDirection('right'); dirRef.current = 'right'; }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [agentControlled, playerNumber]);

  // Agent AI
  useEffect(() => {
    if (!agentControlled || !isPlaying || gameOver) return;
    const ai = setInterval(() => {
      const s = snakeRef.current; const f = foodRef.current; const head = s[0]; const cur = dirRef.current;
      const moves = (['up', 'down', 'left', 'right'] as const).filter(m =>
        !(m === 'down' && cur === 'up') && !(m === 'up' && cur === 'down') &&
        !(m === 'right' && cur === 'left') && !(m === 'left' && cur === 'right')
      );
      const getPos = (m: typeof moves[0]) => {
        switch (m) {
          case 'up': return { x: head.x, y: head.y - 1 }; case 'down': return { x: head.x, y: head.y + 1 };
          case 'left': return { x: head.x - 1, y: head.y }; default: return { x: head.x + 1, y: head.y };
        }
      };
      const safe = moves.filter(m => { const p = getPos(m); return p.x >= 0 && p.x < GRID && p.y >= 0 && p.y < GRID && !s.some(seg => seg.x === p.x && seg.y === p.y); });
      if (safe.length > 0) {
        const best = safe.reduce((a, b) => { const pa = getPos(a), pb = getPos(b); return (Math.abs(pa.x - f.x) + Math.abs(pa.y - f.y)) < (Math.abs(pb.x - f.x) + Math.abs(pb.y - f.y)) ? a : b; });
        setDirection(best); dirRef.current = best;
        if (onMove) onMove(`Snake P${playerNumber} → ${best}`);
      }
    }, 80);
    return () => clearInterval(ai);
  }, [agentControlled, isPlaying, gameOver, playerNumber, onMove]);

  // Game Loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const loop = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] }; const d = dirRef.current;
        if (d === 'up') head.y -= 1; else if (d === 'down') head.y += 1;
        else if (d === 'left') head.x -= 1; else head.x += 1;
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || prev.some(s => s.x === head.x && s.y === head.y)) {
          setGameOver(true); setIsPlaying(false); onGameEnd?.(scoreRef.current); return prev;
        }
        const next = [head, ...prev];
        if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
          const ns = scoreRef.current + 10; setScore(ns); scoreRef.current = ns;
          const f = genFood(next); setFood(f); foodRef.current = f;
        } else { next.pop(); }
        return next;
      });
    }, SPEED);
    return () => clearInterval(loop);
  }, [isPlaying, gameOver, onGameEnd, genFood]);

  const color = playerNumber === 1 ? P1_COLOR : P2_COLOR;
  const size = GRID * CELL;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>Score: <span className="font-mono text-sm" style={{ color }}>{score}</span></span>
        <span>Length: <span className="font-mono text-sm" style={{ color }}>{snake.length}</span></span>
      </div>

      <div className={cn("relative rounded-2xl overflow-hidden border-4 shadow-2xl")}
        style={{ width: size, height: size, borderColor: `${color}66`, background: '#0a0a16' }}
      >
        {/* Faint grid lines */}
        <div className="absolute inset-0"
          style={{ backgroundImage: `repeating-linear-gradient(0deg, ${color}11 0, ${color}11 1px, transparent 1px, transparent ${CELL}px), repeating-linear-gradient(90deg, ${color}11 0, ${color}11 1px, transparent 1px, transparent ${CELL}px)` }}
        />

        {/* Food */}
        <div className="absolute rounded-full animate-pulse"
          style={{ width: CELL - 4, height: CELL - 4, left: food.x * CELL + 2, top: food.y * CELL + 2, background: '#FF4D4D', boxShadow: '0 0 10px #FF4D4D, 0 0 20px #FF4D4D66' }}
        />

        {/* Snake segments */}
        {snake.map((seg, i) => (
          <div key={i} className="absolute"
            style={{ width: CELL - 3, height: CELL - 3, left: seg.x * CELL + 1, top: seg.y * CELL + 1, backgroundColor: color, opacity: 1 - (i / snake.length) * 0.6, boxShadow: i === 0 ? `0 0 10px ${color}` : undefined, borderRadius: i === 0 ? '6px' : '3px' }}
          />
        ))}

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <div className="text-center p-8 rounded-3xl bg-white/5 border border-white/10">
              <div className="text-5xl font-black italic mb-2" style={{ color }}>DEAD</div>
              <div className="text-2xl font-mono text-white mb-6">{score} pts</div>
              <Button onClick={reset} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 py-5 rounded-xl">
                <RotateCcw className="w-5 h-5" /> Respawn
              </Button>
            </div>
          </div>
        )}
      </div>

      {!agentControlled && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {playerNumber === 1 ? 'W / A / S / D' : 'Arrow Keys'}
        </p>
      )}
    </div>
  );
}
