import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAgents } from '@/hooks/useArenaAPI';
import { BarChart3, FileSpreadsheet, FileText, Trophy, TrendingUp, History, Gamepad2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface MatchRecord {
  agentX: string;
  agentO: string;
  game: string;
  winner: 'X' | 'O' | 'draw';
  timestamp: string;
}

function getMatchHistory(): MatchRecord[] {
  try {
    return JSON.parse(localStorage.getItem('arena_match_history') || '[]');
  } catch {
    return [];
  }
}

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic Tac Toe',
  connect4: 'Connect 4',
  rps: 'Rock Paper Scissors',
  pong: 'Pong',
  flappybird: 'Flappy Bird',
  snake: 'Snake',
  maze: 'Maze',
  '2048': '2048',
  dodge: 'Dodge',
  cardodge: 'Car Dodge',
  breakout: 'Breakout',
  treasurehunt: 'Grid Treasure Hunt',
  balloonpop: 'Balloon Pop',
};

export default function Stats() {
  const { agents, loading } = useAgents();
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(getMatchHistory);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reload from localStorage when tab gets focus (in case Arena played a match)
  useEffect(() => {
    const onFocus = () => setMatchHistory(getMatchHistory());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // ---- Derived stats from agents ----
  const totalMatches = agents.reduce((s, a) => s + (a.matches_played || 0), 0);
  const trainedAgents = agents.length;

  const bestAgent = agents.reduce<{ name: string; winRate: number } | null>((best, a) => {
    if (!a.matches_played) return best;
    const wr = (a.matches_won || 0) / a.matches_played;
    if (!best || wr > best.winRate) return { name: a.name, winRate: wr };
    return best;
  }, null);

  // Per-agent stats from the agents list
  const agentStats = agents.map(a => ({
    id: a.id,
    name: a.name,
    game: a.game || '—',
    type: a.type || '—',
    wins: a.matches_won || 0,
    losses: (a.matches_played || 0) - (a.matches_won || 0),
    draws: 0,
    winRate: a.matches_played ? (a.matches_won || 0) / a.matches_played : 0,
    matchesPlayed: a.matches_played || 0,
  }));

  const drawChart = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const padding = { top: 30, right: 20, bottom: 55, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = 'hsl(220, 20%, 10%)';
    ctx.fillRect(0, 0, width, height);

    const data = agentStats.filter(a => a.matchesPlayed > 0);

    if (data.length === 0) {
      ctx.fillStyle = 'hsl(220, 10%, 50%)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No match data yet — play some games in the Arena!', width / 2, height / 2);
      return;
    }

    const barW = Math.min(60, (chartW / data.length) - 20);
    const step = chartW / data.length;

    // Y-axis gridlines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.strokeStyle = 'hsl(220, 20%, 20%)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = 'hsl(220, 10%, 55%)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 25}%`, padding.left - 8, y + 4);
    }

    // Y-axis line
    ctx.strokeStyle = 'hsl(220, 20%, 30%)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.stroke();

    // Bars
    const hues = [262, 195, 145, 45, 10, 320];
    data.forEach((agent, i) => {
      const x = padding.left + i * step + (step - barW) / 2;
      const barH = agent.winRate * chartH;
      const y = padding.top + chartH - barH;
      const hue = hues[i % hues.length];

      const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      grad.addColorStop(0, `hsla(${hue}, 80%, 65%, 1)`);
      grad.addColorStop(1, `hsla(${hue}, 80%, 35%, 0.7)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();

      // Win rate label
      if (barH > 18) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${(agent.winRate * 100).toFixed(0)}%`, x + barW / 2, y + 16);
      } else {
        ctx.fillStyle = 'hsl(220, 10%, 70%)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${(agent.winRate * 100).toFixed(0)}%`, x + barW / 2, y - 8);
      }

      // Agent name (truncated)
      ctx.fillStyle = 'hsl(220, 10%, 60%)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      const label = agent.name.length > 10 ? agent.name.slice(0, 9) + '…' : agent.name;
      ctx.fillText(label, x + barW / 2, padding.top + chartH + 18);

      // Matches played
      ctx.fillStyle = 'hsl(220, 10%, 45%)';
      ctx.font = '10px monospace';
      ctx.fillText(`${agent.matchesPlayed}g`, x + barW / 2, padding.top + chartH + 32);
    });
  }, [agentStats]);

  useEffect(() => { drawChart(); }, [drawChart]);

  const handleClearHistory = () => {
    localStorage.removeItem('arena_match_history');
    setMatchHistory([]);
    toast.success('Match history cleared');
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.text('Agent Performance Report', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

      // Summary Stats Table
      autoTable(doc, {
        startY: 40,
        head: [['Metric', 'Value']],
        body: [
          ['Total Matches', totalMatches.toLocaleString()],
          ['Trained Agents', trainedAgents.toString()],
          ['Best Agent', bestAgent?.name || 'N/A'],
          ['Best Win Rate', bestAgent ? `${(bestAgent.winRate * 100).toFixed(1)}%` : 'N/A'],
        ],
        theme: 'striped',
      });

      // Agent Performance Table
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('Agent Performance', 14, (doc as any).lastAutoTable.finalY + 15);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Agent Name', 'Game', 'Wins', 'Losses', 'Win Rate']],
        body: agentStats.map(a => [
          a.name,
          GAME_LABELS[a.game] || a.game,
          a.wins,
          a.losses,
          a.matchesPlayed > 0 ? `${(a.winRate * 100).toFixed(1)}%` : '0%'
        ]),
      });

      doc.save('RL_Platform_Stats.pdf');
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = () => {
    try {
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Matches', totalMatches],
        ['Trained Agents', trainedAgents],
        ['Best Agent', bestAgent?.name || 'N/A'],
        ['Best Win Rate', bestAgent ? `${(bestAgent.winRate * 100).toFixed(4)}` : 0]
      ];

      const performanceData = [
        ['Agent Name', 'Game', 'Wins', 'Losses', 'Draws', 'Win Rate', 'Matches Played'],
        ...agentStats.map(a => [
          a.name,
          GAME_LABELS[a.game] || a.game,
          a.wins,
          a.losses,
          a.draws,
          a.winRate,
          a.matchesPlayed
        ])
      ];

      const wb = XLSX.utils.book_new();

      const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws_summary, 'Summary');

      const ws_perf = XLSX.utils.aoa_to_sheet(performanceData);
      XLSX.utils.book_append_sheet(wb, ws_perf, 'Agent Performance');

      XLSX.writeFile(wb, 'RL_Platform_Stats.xlsx');
      toast.success('Excel exported successfully');
    } catch (error) {
      console.error('Excel Export Error:', error);
      toast.error('Failed to export Excel');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-mono font-bold mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Stats &amp; Export
            </h1>
            <p className="text-muted-foreground">View performance analytics and download reports.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />Export PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />Export Excel
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-mono font-bold">{totalMatches.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Matches</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <div className="text-3xl font-mono font-bold">{trainedAgents}</div>
                  <div className="text-sm text-muted-foreground">Your Agents</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-success" />
                </div>
                <div>
                  <div className="text-3xl font-mono font-bold">
                    {bestAgent ? `${(bestAgent.winRate * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {bestAgent ? `Best: ${bestAgent.name}` : 'Best Win Rate'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
                  <History className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <div className="text-3xl font-mono font-bold">{matchHistory.length}</div>
                  <div className="text-sm text-muted-foreground">Arena Games</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Agent Win Rate Comparison
              </CardTitle>
              <CardDescription>Win rate per agent across all recorded matches</CardDescription>
            </CardHeader>
            <CardContent>
              <canvas ref={canvasRef} width={500} height={280} className="w-full rounded-lg" />
            </CardContent>
          </Card>

          {/* Agent Table */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Agent Performance
              </CardTitle>
              <CardDescription>Per-agent breakdown from training records</CardDescription>
            </CardHeader>
            <CardContent>
              {agentStats.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No agents yet — train some agents first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-mono text-sm text-muted-foreground">Agent</th>
                        <th className="text-center py-3 px-2 font-mono text-sm text-muted-foreground">Game</th>
                        <th className="text-center py-3 px-2 font-mono text-sm text-muted-foreground">W</th>
                        <th className="text-center py-3 px-2 font-mono text-sm text-muted-foreground">L</th>
                        <th className="text-center py-3 px-2 font-mono text-sm text-muted-foreground">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map(agent => (
                        <tr key={agent.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-2 font-medium">{agent.name}</td>
                          <td className="text-center py-3 px-2 text-xs text-muted-foreground">
                            {GAME_LABELS[agent.game] || agent.game}
                          </td>
                          <td className="text-center py-3 px-2 text-success font-mono">{agent.wins}</td>
                          <td className="text-center py-3 px-2 text-destructive font-mono">{agent.losses}</td>
                          <td className="text-center py-3 px-2">
                            <span className={`font-mono font-bold ${agent.winRate >= 0.5 ? 'text-success' : agent.winRate > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                              {agent.matchesPlayed > 0 ? `${(agent.winRate * 100).toFixed(1)}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Match History */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Recent Match History
                </CardTitle>
                <CardDescription>Latest completed Arena games (stored locally)</CardDescription>
              </div>
              {matchHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={handleClearHistory}>
                  <Trash2 className="w-4 h-4" />Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {matchHistory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No match history yet.</p>
                <p className="text-sm mt-1">Play some games in the Arena and they'll appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {matchHistory.map((match, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${match.winner === 'X' ? 'bg-agentX/20 text-agentX' :
                        match.winner === 'O' ? 'bg-agentO/20 text-agentO' :
                          'bg-muted text-muted-foreground'
                        }`}>
                        {match.winner === 'draw' ? '=' : match.winner}
                      </span>
                      <div>
                        <span className="font-medium">{match.agentX}</span>
                        <span className="text-muted-foreground mx-2">vs</span>
                        <span className="font-medium">{match.agentO}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {GAME_LABELS[match.game] || match.game}
                      </span>
                      <span>{new Date(match.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
