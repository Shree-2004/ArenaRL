import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';

interface TwoPlayerWrapperProps {
  player1Component: React.ReactNode;
  player2Component: React.ReactNode;
  player1Label: string;
  player2Label: string;
  player1Score?: number;
  player2Score?: number;
  winner?: 1 | 2 | null;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function TwoPlayerWrapper({
  player1Component,
  player2Component,
  player1Label,
  player2Label,
  player1Score,
  player2Score,
  winner,
  onFullscreenChange,
}: TwoPlayerWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      onFullscreenChange?.(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [onFullscreenChange]);

  const toggleFullscreen = async () => {
    const container = document.getElementById('two-player-container');
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  return (
    <div 
      id="two-player-container"
      className={cn(
        "relative",
        isFullscreen && "fixed inset-0 z-50 bg-background p-4 flex flex-col"
      )}
    >
      {/* Fullscreen toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-10 gap-2"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </Button>

      {/* Winner banner */}
      {winner && (
        <div className={cn(
          "text-center py-4 text-3xl font-bold animate-pulse",
          winner === 1 ? "text-agentX" : "text-agentO"
        )}>
          🏆 {winner === 1 ? player1Label : player2Label} Wins! 🏆
        </div>
      )}

      {/* Split screen */}
      <div className={cn(
        "flex gap-4",
        isFullscreen ? "flex-1" : "min-h-[400px]"
      )}>
        {/* Player 1 */}
        <div className={cn(
          "flex-1 flex flex-col border-2 border-agentX rounded-xl overflow-hidden",
          winner === 1 && "ring-4 ring-agentX"
        )}>
          <div className="bg-agentX/20 px-4 py-2 flex justify-between items-center">
            <span className="font-bold text-agentX">{player1Label}</span>
            {player1Score !== undefined && (
              <span className="font-mono text-agentX">Score: {player1Score}</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {player1Component}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center">
          <div className="text-4xl font-bold text-muted-foreground">VS</div>
        </div>

        {/* Player 2 */}
        <div className={cn(
          "flex-1 flex flex-col border-2 border-agentO rounded-xl overflow-hidden",
          winner === 2 && "ring-4 ring-agentO"
        )}>
          <div className="bg-agentO/20 px-4 py-2 flex justify-between items-center">
            <span className="font-bold text-agentO">{player2Label}</span>
            {player2Score !== undefined && (
              <span className="font-mono text-agentO">Score: {player2Score}</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {player2Component}
          </div>
        </div>
      </div>
    </div>
  );
}