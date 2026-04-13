// frontend/src/pages/Train.tsx

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { HandbookTrigger } from '@/components/xai/AlgorithmHandbook';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useAgents, useGames, useTraining } from '@/hooks/useArenaAPI';
import { TrainingPreview } from '@/components/training/TrainingPreview';
import {
  Brain, Play, Square, Zap, Target, Trash2,
  Plus, Activity, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingProgress {
  currentEpisode:  number;
  totalEpisodes:   number;
  reward?:         number;
  avgReward?:      number;
  winRate?:        number;
  epsilon?:        number;
  status?:         string;
  rewardHistory?:  number[];
  lossHistory?:    number[];
  winRateHistory?: number[];
  sps?:            number;
  board?:          any;
  logs?:           string[];
  log?:            string;
  actor_loss?:     number;
  critic_loss?:    number;
  entropy?:        number;
  advantage?:      number;
  td_error?:       number;
  table_size?:     number;
  avg_q?:          number;
  buffer_size?:    number;
}

// ─── Design tokens (mirrors index.css neon palette) ───────────────────────────
// Using CSS variables here so components automatically adapt if the theme
// is ever changed in index.css — no hardcoded hex hunting required.

const T = {
  bg:        'var(--color-bg,      #060a0f)',   // page canvas
  card:      'var(--color-card,    #0d1117)',   // elevated panel
  border:    'var(--color-border,  #1e2d3d)',   // panel borders
  dim:       'var(--color-dim,     #334155)',   // muted labels
  muted:     'var(--color-muted,   #475569)',   // secondary text
  body:      'var(--color-body,    #e2e8f0)',   // primary text
  cyan:      '#06b6d4',
  magenta:   '#e879f9',
  green:     '#00ff9f',
  amber:     '#fbbf24',
  red:       '#f87171',
} as const;

// ─── Algorithm registry ───────────────────────────────────────────────────────

const ALGORITHMS = [
  { id: 'q-learning', name: 'Q-Learning', bestFor: 'Snake, Maze',            tag: 'tabular'      },
  { id: 'sarsa',      name: 'SARSA',      bestFor: 'Maze, Grid Hunt',        tag: 'on-policy'    },
  { id: 'dqn',        name: 'DQN',        bestFor: 'Connect 4, Flappy Bird', tag: 'off-policy'   },
  { id: 'ppo',        name: 'PPO',        bestFor: 'Dodge, Breakout',        tag: 'clipped'      },
  { id: 'a2c',        name: 'A2C',        bestFor: 'Pong, Balloon Pop',      tag: 'actor-critic' },
];

const ALGO_COLORS: Record<string, string> = {
  'q-learning': '#f97316',
  'sarsa':      '#a78bfa',
  'dqn':        T.cyan,
  'ppo':        '#10b981',
  'a2c':        T.magenta,
};

// ─── Shared style fragments ───────────────────────────────────────────────────
// Defined once, referenced many times — avoids copy-paste drift.

const panelStyle = (accent = T.border): React.CSSProperties => ({
  background:   T.card,
  border:       `1px solid ${accent}`,
  borderRadius: '10px',
});

const panelHeaderStyle: React.CSSProperties = {
  padding:       '8px 14px',
  borderBottom:  `1px solid ${T.border}`,
  fontSize:      '10px',
  color:         T.dim,
  fontFamily:    'monospace',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  display:       'flex',
  alignItems:    'center',
  gap:           '6px',
};

const inputStyle: React.CSSProperties = {
  height:     '34px',
  fontSize:   '12px',
  background: T.bg,
  border:     `1px solid ${T.border}`,
  color:      T.body,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const isActive = status === 'training';
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      fontFamily:    'monospace',
      fontSize:      '11px',
      fontWeight:    700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding:       '4px 10px',
      borderRadius:  '4px',
      border:        `1px solid ${isActive ? T.green + '44' : '#ffffff22'}`,
      background:    isActive ? T.green + '11' : '#ffffff08',
      color:         isActive ? T.green : '#888',
    }}>
      <span style={{
        width:        '6px',
        height:       '6px',
        borderRadius: '50%',
        background:   isActive ? T.green : '#555',
        boxShadow:    isActive ? `0 0 8px ${T.green}` : 'none',
        animation:    isActive ? 'cpulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {status ?? 'idle'}
    </span>
  );
}

