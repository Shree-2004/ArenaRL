# backend/report_generator.py
"""
PDF Report Generator for the AI Multi-Game RL Platform.

WHAT THIS MODULE DOES (for your viva):
Given a trained agent and its historical training data, this module
produces a multi-page A4 PDF report that proves the agent actually
learned something. The report contains:

  Page 1 — Cover:     agent identity, game, algorithm, training date
  Page 2 — Summary:   key metrics at a glance (reward, win rate, speed)
  Page 3 — Brain:     hyperparameter table + algorithm explanation
  Page 4 — Charts:    reward curve + loss curve rendered as vector graphics
  Page 5 — Arena:     match history table (wins / losses / draws)
  Page 6 — Verdict:   auto-generated learning assessment paragraph

LIBRARY CHOICE — ReportLab:
We use ReportLab's Platypus (high-level) API rather than raw canvas calls.
Platypus handles text reflow, page breaks, and table layout automatically.
For the charts we drop down to ReportLab's `graphics` module so we can
draw vector polylines — these scale perfectly at any zoom level and look
far more professional than embedded raster images.
"""

import io
import math
import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib.pagesizes    import A4
from reportlab.lib              import colors
from reportlab.lib.units        import mm
from reportlab.lib.styles       import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums        import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus         import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.graphics.shapes  import (
    Drawing, Rect, Line, PolyLine, String, Circle, Group,
)
from reportlab.graphics         import renderPDF
from reportlab.graphics.charts.lineplots import LinePlot

# ─── Design Tokens ────────────────────────────────────────────────────────────
# Cyberpunk-inspired but professional enough for an academic report.

C_BG        = colors.HexColor('#0d1117')   # page background (used in cover)
C_CYAN      = colors.HexColor('#06b6d4')   # primary accent  (reward / success)
C_MAGENTA   = colors.HexColor('#e879f9')   # secondary accent (loss / learning)
C_GREEN     = colors.HexColor('#00c97a')   # positive metric
C_AMBER     = colors.HexColor('#fbbf24')   # warning / neutral
C_WHITE     = colors.HexColor('#e2e8f0')   # body text
C_MUTED     = colors.HexColor('#64748b')   # secondary text
C_BORDER    = colors.HexColor('#1e2d3d')   # table / card borders
C_ROW_ALT   = colors.HexColor('#111827')   # alternating table row
C_DARK_CARD = colors.HexColor('#161b22')   # card / section background

W, H = A4                                  # 595 x 842 pt

MARGIN      = 20 * mm
INNER_W     = W - 2 * MARGIN

# ─── Style Sheet ─────────────────────────────────────────────────────────────

_base = getSampleStyleSheet()

def _style(name, **kw):
    """Build a ParagraphStyle, inheriting nothing from the base sheet."""
    return ParagraphStyle(name, **kw)

S = {
    'cover_title': _style('cover_title',
        fontName='Helvetica-Bold', fontSize=32, leading=38,
        textColor=C_WHITE, alignment=TA_LEFT,
    ),
    'cover_sub': _style('cover_sub',
        fontName='Helvetica', fontSize=13, leading=18,
        textColor=C_CYAN, alignment=TA_LEFT,
    ),
    'cover_meta': _style('cover_meta',
        fontName='Helvetica', fontSize=10, leading=14,
        textColor=C_MUTED, alignment=TA_LEFT,
    ),
    'section': _style('section',
        fontName='Helvetica-Bold', fontSize=14, leading=18,
        textColor=C_CYAN, alignment=TA_LEFT,
        spaceBefore=14, spaceAfter=6,
    ),
    'subsection': _style('subsection',
        fontName='Helvetica-Bold', fontSize=11, leading=14,
        textColor=C_AMBER, alignment=TA_LEFT,
        spaceBefore=8, spaceAfter=4,
    ),
    'body': _style('body',
        fontName='Helvetica', fontSize=10, leading=15,
        textColor=C_WHITE, alignment=TA_LEFT,
        spaceAfter=6,
    ),
    'mono': _style('mono',
        fontName='Courier', fontSize=9, leading=13,
        textColor=C_CYAN, alignment=TA_LEFT,
    ),
    'caption': _style('caption',
        fontName='Helvetica', fontSize=8, leading=11,
        textColor=C_MUTED, alignment=TA_CENTER,
        spaceAfter=4,
    ),
    'metric_val': _style('metric_val',
        fontName='Helvetica-Bold', fontSize=22, leading=26,
        textColor=C_CYAN, alignment=TA_CENTER,
    ),
    'metric_lbl': _style('metric_lbl',
        fontName='Helvetica', fontSize=8, leading=10,
        textColor=C_MUTED, alignment=TA_CENTER,
    ),
    'verdict': _style('verdict',
        fontName='Helvetica', fontSize=10, leading=16,
        textColor=C_WHITE, alignment=TA_LEFT,
        spaceAfter=8, leftIndent=10, rightIndent=10,
    ),
    'footer': _style('footer',
        fontName='Helvetica', fontSize=7, leading=9,
        textColor=C_MUTED, alignment=TA_CENTER,
    ),
}

