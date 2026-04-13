import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROWS = 6;
const COLS = 7;

type Cell = 'X' | 'O' | null;
type Board = Cell[][];

interface Connect4GameProps {
    playerNumber: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    playerSymbol?: 'X' | 'O';
    player1Label?: string;
    player2Label?: string;
    hideStatus?: boolean;
    onMove?: (reasoning: string) => void;
}

function createBoard(): Board { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }

function dropPiece(board: Board, col: number, symbol: Cell): Board | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === null) { const next = board.map(row => [...row]); next[r][col] = symbol; return next; }
    }
    return null;
}

function checkWinner(board: Board): { winner: Cell; cells: [number, number][] } | null {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const sym = board[r][c]; if (!sym) continue;
            for (const [dr, dc] of dirs) {
                const cells: [number, number][] = [[r, c]];
                for (let k = 1; k < 4; k++) {
                    const nr = r + dr * k, nc = c + dc * k;
                    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== sym) break;
                    cells.push([nr, nc]);
                }
                if (cells.length === 4) return { winner: sym, cells };
            }
        }
    }
    return null;
}

function isDraw(board: Board): boolean { return board[0].every(c => c !== null); }
function getValidCols(board: Board): number[] { return Array.from({ length: COLS }, (_, i) => i).filter(c => board[0][c] === null); }

function scoreWindow(w: Cell[], sym: Cell): number {
    const opp = sym === 'X' ? 'O' : 'X';
    const cnt = w.filter(c => c === sym).length, empty = w.filter(c => c === null).length, oppCnt = w.filter(c => c === opp).length;
    if (cnt === 4) return 100; if (cnt === 3 && empty === 1) return 5; if (cnt === 2 && empty === 2) return 2;
    if (oppCnt === 3 && empty === 1) return -4; return 0;
}

function scoreBoard(b: Board, sym: Cell): number {
    let score = 0;
    score += b.map(r => r[Math.floor(COLS / 2)]).filter(c => c === sym).length * 3;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 3; c++) score += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], sym);
    for (let r = 0; r < ROWS - 3; r++) for (let c = 0; c < COLS; c++) score += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], sym);
    for (let r = 0; r < ROWS - 3; r++) for (let c = 0; c < COLS - 3; c++) score += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], sym);
    for (let r = 3; r < ROWS; r++) for (let c = 0; c < COLS - 3; c++) score += scoreWindow([b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]], sym);
    return score;
}

function minimax(b: Board, depth: number, alpha: number, beta: number, max: boolean, ai: Cell): number {
    if (depth === 0 || !!checkWinner(b) || isDraw(b)) { const w = checkWinner(b); if (w) return w.winner === ai ? 100000 : -100000; return scoreBoard(b, ai); }
    const opp: Cell = ai === 'X' ? 'O' : 'X'; const valid = getValidCols(b);
    if (max) { let val = -Infinity; for (const col of valid) { const next = dropPiece(b, col, ai)!; val = Math.max(val, minimax(next, depth - 1, alpha, beta, false, ai)); alpha = Math.max(alpha, val); if (alpha >= beta) break; } return val; }
    else { let val = Infinity; for (const col of valid) { const next = dropPiece(b, col, opp)!; val = Math.min(val, minimax(next, depth - 1, alpha, beta, true, ai)); beta = Math.min(beta, val); if (alpha >= beta) break; } return val; }
}

function getBestMove(board: Board, aiSym: Cell, depth = 4): number {
    const valid = getValidCols(board); let best = -Infinity, bestCol = valid[Math.floor(Math.random() * valid.length)];
    for (const col of valid) { const next = dropPiece(board, col, aiSym)!; const score = minimax(next, depth - 1, -Infinity, Infinity, false, aiSym); if (score > best) { best = score; bestCol = col; } }
    return bestCol;
}

