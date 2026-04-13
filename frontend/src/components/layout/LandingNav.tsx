import { Link } from 'react-router-dom';
import { Brain, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function LandingNav() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b",
                scrolled
                    ? "bg-background/80 backdrop-blur-md border-border py-3"
                    : "bg-transparent border-transparent py-5"
            )}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Brain className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-mono font-bold text-xl tracking-tighter">ArenaRL</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">AI Multi-Game Platform</span>
                    </div>
                </Link>

                <div className="flex items-center gap-4">
                    <Link to="/login">
                        <Button variant="ghost" className="gap-2 font-mono hover:bg-primary/10">
                            <LogIn className="w-4 h-4" />
                            Login
                        </Button>
                    </Link>
                    <Link to="/signup">
                        <Button className="gap-2 font-mono glow-primary">
                            <UserPlus className="w-4 h-4" />
                            Get Started
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
