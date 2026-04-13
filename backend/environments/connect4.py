import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment

class Connect4Environment(BaseEnvironment):
    """
    Connect 4 environment.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.rows = 6
        self.cols = 7
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.board = np.zeros((self.rows, self.cols), dtype=int)
        self.current_player = 1
        self.done = False
        return self._get_observation()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        # Action is the column index (0-6)
        if self.board[0, action] != 0: # Invalid move
            return self._get_observation(), -10.0, True, {"invalid": True}
            
        # Place piece
        for r in range(self.rows-1, -1, -1):
            if self.board[r, action] == 0:
                self.board[r, action] = self.current_player
                break
                
        # Check win
        if self._check_win(self.current_player):
            reward = 10.0
            self.done = True
        elif np.all(self.board != 0): # Draw
            reward = 0.5
            self.done = True
        else:
            reward = 0.0
            self.current_player = 3 - self.current_player # Switch player
            # For RL training against random:
            if not self.done:
                self._random_move(self.current_player)
                if self._check_win(self.current_player):
                    reward = -10.0
                    self.done = True
                elif np.all(self.board != 0):
                    reward = 0.5
                    self.done = True
                self.current_player = 3 - self.current_player
                
        return self._get_observation(), reward, self.done, {}

    def _random_move(self, player):
        valid_cols = [c for c in range(self.cols) if self.board[0, c] == 0]
        if valid_cols:
            col = random.choice(valid_cols)
            for r in range(self.rows-1, -1, -1):
                if self.board[r, col] == 0:
                    self.board[r, col] = player
                    break

    def _check_win(self, player):
        # Horizontal
        for r in range(self.rows):
            for c in range(self.cols - 3):
                if np.all(self.board[r, c:c+4] == player): return True
        # Vertical
        for r in range(self.rows - 3):
            for c in range(self.cols):
                if np.all(self.board[r:r+4, c] == player): return True
        # Diagonal
        for r in range(self.rows - 3):
            for c in range(self.cols - 3):
                if all(self.board[r+i, c+i] == player for i in range(4)): return True
                if all(self.board[r+3-i, c+i] == player for i in range(4)): return True
        return False

    def render(self) -> Dict[str, Any]:
        return {
            "board": self.board.tolist(),
            "current_player": self.current_player
        }

    def _get_observation(self) -> np.ndarray:
        return self.board.flatten().astype(np.float32)

    def _get_state_space(self) -> int:
        return self.rows * self.cols

    def _get_action_space(self) -> int:
        return self.cols
