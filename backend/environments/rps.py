import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment


class RPSEnvironment(BaseEnvironment):
    """
    Rock-Paper-Scissors environment.
    Actions: 0=Rock, 1=Paper, 2=Scissors.
    State: last opponent move (one-hot, 3 values) + last own move (one-hot, 3 values) + round number (1 value).
    Opponent uses a frequency-based adaptive strategy (starts random).
    """
    ROUNDS = 10  # one 'episode' = ROUNDS rounds

    def __init__(self, config: Dict[str, Any] = None):
        self.opponent_history = [0, 0, 0]  # counts of R, P, S opponent played
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.round = 0
        self.last_opponent = -1
        self.last_own = -1
        self.score = 0
        return self._get_obs()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        action = int(action) % 3

        # Adaptive opponent: 70% follow frequency bias, 30% random
        if random.random() < 0.3 or sum(self.opponent_history) == 0:
            opp = random.randint(0, 2)
        else:
            # Pick what beats agent's most common move
            freq = self.opponent_history
            agent_likely = freq.index(max(freq))
            opp = (agent_likely + 1) % 3  # what beats it

        self.opponent_history[action] += 1
        self.last_opponent = opp
        self.last_own = action
        self.round += 1

        # Determine result
        if action == opp:
            reward = 0.0
            result = "draw"
        elif (action - opp) % 3 == 1:
            reward = 1.0
            result = "win"
            self.score += 1
        else:
            reward = -1.0
            result = "lose"

        done = self.round >= self.ROUNDS
        return self._get_obs(), reward, done, {"result": result, "round": self.round}

    def _get_obs(self) -> np.ndarray:
        obs = np.zeros(7, dtype=np.float32)
        if self.last_opponent >= 0:
            obs[self.last_opponent] = 1.0       # one-hot opponent last move
        if self.last_own >= 0:
            obs[3 + self.last_own] = 1.0        # one-hot own last move
        obs[6] = self.round / self.ROUNDS       # normalised round
        return obs

    def render(self) -> Dict[str, Any]:
        names = ["Rock", "Paper", "Scissors"]
        return {
            "round": self.round,
            "score": self.score,
            "last_agent": names[self.last_own] if self.last_own >= 0 else None,
            "last_opponent": names[self.last_opponent] if self.last_opponent >= 0 else None,
        }

    def _get_state_space(self) -> int:
        return 7

    def _get_action_space(self) -> int:
        return 3
