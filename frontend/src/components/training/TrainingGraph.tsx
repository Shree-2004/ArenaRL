import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { type TrainingProgress } from '@/lib/api';

interface TrainingGraphProps {
  progress: TrainingProgress | null;
  title?: string;
}

export function TrainingGraph({ progress, title = 'Training Progress' }: TrainingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make the canvas pixel dimensions match its display dimensions
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = rect.width || 500;
    const H = rect.height || 280;

    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const pad = { top: 24, right: 16, bottom: 40, left: 52 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    // Background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'hsl(220, 20%, 10%)';
    ctx.fillRect(0, 0, W, H);

    // Pick the data series to draw — prefer winRateHistory, fallback to rewardHistory
    const rawData: number[] | undefined =
      progress?.winRateHistory?.length && progress.winRateHistory.length > 1
        ? progress.winRateHistory
        : progress?.rewardHistory?.length && progress.rewardHistory.length > 1
          ? progress.rewardHistory
          : undefined;

    // Y-axis gridlines + labels
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (cH * i) / gridLines;
      const val = ((gridLines - i) / gridLines);

      ctx.strokeStyle = 'hsl(220, 20%, 20%)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cW, y);
      ctx.stroke();

      ctx.fillStyle = 'hsl(220, 10%, 55%)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 6, y + 4);
    }

    // Y-axis line
    ctx.strokeStyle = 'hsl(220, 20%, 30%)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + cH);
    ctx.stroke();

    // No data yet — show placeholder message
    if (!rawData) {
      ctx.fillStyle = 'hsl(220, 10%, 45%)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        progress ? 'Waiting for training data…' : 'Start training to see the chart',
        pad.left + cW / 2,
        pad.top + cH / 2
      );

      // X-axis
      ctx.strokeStyle = 'hsl(220, 20%, 30%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + cH);
      ctx.lineTo(pad.left + cW, pad.top + cH);
      ctx.stroke();
      return;
    }

    // Smooth the raw data with a rolling average for a cleaner line
    const smooth = (data: number[], k = 5): number[] => {
      return data.map((_, i) => {
        const slice = data.slice(Math.max(0, i - k + 1), i + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
      });
    };

    const isRewardData = !(progress?.winRateHistory?.length && progress.winRateHistory.length > 1);
    let data = isRewardData ? smooth(rawData, 10) : smooth(rawData, 5);

    // Normalise reward data to [0, 1]
    let minVal = 0, maxVal = 1;
    if (isRewardData) {
      minVal = Math.min(...data);
      maxVal = Math.max(...data, minVal + 0.001);
    }
    const normalise = (v: number) => (v - minVal) / (maxVal - minVal);

    const step = cW / Math.max(data.length - 1, 1);

    // Fill area under line
    const fillGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    fillGrad.addColorStop(0, 'hsla(262, 83%, 58%, 0.35)');
    fillGrad.addColorStop(1, 'hsla(262, 83%, 58%, 0.02)');

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + i * step;
      const y = pad.top + cH - normalise(v) * cH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (data.length - 1) * step, pad.top + cH);
    ctx.lineTo(pad.left, pad.top + cH);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Main line
    const lineGrad = ctx.createLinearGradient(pad.left, 0, pad.left + cW, 0);
    lineGrad.addColorStop(0, 'hsl(262, 83%, 58%)');
    lineGrad.addColorStop(1, 'hsl(168, 76%, 42%)');

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + i * step;
      const y = pad.top + cH - normalise(v) * cH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Current value dot
    const lastV = data[data.length - 1];
    const dotX = pad.left + (data.length - 1) * step;
    const dotY = pad.top + cH - normalise(lastV) * cH;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(168, 76%, 55%)';
    ctx.fill();
    ctx.strokeStyle = 'hsl(220, 20%, 10%)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // X-axis
    ctx.strokeStyle = 'hsl(220, 20%, 30%)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + cH);
    ctx.lineTo(pad.left + cW, pad.top + cH);
    ctx.stroke();

    // X-axis labels
    const totalEp = progress?.totalEpisodes || data.length;
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const x = pad.left + (cW * i) / xTicks;
      const ep = Math.round((totalEp * i) / xTicks);
      ctx.fillStyle = 'hsl(220, 10%, 50%)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(ep), x, pad.top + cH + 16);
    }

    ctx.fillStyle = 'hsl(220, 10%, 45%)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Episode', pad.left + cW / 2, pad.top + cH + 32);

  }, [progress]);

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '280px', display: 'block', borderRadius: '8px' }}
        />
        {progress && (
          <div className="mt-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-mono font-bold text-primary">
                {(progress.currentEpisode ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Episodes</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-accent">
                {((progress.winRate ?? 0) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-success">
                {(progress.avgReward ?? 0).toFixed(3)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Reward</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-warning">
                {((progress.epsilon ?? 0) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Epsilon</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
