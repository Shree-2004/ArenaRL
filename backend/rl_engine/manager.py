# backend/rl_engine/manager.py

import threading
import time
import os
import datetime
import traceback
import numpy as np
import torch
from extensions import db, socketio
from models import Agent, MatchHistory
import rl_engine.factory as factory
import environments.factory as env_factory

active_training_sessions = {}
active_arena_matches     = {}

# How many episodes between intermediate DB saves during training.
# Protects against data loss if the server crashes mid-training.
# Lower = safer but slightly more DB writes. 50 is a good balance.
_DB_PERSIST_INTERVAL = 50


def training_worker(app, agent_id, config):
    with app.app_context():
        try:
            agent = Agent.query.get(agent_id)
            if not agent:
                socketio.emit('training_update', {
                    'agent_id': agent_id,
                    'status':   'failed',
                    'error':    f"Agent {agent_id} not found in database."
                }, namespace='/training', room=f"agent_{agent_id}")
                return

            agent.status = 'training'

            # ── Persist hyperparameters at training START ───────────────────
            # We save the full config dict to agent.hyperparameters NOW so
            # the report generator always has something to read, even if
            # training is interrupted before completion.
            #
            # We also merge the scalar columns (learning_rate, episodes,
            # exploration_rate) from the config so everything is consistent.
            agent.hyperparameters = {
                # Scalars that also have dedicated columns
                'learning_rate':    float(config.get('learning_rate',    agent.learning_rate    or 0.001)),
                'episodes':         int(config.get('episodes',           agent.episodes         or 1000)),
                'exploration_rate': float(config.get('exploration_rate', agent.exploration_rate or 1.0)),
                # Common hyperparameters
                'discount_factor':  float(config.get('discount_factor',  0.99)),
                'epsilon_min':      float(config.get('epsilon_min',      0.01)),
                'epsilon_decay':    float(config.get('epsilon_decay',    0.995)),
                # DQN-specific
                'batch_size':       int(config.get('batch_size',         64)),
                'memory_size':      int(config.get('memory_size',        10000)),
                'target_update_freq': int(config.get('target_update_freq', 100)),
                # PPO-specific
                'ppo_epochs':       int(config.get('ppo_epochs',         4)),
                'eps_clip':         float(config.get('eps_clip',         0.2)),
                # A2C-specific
                'entropy_coef':     float(config.get('entropy_coef',     0.01)),
                'value_coef':       float(config.get('value_coef',       0.5)),
                # Sync scalar columns
                **{k: v for k, v in {
                    'learning_rate':    float(config.get('learning_rate', agent.learning_rate or 0.001)),
                    'exploration_rate': float(config.get('exploration_rate', agent.exploration_rate or 1.0)),
                }.items()},
            }
            # Also update the dedicated scalar columns so SQL queries work
            agent.learning_rate    = agent.hyperparameters['learning_rate']
            agent.exploration_rate = agent.hyperparameters['exploration_rate']

            # Wipe any previous history in case this agent is being retrained
            agent.reward_history = []
            agent.loss_history   = []
            agent.win_history    = []

            db.session.commit()

            game_name = agent.game
            algo_name = agent.algorithm
            episodes  = int(config.get('episodes', agent.episodes))

            print(f"[Training] Agent {agent_id} | Game: {game_name} | "
                  f"Algo: {algo_name} | Episodes: {episodes}")

            # Compatibility check
            if config.get('game') and config.get('game').lower() != game_name.lower():
                raise ValueError(
                    f"Agent game mismatch. Agent is trained for '{game_name}', "
                    f"but config requests '{config.get('game')}'."
                )

            env  = env_factory.create_environment(game_name)
            algo = factory.create_algorithm(
                algo_name, env.state_space, env.action_space, config
            )

            # In-memory accumulators (also written to DB periodically)
            reward_history = []
            win_history    = []
            loss_history   = []

            start_time  = time.time()
            total_steps = 0

            for episode in range(episodes):
                state        = env.reset()
                total_reward = 0.0
                done         = False
                episode_won  = 0
                episode_loss = []

                while not done:
                    # 1. Choose action
                    action, metrics = algo.select_action(state, training=True)

                    # 2. Step the environment
                    next_state, reward, done, info = env.step(action)

                    # 3. Record the transition (standard interface from Step 1)
                    algo.record_step(state, action, reward, next_state, done)

                    # 4. Learn from buffer
                    algo_metrics = algo.update()

                    if algo_metrics and 'loss' in algo_metrics:
                        episode_loss.append(float(algo_metrics['loss']))

                    state         = next_state
                    total_reward += reward
                    total_steps  += 1

                # ── End-of-episode bookkeeping ──────────────────────────────

                # Win / loss determination
                if info.get('winner') == 1:
                    episode_won = 1
                elif info.get('score', 0) > 0:
                    episode_won = 1
                elif reward > 0:
                    episode_won = 1
                elif total_reward > 5:
                    episode_won = 1

                # Append to in-memory lists
                reward_history.append(float(total_reward))
                win_history.append(episode_won)

                avg_episode_loss = float(np.mean(episode_loss)) if episode_loss else 0.0
                loss_history.append(avg_episode_loss)

                # ── PERSIST histories to the DB ─────────────────────────────
                # We call agent.append_histories() which correctly REPLACES
                # the list object (not mutates it) so SQLAlchemy detects the
                # change and writes it on the next commit.
                #
                # WHY NOT COMMIT EVERY EPISODE:
                # db.session.commit() acquires a write lock on the SQLite
                # file. Doing it every episode inside a tight training loop
                # causes significant slowdown (especially for fast algorithms
                # like Q-Learning). We commit every _DB_PERSIST_INTERVAL
                # episodes instead, and always on the final episode.
                agent.append_histories(
                    reward = float(total_reward),
                    loss   = avg_episode_loss,
                    won    = episode_won,
                )

                if episode % _DB_PERSIST_INTERVAL == 0 or episode == episodes - 1:
                    try:
                        db.session.commit()
                    except Exception as commit_err:
                        # Don't crash training over a failed intermediate save
                        print(f"[Training] Intermediate DB commit failed "
                              f"(episode {episode}): {commit_err}")
                        db.session.rollback()

                # Decay epsilon once per episode
                if hasattr(algo, 'decay_epsilon'):
                    algo.decay_epsilon()

                epsilon = getattr(algo, 'epsilon', 0.0)

                # ── Live Socket.IO update ───────────────────────────────────
                if episode % 2 == 0 or episode == episodes - 1:
                    elapsed    = time.time() - start_time
                    sps        = total_steps / elapsed if elapsed > 0 else 0
                    avg_reward = float(np.mean(reward_history[-100:])) if reward_history else 0.0
                    win_rate   = float(np.mean(win_history[-100:]))    if win_history  else 0.0
                    
                    # Package the base progress
                    update_payload = {
                        'agent_id':       agent_id,
                        'episode':        episode,
                        'currentEpisode': episode,
                        'totalEpisodes':  episodes,
                        'reward':         avg_reward,
                        'avgReward':      avg_reward,
                        'winRate':        win_rate,
                        'epsilon':        round(float(epsilon), 4),
                        'status':         'training',
                        'rewardHistory':  [float(x) for x in reward_history[-100:]],
                        'winRateHistory': [float(x) for x in win_history[-200:]],
                        'lossHistory':    [float(x) for x in loss_history[-100:]],
                        'sps':            round(sps, 2),
                        'board':          env.render(),
                        'log': (
                            f"Episode {episode}/{episodes} | "
                            f"Win Rate: {win_rate:.1%} | "
                            f"Avg Reward: {avg_reward:.2f} | "
                            f"ε: {float(epsilon):.3f}"
                        )
                    }

                    # CRITICAL FIX: Merge decision reasoning (q_values) and learning metrics
                    # We capture metrics from the latest step in the loop
                    combined_metrics = {}
                    
                    # 1. Add metrics from the latest action selection (q_values, reasoning)
                    if 'metrics' in locals() and metrics:
                        combined_metrics.update(metrics)
                        
                    # 2. Add metrics from the latest training update (loss, avg_q, etc.)
                    if 'algo_metrics' in locals() and algo_metrics:
                        combined_metrics.update(algo_metrics)

                    # 3. Clean up and merge into the payload
                    if combined_metrics:
                        serializable_metrics = {}
                        for k, v in combined_metrics.items():
                            if isinstance(v, (np.float32, np.float64, torch.Tensor)):
                                serializable_metrics[k] = float(v)
                            elif isinstance(v, list):
                                serializable_metrics[k] = [float(x) for x in v]
                            else:
                                serializable_metrics[k] = v
                        update_payload.update(serializable_metrics)
                    
                    # Add current average loss for the "Loss" chip if available
                    update_payload['loss'] = avg_episode_loss

                    socketio.emit('training_update', update_payload, 
                                  namespace='/training', room=f"agent_{agent_id}")

                    socketio.sleep(0)   # yield to eventlet

            # ── Training complete ───────────────────────────────────────────

            # Save model weights to disk
            model_dir  = 'storage'
            os.makedirs(model_dir, exist_ok=True)
            model_path = os.path.join(model_dir, f"agent_{agent_id}.pt")
            algo.save(model_path)

            # Compute final statistics
            final_avg_reward = float(np.mean(reward_history[-100:])) if reward_history else 0.0
            final_win_rate   = float(np.mean(win_history[-100:]))    if win_history  else 0.0
            elapsed_total    = time.time() - start_time

            # ── FINAL DB WRITE ──────────────────────────────────────────────
            # This is the single most important commit in the entire system.
            # It persists:
            #   - agent.status = 'completed'      ← marks the agent as usable
            #   - agent.final_reward               ← shown on Stats/Leaderboard
            #   - agent.reward_history             ← drawn as chart in the PDF
            #   - agent.loss_history               ← drawn as chart in the PDF
            #   - agent.win_history                ← used for verdict paragraph
            #   - agent.hyperparameters            ← printed in "The Brain" table
            #   - agent.model_path                 ← used by Arena to load weights
            #   - agent.completed_at               ← timestamp for the report cover
            #   - agent.duration_seconds           ← shown in report summary
            #   - agent.matches_played/won         ← used by leaderboard
            #
            # If this commit fails, the report generator has no data to read.
            # The try/except below logs the error clearly rather than silently
            # swallowing it.
            agent.model_path       = model_path
            agent.status           = 'completed'
            agent.final_reward     = final_avg_reward
            agent.completed_at     = datetime.datetime.utcnow()
            agent.duration_seconds = int(elapsed_total)
            agent.matches_played   = len(win_history)
            agent.matches_won      = int(sum(win_history))

            # The full histories are already in agent.reward_history etc.
            # from the per-episode append_histories() calls above.
            # We just need one final commit to flush the last batch.
            try:
                db.session.commit()
                print(f"[Training] Agent {agent_id} committed to DB. "
                      f"Reward: {final_avg_reward:.2f} | "
                      f"Win Rate: {final_win_rate:.1%} | "
                      f"History: {len(reward_history)} episodes")
            except Exception as final_commit_err:
                print(f"[Training] CRITICAL: Final DB commit failed for "
                      f"agent {agent_id}: {final_commit_err}")
                traceback.print_exc()
                db.session.rollback()
                # Don't re-raise — the model is saved, training succeeded,
                # only the DB write failed. Let the user know via socket.
                socketio.emit('training_update', {
                    'agent_id': agent_id,
                    'status':   'completed',
                    'warning':  'Training finished but DB save failed. '
                                'Report may be incomplete.',
                }, namespace='/training', room=f"agent_{agent_id}")

            # Final socket event
            socketio.emit('training_update', {
                'agent_id':       agent_id,
                'episode':        episodes,
                'currentEpisode': episodes,
                'totalEpisodes':  episodes,
                'reward':         final_avg_reward,
                'avgReward':      final_avg_reward,
                'winRate':        final_win_rate,
                'epsilon':        0.0,
                'status':         'completed',
                'rewardHistory':  [float(x) for x in reward_history],
                'winRateHistory': [float(x) for x in win_history],
                'lossHistory':    [float(x) for x in loss_history],
                'log': (
                    f"Training complete! "
                    f"Win Rate: {final_win_rate:.1%} | "
                    f"Avg Reward: {final_avg_reward:.2f} | "
                    f"Duration: {int(elapsed_total)}s"
                )
            }, namespace='/training', room=f"agent_{agent_id}")

        except Exception as e:
            print(f"[Training] Error in worker for agent {agent_id}: {e}")
            traceback.print_exc()

            try:
                agent = Agent.query.get(agent_id)
                if agent:
                    agent.status = 'failed'
                    db.session.commit()
            except Exception as db_err:
                print(f"[Training] Failed to update DB status: {db_err}")

            try:
                socketio.emit('training_update', {
                    'agent_id': agent_id,
                    'status':   'failed',
                    'error':    str(e)
                }, namespace='/training', room=f"agent_{agent_id}")
            except Exception as emit_err:
                print(f"[Training] Failed to emit failure status: {emit_err}")


