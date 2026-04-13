import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { HandbookTrigger } from '@/components/xai/AlgorithmHandbook';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAgents, useGames } from '@/hooks/useArenaAPI';
import { TwoPlayerCarDodge } from '@/components/games/TwoPlayerCarDodge';
import { SnakeGame } from '@/components/games/SnakeGame';
import { Game2048 } from '@/components/games/Game2048';
import { FlappyBirdGame } from '@/components/games/FlappyBirdGame';
import { MazeGame } from '@/components/games/MazeGame';
import { PongGame } from '@/components/games/PongGame';
import { Connect4Game } from '@/components/games/Connect4Game';
import { DodgeGame } from '@/components/games/DodgeGame';
import { BreakoutGame } from '@/components/games/BreakoutGame';
import { TreasureHuntGame } from '@/components/games/TreasureHuntGame';
import { BalloonPopGame } from '@/components/games/BalloonPopGame';
import { Swords, Play, RotateCcw, Eye, Gamepad2, User, Maximize2, Minimize2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Two-player / arcade games rendered without backend match state
const TWO_PLAYER_GAMES = [
  'cardodge', 'snake', '2048', 'flappybird', 'maze', 'pong', 'connect4',
  'dodge', 'breakout', 'treasurehunt', 'balloonpop'
];

// Maze wrapper component to share maze between players
function MazeGameWrapper({ mode, player1Label, player2Label, isFullscreen, onPlayer1Win, onPlayer2Win }: {
  mode: 'watch' | 'play';
  player1Label: string;
  player2Label: string;
  isFullscreen: boolean;
  onPlayer1Win: () => void;
  onPlayer2Win: () => void;
}) {
  const [sharedMaze, setSharedMaze] = useState<number[][] | null>(null);
  const [winner, setWinner] = useState<1 | 2 | null>(null);

  const handlePlayer1End = (won: boolean) => {
    if (won && !winner) {
      setWinner(1);
      onPlayer1Win();
    }
  };

  const handlePlayer2End = (won: boolean) => {
    if (won && !winner) {
      setWinner(2);
      onPlayer2Win();
    }
  };

  return (
    <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
      <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
        <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
        <MazeGame
          playerNumber={1}
          onGameEnd={handlePlayer1End}
          agentControlled={mode === 'watch'}
          isFullscreen={isFullscreen}
          autoStart={true}
          onMazeGenerated={(maze) => !sharedMaze && setSharedMaze(maze)}
          sharedMaze={sharedMaze || undefined}
        />
      </div>
      <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
      <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
        <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
        <MazeGame
          playerNumber={2}
          onGameEnd={handlePlayer2End}
          agentControlled={true}
          isFullscreen={isFullscreen}
          autoStart={true}
          sharedMaze={sharedMaze || undefined}
        />
      </div>
    </div>
  );
}

const Arena = () => {
  const [searchParams] = useSearchParams();
  const initialGame = searchParams.get('game') || 'connect4';
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const { agents } = useAgents();
  const { games } = useGames();
  const [selectedGame, setSelectedGame] = useState(initialGame);
  const [agentX, setAgentX] = useState('qlearning');
  const [agentO, setAgentO] = useState('random');
  const [mode, setMode] = useState<'watch' | 'play'>('watch');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  // Incremented on every new match to force-remount game components
  const [matchKey, setMatchKey] = useState(0);

  // Two-player game state
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [gameWinner, setGameWinner] = useState<1 | 2 | 'draw' | null>(null);
  const [reasoning, setReasoning] = useState<string>('');

  // Track match scores for score-based games (e.g. Balloon Pop)
  const [p1MatchScore, setP1MatchScore] = useState<number | null>(null);
  const [p2MatchScore, setP2MatchScore] = useState<number | null>(null);


  const isTwoPlayerGame = TWO_PLAYER_GAMES.includes(selectedGame);
  const player1Type = mode === 'play' ? 'human' : 'agent';
  const player2Type = 'agent';

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!gameContainerRef.current) return;

    if (!document.fullscreenElement) {
      await gameContainerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  // Auto-play logic removed (now handled by backend)

  // Human vs Agent auto-play removed (now handled by backend)


  // Save completed match to localStorage for Stats page
  const saveMatchRecord = (winner: 1 | 2 | 'draw') => {
    const player1Label = mode === 'play' ? 'You (Human)' : `Agent: ${agentX}`;
    const player2Label = `Agent: ${agentO}`;
    const record = {
      agentX: player1Label,
      agentO: player2Label,
      game: selectedGame,
      winner: winner === 1 ? 'X' : winner === 2 ? 'O' : 'draw',
      timestamp: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem('arena_match_history') || '[]');
      const updated = [record, ...existing].slice(0, 50); // keep last 50
      localStorage.setItem('arena_match_history', JSON.stringify(updated));
    } catch { }
  };

  // Filter available agents for the selected game
  const availableAgents = agents.filter(a => a.game.toLowerCase() === selectedGame.toLowerCase() || a.id === 'random' || a.id === 'minimax');

  const handleStartMatch = () => {
    // Validate Player 1 Agent
    if (mode === 'watch' && agentX !== 'random' && agentX !== 'minimax') {
      const ax = agents.find(a => a.id === agentX);
      if (ax && ax.game.toLowerCase() !== selectedGame.toLowerCase()) {
        alert(`Agent "${ax.name}" is trained for ${ax.game}, not ${selectedGame}.`);
        return;
      }
    }

    // Validate Player 2 Agent
    if (agentO !== 'random' && agentO !== 'minimax') {
      const ao = agents.find(a => a.id === agentO);
      if (ao && ao.game.toLowerCase() !== selectedGame.toLowerCase()) {
        alert(`Agent "${ao.name}" is trained for ${ao.game}, not ${selectedGame}.`);
        return;
      }
    }

    // Reset win counts only if starting fresh, not if starting a new round
    if (!gameStarted) {
      setPlayer1Score(0);
      setPlayer2Score(0);
    }

    setGameStarted(true);
    setGameWinner(null);
    setReasoning('');
    setP1MatchScore(null);
    setP2MatchScore(null);
    setMatchKey(k => k + 1); // Force-remount game components


    // Enter fullscreen for two-player games
    if (isTwoPlayerGame && gameContainerRef.current) {
      setTimeout(() => {
        gameContainerRef.current?.requestFullscreen().catch(() => { });
      }, 100);
    }
  };


  const handleReset = () => {
    setGameStarted(false);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setGameWinner(null);
    setReasoning('');
    setP1MatchScore(null);
    setP2MatchScore(null);
    setMatchKey(prev => prev + 1);
  };



  const handleTwoPlayerGameEnd = (winner: 1 | 2) => {
    setGameWinner(winner);
    saveMatchRecord(winner);
    if (winner === 1) {
      setPlayer1Score(s => s + 1);
    } else if (winner === 2) {
      setPlayer2Score(s => s + 1);
    }
  };

  const SCORE_BASED_GAMES = ['balloonpop', '2048'];

  const handlePlayer1End = (score: number) => {
    if (SCORE_BASED_GAMES.includes(selectedGame)) {
      setP1MatchScore(score);
      // Wait for P2 to finish
      return;
    }

    if (!gameWinner) {
      const winner = score > 0 ? 1 : 2;
      setGameWinner(winner);
      if (winner === 1) setPlayer1Score(s => s + 1);
      else setPlayer2Score(s => s + 1);
      saveMatchRecord(winner);
    }
  };


  const handlePlayer2End = (score: number) => {
    if (SCORE_BASED_GAMES.includes(selectedGame)) {
      setP2MatchScore(score);
      // Wait for P1 to finish
      return;
    }

    if (!gameWinner) {
      const winner = score > 0 ? 2 : 1;
      setGameWinner(winner);
      if (winner === 1) setPlayer1Score(s => s + 1);
      else setPlayer2Score(s => s + 1);
      saveMatchRecord(winner);
    }
  };


  // Score-based winner detection (runs when match scores change)
  useEffect(() => {
    if (SCORE_BASED_GAMES.includes(selectedGame) && p1MatchScore !== null && p2MatchScore !== null && !gameWinner) {
      if (p1MatchScore > p2MatchScore) {
        handleTwoPlayerGameEnd(1);
      } else if (p2MatchScore > p1MatchScore) {
        handleTwoPlayerGameEnd(2);
      } else {
        setGameWinner('draw');
        saveMatchRecord('draw');
      }
    }
  }, [p1MatchScore, p2MatchScore, selectedGame, gameWinner]);



  const renderTwoPlayerGame = () => {
    const player1Label = mode === 'play' ? 'You (Human)' : `Agent: ${agentX}`;
    const player2Label = `Agent: ${agentO}`;

    return (
      <div
        ref={gameContainerRef}
        className={cn(
          "relative",
          isFullscreen && "fixed inset-0 z-50 bg-background p-4 overflow-auto"
        )}
      >
        {/* Fullscreen toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 z-20 gap-2"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isFullscreen ? 'Exit' : 'Fullscreen'}
        </Button>

        {/* Winner Banner */}
        {gameWinner && (
          <div className={cn(
            "text-center py-4 text-3xl font-bold animate-pulse mb-4",
            gameWinner === 1 ? "text-agentX" : gameWinner === 2 ? "text-agentO" : "text-muted-foreground"
          )}>
            {gameWinner === 'draw' ? "🤝 It's a Draw! 🤝" : `🏆 ${gameWinner === 1 ? player1Label : player2Label} Wins! 🏆`}
          </div>
        )}

        {/* Score Display */}
        <div className="flex justify-center gap-8 mb-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Player 1 Wins</div>
            <div className="text-2xl font-bold text-agentX">{player1Score}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Player 2 Wins</div>
            <div className="text-2xl font-bold text-agentO">{player2Score}</div>
          </div>
        </div>

        {/* Reasoning Display */}
        {reasoning && (
          <div className="mx-auto max-w-md bg-accent/10 border border-accent/20 rounded-lg p-3 mb-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-accent mb-1">
              <Eye className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Agent Reasoning</span>
            </div>
            <p className="text-sm italic text-muted-foreground">
              "{reasoning}"
            </p>
          </div>
        )}

        {/* Game-specific rendering */}
        {selectedGame === 'cardodge' && (
          <TwoPlayerCarDodge
            key={matchKey}
            player1Type={player1Type as 'human' | 'agent'}
            player2Type={player2Type as 'human' | 'agent'}
            onGameEnd={handleTwoPlayerGameEnd}
            isFullscreen={isFullscreen}
            autoStart={true}
          />
        )}

        {selectedGame === 'snake' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <SnakeGame
                key={`snake1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <SnakeGame
                key={`snake2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}

        {selectedGame === '2048' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <Game2048
                key={`2048-1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <Game2048
                key={`2048-2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}

        {selectedGame === 'flappybird' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <FlappyBirdGame
                key={`flappy1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <FlappyBirdGame
                key={`flappy2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
              />
            </div>
          </div>
        )}

        {selectedGame === 'maze' && (
          <MazeGameWrapper
            key={matchKey}
            mode={mode}
            player1Label={player1Label}
            player2Label={player2Label}
            isFullscreen={isFullscreen}
            onPlayer1Win={() => { setGameWinner(1); setPlayer1Score(s => s + 1); }}
            onPlayer2Win={() => { setGameWinner(2); setPlayer2Score(s => s + 1); }}
          />
        )}

        {/* Pong: single unified game — human (left paddle) vs AI (right paddle) */}
        {selectedGame === 'pong' && (
          <div className={cn("w-full border-2 border-border rounded-xl overflow-hidden", isFullscreen ? "h-[80vh]" : "")}>
            <PongGame
              key={matchKey}
              agentControlled={mode === 'watch'}
              isFullscreen={isFullscreen}
              onGameEnd={(score) => {
                setGameWinner(score > 0 ? 1 : 2);
                if (score > 0) setPlayer1Score(s => s + 1);
                else setPlayer2Score(s => s + 1);
              }}
              onMove={setReasoning}
            />
          </div>
        )}

        {/* Connect 4: self-contained with built-in minimax AI */}
        {selectedGame === 'connect4' && (
          <div className="flex justify-center">
            <Connect4Game
              key={matchKey}
              playerNumber={1}
              playerSymbol="X"
              player1Label={player1Label}
              player2Label={player2Label}
              agentControlled={mode === 'watch'}
              autoStart={true}
              hideStatus={true}
              onGameEnd={(result) => {
                if (result === 1) { setGameWinner(1); setPlayer1Score(s => s + 1); }
                else if (result === -1) { setGameWinner(2); setPlayer2Score(s => s + 1); }
                else if (result === 0) { setGameWinner('draw'); saveMatchRecord('draw'); }
              }}
              onMove={setReasoning}
            />
          </div>
        )}

        {selectedGame === 'dodge' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <DodgeGame
                key={`dodge1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <DodgeGame
                key={`dodge2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}

        {selectedGame === 'breakout' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <BreakoutGame
                key={`breakout1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <BreakoutGame
                key={`breakout2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}

        {selectedGame === 'treasurehunt' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <TreasureHuntGame
                key={`treasure1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <TreasureHuntGame
                key={`treasure2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}

        {selectedGame === 'balloonpop' && (
          <div className={cn("flex gap-4", isFullscreen ? "h-[80vh]" : "")}>
            <div className="flex-1 flex flex-col border-2 border-agentX rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentX mb-2">{player1Label}</div>
              <BalloonPopGame
                key={`balloon1-${matchKey}`}
                playerNumber={1}
                onGameEnd={handlePlayer1End}
                agentControlled={mode === 'watch'}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
            <div className="flex items-center text-2xl font-bold text-muted-foreground">VS</div>
            <div className="flex-1 flex flex-col border-2 border-agentO rounded-xl p-4">
              <div className="text-center text-sm font-medium text-agentO mb-2">{player2Label}</div>
              <BalloonPopGame
                key={`balloon2-${matchKey}`}
                playerNumber={2}
                onGameEnd={handlePlayer2End}
                agentControlled={true}
                isFullscreen={isFullscreen}
                autoStart={true}
                onMove={setReasoning}
              />
            </div>
          </div>
        )}



        {/* Play Again Button */}

        {gameWinner && (
          <div className="flex justify-center mt-4">
            <Button onClick={handleStartMatch} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </Button>
          </div>
        )}

      </div>
    );
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-mono font-bold mb-2 flex items-center gap-3">
            <Swords className="w-8 h-8 text-primary" />
            Arena
          </h1>
          <p className="text-muted-foreground">
            Watch AI agents battle or play against them yourself. Full explainability included.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="glass lg:col-span-1">
            <CardHeader>
              <CardTitle>Match Setup</CardTitle>
              <CardDescription>Configure agents and game</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={mode === 'watch' ? 'default' : 'outline'}
                  onClick={() => setMode('watch')}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Watch
                </Button>
                <Button
                  variant={mode === 'play' ? 'default' : 'outline'}
                  onClick={() => setMode('play')}
                  className="gap-2"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Play
                </Button>
              </div>

              {/* Game Selection */}
              <div className="space-y-2">
                <Label>Game</Label>
                <Select value={selectedGame} onValueChange={(v) => { setSelectedGame(v); setGameStarted(false); setGameWinner(null); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agent X Selection */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-agentX/20 text-agentX flex items-center justify-center font-bold text-sm">
                      1
                    </span>
                    {mode === 'play' ? 'You' : 'Agent 1'}
                  </div>
                  {mode === 'watch' && (
                    <HandbookTrigger algorithmId={agents.find(a => a.id === agentX)?.algorithm} />
                  )}
                </Label>
                {mode === 'watch' ? (
                  <Select value={agentX} onValueChange={setAgentX}>
                    <SelectTrigger className="glass-input font-mono">
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      <SelectItem value="random" className="font-mono">Random Move AI</SelectItem>
                      <SelectItem value="minimax" className="font-mono">Minimax AI (Strategic)</SelectItem>
                      {availableAgents.filter(a => a.id !== 'random' && a.id !== 'minimax').map(agent => (
                        <SelectItem key={agent.id} value={agent.id} className="font-mono">
                          {agent.name} ({agent.algorithm})
                        </SelectItem>
                      ))}
                      {availableAgents.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground italic">No trained agents for this game</div>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Human Player</span>
                  </div>
                )}
              </div>

              {/* Agent O Selection */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-agentO/20 text-agentO flex items-center justify-center font-bold text-sm">
                      2
                    </span>
                    Agent 2
                  </div>
                  <HandbookTrigger algorithmId={agents.find(a => a.id === agentO)?.algorithm} />
                </Label>
                <Select value={agentO} onValueChange={setAgentO}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter((a) => a.type !== 'human')
                      .map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2">
                <Button onClick={handleStartMatch} className="w-full gap-2">
                  <Play className="w-4 h-4" />
                  {gameStarted ? 'New Match' : 'Start Match'}
                </Button>
                {gameStarted && (
                  <Button onClick={handleReset} variant="outline" className="w-full gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Game Board */}
          <div className="lg:col-span-2 space-y-4">
            {/* Two-player games */}
            {isTwoPlayerGame && gameStarted && renderTwoPlayerGame()}



            {/* Prompt to start */}
            {!gameStarted && isTwoPlayerGame && (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Swords className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Configure agents and start a match</p>
                  <p className="text-sm mt-2">
                    {selectedGame === 'cardodge' && 'Two-player split-screen car dodge game'}
                    {selectedGame === 'snake' && 'Two-player snake competition'}
                    {selectedGame === '2048' && 'Two-player 2048 race'}
                    {selectedGame === 'flappybird' && 'Two-player flappy bird competition'}
                    {selectedGame === 'maze' && 'Two-player maze race'}
                    {selectedGame === 'connect4' && 'Connect 4 — drop discs to connect four in a row'}
                    {selectedGame === 'pong' && 'Classic Pong — use W/S or ↑/↓ keys to control your paddle'}
                    {selectedGame === 'dodge' && 'Dodge falling obstacles and survive as long as possible'}
                    {selectedGame === 'breakout' && 'Classic Breakout — destroy bricks and catch the ball'}
                    {selectedGame === 'treasurehunt' && 'Navigate the grid to find treasure and avoid traps'}
                    {selectedGame === 'balloonpop' && 'Test your aim by popping balloons with a limited shots'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>


        </div>
      </div>
    </MainLayout>
  );
}

export default Arena;
