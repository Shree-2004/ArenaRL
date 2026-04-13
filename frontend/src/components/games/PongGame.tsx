import { useEffect, useRef, useCallback } from 'react';

interface PongGameProps {
    playerNumber?: 1 | 2;
    onGameEnd?: (score: number) => void;
    agentControlled?: boolean;
    isFullscreen?: boolean;
    autoStart?: boolean;
    onMove?: (reasoning: string) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 5;
const BALL_SPEED_INIT = 5;
const WIN_SCORE = 7;

interface GameState {
    ball: { x: number; y: number; vx: number; vy: number };
    p1: { y: number; score: number };
    p2: { y: number; score: number };
    running: boolean;
    winner: string | null;
}

export function PongGame({ playerNumber = 1, onGameEnd, agentControlled = false, isFullscreen = false, onMove }: PongGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<GameState>({
        ball: { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: BALL_SPEED_INIT, vy: BALL_SPEED_INIT },
        p1: { y: CANVAS_H / 2 - PADDLE_H / 2, score: 0 },
        p2: { y: CANVAS_H / 2 - PADDLE_H / 2, score: 0 },
        running: true,
        winner: null,
    });
    const keysRef = useRef<Set<string>>(new Set());
    const animRef = useRef<number | null>(null);

    const resetBall = (dir: 1 | -1) => {
        const angle = (Math.random() * 0.8 - 0.4); // ±0.4 rad
        stateRef.current.ball = {
            x: CANVAS_W / 2,
            y: CANVAS_H / 2,
            vx: dir * BALL_SPEED_INIT * Math.cos(angle),
            vy: BALL_SPEED_INIT * Math.sin(angle),
        };
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const s = stateRef.current;

        // Background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Center dashed line
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_W / 2, 0);
        ctx.lineTo(CANVAS_W / 2, CANVAS_H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Scores
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7c3aed88';
        ctx.fillText(String(s.p1.score), CANVAS_W / 4, 70);
        ctx.fillStyle = '#f97316aa';
        ctx.fillText(String(s.p2.score), (3 * CANVAS_W) / 4, 70);

        // Player 1 paddle (left) — agentX color: purple
        const p1Grd = ctx.createLinearGradient(18, s.p1.y, 18 + PADDLE_W, s.p1.y + PADDLE_H);
        p1Grd.addColorStop(0, '#7c3aed');
        p1Grd.addColorStop(1, '#a855f7');
        ctx.fillStyle = p1Grd;
        ctx.beginPath();
        ctx.roundRect(18, s.p1.y, PADDLE_W, PADDLE_H, 4);
        ctx.fill();

        // Player 2 paddle (right) — agentO color: orange
        const p2Grd = ctx.createLinearGradient(CANVAS_W - 18 - PADDLE_W, s.p2.y, CANVAS_W - 18, s.p2.y + PADDLE_H);
        p2Grd.addColorStop(0, '#f97316');
        p2Grd.addColorStop(1, '#fb923c');
        ctx.fillStyle = p2Grd;
        ctx.beginPath();
        ctx.roundRect(CANVAS_W - 18 - PADDLE_W, s.p2.y, PADDLE_W, PADDLE_H, 4);
        ctx.fill();

        // Ball with glow
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.ball.x, s.ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Winner overlay
        if (s.winner) {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            ctx.font = 'bold 52px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = s.winner === 'Player 1' ? '#a855f7' : '#f97316';
            ctx.fillText(`🏆 ${s.winner} Wins!`, CANVAS_W / 2, CANVAS_H / 2 - 20);
            ctx.font = '20px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText('Game Over', CANVAS_W / 2, CANVAS_H / 2 + 30);
        }
    }, []);

