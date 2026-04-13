from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Agent, User, MatchHistory
from sqlalchemy import func

stats_bp = Blueprint('stats', __name__)

@stats_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    # Rank agents by win rate or matches won
    top_agents = Agent.query.filter_by(status='completed')\
        .order_by(Agent.matches_won.desc())\
        .limit(10).all()
        
    leaderboard = []
    for agent in top_agents:
        leaderboard.append({
            'id': agent.id,
            'name': agent.name,
            'owner': agent.owner.username,
            'game': agent.game,
            'matches_won': agent.matches_won,
            'matches_played': agent.matches_played,
            'win_rate': (agent.matches_won / agent.matches_played * 100) if agent.matches_played > 0 else 0
        })
        
    return jsonify({'leaderboard': leaderboard}), 200

@stats_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    # Get all agents for the user
    user_agents = Agent.query.filter_by(user_id=current_user_id).all()
    agent_ids = [a.id for a in user_agents]
    
    # Aggregated totals
    total_matches = db.session.query(func.sum(Agent.matches_played)).filter(Agent.user_id == current_user_id).scalar() or 0
    
    # Per-agent stats for the comparison chart
    agent_stats = {}
    for agent in user_agents:
        agent_stats[agent.name] = {
            'wins': agent.matches_won,
            'losses': agent.matches_played - agent.matches_won, # Simplified for now
            'draws': 0, # Place holder
            'winRate': (agent.matches_won / agent.matches_played) if agent.matches_played > 0 else 0
        }
    
    # Recent matches
    recent_matches_db = MatchHistory.query.filter(
        (MatchHistory.agent1_id.in_(agent_ids)) | (MatchHistory.agent2_id.in_(agent_ids))
    ).order_by(MatchHistory.played_at.desc()).limit(10).all()
    
    match_history = []
    for m in recent_matches_db:
        a1 = Agent.query.get(m.agent1_id)
        a2 = Agent.query.get(m.agent2_id)
        
        winner_label = 'draw'
        if m.winner_id == m.agent1_id: winner_label = 'X'
        elif m.winner_id == m.agent2_id: winner_label = 'O'
        
        match_history.append({
            'agentX': a1.name if a1 else "Unknown",
            'agentO': a2.name if a2 else "Unknown",
            'winner': winner_label,
            'moves': 0, # Not tracked in DB yet
            'timestamp': m.played_at.isoformat()
        })
        
    return jsonify({
        'agentStats': agent_stats,
        'totalMatches': total_matches,
        'matchHistory': match_history,
        'username': user.username
    }), 200
