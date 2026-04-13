// frontend/src/components/training/NeuralSynapseMonitor.tsx

import { useState, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NeuralSynapseMonitorProps {
  reward:      number;
  winRate:     number;
  epsilon:     number;
  agentId:     string;
  isTraining:  boolean;
  // Algorithm-specific extras (all optional — component degrades gracefully)
  entropy?:    number;   // PPO / A2C: action distribution entropy
  confidence?: number;   // PPO / A2C: max action probability
  avgQ?:       number;   // DQN: average Q-value over batch
  tdError?:    number;   // Q-Learning / SARSA: mean absolute TD error
  loss?:       number;   // all algorithms: most recent loss value
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Network topology: [input, hidden1, hidden2, output]
const LAYERS = [4, 6, 6, 3];
const CYAN    = '#06b6d4';
const MAGENTA = '#e879f9';
const GREEN   = '#00ff9f';
const AMBER   = '#fbbf24';
const DIM     = '#1e3a5f';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a CSS glow shadow string scaled by intensity [0, 1] */
function glow(color: string, intensity: number): string {
  const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0');
  return `0 0 ${4 + intensity * 10}px ${color}${alpha}, 0 0 ${2 + intensity * 4}px ${color}`;
}

/** Linear interpolate between two hex colors — used for reward delta colouring */
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r  = Math.round(ar + (br - ar) * t);
  const g  = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b2})`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single metric readout in the telemetry grid */
function TelemetryCell({
  label, value, unit = '', color = CYAN, dim = false
}: {
  label: string; value: string | number; unit?: string;
  color?: string; dim?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      '9px',
        color:         '#475569',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily:  '"JetBrains Mono", monospace',
        fontSize:    '18px',
        fontWeight:  700,
        color:       dim ? '#334155' : color,
        lineHeight:  1,
        textShadow:  dim ? 'none' : glow(color, 0.4),
      }}>
        {value}
        <span style={{ fontSize: '10px', color: '#475569', marginLeft: '2px' }}>{unit}</span>
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NeuralSynapseMonitor({
  reward,
  winRate,
  epsilon,
  agentId,
  isTraining,
  entropy,
  confidence,
  avgQ,
  tdError,
  loss,
}: NeuralSynapseMonitorProps) {

  // Each node has an activation level [0, 1] — drives glow intensity
  const [activations, setActivations] = useState<number[][]>(
    LAYERS.map(n => Array(n).fill(0))
  );

  // Pulse wavefront: which layer is currently "lit" during a forward pass
  const [pulseLayer, setPulseLayer] = useState<number>(-1);

  // Reward delta tracking
  const lastRewardRef = useRef(reward);
  const [delta,     setDelta]     = useState(0);
  const [deltaFlash, setDeltaFlash] = useState(false);

  // ── Neural animation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isTraining) {
      // Fade all nodes out when not training
      setActivations(LAYERS.map(n => Array(n).fill(0)));
      setPulseLayer(-1);
      return;
    }

    // Background random noise — always on during training
    const noiseInterval = setInterval(() => {
      setActivations(LAYERS.map(n =>
        Array.from({ length: n }, () => Math.random() > 0.5 ? Math.random() * 0.4 : 0)
      ));
    }, 180);

    // Forward-pass pulse — sweeps left to right every ~1.2 s
    let layer  = 0;
    const pulseInterval = setInterval(() => {
      setPulseLayer(layer);
      setActivations(prev => prev.map((layerActs, li) =>
        li === layer
          ? layerActs.map(() => 0.7 + Math.random() * 0.3)   // full brightness
          : layerActs
      ));
      layer = (layer + 1) % LAYERS.length;
    }, 300);

    return () => {
      clearInterval(noiseInterval);
      clearInterval(pulseInterval);
    };
  }, [isTraining]);

  // ── Reward delta flash ────────────────────────────────────────────────────

  useEffect(() => {
    if (reward !== lastRewardRef.current) {
      setDelta(reward - lastRewardRef.current);
      lastRewardRef.current = reward;
      setDeltaFlash(true);
      const t = setTimeout(() => setDeltaFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [reward]);

  // ── Layout ────────────────────────────────────────────────────────────────

  const totalNodes = LAYERS.reduce((a, b) => a + b, 0);
  const maxNodes   = Math.max(...LAYERS);

  // How many optional metric cells do we have?
  const extraMetrics = [entropy, confidence, avgQ, tdError].filter(v => v !== undefined);

  return (
    <div style={{
      display:       'grid',
      gridTemplateColumns: extraMetrics.length > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
      gap:           '12px',
      fontFamily:    '"JetBrains Mono", monospace',
    }}>

      {/* ── Panel 1: Neural Network Visualiser ─────────────────────────── */}
      <div style={{
        background:   '#0d1117',
        border:       `1px solid ${CYAN}33`,
        borderRadius: '10px',
        padding:      '14px',
        display:      'flex',
        flexDirection: 'column',
        gap:          '10px',
      }}>
        <div style={{
          display:    'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize:      '10px',
            color:         CYAN,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Neural Activity
          </span>
          <span style={{
            fontSize:   '9px',
            color:      '#334155',
            letterSpacing: '0.08em',
          }}>
            {LAYERS.join('→')} topology
          </span>
        </div>

        {/* Network graph */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-around',
          alignItems:     'center',
          gap:            '6px',
          padding:        '8px 4px',
          position:       'relative',
          minHeight:      `${maxNodes * 22}px`,
        }}>
          {LAYERS.map((nodeCount, li) => (
            <div
              key={li}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '6px',
                position:       'relative',
                zIndex:         2,
              }}
            >
              {Array.from({ length: nodeCount }, (_, ni) => {
                const act      = activations[li]?.[ni] ?? 0;
                const isPulse  = pulseLayer === li;
                const nodeColor = li === 0 ? CYAN : li === LAYERS.length - 1 ? MAGENTA : CYAN;

                return (
                  <div
                    key={ni}
                    style={{
                      width:        '12px',
                      height:       '12px',
                      borderRadius: '50%',
                      background:   act > 0.05
                        ? lerpColor('#1e3a5f', nodeColor, act)
                        : '#0d1117',
                      border:       `1px solid ${act > 0.05 ? nodeColor + '88' : DIM}`,
                      boxShadow:    act > 0.1 ? glow(nodeColor, act) : 'none',
                      transform:    `scale(${1 + act * 0.25})`,
                      transition:   isPulse
                        ? 'all 0.08s ease-out'
                        : 'all 0.2s ease',
                    }}
                  />
                );
              })}

              {/* Layer label */}
              <span style={{
                fontSize:      '8px',
                color:         pulseLayer === li ? CYAN : '#1e3a5f',
                letterSpacing: '0.06em',
                marginTop:     '2px',
                transition:    'color 0.1s',
              }}>
                {li === 0 ? 'IN' : li === LAYERS.length - 1 ? 'OUT' : `H${li}`}
              </span>
            </div>
          ))}

          {/* Connection lines drawn behind nodes */}
          <svg
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
              pointerEvents: 'none',
            }}
            preserveAspectRatio="none"
          >
            {LAYERS.slice(0, -1).map((fromCount, li) => {
              const toCount   = LAYERS[li + 1];
              const totalCols = LAYERS.length;
              const fromX     = `${(li / (totalCols - 1)) * 100}%`;
              const toX       = `${((li + 1) / (totalCols - 1)) * 100}%`;

              return Array.from({ length: fromCount }, (_, fi) =>
                Array.from({ length: toCount }, (_, ti) => {
                  const fromY = `${((fi + 0.5) / fromCount) * 100}%`;
                  const toY   = `${((ti + 0.5) / toCount) * 100}%`;
                  const act   = (activations[li]?.[fi] ?? 0 + activations[li + 1]?.[ti] ?? 0) / 2;
                  const isActive = pulseLayer === li || pulseLayer === li + 1;

                  return (
                    <line
                      key={`${li}-${fi}-${ti}`}
                      x1={fromX} y1={fromY}
                      x2={toX}   y2={toY}
                      stroke={isActive ? CYAN : DIM}
                      strokeWidth={isActive ? '0.8' : '0.5'}
                      strokeOpacity={isActive ? 0.35 : 0.15}
                    />
                  );
                })
              );
            })}
          </svg>
        </div>

        {/* Node count footer */}
        <div style={{
          display:       'flex',
          justifyContent: 'space-between',
          fontSize:      '9px',
          color:         '#1e3a5f',
          letterSpacing: '0.08em',
          borderTop:     '1px solid #1e2d3d',
          paddingTop:    '8px',
        }}>
          <span>{totalNodes} nodes</span>
          <span style={{ color: isTraining ? GREEN : '#1e3a5f' }}>
            {isTraining ? '● live' : '○ idle'}
          </span>
        </div>
      </div>

      {/* ── Panel 2: Decision Telemetry ─────────────────────────────────── */}
      <div style={{
        background:   '#0d1117',
        border:       `1px solid ${MAGENTA}33`,
        borderRadius: '10px',
        padding:      '14px',
        display:      'flex',
        flexDirection: 'column',
        gap:          '12px',
      }}>
        <div style={{
          display:    'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize:      '10px',
            color:         MAGENTA,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Decision Telemetry
          </span>
          {isTraining && (
            <span style={{
              fontSize:      '8px',
              color:         GREEN,
              letterSpacing: '0.1em',
              animation:     'cpulse 1.4s ease-in-out infinite',
            }}>
              ● LIVE
            </span>
          )}
        </div>

        {/* Core metric grid */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:                 '12px',
        }}>
          {/* Reward with delta flash */}
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{
              fontFamily:    '"JetBrains Mono", monospace',
              fontSize:      '9px',
              color:         '#475569',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Rolling Reward
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{
                fontFamily:  '"JetBrains Mono", monospace',
                fontSize:    '26px',
                fontWeight:  700,
                color:       CYAN,
                lineHeight:  1,
                textShadow:  glow(CYAN, 0.5),
              }}>
                {reward.toFixed(2)}
              </span>
              {delta !== 0 && (
                <span style={{
                  fontFamily:  '"JetBrains Mono", monospace',
                  fontSize:    '12px',
                  fontWeight:  700,
                  color:       delta > 0 ? GREEN : '#f87171',
                  textShadow:  deltaFlash
                    ? glow(delta > 0 ? GREEN : '#f87171', 0.8)
                    : 'none',
                  transition:  'text-shadow 0.3s',
                }}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <TelemetryCell
            label="Win Rate"
            value={`${(winRate * 100).toFixed(1)}`}
            unit="%"
            color={GREEN}
          />
          <TelemetryCell
            label="Epsilon ε"
            value={epsilon.toFixed(3)}
            color={MAGENTA}
          />
          {loss !== undefined && (
            <TelemetryCell
              label="Loss"
              value={loss.toFixed(4)}
              color={AMBER}
            />
          )}
        </div>

        {/* Scrolling status ticker */}
        <div style={{
          borderTop:   '1px solid #1e2d3d',
          paddingTop:  '8px',
          overflow:    'hidden',
          whiteSpace:  'nowrap',
        }}>
          <span style={{
            fontSize:      '9px',
            color:         '#334155',
            letterSpacing: '0.06em',
            display:       'inline-block',
            animation:     isTraining ? 'ticker 12s linear infinite' : 'none',
          }}>
            {`AGENT_${agentId} ● ε=${epsilon.toFixed(3)} ● WR=${(winRate * 100).toFixed(1)}% ● REWARD=${reward.toFixed(2)} ● STATUS=${isTraining ? 'TRAINING' : 'IDLE'} ●●●`}
          </span>
        </div>
      </div>

      {/* ── Panel 3: Algorithm-Specific Metrics (conditional) ───────────── */}
      {extraMetrics.length > 0 && (
        <div style={{
          background:   '#0d1117',
          border:       '1px solid #1e2d3d',
          borderRadius: '10px',
          padding:      '14px',
          display:      'flex',
          flexDirection: 'column',
          gap:          '12px',
        }}>
          <span style={{
            fontSize:      '10px',
            color:         '#475569',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Algo Metrics
          </span>

          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 '12px',
          }}>
            {/* PPO / A2C */}
            {entropy !== undefined && (
              <TelemetryCell
                label="Entropy H(π)"
                value={entropy.toFixed(3)}
                color={MAGENTA}
              />
            )}
            {confidence !== undefined && (
              <TelemetryCell
                label="Confidence"
                value={`${(confidence * 100).toFixed(1)}`}
                unit="%"
                color={GREEN}
              />
            )}

            {/* DQN */}
            {avgQ !== undefined && (
              <TelemetryCell
                label="Avg Q-Value"
                value={avgQ.toFixed(3)}
                color={CYAN}
              />
            )}

            {/* Q-Learning / SARSA */}
            {tdError !== undefined && (
              <TelemetryCell
                label="TD Error"
                value={tdError.toFixed(4)}
                color={AMBER}
              />
            )}
          </div>

          {/* Entropy gauge bar (PPO / A2C only) */}
          {entropy !== undefined && (
            <div>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginBottom:   '4px',
                fontSize:       '9px',
                color:          '#334155',
                letterSpacing:  '0.08em',
              }}>
                <span>EXPLOIT ←→ EXPLORE</span>
                <span style={{ color: MAGENTA }}>{(entropy * 100).toFixed(0)}%</span>
              </div>
              <div style={{
                height:       '4px',
                background:   '#1e2d3d',
                borderRadius: '2px',
                overflow:     'hidden',
              }}>
                <div style={{
                  height:     '100%',
                  width:      `${Math.min(100, entropy * 100)}%`,
                  background: `linear-gradient(to right, ${CYAN}, ${MAGENTA})`,
                  borderRadius: '2px',
                  boxShadow:  glow(MAGENTA, 0.6),
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginTop:      '3px',
                fontSize:       '8px',
                color:          '#1e3a5f',
              }}>
                <span>confident</span>
                <span>random</span>
              </div>
            </div>
          )}

          {/* Confidence bar (PPO / A2C) */}
          {confidence !== undefined && (
            <div>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                marginBottom:   '4px',
                fontSize:       '9px',
                color:          '#334155',
                letterSpacing:  '0.08em',
              }}>
                <span>ACTION CONFIDENCE</span>
                <span style={{ color: GREEN }}>{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div style={{
                height:       '4px',
                background:   '#1e2d3d',
                borderRadius: '2px',
                overflow:     'hidden',
              }}>
                <div style={{
                  height:     '100%',
                  width:      `${confidence * 100}%`,
                  background: `linear-gradient(to right, ${DIM}, ${GREEN})`,
                  borderRadius: '2px',
                  boxShadow:  glow(GREEN, confidence * 0.8),
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes cpulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes ticker {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}