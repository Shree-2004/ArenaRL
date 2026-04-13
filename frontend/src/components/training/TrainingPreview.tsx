import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayCircle } from 'lucide-react';

interface TrainingPreviewProps {
    board: any;
    gameId: string;
}

export function TrainingPreview({ board, gameId }: TrainingPreviewProps) {
    if (!board) return null;

    const renderBoard = () => {
        switch (gameId) {
            case 'snake':
                return (
                    <div className="grid grid-cols-10 gap-1 bg-black/20 p-2 rounded border border-primary/10 aspect-square max-w-[200px] mx-auto">
                        {Array.from({ length: 100 }).map((_, i) => {
                            const x = i % 10;
                            const y = Math.floor(i / 10);
                            const isSnake = board.snake?.some((p: any) => p[0] === x && p[1] === y);
                            const isFood = board.food?.[0] === x && board.food?.[1] === y;

                            return (
                                <div
                                    key={i}
                                    className={`w-full aspect-square rounded-sm ${isSnake ? 'bg-primary' : isFood ? 'bg-accent' : 'bg-muted/10'
                                        }`}
                                />
                            );
                        })}
                    </div>
                );
            case '2048':
                return (
                    <div className="grid grid-cols-4 gap-2 bg-black/20 p-2 rounded border border-primary/10 max-w-[200px] mx-auto">
                        {(board.board || Array(4).fill(Array(4).fill(0))).flat().map((val: number, i: number) => (
                            <div key={i} className={`aspect-square flex items-center justify-center rounded-sm font-bold text-xs ${val > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/10'}`}>
                                {val > 0 ? val : ''}
                            </div>
                        ))}
                    </div>
                );
            case 'maze':
            case 'treasurehunt':
                return (
                    <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                        <div className="text-primary font-mono text-sm">Agent at: {board.agent_pos?.join(',') || board.player?.join(',')}</div>
                        {board.board && (
                            <div className="grid grid-cols-5 gap-1">
                                {board.board.flat().map((cell: number, i: number) => (
                                    <div key={i} className={`w-4 h-4 rounded-sm ${cell === 1 ? 'bg-primary' : cell === 2 ? 'bg-accent' : cell === -1 ? 'bg-destructive' : 'bg-muted/10'}`} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'dodge':
            case 'pong':
            case 'breakout':
                return (
                    <div className="relative w-full h-[200px] bg-black/20 rounded border border-primary/10 overflow-hidden">
                        {/* Simple visualization based on x/y coordinates if available */}
                        {board.player_x !== undefined && (
                            <div className="absolute bottom-2 h-2 bg-primary rounded"
                                style={{ left: `${(board.player_x / (board.width || 10)) * 100}%`, width: '10%' }}
                            />
                        )}
                        {board.paddle_x !== undefined && (
                            <div className="absolute bottom-2 h-2 bg-primary rounded"
                                style={{ left: `${(board.paddle_x / (board.width || 160)) * 100}%`, width: '20%' }}
                            />
                        )}
                        {board.ball_x !== undefined && (
                            <div className="absolute w-2 h-2 bg-accent rounded-full"
                                style={{ left: `${(board.ball_x / (board.width || 160)) * 100}%`, top: `${(board.ball_y / (board.height || 100)) * 100}%` }}
                            />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 text-xs uppercase font-bold">
                            Live {gameId} Tracking
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground italic text-sm gap-4">
                        <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-2 w-full max-w-[220px]">
                            {Object.entries(board).slice(0, 5).map(([k, v]) => (
                                <div key={k} className="flex justify-between font-mono text-[10px]">
                                    <span>{k}:</span>
                                    <span>{Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' ? '{...}' : String(v)}</span>
                                </div>
                            ))}
                        </div>
                        <p>General state view for {gameId}</p>
                    </div>
                );
        }
    };

    return (
        <Card className="glass border-primary/20">
            <CardHeader className="py-3 bg-muted/30">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-primary" />
                    Live Performance Snapshot
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {renderBoard()}
            </CardContent>
        </Card>
    );
}
