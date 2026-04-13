# backend/rl_engine/ppo.py

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Tuple, Dict, Any
from .base import BaseAlgorithm


class ActorCritic(nn.Module):
    """
    A shared-backbone neural network with two output heads.

    WHAT THIS IS (for your viva):
    PPO is an Actor-Critic algorithm, meaning it maintains two functions:

    ACTOR  → the POLICY π(a|s): given state s, outputs a probability
             distribution over actions. The agent samples from this to act.

    CRITIC → the VALUE FUNCTION V(s): given state s, outputs a single
             number estimating "how good is it to be in this state?"
             This is used to compute the ADVANTAGE (see PPOAlgorithm.update).

    WHY SHARE WEIGHTS:
    The first layer (self.affine) learns a shared representation of the
    state that is useful for both heads. This is more parameter-efficient
    than two completely separate networks and is standard practice.
    """

    def __init__(self, state_dim: int, action_dim: int):
        super(ActorCritic, self).__init__()

        # Shared feature extractor
        self.affine      = nn.Linear(state_dim, 128)

        # Actor head: outputs raw logits → softmax → action probabilities
        self.action_head = nn.Linear(128, action_dim)

        # Critic head: outputs a single scalar state-value estimate V(s)
        self.value_head  = nn.Linear(128, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        x = F.relu(self.affine(x))

        # Actor: probability distribution over actions
        action_probs = F.softmax(self.action_head(x), dim=-1)

        # Critic: scalar value estimate
        state_values = self.value_head(x)

        return action_probs, state_values


class PPOAlgorithm(BaseAlgorithm):
    """
    Proximal Policy Optimization (PPO) — Schulman et al., 2017 (OpenAI).

    HOW PPO DIFFERS FROM DQN (examiner will ask this):

    DQN is VALUE-BASED: it learns Q(s,a) and derives a deterministic policy
    (always pick argmax Q). Works well for discrete actions.

    PPO is POLICY-BASED: it directly learns a stochastic policy π(a|s).
    The agent outputs action probabilities and SAMPLES from them. This
    means it can naturally handle uncertainty and exploration without
    needing a separate epsilon parameter.

    THE CORE PROBLEM PPO SOLVES:
    Naive policy gradient methods (REINFORCE) update the policy by
    following the gradient of expected reward. But if you take too large
    a step, the new policy can be so different from the old one that
    performance collapses catastrophically — and you can't recover.

    PPO's CLIPPING FIX:
    It measures how much the new policy π_new differs from the old policy
    π_old via the probability ratio r(t) = π_new(a|s) / π_old(a|s).
    It then CLIPS r(t) to stay within [1-ε, 1+ε] (typically [0.8, 1.2]).
    This prevents any single update from changing the policy too much —
    a "trust region" enforced by a simple clamp operation.

    DATA FLOW (the bug we fixed):
      select_action() → stores states, actions, log_probs
      record_step()   → stores rewards, done flags   ← THIS WAS MISSING
      update()        → reads all five buffers, runs K_epochs of gradient steps
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        super().__init__(state_dim, action_dim, config)

        # "Old policy" network — a frozen snapshot used to compute the
        # probability ratio r(t). Synced with self.model after each update.
        self.policy_old = ActorCritic(state_dim, action_dim).to(self.device)
        self.policy_old.load_state_dict(self.model.state_dict())
        self.policy_old.eval()  # never trained directly

        # Number of gradient update passes over the collected rollout.
        # PPO reuses each batch of experience K times before discarding it.
        # DQN keeps experiences forever in a replay buffer — PPO does not.
        self.K_epochs = config.get('ppo_epochs', 4)

        # Clipping parameter ε. Ratio r(t) is clamped to [1-ε, 1+ε].
        # Larger ε = more aggressive updates (riskier).
        # Smaller ε = more conservative updates (slower learning).
        self.eps_clip = config.get('eps_clip', 0.2)

        self.M_step = 0  # counts update() calls

        # --- Rollout buffer ---
        # PPO is ON-POLICY: it must learn from experience collected under
        # the CURRENT policy, then discard it. These five lists together
        # form one complete "rollout" (a set of episodes before an update).
        self.buffer_states      = []  # filled by select_action()
        self.buffer_actions     = []  # filled by select_action()
        self.buffer_logprobs    = []  # filled by select_action()
        self.buffer_rewards     = []  # filled by record_step()  ← the fix
        self.buffer_is_terminals = [] # filled by record_step()  ← the fix

    # ------------------------------------------------------------------
    # Required by BaseAlgorithm
    # ------------------------------------------------------------------

    def _build_model(self) -> nn.Module:
        return ActorCritic(self.state_dim, self.action_dim)

    def select_action(
        self,
        state:    np.ndarray,
        training: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Sample an action from the current policy distribution.

        WHY STOCHASTIC (viva answer):
        DQN always picks argmax Q — a deterministic policy. PPO samples
        from a probability distribution. This means the agent naturally
        explores without needing epsilon-greedy: low-probability actions
        are still chosen occasionally, maintaining exploration throughout
        training rather than just at the start.

        Note: states, actions, and log_probs are stored here.
        Rewards and done flags are stored in record_step() — they only
        exist AFTER the environment has processed the action.
        """
        state_t = torch.FloatTensor(state).to(self.device)

        with torch.no_grad():
            action_probs, _ = self.policy_old(state_t)

        dist   = torch.distributions.Categorical(action_probs)
        action = dist.sample()

        # Store the experience fragments we have RIGHT NOW
        # (reward and done come later, via record_step)
        if training:
            self.buffer_states.append(state_t)
            self.buffer_actions.append(action)
            self.buffer_logprobs.append(dist.log_prob(action))

        probs_list = action_probs.cpu().numpy().tolist()

        return action.item(), {
            'action_probs': probs_list,
            'confidence':   float(action_probs.max().item()),
            'entropy':      float(dist.entropy().item()),  # high = more uncertain
            'reasoning': (
                f"Stochastic policy: sampled action {action.item()} "
                f"with probability {probs_list[action.item()]*100:.1f}%"
            ),
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
        Store the reward and terminal flag from the environment.

        THE BUG THIS FIXES (explain this in your viva):
        In the old code, record_step() didn't exist in PPO at all.
        The manager called `hasattr(algo, 'store_transition')` — which
        returned False for PPO — so it silently skipped storing rewards.

        PPO's update() computes discounted returns by reading
        buffer_rewards and buffer_is_terminals. With those lists always
        empty, the "Monte Carlo return" was always zero. The agent saw
        every action as equally worthless and never learned anything.
        It was indistinguishable from a random agent.

        Note: state, action, next_state are intentionally ignored here.
        select_action() already stored state and action in the rollout
        buffer at decision time. PPO does not need next_state because it
        computes returns via Monte Carlo (full episode rollouts), not via
        bootstrapping from V(s') like DQN does.
        """
        self.buffer_rewards.append(float(reward))
        self.buffer_is_terminals.append(bool(done))

    def update(self) -> Dict[str, float]:
        """
        Run K epochs of the PPO clipped surrogate objective.

        THE THREE LOSS TERMS (examiner will ask):

        1. POLICY LOSS (actor):
           -min( r(t)·A(t),  clip(r(t), 1-ε, 1+ε)·A(t) )
           r(t) = π_new / π_old  — how much the policy changed.
           A(t) = advantage — was this action better or worse than average?
           The clip prevents r(t) from going outside [0.8, 1.2], stopping
           destructively large policy updates.

        2. VALUE LOSS (critic):
           MSE( V(s), discounted_return )
           Trains the critic to predict actual returns accurately.
           Weighted by 0.5 to balance with the policy loss scale.

        3. ENTROPY BONUS:
           -0.01 · H(π)   where H = -Σ p·log(p)
           Encourages the policy to stay somewhat random (high entropy).
           Without this the policy collapses to always picking one action
           early in training before it has explored enough.
        """
        if not self.buffer_rewards:
            return {'loss': 0.0}

        # --- Step 1: Compute Monte Carlo discounted returns ---
        # Walk backwards through the episode, accumulating discounted reward.
        # This is the "ground truth" return G_t = r_t + γr_{t+1} + γ²r_{t+2}…
        returns          = []
        discounted_return = 0.0

        for reward, is_terminal in zip(
            reversed(self.buffer_rewards),
            reversed(self.buffer_is_terminals)
        ):
            if is_terminal:
                discounted_return = 0.0   # reset at episode boundaries
            discounted_return = reward + self.gamma * discounted_return
            returns.insert(0, discounted_return)

        # Normalise returns to zero mean, unit variance.
        # This stabilises training by keeping gradient magnitudes consistent
        # regardless of the reward scale of the game.
        returns_t = torch.tensor(returns, dtype=torch.float32).to(self.device)
        returns_t = (returns_t - returns_t.mean()) / (returns_t.std() + 1e-7)

        # --- Step 2: Stack rollout buffer into tensors ---
        old_states   = torch.stack(self.buffer_states).detach().to(self.device)
        old_actions  = torch.stack(self.buffer_actions).detach().to(self.device)
        old_logprobs = torch.stack(self.buffer_logprobs).detach().to(self.device)

        # --- Step 3: K epochs of gradient updates on the SAME rollout ---
        # (DQN uses each experience once; PPO reuses it K times before
        #  discarding — more data-efficient, but only safe because of clipping)
        total_loss    = 0.0
        total_pg_loss = 0.0   # policy gradient component
        total_vf_loss = 0.0   # value function component

        for _ in range(self.K_epochs):
            # Evaluate current policy on the old states
            action_probs, state_values = self.model(old_states)
            dist       = torch.distributions.Categorical(action_probs)
            logprobs   = dist.log_prob(old_actions)
            entropy    = dist.entropy()
            state_values = state_values.squeeze()

            # Probability ratio r(t) = π_new(a|s) / π_old(a|s)
            # Computed in log space for numerical stability:
            # log(π_new/π_old) = log π_new − log π_old  →  exp(·) = ratio
            ratios = torch.exp(logprobs - old_logprobs)

            # Advantage A(t): how much better was this action than the
            # critic's baseline prediction? Positive = above average.
            advantages = returns_t - state_values.detach()

            # Clipped surrogate objective (the PPO innovation)
            surr1 = ratios * advantages
            surr2 = torch.clamp(ratios, 1.0 - self.eps_clip, 1.0 + self.eps_clip) * advantages
            pg_loss = -torch.min(surr1, surr2).mean()

            # Value function loss (critic)
            vf_loss = 0.5 * nn.MSELoss()(state_values, returns_t)

            # Entropy bonus (discourages premature convergence)
            entropy_bonus = 0.01 * entropy.mean()

            # Combined loss
            loss = pg_loss + vf_loss - entropy_bonus

            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=0.5)
            self.optimizer.step()

            total_loss    += loss.item()
            total_pg_loss += pg_loss.item()
            total_vf_loss += vf_loss.item()

        # Sync old policy with updated policy for next rollout
        self.policy_old.load_state_dict(self.model.state_dict())

        self.M_step        += 1
        self.training_step += 1   # inherited from BaseAlgorithm

        self._clear_buffer()

        return {
            'loss':    total_loss    / self.K_epochs,
            'pg_loss': total_pg_loss / self.K_epochs,  # policy gradient loss
            'vf_loss': total_vf_loss / self.K_epochs,  # value function loss
            'epsilon': self.epsilon,                    # for dashboard parity
            'buffer_size': 0,                           # buffer cleared after update
        }

    def _clear_buffer(self) -> None:
        """
        Discard the rollout buffer after each update.

        WHY PPO DISCARDS EXPERIENCE (viva answer):
        PPO is ON-POLICY: the clipped objective is only mathematically
        valid when π_old is close to π_new. Once you've updated the policy,
        old experience was collected under a different policy — reusing it
        would violate the trust-region assumption and destabilise training.
        DQN can reuse old experience (off-policy) because Q-learning is
        valid for any behaviour policy.
        """
        del self.buffer_states[:]
        del self.buffer_actions[:]
        del self.buffer_logprobs[:]
        del self.buffer_rewards[:]
        del self.buffer_is_terminals[:]