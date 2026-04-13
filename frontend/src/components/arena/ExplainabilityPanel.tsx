import { type Move } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, Zap, Target, HelpCircle } from 'lucide-react';

interface ExplainabilityPanelProps {
  currentMove: Move | null;
  agentName: string;
  agentSymbol: 'X' | 'O';
}

export function ExplainabilityPanel({ currentMove, agentName, agentSymbol }: ExplainabilityPanelProps) {
  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          Agent Reasoning
          <span className={agentSymbol === 'X' ? 'text-agentX' : 'text-agentO'}>
            ({agentSymbol}: {agentName})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentMove ? (
          <>
            {/* Confidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  Confidence
                </span>
                <span className="font-mono font-medium">
                  {((currentMove.confidence || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={(currentMove.confidence || 0) * 100} className="h-2" />
            </div>

            {/* Epsilon (exploration rate) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  Exploration (ε)
                </span>
                <span className="font-mono font-medium">
                  {((currentMove.epsilon || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={(currentMove.epsilon || 0) * 100} className="h-2" />
            </div>

            {/* Q-Values */}
            {currentMove.qValues && (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Q-Values
                </span>
                <div className="grid grid-cols-3 gap-1 font-mono text-xs">
                  {Object.entries(currentMove.qValues).map(([pos, value]) => (
                    <div
                      key={pos}
                      className="bg-muted p-2 rounded text-center"
                    >
                      <div className="text-muted-foreground">{pos}</div>
                      <div className="font-medium">{value.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning text */}
            {currentMove.reasoning && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground italic">
                  "{currentMove.reasoning}"
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Waiting for agent move...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
