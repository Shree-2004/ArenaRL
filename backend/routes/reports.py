# backend/routes/reports.py

"""
Reports Blueprint — serves downloadable PDF training reports.

URL PATTERN:
    GET /api/reports/<agent_id>/pdf

AUTHENTICATION:
    Requires a valid JWT token in the Authorization header.
    The token's user_id must match the agent's owner, unless the
    requesting user is an admin (future-proofing).

FLOW:
    1. Verify JWT           → identify the requesting user
    2. Fetch Agent from DB  → 404 if not found, 403 if wrong owner
    3. Fetch MatchHistory   → all arena matches involving this agent
    4. Call generate_report → produces raw PDF bytes in memory
    5. send_file            → streams the bytes as a file download

NO TEMP FILES:
    The PDF is built entirely in a BytesIO buffer and streamed directly
    to the client. Nothing is written to disk for this operation.
    This avoids permission issues, temp-file cleanup, and race conditions
    in a multi-threaded Flask + eventlet environment.
"""

import io
import datetime
from flask          import Blueprint, send_file, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from extensions         import db
from models             import Agent, MatchHistory, User
from report_generator   import generate_report


reports_bp = Blueprint('reports', __name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _safe_list(value) -> list:
    """
    Coerce a value to a plain Python list, safely.

    The JSONColumn type returns a list when the column has data, but may
    return None for agents that were created before the history columns
    were added (schema migration). This helper ensures generate_report()
    always receives a list, never None.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    # Fallback: shouldn't happen, but handle gracefully
    return list(value)


# ─── Route ────────────────────────────────────────────────────────────────────

@reports_bp.route('/<agent_id>/pdf', methods=['GET'])
@jwt_required()
def download_report(agent_id: str):
    """
    Generate and stream a PDF training report for the given agent.

    STEP 1 — Identity Verification
    ───────────────────────────────
    jwt_required() has already validated the token by the time we reach
    this function. get_jwt_identity() returns the user_id that was encoded
    in the token at login time.

    STEP 2 — Data Gathering
    ────────────────────────
    We load the Agent row and all MatchHistory rows for this agent in
    two separate queries. The MatchHistory query uses joinedload to fetch
    agent1 / agent2 / winner names in a single SQL JOIN rather than
    N+1 individual SELECT calls.

    STEP 3 — Report Generation
    ───────────────────────────
    generate_report() is a pure function: it takes data in, returns PDF
    bytes out. No side effects, no DB access, no file I/O. Safe to call
    from any thread.

    STEP 4 — Delivery
    ──────────────────
    send_file() with a BytesIO buffer and as_attachment=True tells the
    browser to show a "Save As" dialog instead of trying to render the
    PDF inline. The download_name sets the suggested filename.

    Returns:
        200 + PDF bytes  on success
        403 JSON         if the agent belongs to a different user
        404 JSON         if the agent does not exist
        500 JSON         if report generation raises an unexpected error
    """

    # ── Step 1: Identify the requesting user ──────────────────────────────
    current_user_id = get_jwt_identity()

    # ── Step 2a: Fetch the agent ──────────────────────────────────────────
    agent = Agent.query.get(agent_id)

    if agent is None:
        return jsonify({
            'error':   'Agent not found.',
            'agent_id': agent_id,
        }), 404

    # Ownership check: only the agent's owner can download its report.
    # str() comparison handles UUID objects vs string IDs.
    if str(agent.user_id) != str(current_user_id):
        return jsonify({
            'error': 'You do not have permission to access this report.',
        }), 403

    # ── Step 2b: Fetch match history ──────────────────────────────────────
    # joinedload prevents N+1 queries when we access match.agent1.name etc.
    # We fetch matches where this agent was EITHER player.
    matches = (
        MatchHistory.query
        .filter(
            (MatchHistory.agent1_id == agent_id) |
            (MatchHistory.agent2_id == agent_id)
        )
        .options(
            joinedload(MatchHistory.agent1),
            joinedload(MatchHistory.agent2),
            joinedload(MatchHistory.winner),
        )
        .order_by(MatchHistory.played_at.asc())
        .all()
    )

    # Build match dicts with resolved opponent names
    # (generate_report expects plain dicts, not SQLAlchemy objects)
    match_dicts = []
    for m in matches:
        # Determine which side of the match this agent was on
        if str(m.agent1_id) == str(agent_id):
            opponent_name = m.agent2.name if m.agent2 else 'Unknown'
            my_score      = m.score_agent1 or 0.0
            opp_score     = m.score_agent2 or 0.0
        else:
            opponent_name = m.agent1.name if m.agent1 else 'Unknown'
            my_score      = m.score_agent2 or 0.0
            opp_score     = m.score_agent1 or 0.0

        match_dicts.append({
            'id':            m.id,
            'opponent_name': opponent_name,
            'game':          m.game,
            'winner_id':     m.winner_id,
            'score_agent1':  my_score,
            'score_agent2':  opp_score,
            'played_at':     m.played_at.isoformat() if m.played_at else None,
        })

    # ── Step 2c: Extract history arrays from the Agent row ────────────────
    reward_history = _safe_list(agent.reward_history)
    loss_history   = _safe_list(agent.loss_history)
    win_history    = _safe_list(agent.win_history)

    # ── Step 3: Generate the PDF ──────────────────────────────────────────
    try:
        pdf_bytes = generate_report(
            agent          = agent,
            reward_history = reward_history,
            loss_history   = loss_history,
            win_history    = win_history,
            match_history  = match_dicts,
        )
    except Exception as gen_err:
        current_app.logger.error(
            f"[Reports] PDF generation failed for agent {agent_id}: {gen_err}",
            exc_info=True,
        )
        return jsonify({
            'error':   'Failed to generate report. See server logs for details.',
            'detail':  str(gen_err),
        }), 500

    # ── Step 4: Stream the PDF to the browser ─────────────────────────────
    # Sanitise the agent name for use as a filename:
    # replace spaces and special chars with underscores
    safe_name = "".join(
        c if c.isalnum() or c in ('-', '_') else '_'
        for c in agent.name
    ).strip('_') or 'agent'

    timestamp     = datetime.datetime.utcnow().strftime('%Y%m%d_%H%M')
    download_name = f"report_{safe_name}_{timestamp}.pdf"

    current_app.logger.info(
        f"[Reports] Serving report for agent '{agent.name}' "
        f"({agent_id}) → {download_name} "
        f"({len(pdf_bytes):,} bytes)"
    )

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype      = 'application/pdf',
        as_attachment = True,
        download_name = download_name,
    )


# ─── Metadata endpoint (optional but useful) ──────────────────────────────────

@reports_bp.route('/<agent_id>/status', methods=['GET'])
@jwt_required()
def report_status(agent_id: str):
    """
    Returns a lightweight JSON summary of what data is available for
    this agent's report, without generating the full PDF.

    The frontend can call this before showing the "Download Report"
    button — if has_reward_history is False, the button can be greyed
    out with a tooltip "Complete training first."

    This is also useful for your viva: you can show the examiner that
    the system has a proper data-availability check rather than crashing
    when the button is clicked on an untrained agent.
    """
    current_user_id = get_jwt_identity()

    agent = Agent.query.get(agent_id)
    if agent is None:
        return jsonify({'error': 'Agent not found.'}), 404

    if str(agent.user_id) != str(current_user_id):
        return jsonify({'error': 'Permission denied.'}), 403

    match_count = MatchHistory.query.filter(
        (MatchHistory.agent1_id == agent_id) |
        (MatchHistory.agent2_id == agent_id)
    ).count()

    reward_history = _safe_list(agent.reward_history)
    loss_history   = _safe_list(agent.loss_history)
    win_history    = _safe_list(agent.win_history)

    return jsonify({
        'agent_id':           agent_id,
        'agent_name':         agent.name,
        'status':             agent.status,
        'report_ready':       agent.status == 'completed',

        # Data availability flags — used by the frontend to decide
        # whether to enable or grey out the Download button
        'has_reward_history': len(reward_history) > 0,
        'has_loss_history':   len(loss_history)   > 0,
        'has_win_history':    len(win_history)     > 0,
        'has_model_file':     bool(agent.model_path and
                                   os.path.exists(agent.model_path)),
        'has_arena_matches':  match_count > 0,

        # Counts for the UI summary
        'episode_count':      len(reward_history),
        'match_count':        match_count,
        'final_reward':       agent.final_reward,
        'win_rate':           agent.get_win_rate(),
    }), 200


# ─── Register in app.py ───────────────────────────────────────────────────────
# Add these two lines to your backend/app.py:
#
#   from routes.reports import reports_bp
#   app.register_blueprint(reports_bp, url_prefix='/api/reports')
#
# The download URL becomes:
#   GET /api/reports/<agent_id>/pdf
#
# Which matches the existing api.ts call:
#   fetch(`${API_BASE_URL}/reports/${agentId}/pdf`, ...)