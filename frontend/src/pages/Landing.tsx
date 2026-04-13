import { LandingNav } from '@/components/layout/LandingNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Swords, BarChart3, Gamepad2, ArrowRight, Zap, Target, Trophy, ChevronRight, Play, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Landing() {
    const features = [
        {
            icon: Gamepad2,
            title: 'Diverse Game Library',
            description: 'From classic Snake and Pong to strategic Connect 4 and complex GridWorlds.',
            color: 'text-primary',
        },
        {
            icon: Brain,
            title: 'Advanced RL Algorithms',
            description: 'Implement and train Q-Learning, DQN, SARSA, and PPO with customizable hyperparameters.',
            color: 'text-accent',
        },
        {
            icon: Swords,
            title: 'Real-time Arena',
            description: 'Watch your agents compete in high-stakes matches with real-time explainability metrics.',
            color: 'text-agentX',
        },
        {
            icon: BarChart3,
            title: 'Deep Analytics',
            description: 'Export comprehensive PDF reports and visualize training progress with precise charts.',
            color: 'text-agentO',
        },
    ];

    return (
        <div className="min-h-screen bg-background selection:bg-primary/30 scroll-smooth">
            <LandingNav />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                {/* Abstract Background */}
                <div className="absolute top-0 left-0 w-full h-full -z-10">
                    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px] animate-pulse" />
                </div>

                <div className="max-w-7xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground italic">Research-Grade Reinforcement Learning</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-mono font-bold tracking-tighter leading-[0.9]">
                        UNLEASH <span className="text-gradient">INTELLIGENCE</span><br />
                        IN THE ARENA
                    </h1>

                    <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                        The ultimate platform for training, testing, and visualizing
                        multi-agent reinforcement learning models across diverse environments.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                        <Link to="/signup">
                            <Button size="lg" className="h-14 px-10 text-lg font-mono gap-3 glow-primary">
                                START TRAINING
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                        <Link to="/login">
                            <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-mono gap-3 border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-primary/5 transition-all">
                                RESEARCHER LOGIN
                                <LogIn className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 px-6 bg-muted/20 border-y border-border">
                <div className="max-w-7xl mx-auto space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-mono font-bold tracking-tight">PLATFORM FEATURES</h2>
                        <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, idx) => (
                            <Card key={idx} className="glass hover:border-primary/50 transition-all hover:-translate-y-2 group">
                                <CardHeader>
                                    <div className={cn("inline-flex w-12 h-12 rounded-xl bg-background/50 border border-border items-center justify-center mb-4 transition-transform group-hover:scale-110", feature.color)}>
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-xl font-mono">{feature.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why ArenaRL Section */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <h2 className="text-5xl font-mono font-bold leading-tight">
                            DESIGNED FOR <br />
                            <span className="italic text-primary">SCIENTIFIC PRECISION.</span>
                        </h2>

                        <ul className="space-y-6">
                            {[
                                "High-performance vectorized environments for rapid training.",
                                "Unified interface for distinct RL architectures.",
                                "Frame-by-frame explainability of agent decision-making.",
                                "One-click PDF report generation for academic or technical review."
                            ].map((text, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                        <ChevronRight className="w-4 h-4 text-primary" />
                                    </div>
                                    <p className="text-lg text-muted-foreground">{text}</p>
                                </li>
                            ))}
                        </ul>

                        <Link to="/signup">
                            <Button size="lg" className="h-14 px-8 font-mono gap-2 glow-primary">
                                CREATE YOUR FIRST AGENT
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-3xl" />
                        <div className="relative aspect-video rounded-2xl border border-primary/20 bg-muted/50 overflow-hidden shadow-2xl flex items-center justify-center group cursor-pointer hover:border-primary/40 transition-all">
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto shadow-2xl group-hover:scale-110 transition-all">
                                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                                </div>
                                <p className="font-mono text-sm tracking-widest text-primary font-bold">WATCH ARENA PREVIEW</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-border bg-muted/10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:row items-center justify-between gap-8">
                    <div className="flex items-center gap-3">
                        <Brain className="w-6 h-6 text-primary" />
                        <span className="font-mono font-bold tracking-tighter">ArenaRL © 2026</span>
                    </div>

                    <div className="flex gap-8 text-sm text-muted-foreground">
                        <a href="#" className="hover:text-primary transition-colors">Documentation</a>
                        <a href="#" className="hover:text-primary transition-colors">Terms</a>
                        <a href="#" className="hover:text-primary transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
