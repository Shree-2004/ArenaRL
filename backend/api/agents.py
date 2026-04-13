from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Agent, MatchHistory
import json

agents_bp = Blueprint('agents', __name__)

@agents_bp.route('/', methods=['POST'])
@jwt_required()
def create_agent():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('game') or not data.get('algorithm'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Validation
    try:
        lr = float(data.get('learningRate', 0.001))
        episodes = int(data.get('episodes', 1000))
        explore = float(data.get('explorationRate', 1.0))
        
        if not (0 < lr <= 1.0):
            return jsonify({'message': 'Learning rate must be between 0 and 1'}), 400
        if episodes <= 0:
            return jsonify({'message': 'Episodes must be greater than 0'}), 400
        if not (0 <= explore <= 1.0):
            return jsonify({'message': 'Exploration rate must be between 0 and 1'}), 400
            
    except (ValueError, TypeError):
        return jsonify({'message': 'Invalid hyperparameter format'}), 400
        
    new_agent = Agent(
        name=data['name'],
        user_id=current_user_id,
        game=data['game'],
        algorithm=data['algorithm'],
        learning_rate=lr,
        episodes=episodes,
        exploration_rate=explore
    )
    
    db.session.add(new_agent)
    db.session.commit()
    
    # Training is started via Socket.IO `start_training` event after the client
    # has joined the agent room, to avoid the race condition where training updates
    # emit to a room before the client has subscribed.
    return jsonify({
        'message': 'Agent created. Connect via Socket.IO to start training.',
        'agent_id': new_agent.id
    }), 201

@agents_bp.route('/', methods=['GET'])
@jwt_required()
def list_agents():
    current_user_id = get_jwt_identity()
    try:
        agents = Agent.query.filter_by(user_id=current_user_id).order_by(Agent.created_at.desc()).all()
        
        agent_list = []
        for agent in agents:
            agent_list.append({
                'id': agent.id,
                'name': agent.name,
                'game': agent.game,
                'algorithm': agent.algorithm,
                'status': agent.status,
                'episodes': agent.episodes,
                'final_reward': agent.final_reward,
                'matches_won': agent.matches_won,
                'matches_played': agent.matches_played,
                'created_at': agent.created_at.isoformat()
            })
            
        return jsonify({'agents': agent_list}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Error fetching agents: {str(e)}'}), 500

@agents_bp.route('/<agent_id>', methods=['GET'])
@jwt_required()
def get_agent(agent_id):
    current_user_id = get_jwt_identity()
    agent = Agent.query.get(agent_id)
    
    if not agent:
        return jsonify({'message': 'Agent not found'}), 404
        
    if agent.user_id != current_user_id:
        return jsonify({'message': 'Unauthorized'}), 403
        
    return jsonify({
        'id': agent.id,
        'name': agent.name,
        'game': agent.game,
        'algorithm': agent.algorithm,
        'status': agent.status,
        'hyperparameters': {
            'learning_rate': agent.learning_rate,
            'episodes': agent.episodes,
            'exploration_rate': agent.exploration_rate
        },
        'stats': {
            'final_reward': agent.final_reward,
            'duration_seconds': agent.duration_seconds,
            'matches_won': agent.matches_won,
            'matches_played': agent.matches_played
        },
        'created_at': agent.created_at.isoformat(),
        'completed_at': agent.completed_at.isoformat() if agent.completed_at else None
    }), 200

@agents_bp.route('/<agent_id>', methods=['DELETE'])
@jwt_required()
def delete_agent(agent_id):
    current_user_id = get_jwt_identity()
    agent = Agent.query.get(agent_id)
    
    if not agent:
        return jsonify({'message': 'Agent not found'}), 404
        
    if agent.user_id != current_user_id:
        return jsonify({'message': 'Unauthorized'}), 403
        
    db.session.delete(agent)
    db.session.commit()
    
    # Also would delete the .pt file here in the future
    
    return jsonify({'message': 'Agent deleted successfully'}), 200
