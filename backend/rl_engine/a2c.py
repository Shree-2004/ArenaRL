# backend/rl_engine/a2c.py

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Tuple, Dict, Any
from .base import BaseAlgorithm


class ActorCriticNetwork(nn.Module):
    """
    Shared-backbone Actor-Critic network for A2C.

    ARCHITECTURE (for your viva):
    The network has one shared trunk and two separate output heads.

        Input (state)
             ↓
        [Linear 128] → ReLU          ← shared feature extractor
             ↓
        ┌────────────────────┐
        ↓                    ↓
    [Actor head]        [Critic head]
    action_dim outputs   1 output
    → softmax → π(a|s)   → V(s)

    WHY SHARE WEIGHTS:
    The first layer learns a representation of the state that is useful
    for BOTH deciding what to do (actor) AND evaluating how good the
    situation is (critic). Sharing it reduces parameters and means both
    heads benefit from each other's gradient signal during backprop.

    HOW A2C DIFFERS FROM PPO's ActorCritic:
    The architecture is nearly identical. The difference is entirely in
    how the loss is computed and applied — A2C has no clipping, no old
    policy network, and no K-epoch reuse of data. One rollout → one update.
    """

    def __init__(self, state_dim: int, action_dim: int):
        super(ActorCriticNetwork, self).__init__()

        # Shared feature extractor
        self.shared = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.ReLU()
        )

        # Actor head: outputs a probability distribution over actions
        self.actor_head  = nn.Linear(128, action_dim)

        # Critic head: outputs a single scalar V(s) — the state value
        self.critic_head = nn.Linear(128, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        features     = self.shared(x)
        action_probs = F.softmax(self.actor_head(features), dim=-1)
        state_value  = self.critic_head(features)
        return action_probs, state_value


class A2CAlgorithm(BaseAlgorithm):
    """
    Advantage Actor-Critic (A2C) — Mnih et al., 2016 (synchronous variant).

    HOW A2C DIFFERS FROM PPO (examiner will ask):

    Both are Actor-Critic algorithms that train a shared policy + value
    network. The key differences are:

    ┌──────────────────────┬──────────────────────┬──────────────────────┐
    │                      │ A2C                  │ PPO                  │
    ├──────────────────────┼──────────────────────┼──────────────────────┤
    │ Policy update        │ Direct gradient      │ Clipped surrogate    │
    │ Data reuse           │ One pass per rollout │ K epochs per rollout │
    │ Old policy network   │ No                   │ Yes (π_old)          │
    │ Update stability     │ Can be unstable      │ More stable          │
    │ Implementation       │ Simpler              │ More complex         │
    │ Sample efficiency    │ Lower                │ Higher               │
    └──────────────────────┴──────────────────────┴──────────────────────┘

    HOW A2C DIFFERS FROM Q-LEARNING/DQN (examiner will ask):

    DQN learns a value function Q(s,a) and derives a deterministic policy.
    A2C directly learns BOTH a policy π(a|s) AND a value function V(s)
    simultaneously. The value function (critic) serves as a baseline to
    reduce variance in the policy gradient — the "advantage" A(s,a) =
    Q(s,a) - V(s) tells us not just "was this good?" but "was this BETTER
    than what we normally expect in this state?"

    THE ADVANTAGE FUNCTION (key concept):
    Raw reward signals have high variance — the same action can yield
    very different rewards by chance. Instead of updating the policy based
    on raw return G_t, we use the ADVANTAGE:

        A(s_t, a_t) = r_t + γ·V(s_{t+1}) − V(s_t)
                      └─── TD target ───┘   └baseline┘

    If A > 0: this action was BETTER than average → increase its probability
    If A < 0: this action was WORSE  than average → decrease its probability

    Using V(s_t) as a baseline dramatically reduces gradient variance
    without introducing bias — a core theoretical result in RL.

    DATA FLOW:
        select_action(s_t)            → samples from π, stores log_prob
        record_step(s,a,r,s',done)    → stores reward, next_state, done
        update()                      → computes advantage, runs backprop,
                                        clears buffer
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        super().__init__(state_dim, action_dim, config)

        # --- Rollout buffer ---
        # A2C is ON-POLICY: collect a batch of experience under the current
        # policy, update once, then discard. These lists store one rollout.
        self.buffer_states      = []   # filled by select_action()
        self.buffer_actions     = []   # filled by select_action()
        self.buffer_log_probs   = []   # filled by select_action()
        self.buffer_rewards     = []   # filled by record_step()  ← the fix
        self.buffer_next_states = []   # filled by record_step()  ← the fix
        self.buffer_dones       = []   # filled by record_step()  ← the fix

        # Entropy coefficient — controls exploration pressure.
        # Higher = more random policy (explore), Lower = more confident (exploit).
        self.entropy_coef = config.get('entropy_coef', 0.01)

        # Value loss coefficient — balances actor vs critic loss scale.
        self.value_coef = config.get('value_coef', 0.5)

        # Minimum steps before we attempt an update
        self.min_buffer_size = config.get('min_buffer_size', 32)

    # ------------------------------------------------------------------
    # Required by BaseAlgorithm
    # ------------------------------------------------------------------

    def _build_model(self) -> nn.Module:
        """
        Returns the ActorCriticNetwork.
        Called by BaseAlgorithm.__init__ — self.model will hold this.
        """
        return ActorCriticNetwork(self.state_dim, self.action_dim)

    def select_action(
        self,
        state:    np.ndarray,
        training: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Sample an action from the actor's probability distribution.

        We store state, action, and log_prob here because we have them
        immediately at decision time. reward, next_state, and done are
        only available AFTER the environment processes the action —
        those arrive in record_step().

        WHY LOG_PROB (viva answer):
        The policy gradient theorem requires ∇ log π(a|s) · A(s,a).
        We store log π(a|s) now so update() can compute this gradient
        without needing to re-run the old policy (unlike PPO, which
        needs π_old for its ratio — A2C updates in the same forward pass).
        """
        state_t = torch.FloatTensor(state).to(self.device)

        with torch.no_grad():
            action_probs, _ = self.model(state_t)

        dist   = torch.distributions.Categorical(action_probs)
        action = dist.sample()

        if training:
            self.buffer_states.append(state_t)
            self.buffer_actions.append(action)
            self.buffer_log_probs.append(dist.log_prob(action))

        probs_list = action_probs.cpu().numpy().tolist()

        return action.item(), {
            'action_probs': probs_list,
            'confidence':   float(action_probs.max().item()),
            'entropy':      float(dist.entropy().item()),
            'reasoning': (
                f"A2C policy: sampled action {action.item()} "
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
        Store the environment's response to the last action.

        THE BUG THIS FIXES:
        The old A2C had update_step() which was never called by the manager
        (it looked for store_transition, not update_step). The rollout buffer
        for rewards, next_states, and dones was never populated. When update()
        ran, it had action log_probs stored in select_action() but no rewards
        to compute advantages from — the actor loss was always multiplied by
        zero advantage, meaning the policy never actually changed.

        We store next_state here (unlike PPO) because A2C bootstraps the
        value of the final state using V(s_{T+1}) rather than computing
        full Monte Carlo returns. This is "TD(0) Actor-Critic" — it only
        looks one step ahead for the value estimate.
        """
        self.buffer_rewards.append(float(reward))
        self.buffer_next_states.append(
            torch.FloatTensor(next_state).to(self.device)
        )
        self.buffer_dones.append(float(done))

    def update(self) -> Dict[str, float]:
        """
        Compute advantages and run one backprop pass over the rollout.

        THE THREE LOSS TERMS:

        1. ACTOR LOSS (policy gradient):
           L_actor = -log π(a_t|s_t) · A_t
           If A_t > 0 (action was better than baseline): increase log prob
           If A_t < 0 (action was worse than baseline):  decrease log prob
           The negative sign turns maximisation into minimisation for
           gradient descent.

        2. CRITIC LOSS (value function regression):
           L_critic = MSE( V(s_t),  r_t + γ·V(s_{t+1}) )
           Trains the critic to accurately predict the TD target.
           Accurate V(s) → better advantage estimates → better actor updates.

        3. ENTROPY BONUS:
           L_entropy = -H(π) = Σ π(a|s) · log π(a|s)
           Penalises low-entropy (overconfident) policies.
           Subtracting this from the total loss encourages exploration.

        COMBINED: L = L_actor + value_coef·L_critic - entropy_coef·H(π)
        """
        if len(self.buffer_rewards) < self.min_buffer_size:
            return {'loss': 0.0}

        # --- Re-evaluate all stored states with the CURRENT policy ---
        # (Unlike PPO, we don't need an "old policy" — we compute
        #  everything fresh in a single forward pass)
        states_t = torch.stack(self.buffer_states).to(self.device)

        action_probs_batch, state_values_batch = self.model(states_t)
        state_values_batch = state_values_batch.squeeze(1)

        dist_batch    = torch.distributions.Categorical(action_probs_batch)
        actions_t     = torch.stack(self.buffer_actions).to(self.device)
        log_probs_t   = dist_batch.log_prob(actions_t)
        entropy_t     = dist_batch.entropy()

        # --- Compute TD targets and advantages ---
        rewards_t     = torch.FloatTensor(self.buffer_rewards).to(self.device)
        dones_t       = torch.FloatTensor(self.buffer_dones).to(self.device)
        next_states_t = torch.stack(self.buffer_next_states).to(self.device)

        with torch.no_grad():
            # Bootstrap: V(s_{t+1}) from the critic
            _, next_values = self.model(next_states_t)
            next_values    = next_values.squeeze(1)

            # TD target: r_t + γ·V(s_{t+1})   (zero if terminal)
            td_targets  = rewards_t + self.gamma * next_values * (1.0 - dones_t)

            # Advantage: how much better was this action than the baseline?
            # Detached so critic gradient doesn't flow through advantage.
            advantages  = td_targets - state_values_batch.detach()

            # Normalise advantages for training stability
            # (keeps gradient magnitudes consistent across different games)
            if len(advantages) > 1:
                advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # --- Actor loss ---
        # Negative because we want to MAXIMISE expected return,
        # but optimizers MINIMISE loss
        actor_loss  = -(log_probs_t * advantages).mean()

        # --- Critic loss ---
        critic_loss = F.mse_loss(state_values_batch, td_targets)

        # --- Entropy bonus ---
        entropy_loss = entropy_t.mean()

        # --- Combined loss ---
        total_loss = (
            actor_loss
            + self.value_coef   * critic_loss
            - self.entropy_coef * entropy_loss
        )

        # --- Backprop ---
        self.optimizer.zero_grad()
        total_loss.backward()

        # Gradient clipping — A2C without clipping can have very large
        # gradients early in training, causing the policy to collapse
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=0.5)

        self.optimizer.step()

        self.training_step += 1   # inherited from BaseAlgorithm
        self._clear_buffer()

        return {
            'loss':         total_loss.item(),
            'actor_loss':   actor_loss.item(),
            'critic_loss':  critic_loss.item(),
            'entropy':      entropy_loss.item(),
            'advantage':    float(advantages.mean().item()),
            'epsilon':      self.epsilon,
        }

    def save(self, filepath: str) -> None:
        """
        Save model weights plus A2C-specific training state.
        Calls BaseAlgorithm.save() which handles the full checkpoint dict.
        """
        super().save(filepath)

    def load(self, filepath: str) -> None:
        """
        Load model weights and restore training state.
        Calls BaseAlgorithm.load() which restores epsilon, training_step etc.
        """
        super().load(filepath)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _clear_buffer(self) -> None:
        """
        Discard the rollout buffer after each update.

        WHY A2C DISCARDS EXPERIENCE (viva answer):
        A2C is ON-POLICY. The policy gradient update is only valid when
        the data was collected by the CURRENT policy. Once we've updated
        the network weights, all stored transitions are "stale" — they
        came from a slightly different policy that no longer exists.
        Reusing them would bias the gradient estimate.

        This is the same reason PPO discards its buffer, but PPO at least
        reuses data K times before discarding. A2C is stricter: exactly
        one gradient step per rollout, then throw it all away.
        """
        del self.buffer_states[:]
        del self.buffer_actions[:]
        del self.buffer_log_probs[:]
        del self.buffer_rewards[:]
        del self.buffer_next_states[:]
        del self.buffer_dones[:]