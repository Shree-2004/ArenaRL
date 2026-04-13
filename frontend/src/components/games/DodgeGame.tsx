import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Obstacle { id: number; x: number; y: number; }

interface DodgeGameProps {
    playerNumber: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    onPlayAgain?: () => void;
    onMove?: (reasoning: string) => void;
}

const W = 260;
const H = 380;
const LANE_COUNT = 7;
const LANE_W = W / LANE_COUNT;
const SHIP_H = 32;
const OBS_H = 20;

const LANE_COLORS = ['#FF4D4D', '#FF8C4D', '#FFD04D', '#4DFF88', '#4D8CFF', '#8C4DFF', '#FF4D8C'];

export function DodgeGame({
    playerNumber, onGameEnd, agentControlled = false,
    autoStart = false, onPlayAgain, onMove,
}: DodgeGameProps) {
    const [posX, setPosX] = useState(W / 2);

    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [trail, setTrail] = useState<{ id: number; x: number; y: number }[]>([]);

    const posXRef = useRef(posX);
    const obstaclesRef = useRef(obstacles);
    const scoreRef = useRef(score);
    const idRef = useRef(0);
    const keysRef = useRef<Set<string>>(new Set());

    useEffect(() => { posXRef.current = posX; }, [posX]);

    useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
    useEffect(() => { scoreRef.current = score; }, [score]);

    const reset = useCallback(() => {
        setPosX(W / 2); posXRef.current = W / 2;
        setObstacles([]); obstaclesRef.current = [];
        setGameOver(false); setScore(0); scoreRef.current = 0;
        setTrail([]);
        setIsPlaying(true);
        onPlayAgain?.();
    }, [onPlayAgain]);


    useEffect(() => { if (autoStart && !isPlaying && !gameOver) setIsPlaying(true); }, [autoStart, isPlaying, gameOver]);

    // Keyboard State Tracking
    useEffect(() => {
        if (agentControlled) return;
        const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
        const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [agentControlled]);


    // AI
    useEffect(() => {
        if (!agentControlled || !isPlaying || gameOver) return;
        const ai = setInterval(() => {
            const curX = posXRef.current;
            const obs = obstaclesRef.current;
            const danger = obs.filter(o => o.y > H - 150);

            // AI still thinks in "lanes" for simplicity, but moves continuously
            const currentLane = Math.floor(curX / LANE_W);
            const lanesBlocked = new Set(danger.map(o => o.x));
            const safeLanes = Array.from({ length: LANE_COUNT }, (_, i) => i).filter(i => !lanesBlocked.has(i));

            if (lanesBlocked.has(currentLane) && safeLanes.length > 0) {
                const targetLane = safeLanes.reduce((a, b) => Math.abs(a - currentLane) < Math.abs(b - currentLane) ? a : b);
                const targetX = targetLane * LANE_W + LANE_W / 2;
                const diff = targetX - curX;
                const moveSpeed = 8;
                const nextX = curX + Math.sign(diff) * Math.min(Math.abs(diff), moveSpeed);
                setPosX(nextX); posXRef.current = nextX;
            }
        }, 50);
        return () => clearInterval(ai);
    }, [agentControlled, isPlaying, gameOver]);


    // Game Loop
    useEffect(() => {
        if (!isPlaying || gameOver) return;

        const loop = setInterval(() => {
            const pX = posXRef.current;
            const spd = Math.min(6, 1.5 + Math.floor(scoreRef.current / 150));

            // Smooth Human Movement
            if (!agentControlled) {
                const keys = playerNumber === 1 ? { l: 'a', r: 'd' } : { l: 'arrowleft', r: 'arrowright' };
                let nextX = pX;
                if (keysRef.current.has(keys.l)) nextX = Math.max(16, pX - 6);
                if (keysRef.current.has(keys.r)) nextX = Math.min(W - 16, pX + 6);
                if (nextX !== pX) {
                    setPosX(nextX); posXRef.current = nextX;
                }
            }

            setObstacles(prev => {
                const moved = prev.map(o => ({ ...o, y: o.y + spd })).filter(o => o.y < H + OBS_H);

                // Balanced Spawn: Starts rare (2%), increases slowly to ~10% max
                const spawnThreshold = Math.max(0.90, 0.98 - (scoreRef.current / 2000) * 0.08);
                if (Math.random() > spawnThreshold) {
                    idRef.current += 1;
                    moved.push({ id: idRef.current, x: Math.floor(Math.random() * LANE_COUNT), y: -OBS_H });
                }


                // Collision
                const playerY = H - SHIP_H - 10;
                const hit = moved.some(o => {
                    const oLeft = o.x * LANE_W;
                    const oRight = oLeft + LANE_W;
                    const pLeft = posXRef.current - 12;
                    const pRight = posXRef.current + 12;
                    return (pRight > oLeft && pLeft < oRight) && (o.y + OBS_H >= playerY && o.y <= playerY + SHIP_H);
                });

                if (hit) {
                    setGameOver(true); setIsPlaying(false);
                    onGameEnd?.(scoreRef.current);
                }

                return moved;
            });

            setScore(s => s + 1);
            scoreRef.current += 1;

            // Trail
            setTrail(prev => [
                ...prev.slice(-8).map(t => ({ ...t, y: t.y + spd })),
                { id: Date.now() + Math.random(), x: posXRef.current, y: H - SHIP_H - 10 }
            ].filter(t => t.y < H));
        }, 32);

        return () => clearInterval(loop);
    }, [isPlaying, gameOver, agentControlled, playerNumber, onGameEnd]);


    const shipX = posX - 16;
    const shipY = H - SHIP_H - 10;


    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>Distance: <span className="text-primary font-mono">{score}</span>m</span>
                <span>Speed: <span className="text-yellow-400 font-mono">{Math.min(8, 2 + Math.floor(score / 15))}x</span></span>
            </div>

            <div
                className={cn(
                    "relative rounded-2xl overflow-hidden border-4 shadow-2xl",
                    "bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950",
                    playerNumber === 1 ? "border-agentX/50" : "border-agentO/50"
                )}
                style={{ width: W, height: H }}
            >
                {/* Stars bg */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="absolute w-[2px] h-[2px] rounded-full bg-white/40"
                        style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
                    />
                ))}

                {/* Lane dividers */}
                {Array.from({ length: LANE_COUNT - 1 }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-[1px] bg-white/5"
                        style={{ left: (i + 1) * LANE_W }}
                    />
                ))}

                {/* Obstacles */}
                {obstacles.map(o => (
                    <div key={o.id} className="absolute rounded-md shadow-xl"
                        style={{
                            width: LANE_W - 8,
                            height: OBS_H,
                            left: o.x * LANE_W + 4,
                            top: o.y,
                            background: `linear-gradient(135deg, ${LANE_COLORS[o.x % LANE_COLORS.length]}, ${LANE_COLORS[(o.x + 2) % LANE_COLORS.length]})`,
                            boxShadow: `0 0 12px ${LANE_COLORS[o.x % LANE_COLORS.length]}88`,
                        }}
                    />
                ))}

                {/* Exhaust trail */}
                {trail.map((t, i) => (
                    <div key={t.id} className="absolute rounded-full bg-sky-400/40"
                        style={{
                            width: 6, height: 6,
                            left: t.x - 3, top: t.y + SHIP_H - 4,
                            opacity: i / trail.length * 0.6,
                            transform: `scale(${i / trail.length})`
                        }}
                    />
                ))}

                {/* Ship */}
                <div className="absolute transition-all duration-75 flex items-center justify-center"
                    style={{ width: 32, height: SHIP_H, left: shipX, top: shipY }}
                >
                    <svg viewBox="0 0 32 40" fill="none" className="w-full h-full drop-shadow-lg">
                        <polygon points="16,2 28,36 16,30 4,36" fill={playerNumber === 1 ? '#7c3aed' : '#059669'} />
                        <polygon points="16,10 22,32 16,28 10,32" fill="white" fillOpacity="0.3" />
                        <circle cx="16" cy="20" r="4" fill={playerNumber === 1 ? '#c4b5fd' : '#6ee7b7'} />
                    </svg>
                </div>

                {/* Game Over */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
                        <div className="text-center p-8 rounded-3xl bg-white/5 border border-white/10">
                            <div className="text-5xl mb-2">💥</div>
                            <div className="text-3xl font-black italic text-red-400 mb-2">CRASHED!</div>
                            <div className="text-2xl font-mono text-white mb-6">{score}m</div>
                            <Button onClick={reset} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 py-5 rounded-xl text-lg">
                                <RotateCcw className="w-5 h-5" /> Retry
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {!agentControlled && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" />{playerNumber === 1 ? 'A' : '←'} / {playerNumber === 1 ? 'D' : '→'}<ChevronRight className="w-3 h-3" />
                </p>
            )}
        </div>
    );
}