    const update = useCallback(() => {
        const s = stateRef.current;
        if (!s.running || s.winner) return;

        // Player 1 input (human when not agentControlled)
        if (!agentControlled) {
            if (keysRef.current.has('w') || keysRef.current.has('W') || keysRef.current.has('ArrowUp')) {
                s.p1.y = Math.max(0, s.p1.y - PADDLE_SPEED);
            }
            if (keysRef.current.has('s') || keysRef.current.has('S') || keysRef.current.has('ArrowDown')) {
                s.p1.y = Math.min(CANVAS_H - PADDLE_H, s.p1.y + PADDLE_SPEED);
            }
        } else {
            // P1 AI in agent-controlled mode
            const p1Center = s.p1.y + PADDLE_H / 2;
            if (p1Center < s.ball.y - 5) s.p1.y = Math.min(CANVAS_H - PADDLE_H, s.p1.y + PADDLE_SPEED);
            else if (p1Center > s.ball.y + 5) s.p1.y = Math.max(0, s.p1.y - PADDLE_SPEED);
        }

        // Player 2 AI — tracks ball with slight imperfection
        const p2Center = s.p2.y + PADDLE_H / 2;
        const aiSpeed = PADDLE_SPEED * 0.85;
        if (p2Center < s.ball.y - 6) s.p2.y = Math.min(CANVAS_H - PADDLE_H, s.p2.y + aiSpeed);
        else if (p2Center > s.ball.y + 6) s.p2.y = Math.max(0, s.p2.y - aiSpeed);

        // Reasoning update (throttled)
        if (onMove && Math.random() < 0.02) {
            const side = s.ball.vx > 0 ? "Tracking ball for defense" : "Positioning for next shot";
            onMove(`Right Paddle AI: ${side} (Ball speed: ${Math.hypot(s.ball.vx, s.ball.vy).toFixed(1)})`);
        }

        // Move ball
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;

        // Top/bottom bounce
        if (s.ball.y - BALL_SIZE / 2 <= 0) {
            s.ball.y = BALL_SIZE / 2;
            s.ball.vy = Math.abs(s.ball.vy);
        }
        if (s.ball.y + BALL_SIZE / 2 >= CANVAS_H) {
            s.ball.y = CANVAS_H - BALL_SIZE / 2;
            s.ball.vy = -Math.abs(s.ball.vy);
        }

        // P1 paddle collision
        if (
            s.ball.x - BALL_SIZE / 2 <= 18 + PADDLE_W &&
            s.ball.x - BALL_SIZE / 2 >= 18 &&
            s.ball.y >= s.p1.y &&
            s.ball.y <= s.p1.y + PADDLE_H
        ) {
            const hitPos = (s.ball.y - (s.p1.y + PADDLE_H / 2)) / (PADDLE_H / 2);
            const angle = hitPos * (Math.PI / 3);
            const speed = Math.hypot(s.ball.vx, s.ball.vy) * 1.05;
            s.ball.vx = Math.abs(Math.cos(angle) * speed);
            s.ball.vy = Math.sin(angle) * speed;
            s.ball.x = 18 + PADDLE_W + BALL_SIZE / 2;
        }

        // P2 paddle collision
        const p2x = CANVAS_W - 18 - PADDLE_W;
        if (
            s.ball.x + BALL_SIZE / 2 >= p2x &&
            s.ball.x + BALL_SIZE / 2 <= p2x + PADDLE_W &&
            s.ball.y >= s.p2.y &&
            s.ball.y <= s.p2.y + PADDLE_H
        ) {
            const hitPos = (s.ball.y - (s.p2.y + PADDLE_H / 2)) / (PADDLE_H / 2);
            const angle = hitPos * (Math.PI / 3);
            const speed = Math.hypot(s.ball.vx, s.ball.vy) * 1.05;
            s.ball.vx = -Math.abs(Math.cos(angle) * speed);
            s.ball.vy = Math.sin(angle) * speed;
            s.ball.x = p2x - BALL_SIZE / 2;
        }

        // Clamp speed
        const maxSpeed = 18;
        const spd = Math.hypot(s.ball.vx, s.ball.vy);
        if (spd > maxSpeed) {
            s.ball.vx = (s.ball.vx / spd) * maxSpeed;
            s.ball.vy = (s.ball.vy / spd) * maxSpeed;
        }

        // Scoring
        if (s.ball.x < 0) {
            s.p2.score++;
            if (s.p2.score >= WIN_SCORE) {
                s.winner = 'Player 2';
                onGameEnd?.(s.p2.score);
            } else {
                resetBall(1);
            }
        }
        if (s.ball.x > CANVAS_W) {
            s.p1.score++;
            if (s.p1.score >= WIN_SCORE) {
                s.winner = 'Player 1';
                onGameEnd?.(s.p1.score);
            } else {
                resetBall(-1);
            }
        }
    }, [agentControlled, onGameEnd]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            keysRef.current.add(e.key);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useEffect(() => {
        const loop = () => {
            update();
            draw();
            animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [update, draw]);

    const canvasHeight = isFullscreen ? '100%' : '100%';

    return (
        <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: '100%', height: canvasHeight, display: 'block', borderRadius: '8px' }}
        />
    );
}
