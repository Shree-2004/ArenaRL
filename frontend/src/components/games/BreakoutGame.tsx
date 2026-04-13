import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakoutGameProps {
    playerNumber: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    onPlayAgain?: () => void;
    onMove?: (reasoning: string) => void;
}

const W = 280;
const H = 400;
const PADDLE_W = 70;
const PADDLE_H = 12;
const BALL_R = 7;
const ROWS = 5;
const COLS = 6;
const BRICK_W = (W - 20) / COLS - 4;
const BRICK_H = 18;
const BRICK_PADDING = 4;
const BRICK_TOP = 40;
const BRICK_LEFT = 10;

const ROW_COLORS = [
    '#FF4D4D', '#FF8C4D', '#FFD04D', '#4DFFB8', '#4D8CFF'
];

interface Brick { x: number; y: number; status: number; color: string; }
interface BallState { x: number; y: number; vx: number; vy: number; }

export function BreakoutGame({
    playerNumber, onGameEnd, agentControlled = false,
    autoStart = false, onPlayAgain, onMove,
}: BreakoutGameProps) {
    const [paddle, setPaddle] = useState((W - PADDLE_W) / 2);
    const [ball, setBall] = useState<BallState>({ x: W / 2, y: H - 50, vx: 2.5, vy: -3.5 });
    const [bricks, setBricks] = useState<Brick[]>([]);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const paddleRef = useRef(paddle);
    const ballRef = useRef(ball);
    const bricksRef = useRef(bricks);
    const scoreRef = useRef(score);
    const keysRef = useRef<Set<string>>(new Set());


    useEffect(() => { paddleRef.current = paddle; }, [paddle]);
    useEffect(() => { ballRef.current = ball; }, [ball]);
    useEffect(() => { bricksRef.current = bricks; }, [bricks]);
    useEffect(() => { scoreRef.current = score; }, [score]);

    const initBricks = useCallback(() => {
        const b: Brick[] = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                b.push({
                    x: c * (BRICK_W + BRICK_PADDING) + BRICK_LEFT,
                    y: r * (BRICK_H + BRICK_PADDING) + BRICK_TOP,
                    status: 1,
                    color: ROW_COLORS[r]
                });
            }
        }
        return b;
    }, []);

    const reset = useCallback(() => {
        const p = (W - PADDLE_W) / 2;
        const bl: BallState = { x: W / 2, y: H - 60, vx: 2.5 * (Math.random() > 0.5 ? 1 : -1), vy: -3.5 };
        const nb = initBricks();
        setPaddle(p); paddleRef.current = p;
        setBall(bl); ballRef.current = bl;
        setBricks(nb); bricksRef.current = nb;
        setScore(0); scoreRef.current = 0;
        setGameOver(false); setWon(false);
        setIsPlaying(true);
        onPlayAgain?.();
    }, [initBricks, onPlayAgain]);

    useEffect(() => { if (autoStart && !isPlaying && !gameOver) reset(); }, [autoStart, isPlaying, gameOver, reset]);

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


    // Agent AI
    useEffect(() => {
        if (!agentControlled || !isPlaying || gameOver) return;
        const ai = setInterval(() => {
            const b = ballRef.current;
            const p = paddleRef.current;
            const center = p + PADDLE_W / 2;
            const diff = b.x - center;
            const speed = 12;
            const np = Math.min(W - PADDLE_W, Math.max(0, p + Math.sign(diff) * Math.min(Math.abs(diff), speed)));
            setPaddle(np); paddleRef.current = np;
        }, 30);
        return () => clearInterval(ai);
    }, [agentControlled, isPlaying, gameOver]);

    // Game Loop — proper AABB + circle collision
    useEffect(() => {
        if (!isPlaying || gameOver) return;

        const loop = setInterval(() => {
            const p = paddleRef.current;
            const cur = ballRef.current;
            let { x, y, vx, vy } = cur;

            // 1. Smooth paddle movement (Human only)
            if (!agentControlled) {
                const keys = playerNumber === 1 ? { l: 'a', r: 'd' } : { l: 'arrowleft', r: 'arrowright' };
                let nextP = p;
                if (keysRef.current.has(keys.l)) nextP = Math.max(0, p - 8);
                if (keysRef.current.has(keys.r)) nextP = Math.min(W - PADDLE_W, p + 8);
                if (nextP !== p) {
                    setPaddle(nextP);
                    paddleRef.current = nextP;
                }
            }

            // 2. Move ball
            x += vx; y += vy;


            // Wall bounce (left/right)
            if (x - BALL_R <= 0) { x = BALL_R; vx = Math.abs(vx); }
            if (x + BALL_R >= W) { x = W - BALL_R; vx = -Math.abs(vx); }

            // Top wall
            if (y - BALL_R <= 0) { y = BALL_R; vy = Math.abs(vy); }

            // Paddle collision (proper edge detection)
            const paddleY = H - PADDLE_H - 8;
            if (y + BALL_R >= paddleY && y + BALL_R <= paddleY + PADDLE_H + Math.abs(vy) && x >= p - 5 && x <= p + PADDLE_W + 5) {
                y = paddleY - BALL_R;

                // Add spin based on hit position
                const hitPos = (x - p) / PADDLE_W; // 0..1
                let newVx = (hitPos - 0.5) * 8;

                // CRITICAL: Prevent pure vertical loop
                if (Math.abs(newVx) < 1.5) newVx = newVx >= 0 ? 1.5 : -1.5;

                // Add slight random kick to break repetitive cycles
                vx = newVx + (Math.random() - 0.5) * 0.5;
                vy = -Math.abs(vy) * (1 + (Math.random() - 0.5) * 0.1); // Slight speed variance
            }

            // Bottom — ball lost
            if (y + BALL_R > H) {
                setGameOver(true); setIsPlaying(false);
                onGameEnd?.(scoreRef.current);
                return;
            }

            // Brick collision — process each brick
            let scoreIncrement = 0;
            const newBricks = bricksRef.current.map(b => {
                if (b.status !== 1) return b;

                const bRight = b.x + BRICK_W;
                const bBottom = b.y + BRICK_H;

                // AABB vs circle
                const nearX = Math.max(b.x, Math.min(x, bRight));
                const nearY = Math.max(b.y, Math.min(y, bBottom));
                const distX = x - nearX;
                const distY = y - nearY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < BALL_R) {
                    // Determine which face was hit
                    const overlapX = BALL_R - Math.abs(distX);
                    const overlapY = BALL_R - Math.abs(distY);

                    // Add a tiny bit of random variance to brick bounces too
                    const variance = (Math.random() - 0.5) * 0.2;

                    if (overlapX < overlapY) {
                        vx = (distX > 0 ? Math.abs(vx) : -Math.abs(vx)) + variance;
                    } else {
                        vy = (distY > 0 ? Math.abs(vy) : -Math.abs(vy)) + variance;
                    }

                    scoreIncrement += 10;
                    return { ...b, status: 0 };
                }
                return b;
            });


            if (scoreIncrement > 0) {
                setBricks(newBricks);
                bricksRef.current = newBricks;
                const newScore = scoreRef.current + scoreIncrement;
                setScore(newScore);
                scoreRef.current = newScore;
                if (newBricks.every(b => b.status === 0)) {
                    setWon(true); setGameOver(true); setIsPlaying(false);
                    onGameEnd?.(newScore);
                    return;
                }
            }

            const updated = { x, y, vx, vy };
            setBall(updated);
            ballRef.current = updated;
        }, 16);

        return () => clearInterval(loop);
    }, [isPlaying, gameOver, onGameEnd]);

    const paddleY = H - PADDLE_H - 8;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> Score: <span className="text-primary font-mono ml-1">{score}</span></span>
            </div>

            <div
                className={cn(
                    "relative rounded-2xl overflow-hidden border-4 shadow-2xl",
                    "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900",
                    playerNumber === 1 ? "border-agentX/50" : "border-agentO/50"
                )}
                style={{ width: W, height: H }}
            >
                {/* Grid lines for neon effect */}
                <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 20px)' }}
                />

                {/* Bricks */}
                {bricks.map((b, i) => b.status === 1 && (
                    <div key={i} className="absolute rounded-md shadow-lg transition-all duration-75"
                        style={{
                            width: BRICK_W, height: BRICK_H,
                            left: b.x, top: b.y,
                            backgroundColor: b.color,
                            boxShadow: `0 0 8px ${b.color}88, inset 0 1px 0 rgba(255,255,255,0.3)`,
                        }}
                    >
                        <div className="w-full h-1 rounded-t-md bg-white/20" />
                    </div>
                ))}

                {/* Ball */}
                <div className="absolute rounded-full"
                    style={{
                        width: BALL_R * 2, height: BALL_R * 2,
                        left: ball.x - BALL_R, top: ball.y - BALL_R,
                        background: 'radial-gradient(circle at 35% 35%, #fff, #a0c4ff)',
                        boxShadow: '0 0 10px #4D8CFF, 0 0 20px #4D8CFF66',
                    }}
                />

                {/* Paddle */}
                <div className="absolute rounded-full"
                    style={{
                        width: PADDLE_W, height: PADDLE_H,
                        left: paddle, top: paddleY,
                        background: playerNumber === 1
                            ? 'linear-gradient(90deg, #7c3aed, #4f46e5)'
                            : 'linear-gradient(90deg, #059669, #0891b2)',
                        boxShadow: playerNumber === 1
                            ? '0 0 10px #7c3aed88, 0 0 20px #4f46e544'
                            : '0 0 10px #05966988, 0 0 20px #0891b244',
                    }}
                />

                {/* Game Over Overlay */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20">
                        <div className="text-center p-8 rounded-3xl bg-white/5 border border-white/10">
                            <div className={cn("text-5xl font-black italic mb-2", won ? "text-yellow-400" : "text-red-400")}>
                                {won ? '🎉 CLEAR!' : '💥 MISS!'}
                            </div>
                            <div className="text-2xl font-mono text-white mb-6">{score} pts</div>
                            <Button onClick={reset} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 py-5 rounded-xl text-lg">
                                <RotateCcw className="w-5 h-5" /> Replay
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {!agentControlled && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {playerNumber === 1 ? 'A / D to move' : '← / → to move'}
                </p>
            )}
        </div>
    );
}
