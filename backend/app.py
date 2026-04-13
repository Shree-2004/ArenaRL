# backend/app.py

import eventlet
eventlet.monkey_patch()

import os
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from extensions import db, socketio

jwt     = JWTManager()
limiter = Limiter(
    key_func      = get_remote_address,
    default_limits = ["100 per minute"],
    storage_uri   = "memory://",
)


def create_app():
    app = Flask(__name__)

    # ── CORS ────────────────────────────────────────────────────────────────
    # Allow all origins on /api/* so the Vite dev server (port 5173) can
    # talk to Flask (port 5000) during local development.
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Configuration ────────────────────────────────────────────────────────
    app.config['SECRET_KEY']                  = os.environ.get('SECRET_KEY',     'x7_8a2k9_m3p5_v1q8_z9_w2_x1_y8_z3')
    app.config['JWT_SECRET_KEY']              = os.environ.get('JWT_SECRET_KEY', 'n9_b2_v7_c1_x8_z3_m5_p1_q9_w2_k8_l2')
    app.config['SQLALCHEMY_DATABASE_URI']     = os.environ.get('DATABASE_URL',   'sqlite:///aigameplatform.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # ── Extensions ───────────────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    socketio.init_app(app, async_mode='eventlet', cors_allowed_origins="*")

    # ── Socket.IO namespaces ─────────────────────────────────────────────────
    from sockets.handlers import TrainingNamespace, ArenaNamespace
    socketio.on_namespace(TrainingNamespace('/training'))
    socketio.on_namespace(ArenaNamespace('/arena'))

    # ── Blueprints ───────────────────────────────────────────────────────────
    from api.auth         import auth_bp
    from api.agents       import agents_bp
    from api.stats        import stats_bp
    from routes.reports   import reports_bp   # ← our new PDF report blueprint

    app.register_blueprint(auth_bp,     url_prefix='/api/auth')
    app.register_blueprint(agents_bp,   url_prefix='/api/agents')
    app.register_blueprint(stats_bp,    url_prefix='/api/stats')
    app.register_blueprint(reports_bp,  url_prefix='/api/reports')
    # NOTE: the old `from api.report import report_bp` line has been removed.
    # routes/reports.py is the single source of truth for /api/reports/* now.

    # ── Database ─────────────────────────────────────────────────────────────
    # db.create_all() creates any tables that don't exist yet.
    # It is safe to call on every startup — it never drops existing tables.
    # The three new JSONColumn history columns (reward_history, loss_history,
    # win_history) and the hyperparameters column will be created here on
    # first run after the models.py update.
    #
    # IMPORTANT FOR EXISTING DATABASES:
    # If you already have an aigameplatform.db file from before the models.py
    # update, db.create_all() will NOT add the new columns to existing tables.
    # In that case either:
    #   (a) delete the .db file and let it recreate (loses existing agents), or
    #   (b) run the migration snippet at the bottom of this file once.
    with app.app_context():
        db.create_all()

    return app


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, debug=True, port=5000)


# ── One-time migration helper (run manually if needed) ────────────────────────
#
# If your database already exists and is missing the new columns, run this
# once from a Python shell in your backend directory:
#
#   python3 - <<'EOF'
#   import sqlite3, os
#   db_path = os.path.join('instance', 'aigameplatform.db')
#   # Try the flat path if instance/ doesn't exist
#   if not os.path.exists(db_path):
#       db_path = 'aigameplatform.db'
#   con = sqlite3.connect(db_path)
#   cur = con.cursor()
#   migrations = [
#       "ALTER TABLE agent ADD COLUMN reward_history TEXT",
#       "ALTER TABLE agent ADD COLUMN loss_history   TEXT",
#       "ALTER TABLE agent ADD COLUMN win_history    TEXT",
#       "ALTER TABLE agent ADD COLUMN hyperparameters TEXT",
#       "ALTER TABLE agent ADD COLUMN completed_at  DATETIME",
#       "ALTER TABLE agent ADD COLUMN duration_seconds INTEGER",
#   ]
#   for sql in migrations:
#       try:
#           cur.execute(sql)
#           print(f"OK : {sql}")
#       except sqlite3.OperationalError as e:
#           print(f"SKIP (already exists?): {e}")
#   con.commit()
#   con.close()
#   print("Migration complete.")
#   EOF
#
# Each ALTER TABLE is wrapped in try/except so re-running it is safe.

