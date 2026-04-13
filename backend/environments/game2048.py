import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment


class Game2048Environment(BaseEnvironment):
    """
    2048 environment.
    Actions: 0=Up, 1=Right, 2=Down, 3=Left.
    State: 4x4 board, each cell is log2(tile) / 11 (normalised, max tile 2^11=2048).
    Reward: log2 of merged tile values per step.
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.board = np.zeros((4, 4), dtype=np.int32)
        self._add_tile()
        self._add_tile()
        self.score = 0
        self.done = False
        return self._get_obs()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        action = int(action) % 4
        prev_board = self.board.copy()

        merged_score = self._apply_action(action)

        if np.array_equal(self.board, prev_board):
            # Invalid move — no tiles moved
            return self._get_obs(), -0.1, False, {"invalid": True}

        self.score += merged_score
        reward = np.log2(merged_score + 1) / 11.0  # normalise to ~[0,1]

        self._add_tile()

        # Check if any moves remain
        if not self._has_moves():
            self.done = True
            return self._get_obs(), reward - 1.0, True, {"score": int(self.score)}

        return self._get_obs(), reward, False, {"score": int(self.score)}

    def _apply_action(self, action: int) -> int:
        """Rotate board so we always merge 'up', then rotate back."""
        rotations = {0: 0, 1: 3, 2: 2, 3: 1}
        k = rotations[action]
        self.board = np.rot90(self.board, k)
        score = self._merge_up()
        self.board = np.rot90(self.board, -k % 4)
        return score

    def _merge_up(self) -> int:
        score = 0
        for col in range(4):
            column = self.board[:, col][self.board[:, col] != 0]
            merged = []
            i = 0
            while i < len(column):
                if i + 1 < len(column) and column[i] == column[i + 1]:
                    val = column[i] * 2
                    merged.append(val)
                    score += val
                    i += 2
                else:
                    merged.append(column[i])
                    i += 1
            while len(merged) < 4:
                merged.append(0)
            self.board[:, col] = merged
        return score

    def _add_tile(self):
        empty = list(zip(*np.where(self.board == 0)))
        if empty:
            r, c = random.choice(empty)
            self.board[r, c] = 4 if random.random() < 0.1 else 2

    def _has_moves(self) -> bool:
        if np.any(self.board == 0): return True
        for r in range(4):
            for c in range(4):
                if c + 1 < 4 and self.board[r, c] == self.board[r, c + 1]: return True
                if r + 1 < 4 and self.board[r, c] == self.board[r + 1, c]: return True
        return False

    def _get_obs(self) -> np.ndarray:
        obs = np.zeros(16, dtype=np.float32)
        for i, v in enumerate(self.board.flatten()):
            obs[i] = (np.log2(v) / 11.0) if v > 0 else 0.0
        return obs

    def render(self) -> Dict[str, Any]:
        return {
            "board": self.board.tolist(),
            "score": int(self.score),
            "max_tile": int(self.board.max())
        }

    def _get_state_space(self) -> int:
        return 16

    def _get_action_space(self) -> int:
        return 4
