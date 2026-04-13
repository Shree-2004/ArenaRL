import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Connect4BoardProps {
  board: (string | null)[][];
  onColumnClick?: (col: number) => void;
  disabled?: boolean;
  highlightWinner?: [number, number][];
  lastMove?: [number, number] | null;
}

export function Connect4Board({
  board,
  onColumnClick,
  disabled = false,
  highlightWinner,
  lastMove,
}: Connect4BoardProps) {
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);

  const actualRows = board.length;
  const actualCols = board[0]?.length || 7;

  const isWinningCell = (row: number, col: number) => {
    return highlightWinner?.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (row: number, col: number) => {
    return lastMove && lastMove[0] === row && lastMove[1] === col;
  };

  const canDropInColumn = (col: number) => {
    return board[0]?.[col] === null;
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border shadow-lg inline-block overflow-auto max-w-full">
      {/* Column indicators */}
      <div 
        className="grid gap-1 mb-2"
        style={{ gridTemplateColumns: `repeat(${actualCols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: actualCols }).map((_, col) => (
          <button
            key={col}
            onClick={() => !disabled && canDropInColumn(col) && onColumnClick?.(col)}
            onMouseEnter={() => setHoverColumn(col)}
            onMouseLeave={() => setHoverColumn(null)}
            disabled={disabled || !canDropInColumn(col)}
            className={cn(
              "w-10 h-7 md:w-12 md:h-8 rounded-t-lg transition-all duration-200 text-xs font-mono",
              canDropInColumn(col) && !disabled
                ? "bg-primary/20 hover:bg-primary/40 cursor-pointer"
                : "bg-muted cursor-not-allowed opacity-50"
            )}
          >
            ↓
          </button>
        ))}
      </div>

      {/* Board */}
      <div 
        className="grid gap-1 bg-info/20 p-2 rounded-lg"
        style={{ gridTemplateColumns: `repeat(${actualCols}, minmax(0, 1fr))` }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all duration-300 flex items-center justify-center",
                cell === null && "bg-background border-border",
                cell === 'X' && "bg-agentX border-agentX shadow-lg",
                cell === 'O' && "bg-agentO border-agentO shadow-lg",
                isWinningCell(rowIndex, colIndex) && "ring-4 ring-success ring-offset-2",
                isLastMove(rowIndex, colIndex) && "scale-110",
                hoverColumn === colIndex && cell === null && "bg-primary/20"
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}
