# backend/rl_engine/dqn.py

import torch
import torch.nn as nn
import numpy as np
import random
from collections import deque
from typing import Tuple, Dict, Any
from .base import BaseAlgorithm


class DQNNetwork(nn.Module):
    """
    The neural network that approximates the Q-function.

    WHAT THIS IS (for your viva):
    Q(s, a) = "how much total future reward do I expect if I take action 'a'
    in state 's' and then play optimally from there?"

    Instead of storing a giant table (impossible for continuous states),
    we train a neural network to approximate this function.
    Input  → game state vector (e.g. positions of all game objects)
    Output → one Q-value per possible action
    """

    def __init__(self, state_dim: int, action_dim: int):
        super(DQNNetwork, self).__init__()
        self.net = nn.Sequential(
            # Layer 1: raw state → hidden representation
            nn.Linear(state_dim, 128),
            nn.ReLU(),
            # Layer 2: deeper feature extraction
            nn.Linear(128, 128),
            nn.ReLU(),
            # Output: one Q-value per action (no activation — Q can be negative)
            nn.Linear(128, action_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class DQNAlgorithm(BaseAlgorithm):
    """
    Deep Q-Network (DQN) — Mnih et al., 2015 (DeepMind / Atari paper).

    KEY INNOVATIONS over vanilla Q-Learning (examiner will ask this):
    1. Experience Replay: store transitions in a buffer, sample random
       mini-batches to break correlation between consecutive samples.
    2. Target Network: a frozen copy of the main network used to compute
       stable TD targets. Updated every N steps, not every step.

    Without these two tricks, the training signal is too unstable and
    the network diverges (reward curve never improves).
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        # BaseAlgorithm.__init__ builds self.model and self.optimizer
        super().__init__(state_dim, action_dim, config)

        # --- Target network (Innovation #2) ---
        # Identical architecture to self.model, but weights are only copied
        # over every `target_update_freq` steps — not every step.
        # This gives the TD target a stable "ground truth" to chase.
        self.target_model = self._build_model().to(self.device)
        self.target_model.load_state_dict(self.model.state_dict())
        self.target_model.eval()  # target never trains directly

        # --- Replay buffer (Innovation #1) ---
        # A fixed-size circular queue. Old experiences are automatically
        # dropped when it fills up (deque maxlen behaviour).
        self.memory     = deque(maxlen=config.get('memory_size', 10000))
        self.batch_size = config.get('batch_size', 64)

        # How many update() calls between target network syncs
        self.target_update_freq = config.get('target_update_freq', 100)

        # Counts every call to update() — used to trigger target sync
        self.steps_done = 0

    # ------------------------------------------------------------------
    # Required by BaseAlgorithm
    # ------------------------------------------------------------------

    def _build_model(self) -> nn.Module:
        return DQNNetwork(self.state_dim, self.action_dim)

    def select_action(
        self,
        state: np.ndarray,
        training: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Epsilon-greedy action selection.

        VIVA ANSWER for "what is epsilon-greedy?":
        With probability epsilon  → pick a RANDOM action (explore)
        With probability 1-epsilon → pick argmax Q(s,a) (exploit)
        Epsilon starts at 1.0 (fully random) and decays toward epsilon_min
        so the agent gradually shifts from exploring to exploiting.
        """
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)

        with torch.no_grad():
            q_values = self.model(state_t)

        q_values_list = q_values.cpu().numpy().flatten().tolist()

        if training and random.random() < self.epsilon:
            action    = random.randint(0, self.action_dim - 1)
            reasoning = f"Exploring randomly (ε={self.epsilon:.3f})"
        else:
            action    = int(q_values.argmax().item())
            reasoning = (
                f"Exploiting: action {action} has highest "
                f"Q-value ({q_values_list[action]:.4f})"
            )

        return action, {
            'q_values':  q_values_list,
            'epsilon':   self.epsilon,
            'reasoning': reasoning,
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
        Store one (s, a, r, s', done) transition in the replay buffer.

        WHY WE DON'T LEARN HERE (viva answer):
        If we updated the network on every single transition, consecutive
        transitions are highly correlated (the ball is in roughly the same
        place two frames in a row). Learning on correlated data causes the
        network to overfit to recent experience and forget earlier lessons —
        a problem called 'catastrophic forgetting'.

        Instead we store everything here and in update() we sample a
        RANDOM mini-batch, which breaks the correlations.
        """
        self.memory.append((state, action, reward, next_state, done))

    def update(self) -> Dict[str, float]:
        """
        Sample a random mini-batch from the replay buffer and do one
        gradient descent step using the DQN (Bellman) loss.

        THE BELLMAN EQUATION (examiner will ask):
            Q(s,a) ← r + γ · max_a' Q_target(s', a')   if not done
            Q(s,a) ← r                                   if done

        We minimise MSE between the network's current Q(s,a) prediction
        and this Bellman target. Over many updates the network converges
        to the true action-value function.
        """
        # Don't update until we have at least one full batch to sample from
        if len(self.memory) < self.batch_size:
            return {'loss': 0.0}

        # --- Sample random mini-batch ---
        batch                                        = random.sample(self.memory, self.batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)

        # Convert to tensors — all on the same device as the model
        states_t      = torch.FloatTensor(np.array(states)).to(self.device)
        actions_t     = torch.LongTensor(np.array(actions)).unsqueeze(1).to(self.device)
        rewards_t     = torch.FloatTensor(np.array(rewards)).to(self.device)
        next_states_t = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones_t       = torch.FloatTensor(np.array(dones)).to(self.device)

        # --- Current Q-values: Q(s, a) for the actions actually taken ---
        # .gather(1, actions_t) picks the Q-value for the chosen action only
        current_q = self.model(states_t).gather(1, actions_t).squeeze(1)

        # --- Bellman target (computed with frozen target network) ---
        with torch.no_grad():
            # max Q-value over all actions in next state
            next_q_max = self.target_model(next_states_t).max(1)[0]

            # If done=True the episode ended — there is no "next state",
            # so the target is just the immediate reward.
            target_q = rewards_t + (1.0 - dones_t) * self.gamma * next_q_max

        # --- Loss and backprop ---
        loss = nn.MSELoss()(current_q, target_q)

        self.optimizer.zero_grad()
        loss.backward()

        # Gradient clipping: prevents exploding gradients in early training.
        # Without this, a single bad batch can send weights to ±infinity.
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

        self.optimizer.step()

        # --- Bookkeeping ---
        self.steps_done  += 1
        self.training_step += 1  # inherited from BaseAlgorithm

        # Sync target network every N steps
        if self.steps_done % self.target_update_freq == 0:
            self.target_model.load_state_dict(self.model.state_dict())

        return {
            'loss':        loss.item(),
            'epsilon':     self.epsilon,
            'buffer_size': len(self.memory),
            'avg_q':       float(current_q.mean().item()),
        }