import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class BreakoutEnvironment(BaseEnvironment):
    """
    Breakout game: Destroy bricks with a ball and paddle.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.width = 160
        self.height = 100
        self.paddle_width = 30
        self.brick_rows = 3
        self.brick_cols = 8
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.paddle_x = (self.width - self.paddle_width) // 2
        self.ball_x = self.width // 2
        self.ball_y = self.height // 2
        self.ball_dx = 2 * (1 if random.random() > 0.5 else -1)
        self.ball_dy = -2
        self.bricks = np.ones((self.brick_rows, self.brick_cols), dtype=int)
        self.steps = 0
        self.score = 0
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Stay, 1: Left, 2: Right
        if action == 1: self.paddle_x = max(0, self.paddle_x - 5)
        elif action == 2: self.paddle_x = min(self.width - self.paddle_width, self.paddle_x + 5)
        
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy
        
        # Wall bounce
        if self.ball_x <= 0 or self.ball_x >= self.width:
            self.ball_dx *= -1
        if self.ball_y <= 0:
            self.ball_dy *= -1
            
        reward = 0.0
        done = False
        
        # Paddle bounce
        if self.ball_y >= self.height - 5:
            if self.paddle_x <= self.ball_x <= self.paddle_x + self.paddle_width:
                self.ball_dy *= -1
                reward = 0.5
            else:
                reward = -5.0
                done = True
        
        # Brick collision
        brick_h = 10
        brick_w = self.width // self.brick_cols
        if self.ball_y < self.brick_rows * brick_h:
            r = int(self.ball_y // brick_h)
            c = int(self.ball_x // brick_w)
            if 0 <= r < self.brick_rows and 0 <= c < self.brick_cols:
                if self.bricks[r, c] == 1:
                    self.bricks[r, c] = 0
                    self.ball_dy *= -1
                    reward = 2.0
                    self.score += 1
                    
        if np.all(self.bricks == 0):
            reward += 10.0
            done = True
            
        self.steps += 1
        if self.steps > 500: done = True
            
        return self._get_observation(), reward, done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        return {
            "paddle_x": self.paddle_x,
            "ball_x": self.ball_x,
            "ball_y": self.ball_y,
            "bricks": self.bricks.tolist(),
            "score": self.score
        }

    def _get_observation(self) -> np.ndarray:
        return np.array([
            self.paddle_x / self.width,
            self.ball_x / self.width,
            self.ball_y / self.height,
            self.ball_dx / 5.0,
            self.ball_dy / 5.0,
            np.mean(self.bricks)
        ], dtype=np.float32)

    def _get_state_space(self) -> int:
        return 6

    def _get_action_space(self) -> int:
        return 3 # Stay, Left, Right
