import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { type Move } from '@/lib/api';

interface ReplayControlsProps {
  moves: Move[];
  currentMoveIndex: number;
  onMoveChange: (index: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export function ReplayControls({
  moves,
  currentMoveIndex,
  onMoveChange,
  isPlaying,
  onPlayPause,
  onReset,
  playbackSpeed,
  onSpeedChange,
}: ReplayControlsProps) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border space-y-4">
      {/* Timeline slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Move {currentMoveIndex} / {moves.length}</span>
          <span className="font-mono">{playbackSpeed}x speed</span>
        </div>
        <Slider
          value={[currentMoveIndex]}
          min={0}
          max={moves.length}
          step={1}
          onValueChange={([value]) => onMoveChange(value)}
          className="w-full"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          className="h-10 w-10"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMoveChange(Math.max(0, currentMoveIndex - 1))}
          disabled={currentMoveIndex === 0}
          className="h-10 w-10"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={onPlayPause}
          className="h-12 w-12"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMoveChange(Math.min(moves.length, currentMoveIndex + 1))}
          disabled={currentMoveIndex === moves.length}
          className="h-10 w-10"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Speed:</span>
        <div className="flex gap-1">
          {[0.5, 1, 2, 4].map((speed) => (
            <Button
              key={speed}
              variant={playbackSpeed === speed ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSpeedChange(speed)}
              className="font-mono"
            >
              {speed}x
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