function MetricChip({
  label, value, unit = '', accent = T.cyan,
}: {
  label: string; value: string | number; unit?: string; accent?: string;
}) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '2px',
      padding:       '10px 16px',
      borderRadius:  '8px',
      background:    T.card,
      border:        `1px solid ${accent}33`,
      minWidth:      '110px',
    }}>
      <span style={{
        fontFamily:    'monospace',
        fontSize:      '10px',
        color:         T.muted,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'monospace',
        fontSize:   '20px',
        fontWeight: 700,
        color:      accent,
        lineHeight: 1,
      }}>
        {value}
        <span style={{ fontSize: '11px', color: T.muted, marginLeft: '2px' }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

function HackerTerminal({ logs }: { logs: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const lineColor = (line: string) => {
    if (line.includes('[DECISION]')) return T.cyan;
    if (line.includes('[REWARD]'))   return T.green;
    if (line.includes('[LEARNING]')) return T.magenta;
    if (line.includes('[ERROR]'))    return T.red;
    if (line.includes('[DONE]'))     return T.amber;
    if (line.includes('[INIT]'))     return T.amber;
    return T.dim;
  };

  return (
    <div style={{
      fontFamily:   'monospace',
      fontSize:     '11px',
      background:   T.bg,
      border:       `1px solid ${T.border}`,
      borderRadius: '8px',
      padding:      '12px',
      height:       '160px',
      overflowY:    'auto',
      lineHeight:   1.6,
    }}>
      {logs.length === 0 && (
        <span style={{ color: T.dim }}>{'>'} Awaiting training session…</span>
      )}
      {logs.map((log, i) => (
        <div key={i} style={{ color: lineColor(log) }}>
          <span style={{ color: T.border, marginRight: '8px' }}>
            {String(i).padStart(4, '0')}
          </span>
          {log}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ActionProbBars({
  qValues, algoId,
}: {
  qValues?: number[]; algoId: string;
}) {
  const accent = ALGO_COLORS[algoId] ?? T.cyan;

  if (!qValues || qValues.length === 0) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100px',
        color:          T.dim,
        fontFamily:     'monospace',
        fontSize:       '12px',
      }}>
        no action data yet
      </div>
    );
  }

  const min   = Math.min(...qValues);
  const max   = Math.max(...qValues);
  const range = max - min || 1;
  const norm  = qValues.map(v => (v - min) / range);
  const best  = norm.indexOf(Math.max(...norm));
  const LABELS = ['↑', '↓', '←', '→', 'A', 'B', 'C', 'D'].slice(0, qValues.length);

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '100px' }}>
      {norm.map((v, i) => (
        <div key={i} style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '4px',
          flex:           1,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: i === best ? accent : T.dim }}>
            {(v * 100).toFixed(0)}%
          </span>
          <div style={{
            width:        '100%',
            height:       `${Math.max(4, v * 80)}px`,
            background:   i === best
              ? `linear-gradient(to top, ${accent}, ${accent}88)`
              : T.border,
            borderRadius: '3px 3px 0 0',
            boxShadow:    i === best ? `0 0 10px ${accent}55` : 'none',
            transition:   'height 0.3s ease',
          }} />
          <span style={{
            fontFamily: 'monospace',
            fontSize:   '11px',
            color:      i === best ? accent : T.muted,
            fontWeight: i === best ? 700 : 400,
          }}>
            {LABELS[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title, data, dataKey, color, icon: Icon, subtitle,
}: {
  title:   string;
  data:    Array<Record<string, number>>;
  dataKey: string;
  color:   string;
  icon:    typeof TrendingUp;
  subtitle: string;
}) {
  const latest = data.length > 0 ? data[data.length - 1][dataKey] : null;

  return (
    <div style={{
      ...panelStyle(`${color}33`),
      padding: '16px',
      flex:     1,
      minHeight: '220px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   '12px',
      }}>
        <div>
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           '6px',
            color,
            fontFamily:    'monospace',
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom:  '2px',
          }}>
            <Icon size={13} />
            {title}
          </div>
          <div style={{ color: T.muted, fontFamily: 'monospace', fontSize: '10px' }}>
            {subtitle}
          </div>
        </div>
        {latest !== null && (
          <span style={{
            fontFamily: 'monospace',
            fontSize:   '18px',
            fontWeight: 700,
            color,
          }}>
            {typeof latest === 'number' ? latest.toFixed(3) : latest}
          </span>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: '130px' }}>
        {data.length <= 1 ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: T.dim,
            fontFamily: 'monospace',
            fontSize: '11px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
          }}>
            <Activity className="animate-pulse" size={16} />
            COLLECTING TELEMETRY...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} opacity={0.5} />
              <XAxis dataKey="ep" hide={true} />
              <YAxis 
                tick={{ fill: T.dim, fontSize: 9, fontFamily: 'monospace' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background:   T.card,
                  border:       `1px solid ${color}55`,
                  borderRadius: '6px',
                  fontFamily:   'monospace',
                  fontSize:     '11px',
                  color:        T.body,
                }}
              />
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Train() {
  const [searchParams] = useSearchParams();
  const initialGame    = searchParams.get('game') || 'tictactoe';

  const { agents, deleteAgent }                              = useAgents();
  const { games }                                            = useGames();
  const { progress, isTraining, startTraining, stopTraining } = useTraining();

  const [selectedAgentId,   setSelectedAgentId]   = useState<string>('new');
  const [agentName,         setAgentName]         = useState('My AI Agent');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('dqn');
  const [selectedGame,      setSelectedGame]      = useState(initialGame);
  const [episodes,          setEpisodes]          = useState(1000);
  const [learningRate,      setLearningRate]      = useState(0.001);
  const [terminalLogs,      setTerminalLogs]      = useState<string[]>([]);
  const [latestQValues,     setLatestQValues]     = useState<number[]>([]);

  const typedProgress = progress as TrainingProgress | null;
  const accentColor   = ALGO_COLORS[selectedAlgorithm] ?? T.cyan;

  // Sync form fields when an existing agent is selected
  useEffect(() => {
    if (selectedAgentId !== 'new') {
      const agent = agents.find((a: any) => a.id === selectedAgentId);
      if (agent) {
        setAgentName(agent.name);
        setSelectedGame(agent.game);
        setSelectedAlgorithm(agent.algorithm);
      }
    }
  }, [selectedAgentId, agents]);

  // Feed terminal and Q-value display from live socket updates
  useEffect(() => {
    if (!typedProgress) return;

    const lines: string[] = [];
    if (typedProgress.log) {
      const ep  = typedProgress.currentEpisode;
      const ε   = typedProgress.epsilon?.toFixed(3) ?? '?';
      const wr  = typedProgress.winRate !== undefined
        ? (typedProgress.winRate * 100).toFixed(1) + '%' : '?';
      const avg = typedProgress.avgReward?.toFixed(2) ?? '?';

      lines.push(`[DECISION] Episode ${ep} | ε=${ε} | WinRate=${wr}`);
      lines.push(`[REWARD]   Avg Reward: ${avg}`);

      if (typedProgress.lossHistory?.length) {
        const last = typedProgress.lossHistory[typedProgress.lossHistory.length - 1];
        lines.push(`[LEARNING] Loss: ${last.toFixed(5)}`);
      }
      if (typedProgress.status === 'completed') {
        lines.push(`[DONE] Training complete! Final WinRate: ${wr}`);
      }
    }

    if (lines.length > 0) {
      setTerminalLogs(prev => [...prev.slice(-200), ...lines]);
    }

    if ((typedProgress as any).q_values) {
      setLatestQValues((typedProgress as any).q_values);
    } else if ((typedProgress as any).action_probs) {
      setLatestQValues((typedProgress as any).action_probs);
    }
  }, [typedProgress]);

  const rewardChartData = (typedProgress?.rewardHistory ?? []).map((v, i) => ({
    ep: i, reward: parseFloat(v.toFixed(3)),
  }));
  const lossChartData = (typedProgress?.lossHistory ?? []).map((v, i) => ({
    ep: i, loss: parseFloat(v.toFixed(5)),
  }));

  const handleStartTraining = () => {
    setTerminalLogs([
      `[INIT] Starting ${selectedAlgorithm.toUpperCase()} on ${selectedGame} for ${episodes} episodes…`,
    ]);
    setLatestQValues([]);
    startTraining(agentName, selectedGame, episodes, selectedAlgorithm, learningRate);
  };

  const handleDelete = async () => {
    if (selectedAgentId === 'new') return;
    const ok = await deleteAgent(selectedAgentId);
    if (ok) { setSelectedAgentId('new'); setAgentName('My AI Agent'); }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      {/*
        Keyframe animations injected once.
        cpulse  — status dot heartbeat
        cpulse is also defined in index.css as training-pulse;
        both are kept for compatibility with components that use either name.
      */}
      <style>{`
        @keyframes cpulse {
          0%, 100% { opacity: 1;   box-shadow: 0 0 8px ${T.green}; }
          50%       { opacity: 0.4; box-shadow: 0 0 2px ${T.green}; }
        }
      `}</style>

      {/*
        Page wrapper — transparent background so the dark canvas from
        index.css shows through. The old hardcoded #060a0f here was the
        source of the visible seam between the sidebar and content area.
      */}
      <div style={{
        maxWidth:   '1400px',
        margin:     '0 auto',
        padding:    '0 0 48px',
        fontFamily: '"JetBrains Mono", monospace',
        // No background set here — inherits from body in index.css
      }}>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="animate-fade-in-up" style={{ marginBottom: '24px' }}>
          <h1 style={{
            display:       'flex',
            alignItems:    'center',
            gap:           '12px',
            fontSize:      '26px',
            fontWeight:    700,
            letterSpacing: '-0.02em',
            color:         T.body,
            marginBottom:  '4px',
          }}>
            <Brain size={26} color={accentColor}
              style={{ filter: `drop-shadow(0 0 6px ${accentColor}88)` }} />
            Training Lab
          </h1>
          <p style={{ color: T.muted, fontSize: '13px' }}>
            Configure, observe, and analyse reinforcement learning agents in real-time.
          </p>
        </div>

        {/* ── Zone 1: Vital Signs ───────────────────────────────────────── */}
        <div
          className="animate-fade-in-up-1"
          style={{
            ...panelStyle(),
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            flexWrap:     'wrap',
            marginBottom: '20px',
            padding:      '12px 16px',
          }}
        >
          <StatusBadge
            status={typedProgress?.status ?? (isTraining ? 'training' : 'idle')}
          />

          <div style={{ width: '1px', height: '36px', background: T.border, margin: '0 4px' }} />

          <MetricChip
            label="Epsilon ε"
            value={((typedProgress?.epsilon ?? 1) * 100).toFixed(1)}
            unit="%" accent={T.magenta}
          />
          <MetricChip
            label="Speed"
            value={typedProgress?.sps?.toFixed(0) ?? '0'}
            unit="sps" accent={T.amber}
          />
          <MetricChip
            label="Avg Reward"
            value={(typedProgress?.avgReward ?? 0).toFixed(2)}
            accent={T.green}
          />
          <MetricChip
            label="Win Rate"
            value={((typedProgress?.winRate ?? 0) * 100).toFixed(1)}
            unit="%" accent={accentColor}
          />

          {/* Episode progress bar */}
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              marginBottom:   '4px',
              color:          T.muted,
              fontSize:       '10px',
              letterSpacing:  '0.08em',
            }}>
              <span>EPISODE PROGRESS</span>
              <span style={{ color: accentColor }}>
                {typedProgress?.currentEpisode ?? 0} / {typedProgress?.totalEpisodes ?? episodes}
              </span>
            </div>
            <Progress
              value={typedProgress
                ? (typedProgress.currentEpisode / typedProgress.totalEpisodes) * 100
                : 0}
              className="h-[6px]"
            />
          </div>
        </div>

        {/* ── Main two-column grid ──────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:                 '16px',
          marginBottom:        '16px',
        }}>

          {/* ── Left column: Config + Live Action ──────────────────────── */}
          <div
            className="animate-fade-in-up-2"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >

            {/* Configuration card */}
            <Card className="glass" style={{ ...panelStyle(), overflow: 'hidden' }}>
              <CardHeader style={{ paddingBottom: '8px' }}>
                <CardTitle style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           '8px',
                  fontSize:      '13px',
                  color:         accentColor,
                  fontFamily:    'monospace',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  <Target size={14} />
                  Configuration
                </CardTitle>
              </CardHeader>

              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Agent selector row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{
                    display:     'flex',
                    justifyContent: 'space-between',
                    alignItems:  'center',
                  }}>
                    <Label className="label-mono">Agent</Label>
                    {selectedAgentId !== 'new' && !isTraining && (
                      <Button
                        variant="ghost" size="sm"
                        style={{ height: '24px', color: T.red, fontSize: '11px', padding: '0 8px' }}
                        onClick={handleDelete}
                      >
                        <Trash2 size={11} style={{ marginRight: '4px' }} /> Delete
                      </Button>
                    )}
                  </div>
                  <Select
                    value={selectedAgentId}
                    onValueChange={setSelectedAgentId}
                    disabled={isTraining}
                  >
                    <SelectTrigger style={inputStyle}>
                      <SelectValue placeholder="Choose agent…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Plus size={12} /> New Agent
                        </span>
                      </SelectItem>
                      {agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.game})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Agent name (new only) */}
                {selectedAgentId === 'new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Label className="label-mono">Agent Name</Label>
                    <Input
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      disabled={isTraining}
                      placeholder="Enter agent name…"
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Algorithm + Game */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Label className="label-mono">Algorithm</Label>
                      <HandbookTrigger algorithmId={selectedAlgorithm} />
                    </div>
                    <Select
                      value={selectedAlgorithm}
                      onValueChange={setSelectedAlgorithm}
                      disabled={isTraining || selectedAgentId !== 'new'}
                    >
                      <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALGORITHMS.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Label className="label-mono">Game</Label>
                    <Select
                      value={selectedGame}
                      onValueChange={setSelectedGame}
                      disabled={isTraining || selectedAgentId !== 'new'}
                    >
                      <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {games.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Episodes + LR */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Label className="label-mono">Episodes</Label>
                    <Input
                      type="number" value={episodes}
                      onChange={e => setEpisodes(parseInt(e.target.value) || 1000)}
                      disabled={isTraining} min={100} max={100000} step={500}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Label className="label-mono">Learning Rate</Label>
                    <Input
                      type="number" value={learningRate}
                      onChange={e => setLearningRate(parseFloat(e.target.value) || 0.001)}
                      disabled={isTraining} min={0.0001} max={0.1} step={0.0001}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Start / Stop button */}
                {!isTraining ? (
                  <Button
                    onClick={handleStartTraining}
                    className="w-full glow-primary"
                    style={{
                      background:    `linear-gradient(135deg, ${accentColor}cc, ${accentColor}55)`,
                      border:        `1px solid ${accentColor}55`,
                      color:         '#fff',
                      fontFamily:    'monospace',
                      fontSize:      '13px',
                      fontWeight:    700,
                      letterSpacing: '0.06em',
                      marginTop:     '4px',
                    }}
                  >
                    <Play size={15} style={{ marginRight: '6px' }} />
                    INITIATE TRAINING
                  </Button>
                ) : (
                  <Button
                    onClick={stopTraining}
                    variant="destructive"
                    className="w-full"
                    style={{
                      fontFamily: 'monospace',
                      fontSize:   '13px',
                      fontWeight: 700,
                      marginTop:  '4px',
                    }}
                  >
                    <Square size={15} style={{ marginRight: '6px' }} />
                    TERMINATE
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Live game feed */}
            <div style={{ ...panelStyle(), overflow: 'hidden' }}>
              <div style={panelHeaderStyle}>
                <Activity size={11} /> Live Game Feed
              </div>
              <div style={{ padding: '12px' }}>
                <TrainingPreview board={typedProgress?.board} gameId={selectedGame} />
              </div>
            </div>

            {/* Decision log terminal */}
            <div style={{ ...panelStyle(), overflow: 'hidden' }}>
              <div style={panelHeaderStyle}>
                <Zap size={11} /> Decision Log
              </div>
              <div style={{ padding: '10px 12px' }}>
                <HackerTerminal logs={terminalLogs} />
              </div>
            </div>
          </div>

          {/* ── Right column: Brain Monitor ─────────────────────────────── */}
          <div
            className="animate-fade-in-up-3"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >

            {/* Algorithm browser */}
            <div style={{ ...panelStyle(), padding: '14px' }}>
              <div style={panelHeaderStyle}>
                <Brain size={11} /> Algorithm Browser
              </div>
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 '8px',
                marginTop:           '12px',
              }}>
                {ALGORITHMS.map(algo => {
                  const isSelected = selectedAlgorithm === algo.id;
                  const color      = ALGO_COLORS[algo.id];
                  return (
                    <div
                      key={algo.id}
                      onClick={() => {
                        if (!isTraining && selectedAgentId === 'new')
                          setSelectedAlgorithm(algo.id);
                      }}
                      className={isSelected ? 'glow-primary' : ''}
                      style={{
                        padding:      '10px 12px',
                        borderRadius: '8px',
                        border:       `1px solid ${isSelected ? color + '88' : T.border}`,
                        background:   isSelected ? color + '11' : T.bg,
                        cursor:       (!isTraining && selectedAgentId === 'new')
                          ? 'pointer' : 'default',
                        transition:   'all 0.2s',
                      }}
                    >
                      <div style={{
                        fontFamily:   'monospace',
                        fontSize:     '13px',
                        fontWeight:   700,
                        color:        isSelected ? color : T.muted,
                        marginBottom: '2px',
                      }}>
                        {algo.name}
                      </div>
                      <div style={{ fontSize: '10px', color: T.dim, fontFamily: 'monospace' }}>
                        {algo.bestFor}
                      </div>
                      <span style={{
                        display:       'inline-block',
                        marginTop:     '6px',
                        padding:       '1px 6px',
                        borderRadius:  '3px',
                        background:    color + '22',
                        border:        `1px solid ${color}44`,
                        color,
                        fontSize:      '9px',
                        fontFamily:    'monospace',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        {algo.tag}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action probability bars */}
            <div style={{ ...panelStyle(), padding: '14px' }}>
              <div style={panelHeaderStyle}>
                <Zap size={11} color={accentColor} />
                Action Probabilities / Q-Values
              </div>
              <div style={{ marginTop: '12px' }}>
                <ActionProbBars qValues={latestQValues} algoId={selectedAlgorithm} />
              </div>
            </div>

            {/* Algorithm-specific extended metrics (conditional) */}
            {typedProgress && (
              <div style={{ ...panelStyle(), padding: '14px' }}>
                <div style={panelHeaderStyle}>Extended Metrics</div>
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap:                 '8px',
                  marginTop:           '12px',
                }}>
                  {typedProgress.avg_q       !== undefined && <MetricChip label="Avg Q"       value={typedProgress.avg_q.toFixed(3)}       accent={T.cyan}    />}
                  {typedProgress.buffer_size !== undefined && <MetricChip label="Buffer"      value={typedProgress.buffer_size}             accent={T.cyan}    />}
                  {typedProgress.actor_loss  !== undefined && <MetricChip label="Actor Loss"  value={typedProgress.actor_loss.toFixed(4)}   accent={T.magenta} />}
                  {typedProgress.critic_loss !== undefined && <MetricChip label="Critic Loss" value={typedProgress.critic_loss.toFixed(4)}  accent="#f97316"   />}
                  {typedProgress.entropy     !== undefined && <MetricChip label="Entropy"     value={typedProgress.entropy.toFixed(4)}      accent={T.amber}   />}
                  {typedProgress.advantage   !== undefined && <MetricChip label="Advantage"   value={typedProgress.advantage.toFixed(4)}    accent={T.green}   />}
                  {typedProgress.td_error    !== undefined && <MetricChip label="TD Error"    value={typedProgress.td_error.toFixed(5)}     accent="#f97316"   />}
                  {typedProgress.table_size  !== undefined && <MetricChip label="Table Size"  value={typedProgress.table_size}              accent="#a78bfa"   />}
                </div>
              </div>
            )}

            {/* Win rate trend chart */}
            <div style={{ ...panelStyle(), padding: '14px', flex: 1 }}>
              <div style={panelHeaderStyle}>Win Rate Trend</div>
              <div style={{ marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart
                    data={(typedProgress?.winRateHistory ?? []).map((v, i) => ({
                      ep: i,
                      wr: parseFloat((v * 100).toFixed(1)),
                    }))}
                    margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="ep" tick={{ fill: T.dim, fontSize: 9, fontFamily: 'monospace' }} />
                    <YAxis domain={[0, 100]} tick={{ fill: T.dim, fontSize: 9, fontFamily: 'monospace' }} />
                    <Tooltip
                      contentStyle={{
                        background:   T.card,
                        border:       `1px solid ${T.green}55`,
                        borderRadius: '6px',
                        fontFamily:   'monospace',
                        fontSize:     '11px',
                        color:        T.body,
                      }}
                      formatter={(v: any) => [`${v}%`, 'Win Rate']}
                    />
                    <Line
                      type="monotone" dataKey="wr"
                      stroke={T.green} strokeWidth={1.5}
                      dot={false} isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ── Zone 4: Bottom performance charts ────────────────────────── */}
        <div className="animate-fade-in-up-4" style={{ display: 'flex', gap: '16px' }}>
          <ChartCard
            title="Reward"
            subtitle="avg reward per episode — should trend ↑"
            data={rewardChartData}
            dataKey="reward"
            color={T.green}
            icon={TrendingUp}
          />
          <ChartCard
            title="Loss"
            subtitle="training error per update — should trend ↓"
            data={lossChartData}
            dataKey="loss"
            color={T.magenta}
            icon={TrendingDown}
          />
        </div>

      </div>
    </MainLayout>
  );
}