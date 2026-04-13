import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class TreasureHuntEnvironment(BaseEnvironment):
    """
    Grid Treasure Hunt: Find the treasure while avoiding traps.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.size = 5
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.player_pos = [0, 0]
        self.treasure_pos = [self.size - 1, self.size - 1]
        self.traps = []
        while len(self.traps) < 3:
            trap = [random.randint(0, self.size - 1), random.randint(0, self.size - 1)]
            if trap != self.player_pos and trap != self.treasure_pos and trap not in self.traps:
                self.traps.append(trap)
        self.steps = 0
        self.score = 0
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Up, 1: Down, 2: Left, 3: Right
        if action == 0: self.player_pos[1] = max(0, self.player_pos[1] - 1)
        elif action == 1: self.player_pos[1] = min(self.size - 1, self.player_pos[1] + 1)
        elif action == 2: self.player_pos[0] = max(0, self.player_pos[0] - 1)
        elif action == 3: self.player_pos[0] = min(self.size - 1, self.player_pos[0] + 1)
        
        reward = -0.1 # Step penalty
        done = False
        
        if self.player_pos == self.treasure_pos:
            reward = 10.0
            done = True
            self.score = 1
        elif self.player_pos in self.traps:
            reward = -5.0
            done = True
            
        self.steps += 1
        if self.steps > 50: done = True
            
        return self._get_observation(), reward, done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        board = np.zeros((self.size, self.size), dtype=int)
        for trap in self.traps: board[trap[1], trap[0]] = -1
        board[self.treasure_pos[1], self.treasure_pos[0]] = 2
        board[self.player_pos[1], self.player_pos[0]] = 1
        return {
            "board": board.tolist(),
            "player": self.player_pos,
            "treasure": self.treasure_pos,
            "traps": self.traps
        }

    def _get_observation(self) -> np.ndarray:
        return np.array([
            self.player_pos[0] / self.size,
            self.player_pos[1] / self.size,
            self.treasure_pos[0] / self.size,
            self.treasure_pos[1] / self.size
        ], dtype=np.float32)

    def _get_state_space(self) -> int:
        return 4

    def _get_action_space(self) -> int:
        return 4 # Up, Down, Left, Right
