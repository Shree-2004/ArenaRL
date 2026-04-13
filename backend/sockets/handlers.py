from flask_socketio import Namespace, emit, join_room, leave_room
from flask import request
import time
from extensions import socketio
from models import Agent
import rl_engine.manager as manager

class TrainingNamespace(Namespace):
    def on_connect(self):
        print(f"Client connected to training namespace: {request.sid}")

    def on_disconnect(self):
        print(f"Client disconnected from training namespace: {request.sid}")

    def on_join(self, data):
        agent_id = data.get('agent_id')
        if agent_id:
            join_room(f"agent_{agent_id}")
            print(f"Client {request.sid} joined training room for agent {agent_id}")
            # Acknowledge the join so the client knows it's safe to start training
            emit('join_ack', {'agent_id': agent_id})

    def on_start_training(self, data):
        """
        Called by the frontend AFTER joining the room.
        This guarantees the socket subscription is active before any
        training_update events are emitted, eliminating the race condition.
        """
        agent_id = data.get('agent_id')
        config = data.get('config', {})
        if agent_id:
            from flask import current_app
            from rl_engine.manager import start_training_session
            start_training_session(current_app._get_current_object(), agent_id, config)
            emit('training_started', {'agent_id': agent_id})

    def on_leave(self, data):
        agent_id = data.get('agent_id')
        if agent_id:
            leave_room(f"agent_{agent_id}")
            print(f"Client {request.sid} left training room for agent {agent_id}")

class ArenaNamespace(Namespace):
    def on_connect(self):
        print(f"Client connected to arena namespace: {request.sid}")

    def on_join(self, data):
        match_id = data.get('match_id')
        if match_id:
            join_room(f"match_{match_id}")
            print(f"Client {request.sid} joined arena room for match {match_id}")

    def on_start_match(self, data):
        agent1_id = data.get('agent1_id')
        agent2_id = data.get('agent2_id')
        game_name = data.get('game')
        match_id = f"match_{int(time.time())}"
        
        if agent1_id and agent2_id and game_name:
            join_room(f"match_{match_id}")
            from flask import current_app
            from rl_engine.manager import start_arena_match
            start_arena_match(current_app._get_current_object(), match_id, agent1_id, agent2_id, game_name)
            emit('match_created', {'match_id': match_id})

    def on_leave(self, data):
        match_id = data.get('match_id')
        if match_id:
            leave_room(f"match_{match_id}")
            print(f"Client {request.sid} left arena room for match {match_id}")
