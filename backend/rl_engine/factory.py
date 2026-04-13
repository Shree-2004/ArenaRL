from .q_learning import QLearningAlgorithm
from .dqn import DQNAlgorithm
from .ppo import PPOAlgorithm
from .a2c import A2CAlgorithm
from .sarsa import SARSAAlgorithm

def create_algorithm(name: str, state_dim: int, action_dim: int, config: dict):
    name = name.lower()
    if name == 'q-learning': return QLearningAlgorithm(state_dim, action_dim, config)
    if name == 'dqn': return DQNAlgorithm(state_dim, action_dim, config)
    if name == 'ppo': return PPOAlgorithm(state_dim, action_dim, config)
    if name == 'a2c': return A2CAlgorithm(state_dim, action_dim, config)
    if name == 'sarsa': return SARSAAlgorithm(state_dim, action_dim, config)
    raise ValueError(f"Unknown algorithm: {name}")
