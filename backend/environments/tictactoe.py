import numpy as np
import random
from typing import Tuple, Dict, Any
from .base import BaseEnvironment


class TicTacToeEnvironment(BaseEnvironment):
    """
    Tic Tac Toe environment.
    Agent plays as player 1 (1), random opponent plays as player 2 (-1).
    Board is a 3x3 grid flattened to 9 values: 1=agent, -1=opponent, 0=empty.
    Actions: 0-8 (cell index).
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.reset()

    def reset(self) -> np.ndarray:
        self.board = np.zeros(9, dtype=np.float32)
        self.done = False
        self.winner = 0
        return self.board.copy()

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        action = int(action)

        # Invalid move
        if self.board[action] != 0:
            return self.board.copy(), -5.0, True, {"invalid": True}

        # Agent places 1
        self.board[action] = 1

        if self._check_win(1):
            self.done = True
            self.winner = 1
            return self.board.copy(), 10.0, True, {"winner": 1}

        if np.all(self.board != 0):
            self.done = True
            return self.board.copy(), 0.5, True, {"winner": 0}  # draw

        # Opponent places -1 (random valid move)
        valid = [i for i in range(9) if self.board[i] == 0]
        opp_action = random.choice(valid)
        self.board[opp_action] = -1

        if self._check_win(-1):
            self.done = True
            self.winner = -1
            return self.board.copy(), -10.0, True, {"winner": -1}

        if np.all(self.board != 0):
            self.done = True
            return self.board.copy(), 0.5, True, {"winner": 0}

        return self.board.copy(), 0.0, False, {}

    def _check_win(self, player: int) -> bool:
        b = self.board.reshape(3, 3)
        for i in range(3):
            if np.all(b[i, :] == player): return True
            if np.all(b[:, i] == player): return True
        if b[0, 0] == b[1, 1] == b[2, 2] == player: return True
        if b[0, 2] == b[1, 1] == b[2, 0] == player: return True
        return False

    def render(self) -> Dict[str, Any]:
        symbols = {0: None, 1: 'X', -1: 'O'}
        return {
            "board": [[symbols[int(self.board[r * 3 + c])] for c in range(3)] for r in range(3)],
            "winner": self.winner
        }

    def _get_observation(self) -> np.ndarray:
        return self.board.copy()

    def _get_state_space(self) -> int:
        return 9

    def _get_action_space(self) -> int:
        return 9
