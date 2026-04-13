import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal } from 'lucide-react';

interface TrainingConsoleProps {
    logs: string[];
}

export function TrainingConsole({ logs }: TrainingConsoleProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <Card className="glass border-primary/20">
            <CardHeader className="py-3 bg-muted/30">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    Training Console
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div
                    ref={scrollRef}
                    className="h-[480px] overflow-y-auto p-4 font-mono text-xs space-y-1 bg-black/40 scrollbar-thin scrollbar-thumb-primary/20"
                >
                    {logs.length === 0 ? (
                        <div className="text-muted-foreground animate-pulse">Waiting for training stream...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="flex gap-3">
                                <span className="text-primary/40">[{new Date().toLocaleTimeString()}]</span>
                                <span className="text-primary/90">{log}</span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