export function Connect4Game({
    playerNumber, onGameEnd, agentControlled = false, isFullscreen = false, autoStart = false,
    playerSymbol = 'X', player1Label = 'You', player2Label = 'Agent', hideStatus = false, onMove,
}: Connect4GameProps) {
    const aiSymbol: Cell = playerSymbol === 'X' ? 'O' : 'X';
    const [board, setBoard] = useState<Board>(createBoard);
    const [currentTurn, setCurrentTurn] = useState<Cell>('X');
    const [winner, setWinner] = useState<Cell | 'draw' | null>(null);
    const [winCells, setWinCells] = useState<[number, number][]>([]);
    const [hoverCol, setHoverCol] = useState<number | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [lastDrop, setLastDrop] = useState<[number, number] | null>(null);
    const [aiThinking, setAiThinking] = useState(false);

    useEffect(() => { if (autoStart) setIsStarted(true); }, [autoStart]);

    const resetGame = useCallback(() => {
        setBoard(createBoard()); setCurrentTurn('X'); setWinner(null); setWinCells([]); setLastDrop(null); setAiThinking(false); setIsStarted(true);
    }, []);

    const applyMove = useCallback((col: number, sym: Cell, cur: Board) => {
        const nb = dropPiece(cur, col, sym); if (!nb) return;
        for (let r = ROWS - 1; r >= 0; r--) { if (nb[r][col] !== null && cur[r][col] === null) { setLastDrop([r, col]); break; } }
        const updated = nb.map(r => [...r]) as Board; setBoard(updated);
        const result = checkWinner(updated);
        if (result) { setWinner(result.winner); setWinCells(result.cells); onGameEnd?.(result.winner === playerSymbol ? 1 : -1); }
        else if (isDraw(updated)) { setWinner('draw'); onGameEnd?.(0); }
        else { setCurrentTurn(sym === 'X' ? 'O' : 'X'); }
    }, [playerSymbol, onGameEnd]);

    const handleDrop = (col: number) => {
        if (winner || !isStarted || aiThinking || currentTurn !== playerSymbol) return;
        applyMove(col, currentTurn, board.map(r => [...r]) as Board);
    };

    useEffect(() => {
        if (!isStarted || winner) return;
        const isAITurn = agentControlled ? true : currentTurn === aiSymbol;
        if (!isAITurn) return;
        setAiThinking(true);
        const snap = board.map(r => [...r]) as Board;
        const t = setTimeout(() => {
            const col = getBestMove(snap, currentTurn);
            setAiThinking(false);
            if (onMove) onMove(`Minimax → column ${col + 1} (depth 4)`);
            applyMove(col, currentTurn, snap);
        }, 350);
        return () => clearTimeout(t);
    }, [currentTurn, isStarted, winner, agentControlled]);

    const isWinCell = (r: number, c: number) => winCells.some(([wr, wc]) => wr === r && wc === c);
    const isLastDropCell = (r: number, c: number) => lastDrop?.[0] === r && lastDrop?.[1] === c;
    const canDrop = (col: number) => board[0][col] === null && !winner && isStarted;
    const isHumanTurn = !agentControlled && currentTurn === playerSymbol && !winner;

    return (
        <div className="flex flex-col items-center gap-3">
            {!hideStatus && (
                <div className="text-sm font-bold h-5">
                    {!isStarted ? (
                        <span className="text-muted-foreground">Ready</span>
                    ) : winner ? (
                        winner === 'draw'
                            ? <span className="text-muted-foreground">Draw!</span>
                            : <span className={cn("font-black", winner === 'X' ? "text-violet-400" : "text-orange-400")}>
                                {winner === playerSymbol ? player1Label : player2Label} Wins! 🏆
                            </span>
                    ) : (
                        <span className={cn(currentTurn === 'X' ? "text-violet-400" : "text-orange-400")}>
                            {isHumanTurn ? '● Your turn' : aiThinking ? '🤔 Agent thinking...' : '● Agent moving...'}
                        </span>
                    )}
                </div>
            )}

            <div className="select-none">
                {/* Column drop zones */}
                <div className="flex gap-1 mb-1 px-1">
                    {Array.from({ length: COLS }, (_, col) => (
                        <button key={col}
                            className={cn("rounded-t-md text-base font-black transition-all duration-150",
                                canDrop(col) && isHumanTurn
                                    ? `text-${currentTurn === 'X' ? 'violet' : 'orange'}-400 hover:scale-110 cursor-pointer opacity-70 hover:opacity-100`
                                    : "opacity-0 cursor-default"
                            )}
                            style={{ width: 40, height: 24 }}
                            onClick={() => isHumanTurn && handleDrop(col)}
                            onMouseEnter={() => isHumanTurn && setHoverCol(col)}
                            onMouseLeave={() => setHoverCol(null)}
                        >▼</button>
                    ))}
                </div>

                {/* Board */}
                <div
                    className="p-2 rounded-2xl shadow-2xl border-4"
                    style={{ background: 'linear-gradient(135deg, #1a2a6c, #0e1b52)', borderColor: '#2d4db066', display: 'inline-block' }}
                >
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 40px)` }}>
                        {board.map((row, r) => row.map((cell, c) => {
                            const isWin = isWinCell(r, c);
                            const isLast = isLastDropCell(r, c);
                            const showHover = cell === null && hoverCol === c && isHumanTurn;
                            return (
                                <div key={`${r}-${c}`}
                                    className={cn("w-10 h-10 rounded-full border-2 transition-all duration-200 cursor-default relative overflow-hidden",
                                        cell === null ? "border-blue-800/40 bg-slate-900/60" : "",
                                        cell === 'X' ? "border-violet-400 bg-violet-600" : "",
                                        cell === 'O' ? "border-orange-400 bg-orange-500" : "",
                                        isWin ? "ring-4 ring-yellow-400 ring-offset-1 scale-110 z-10" : "",
                                        isLast ? "scale-105" : "",
                                        showHover ? (currentTurn === 'X' ? "bg-violet-600/30 border-violet-500/50" : "bg-orange-500/30 border-orange-500/50") : "",
                                        canDrop(c) && isHumanTurn ? "cursor-pointer" : ""
                                    )}
                                    style={{
                                        boxShadow: cell === 'X' ? '0 0 12px #7c3aed88' : cell === 'O' ? '0 0 12px #f9731688' : 'inset 0 2px 4px rgba(0,0,0,0.5)',
                                    }}
                                    onClick={() => isHumanTurn && handleDrop(c)}
                                    onMouseEnter={() => isHumanTurn && setHoverCol(c)}
                                    onMouseLeave={() => setHoverCol(null)}
                                >
                                    {cell && <div className="absolute top-1 left-2 w-2 h-2 rounded-full bg-white/20" />}
                                </div>
                            );
                        }))}
                    </div>
                </div>
            </div>

            {winner && !hideStatus && (
                <Button onClick={resetGame} size="sm" variant="outline" className="gap-2 mt-1">
                    <RotateCcw className="w-4 h-4" /> Play Again
                </Button>
            )}
            {!agentControlled && !hideStatus && (
                <p className="text-xs text-muted-foreground">Click a column to drop</p>
            )}
        </div>
    );
}
