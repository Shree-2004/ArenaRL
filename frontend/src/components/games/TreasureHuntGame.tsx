import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Skull, Trophy, Footprints } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position { x: number; y: number; }

interface TreasureHuntGameProps {
    playerNumber: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    onPlayAgain?: () => void;
    onMove?: (reasoning: string) => void;
}

const GRID = 6;
const CELL = 48;

const TERRAIN_COLORS = [
    'bg-emerald-900/30', 'bg-green-900/40', 'bg-teal-900/30',
    'bg-emerald-800/30', 'bg-green-800/40', 'bg-teal-800/30'
];

export function TreasureHuntGame({
    playerNumber, onGameEnd, agentControlled = false,
    autoStart = false, onPlayAgain, onMove,
}: TreasureHuntGameProps) {
    const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
    const [treasure] = useState<Position>({ x: GRID - 1, y: GRID - 1 });
    const [traps, setTraps] = useState<Position[]>([]);
    const [visited, setVisited] = useState<Set<string>>(new Set(['0,0']));
    const [gameOver, setGameOver] = useState(false);
    const [gameWon, setGameWon] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [steps, setSteps] = useState(0);
    const [terrain] = useState(() => Array.from({ length: GRID * GRID }, () => Math.floor(Math.random() * TERRAIN_COLORS.length)));

    const posRef = useRef(pos);
    const trapsRef = useRef(traps);
    const isPlayingRef = useRef(isPlaying);
    const gameOverRef = useRef(gameOver);
    const lastPosRef = useRef<string[]>([]); // Track last 2 positions to avoid loops


    useEffect(() => { posRef.current = pos; }, [pos]);
    useEffect(() => { trapsRef.current = traps; }, [traps]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

    const reset = useCallback(() => {
        setPos({ x: 0, y: 0 });
        setVisited(new Set(['0,0']));
        setGameOver(false); setGameWon(false);
        setSteps(0);

        const newTraps: Position[] = [];
        while (newTraps.length < 5) {
            const t = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
            if ((t.x !== 0 || t.y !== 0) && (t.x !== GRID - 1 || t.y !== GRID - 1) && !newTraps.some(n => n.x === t.x && n.y === t.y)) {
                newTraps.push(t);
            }
        }
        setTraps(newTraps);
        setIsPlaying(true);
        lastPosRef.current = [];
        onPlayAgain?.();

    }, [onPlayAgain]);

    useEffect(() => { if (autoStart && !isPlaying && !gameOver) reset(); }, [autoStart, isPlaying, gameOver, reset]);

    const moveTo = useCallback((next: Position) => {
        if (!isPlayingRef.current || gameOverRef.current) return;
        const clamped = { x: Math.max(0, Math.min(GRID - 1, next.x)), y: Math.max(0, Math.min(GRID - 1, next.y)) };
        setPos(clamped);
        posRef.current = clamped;
        setVisited(v => new Set([...v, `${clamped.x},${clamped.y}`]));
        setSteps(s => s + 1);

        if (clamped.x === treasure.x && clamped.y === treasure.y) {
            setGameWon(true); setGameOver(true); setIsPlaying(false);
            onGameEnd?.(100);
        } else if (trapsRef.current.some(t => t.x === clamped.x && t.y === clamped.y)) {
            setGameOver(true); setIsPlaying(false);
            onGameEnd?.(0);
        }
    }, [treasure, onGameEnd]);

    // Keyboard
    useEffect(() => {
        if (agentControlled || !isPlaying || gameOver) return;
        const keys = playerNumber === 1
            ? { up: 'w', down: 's', left: 'a', right: 'd' }
            : { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

        const down = (e: KeyboardEvent) => {
            const p = posRef.current;
            if (e.key === keys.up || e.key === keys.up.toUpperCase()) moveTo({ x: p.x, y: p.y - 1 });
            else if (e.key === keys.down || e.key === keys.down.toUpperCase()) moveTo({ x: p.x, y: p.y + 1 });
            else if (e.key === keys.left || e.key === keys.left.toUpperCase()) moveTo({ x: p.x - 1, y: p.y });
            else if (e.key === keys.right || e.key === keys.right.toUpperCase()) moveTo({ x: p.x + 1, y: p.y });
        };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [agentControlled, isPlaying, gameOver, playerNumber, moveTo]);

    // AI
    useEffect(() => {
        if (!agentControlled || !isPlaying || gameOver) return;
        const ai = setInterval(() => {
            const cur = posRef.current;
            const trapsNow = trapsRef.current;

            const candidates: Position[] = [
                { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
                { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }
            ].filter(p => p.x >= 0 && p.x < GRID && p.y >= 0 && p.y < GRID && !trapsNow.some(t => t.x === p.x && t.y === p.y));

            if (candidates.length > 0) {
                // Penalize recently visited cells to break loops
                const best = candidates.reduce((a, b) => {
                    const aKey = `${a.x},${a.y}`;
                    const bKey = `${b.x},${b.y}`;

                    const aHistoryIdx = lastPosRef.current.indexOf(aKey);
                    const bHistoryIdx = lastPosRef.current.indexOf(bKey);

                    // Penalty for being in history (higher index = more recent = more penalty)
                    const aPenalty = aHistoryIdx !== -1 ? (aHistoryIdx + 1) * 10 : 0;
                    const bPenalty = bHistoryIdx !== -1 ? (bHistoryIdx + 1) * 10 : 0;

                    const da = Math.abs(a.x - (GRID - 1)) + Math.abs(a.y - (GRID - 1)) + aPenalty;
                    const db = Math.abs(b.x - (GRID - 1)) + Math.abs(b.y - (GRID - 1)) + bPenalty;
                    return da < db ? a : b;
                });

                // Update history
                lastPosRef.current = [cur.x + ',' + cur.y, ...lastPosRef.current].slice(0, 3);

                moveTo(best);
                if (onMove) onMove(`Agent ${playerNumber} → (${best.x}, ${best.y})`);
            }

        }, 500);
        return () => clearInterval(ai);
    }, [agentControlled, isPlaying, gameOver, playerNumber, moveTo, onMove]);

    // Distance hint
    const dist = Math.abs(pos.x - treasure.x) + Math.abs(pos.y - treasure.y);
    const distLabel = dist === 0 ? '🎯' : dist <= 2 ? '🔥 Very Hot!' : dist <= 4 ? '♨️ Warm' : '❄️ Cold';

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>Steps: <span className="font-mono text-primary">{steps}</span></span>
                <span className="text-sm">{distLabel}</span>
            </div>

            <div
                className={cn(
                    "relative p-2 rounded-2xl border-4 shadow-2xl overflow-hidden",
                    "bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950",
                    playerNumber === 1 ? "border-agentX/50" : "border-agentO/50"
                )}
                style={{ width: GRID * CELL + 16, height: GRID * CELL + 16 }}
            >
                {/* Grid cells */}
                <div className="grid" style={{ gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`, gap: '2px' }}>
                    {Array.from({ length: GRID * GRID }).map((_, i) => {
                        const cx = i % GRID;
                        const cy = Math.floor(i / GRID);
                        const isTrap = traps.some(t => t.x === cx && t.y === cy);
                        const isTreasure = treasure.x === cx && treasure.y === cy;
                        const isVisited = visited.has(`${cx},${cy}`);
                        const isStart = cx === 0 && cy === 0;

                        return (
                            <div key={i}
                                className={cn(
                                    "relative flex items-center justify-center rounded-lg transition-all duration-100",
                                    TERRAIN_COLORS[terrain[i]],
                                    "border border-white/5",
                                    isVisited && !isStart ? "ring-1 ring-white/20" : ""
                                )}
                                style={{ width: CELL, height: CELL }}
                            >
                                {isVisited && !isStart && !isTrap && !isTreasure && (
                                    <Footprints className="w-3 h-3 text-white/20" />
                                )}
                                {isTrap && <Skull className="w-6 h-6 text-red-400/70" />}
                                {isTreasure && !gameOver && (
                                    <div className="animate-bounce">
                                        <Trophy className="w-8 h-8 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px #facc15)' }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Player */}
                <div
                    className="absolute flex items-center justify-center transition-all duration-200 z-10"
                    style={{ width: CELL, height: CELL, left: pos.x * (CELL + 2) + 8, top: pos.y * (CELL + 2) + 8 }}
                >
                    <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-2",
                        playerNumber === 1 ? "bg-violet-600 border-violet-300" : "bg-emerald-600 border-emerald-300"
                    )}
                        style={{ boxShadow: playerNumber === 1 ? '0 0 16px #7c3aed' : '0 0 16px #059669' }}
                    >
                        <span className="text-lg">🧭</span>
                    </div>
                </div>

                {/* Game Over */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-xl">
                        {gameWon ? (
                            <>
                                <Trophy className="w-16 h-16 text-yellow-400 mb-4" style={{ filter: 'drop-shadow(0 0 12px #facc15)' }} />
                                <div className="text-3xl font-black text-yellow-300 italic mb-2">FOUND IT!</div>
                                <div className="text-lg text-white/60 mb-6">in {steps} steps</div>
                            </>
                        ) : (
                            <>
                                <Skull className="w-16 h-16 text-red-400 mb-4" style={{ filter: 'drop-shadow(0 0 12px #f87171)' }} />
                                <div className="text-3xl font-black text-red-400 italic mb-2">TRAPPED!</div>
                                <div className="text-lg text-white/60 mb-6">{steps} steps taken</div>
                            </>
                        )}
                        <Button onClick={reset} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 px-6 py-5 rounded-xl text-lg">
                            <RotateCcw className="w-5 h-5" /> Try Again
                        </Button>
                    </div>
                )}
            </div>

            {!agentControlled && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {playerNumber === 1 ? 'W/A/S/D to move' : 'Arrow keys to move'}
                </p>
            )}
        </div>
    );
}
