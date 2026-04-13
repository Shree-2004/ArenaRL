# backend/rl_engine/sarsa.py

import numpy as np
import random
import torch
import torch.nn as nn
from typing import Tuple, Dict, Any, Optional
from .base import BaseAlgorithm


class SARSAAlgorithm(BaseAlgorithm):
    """
    SARSA (On-Policy TD Control) — Rummery & Niranjan, 1994.

    WHAT SARSA STANDS FOR:
    State → Action → Reward → (next) State → (next) Action
    These are the five things used in every single update step.
    The name describes the data tuple the algorithm consumes.

    THE KEY DIFFERENCE FROM Q-LEARNING (this is the #1 viva question):

    Q-Learning update:
        Q(s,a) ← Q(s,a) + α·[ r  +  γ · max_a' Q(s',a')  −  Q(s,a) ]
                                         ↑
                               always uses the BEST possible next action
                               regardless of what the agent will actually do

    SARSA update:
        Q(s,a) ← Q(s,a) + α·[ r  +  γ · Q(s', a')  −  Q(s,a) ]
                                              ↑
                               uses the action A' that the agent will
                               ACTUALLY take next (sampled from its policy)

    This single difference makes SARSA ON-POLICY and Q-Learning OFF-POLICY.

    ON-POLICY vs OFF-POLICY (the viva explanation):

    Q-Learning is OFF-POLICY: it learns the value of the OPTIMAL policy
    even while following a different (exploratory) behaviour policy.
    The "max" operator means it always imagines playing perfectly in the
    future, regardless of what epsilon-greedy will actually do.

    SARSA is ON-POLICY: it learns the value of the policy it is actually
    FOLLOWING, including its exploration mistakes. If the agent is likely
    to take a random action next (high epsilon), SARSA factors that risk
    into its Q-value estimate. It evaluates the agent as it actually
    behaves, not as it ideally would.

    PRACTICAL CONSEQUENCE:
    In environments with "cliffs" or irreversible mistakes (like the
    classic Cliff Walking problem), SARSA learns a SAFER path because it
    accounts for the risk of accidental exploration near dangerous states.
    Q-Learning finds the theoretically optimal (but riskier) path.

    WHY THE ONE-STEP LAG:
    SARSA needs to know A' (the NEXT action) to update Q(s,a).
    But A' only exists AFTER the agent has observed s' and decided what
    to do next. So every update is delayed by one step:

        Step t:   observe (s, a, r, s')  →  store in prev_*
        Step t+1: observe a'             →  NOW we can update Q(s,a)

    This is the "one-step lag" pattern. It requires three instance
    variables (prev_state, prev_action, prev_reward) to bridge the gap.

    DATA FLOW:
        select_action(s_t)               → returns a_t, stores nothing
        record_step(s_t,a_t,r_t,s_{t+1}) → updates Q(s_{t-1}, a_{t-1})
                                            using (r_{t-1}, s_t, a_t)
        update()                         → no-op, returns TD error stats
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        super().__init__(state_dim, action_dim, config)

        # Q-table: state tuple → numpy array of Q-values per action.
        # Initialised lazily (states added on first visit).
        self.q_table: Dict[tuple, np.ndarray] = {}

        # One-step lag variables — bridge between consecutive steps.
        # All three are None at the start of every episode.
        self.prev_state:  Optional[np.ndarray] = None
        self.prev_action: Optional[int]        = None
        self.prev_reward: Optional[float]      = None

        # TD error history for the Stats page (proxy for loss)
        self._recent_td_errors: list = []

    # ------------------------------------------------------------------
    # Required by BaseAlgorithm
    # ------------------------------------------------------------------

    def _build_model(self) -> nn.Module:
        """
        Dummy model to satisfy BaseAlgorithm's interface.
        SARSA is tabular — no neural network is used.
        See QLearningAlgorithm._build_model for full explanation.
        """
        return nn.Linear(1, 1)

    def _get_q_values(self, state: np.ndarray) -> np.ndarray:
        """
        Look up (or lazily create) the Q-value row for this state.
        Rounds to 4 decimal places to collapse near-identical float
        states into the same key (prevents unbounded table growth).
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
        Epsilon-greedy action selection.

        IMPORTANT: unlike PPO's select_action, we do NOT store anything
        here. In SARSA, the action chosen here becomes A' (the "next
        action") for the PREVIOUS step's update. That update happens in
        record_step() when we receive this action as part of the new
        transition — not here.
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
            'q_values':   q_values.tolist(),
            'epsilon':    self.epsilon,
            'reasoning':  reasoning,
            'table_size': len(self.q_table),
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
        The SARSA one-step-lag update.

        WHAT HAPPENS HERE (step by step):

        On every call except the very first step of an episode, we have:
            prev_state   = S_{t-1}
            prev_action  = A_{t-1}
            prev_reward  = R_{t-1}  (reward received after A_{t-1})
            state        = S_t      (state we arrived in)
            action       = A_t      (what we WILL do next — this is A')

        So we can now form the complete SARSA tuple for step t-1:
            (S_{t-1}, A_{t-1}, R_{t-1}, S_t, A_t)
        and apply the update:
            Q(S_{t-1}, A_{t-1}) ← Q(S_{t-1}, A_{t-1})
                                   + α·[R_{t-1} + γ·Q(S_t, A_t)
                                        − Q(S_{t-1}, A_{t-1})]

        ON TERMINAL STEP:
        When done=True, S_t is a terminal state — there is no A'.
        We handle this separately: the update for the final transition
        uses target = R_t only (no bootstrap term), then we flush the
        lag variables so the next episode starts clean.

        SARSA vs Q-LEARNING IN THIS METHOD:
        If this were Q-learning, line marked [SARSA KEY LINE] would be:
            next_q = np.max(self._get_q_values(state))
        i.e. we'd use the MAX over all actions in S_t, not the specific
        action A_t that our policy chose. That tiny difference is the
        entire on-policy / off-policy distinction.
        """
        # --- Update for the PREVIOUS step (if one exists) ---
        if self.prev_state is not None:
            prev_q_values = self._get_q_values(self.prev_state)
            current_q_at_action = self._get_q_values(state)[action]  # Q(S_t, A_t)

            # [SARSA KEY LINE] — uses A_t (actual next action), not max_a Q
            td_target = self.prev_reward + self.gamma * current_q_at_action
            td_error  = td_target - prev_q_values[self.prev_action]

            prev_q_values[self.prev_action] += self.lr * td_error

            self._recent_td_errors.append(abs(td_error))
            if len(self._recent_td_errors) > 500:
                self._recent_td_errors.pop(0)

        # --- Handle terminal step ---
        if done:
            # For the FINAL transition (S_t, A_t, R_t → terminal):
            # There is no S_{t+1} or A_{t+1}, so the TD target is just R_t.
            # We update Q(S_t, A_t) directly here rather than waiting for
            # a "next call" that will never come.
            q_values = self._get_q_values(state)
            td_error_terminal = reward - q_values[action]
            q_values[action] += self.lr * td_error_terminal

            self._recent_td_errors.append(abs(td_error_terminal))
            if len(self._recent_td_errors) > 500:
                self._recent_td_errors.pop(0)

            # Reset lag variables — next episode starts fresh
            self._reset_episode()

        else:
            # Store current step as "previous" for the next call
            self.prev_state  = state.copy()   # .copy() avoids aliasing bugs
            self.prev_action = action          # this becomes A' next step
            self.prev_reward = reward

    def update(self) -> Dict[str, float]:
        """
        No-op — all learning is done immediately in record_step().

        Returns TD error statistics as a proxy for loss.
        The average TD error should visibly decrease as the Q-table
        converges toward the true value function.

        VIVA NOTE: If asked "why is there no update() in SARSA?",
        explain that tabular on-policy methods don't need a replay buffer
        or batch updates. Each transition is a complete learning signal
        on its own — no need to accumulate data before learning.
        """
        if not self._recent_td_errors:
            return {
                'loss':       0.0,
                'td_error':   0.0,
                'table_size': len(self.q_table),
                'epsilon':    self.epsilon,
            }

        avg_td = float(np.mean(self._recent_td_errors))
        max_td = float(np.max(self._recent_td_errors))

        return {
            'loss':       avg_td,
            'td_error':   avg_td,
            'max_td':     max_td,
            'table_size': len(self.q_table),
            'epsilon':    self.epsilon,
        }

    def save(self, filepath: str) -> None:
        """
        Save Q-table to disk. Overrides BaseAlgorithm.save() for the
        same reason as QLearningAlgorithm — the learned knowledge is in
        self.q_table, not in the dummy self.model.
        """
        import pickle

        table_path = filepath.replace('.pt', '_sarsa_qtable.pkl')
        with open(table_path, 'wb') as f:
            pickle.dump({
                'q_table':       self.q_table,
                'epsilon':       self.epsilon,
                'training_step': self.training_step,
                'episode_count': self.episode_count,
            }, f)

        super().save(filepath)
        print(f"[SARSA] Q-table saved: {len(self.q_table)} states → {table_path}")

    def load(self, filepath: str) -> None:
        """
        Restore Q-table from disk, with graceful fallback if file is missing.
        """
        import pickle, os

        table_path = filepath.replace('.pt', '_sarsa_qtable.pkl')
        if os.path.exists(table_path):
            with open(table_path, 'rb') as f:
                data = pickle.load(f)
            self.q_table       = data.get('q_table', {})
            self.epsilon       = data.get('epsilon',       self.epsilon)
            self.training_step = data.get('training_step', 0)
            self.episode_count = data.get('episode_count', 0)
            print(f"[SARSA] Q-table loaded: {len(self.q_table)} states ← {table_path}")
        else:
            print(f"[SARSA] Warning: no Q-table file at {table_path}. Starting fresh.")

        super().load(filepath)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _reset_episode(self) -> None:
        """
        Clear the one-step lag variables at episode boundaries.
        Must be called whenever done=True so the first step of the next
        episode doesn't accidentally use stale data from the last episode.
        """
        self.prev_state  = None
        self.prev_action = None
        self.prev_reward = None