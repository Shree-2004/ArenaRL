# backend/models.py

import uuid
import json
from datetime import datetime
from extensions import db


# ─── Custom SQLAlchemy Type ───────────────────────────────────────────────────

class JSONColumn(db.TypeDecorator):
    """
    A transparent JSON ↔ Python serialiser for SQLite.

    WHY THIS EXISTS (for your viva):
    SQLite has no native JSON column type (unlike PostgreSQL). If you try
    to store a Python list or dict directly, SQLAlchemy raises a TypeError.

    This custom type solves the problem transparently:
      - On WRITE: Python list/dict  → json.dumps() → TEXT stored in SQLite
      - On READ:  TEXT from SQLite  → json.loads()  → Python list/dict

    The rest of the code never has to call json.dumps/loads manually —
    it just reads and writes normal Python objects and this class handles
    the conversion automatically. This is the "Adapter" design pattern.

    IMPL: db.TypeDecorator wraps an underlying type (db.Text here) and
    intercepts the process_bind_param (Python → DB) and
    process_result_value (DB → Python) hooks.
    """

    # The actual SQLite column type that stores the serialised data
    impl = db.Text

    # Tells SQLAlchemy this type can cache its results safely
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Python → database: called before every INSERT / UPDATE."""
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        """Database → Python: called after every SELECT."""
        if value is None:
            return None
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            # Corrupted or legacy data: return None rather than crashing
            return None


# ─── Models ───────────────────────────────────────────────────────────────────

class User(db.Model):
    """
    Registered user account.
    One user can own many Agents (one-to-many via agents relationship).
    """
    __tablename__ = 'user'

    id            = db.Column(db.String(36), primary_key=True,
                              default=lambda: str(uuid.uuid4()))
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    agents = db.relationship('Agent', backref='owner', lazy=True)

    def to_dict(self) -> dict:
        return {
            'id':         self.id,
            'username':   self.username,
            'email':      self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Agent(db.Model):
    """
    A trained (or in-training) RL agent.

    DATABASE SCHEMA NOTE (for your viva):
    reward_history, loss_history, win_history, and hyperparameters are
    stored as JSON TEXT via the JSONColumn type. When you read
    agent.reward_history you get a Python list; when you assign a list
    to it and commit, it is automatically serialised to a JSON string in
    the database. No manual json.dumps/loads required anywhere.

    HISTORY COLUMNS:
      reward_history  — list of per-episode average rewards
                        grows from [] to [r0, r1, ..., rN] over training
      loss_history    — list of per-episode average losses
                        for tabular methods (Q-Learning/SARSA) this stores
                        the TD error instead (labelled 'loss' for uniformity)
      win_history     — list of per-episode 0/1 win flags
                        used to compute rolling win rate on the Stats page

    HYPERPARAMETERS COLUMN:
      Stores the full config dict that was passed to the algorithm factory.
      This is what the report generator reads to populate its
      "The Brain" hyperparameter table.
      Example: {"learning_rate": 0.001, "discount_factor": 0.99, ...}
    """
    __tablename__ = 'agent'

    # ── Identity ────────────────────────────────────────────────────────────
    id      = db.Column(db.String(36), primary_key=True,
                        default=lambda: str(uuid.uuid4()))
    name    = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.String(36),
                        db.ForeignKey('user.id'), nullable=False)

    # ── Game & Algorithm ────────────────────────────────────────────────────
    game      = db.Column(db.String(50),  nullable=False)  # e.g. 'snake'
    algorithm = db.Column(db.String(50),  nullable=False)  # e.g. 'dqn'

    # ── Scalar hyperparameters (kept as dedicated columns for fast querying) ─
    learning_rate    = db.Column(db.Float,   default=0.001)
    episodes         = db.Column(db.Integer, default=1000)
    exploration_rate = db.Column(db.Float,   default=1.0)

    # ── Full hyperparameter snapshot (JSON) ─────────────────────────────────
    # Stores the entire config dict so the report generator can display
    # every setting that was active during training, not just learning_rate.
    hyperparameters  = db.Column(JSONColumn, nullable=True, default=dict)

    # ── Training status ─────────────────────────────────────────────────────
    status     = db.Column(db.String(20), default='pending')
    #   'pending'  — created but training not yet started
    #   'training' — currently training (manager.py is running)
    #   'completed'— training finished successfully
    #   'failed'   — an exception occurred during training

    model_path = db.Column(db.String(200), nullable=True)
    #   Relative path to the saved .pt file, e.g. 'storage/agent_42.pt'
    #   Also used as the stem for Q-table .pkl files in tabular algorithms.

    # ── Scalar training results ─────────────────────────────────────────────
    final_reward     = db.Column(db.Float,   nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at     = db.Column(db.DateTime, nullable=True)
    matches_played   = db.Column(db.Integer,  default=0)
    matches_won      = db.Column(db.Integer,  default=0)

    # ── History arrays (JSON) ────────────────────────────────────────────────
    reward_history = db.Column(JSONColumn, nullable=True, default=list)
    #   [float, ...]  one entry per episode — the rolling average reward
    #   Used by: Stats page charts, PDF report Figure 1, verdict generator

    loss_history   = db.Column(JSONColumn, nullable=True, default=list)
    #   [float, ...]  one entry per episode — average loss (or TD error)
    #   Used by: Stats page charts, PDF report Figure 2, verdict generator

    win_history    = db.Column(JSONColumn, nullable=True, default=list)
    #   [int, ...]    0 or 1 per episode — did the agent win this episode?
    #   Used by: rolling win rate chart (PDF Figure 3), evidence checklist

    def append_histories(
        self,
        reward:  float,
        loss:    float,
        won:     int,
    ) -> None:
        """
        Append one episode's metrics to all three history arrays.

        IMPORTANT: Because JSONColumn stores lists as TEXT, SQLAlchemy
        cannot detect in-place mutations (list.append) as a change.
        We must REPLACE the entire column value with a new list object
        to trigger the dirty-tracking that causes the UPDATE to be written.

        This method handles that correctly by building new lists each call.
        Call it at the end of every episode in manager.py, then commit once
        at the end of training (or every N episodes for long runs).

        Args:
            reward: The episode's average reward value.
            loss:   The episode's average loss / TD error.
            won:    1 if the agent won this episode, 0 otherwise.
        """
        # Read current values (may be None for brand-new agents)
        current_rewards = list(self.reward_history or [])
        current_losses  = list(self.loss_history  or [])
        current_wins    = list(self.win_history   or [])

        # Append and REPLACE (not mutate) — triggers SQLAlchemy dirty tracking
        self.reward_history = current_rewards + [float(reward)]
        self.loss_history   = current_losses  + [float(loss)]
        self.win_history    = current_wins    + [int(won)]

    def get_win_rate(self, window: int = 100) -> float:
        """
        Returns the rolling win rate over the last `window` episodes.
        Used by the Stats page and the report generator.
        """
        history = self.win_history or []
        if not history:
            return 0.0
        recent = history[-window:]
        return sum(recent) / len(recent)

    def to_dict(self) -> dict:
        """
        Serialises the agent to a JSON-safe dict for REST API responses.
        All list columns are included so the Stats page can plot charts
        without a separate API call.
        """
        return {
            # Identity
            'id':              self.id,
            'name':            self.name,
            'user_id':         self.user_id,

            # Game / algorithm
            'game':            self.game,
            'algorithm':       self.algorithm,
            'type':            self.algorithm,   # UI alias

            # Scalar hyperparams
            'learning_rate':   self.learning_rate,
            'episodes':        self.episodes,
            'exploration_rate': self.exploration_rate,

            # Full hyperparameter snapshot
            'hyperparameters': self.hyperparameters or {},

            # Status
            'status':          self.status,
            'model_path':      self.model_path,

            # Scalar results
            'final_reward':    self.final_reward,
            'duration_seconds': self.duration_seconds,
            'matches_played':  self.matches_played,
            'matches_won':     self.matches_won,
            'win_rate':        self.get_win_rate(),

            # Timestamps
            'created_at':      self.created_at.isoformat()
                               if self.created_at else None,
            'completed_at':    self.completed_at.isoformat()
                               if self.completed_at else None,

            # History arrays (for charts)
            'reward_history':  self.reward_history  or [],
            'loss_history':    self.loss_history    or [],
            'win_history':     self.win_history     or [],

            # Derived flags used by the UI
            'trainable':       self.status in ('pending', 'failed'),
            'trained':         self.status == 'completed',
        }


class MatchHistory(db.Model):
    """
    Records the result of one arena match between two agents.

    winner_id is NULL for a draw.
    score_agent1 / score_agent2 store the final reward from the
    agent's perspective (positive = won that reward).
    """
    __tablename__ = 'match_history'

    id          = db.Column(db.String(36), primary_key=True,
                            default=lambda: str(uuid.uuid4()))
    agent1_id   = db.Column(db.String(36),
                            db.ForeignKey('agent.id'), nullable=False)
    agent2_id   = db.Column(db.String(36),
                            db.ForeignKey('agent.id'), nullable=False)
    game        = db.Column(db.String(50),  nullable=False)
    winner_id   = db.Column(db.String(36),
                            db.ForeignKey('agent.id'), nullable=True)
    score_agent1 = db.Column(db.Float, nullable=True)
    score_agent2 = db.Column(db.Float, nullable=True)
    played_at   = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships (for JOIN queries in the reports API)
    agent1  = db.relationship('Agent', foreign_keys=[agent1_id])
    agent2  = db.relationship('Agent', foreign_keys=[agent2_id])
    winner  = db.relationship('Agent', foreign_keys=[winner_id])

    def to_dict(self) -> dict:
        return {
            'id':            self.id,
            'agent1_id':     self.agent1_id,
            'agent2_id':     self.agent2_id,
            'game':          self.game,
            'winner_id':     self.winner_id,
            'score_agent1':  self.score_agent1,
            'score_agent2':  self.score_agent2,
            'played_at':     self.played_at.isoformat()
                             if self.played_at else None,
            # Resolved names (available when loaded with joinedload)
            'agent1_name':   self.agent1.name  if self.agent1  else None,
            'agent2_name':   self.agent2.name  if self.agent2  else None,
            'winner_name':   self.winner.name  if self.winner  else None,
            'opponent_name': self.agent2.name  if self.agent2  else None,
        }