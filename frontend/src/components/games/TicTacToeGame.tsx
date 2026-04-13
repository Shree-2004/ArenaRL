import { useState, useEffect, useCallback } from 'react';
import { TicTacToeBoard } from './TicTacToeBoard';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Cell = 'X' | 'O' | null;
type Board = Cell[][];

interface TicTacToeGameProps {
    playerNumber?: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    autoStart?: boolean;
    player1Label?: string;
    player2Label?: string;
    hideStatus?: boolean;
}

// ---------- Game logic ----------
function createBoard(): Board {
    return Array.from({ length: 3 }, () => Array(3).fill(null));
}

function checkWinner(board: Board): { winner: Cell; cells: [number, number][] } | null {
    const lines: [number, number][][] = [
        [[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]], // rows
        [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]], // cols
        [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]],                      // diags
    ];
    for (const line of lines) {
        const [a, b, c] = line;
        if (board[a[0]][a[1]] && board[a[0]][a[1]] === board[b[0]][b[1]] && board[a[0]][a[1]] === board[c[0]][c[1]]) {
            return { winner: board[a[0]][a[1]], cells: line };
        }
    }
    return null;
}

function isDraw(board: Board): boolean {
    return board.every(row => row.every(c => c !== null));
}

function minimax(board: Board, isMax: boolean, aiSym: Cell): number {
    const opp: Cell = aiSym === 'X' ? 'O' : 'X';
    const result = checkWinner(board);
    if (result) return result.winner === aiSym ? 10 : -10;
    if (isDraw(board)) return 0;

    let best = isMax ? -Infinity : Infinity;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (board[r][c] === null) {
                board[r][c] = isMax ? aiSym : opp;
                const val = minimax(board, !isMax, aiSym);
                board[r][c] = null;
                best = isMax ? Math.max(best, val) : Math.min(best, val);
            }
        }
    }
    return best;
}

function getBestMove(board: Board, aiSym: Cell): [number, number] {
    let best = -Infinity;
    let move: [number, number] = [0, 0];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (board[r][c] === null) {
                board[r][c] = aiSym;
                const val = minimax(board, false, aiSym);
                board[r][c] = null;
                if (val > best) { best = val; move = [r, c]; }
            }
        }
    }
    return move;
}

// ---------- Component ----------
export function TicTacToeGame({
    onGameEnd,
    agentControlled = false,
    autoStart = false,
    player1Label = 'You',
    player2Label = 'Agent',
    hideStatus = false,
}: TicTacToeGameProps) {
    // In play mode: human is X, agent is O. In watch mode: both are agents.
    const humanSymbol: Cell = 'X';
    const aiSymbol: Cell = 'O';

    const [board, setBoard] = useState<Board>(createBoard);
    const [currentTurn, setCurrentTurn] = useState<Cell>('X');
    const [winner, setWinner] = useState<Cell | 'draw' | null>(null);
    const [winCells, setWinCells] = useState<[number, number][]>([]);
    const [lastMove, setLastMove] = useState<[number, number] | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [aiThinking, setAiThinking] = useState(false);

    useEffect(() => {
        if (autoStart) setIsStarted(true);
    }, [autoStart]);

    const applyMove = useCallback((row: number, col: number, sym: Cell, newBoard: Board) => {
        newBoard[row][col] = sym;
        const updated = newBoard.map(r => [...r]);
        setBoard(updated);
        setLastMove([row, col]);

        const result = checkWinner(updated);
        if (result) {
            setWinner(result.winner);
            setWinCells(result.cells);
            onGameEnd?.(result.winner === humanSymbol ? 1 : -1);
        } else if (isDraw(updated)) {
            setWinner('draw');
            onGameEnd?.(0);
        } else {
            setCurrentTurn(sym === 'X' ? 'O' : 'X');
        }
    }, [onGameEnd, humanSymbol]);

    const handleCellClick = (row: number, col: number) => {
        if (!isStarted || winner || board[row][col] !== null || aiThinking) return;
        if (agentControlled) return; // Both controlled by AI in watch mode
        if (currentTurn !== humanSymbol) return;

        const newBoard = board.map(r => [...r]) as Board;
        applyMove(row, col, humanSymbol, newBoard);
    };

    // AI move effect
    useEffect(() => {
        if (!isStarted || winner) return;

        const isAITurn = agentControlled
            ? true // in watch mode both sides are AI
            : currentTurn === aiSymbol;

        if (!isAITurn) return;

        setAiThinking(true);
        const snapshot = board.map(row => [...row]) as Board;
        const timeout = setTimeout(() => {
            const sym = agentControlled ? currentTurn : aiSymbol;
            const [r, c] = getBestMove(snapshot, sym);
            const newBoard = snapshot;
            setAiThinking(false);
            applyMove(r, c, sym, newBoard);
        }, agentControlled ? 600 : 400);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTurn, isStarted, winner, agentControlled]);

    const resetGame = () => {
        setBoard(createBoard());
        setCurrentTurn('X');
        setWinner(null);
        setWinCells([]);
        setLastMove(null);
        setAiThinking(false);
        setIsStarted(true);
    };

    const isHumanTurn = !agentControlled && currentTurn === humanSymbol && !winner;

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Status */}
            {!hideStatus && (
                <div className="text-sm font-medium h-5">
                    {!isStarted ? null : winner ? (
                        winner === 'draw' ? (
                            <span className="text-muted-foreground">Draw!</span>
                        ) : (
                            <span className={cn("font-bold", winner === 'X' ? "text-agentX" : "text-agentO")}>
                                {winner === humanSymbol ? player1Label : player2Label} Wins!
                            </span>
                        )
                    ) : (
                        <span className={cn(currentTurn === 'X' ? "text-agentX" : "text-agentO")}>
                            {isHumanTurn ? "Your turn (X)" : `${aiThinking ? "Thinking..." : `${currentTurn}'s turn`}`}
                        </span>
                    )}
                </div>
            )}

            <TicTacToeBoard
                board={board}
                onCellClick={handleCellClick}
                disabled={!isStarted || !!winner || !isHumanTurn}
                highlightWinner={winCells}
                lastMove={lastMove}
            />

            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="text-agentX font-medium">{player1Label} = X</span>
                <span className="text-agentO font-medium">{player2Label} = O</span>
            </div>

            {winner && !hideStatus && (
                <Button onClick={resetGame} size="sm" variant="outline" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Play Again
                </Button>
            )}

            {!agentControlled && isStarted && !winner && !hideStatus && (
                <p className="text-xs text-muted-foreground">Click a cell to place your X</p>
            )}
        </div>
    );
}
