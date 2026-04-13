import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGames } from '@/hooks/useArenaAPI';
import { Gamepad2, ArrowRight, Grid3X3, Circle, Shield, Blocks, Box, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Games() {
  const { games, loading } = useGames();

  const gameIcons: Record<string, React.ReactNode> = {
    connect4: <Circle className="w-12 h-12 text-agentO" />,
    gridworld: <Gamepad2 className="w-12 h-12 text-accent" />,
    dodge: <Shield className="w-12 h-12 text-warning" />,
    '2048': <Grid3X3 className="w-12 h-12 text-primary" />,
    breakout: <Blocks className="w-12 h-12 text-success" />,
    treasurehunt: <Box className="w-12 h-12 text-agentO" />,
    balloonpop: <Target className="w-12 h-12 text-destructive" />,
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-mono font-bold mb-2">Games</h1>
          <p className="text-muted-foreground">
            Choose a game to play or train agents on. All games implement a unified RL environment interface.
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass animate-pulse">
                <CardHeader>
                  <div className="w-12 h-12 bg-muted rounded-lg mb-4" />
                  <div className="h-6 bg-muted rounded w-32 mb-2" />
                  <div className="h-4 bg-muted rounded w-48" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {games.map((game) => (
              <Card key={game.id} className="glass hover:border-primary/50 transition-all hover:scale-[1.02] group">
                <CardHeader>
                  <div className="mb-4">
                    {gameIcons[game.id] || <Gamepad2 className="w-12 h-12 text-primary" />}
                  </div>
                  <CardTitle className="text-xl">{game.name}</CardTitle>
                  <CardDescription>{game.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Board Size: <strong className="text-foreground">{game.boardSize.join('×')}</strong></span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>Supported Agents: </span>
                    <span className="text-foreground">{game.supportedAgents.length}</span>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/arena?game=${game.id}`} className="flex-1">
                      <Button className="w-full gap-2">
                        Play <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to={`/train?game=${game.id}`}>
                      <Button variant="outline">Train</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
