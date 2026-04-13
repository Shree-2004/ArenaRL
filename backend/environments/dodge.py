import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class DodgeEnvironment(BaseEnvironment):
    """
    Dodge game: Avoid falling obstacles.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.width = 10
        self.height = 10
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.player_x = self.width // 2
        self.obstacles = [] # list of [x, y]
        self.steps = 0
        self.score = 0
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Left, 1: Right, 2: Stay
        if action == 0: self.player_x = max(0, self.player_x - 1)
        elif action == 1: self.player_x = min(self.width - 1, self.player_x + 1)
        
        # Move obstacles down
        new_obstacles = []
        reward = 0.1 # Small reward for surviving
        done = False
        
        for ob in self.obstacles:
            ob[1] += 1
            if ob[1] == self.height - 1 and ob[0] == self.player_x:
                reward = -10.0
                done = True
            elif ob[1] < self.height:
                new_obstacles.append(ob)
            else:
                reward += 1.0 # Reward for dodging an obstacle
                self.score += 1
                
        self.obstacles = new_obstacles
        
        # Spawn new obstacle
        if self.steps % 2 == 0:
            self.obstacles.append([random.randint(0, self.width - 1), 0])
            
        self.steps += 1
        if self.steps > 200: # Timeout
            done = True
            
        return self._get_observation(), reward, done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        board = np.zeros((self.height, self.width), dtype=int)
        for ob in self.obstacles:
            if ob[1] < self.height:
                board[ob[1], ob[0]] = 2 # Obstacle
        board[self.height - 1, self.player_x] = 1 # Player
        return {
            "board": board.tolist(),
            "player_x": self.player_x,
            "obstacles": self.obstacles,
            "score": self.score
        }

    def _get_observation(self) -> np.ndarray:
        # Simple obs: player_x and the closest few obstacle positions
        obs = [self.player_x / self.width]
        # Pad with 0s if fewer than 3 obstacles
        sorted_obs = sorted(self.obstacles, key=lambda x: x[1], reverse=True)[:3]
        for ob in sorted_obs:
            obs.extend([ob[0] / self.width, ob[1] / self.height])
        while len(obs) < 7:
            obs.extend([0.0, 0.0])
        return np.array(obs, dtype=np.float32)

    def _get_state_space(self) -> int:
        return 7

    def _get_action_space(self) -> int:
        return 3 # Left, Right, Stay
