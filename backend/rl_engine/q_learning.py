# backend/rl_engine/q_learning.py

import numpy as np
import random
import torch
import torch.nn as nn
from typing import Tuple, Dict, Any
from .base import BaseAlgorithm


class QLearningAlgorithm(BaseAlgorithm):
    """
    Tabular Q-Learning — Watkins & Dayan, 1992.

    WHAT IS TABULAR Q-LEARNING (for your viva):
    Instead of approximating Q(s,a) with a neural network (like DQN),
    this algorithm stores Q-values in a plain Python dictionary:

        q_table[(s_0, s_1, ..., s_n)] = [Q(s,a0), Q(s,a1), ..., Q(s,ak)]

    Every unique state the agent visits gets its own row in this table.
    The agent looks up the row, reads the Q-value for each action,
    and picks the highest one (or explores randomly).

    WHY USE A TABLE INSTEAD OF A NETWORK:
    For simple games with small, discrete state spaces (Snake on a small
    grid, a Maze with a few hundred cells), the table fits in memory and
    converges faster than training a neural network from scratch.
    The trade-off: if the state space is large (e.g. raw pixel input),
    the table explodes in size — that's exactly why DQN was invented.

    VIVA COMPARISON TABLE:
    ┌──────────────────┬─────────────────────┬──────────────────────┐
    │                  │ Tabular Q-Learning  │ DQN                  │
    ├──────────────────┼─────────────────────┼──────────────────────┤
    │ State space      │ Small, discrete     │ Large / continuous   │
    │ Memory           │ O(|S|·|A|) dict     │ Fixed network size   │
    │ Learning speed   │ Fast (no backprop)  │ Slower (GPU helps)   │
    │ Generalisation   │ None (exact lookup) │ Yes (interpolates)   │
    │ Convergence      │ Guaranteed (theory) │ Not guaranteed       │
    └──────────────────┴─────────────────────┴──────────────────────┘

    DATA FLOW (one step):
        select_action(s)   → ε-greedy lookup in q_table
        record_step(...)   → immediately applies Bellman update to q_table
        update()           → no-op (learning already done in record_step)
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        super().__init__(state_dim, action_dim, config)

        # The Q-table: maps state tuple → numpy array of Q-values per action.
        # Lazily initialised — a state only gets a row when first visited.
        # Starting at zeros means the agent is initially optimistic about
        # unexplored states, which encourages exploration naturally.
        self.q_table: Dict[tuple, np.ndarray] = {}

        # Track last seen transition so update() can also work if called.
        # (record_step updates immediately, but we keep this for safety.)
        self._last_transition = None

        # Running loss approximation for the dashboard
        # (tabular Q-learning has no formal "loss", but we track the
        # TD error as a proxy — it should shrink as the table converges)
        self._recent_td_errors: list = []

    # ------------------------------------------------------------------
    # Required by BaseAlgorithm
    # ------------------------------------------------------------------

    def _build_model(self) -> nn.Module:
        """
        BaseAlgorithm requires a PyTorch model, but tabular Q-learning
        doesn't use one. We return the smallest possible dummy network
        (1 input → 1 output) just to satisfy the interface contract.

        The dummy model is never called during select_action or update.
        self.optimizer is also created by BaseAlgorithm but never used here.

        VIVA NOTE: This is an example of the Adapter pattern — we're
        adapting a non-neural algorithm to fit a neural-algorithm interface.
        """
        return nn.Linear(1, 1)

    def _get_q_values(self, state: np.ndarray) -> np.ndarray:
        """
        Look up (or lazily create) the Q-value row for a given state.

        The state vector is converted to a tuple to use as a dict key.
        Tuples are hashable; numpy arrays are not.

        New states are initialised to all-zeros, meaning the agent has
        no prior preference — it will explore and update from there.
        """
        state_key = tuple(np.round(state, decimals=4).tolist())
        if state_key not in self.q_table:
            self.q_table[state_key] = np.zeros(self.action_dim)
        return self.q_table[state_key]

    def select_action(
        self,
        state:    np.ndarray,
        training: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Epsilon-greedy action selection via direct Q-table lookup.

        Unlike DQN, there is no forward pass through a neural network.
        We just look up the state in the dictionary and read off the
        Q-values directly — O(1) time, no GPU needed.
        """
        q_values = self._get_q_values(state)

        if training and random.random() < self.epsilon:
            action    = random.randint(0, self.action_dim - 1)
            reasoning = f"Exploring randomly (ε={self.epsilon:.3f})"
        else:
            action    = int(np.argmax(q_values))
            reasoning = (
                f"Exploiting: action {action} has highest "
                f"Q-value ({q_values[action]:.4f})"
            )

        return action, {
            'q_values':  q_values.tolist(),
            'epsilon':   self.epsilon,
            'reasoning': reasoning,
            'table_size': len(self.q_table),   # useful dashboard stat
        }

    def record_step(
        self,
        state:      np.ndarray,
        action:     int,
        reward:     float,
        next_state: np.ndarray,
        done:       bool
    ) -> None:
        """
        Apply the Bellman update immediately after every single step.

        WHY TABULAR Q-LEARNING UPDATES HERE (not in update()):
        DQN stores transitions in a replay buffer and learns in batches
        later — it has to, because it needs enough data to train a stable
        neural network. Tabular Q-learning has no such requirement. Each
        transition gives us everything we need to make an exact table update
        right now. Waiting serves no purpose.

        THE BELLMAN UPDATE EQUATION:
            Q(s,a) ← Q(s,a) + α · [ r + γ·max_a' Q(s',a')  −  Q(s,a) ]
                                     └──────── TD target ────────┘
                                     └────────── TD error ──────────────┘

        Breaking it down:
          Q(s,a)               = our current estimate (what we predicted)
          r + γ·max Q(s',a')   = TD target (what we now know it should be)
          TD error             = how wrong we were
          α · TD error         = how much we correct our estimate

        This is a weighted average: α=1.0 means "forget old estimate
        entirely", α=0.0 means "never update". Typical α=0.1–0.3.

        CONVERGENCE GUARANTEE:
        Tabular Q-learning is proven to converge to the optimal Q* for
        any finite MDP, given enough exploration and a decaying learning
        rate. DQN has no such guarantee (neural networks can diverge).
        This is a key theoretical advantage you can cite in your viva.
        """
        current_q = self._get_q_values(state)[action]

        if done:
            # Terminal state: no future rewards possible.
            # TD target = immediate reward only (no bootstrap term).
            td_target = reward
        else:
            # Non-terminal: bootstrap from the best action in next state.
            # This is the "max" in Q-learning — always assume optimal
            # future behaviour regardless of what we actually do next.
            # (This "off-policy" property is what makes Q-learning powerful.)
            next_max_q = float(np.max(self._get_q_values(next_state)))
            td_target  = reward + self.gamma * next_max_q

        # TD error: how far off our current estimate was
        td_error = td_target - current_q

        # Apply the update to the specific (state, action) cell in the table
        state_key = tuple(np.round(state, decimals=4).tolist())
        self.q_table[state_key][action] = current_q + self.lr * td_error

        # Track TD error magnitude as a proxy loss for the dashboard.
        # Should trend toward zero as the table converges.
        self._recent_td_errors.append(abs(td_error))
        if len(self._recent_td_errors) > 500:
            self._recent_td_errors.pop(0)

        # Store for update() compatibility
        self._last_transition = (state, action, reward, next_state, done)

    def update(self) -> Dict[str, float]:
        """
        No-op for tabular Q-learning — all learning happens in record_step().

        We return TD error statistics instead of a neural network loss.
        These are the tabular equivalent of the loss curve and serve the
        same purpose on the Stats page: evidence that the agent is converging.

        VIVA NOTE: If an examiner asks "why is loss always 0 for Q-learning?",
        explain that tabular RL doesn't use gradient descent — the Bellman
        update is a direct algebraic assignment, not an optimisation step.
        The TD error is the conceptually equivalent metric.
        """
        if not self._recent_td_errors:
            return {'loss': 0.0, 'td_error': 0.0, 'table_size': len(self.q_table)}

        avg_td  = float(np.mean(self._recent_td_errors))
        max_td  = float(np.max(self._recent_td_errors))

        return {
            'loss':       avg_td,          # labelled 'loss' for dashboard compatibility
            'td_error':   avg_td,          # more accurate label for the stats page
            'max_td':     max_td,
            'table_size': len(self.q_table),
            'epsilon':    self.epsilon,
        }

    def save(self, filepath: str) -> None:
        """
        Save the Q-table to disk alongside the dummy model checkpoint.

        We override BaseAlgorithm.save() because the actual learned
        knowledge lives in self.q_table (a Python dict), not in
        self.model.state_dict() (the unused dummy network).
        """
        import pickle, os

        # Save the Q-table as a .pkl file alongside the .pt file
        table_path = filepath.replace('.pt', '_qtable.pkl')
        with open(table_path, 'wb') as f:
            pickle.dump({
                'q_table':       self.q_table,
                'epsilon':       self.epsilon,
                'training_step': self.training_step,
                'episode_count': self.episode_count,
            }, f)

        # Also call parent save so the file path contract is honoured
        # (manager.py expects a .pt file to exist after save())
        super().save(filepath)

        print(f"[Q-Learning] Q-table saved: {len(self.q_table)} states → {table_path}")

    def load(self, filepath: str) -> None:
        """
        Restore the Q-table from disk.
        Falls back gracefully if the .pkl file is missing
        (e.g. model was saved by an older version of the code).
        """
        import pickle, os

        table_path = filepath.replace('.pt', '_qtable.pkl')
        if os.path.exists(table_path):
            with open(table_path, 'rb') as f:
                data = pickle.load(f)
            self.q_table       = data.get('q_table', {})
            self.epsilon       = data.get('epsilon',       self.epsilon)
            self.training_step = data.get('training_step', 0)
            self.episode_count = data.get('episode_count', 0)
            print(f"[Q-Learning] Q-table loaded: {len(self.q_table)} states ← {table_path}")
        else:
            print(f"[Q-Learning] Warning: no Q-table file found at {table_path}. Starting fresh.")

        # Load dummy model weights to satisfy BaseAlgorithm contract
        super().load(filepath)