def start_training_session(app, agent_id, config):
    """Spawns a background thread to run the training loop."""
    thread = threading.Thread(
        target=training_worker,
        args=(app, agent_id, config),
        name=f"train-agent-{agent_id}"
    )
    thread.daemon = True
    thread.start()
    active_training_sessions[agent_id] = thread


# ═══════════════════════════════════════════════════════════════════════════════
# ARENA
# ═══════════════════════════════════════════════════════════════════════════════

def arena_worker(app, match_id, agent1_id, agent2_id, game_name):
    with app.app_context():
        try:
            env = env_factory.create_environment(game_name)

            agent1_db = Agent.query.get(agent1_id)
            agent2_db = Agent.query.get(agent2_id)

            if not agent1_db or not agent2_db:
                raise ValueError(
                    f"One or both agents not found: {agent1_id}, {agent2_id}"
                )

            if agent1_db.game.lower() != game_name.lower():
                raise ValueError(
                    f"Agent '{agent1_db.name}' was trained on "
                    f"'{agent1_db.game}', not '{game_name}'."
                )
            if agent2_db.game.lower() != game_name.lower():
                raise ValueError(
                    f"Agent '{agent2_db.name}' was trained on "
                    f"'{agent2_db.game}', not '{game_name}'."
                )

            hyp1 = agent1_db.hyperparameters or {}
            hyp2 = agent2_db.hyperparameters or {}

            algo1 = factory.create_algorithm(
                agent1_db.algorithm, env.state_space, env.action_space, hyp1
            )
            algo2 = factory.create_algorithm(
                agent2_db.algorithm, env.state_space, env.action_space, hyp2
            )

            if agent1_db.model_path and os.path.exists(agent1_db.model_path):
                algo1.load(agent1_db.model_path)
            else:
                print(f"[Arena] Warning: no saved model for '{agent1_db.name}'.")

            if agent2_db.model_path and os.path.exists(agent2_db.model_path):
                algo2.load(agent2_db.model_path)
            else:
                print(f"[Arena] Warning: no saved model for '{agent2_db.name}'.")

            state       = env.reset()
            done        = False
            last_reward = 0.0

            socketio.emit('arena_start', {
                'match_id': match_id,
                'game':     game_name,
                'agent1':   agent1_db.name,
                'agent2':   agent2_db.name,
            }, namespace='/arena', room=f"match_{match_id}")

            while not done:
                action1, metrics1 = algo1.select_action(state, training=False)
                next_state, reward, done, info = env.step(action1)
                last_reward = reward

                socketio.emit('arena_state', {
                    'match_id':       match_id,
                    'board':          env.render(),
                    'current_player': agent1_db.name,
                    'last_move':      int(
                        action1 if isinstance(action1, (int, np.integer))
                        else action1[0] if isinstance(action1, (list, tuple))
                        else 0
                    ),
                    'q_values':  metrics1.get('q_values', {}),
                    'metrics':   metrics1,
                    'done':      done,
                }, namespace='/arena', room=f"match_{match_id}")

                state = next_state
                time.sleep(0.5)

                if done:
                    break

            # Determine winner
            winner_id   = None
            winner_name = "Draw"

            if last_reward > 0:
                winner_id   = agent1_id
                winner_name = agent1_db.name
            elif last_reward < 0:
                winner_id   = agent2_id
                winner_name = agent2_db.name

            # ── Update arena stats on both agents ───────────────────────────
            # This keeps agent.matches_played and agent.matches_won in sync
            # with the MatchHistory table so the report's Arena page is accurate.
            try:
                agent1_db.matches_played = (agent1_db.matches_played or 0) + 1
                agent2_db.matches_played = (agent2_db.matches_played or 0) + 1
                if winner_id == agent1_id:
                    agent1_db.matches_won = (agent1_db.matches_won or 0) + 1
                elif winner_id == agent2_id:
                    agent2_db.matches_won = (agent2_db.matches_won or 0) + 1

                match = MatchHistory(
                    agent1_id    = agent1_id,
                    agent2_id    = agent2_id,
                    winner_id    = winner_id,
                    game         = game_name,
                    score_agent1 = float(last_reward)  if last_reward > 0 else 0.0,
                    score_agent2 = float(-last_reward) if last_reward < 0 else 0.0,
                )
                db.session.add(match)
                db.session.commit()
                print(f"[Arena] Match {match_id} saved. Winner: {winner_name}")
            except Exception as commit_err:
                print(f"[Arena] Failed to save match result: {commit_err}")
                db.session.rollback()

            socketio.emit('arena_complete', {
                'match_id':    match_id,
                'winner':      winner_name,
                'last_reward': float(last_reward),
            }, namespace='/arena', room=f"match_{match_id}")

        except Exception as e:
            print(f"[Arena] Error in worker for match {match_id}: {e}")
            traceback.print_exc()

            try:
                socketio.emit('arena_complete', {
                    'match_id': match_id,
                    'winner':   'Error',
                    'error':    str(e),
                }, namespace='/arena', room=f"match_{match_id}")
            except Exception as emit_err:
                print(f"[Arena] Failed to emit error: {emit_err}")


def start_arena_match(app, match_id, agent1_id, agent2_id, game_name):
    """Spawns a background thread to run an arena match."""
    thread = threading.Thread(
        target=arena_worker,
        args=(app, match_id, agent1_id, agent2_id, game_name),
        name=f"arena-match-{match_id}"
    )
    thread.daemon = True
    thread.start()
    active_arena_matches[match_id] = thread