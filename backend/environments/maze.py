import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class MazeEnvironment(BaseEnvironment):
    """
    Simple 5x5 Maze environment for Q-Learning / Tabular methods.
    """
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.size = self.config.get('size', 5)
        self.grid = np.zeros((self.size, self.size))
        
        # 0: Empty, 1: Wall, 2: Goal, 3: Agent
        self.start_pos = (0, 0)
        self.goal_pos = (self.size - 1, self.size - 1)
        
        # Add some walls
        self.walls = self.config.get('walls', [(1, 1), (1, 2), (3, 1), (3, 3), (2, 3)])
        for wall in self.walls:
            self.grid[wall] = 1
            
        self.agent_pos = self.start_pos
        self.steps = 0
        self.max_steps = self.size * self.size * 2

    def reset(self) -> np.ndarray:
        self.agent_pos = self.start_pos
        self.steps = 0
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # 0: Up, 1: Right, 2: Down, 3: Left
        row, col = self.agent_pos
        
        if action == 0: row = max(0, row - 1)
        elif action == 1: col = min(self.size - 1, col + 1)
        elif action == 2: row = min(self.size - 1, row + 1)
        elif action == 3: col = max(0, col - 1)
        
        new_pos = (row, col)
        self.steps += 1
        
        # Check wall collision
        if self.grid[new_pos] == 1:
            reward = -1.0
            new_pos = self.agent_pos # Stay in place
        else:
            self.agent_pos = new_pos
            reward = -0.1 # Step penalty
            
        done = False
        if self.agent_pos == self.goal_pos:
            reward = 10.0
            done = True
        elif self.steps >= self.max_steps:
            done = True
            
        return self._get_observation(), reward, done, {"pos": self.agent_pos}

    def render(self) -> Dict[str, Any]:
        return {
            "grid": self.grid.tolist(),
            "agent_pos": self.agent_pos,
            "goal_pos": self.goal_pos,
            "size": self.size
        }

    def _get_observation(self) -> np.ndarray:
        # Simple coordinate-based observation
        return np.array([self.agent_pos[0], self.agent_pos[1]], dtype=np.float32)

    def _get_state_space(self) -> int:
        return 2 # (row, col)

    def _get_action_space(self) -> int:
        return 4 # Up, Right, Down, Left
