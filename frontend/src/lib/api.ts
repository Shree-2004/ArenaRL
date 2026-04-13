// frontend/src/lib/api.ts

import io from 'socket.io-client';

const API_BASE_URL = '/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Agent {
  id:            string;
  name:          string;
  game:          string;
  algorithm:     string;
  type:          string;   // aliased from algorithm for UI compatibility
  status:        'pending' | 'training' | 'completed' | 'failed';
  episodes:      number;
  learning_rate: number;
  final_reward?: number;
  matches_won:   number;
  matches_played: number;
  created_at:    string;
  trainable?:    boolean;
  trained?:      boolean;
  hyperparameters?: Record<string, any>;
}

export interface Game {
  id:              string;
  name:            string;
  description:     string;
  boardSize:       [number, number];
  supportedAgents: string[];
}

export interface LeaderboardEntry {
  id:            string;
  name:          string;
  owner:         string;
  game:          string;
  matches_won:   number;
  matches_played: number;
  win_rate:      number;
}

/**
 * TrainingProgress — the live data shape emitted by the backend
 * via Socket.IO's 'training_update' event and consumed by the
 * Train page dashboard.
 *
 * FIELDS GROUPED BY SOURCE:
 *
 * Core fields (all algorithms emit these every update):
 *   agent_id, episode, status, currentEpisode, totalEpisodes,
 *   reward, avgReward, winRate, epsilon, sps, board, log
 *
 * History arrays (for the reward/loss/win-rate charts):
 *   rewardHistory, lossHistory, winRateHistory
 *
 * DQN-specific (from dqn.py update() return dict):
 *   avg_q       — average Q-value over the sampled batch
 *   buffer_size — current number of transitions in the replay buffer
 *
 * A2C / PPO-specific (from a2c.py / ppo.py update() return dict):
 *   actor_loss  — policy gradient loss component
 *   critic_loss — value function MSE loss component
 *   entropy     — entropy of the action distribution
 *   advantage   — mean advantage over the rollout batch
 *
 * Q-Learning / SARSA-specific (from q_learning.py / sarsa.py update()):
 *   td_error    — mean absolute TD error (proxy for loss)
 *   table_size  — number of unique states in the Q-table
 */
export interface TrainingProgress {
  // ── Identity ──────────────────────────────────────────────────────
  agent_id:       string;

  // ── Episode tracking ──────────────────────────────────────────────
  episode:        number;
  currentEpisode: number;
  totalEpisodes:  number;

  // ── Core metrics ──────────────────────────────────────────────────
  reward:         number;
  avgReward:      number;
  winRate:        number;
  epsilon:        number;
  status:         string;
  sps?:           number;

  // ── History arrays (for charts) ───────────────────────────────────
  rewardHistory:  number[];
  lossHistory:    number[];
  winRateHistory: number[];

  // ── Live game render ──────────────────────────────────────────────
  board?:         any;

  // ── Terminal log ──────────────────────────────────────────────────
  log?:           string;
  logs?:          string[];

  // ── DQN-specific ──────────────────────────────────────────────────
  avg_q?:         number;
  buffer_size?:   number;
  q_values?:      number[];   // latest Q-values from select_action()

  // ── A2C / PPO-specific ────────────────────────────────────────────
  actor_loss?:    number;
  critic_loss?:   number;
  entropy?:       number;
  advantage?:     number;
  action_probs?:  number[];   // latest action probabilities from select_action()

  // ── Q-Learning / SARSA-specific ───────────────────────────────────
  td_error?:      number;
  table_size?:    number;
}

// ─── API Class ────────────────────────────────────────────────────────────────

class ArenaAPI {
  private token:  string | null = localStorage.getItem('token');
  private socket: ReturnType<typeof io> | null = null;

