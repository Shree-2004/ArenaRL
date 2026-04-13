import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Target, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Balloon {
    id: number;
    x: number;
    y: number;
    color: string;
    popped: boolean;
    offset: number; // For swaying
    scale: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    life: number;
}

interface BalloonPopGameProps {
    playerNumber: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    onPlayAgain?: () => void;
    onMove?: (reasoning: string) => void;
}

const WIDTH = 300;
const HEIGHT = 400;
const COLORS = ['#FF4D4D', '#4D94FF', '#4DFF88', '#FFB84D', '#B84DFF'];

export function BalloonPopGame({
    playerNumber,
    onGameEnd,
    agentControlled = false,
    isFullscreen = false,
    autoStart = false,
    onPlayAgain,
    onMove,
}: BalloonPopGameProps) {
    const [balloons, setBalloons] = useState<Balloon[]>([]);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [score, setScore] = useState(0);
    const [shots, setShots] = useState(20);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const balloonsRef = useRef(balloons);
    const shotsRef = useRef(shots);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { balloonsRef.current = balloons; }, [balloons]);
    useEffect(() => { shotsRef.current = shots; }, [shots]);

    const createParticles = (x: number, y: number, color: string) => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 8; i++) {
            newParticles.push({
                id: Math.random(),
                x,
                y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color,
                life: 1.0
            });
        }
        setParticles(prev => [...prev, ...newParticles]);
    };

    const resetGame = useCallback(() => {
        setBalloons([]);
        setParticles([]);
        setScore(0);
        setShots(20);
        setGameOver(false);
        setIsPlaying(true);
        onPlayAgain?.();
    }, [onPlayAgain]);

    useEffect(() => {
        if (autoStart && !isPlaying && !gameOver) {
            resetGame();
        }
    }, [autoStart, isPlaying, gameOver, resetGame]);

    const handlePop = (id: number, x: number, y: number, color: string) => {
        if (!isPlaying || gameOver) return;
        setBalloons(prev => prev.map(b => b.id === id ? { ...b, popped: true } : b));
        setScore(s => s + 10);
        setShots(s => s - 1);
        createParticles(x, y, color);
    };

    const handleMiss = () => {
        if (!isPlaying || gameOver) return;
        setShots(s => s - 1);
    };

    useEffect(() => {
        if (shots <= 0 && isPlaying) {
            setGameOver(true);
            setIsPlaying(false);
            onGameEnd?.(score);
        }
    }, [shots, isPlaying, score, onGameEnd]);

    // Balloon Spawner and Mover
    useEffect(() => {
        if (!isPlaying || gameOver) return;
        const interval = setInterval(() => {
            // Move balloons and sway them using Math.sin
            setBalloons(prev => {
                const time = Date.now() / 1000;
                return [
                    ...prev.filter(b => !b.popped && b.y > -100).map(b => ({
                        ...b,
                        y: b.y - (1.5 + b.scale),
                        x: b.x + Math.sin(time * 2 + b.offset) * 0.5
                    })),
                    ...(prev.length < 8 && Math.random() > 0.95 ? [{
                        id: Date.now() + Math.random(),
                        x: Math.random() * (WIDTH - 60) + 30,
                        y: HEIGHT + 50,
                        color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        popped: false,
                        offset: Math.random() * Math.PI * 2,
                        scale: 0.8 + Math.random() * 0.4
                    }] : [])
                ];
            });

            // Update particles
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                vy: p.vy + 0.2, // Gravity
                life: p.life - 0.05
            })).filter(p => p.life > 0));
        }, 30);
        return () => clearInterval(interval);
    }, [isPlaying, gameOver]);

    // AI Logic (Balanced)
    useEffect(() => {
        if (!agentControlled || !isPlaying || gameOver) return;

        const aiInterval = setInterval(() => {
            // Add a randomized "thinking" delay to make it feel more human
            if (Math.random() < 0.3) return;

            const currentBalloons = balloonsRef.current.filter(b => !b.popped && b.y > 20 && b.y < HEIGHT);

            if (currentBalloons.length > 0 && shotsRef.current > 0) {
                // Target the lowest balloon (closest to disappearing)
                const target = currentBalloons.sort((a, b) => a.y - b.y)[0];

                // 15% chance to "miss" the shot
                if (Math.random() < 0.15) {
                    handleMiss();
                    if (onMove) onMove(`Agent evaluated target at (${Math.round(target.x)}, ${Math.round(target.y)}) but missed!`);
                } else {
                    handlePop(target.id, target.x, target.y, target.color);
                    if (onMove) onMove(`Agent popped target at (${Math.round(target.x)}, ${Math.round(target.y)})`);
                }
            }
        }, 550); // Increased interval for slower reaction
        return () => clearInterval(aiInterval);
    }, [agentControlled, isPlaying, gameOver]);


    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex justify-between w-full px-2 text-xs font-bold uppercase tracking-tighter text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Target className="w-3 h-3" />
                    SCORE: <span className="text-primary font-mono text-sm">{score}</span>
                </div>
                <div className="flex items-center gap-2">
                    AMMO: <span className={cn("font-mono text-sm", shots < 5 ? "text-destructive" : "text-primary")}>{shots}</span>
                </div>
            </div>

            <div
                ref={containerRef}
                className={cn(
                    "relative border-4 rounded-2xl overflow-hidden cursor-none",
                    "bg-gradient-to-b from-sky-400 to-sky-200 shadow-2xl transition-all duration-500",
                    playerNumber === 1 ? "border-agentX/40" : "border-agentO/40"
                )}
                style={{ width: WIDTH, height: HEIGHT }}
                onClick={handleMiss}
            >
                {/* Decorative Clouds */}
                <Cloud className="absolute top-10 left-4 w-12 h-12 text-white/30 animate-pulse" />
                <Cloud className="absolute top-32 right-8 w-16 h-16 text-white/20" style={{ animationDelay: '1s' }} />
                <Cloud className="absolute top-60 left-12 w-10 h-10 text-white/40" style={{ animationDelay: '2s' }} />

                {/* Floating Balloons */}
                {balloons.map(b => !b.popped && (
                    <div
                        key={b.id}
                        className="absolute cursor-pointer group"
                        style={{
                            left: b.x,
                            top: b.y,
                            transform: `scale(${b.scale})`,
                            transition: 'transform 0.1s ease-out'
                        }}
                        onClick={(e) => { e.stopPropagation(); handlePop(b.id, b.x, b.y, b.color); }}
                    >
                        {/* Balloon Body */}
                        <div
                            className="relative w-10 h-12 rounded-[50%_50%_50%_50%/40%_40%_60%_60%] shadow-xl"
                            style={{
                                backgroundColor: b.color,
                                boxShadow: `inset -4px -4px 10px rgba(0,0,0,0.2), inset 4px 4px 10px rgba(255,255,255,0.4)`
                            }}
                        >
                            {/* Highlight */}
                            <div className="absolute top-2 left-2 w-3 h-4 bg-white/30 rounded-full blur-[1px]" />

                            {/* Knot */}
                            <div
                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-2"
                                style={{
                                    borderLeft: '6px solid transparent',
                                    borderRight: '6px solid transparent',
                                    borderBottom: `6px solid ${b.color}`
                                }}
                            />
                        </div>
                        {/* String */}
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[1px] h-10 bg-white/40 origin-top rotate-2" />
                    </div>
                ))}

                {/* Popped Particles */}
                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute rounded-full"
                        style={{
                            width: 4,
                            height: 4,
                            left: p.x,
                            top: p.y,
                            backgroundColor: p.color,
                            opacity: p.life,
                            transform: `scale(${p.life})`
                        }}
                    />
                ))}

                {/* Custom Crosshair */}
                {!gameOver && isPlaying && !agentControlled && (
                    <div
                        className="absolute pointer-events-none z-50 mix-blend-difference"
                        style={{
                            left: 'calc(var(--mouse-x, 0px) - 12px)',
                            top: 'calc(var(--mouse-y, 0px) - 12px)'
                        }}
                    >
                        <Target className="w-6 h-6 text-white brightness-200" />
                    </div>
                )}

                {/* Game Over Screen */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
                        <div className="bg-white/10 p-8 rounded-3xl border border-white/20 text-center shadow-2xl">
                            <div className="text-4xl font-black text-white italic mb-2 drop-shadow-lg">
                                TIME'S UP!
                            </div>
                            <div className="text-6xl font-mono text-white mb-6 drop-shadow-md">
                                {score}
                            </div>
                            <Button
                                onClick={(e) => { e.stopPropagation(); resetGame(); }}
                                className="bg-white text-sky-600 hover:bg-sky-50 font-bold px-8 py-6 rounded-2xl text-xl shadow-xl transition-transform active:scale-95"
                            >
                                <RotateCcw className="w-6 h-6 mr-2" /> REPLAY
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mouse tracker for custom cursor */}
            <div
                className="hidden"
                ref={(el) => {
                    if (el && containerRef.current) {
                        const container = containerRef.current;
                        const handleMouseMove = (e: MouseEvent) => {
                            const rect = container.getBoundingClientRect();
                            container.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                            container.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                        };
                        container.addEventListener('mousemove', handleMouseMove);
                    }
                }}
            />
        </div>
    );
}