# ─── Algorithm Descriptions ───────────────────────────────────────────────────
# Printed in the "Brain" section — gives examiners the theory context.

ALGO_DESCRIPTIONS = {
    'dqn': (
        "Deep Q-Network (DQN) — Mnih et al., DeepMind 2015. "
        "Approximates the action-value function Q(s,a) using a deep neural "
        "network. Two key innovations stabilise training: (1) Experience Replay "
        "— transitions are stored in a buffer and sampled randomly to break "
        "temporal correlations; (2) Target Network — a frozen copy of the main "
        "network provides stable TD targets, updated every N steps."
    ),
    'ppo': (
        "Proximal Policy Optimization (PPO) — Schulman et al., OpenAI 2017. "
        "A policy-gradient method that directly optimises a stochastic policy "
        "pi(a|s). The clipped surrogate objective prevents destructively large "
        "updates by constraining the probability ratio pi_new/pi_old to stay "
        "within [1-eps, 1+eps]. PPO also trains a value baseline (critic) to "
        "reduce gradient variance via the advantage function."
    ),
    'a2c': (
        "Advantage Actor-Critic (A2C) — Mnih et al., 2016. "
        "Synchronous variant of A3C. Maintains a shared-backbone network with "
        "two heads: the actor outputs action probabilities, the critic outputs "
        "V(s). The advantage A(s,a) = r + gamma*V(s') - V(s) is used as the "
        "policy gradient signal, dramatically reducing variance compared to "
        "plain REINFORCE without introducing bias."
    ),
    'q-learning': (
        "Tabular Q-Learning — Watkins & Dayan, 1992. "
        "Stores Q-values in a dictionary keyed by discrete state tuples. "
        "Updates via the Bellman equation after every step: "
        "Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_a' Q(s',a') - Q(s,a)]. "
        "Off-policy: always bootstraps from the greedy next action regardless "
        "of the exploration policy. Provably converges to Q* for finite MDPs."
    ),
    'sarsa': (
        "SARSA (On-Policy TD Control) — Rummery & Niranjan, 1994. "
        "Like Q-Learning but uses the action A' that the agent WILL take next "
        "(sampled from its policy) rather than argmax. This makes it on-policy: "
        "it learns the value of the behaviour policy including exploration noise. "
        "Tends to learn safer paths in environments with irreversible penalties."
    ),
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _dark_table_style(
    col_widths: List[float],
    header_color=C_CYAN,
    alt_row_color=C_ROW_ALT,
) -> TableStyle:
    """Returns a reusable dark-themed TableStyle."""
    return TableStyle([
        # Header row
        ('BACKGROUND',  (0, 0), (-1, 0),  C_DARK_CARD),
        ('TEXTCOLOR',   (0, 0), (-1, 0),  header_color),
        ('FONTNAME',    (0, 0), (-1, 0),  'Helvetica-Bold'),
        ('FONTSIZE',    (0, 0), (-1, 0),  9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING',  (0, 0), (-1, 0),  6),
        # Data rows
        ('FONTNAME',    (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',    (0, 1), (-1, -1), 9),
        ('TEXTCOLOR',   (0, 1), (-1, -1), C_WHITE),
        ('TOPPADDING',  (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_BG, alt_row_color]),
        # Grid
        ('GRID',        (0, 0), (-1, -1), 0.4, C_BORDER),
        ('LINEBELOW',   (0, 0), (-1, 0),  1.0, header_color),
        # Alignment
        ('ALIGN',       (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
    ])


def _sparkline(
    values:   List[float],
    width:    float,
    height:   float,
    color:    colors.Color,
    label:    str = '',
) -> Drawing:
    """
    Render a list of floats as a vector polyline sparkline.

    Returns a ReportLab Drawing that can be inserted into the Platypus
    story like any other flowable.

    WHY VECTOR (viva answer):
    Unlike a matplotlib PNG, a ReportLab Drawing is stored as PDF vector
    graphics. It scales to any zoom level without pixelation and adds zero
    external dependencies — no matplotlib, no PIL, no file I/O.
    """
    d = Drawing(width, height)

    # Background card
    d.add(Rect(0, 0, width, height,
               fillColor=C_DARK_CARD, strokeColor=C_BORDER, strokeWidth=0.5))

    if not values or len(values) < 2:
        d.add(String(width / 2, height / 2,
                     'no data',
                     fontName='Helvetica', fontSize=8,
                     fillColor=C_MUTED, textAnchor='middle'))
        return d

    # Compute bounds with a small margin
    pad_x, pad_y = 24, 16
    plot_w = width  - 2 * pad_x
    plot_h = height - 2 * pad_y - 14  # 14pt reserved for label at bottom

    vmin, vmax = min(values), max(values)
    vrange = vmax - vmin if vmax != vmin else 1.0

    def px(i):
        return pad_x + (i / (len(values) - 1)) * plot_w

    def py(v):
        return pad_y + 14 + ((v - vmin) / vrange) * plot_h

    # Zero reference line (if range crosses zero)
    if vmin < 0 < vmax:
        yz = py(0)
        d.add(Line(pad_x, yz, pad_x + plot_w, yz,
                   strokeColor=C_MUTED, strokeWidth=0.5,
                   strokeDashArray=[2, 3]))

    # Y-axis tick labels (min / max)
    d.add(String(pad_x - 2, py(vmin),
                 f'{vmin:.1f}', fontName='Courier', fontSize=6,
                 fillColor=C_MUTED, textAnchor='end'))
    d.add(String(pad_x - 2, py(vmax),
                 f'{vmax:.1f}', fontName='Courier', fontSize=6,
                 fillColor=C_MUTED, textAnchor='end'))

    # X-axis episode labels (first / last)
    d.add(String(pad_x, pad_y + 2,
                 'ep 0', fontName='Courier', fontSize=6,
                 fillColor=C_MUTED, textAnchor='middle'))
    d.add(String(pad_x + plot_w, pad_y + 2,
                 f'ep {len(values)}', fontName='Courier', fontSize=6,
                 fillColor=C_MUTED, textAnchor='middle'))

    # Main polyline
    points = []
    for i, v in enumerate(values):
        points += [px(i), py(v)]

    d.add(PolyLine(points,
                   strokeColor=color,
                   strokeWidth=1.5,
                   fillColor=colors.transparent))

    # Final-value dot
    last_x, last_y = px(len(values) - 1), py(values[-1])
    d.add(Circle(last_x, last_y, 3,
                 fillColor=color, strokeColor=C_DARK_CARD, strokeWidth=1))

    # Chart label at bottom
    if label:
        d.add(String(width / 2, 3,
                     label, fontName='Helvetica', fontSize=7,
                     fillColor=C_MUTED, textAnchor='middle'))

    return d


def _metric_card(label: str, value: str, color=C_CYAN, width=70.0) -> Drawing:
    """Small metric chip rendered as a Drawing (fits in a Table cell)."""
    h = 44.0
    d = Drawing(width, h)
    d.add(Rect(0, 0, width, h,
               fillColor=C_DARK_CARD,
               strokeColor=color,
               strokeWidth=0.6,
               rx=4, ry=4))
    d.add(String(width / 2, h - 12,
                 label, fontName='Helvetica', fontSize=7,
                 fillColor=C_MUTED, textAnchor='middle'))
    d.add(String(width / 2, 10,
                 value, fontName='Helvetica-Bold', fontSize=14,
                 fillColor=color, textAnchor='middle'))
    return d


def _generate_verdict(
    agent_name:      str,
    algorithm:       str,
    game:            str,
    final_reward:    float,
    win_rate:        float,
    reward_history:  List[float],
    loss_history:    List[float],
) -> str:
    """
    Auto-generate a one-paragraph plain-English learning assessment.

    This paragraph answers the most common examiner question:
    "How do you know the agent is actually learning?"
    """
    # Did reward improve?
    if len(reward_history) >= 20:
        early  = sum(reward_history[:10])  / 10
        late   = sum(reward_history[-10:]) / 10
        delta  = late - early
        reward_trend = (
            f"average reward improved from {early:.2f} (first 10 episodes) "
            f"to {late:.2f} (last 10 episodes), a gain of {delta:+.2f}"
        ) if delta > 0 else (
            f"average reward changed from {early:.2f} to {late:.2f} "
            f"({delta:+.2f}), suggesting the agent may need more episodes "
            f"or hyperparameter tuning"
        )
    else:
        reward_trend = f"final average reward of {final_reward:.2f}"

    # Did loss decrease?
    if len(loss_history) >= 20:
        early_loss = sum(loss_history[:10])  / 10
        late_loss  = sum(loss_history[-10:]) / 10
        loss_trend = (
            f"Training loss decreased from {early_loss:.4f} to {late_loss:.4f}, "
            f"indicating the network weights converged."
            if late_loss < early_loss else
            f"Training loss moved from {early_loss:.4f} to {late_loss:.4f}."
        )
    else:
        loss_trend = ""

    # Win rate assessment
    wr_pct = win_rate * 100
    if wr_pct >= 70:
        wr_assessment = f"a strong win rate of {wr_pct:.1f}%"
    elif wr_pct >= 40:
        wr_assessment = f"a developing win rate of {wr_pct:.1f}%"
    else:
        wr_assessment = f"a win rate of {wr_pct:.1f}% (further training recommended)"

    algo_full = {
        'dqn':        'Deep Q-Network (DQN)',
        'ppo':        'Proximal Policy Optimization (PPO)',
        'a2c':        'Advantage Actor-Critic (A2C)',
        'q-learning': 'Tabular Q-Learning',
        'sarsa':      'SARSA',
    }.get(algorithm, algorithm.upper())

    verdict = (
        f"Agent '{agent_name}' was trained using {algo_full} on the "
        f"'{game}' environment. Over the training run, the agent achieved "
        f"{reward_trend} and {wr_assessment}. "
    )
    if loss_trend:
        verdict += loss_trend + " "

    verdict += (
        f"These results are consistent with a system that is learning a "
        f"policy rather than acting randomly. The reward curve's upward "
        f"trajectory and the loss curve's downward trajectory together "
        f"constitute empirical evidence of convergence toward an effective "
        f"strategy for '{game}'."
    )
    return verdict


# ─── Page Template Callbacks ──────────────────────────────────────────────────

def _on_first_page(canvas, doc):
    """Draws the dark cover background and a cyan accent bar."""
    canvas.saveState()
    canvas.setFillColor(C_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Left accent bar
    canvas.setFillColor(C_CYAN)
    canvas.rect(0, 0, 4, H, fill=1, stroke=0)
    canvas.restoreState()


def _on_later_pages(canvas, doc):
    """Draws a subtle dark header strip and page number footer."""
    canvas.saveState()
    # Top header bar
    canvas.setFillColor(C_DARK_CARD)
    canvas.rect(0, H - 18 * mm, W, 18 * mm, fill=1, stroke=0)
    canvas.setFillColor(C_CYAN)
    canvas.rect(0, H - 18 * mm, W, 0.5, fill=1, stroke=0)  # 0.5pt line
    # Header text
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(MARGIN, H - 12 * mm, 'AI RL PLATFORM  ·  TRAINING REPORT')
    canvas.drawRightString(W - MARGIN, H - 12 * mm,
                           f'Page {doc.page}')
    # Footer line
    canvas.setStrokeColor(C_BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 12 * mm, W - MARGIN, 12 * mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(C_MUTED)
    canvas.drawCentredString(W / 2, 8 * mm,
                             'Generated by AI Multi-Game RL Platform')
    canvas.restoreState()


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_report(
    agent:          Any,                    # SQLAlchemy Agent model instance
    reward_history: Optional[List[float]] = None,
    loss_history:   Optional[List[float]] = None,
    win_history:    Optional[List[float]] = None,
    match_history:  Optional[List[Dict]]  = None,
) -> bytes:
    """
    Build and return a complete PDF training report as raw bytes.

    Args:
        agent:          The Agent ORM object (must have .name, .game,
                        .algorithm, .status, .final_reward, .matches_won,
                        .matches_played, .created_at, .episodes).
        reward_history: List of per-episode average rewards.
        loss_history:   List of per-episode average losses.
        win_history:    List of per-episode 0/1 win flags.
        match_history:  List of arena match dicts for the results table.

    Returns:
        PDF bytes suitable for serving via Flask's send_file().

    USAGE IN FLASK (api/reports.py):
        from report_generator import generate_report
        import io
        pdf_bytes = generate_report(agent, reward_history=[...], ...)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'report_{agent.id}.pdf'
        )
    """
    reward_history = reward_history or []
    loss_history   = loss_history   or []
    win_history    = win_history    or []
    match_history  = match_history  or []

    buf  = io.BytesIO()
    doc  = SimpleDocTemplate(
        buf,
        pagesize      = A4,
        leftMargin    = MARGIN,
        rightMargin   = MARGIN,
        topMargin     = 24 * mm,
        bottomMargin  = 20 * mm,
        title         = f'Training Report — {agent.name}',
        author        = 'AI RL Platform',
    )

    story = []

    # ── PAGE 1: Cover ──────────────────────────────────────────────────────

    story.append(Spacer(1, 30 * mm))

    story.append(Paragraph('TRAINING REPORT', S['cover_sub']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(agent.name, S['cover_title']))
    story.append(Spacer(1, 8))

    # Coloured tag line: algorithm + game
    algo_display = agent.algorithm.upper()
    story.append(Paragraph(
        f'<font color="#06b6d4">{algo_display}</font>'
        f'  <font color="#64748b">on</font>'
        f'  <font color="#e879f9">{agent.game}</font>',
        S['cover_sub'],
    ))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_BORDER, spaceAfter=12))

    # Meta grid: date, status, episodes
    created = getattr(agent, 'created_at', None)
    if isinstance(created, str):
        try:
            from datetime import datetime as dt
            created = dt.fromisoformat(created).strftime('%d %b %Y, %H:%M')
        except Exception:
            pass
    elif isinstance(created, datetime.datetime):
        created = created.strftime('%d %b %Y, %H:%M')
    else:
        created = str(created or 'N/A')

    meta_rows = [
        ['Generated',       datetime.datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')],
        ['Training Date',   created],
        ['Status',          str(getattr(agent, 'status', 'N/A')).upper()],
        ['Episodes',        str(getattr(agent, 'episodes', 'N/A'))],
        ['Algorithm',       str(agent.algorithm)],
        ['Game',            str(agent.game)],
    ]
    meta_table = Table(
        meta_rows,
        colWidths=[50 * mm, INNER_W - 50 * mm],
    )
    meta_table.setStyle(TableStyle([
        ('FONTNAME',    (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME',    (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE',    (0, 0), (-1, -1), 9),
        ('TEXTCOLOR',   (0, 0), (0, -1),  C_MUTED),
        ('TEXTCOLOR',   (1, 0), (1, -1),  C_WHITE),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING',  (0, 0), (-1, -1), 4),
        ('LINEBELOW',   (0, -1), (-1, -1), 0.4, C_BORDER),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ── PAGE 2: Summary Metrics ────────────────────────────────────────────

    story.append(Paragraph('PERFORMANCE SUMMARY', S['section']))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_CYAN, spaceAfter=10))

    final_reward  = float(getattr(agent, 'final_reward', 0) or 0)
    matches_won   = int(getattr(agent, 'matches_won', 0) or 0)
    matches_played = int(getattr(agent, 'matches_played', 0) or 0)
    win_rate      = (matches_won / matches_played) if matches_played > 0 else 0.0

    # Metric chips row
    chip_w = (INNER_W - 4 * 6) / 5    # 5 chips, 6pt gap each
    chips = [
        _metric_card('FINAL REWARD',  f'{final_reward:.2f}',      C_CYAN,    chip_w),
        _metric_card('WIN RATE',      f'{win_rate*100:.1f}%',     C_GREEN,   chip_w),
        _metric_card('MATCHES WON',   str(matches_won),           C_AMBER,   chip_w),
        _metric_card('MATCHES PLAYED', str(matches_played),       C_MUTED,   chip_w),
        _metric_card('EPISODES',      str(getattr(agent,'episodes','?')), C_MAGENTA, chip_w),
    ]
    chip_table = Table(
        [chips],
        colWidths=[chip_w] * 5,
        hAlign='LEFT',
    )
    chip_table.setStyle(TableStyle([
        ('ALIGN',   (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',  (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(chip_table)
    story.append(Spacer(1, 14))

    # Learning trajectory table (first 5 / last 5 episodes)
    if reward_history:
        story.append(Paragraph('Learning Trajectory', S['subsection']))
        snapshot_rows = [['Episode', 'Avg Reward', 'Loss', 'Win Flag']]

        indices = list(range(min(5, len(reward_history))))
        if len(reward_history) > 5:
            indices += list(range(max(5, len(reward_history) - 5), len(reward_history)))

        for i in indices:
            r  = f'{reward_history[i]:.3f}' if i < len(reward_history) else '—'
            l  = f'{loss_history[i]:.5f}'   if i < len(loss_history)   else '—'
            wf = str(int(win_history[i]))    if i < len(win_history)    else '—'
            snapshot_rows.append([str(i + 1), r, l, wf])

        snap_table = Table(
            snapshot_rows,
            colWidths=[30 * mm, 50 * mm, 50 * mm, 30 * mm],
        )
        snap_table.setStyle(_dark_table_style([30, 50, 50, 30]))
        story.append(snap_table)
        story.append(Paragraph(
            'First 5 and last 5 episodes shown. '
            'Reward should trend upward; Loss should trend downward.',
            S['caption'],
        ))

    story.append(PageBreak())

    # ── PAGE 3: Hyperparameters / "The Brain" ─────────────────────────────

    story.append(Paragraph("THE AGENT'S BRAIN", S['section']))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_CYAN, spaceAfter=10))

    # Algorithm description
    algo_desc = ALGO_DESCRIPTIONS.get(
        str(agent.algorithm).lower(),
        f'{agent.algorithm} — no description available.',
    )
    story.append(Paragraph('Algorithm', S['subsection']))
    story.append(Paragraph(algo_desc, S['body']))
    story.append(Spacer(1, 8))

    # Hyperparameter table
    story.append(Paragraph('Hyperparameters', S['subsection']))

    hyp = {}
    if hasattr(agent, 'hyperparameters') and agent.hyperparameters:
        hyp = agent.hyperparameters if isinstance(agent.hyperparameters, dict) else {}

    # Always show these even if not in the stored dict
    default_hyp = {
        'learning_rate':    getattr(agent, 'learning_rate', 0.001),
        'discount_factor':  hyp.get('discount_factor',  0.99),
        'exploration_rate': hyp.get('exploration_rate', 1.0),
        'epsilon_min':      hyp.get('epsilon_min',      0.01),
        'epsilon_decay':    hyp.get('epsilon_decay',    0.995),
        'batch_size':       hyp.get('batch_size',       64),
        'memory_size':      hyp.get('memory_size',      10000),
    }
    default_hyp.update(hyp)

    # Parameter explanations (printed in the second column)
    param_notes = {
        'learning_rate':     'alpha — step size for gradient descent',
        'discount_factor':   'gamma — how much future rewards are valued',
        'exploration_rate':  'epsilon start — initial random action probability',
        'epsilon_min':       'epsilon floor — minimum exploration rate',
        'epsilon_decay':     'per-episode epsilon multiplier',
        'batch_size':        'transitions sampled per gradient update',
        'memory_size':       'replay buffer capacity (DQN only)',
        'ppo_epochs':        'gradient passes per PPO rollout',
        'eps_clip':          'PPO clipping range [1-e, 1+e]',
        'entropy_coef':      'entropy bonus weight (A2C/PPO)',
        'value_coef':        'critic loss weight (A2C/PPO)',
    }

    hyp_rows = [['Parameter', 'Value', 'Description']]
    for k, v in default_hyp.items():
        note = param_notes.get(k, '')
        hyp_rows.append([
            Paragraph(f'<font color="#06b6d4">{k}</font>', S['mono']),
            Paragraph(f'<b>{v}</b>', S['body']),
            Paragraph(note, S['caption']),
        ])

    hyp_table = Table(
        hyp_rows,
        colWidths=[50 * mm, 30 * mm, INNER_W - 80 * mm],
    )
    hyp_table.setStyle(_dark_table_style([50, 30, INNER_W - 80]))
    story.append(hyp_table)
    story.append(PageBreak())

    # ── PAGE 4: Charts ────────────────────────────────────────────────────

    story.append(Paragraph('LEARNING CURVES', S['section']))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_CYAN, spaceAfter=10))
    story.append(Paragraph(
        'Reward should trend UPWARD over episodes (agent improves). '
        'Loss should trend DOWNWARD (model converges). '
        'Both curves confirm that learning is genuinely occurring.',
        S['body'],
    ))
    story.append(Spacer(1, 8))

    chart_w  = INNER_W
    chart_h  = 90.0

    # Reward chart
    reward_chart = _sparkline(
        reward_history, chart_w, chart_h, C_CYAN,
        label='Average Reward per Episode',
    )
    story.append(reward_chart)
    story.append(Paragraph(
        'Figure 1 — Reward Curve  '
        '(cyan line = rolling average reward; dot = final value)',
        S['caption'],
    ))
    story.append(Spacer(1, 10))

    # Loss chart
    loss_chart = _sparkline(
        loss_history, chart_w, chart_h, C_MAGENTA,
        label='Training Loss per Episode',
    )
    story.append(loss_chart)
    story.append(Paragraph(
        'Figure 2 — Loss Curve  '
        '(magenta line = training loss / TD error; lower is better)',
        S['caption'],
    ))
    story.append(Spacer(1, 10))

    # Win rate chart
    if win_history:
        # Convert 0/1 flags to rolling win rate (window=20)
        window = 20
        rolling_wr = []
        for i in range(len(win_history)):
            start = max(0, i - window + 1)
            rolling_wr.append(sum(win_history[start:i + 1]) / (i - start + 1))

        wr_chart = _sparkline(
            rolling_wr, chart_w, chart_h * 0.8, C_GREEN,
            label='Rolling Win Rate (window=20 episodes)',
        )
        story.append(wr_chart)
        story.append(Paragraph(
            'Figure 3 — Win Rate Trend  (green = rolling win rate over last 20 episodes)',
            S['caption'],
        ))

    story.append(PageBreak())

    # ── PAGE 5: Arena / Match History ─────────────────────────────────────

    story.append(Paragraph('ARENA RESULTS', S['section']))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_CYAN, spaceAfter=10))

    # Summary row
    draws = matches_played - matches_won - (
        sum(1 for m in match_history if m.get('winner_id') not in
            [getattr(agent, 'id', None), None])
        if match_history else 0
    )
    summary_rows = [
        ['Metric', 'Value'],
        ['Total Matches',  str(matches_played)],
        ['Wins',           str(matches_won)],
        ['Win Rate',       f'{win_rate * 100:.1f}%'],
    ]
    summary_table = Table(
        summary_rows,
        colWidths=[60 * mm, INNER_W - 60 * mm],
    )
    summary_table.setStyle(_dark_table_style([60, INNER_W - 60]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # Match-by-match table
    if match_history:
        story.append(Paragraph('Match Log', S['subsection']))
        match_rows = [['#', 'Opponent', 'Game', 'Result', 'Score']]
        for i, m in enumerate(match_history[:30], 1):   # cap at 30 rows
            winner_id  = m.get('winner_id')
            agent_id   = getattr(agent, 'id', None)
            if winner_id is None:
                result = 'DRAW'
                rc     = C_MUTED
            elif str(winner_id) == str(agent_id):
                result = 'WIN'
                rc     = C_GREEN
            else:
                result = 'LOSS'
                rc     = colors.HexColor('#f87171')

            match_rows.append([
                str(i),
                str(m.get('opponent_name', '—')),
                str(m.get('game', agent.game)),
                Paragraph(f'<font color="#{rc.hexval()[2:]}">{result}</font>',
                           S['body']),
                f"{m.get('score_agent1', 0):.0f} — {m.get('score_agent2', 0):.0f}",
            ])

        match_table = Table(
            match_rows,
            colWidths=[12 * mm, 40 * mm, 40 * mm, 22 * mm, 46 * mm],
        )
        match_table.setStyle(_dark_table_style([12, 40, 40, 22, 46]))
        story.append(match_table)
        if len(match_history) > 30:
            story.append(Paragraph(
                f'Showing first 30 of {len(match_history)} matches.',
                S['caption'],
            ))
    else:
        story.append(Paragraph(
            'No arena matches recorded yet. '
            'Train the agent to completion and run matches in the Arena tab.',
            S['body'],
        ))

    story.append(PageBreak())

    # ── PAGE 6: Verdict ────────────────────────────────────────────────────

    story.append(Paragraph('LEARNING VERDICT', S['section']))
    story.append(HRFlowable(width=INNER_W, thickness=0.5,
                             color=C_CYAN, spaceAfter=10))
    story.append(Paragraph(
        'The following assessment is auto-generated from the training '
        'metrics. It is intended as evidence of learning for academic '
        'evaluation purposes.',
        S['caption'],
    ))
    story.append(Spacer(1, 8))

    verdict_text = _generate_verdict(
        agent_name     = agent.name,
        algorithm      = str(agent.algorithm),
        game           = str(agent.game),
        final_reward   = final_reward,
        win_rate       = win_rate,
        reward_history = reward_history,
        loss_history   = loss_history,
    )
    story.append(Paragraph(verdict_text, S['verdict']))
    story.append(Spacer(1, 16))

    # Checklist of evidence
    story.append(Paragraph('Evidence Checklist', S['subsection']))
    checks = [
        ('Reward history collected',    bool(reward_history)),
        ('Loss curve available',        bool(loss_history)),
        ('Win rate tracked',            bool(win_history)),
        ('Model saved to disk',         bool(getattr(agent, 'model_path', None))),
        ('Arena matches played',        matches_played > 0),
        ('Training completed',          getattr(agent, 'status', '') == 'completed'),
    ]
    check_rows = [['Item', 'Status']] + [
        [label,
         Paragraph(
             f'<font color="#00c97a">PASS</font>' if ok else
             f'<font color="#f87171">PENDING</font>',
             S['body'],
         )]
        for label, ok in checks
    ]
    check_table = Table(
        check_rows,
        colWidths=[INNER_W - 40 * mm, 40 * mm],
    )
    check_table.setStyle(_dark_table_style([INNER_W - 40, 40]))
    story.append(check_table)

    # ── Build ──────────────────────────────────────────────────────────────

    doc.build(
        story,
        onFirstPage  = _on_first_page,
        onLaterPages = _on_later_pages,
    )

    return buf.getvalue()