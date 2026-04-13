# backend/rl_engine/base.py

import torch
import torch.nn as nn
from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any, Optional
import numpy as np


class BaseAlgorithm(ABC):
    """
    Abstract Base Class for all Reinforcement Learning Algorithms.

    WHAT THIS DOES (for your viva):
    This class is a "contract". Any algorithm that inherits from it (DQN, PPO,
    Q-Learning, etc.) is FORCED to implement the abstract methods below.
    This guarantees the rest of the system can always call the same methods
    regardless of which algorithm is running underneath — a pattern called
    the "Template Method" design pattern.
    """

    def __init__(self, state_dim: int, action_dim: int, config: Dict[str, Any]):
        """
        Args:
            state_dim:  Size of the observation/state vector from the game.
            action_dim: Number of discrete actions the agent can take.
            config:     Hyperparameter dictionary (learning rate, gamma, etc.)
        """
        self.state_dim = state_dim
        self.action_dim = action_dim

        # --- Hyperparameters (examiner may ask about each of these) ---
        # learning_rate: How big a step the optimizer takes each update.
        self.lr = config.get('learning_rate', 0.001)

        # gamma (discount factor): How much the agent values FUTURE rewards vs
        # immediate ones. 0.99 means future rewards are nearly as valuable.
        self.gamma = config.get('discount_factor', 0.99)

        # epsilon (exploration rate): Probability of taking a RANDOM action
        # instead of the best-known action. Starts high (explore) and decays
        # over time (exploit). This is the epsilon-greedy strategy.
        self.epsilon = config.get('exploration_rate', 1.0)
        self.epsilon_min = config.get('epsilon_min', 0.01)
        self.epsilon_decay = config.get('epsilon_decay', 0.995)

        # --- Training state tracking ---
        self.training_step = 0   # total number of times update() has been called
        self.episode_count = 0   # total number of completed episodes

        # --- Device setup (use GPU if available, otherwise CPU) ---
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Build the neural network and move it to the right device
        self.model = self._build_model().to(self.device)

        # Adam optimizer: adaptive learning rate, works well for most RL tasks
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)

    # ------------------------------------------------------------------
    # ABSTRACT METHODS — every subclass MUST implement these
    # ------------------------------------------------------------------

    @abstractmethod
    def _build_model(self) -> nn.Module:
        """
        Constructs and returns the neural network for this algorithm.
        Called once during __init__. Each algorithm defines its own
        architecture (e.g. DQN uses a Q-network, PPO uses actor + critic).
        """
        pass

    @abstractmethod
    def select_action(
        self,
        state: np.ndarray,
        training: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Given the current game state, choose an action to take.

        Args:
            state:    The current observation from the game environment.
            training: If True, apply exploration (epsilon-greedy or stochastic
                      policy). If False (evaluation/arena mode), act greedily.

        Returns:
            action  (int):  Index of the chosen action.
            metrics (dict): Interpretability data for the live dashboard.
                            Should include at minimum:
                            - 'q_values' or 'action_probs': what the model
                              thinks about each possible action
                            - 'epsilon': current exploration rate (if applicable)
                            - 'reasoning': a short human-readable string
        """
        pass

    @abstractmethod
    def record_step(
        self,
        state: np.ndarray,
        action: int,
        reward: float,
        next_state: np.ndarray,
        done: bool
    ) -> None:
        """
        THE STANDARD DATA HANDSHAKE — This is the fix for Step 1.

        Every time the game environment produces a (state, action, reward,
        next_state, done) tuple, it calls THIS method. Each algorithm then
        stores this experience in whatever internal structure it needs:
          - DQN          → appends to a replay buffer (random sampling later)
          - PPO / A2C    → appends to a rollout buffer (processed in order)
          - Q-Learning   → can update the Q-table immediately

        WHY THIS MATTERS (viva answer):
        Before this fix, there was no standard interface. The game loop had
        to know WHICH algorithm was running to call the right storage method.
        Now the game loop always calls record_step() — it doesn't care what
        algorithm is underneath. This is the "Dependency Inversion" principle.

        Args:
            state:      Observation BEFORE the action was taken.
            action:     The action index that was chosen.
            reward:     The scalar reward signal from the environment.
            next_state: Observation AFTER the action was taken.
            done:       True if this action ended the episode (game over).
        """
        pass

    @abstractmethod
    def update(self) -> Dict[str, float]:
        """
        Perform one learning update using stored experience.

        The algorithm reads from its internal buffer (filled by record_step),
        computes a loss, and runs backpropagation to improve the model.

        Returns:
            A dict of training metrics for the live dashboard, e.g.:
            {
                'loss':    0.042,
                'epsilon': 0.87,
                'avg_q':   3.21   # optional but good for explainability
            }
            Return an empty dict {} if there is not yet enough data to update
            (e.g., replay buffer is not yet full enough for a batch).
        """
        pass

    # ------------------------------------------------------------------
    # CONCRETE METHODS — shared by all algorithms, no need to override
    # ------------------------------------------------------------------

    def decay_epsilon(self) -> float:
        """
        Applies epsilon decay after each episode.
        Call this at the END of every episode in your training loop.

        Returns the new epsilon value (useful for logging).
        """
        if self.epsilon > self.epsilon_min:
            self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        return self.epsilon

    def get_stats(self) -> Dict[str, Any]:
        """
        Returns a snapshot of the agent's current training state.
        Used by the Stats page and the live dashboard overlay.
        """
        return {
            'training_step': self.training_step,
            'episode_count': self.episode_count,
            'epsilon':       round(self.epsilon, 4),
            'device':        str(self.device),
            'model_params':  sum(p.numel() for p in self.model.parameters()),
        }

    def save(self, filepath: str) -> None:
        """
        Saves the model weights to a .pt file.
        Also saves training state so training can be resumed later.
        """
        torch.save({
            'model_state_dict':     self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'epsilon':              self.epsilon,
            'training_step':        self.training_step,
            'episode_count':        self.episode_count,
        }, filepath)

    def load(self, filepath: str) -> None:
        """
        Loads model weights from a .pt file.
        Restores training state so the agent remembers where it left off.
        """
        checkpoint = torch.load(filepath, map_location=self.device)

        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])

        # Restore training state (so the agent doesn't reset epsilon to 1.0)
        self.epsilon        = checkpoint.get('epsilon',       self.epsilon)
        self.training_step  = checkpoint.get('training_step', 0)
        self.episode_count  = checkpoint.get('episode_count', 0)

        # Set to eval mode — turns off dropout/batch norm during inference
        self.model.eval()