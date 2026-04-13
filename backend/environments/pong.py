import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class PongEnvironment(BaseEnvironment):
    """
    Simulated 1D Pong environment.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.height = 100
        self.width = 160
        self.paddle_height = 20
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.paddle_y = self.height // 2
        self.ball_x = self.width // 2
        self.ball_y = self.height // 2
        self.ball_dx = 2 * (1 if random.random() > 0.5 else -1)
        self.ball_dy = 2 * (1 if random.random() > 0.5 else -1)
        self.steps = 0
        self.score = 0
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Stay, 1: Up, 2: Down
        if action == 1: self.paddle_y = max(0, self.paddle_y - 4)
        elif action == 2: self.paddle_y = min(self.height - self.paddle_height, self.paddle_y + 4)
        
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy
        
        # Wall bounce
        if self.ball_y <= 0 or self.ball_y >= self.height:
            self.ball_dy *= -1
            
        reward = 0.0
        done = False
        
        # Paddle bounce
        if self.ball_x <= 5: # Paddle side
            if self.paddle_y <= self.ball_y <= self.paddle_y + self.paddle_height:
                self.ball_dx *= -1
                reward = 1.0
            else:
                reward = -5.0
                done = True
        elif self.ball_x >= self.width: # Opponent side (teleport)
            self.ball_dx *= -1
            
        self.steps += 1
        return self._get_observation(), reward, done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        return {
            "paddle_y": self.paddle_y,
            "ball_x": self.ball_x,
            "ball_y": self.ball_y,
            "width": self.width,
            "height": self.height
        }

    def _get_observation(self) -> np.ndarray:
        return np.array([
            self.paddle_y / self.height,
            self.ball_x / self.width,
            self.ball_y / self.height,
            self.ball_dx / 5.0,
            self.ball_dy / 5.0
        ], dtype=np.float32)

    def _get_state_space(self) -> int:
        return 5

    def _get_action_space(self) -> int:
        return 3 # Stay, Up, Down
