# Agent Training Technical Overview

This document explains the internal mechanics of how agents are trained in this system, proving that the training is based on actual Reinforcement Learning (RL) and not mock data.

## 1. State Representation (Observation)
Each game environment provides a raw numerical representation of the game world. This is not "cheating" but rather giving the AI the same information a human player would have (e.g., positions, velocities).
- **Example (Pong)**: The state is a vector of 5 values: `[paddle_y, ball_x, ball_y, ball_dx, ball_dy]`. All values are normalized between 0 and 1 (or scaled) to ensure the neural network can process them efficiently.
- **Example (Connect 4)**: A flattened 42-element array representing the grid (0 for empty, 1 for Player 1, 2 for Player 2).

## 2. Decision Making (Policy)
When you see an agent "thinking," it is passing the current observation through its model (a Neural Network for DQN/PPO, or a Q-Table for SARSA/Q-Learning).
- The model outputs "Q-Values" or probabilities for each possible action (e.g., Up, Down, Stay).
- During training, we use **Epsilon-Greedy exploration**: The agent occasionally takes a random action to discover new strategies. This is why you see `ε` (epsilon) decreasing over time in the logs.

## 3. The Learning Loop (Gradient Descent)
The training is a continuous loop:
1.  **Act**: The agent performs an action.
2.  **Observe**: The environment returns a **Reward** (positive for good things like hitting a ball, negative for dying) and the **Next State**.
3.  **Optimize**:
    - **SARSA**: Updates the Q-Value of the *previous* state-action pair based on the *current* reward and the *current* action's Q-Value.
    - **DQN**: Stores the experience in a "Replay Buffer" and periodically samples batches to train a Deep Neural Network using the Bellman Equation.
    - **PPO/A2C**: Uses policy gradients to directly increase the probability of actions that led to high rewards.

## 4. Verification of Authenticity
You can verify that this is not mock data by observing:
- **Learning Curves**: The 'Avg Reward' typically starts very low (noisy) and gradually trends upwards as the agent "learns" the game.
- **Behavior Changes**: An agent at Episode 10 will move randomly; an agent at Episode 500 will show purposeful movement towards the target.
- **SPS (Steps Per Second)**: This metric shows the actual computational throughput of the RL engine.
- **Model Files**: After training, a `.pt` (PyTorch) or serialized Q-table folder is saved in the `storage/` directory, containing the learned weights.

By analyzing the `training_update` events emitted via Socket.IO, you can see real-time metrics being streamed directly from the training loop in `backend/rl_engine/manager.py`.
