import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class BalloonPopEnvironment(BaseEnvironment):
    """
    Balloon Pop: Pop balloons by clicking/aiming correctly.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.width = 100
        self.height = 100
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.player_angle = 0.0 # 0 to 180 degrees
        self.balloons = [] # list of [x, y, radius]
        self._spawn_balloon()
        self.steps = 0
        self.score = 0
        return self._get_observation()

    def _spawn_balloon(self):
        self.balloons.append([random.randint(10, 90), random.randint(10, 50), 5])

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action: 0: Angle Left, 1: Angle Right, 2: Shoot
        if action == 0: self.player_angle = max(0, self.player_angle - 5)
        elif action == 1: self.player_angle = min(180, self.player_angle + 5)
        
        reward = 0.0
        done = False
        
        if action == 2:
            # Check for hit
            # Simple raycasting or proximity
            hit = False
            rad = np.radians(self.player_angle)
            for i, b in enumerate(self.balloons):
                # Balloon center [bx, by]
                # Ray from [50, 100] with angle rad
                # Dist point to line? Simplified:
                dist_to_line = abs((b[0] - 50) * np.sin(rad) - (100 - b[1]) * np.cos(rad))
                if dist_to_line < b[2]:
                    self.balloons.pop(i)
                    reward = 10.0
                    self.score += 1
                    hit = True
                    break
            if not hit:
                reward = -1.0
            
            if len(self.balloons) < 3:
                self._spawn_balloon()
                
        self.steps += 1
        if self.steps > 100: done = True
            
        return self._get_observation(), reward, done, {"score": self.score}

    def render(self) -> Dict[str, Any]:
        return {
            "player_angle": self.player_angle,
            "balloons": self.balloons,
            "score": self.score
        }

    def _get_observation(self) -> np.ndarray:
        obs = [self.player_angle / 180.0]
        if self.balloons:
            obs.extend([self.balloons[0][0] / self.width, self.balloons[0][1] / self.height])
        else:
            obs.extend([0.0, 0.0])
        return np.array(obs, dtype=np.float32)

    def _get_state_space(self) -> int:
        return 3

    def _get_action_space(self) -> int:
        return 3 # Left, Right, Shoot
