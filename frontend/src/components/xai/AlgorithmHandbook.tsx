// frontend/src/components/xai/AlgorithmHandbook.tsx
//
// XAI (Explainable AI) Algorithm Handbook
//
// A floating panel that explains the mathematics and intuition behind
// every RL algorithm in the platform. Triggered by a "?" help icon
// placed next to algorithm selectors in Train.tsx and Arena.tsx.
//
// VIVA PITCH:
// "I integrated Explainable AI (XAI) features directly into the
//  training interface. Each algorithm exposes its core mathematical
//  update rule, the intuition behind it, convergence properties, and
//  a recommended use-case guide — so the system is self-documenting."

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, ChevronLeft, ChevronRight, HelpCircle, Zap, Brain } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlgorithmEntry {
  id:          string;
  name:        string;
  fullName:    string;
  year:        string;
  authors:     string;
  color:       string;
  tag:         string;
  tagColor:    string;
  // Core equation rendered as styled segments
  equation:    EquationPart[];
  equationLabel: string;
  // Plain-English breakdown of the equation
  breakdown:   BreakdownItem[];
  // Key innovations / properties
  properties:  Property[];
  // When to use / avoid
  bestFor:     string[];
  avoidWhen:   string[];
  // One-line intuition
  intuition:   string;
  // Convergence guarantee
  convergence: string;
}

interface EquationPart {
  text:   string;
  type:   'normal' | 'variable' | 'operator' | 'accent' | 'comment';
}

interface BreakdownItem {
  symbol:      string;
  name:        string;
  description: string;
  color:       string;
}

interface Property {
  label: string;
  value: string;
  good:  boolean | null;   // null = neutral
}

// ─── Algorithm Data ───────────────────────────────────────────────────────────
// Every equation, breakdown, and property is written to be directly
// quotable in a viva answer.

