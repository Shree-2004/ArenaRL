import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Hand, Scissors, FileText, RotateCcw, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Choice = 'rock' | 'paper' | 'scissors' | null;

interface QTableEntry {
  rock: number;
  paper: number;
  scissors: number;
}

interface RockPaperScissorsBoardProps {
  playerChoice?: Choice;
  opponentChoice?: Choice;
  onChoice?: (choice: Choice, agentChoice: Choice, result: 'win' | 'lose' | 'draw') => void;
  disabled?: boolean;
  result?: 'win' | 'lose' | 'draw' | null;
  playerLabel?: string;
  opponentLabel?: string;
  agentControlled?: boolean;
  watchMode?: boolean;
  hideStats?: boolean;
}

const choices: { id: Choice; label: string; icon: typeof Hand; beats: Choice }[] = [
  { id: 'rock', label: 'Rock', icon: Hand, beats: 'scissors' },
  { id: 'paper', label: 'Paper', icon: FileText, beats: 'rock' },
  { id: 'scissors', label: 'Scissors', icon: Scissors, beats: 'paper' },
];

// Q-Learning agents for both players
const initialQTable: QTableEntry = { rock: 0, paper: 0, scissors: 0 };
const LEARNING_RATE = 0.1;
const EPSILON = 0.2;

