import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGames, useAgents } from '@/hooks/useArenaAPI';
import { Gamepad2, Brain, Swords, BarChart3, ArrowRight, Zap, Target, Trophy, User, UserPlus, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { games } = useGames();
  const { agents } = useAgents(true); // Skip redirect for public home page
  const { user, isAuthenticated } = useAuth();

  const features = [
    {
      icon: Gamepad2,
      title: 'Multiple Games',
      description: 'Play Tic-Tac-Toe, Connect 4, GridWorld, and more with unified RL environments',
      color: 'text-primary',
    },
    {
      icon: Brain,
      title: 'Train AI Agents',
      description: 'Train Q-Learning, SARSA, DQN, and PPO agents with real-time progress visualization',
      color: 'text-accent',
    },
    {
      icon: Swords,
      title: 'Arena Battles',
      description: 'Watch agents compete or play against them yourself with full explainability',
      color: 'text-agentX',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Export',
      description: 'Track performance, compare agents, and export reports as PDF or Excel',
      color: 'text-agentO',
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 py-6 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="text-4xl font-mono font-bold tracking-tight">
              RESEARCHER DASHBOARD
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.username || 'Researcher'}. Track your active agents and training progress.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/train">
              <Button size="lg" className="gap-2 glow-primary">
                <Brain className="w-5 h-5" />
                New Agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Quick Start (Optional/Compact) */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass border-primary/20 bg-primary/5 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-mono font-bold">Training Hub</h3>
              <p className="text-sm text-muted-foreground mb-4">Launch new reinforcement learning experiments.</p>
              <Link to="/train">
                <Button variant="link" className="p-0 text-primary h-auto gap-1">
                  Go to training <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
          <Card className="glass border-accent/20 bg-accent/5 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-mono font-bold">Combat Arena</h3>
              <p className="text-sm text-muted-foreground mb-4">Validate agent performance in real-time matches.</p>
              <Link to="/arena">
                <Button variant="link" className="p-0 text-accent h-auto gap-1">
                  Open arena <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
          <Card className="glass border-success/20 bg-success/5 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center text-success">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-mono font-bold">Research Data</h3>
              <p className="text-sm text-muted-foreground mb-4">Analyze metrics and export technical reports.</p>
              <Link to="/stats">
                <Button variant="link" className="p-0 text-success h-auto gap-1">
                  View statistics <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <Card key={feature.title} className="glass hover:border-primary/50 transition-colors">
              <CardHeader>
                <feature.icon className={`w-10 h-10 ${feature.color} mb-2`} />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="glass text-center py-6">
            <div className="text-4xl font-mono font-bold text-primary mb-2">
              {games.length}
            </div>
            <div className="text-muted-foreground">Available Games</div>
          </Card>
          <Card className="glass text-center py-6">
            <div className="text-4xl font-mono font-bold text-accent mb-2">
              {agents.length}
            </div>
            <div className="text-muted-foreground">AI Agents</div>
          </Card>
          <Card className="glass text-center py-6">
            <div className="text-4xl font-mono font-bold text-success mb-2">
              <Trophy className="w-10 h-10 inline" />
            </div>
            <div className="text-muted-foreground">Self-Play Arena</div>
          </Card>
        </div>

        {/* Games Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-mono font-bold">Available Games</h2>
            <Link to="/games">
              <Button variant="ghost" className="gap-2">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {games.map((game) => (
              <Card key={game.id} className="glass hover:border-primary/50 transition-all hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    {game.name}
                  </CardTitle>
                  <CardDescription>{game.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Board: {game.boardSize.join('×')}
                    </span>
                    <Link to={`/arena?game=${game.id}`}>
                      <Button size="sm" variant="outline">
                        Play <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
