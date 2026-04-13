import numpy as np
import random
from typing import Tuple, Dict, Any, List
from .base import BaseEnvironment

class SnakeEnvironment(BaseEnvironment):
    """
    Snake environment for DQN/PPO training.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.width = self.config.get('width', 10)
        self.height = self.config.get('height', 10)
        super().__init__(self.config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.snake = [(self.height // 2, self.width // 2)]
        self.direction = 1 # 0: Up, 1: Right, 2: Down, 3: Left
        self.food = self._place_food()
        self.score = 0
        self.steps = 0
        self.done = False
        return self._get_observation()

    def _place_food(self) -> Tuple[int, int]:
        while True:
            food = (random.randint(0, self.height - 1), random.randint(0, self.width - 1))
            if food not in self.snake:
                return food

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Up, 1: Right, 2: Down, 3: Left
        self.direction = action
        head = self.snake[0]
        
        if self.direction == 0: new_head = (head[0] - 1, head[1])
        elif self.direction == 1: new_head = (head[0], head[1] + 1)
        elif self.direction == 2: new_head = (head[0] + 1, head[1])
        elif self.direction == 3: new_head = (head[0], head[1] - 1)
        
        # Check collision
        if (new_head[0] < 0 or new_head[0] >= self.height or 
            new_head[1] < 0 or new_head[1] >= self.width or 
            new_head in self.snake):
            self.done = True
            return self._get_observation(), -10.0, True, {"score": self.score}
            
        self.snake.insert(0, new_head)
        
        reward = 0.1 # Small reward for surviving
        if new_head == self.food:
            self.score += 1
            reward = 10.0
            self.food = self._place_food()
        else:
            self.snake.pop()
            
        self.steps += 1
        if self.steps > self.width * self.height * 2: # Timeout
            self.done = True
            
        return self._get_observation(), reward, self.done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        return {
            "snake": self.snake,
            "food": self.food,
            "score": self.score,
            "width": self.width,
            "height": self.height
        }

    def _get_observation(self) -> np.ndarray:
        # Simple grid-based observation
        obs = np.zeros((self.height, self.width), dtype=np.float32)
        for r, c in self.snake:
            obs[r, c] = 0.5
        obs[self.snake[0]] = 1.0 # Head
        obs[self.food] = -1.0 # Food
        return obs.flatten()

    def _get_state_space(self) -> int:
        return self.width * self.height

    def _get_action_space(self) -> int:
        return 4
