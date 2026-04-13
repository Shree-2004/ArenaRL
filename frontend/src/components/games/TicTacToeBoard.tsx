import { cn } from '@/lib/utils';

interface TicTacToeBoardProps {
  board: (string | null)[][];
  onCellClick?: (row: number, col: number) => void;
  disabled?: boolean;
  highlightWinner?: [number, number][];
  lastMove?: [number, number] | null;
}

export function TicTacToeBoard({
  board,
  onCellClick,
  disabled = false,
  highlightWinner,
  lastMove,
}: TicTacToeBoardProps) {
  const isWinningCell = (row: number, col: number) => {
    return highlightWinner?.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (row: number, col: number) => {
    return lastMove && lastMove[0] === row && lastMove[1] === col;
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-4 bg-card rounded-xl border border-border shadow-lg max-w-xs mx-auto">
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <button
            key={`${rowIndex}-${colIndex}`}
            onClick={() => !disabled && onCellClick?.(rowIndex, colIndex)}
            disabled={disabled || cell !== null}
            className={cn(
              "w-20 h-20 rounded-lg font-mono text-4xl font-bold transition-all duration-200 flex items-center justify-center",
              "border-2 border-border hover:border-primary/50",
              cell === null && !disabled && "hover:bg-primary/10 cursor-pointer",
              cell === 'X' && "text-agentX",
              cell === 'O' && "text-agentO",
              isWinningCell(rowIndex, colIndex) && "bg-success/20 border-success",
              isLastMove(rowIndex, colIndex) && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              disabled && cell === null && "opacity-50 cursor-not-allowed"
            )}
          >
            {cell}
          </button>
        ))
      )}
    </div>
  );
}
