from flask import Blueprint, send_file, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Agent
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from datetime import datetime

report_bp = Blueprint('report', __name__)

@report_bp.route('/<agent_id>/pdf', methods=['GET'])
@jwt_required()
def download_report(agent_id):
    agent = Agent.query.get(agent_id)
    if not agent:
        return jsonify({'message': 'Agent not found'}), 404
        
    report_dir = os.path.join(os.getcwd(), 'storage', 'reports')
    if not os.path.exists(report_dir): os.makedirs(report_dir)
    
    report_filename = f"report_{agent_id}.pdf"
    report_path = os.path.join(report_dir, report_filename)
    
    # Generate PDF
    try:
        c = canvas.Canvas(report_path, pagesize=letter)
        width, height = letter
        
        # Header
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width/2, height - 50, "AI MULTI-GAME RL PLATFORM")
        c.setFont("Helvetica", 14)
        c.drawCentredString(width/2, height - 75, "TRAINING PERFORMANCE REPORT")
        c.line(50, height - 85, width - 50, height - 85)
        
        # Agent Details
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, height - 120, f"Agent Name: {agent.name}")
        c.drawString(50, height - 140, f"Game Environment: {agent.game}")
        c.drawString(50, height - 160, f"Algorithm: {agent.algorithm}")
        c.drawString(50, height - 180, f"Training Date: {agent.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Hyperparameters
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 220, "Configuration & Hyperparameters")
        c.setFont("Helvetica", 12)
        c.drawString(70, height - 240, f"Learning Rate: {agent.learning_rate}")
        c.drawString(70, height - 260, f"Total Episodes: {agent.episodes}")
        c.drawString(70, height - 280, f"Starting Exploration Rate: {agent.exploration_rate}")
        
        # Performance Summary
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 320, "Training Results Summary")
        c.setFont("Helvetica", 12)
        c.drawString(70, height - 340, f"Final Status: {agent.status.upper()}")
        c.drawString(70, height - 360, f"Final Average Reward: {agent.final_reward if agent.final_reward is not None else 'N/A'}")
        c.drawString(70, height - 380, f"Matches Played: {agent.matches_played}")
        c.drawString(70, height - 400, f"Matches Won: {agent.matches_won}")
        
        win_rate = (agent.matches_won / agent.matches_played * 100) if agent.matches_played > 0 else 0
        c.drawString(70, height - 420, f"Arena Win Rate: {win_rate:.2f}%")
        
        # Footer
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(50, 50, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        c.drawRightString(width - 50, 50, "Page 1 of 1")
        
        c.showPage()
        c.save()
        
    except Exception as e:
        return jsonify({'message': f'Failed to generate PDF: {str(e)}'}), 500
        
    return send_file(report_path, as_attachment=True, download_name=f"{agent.name}_report.pdf")