export function RockPaperScissorsBoard({
  onChoice,
  disabled = false,
  playerLabel = 'Player 1',
  opponentLabel = 'Player 2',
  agentControlled = false,
  watchMode = false,
  hideStats = false,
}: RockPaperScissorsBoardProps) {
  const [playerChoice, setPlayerChoice] = useState<Choice>(null);
  const [opponentChoice, setOpponentChoice] = useState<Choice>(null);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [player1QTable, setPlayer1QTable] = useState<QTableEntry>(initialQTable);
  const [player2QTable, setPlayer2QTable] = useState<QTableEntry>(initialQTable);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [roundCount, setRoundCount] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Agent selects move using epsilon-greedy policy based on RPS-specific Q-table
  const getAgentChoice = useCallback((qTable: QTableEntry): Choice => {
    if (Math.random() < EPSILON) {
      // Exploration: random choice
      const choiceList: Choice[] = ['rock', 'paper', 'scissors'];
      return choiceList[Math.floor(Math.random() * 3)];
    } else {
      // Exploitation: choose best action based on Q-table
      const entries = Object.entries(qTable) as [Choice, number][];
      const maxQ = Math.max(...entries.map(([_, v]) => v));
      const bestActions = entries.filter(([_, v]) => v === maxQ).map(([k]) => k);
      return bestActions[Math.floor(Math.random() * bestActions.length)];
    }
  }, []);

  // Update Q-table based on result (RPS-specific: reward for winning)
  const updateQTable = useCallback((setQTable: React.Dispatch<React.SetStateAction<QTableEntry>>, choice: Choice, reward: number) => {
    if (!choice) return;
    setQTable(prev => ({
      ...prev,
      [choice]: prev[choice] + LEARNING_RATE * (reward - prev[choice])
    }));
  }, []);

  const playRound = useCallback((p1Choice: Choice, p2Choice: Choice) => {
    if (!p1Choice || !p2Choice) return;

    const gameResult = determineRPSWinner(p1Choice, p2Choice);

    setPlayerChoice(p1Choice);
    setOpponentChoice(p2Choice);
    setResult(gameResult);
    setIsRevealing(true);
    setRoundCount(r => r + 1);

    // Update Q-tables (reward from each player's perspective)
    // Player 1: win = 1, lose = -1, draw = 0
    const p1Reward = gameResult === 'win' ? 1 : gameResult === 'lose' ? -1 : 0;
    updateQTable(setPlayer1QTable, p1Choice, p1Reward);
    // Player 2: opposite rewards
    updateQTable(setPlayer2QTable, p2Choice, -p1Reward);

    // Update stats (from player 1's perspective)
    setStats(prev => ({
      wins: prev.wins + (gameResult === 'win' ? 1 : 0),
      losses: prev.losses + (gameResult === 'lose' ? 1 : 0),
      draws: prev.draws + (gameResult === 'draw' ? 1 : 0),
    }));

    // Notify parent
    onChoice?.(p1Choice, p2Choice, gameResult!);

    // Show result after brief animation
    setTimeout(() => {
      setShowResult(true);
      setIsRevealing(false);
    }, 500);
  }, [updateQTable, onChoice]);

  const handleChoice = useCallback((choice: Choice) => {
    if (!choice || disabled || playerChoice) return;

    // Human made a choice, agent responds immediately
    const agentChoice = getAgentChoice(player2QTable);
    playRound(choice, agentChoice);
  }, [disabled, playerChoice, getAgentChoice, player2QTable, playRound]);

  // Auto-start after 5 seconds when watch mode is activated
  useEffect(() => {
    if (!watchMode) return;

    // Start auto-playing 5 seconds after watch mode begins
    const startTimer = setTimeout(() => {
      setIsAutoPlaying(true);
    }, 5000);

    return () => clearTimeout(startTimer);
  }, [watchMode]);

  // Agent vs Agent auto-play
  useEffect(() => {
    if (!watchMode || !isAutoPlaying || showResult) return;

    autoPlayRef.current = setTimeout(() => {
      const p1Choice = getAgentChoice(player1QTable);
      const p2Choice = getAgentChoice(player2QTable);
      playRound(p1Choice, p2Choice);
    }, 1500);

    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [watchMode, isAutoPlaying, showResult, getAgentChoice, player1QTable, player2QTable, playRound]);

  // Auto-continue in watch mode after result shown
  useEffect(() => {
    if (!watchMode || !isAutoPlaying || !showResult) return;

    const timeout = setTimeout(() => {
      resetRound();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [watchMode, isAutoPlaying, showResult]);

  const resetRound = () => {
    setPlayerChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setShowResult(false);
    setIsRevealing(false);
  };

  const getChoiceIcon = (choice: Choice) => {
    const c = choices.find(ch => ch.id === choice);
    if (!c) return null;
    const Icon = c.icon;
    return <Icon className="w-12 h-12 md:w-16 md:h-16" />;
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Stats */}
      {!hideStats && (
        <div className="flex gap-4 text-sm">
          <span className="text-success">P1 Wins: {stats.wins}</span>
          <span className="text-muted-foreground">Draws: {stats.draws}</span>
          <span className="text-destructive">P2 Wins: {stats.losses}</span>
          <span className="text-muted-foreground">Round: {roundCount}</span>
        </div>
      )}

      {/* Q-Table Display */}
      {!hideStats && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="bg-muted/50 px-3 py-2 rounded">
            P1 Q-Values: R:{player1QTable.rock.toFixed(2)} P:{player1QTable.paper.toFixed(2)} S:{player1QTable.scissors.toFixed(2)}
          </div>
          <div className="bg-muted/50 px-3 py-2 rounded">
            P2 Q-Values: R:{player2QTable.rock.toFixed(2)} P:{player2QTable.paper.toFixed(2)} S:{player2QTable.scissors.toFixed(2)}
          </div>
        </div>
      )}

      {/* Watch Mode Controls */}
      {watchMode && (
        <div className="flex gap-2">
          <Button
            variant={isAutoPlaying ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="gap-2"
          >
            {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isAutoPlaying ? 'Pause' : 'Auto Play'}
          </Button>
        </div>
      )}

      {/* Battle Arena */}
      <div className="flex items-center justify-center gap-8 md:gap-16">
        {/* Player Side */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-agentX">{playerLabel}</span>
          <div
            className={cn(
              "w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-agentX bg-agentX/10 flex items-center justify-center transition-all duration-300",
              playerChoice && "scale-110 shadow-lg shadow-agentX/30",
              isRevealing && "animate-pulse"
            )}
          >
            {playerChoice ? (
              <div className="text-agentX">{getChoiceIcon(playerChoice)}</div>
            ) : (
              <span className="text-4xl text-muted-foreground">?</span>
            )}
          </div>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl font-bold font-mono text-muted-foreground">VS</span>
          {showResult && result && (
            <div
              className={cn(
                "text-lg font-bold animate-scale-in px-4 py-1 rounded-full",
                result === 'win' && "text-success bg-success/20",
                result === 'lose' && "text-destructive bg-destructive/20",
                result === 'draw' && "text-warning bg-warning/20"
              )}
            >
              {result === 'win' ? 'P1 WINS!' : result === 'lose' ? 'P2 WINS!' : 'DRAW!'}
            </div>
          )}
        </div>

        {/* Opponent Side */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-agentO">{opponentLabel}</span>
          <div
            className={cn(
              "w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-agentO bg-agentO/10 flex items-center justify-center transition-all duration-300",
              opponentChoice && showResult && "scale-110 shadow-lg shadow-agentO/30",
              isRevealing && "animate-pulse"
            )}
          >
            {opponentChoice && showResult ? (
              <div className="text-agentO">{getChoiceIcon(opponentChoice)}</div>
            ) : opponentChoice ? (
              <span className="text-4xl text-muted-foreground animate-bounce">?</span>
            ) : (
              <span className="text-4xl text-muted-foreground">?</span>
            )}
          </div>
        </div>
      </div>

      {/* Choice Buttons - only show for human player */}
      {!watchMode && (
        <div className="flex gap-4">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              variant={playerChoice === choice.id ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleChoice(choice.id)}
              disabled={disabled || !!playerChoice}
              className={cn(
                "flex flex-col items-center gap-2 h-auto py-4 px-6 transition-all",
                playerChoice === choice.id && "ring-2 ring-agentX scale-105"
              )}
            >
              <choice.icon className="w-8 h-8" />
              <span>{choice.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Next Round Button */}
      {showResult && !watchMode && (
        <Button onClick={resetRound} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Next Round
        </Button>
      )}
    </div>
  );
}

// Helper to determine winner
export function determineRPSWinner(player: Choice, opponent: Choice): 'win' | 'lose' | 'draw' | null {
  if (!player || !opponent) return null;
  if (player === opponent) return 'draw';

  const winConditions: Record<string, Choice> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return winConditions[player] === opponent ? 'win' : 'lose';
}