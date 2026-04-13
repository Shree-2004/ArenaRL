import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pipe { x: number; gapY: number; passed: boolean; }

interface FlappyBirdGameProps {
  playerNumber: 1 | 2;
  onGameEnd?: (score: number) => void;
  agentControlled?: boolean;
  agentAction?: 'flap' | null;
  isFullscreen?: boolean;
  autoStart?: boolean;
  onPlayAgain?: () => void;
}

const FW = 380;
const FH = 460;
const BIRD_SZ = 28;
const PIPE_W = 55;
const PIPE_GAP = 155;
const FLAP_GRAVITY = 0.38;
const JUMP_STRENGTH = -8;
const PIPE_SPD = 2.2;

export function FlappyBirdGame({
  playerNumber, onGameEnd, agentControlled = false, agentAction,
  isFullscreen = false, autoStart = false, onPlayAgain,
}: FlappyBirdGameProps) {
  const [birdY, setBirdY] = useState(FH / 2);
  const [vel, setVel] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const birdYRef = useRef(birdY);
  const velRef = useRef(vel);
  const pipesRef = useRef(pipes);
  const lastFlapRef = useRef(0);

  useEffect(() => { birdYRef.current = birdY; velRef.current = vel; }, [birdY, vel]);
  useEffect(() => { pipesRef.current = pipes; }, [pipes]);

  const flap = useCallback(() => {
    if (!gameOver && isPlaying && Date.now() - lastFlapRef.current > 100) {
      setVel(JUMP_STRENGTH); lastFlapRef.current = Date.now();
    }
  }, [gameOver, isPlaying]);

  const reset = useCallback(() => {
    setBirdY(FH / 2); birdYRef.current = FH / 2;
    setVel(0); velRef.current = 0;
    setPipes([]); pipesRef.current = [];
    setScore(0); setGameOver(false); setIsPlaying(true);
    onPlayAgain?.();
  }, [onPlayAgain]);

  useEffect(() => { if (autoStart && !isPlaying && !gameOver) setIsPlaying(true); }, [autoStart, isPlaying, gameOver]);

  useEffect(() => {
    if (agentControlled) return;
    const keys = playerNumber === 1 ? [' ', 'w', 'W'] : ['Enter', 'ArrowUp'];
    const down = (e: KeyboardEvent) => { if (keys.includes(e.key)) { e.preventDefault(); flap(); } };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [agentControlled, playerNumber, flap]);

  // Agent AI
  useEffect(() => {
    if (!agentControlled || !isPlaying || gameOver) return;
    const ai = setInterval(() => {
      const by = birdYRef.current, bv = velRef.current, ps = pipesRef.current;
      const next = ps.find(p => p.x + PIPE_W > 70);
      if (next) {
        const target = next.gapY + PIPE_GAP * 0.4;
        const dist = next.x - 70;
        const urgency = Math.max(0.5, 1 - dist / 300);
        let py = by, pv = bv;
        for (let i = 0; i < 8; i++) { pv += FLAP_GRAVITY; py += pv; }
        const shouldFlap = py > target + 20 * urgency || by > FH - 100 || (dist < 100 && by > next.gapY + PIPE_GAP - 40);
        const tooHigh = by < target - 30 && bv < 0;
        if (shouldFlap && !tooHigh && bv > -4) flap();
      } else if (by > FH * 0.4 + 40 || bv > 4) flap();
    }, 35);
    return () => clearInterval(ai);
  }, [agentControlled, isPlaying, gameOver, flap]);

  useEffect(() => {
    if (!agentControlled || !agentAction || !isPlaying) return;
    if (agentAction === 'flap') flap();
  }, [agentAction, agentControlled, isPlaying, flap]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    let animId: number; let over = false; let scoreCache = 0;
    const loop = () => {
      if (over) return;
      setVel(v => { const nv = v + FLAP_GRAVITY; velRef.current = nv; return nv; });
      setBirdY(y => {
        const ny = y + velRef.current; birdYRef.current = ny;
        if (ny <= 0 || ny >= FH - BIRD_SZ) { over = true; setGameOver(true); setIsPlaying(false); onGameEnd?.(scoreCache); return Math.max(0, Math.min(FH - BIRD_SZ, ny)); }
        return ny;
      });
      setPipes(prev => {
        let ps = prev.map(p => ({ ...p, x: p.x - PIPE_SPD })).filter(p => p.x > -PIPE_W);
        const last = ps[ps.length - 1];
        if (!last || last.x < FW - 240) { ps.push({ x: FW, gapY: Math.random() * (FH - PIPE_GAP - 120) + 60, passed: false }); }
        const by = birdYRef.current;
        for (const p of ps) {
          if ((by + BIRD_SZ > p.x) && (70 < p.x + PIPE_W)) {
            if (by < p.gapY || by + BIRD_SZ > p.gapY + PIPE_GAP) { over = true; setGameOver(true); setIsPlaying(false); onGameEnd?.(scoreCache); }
          }
          if (!p.passed && p.x + PIPE_W < 70) { p.passed = true; setScore(s => { scoreCache = s + 1; return s + 1; }); }
        }
        pipesRef.current = ps; return ps;
      });
      if (!over) { animId = requestAnimationFrame(loop); }
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, gameOver, onGameEnd]);

  const birdColor = playerNumber === 1 ? '#f5c842' : '#42c4f5';
  const pipeColor = playerNumber === 1 ? '#4CAF50' : '#2196F3';
  const scale = 0.8;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Score: <span className="font-mono text-sm text-primary">{score}</span>
      </div>

      <div
        className={cn("relative rounded-2xl overflow-hidden border-4 shadow-2xl cursor-pointer")}
        style={{ width: FW * scale, height: FH * scale, borderColor: `${birdColor}66`, background: 'linear-gradient(180deg, #87CEEB 0%, #b8e4f7 50%, #d4eefa 100%)' }}
        onClick={() => !agentControlled && flap()}
      >
        {/* Clouds */}
        <div className="absolute opacity-80" style={{ width: 70, height: 25, left: '15%', top: '12%', background: 'white', borderRadius: 30, filter: 'blur(4px)' }} />
        <div className="absolute opacity-60" style={{ width: 90, height: 30, left: '55%', top: '20%', background: 'white', borderRadius: 30, filter: 'blur(3px)' }} />
        <div className="absolute opacity-50" style={{ width: 50, height: 20, left: '35%', top: '35%', background: 'white', borderRadius: 30, filter: 'blur(5px)' }} />

        {/* Pipes */}
        {pipes.map((p, i) => (
          <div key={i}>
            <div className="absolute rounded-b-lg shadow-xl" style={{ width: PIPE_W * scale, height: p.gapY * scale, left: p.x * scale, top: 0, backgroundColor: pipeColor, borderLeft: '4px solid rgba(255,255,255,0.2)' }}>
              <div className="absolute bottom-0 left-0 right-0 h-6 rounded-b-lg" style={{ backgroundColor: pipeColor, filter: 'brightness(1.3)' }} />
            </div>
            <div className="absolute rounded-t-lg shadow-xl" style={{ width: PIPE_W * scale, height: (FH - p.gapY - PIPE_GAP) * scale, left: p.x * scale, bottom: 0, backgroundColor: pipeColor, borderLeft: '4px solid rgba(255,255,255,0.2)' }}>
              <div className="absolute top-0 left-0 right-0 h-6 rounded-t-lg" style={{ backgroundColor: pipeColor, filter: 'brightness(1.3)' }} />
            </div>
          </div>
        ))}

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-10 rounded-b-2xl" style={{ background: 'linear-gradient(180deg, #8B6914, #6B5010)' }}>
          <div className="absolute top-0 left-0 right-0 h-2 bg-green-500/70" />
        </div>

        {/* Bird */}
        <div className="absolute flex items-center justify-center"
          style={{ width: BIRD_SZ * scale, height: BIRD_SZ * scale, left: 70 * scale, top: birdY * scale, transform: `rotate(${Math.min(vel * 3, 40)}deg)`, filter: `drop-shadow(0 0 6px ${birdColor}88)` }}
        >
          <svg viewBox="0 0 28 28" fill="none" className="w-full h-full">
            <ellipse cx="14" cy="14" rx="12" ry="10" fill={birdColor} />
            <ellipse cx="20" cy="10" rx="4" ry="3" fill="white" />
            <circle cx="22" cy="9" r="2" fill="#222" />
            <polygon points="25,13 30,12 25,15" fill="#FF8C00" />
            <ellipse cx="10" cy="18" rx="6" ry="4" fill={playerNumber === 1 ? '#e6b800' : '#1a9ed4'} />
          </svg>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <div className="text-center p-6 rounded-3xl bg-white/10 border border-white/20 shadow-2xl">
              <div className="text-3xl font-black text-white italic mb-1">SQUASHED!</div>
              <div className="text-4xl font-mono font-black" style={{ color: birdColor }}>{score}</div>
              <Button onClick={reset} className="mt-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 py-4 rounded-xl">
                <RotateCcw className="w-4 h-4" /> Replay
              </Button>
            </div>
          </div>
        )}
      </div>

      {!agentControlled && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {playerNumber === 1 ? 'Space / W' : 'Enter / ↑'} — or click
        </p>
      )}
    </div>
  );
}