const ALGORITHMS: AlgorithmEntry[] = [
  {
    id:       'dqn',
    name:     'DQN',
    fullName: 'Deep Q-Network',
    year:     '2015',
    authors:  'Mnih et al., DeepMind',
    color:    '#06b6d4',
    tag:      'off-policy',
    tagColor: '#0891b2',

    equation: [
      { text: 'Q(s,a)',        type: 'accent'   },
      { text: ' ← ',          type: 'operator' },
      { text: 'Q(s,a)',        type: 'variable' },
      { text: ' + ',           type: 'operator' },
      { text: 'α',             type: 'accent'   },
      { text: ' · [ ',         type: 'normal'   },
      { text: 'r',             type: 'variable' },
      { text: ' + ',           type: 'operator' },
      { text: 'γ',             type: 'accent'   },
      { text: ' · max',        type: 'normal'   },
      { text: "Q̂",             type: 'accent'   },
      { text: '(s\',a\')',     type: 'variable' },
      { text: ' − ',           type: 'operator' },
      { text: 'Q(s,a)',        type: 'variable' },
      { text: ' ]',            type: 'normal'   },
    ],
    equationLabel: 'Bellman Update (TD target from frozen target network Q̂)',

    breakdown: [
      { symbol: 'Q(s,a)',   name: 'Q-value',        color: '#06b6d4', description: 'Expected total discounted reward from state s, taking action a, then playing optimally.' },
      { symbol: 'α',        name: 'Learning rate',  color: '#fbbf24', description: 'How aggressively we update our estimate. Too high = unstable; too low = slow convergence.' },
      { symbol: 'r',        name: 'Reward',         color: '#00ff9f', description: 'Immediate scalar feedback from the environment after taking action a in state s.' },
      { symbol: 'γ',        name: 'Discount',       color: '#e879f9', description: 'How much we value future rewards vs. immediate ones. γ=0.99 means future is nearly as valuable.' },
      { symbol: "Q̂(s',a')", name: 'Target network', color: '#f97316', description: 'Frozen copy of Q, updated every N steps. Prevents the "chasing a moving target" instability.' },
    ],

    properties: [
      { label: 'Policy type',        value: 'Off-policy (ε-greedy)',  good: null  },
      { label: 'Experience replay',  value: 'Yes — random sampling',  good: true  },
      { label: 'Target network',     value: 'Yes — frozen copy',      good: true  },
      { label: 'Convergence proof',  value: 'Not guaranteed (neural nets)', good: false },
      { label: 'State space',        value: 'Large / continuous',     good: true  },
      { label: 'Action space',       value: 'Discrete only',          good: null  },
    ],

    bestFor:   ['Connect 4', 'Flappy Bird', '2048', 'Breakout', 'Large state spaces'],
    avoidWhen: ['Continuous action spaces', 'Very small state spaces (use tabular Q-Learning instead)'],
    intuition: 'Train a neural network to predict "how much future reward will I get?" for every action. Use a memory buffer and a frozen copy of itself to stay stable.',
    convergence: 'No formal guarantee. Empirically converges with sufficient replay buffer, target update frequency, and learning rate tuning.',
  },

  {
    id:       'ppo',
    name:     'PPO',
    fullName: 'Proximal Policy Optimization',
    year:     '2017',
    authors:  'Schulman et al., OpenAI',
    color:    '#10b981',
    tag:      'on-policy · clipped',
    tagColor: '#059669',

    equation: [
      { text: 'L',           type: 'accent'   },
      { text: '(θ) = ',      type: 'normal'   },
      { text: 'E',           type: 'variable' },
      { text: '[ min( ',     type: 'normal'   },
      { text: 'r',           type: 'accent'   },
      { text: '(θ)·',        type: 'normal'   },
      { text: 'Â',           type: 'variable' },
      { text: ',  clip(',    type: 'normal'   },
      { text: 'r',           type: 'accent'   },
      { text: '(θ), 1±ε)·',  type: 'normal'   },
      { text: 'Â',           type: 'variable' },
      { text: ' ) ]',        type: 'normal'   },
    ],
    equationLabel: 'Clipped Surrogate Objective — r(θ) = π_new(a|s) / π_old(a|s)',

    breakdown: [
      { symbol: 'r(θ)',  name: 'Probability ratio', color: '#10b981', description: 'How much has the policy changed? r=1 means no change. r=1.2 means this action is 20% more likely now.' },
      { symbol: 'Â',     name: 'Advantage',         color: '#06b6d4', description: 'Was this action better or worse than average? A>0 = increase probability; A<0 = decrease it.' },
      { symbol: 'ε',     name: 'Clip range',        color: '#fbbf24', description: 'Typically 0.2. Prevents r(θ) from going outside [0.8, 1.2] — caps how much one update can change the policy.' },
      { symbol: 'clip()', name: 'Clipping',         color: '#e879f9', description: 'The key PPO innovation. Forces conservatism: if the ratio is outside the trust region, we ignore the gradient signal.' },
      { symbol: 'min()',  name: 'Pessimistic bound', color: '#f97316', description: 'Takes the minimum of clipped vs unclipped — always picks the more conservative update.' },
    ],

    properties: [
      { label: 'Policy type',       value: 'On-policy (stochastic)', good: null  },
      { label: 'Experience reuse',  value: 'K epochs per rollout',   good: true  },
      { label: 'Clipping',          value: 'Yes — trust region',     good: true  },
      { label: 'Actor-Critic',      value: 'Yes — shared backbone',  good: true  },
      { label: 'Convergence proof', value: 'Not guaranteed',         good: false },
      { label: 'Stability',         value: 'High (vs TRPO/A3C)',     good: true  },
    ],

    bestFor:   ['Dodge', 'Breakout', 'Continuous control', 'Long training runs'],
    avoidWhen: ['Very short episodes (rollout buffer too small)', 'Environments needing off-policy learning'],
    intuition: 'Improve the policy gradient by clipping how much the policy can change in a single update. This prevents catastrophic collapse when a bad batch of experience is sampled.',
    convergence: 'No formal guarantee, but empirically among the most stable policy gradient methods. Clip range ε is the key hyperparameter.',
  },

  {
    id:       'a2c',
    name:     'A2C',
    fullName: 'Advantage Actor-Critic',
    year:     '2016',
    authors:  'Mnih et al. (sync variant)',
    color:    '#e879f9',
    tag:      'on-policy · actor-critic',
    tagColor: '#c026d3',

    equation: [
      { text: '∇L',          type: 'accent'   },
      { text: ' = ',         type: 'operator' },
      { text: '∇ log π',    type: 'variable' },
      { text: '(a|s;θ) · ', type: 'normal'   },
      { text: 'A',           type: 'accent'   },
      { text: ' (s,a)',      type: 'variable' },
      { text: '   where   ', type: 'comment'  },
      { text: 'A',           type: 'accent'   },
      { text: ' = r + γ·',  type: 'normal'   },
      { text: 'V',           type: 'variable' },
      { text: '(s\')',       type: 'variable' },
      { text: ' − ',         type: 'operator' },
      { text: 'V',           type: 'variable' },
      { text: '(s)',         type: 'variable' },
    ],
    equationLabel: 'Policy Gradient with Advantage Baseline — A = TD error of critic',

    breakdown: [
      { symbol: '∇ log π',  name: 'Policy gradient',   color: '#e879f9', description: 'Direction to update θ to make action a more (or less) likely in state s.' },
      { symbol: 'A(s,a)',   name: 'Advantage',          color: '#06b6d4', description: 'How much better was this action vs the critic\'s baseline V(s)? Reduces gradient variance dramatically.' },
      { symbol: 'V(s)',     name: 'State value (critic)', color: '#10b981', description: 'Critic\'s estimate of total future reward from state s. Acts as a baseline to centre the advantage.' },
      { symbol: 'r+γV(s\')', name: 'TD target',         color: '#fbbf24', description: 'Bootstrap estimate of the true return. Used to train the critic and compute the advantage.' },
      { symbol: 'γ',        name: 'Discount factor',   color: '#f97316', description: 'Controls how far into the future the agent looks. High γ = patient, low γ = shortsighted.' },
    ],

    properties: [
      { label: 'Policy type',      value: 'On-policy (stochastic)', good: null  },
      { label: 'Baseline',         value: 'V(s) — reduces variance', good: true },
      { label: 'Clipping',         value: 'None (unlike PPO)',       good: false },
      { label: 'Data reuse',       value: 'Single pass per rollout', good: false },
      { label: 'Shared backbone',  value: 'Yes — actor + critic',   good: true  },
      { label: 'Implementation',   value: 'Simpler than PPO',        good: true  },
    ],

    bestFor:   ['Pong', 'Balloon Pop', 'Short episodes', 'Quick prototyping'],
    avoidWhen: ['Long training runs (PPO more stable)', 'Environments with sparse rewards'],
    intuition: 'Simultaneously train two networks: an Actor (what to do) and a Critic (how good is my situation). The Critic\'s feedback dramatically reduces the noise in the Actor\'s gradient.',
    convergence: 'No formal guarantee. The advantage baseline reduces variance, making learning smoother than plain REINFORCE, but instability is still possible without gradient clipping.',
  },

  {
    id:       'q-learning',
    name:     'Q-Learning',
    fullName: 'Tabular Q-Learning',
    year:     '1992',
    authors:  'Watkins & Dayan',
    color:    '#f97316',
    tag:      'off-policy · tabular',
    tagColor: '#ea580c',

    equation: [
      { text: 'Q(s,a)',    type: 'accent'   },
      { text: ' ← ',       type: 'operator' },
      { text: 'Q(s,a)',    type: 'variable' },
      { text: ' + ',       type: 'operator' },
      { text: 'α',         type: 'accent'   },
      { text: ' · [ ',     type: 'normal'   },
      { text: 'r',         type: 'variable' },
      { text: ' + ',       type: 'operator' },
      { text: 'γ',         type: 'accent'   },
      { text: ' · max',    type: 'normal'   },
      { text: 'Q(s\',a\')', type: 'variable' },
      { text: ' − ',       type: 'operator' },
      { text: 'Q(s,a)',    type: 'variable' },
      { text: ' ]',        type: 'normal'   },
    ],
    equationLabel: 'Bellman Update — direct table assignment, no neural network',

    breakdown: [
      { symbol: 'Q(s,a)',   name: 'Q-table entry',   color: '#f97316', description: 'Dictionary lookup: given this exact state tuple, what is the expected return for action a?' },
      { symbol: 'α',        name: 'Learning rate',   color: '#fbbf24', description: 'How much we trust the new TD estimate vs the old table value. Typically 0.1–0.3.' },
      { symbol: 'r',        name: 'Reward',          color: '#00ff9f', description: 'Immediate scalar reward received after taking action a.' },
      { symbol: 'γ',        name: 'Discount',        color: '#e879f9', description: 'Future reward discount factor. γ=0.99 is standard for most games.' },
      { symbol: 'max Q(s\')', name: 'Greedy target', color: '#06b6d4', description: 'The KEY difference from SARSA: always uses the BEST next action, not the one we\'ll actually take.' },
    ],

    properties: [
      { label: 'Policy type',       value: 'Off-policy (ε-greedy)',        good: null  },
      { label: 'Memory',            value: 'O(|S|×|A|) dictionary',        good: null  },
      { label: 'Convergence proof', value: 'Guaranteed → Q* (finite MDP)', good: true  },
      { label: 'Generalisation',    value: 'None — exact state lookup',    good: false },
      { label: 'Neural network',    value: 'No — pure table',              good: null  },
      { label: 'State space',       value: 'Small, discrete only',         good: null  },
    ],

    bestFor:   ['Snake (small grid)', 'Maze', 'Grid Treasure Hunt', 'Discrete state spaces'],
    avoidWhen: ['Large or continuous state spaces (table explodes)', 'Raw pixel input'],
    intuition: 'Build a spreadsheet of every (state, action) pair you\'ve ever seen. After each step, update that cell using the Bellman equation. No neural network needed.',
    convergence: 'PROVABLY converges to the optimal Q* for any finite MDP given enough exploration and a decaying learning rate. This is the strongest convergence guarantee in this platform.',
  },

  {
    id:       'sarsa',
    name:     'SARSA',
    fullName: 'State–Action–Reward–State–Action',
    year:     '1994',
    authors:  'Rummery & Niranjan',
    color:    '#a78bfa',
    tag:      'on-policy · tabular',
    tagColor: '#7c3aed',

    equation: [
      { text: 'Q(s,a)',      type: 'accent'   },
      { text: ' ← ',         type: 'operator' },
      { text: 'Q(s,a)',      type: 'variable' },
      { text: ' + ',         type: 'operator' },
      { text: 'α',           type: 'accent'   },
      { text: ' · [ ',       type: 'normal'   },
      { text: 'r',           type: 'variable' },
      { text: ' + ',         type: 'operator' },
      { text: 'γ',           type: 'accent'   },
      { text: ' · ',         type: 'normal'   },
      { text: 'Q(s\',',      type: 'variable' },
      { text: 'a\'',         type: 'accent'   },
      { text: ')',           type: 'variable' },
      { text: ' − ',         type: 'operator' },
      { text: 'Q(s,a)',      type: 'variable' },
      { text: ' ]',          type: 'normal'   },
    ],
    equationLabel: "On-policy update — a' is the action the agent WILL take, not the best possible",

    breakdown: [
      { symbol: 'Q(s,a)',  name: 'Q-table entry',      color: '#a78bfa', description: 'Same table as Q-Learning: dictionary of (state, action) → expected return.' },
      { symbol: 'α',       name: 'Learning rate',      color: '#fbbf24', description: 'Step size for the Bellman update. Same role as in Q-Learning.' },
      { symbol: 'r',       name: 'Reward',             color: '#00ff9f', description: 'Immediate reward received after (s, a).' },
      { symbol: 'γ',       name: 'Discount',           color: '#e879f9', description: 'Future reward discount. Same role as all other algorithms.' },
      { symbol: "Q(s',a')", name: 'Next action value', color: '#06b6d4', description: 'THE KEY DIFFERENCE: uses Q for the action we will ACTUALLY take next (a\'), not max Q. Makes this on-policy.' },
    ],

    properties: [
      { label: 'Policy type',       value: 'On-policy (ε-greedy)',        good: null  },
      { label: 'Update uses',       value: 'Actual next action a\'',      good: null  },
      { label: 'Convergence proof', value: 'Guaranteed → Q_π (not Q*)',   good: true  },
      { label: 'Safety',            value: 'Learns safer paths (cliff)',   good: true  },
      { label: 'Neural network',    value: 'No — pure table',             good: null  },
      { label: 'vs Q-Learning',     value: 'Same table, different target', good: null },
    ],

    bestFor:   ['Maze', 'Grid Treasure Hunt', 'Environments with dangerous states', 'Cliff Walking'],
    avoidWhen: ['When you want the theoretically optimal policy (use Q-Learning)', 'Large state spaces'],
    intuition: 'Identical to Q-Learning except the TD target uses the next action you\'ll actually take, not the best possible action. This makes it safer in environments with irreversible mistakes.',
    convergence: 'Converges to Q_π (the value of the behaviour policy), not Q* (optimal). If ε→0 over time, Q_π → Q*. Safer than Q-Learning near "cliff" states.',
  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:      '#060a0f',
  card:    '#0d1117',
  card2:   '#111827',
  border:  '#1e2d3d',
  dim:     '#334155',
  muted:   '#475569',
  body:    '#e2e8f0',
  overlay: 'rgba(6, 10, 15, 0.85)',
} as const;

// ─── Equation renderer ────────────────────────────────────────────────────────

function Equation({ parts, label }: { parts: EquationPart[]; label: string }) {
  const colorFor = (type: EquationPart['type'], defaultColor: string): string => {
    switch (type) {
      case 'accent':   return defaultColor;
      case 'variable': return '#e2e8f0';
      case 'operator': return '#64748b';
      case 'comment':  return '#334155';
      default:         return '#94a3b8';
    }
  };

  return (
    <div style={{
      background:   T.card2,
      border:       `1px solid ${T.border}`,
      borderRadius: '8px',
      padding:      '16px',
      marginBottom: '12px',
    }}>
      <div style={{
        fontSize:      '9px',
        color:         T.muted,
        fontFamily:    'monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom:  '10px',
      }}>
        Core Update Rule
      </div>
      {/* Equation line */}
      <div style={{
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      '15px',
        lineHeight:    1.8,
        flexWrap:      'wrap',
        display:       'flex',
        alignItems:    'baseline',
        gap:           '1px',
        marginBottom:  '8px',
      }}>
        {parts.map((part, i) => (
          <span
            key={i}
            style={{
              color:      colorFor(part.type, '#06b6d4'),
              fontWeight: part.type === 'accent' ? 700 : 400,
              fontStyle:  part.type === 'comment' ? 'italic' : 'normal',
              fontSize:   part.type === 'comment' ? '12px' : '15px',
            }}
          >
            {part.text}
          </span>
        ))}
      </div>
      {/* Label */}
      <div style={{
        fontSize:   '10px',
        color:      T.muted,
        fontFamily: 'monospace',
        fontStyle:  'italic',
        borderTop:  `1px solid ${T.border}`,
        paddingTop: '8px',
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface AlgorithmHandbookProps {
  initialAlgorithmId?: string;
  onClose:             () => void;
}

export function AlgorithmHandbook({
  initialAlgorithmId = 'dqn',
  onClose,
}: AlgorithmHandbookProps) {
  const initialIdx  = Math.max(0, ALGORITHMS.findIndex(a => a.id === initialAlgorithmId));
  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const [tab,       setTab]       = useState<'equation' | 'properties' | 'guide'>('equation');
  const [visible,   setVisible]   = useState(false);

  const algo = ALGORITHMS[activeIdx];

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const prev = () => setActiveIdx(i => (i - 1 + ALGORITHMS.length) % ALGORITHMS.length);
  const next = () => setActiveIdx(i => (i + 1) % ALGORITHMS.length);

  // Reset tab when algorithm changes
  useEffect(() => { setTab('equation'); }, [activeIdx]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:       0,
          background: T.overlay,
          backdropFilter: 'blur(4px)',
          zIndex:     1000,
          transition: 'opacity 0.2s',
          opacity:    visible ? 1 : 0,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    `translate(-50%, -50%) scale(${visible ? 1 : 0.95})`,
          width:        'min(680px, 95vw)',
          maxHeight:    '88vh',
          overflowY:    'auto',
          background:   T.bg,
          border:       `1px solid ${algo.color}44`,
          borderRadius: '12px',
          zIndex:       1001,
          transition:   'transform 0.2s ease, opacity 0.2s ease',
          opacity:      visible ? 1 : 0,
          boxShadow:    `0 0 40px ${algo.color}22, 0 20px 60px rgba(0,0,0,0.8)`,
          fontFamily:   '"JetBrains Mono", monospace',
        }}
      >
        {/* ... existing header code ... */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          padding:        '16px 20px',
          borderBottom:   `1px solid ${T.border}`,
          background:     T.card,
          borderRadius:   '12px 12px 0 0',
          position:       'sticky',
          top:             0,
          zIndex:          10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={16} color={algo.color} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: algo.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Algorithm Handbook
            </span>
            <span style={{
              fontSize:   '9px',
              color:      T.muted,
              background: T.card2,
              border:     `1px solid ${T.border}`,
              padding:    '2px 6px',
              borderRadius: '3px',
              letterSpacing: '0.1em',
            }}>
              XAI MODULE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              color:      T.muted,
              cursor:     'pointer',
              padding:    '4px',
              display:    'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {/* ... remaining component content ... */}

        {/* ── Algorithm selector tabs ──────────────────────────────────── */}
        <div style={{
          display:        'flex',
          gap:            '6px',
          padding:        '12px 20px',
          borderBottom:   `1px solid ${T.border}`,
          overflowX:      'auto',
          background:     T.card,
        }}>
          {ALGORITHMS.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setActiveIdx(i)}
              style={{
                padding:      '5px 12px',
                borderRadius: '5px',
                border:       `1px solid ${i === activeIdx ? a.color + '88' : T.border}`,
                background:   i === activeIdx ? a.color + '22' : 'transparent',
                color:        i === activeIdx ? a.color : T.muted,
                fontFamily:   'monospace',
                fontSize:     '11px',
                fontWeight:   i === activeIdx ? 700 : 400,
                cursor:       'pointer',
                whiteSpace:   'nowrap',
                transition:   'all 0.15s',
              }}
            >
              {a.name}
            </button>
          ))}
        </div>

        {/* ── Algorithm identity ───────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div>
              <h2 style={{
                fontSize:     '22px',
                fontWeight:   700,
                color:        algo.color,
                margin:        0,
                lineHeight:    1,
                marginBottom: '4px',
                textShadow:   `0 0 20px ${algo.color}55`,
              }}>
                {algo.name}
              </h2>
              <div style={{ fontSize: '12px', color: T.muted, marginBottom: '8px' }}>
                {algo.fullName}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display:      'inline-block',
                padding:      '3px 8px',
                borderRadius: '4px',
                background:   algo.tagColor + '33',
                border:       `1px solid ${algo.tagColor}55`,
                color:        algo.color,
                fontSize:     '9px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                {algo.tag}
              </div>
              <div style={{ fontSize: '10px', color: T.dim }}>
                {algo.authors} · {algo.year}
              </div>
            </div>
          </div>

          {/* Intuition one-liner */}
          <div style={{
            padding:      '10px 14px',
            borderRadius: '6px',
            background:   algo.color + '0d',
            border:       `1px solid ${algo.color}22`,
            fontSize:     '12px',
            color:        T.body,
            lineHeight:   1.6,
            marginBottom: '16px',
          }}>
            <span style={{ color: algo.color, fontWeight: 700, marginRight: '6px' }}>
              <Zap size={11} style={{ display: 'inline', marginRight: '4px' }} />
              Intuition:
            </span>
            {algo.intuition}
          </div>
        </div>

        {/* ── Content tab switcher ─────────────────────────────────────── */}
        <div style={{
          display:   'flex',
          gap:       '2px',
          padding:   '0 20px 12px',
        }}>
          {(['equation', 'properties', 'guide'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding:      '5px 14px',
                borderRadius: '5px',
                border:       `1px solid ${tab === t ? algo.color + '66' : T.border}`,
                background:   tab === t ? algo.color + '18' : 'transparent',
                color:        tab === t ? algo.color : T.muted,
                fontFamily:   'monospace',
                fontSize:     '10px',
                fontWeight:   tab === t ? 700 : 400,
                cursor:       'pointer',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition:   'all 0.15s',
              }}
            >
              {t === 'equation'   ? '∑ Equation'  :
               t === 'properties' ? '⚙ Properties' :
                                    '📖 Use Guide'}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div style={{ padding: '0 20px 20px' }}>

          {/* EQUATION TAB */}
          {tab === 'equation' && (
            <div>
              <Equation parts={algo.equation} label={algo.equationLabel} />

              {/* Symbol breakdown */}
              <div style={{ fontSize: '10px', color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Symbol Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {algo.breakdown.map((item, i) => (
                  <div key={i} style={{
                    display:     'grid',
                    gridTemplateColumns: '80px 1fr',
                    gap:         '12px',
                    alignItems:  'start',
                    padding:     '10px 12px',
                    borderRadius: '6px',
                    background:  T.card,
                    border:      `1px solid ${T.border}`,
                  }}>
                    <div>
                      <div style={{
                        fontFamily:  'monospace',
                        fontSize:    '14px',
                        fontWeight:  700,
                        color:       item.color,
                        marginBottom: '2px',
                        textShadow:  `0 0 10px ${item.color}55`,
                      }}>
                        {item.symbol}
                      </div>
                      <div style={{ fontSize: '9px', color: T.dim, letterSpacing: '0.06em' }}>
                        {item.name}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: T.body, lineHeight: 1.6 }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>

              {/* Convergence note */}
              <div style={{
                marginTop:    '14px',
                padding:      '10px 14px',
                borderRadius: '6px',
                background:   T.card2,
                border:       `1px solid ${T.border}`,
                fontSize:     '11px',
                color:        T.muted,
                lineHeight:   1.6,
              }}>
                <span style={{ color: T.body, fontWeight: 700, marginRight: '6px' }}>
                  <Brain size={11} style={{ display: 'inline', marginRight: '4px' }} />
                  Convergence:
                </span>
                {algo.convergence}
              </div>
            </div>
          )}

          {/* PROPERTIES TAB */}
          {tab === 'properties' && (
            <div>
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 '8px',
                marginBottom:        '14px',
              }}>
                {algo.properties.map((prop, i) => (
                  <div key={i} style={{
                    padding:      '10px 12px',
                    borderRadius: '6px',
                    background:   T.card,
                    border:       `1px solid ${
                      prop.good === true  ? '#00c97a33' :
                      prop.good === false ? '#f8717133' :
                      T.border
                    }`,
                  }}>
                    <div style={{ fontSize: '9px', color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {prop.label}
                    </div>
                    <div style={{
                      fontSize:   '12px',
                      fontWeight: 600,
                      color:
                        prop.good === true  ? '#00c97a' :
                        prop.good === false ? '#f87171' :
                        T.body,
                    }}>
                      {prop.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comparison note vs other algorithms */}
              <div style={{
                padding:      '12px 14px',
                borderRadius: '6px',
                background:   algo.color + '0d',
                border:       `1px solid ${algo.color}22`,
                fontSize:     '11px',
                color:        T.body,
                lineHeight:   1.7,
              }}>
                <div style={{ color: algo.color, fontWeight: 700, marginBottom: '6px', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Key distinction from similar algorithms
                </div>
                {algo.id === 'dqn'        && 'DQN is the neural-network upgrade of tabular Q-Learning. It adds a replay buffer (breaks temporal correlation) and a target network (stabilises TD targets). The core Bellman equation is identical — only the Q-function approximator changes.'}
                {algo.id === 'ppo'        && 'PPO improves on vanilla policy gradient (REINFORCE) and TRPO by replacing the KL divergence constraint with a simple clip operation. It reuses each rollout for K epochs (DQN keeps data forever; A2C discards after one pass).'}
                {algo.id === 'a2c'        && 'A2C is PPO without clipping. It\'s simpler and faster per update but less stable on long runs. If PPO is a car with ABS, A2C is the same car without it — works fine most of the time, but can lock up on a bad patch.'}
                {algo.id === 'q-learning' && 'Q-Learning uses max Q(s\',a\') as the TD target — it always imagines playing optimally from the next state, regardless of exploration. SARSA uses the actual next action Q(s\',a\'). This tiny difference makes Q-Learning off-policy and SARSA on-policy.'}
                {algo.id === 'sarsa'      && 'SARSA and Q-Learning share identical table structure and Bellman form. The only difference: SARSA\'s target uses Q(s\',a\') where a\' is sampled from the policy, not argmax. This makes SARSA conservative near risky states because it accounts for the probability of a random exploratory action.'}
              </div>
            </div>
          )}

          {/* USE GUIDE TAB */}
          {tab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Best for */}
              <div>
                <div style={{ fontSize: '10px', color: '#00c97a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  ✓ Best for
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {algo.bestFor.map((item, i) => (
                    <span key={i} style={{
                      padding:      '4px 10px',
                      borderRadius: '4px',
                      background:   '#00c97a18',
                      border:       '1px solid #00c97a33',
                      color:        '#00c97a',
                      fontSize:     '11px',
                      fontFamily:   'monospace',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Avoid when */}
              <div>
                <div style={{ fontSize: '10px', color: '#f87171', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  ✗ Avoid when
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {algo.avoidWhen.map((item, i) => (
                    <div key={i} style={{
                      padding:      '8px 12px',
                      borderRadius: '4px',
                      background:   '#f8717108',
                      border:       '1px solid #f8717122',
                      color:        '#f87171',
                      fontSize:     '11px',
                      lineHeight:   1.5,
                    }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick comparison table */}
              <div>
                <div style={{ fontSize: '10px', color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Platform Algorithm Comparison
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'monospace' }}>
                    <thead>
                      <tr style={{ background: T.card2 }}>
                        {['Algorithm', 'Policy', 'Net', 'Convergence', 'Best game'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '9px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Q-Learning', policy: 'Off',  net: '✗', conv: 'Guaranteed', game: 'Maze'      },
                        { name: 'SARSA',      policy: 'On',   net: '✗', conv: 'Guaranteed', game: 'TreasureHunt'},
                        { name: 'DQN',        policy: 'Off',  net: '✓', conv: 'Empirical',  game: 'Connect 4' },
                        { name: 'A2C',        policy: 'On',   net: '✓', conv: 'Empirical',  game: 'Pong'      },
                        { name: 'PPO',        policy: 'On',   net: '✓', conv: 'Empirical',  game: 'Breakout'  },
                      ].map((row, i) => {
                        const isActive = row.name.toLowerCase().replace('-', '') === algo.id.replace('-', '');
                        return (
                          <tr key={i} style={{ background: isActive ? algo.color + '11' : (i % 2 === 0 ? T.card : T.card2) }}>
                            <td style={{ padding: '7px 10px', color: isActive ? algo.color : T.body, fontWeight: isActive ? 700 : 400, borderBottom: `1px solid ${T.border}` }}>{row.name}</td>
                            <td style={{ padding: '7px 10px', color: T.muted, borderBottom: `1px solid ${T.border}` }}>{row.policy}</td>
                            <td style={{ padding: '7px 10px', color: row.net === '✓' ? '#00c97a' : '#f87171', borderBottom: `1px solid ${T.border}` }}>{row.net}</td>
                            <td style={{ padding: '7px 10px', color: row.conv === 'Guaranteed' ? '#00c97a' : T.muted, borderBottom: `1px solid ${T.border}` }}>{row.conv}</td>
                            <td style={{ padding: '7px 10px', color: T.muted, borderBottom: `1px solid ${T.border}` }}>{row.game}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer navigation ─────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          padding:        '12px 20px',
          borderTop:      `1px solid ${T.border}`,
          background:     T.card,
          borderRadius:   '0 0 12px 12px',
          position:       'sticky',
          bottom:          0,
        }}>
          <button onClick={prev} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '4px',
            padding:    '5px 12px',
            borderRadius: '5px',
            border:     `1px solid ${T.border}`,
            background: 'transparent',
            color:      T.muted,
            cursor:     'pointer',
            fontSize:   '11px',
            fontFamily: 'monospace',
          }}>
            <ChevronLeft size={13} /> Prev
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            {ALGORITHMS.map((_, i) => (
              <div key={i} onClick={() => setActiveIdx(i)} style={{
                width:        i === activeIdx ? '16px' : '6px',
                height:       '6px',
                borderRadius: '3px',
                background:   i === activeIdx ? algo.color : T.border,
                cursor:       'pointer',
                transition:   'all 0.2s',
              }} />
            ))}
          </div>

          <button onClick={next} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '4px',
            padding:    '5px 12px',
            borderRadius: '5px',
            border:     `1px solid ${T.border}`,
            background: 'transparent',
            color:      T.muted,
            cursor:     'pointer',
            fontSize:   '11px',
            fontFamily: 'monospace',
          }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Trigger button ───────────────────────────────────────────────────────────
// Drop this anywhere next to an algorithm selector.
// It opens the handbook pre-focused on the relevant algorithm.

interface HandbookTriggerProps {
  algorithmId?: string;   // if provided, opens directly to that algorithm
  size?:        'sm' | 'md';
}

export function HandbookTrigger({
  algorithmId,
  size = 'sm',
}: HandbookTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Open Algorithm Handbook (XAI)"
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        '4px',
          padding:    size === 'sm' ? '3px 8px' : '5px 12px',
          borderRadius: '5px',
          border:     '1px solid #1e2d3d',
          background: 'transparent',
          color:      '#475569',
          cursor:     'pointer',
          fontFamily: 'monospace',
          fontSize:   size === 'sm' ? '10px' : '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#06b6d4';
          (e.currentTarget as HTMLButtonElement).style.color       = '#06b6d4';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2d3d';
          (e.currentTarget as HTMLButtonElement).style.color       = '#475569';
        }}
      >
        <HelpCircle size={size === 'sm' ? 11 : 13} />
        {size === 'md' && 'Algorithm Handbook'}
      </button>

      {open && (
        <AlgorithmHandbook
          initialAlgorithmId={algorithmId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
