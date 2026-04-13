from .maze import MazeEnvironment
from .snake import SnakeEnvironment
from .pong import PongEnvironment
from .flappy import FlappyEnvironment
from .connect4 import Connect4Environment
from .game2048 import Game2048Environment
from .dodge import DodgeEnvironment
from .breakout import BreakoutEnvironment
from .treasure_hunt import TreasureHuntEnvironment
from .balloon_pop import BalloonPopEnvironment


def create_environment(name: str, config=None):
    """
    Factory function to create a game environment by name.
    Handles all name variants the frontend may store in the DB.
    """
    name = name.lower().strip().replace(' ', '').replace('-', '').replace('_', '')

    if name in ('maze',):
        return MazeEnvironment(config)

    if name in ('snake',):
        return SnakeEnvironment(config)

    if name in ('pong',):
        return PongEnvironment(config)

    if name in ('flappy', 'flappybird'):
        return FlappyEnvironment(config)

    if name in ('connect4', 'connect',):
        return Connect4Environment(config)

    if name in ('2048', 'game2048', 'twentyfortyeight'):
        return Game2048Environment(config)

    if name in ('dodge', 'cardodge'):
        return DodgeEnvironment(config)

    if name in ('breakout',):
        return BreakoutEnvironment(config)

    if name in ('treasurehunt', 'gridtreasurehunt'):
        return TreasureHuntEnvironment(config)

    if name in ('balloonpop', 'balloon'):
        return BalloonPopEnvironment(config)

    raise ValueError(f"Unknown environment: '{name}'. Supported: maze, snake, pong, flappybird, connect4, 2048, dodge, breakout, treasurehunt, balloonpop")
