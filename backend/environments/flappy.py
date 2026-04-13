import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class FlappyEnvironment(BaseEnvironment):
    """
    Simplified Flappy Bird environment.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.height = 512
        self.width = 288
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.bird_y = self.height // 2
        self.bird_vel = 0
        self.pipe_x = self.width
        self.pipe_gap_y = random.randint(100, 400)
        self.score = 0
        self.done = False
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Nothing, 1: Flap
        if action == 1:
            self.bird_vel = -8
            
        self.bird_vel += 1 # Gravity
        self.bird_y += self.bird_vel
        self.pipe_x -= 4
        
        if self.pipe_x < -50:
            self.pipe_x = self.width
            self.pipe_gap_y = random.randint(100, 400)
            self.score += 1
            reward = 5.0
        else:
            reward = 0.1 # Survival reward
            
        # Collision
        if (self.bird_y <= 0 or self.bird_y >= self.height or
            (self.pipe_x < 50 and (self.bird_y < self.pipe_gap_y - 50 or self.bird_y > self.pipe_gap_y + 50))):
            self.done = True
            reward = -5.0
            
        return self._get_observation(), reward, self.done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        return {
            "bird_y": self.bird_y,
            "pipe_x": self.pipe_x,
            "pipe_gap_y": self.pipe_gap_y,
            "score": self.score
        }

    def _get_observation(self) -> np.ndarray:
        return np.array([
            self.bird_y / self.height,
            self.bird_vel / 10.0,
            self.pipe_x / self.width,
            (self.bird_y - self.pipe_gap_y) / self.height
        ], dtype=np.float32)

    def _get_state_space(self) -> int:
        return 4

    def _get_action_space(self) -> int:
        return 2 # Nothing, Flap
