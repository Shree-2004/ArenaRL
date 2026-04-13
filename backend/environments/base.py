from abc import ABC, abstractmethod
import numpy as np
from typing import Tuple, Dict, Any

class BaseEnvironment(ABC):
    """
    Abstract Base Class for all Game Environments.
    Requires implementation of Gym-style methods for RL.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.state_space = self._get_state_space()
        self.action_space = self._get_action_space()
        
    @abstractmethod
    def reset(self) -> np.ndarray:
        """
        Resets the environment to an initial state.
        Returns the initial state representation.
        """
        pass
        
    @abstractmethod
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """
        Takes an action in the environment.
        Returns:
            state (np.ndarray): The new state
            reward (float): The reward achieved from the action
            done (bool): Whether the episode has terminated
            info (dict): Extracted metadata/metrics (e.g. score)
        """
        pass
        
    @abstractmethod
    def render(self) -> Dict[str, Any]:
        """
        Returns a serializable dictionary representing the board/game state
        that can be sent over WebSocket to the frontend Canvas/Grid.
        """
        pass
        
    @abstractmethod
    def _get_state_space(self) -> int:
        pass
        
    @abstractmethod
    def _get_action_space(self) -> int:
        pass