  // ── Token management ────────────────────────────────────────────────

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else        localStorage.removeItem('token');
  }

  // ── Generic fetch wrapper ────────────────────────────────────────────

  private async fetch<T>(
    endpoint:  string,
    options?:  RequestInit & { skipRedirect?: boolean }
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (response.status === 401 && !options?.skipRedirect) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<any> {
    const data = await this.fetch<any>('/auth/login', {
      method:       'POST',
      body:         JSON.stringify({ username, password }),
      skipRedirect: true,
    });
    this.setToken(data.access_token);
    return data;
  }

  async register(username: string, email: string, password: string): Promise<any> {
    return this.fetch('/auth/register', {
      method:       'POST',
      body:         JSON.stringify({ username, email, password }),
      skipRedirect: true,
    });
  }

  async getProfile(skipRedirect = false): Promise<any> {
    return this.fetch('/auth/me', { skipRedirect });
  }

  // ── Agents ───────────────────────────────────────────────────────────

  async getAgents(skipRedirect = false): Promise<Agent[]> {
    const data = await this.fetch<{ agents: any[] }>('/agents/', { skipRedirect });
    return data.agents.map(a => ({
      ...a,
      type: a.algorithm,   // map algorithm → type for UI compatibility
    }));
  }

  async createAgent(config: any): Promise<any> {
    return this.fetch('/agents/', {
      method: 'POST',
      body:   JSON.stringify(config),
    });
  }

  async deleteAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}`, { method: 'DELETE' });
  }

  // ── Stats & Leaderboard ──────────────────────────────────────────────

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const data = await this.fetch<{ leaderboard: LeaderboardEntry[] }>(
      '/stats/leaderboard', { skipRedirect: true }
    );
    return data.leaderboard;
  }

  async getDashboard(skipRedirect = false): Promise<any> {
    return this.fetch('/stats/dashboard', { skipRedirect });
  }

  // ── Reports ──────────────────────────────────────────────────────────

  async downloadReport(agentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/reports/${agentId}/pdf`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    if (!response.ok) throw new Error('Failed to download report');

    const blob = await response.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `report_${agentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ── Socket.IO — Training ─────────────────────────────────────────────

  /**
   * Opens a Socket.IO connection to the /training namespace, joins the
   * agent's room, and starts a training session once the join is confirmed.
   *
   * The race-condition-free flow:
   *   connect → emit 'join' → receive 'join_ack' → emit 'start_training'
   *
   * The 'training_update' handler normalises the backend payload into a
   * fully-typed TrainingProgress object, including all new history arrays
   * and algorithm-specific metric fields.
   */
  connectTraining(
    agentId:  string,
    config:   any,
    onUpdate: (data: TrainingProgress) => void
  ): ReturnType<typeof io> {
    if (this.socket) this.socket.disconnect();

    this.socket = io('/training', {
      auth: { token: this.token },
    });

    // Step 1: join the agent's room
    this.socket.on('connect', () => {
      this.socket?.emit('join', { agent_id: agentId });
    });

    // Step 2: room confirmed — now safe to start training
    this.socket.on('join_ack', ({ agent_id }: { agent_id: string }) => {
      if (agent_id === agentId) {
        this.socket?.emit('start_training', { agent_id: agentId, config });
      }
    });

    /**
     * 'training_update' normalisation.
     *
     * The backend emits both camelCase and snake_case versions of most
     * fields (see manager.py). We prefer camelCase but fall back to
     * snake_case so old backend versions don't break the frontend.
     *
     * History arrays:
     *   rewardHistory  ← data.rewardHistory  || data.reward_history  || []
     *   lossHistory    ← data.lossHistory     (new field from our backend fix)
     *   winRateHistory ← data.winRateHistory  || data.win_rate_history || []
     *
     * Algorithm-specific fields are spread in directly — they are optional
     * in the TrainingProgress interface, so they'll be undefined if the
     * current algorithm doesn't produce them (no UI crash).
     */
    this.socket.on('training_update', (data: any) => {
      const progress: TrainingProgress = {
        // ── Identity ──────────────────────────────────────────────
        agent_id: data.agent_id ?? agentId,

        // ── Episode tracking ──────────────────────────────────────
        episode:        data.episode        ?? 0,
        currentEpisode: data.currentEpisode ?? data.episode  ?? 0,
        totalEpisodes:  data.totalEpisodes  ?? data.total_episodes ?? config.episodes ?? 1000,

        // ── Core metrics ──────────────────────────────────────────
        reward:    data.reward    ?? 0,
        avgReward: data.avgReward ?? data.avg_reward ?? data.reward ?? 0,
        winRate:   data.winRate   ?? data.win_rate   ?? 0,
        epsilon:   data.epsilon   ?? 0,
        status:    data.status    ?? 'training',
        sps:       data.sps,

        // ── History arrays ────────────────────────────────────────
        rewardHistory:  data.rewardHistory  ?? data.reward_history   ?? [],
        lossHistory:    data.lossHistory    ?? [],                          // new
        winRateHistory: data.winRateHistory ?? data.win_rate_history ?? [],

        // ── Live game render ──────────────────────────────────────
        board: data.board,

        // ── Terminal log ──────────────────────────────────────────
        log:  data.log,
        logs: data.logs,

        // ── DQN-specific ──────────────────────────────────────────
        avg_q:       data.avg_q,
        buffer_size: data.buffer_size,
        q_values:    data.q_values,

        // ── A2C / PPO-specific ────────────────────────────────────
        actor_loss:   data.actor_loss,
        critic_loss:  data.critic_loss,
        entropy:      data.entropy,
        advantage:    data.advantage,
        action_probs: data.action_probs,

        // ── Q-Learning / SARSA-specific ───────────────────────────
        td_error:   data.td_error,
        table_size: data.table_size,
      };

      onUpdate(progress);
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[Socket] Training connection error:', err.message);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[Socket] Training disconnected:', reason);
    });

    return this.socket;
  }

  // ── Socket.IO — Arena ────────────────────────────────────────────────

  connectArena(onUpdate: (data: any) => void): ReturnType<typeof io> {
    if (this.socket) this.socket.disconnect();

    this.socket = io('/arena', {
      auth: { token: this.token },
    });

    this.socket.on('arena_state', (data: any) => {
      onUpdate(data);
    });

    this.socket.on('arena_complete', (data: any) => {
      onUpdate({ ...data, gameOver: true });
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[Socket] Arena connection error:', err.message);
    });

    return this.socket;
  }

  startMatch(agent1Id: string, agent2Id: string, game: string) {
    this.socket?.emit('start_match', {
      agent1_id: agent1Id,
      agent2_id: agent2Id,
      game,
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const api = new ArenaAPI();

// ─── Static game registry (fallback when backend /games endpoint is unavailable) ──

export const mockGames: Game[] = [
  { id: 'connect4',     name: 'Connect 4',          description: 'Drop discs to connect four',      boardSize: [6, 7],     supportedAgents: ['dqn', 'ppo', 'human']                   },
  { id: 'maze',         name: 'Maze Navigator',      description: 'Two-player maze race',             boardSize: [15, 15],   supportedAgents: ['q-learning', 'dqn', 'sarsa', 'human']   },
  { id: 'snake',        name: 'Snake',               description: 'Two-player snake competition',     boardSize: [20, 20],   supportedAgents: ['dqn', 'q-learning', 'ppo', 'human']     },
  { id: 'pong',         name: 'Pong',                description: 'Classic Pong — human vs AI',       boardSize: [100, 160], supportedAgents: ['dqn', 'ppo', 'a2c', 'human']            },
  { id: 'flappybird',   name: 'Flappy Bird',         description: 'Two-player pipe dodging',          boardSize: [288, 512], supportedAgents: ['dqn', 'ppo', 'a2c', 'human']            },
  { id: 'dodge',        name: 'Dodge',               description: 'Avoid falling obstacles',          boardSize: [10, 10],   supportedAgents: ['dqn', 'ppo', 'sarsa', 'human']          },
  { id: '2048',         name: '2048',                description: 'Classic tile-merging game',        boardSize: [4, 4],     supportedAgents: ['dqn', 'q-learning', 'human']            },
  { id: 'breakout',     name: 'Breakout',            description: 'Destroy bricks with a ball',       boardSize: [100, 160], supportedAgents: ['dqn', 'ppo', 'human']                   },
  { id: 'treasurehunt', name: 'Grid Treasure Hunt',  description: 'Find treasure, avoid traps',       boardSize: [5, 5],     supportedAgents: ['q-learning', 'sarsa', 'human']          },
  { id: 'balloonpop',   name: 'Balloon Pop',         description: 'Aim and pop balloons',             boardSize: [100, 100], supportedAgents: ['dqn', 'a2c', 'human']                   },
];