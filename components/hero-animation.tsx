"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldAlert, Zap, BrainCircuit, GitPullRequest, MessageSquare, CheckCircle2 } from "lucide-react";

function useTypingEffect(text: string, speed = 30, delay = 0) {
    const [displayed, setDisplayed] = useState("");
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(timeout);
    }, [delay]);

    useEffect(() => {
        if (!started) return;
        if (displayed.length >= text.length) return;
        const timer = setTimeout(() => {
            setDisplayed(text.slice(0, displayed.length + 1));
        }, speed);
        return () => clearTimeout(timer);
    }, [displayed, started, text, speed]);

    return displayed;
}

function TypingLine({ text, delay = 0, speed = 25, className = "" }: { text: string; delay?: number; speed?: number; className?: string }) {
    const displayed = useTypingEffect(text, speed, delay);
    return (
        <span className={className}>
            {displayed}
            {displayed.length < text.length && <span className="inline-block w-[2px] h-[1em] bg-violet-400 animate-pulse ml-0.5 align-middle" />}
        </span>
    );
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);
    return (
        <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}>
            {children}
        </div>
    );
}

export default function HeroAnimation() {
    const [showCursor1, setShowCursor1] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => setShowCursor1((p) => !p), 530);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full max-w-6xl mx-auto mt-20 mb-8 px-4">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40' fill='none' stroke='%23888'%3e%3cpath d='M0 .5H39.5V40'/%3e%3c/svg%3e")`,
            }} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
                {/* ── Card 1: Review Summary ── */}
                <FadeIn delay={200} className="md:col-span-1">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-lg h-full">
                        {/* Flow diagram mockup */}
                        <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50 font-mono text-[10px] text-muted-foreground leading-relaxed">
                            <FadeIn delay={600}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-violet-400">GET</span>
                                    <span className="text-foreground/60">/api/polls/route.ts</span>
                                </div>
                                <div className="pl-3 border-l border-border/50 space-y-1">
                                    <div><TypingLine text="→ query('polls').select(...)" delay={800} speed={20} className="text-blue-400" /></div>
                                    <div><TypingLine text="→ orderBy('created_at', 'desc')" delay={1600} speed={20} className="text-blue-400" /></div>
                                    <div><TypingLine text="→ .json({ polls: [...] })" delay={2400} speed={20} className="text-emerald-400" /></div>
                                </div>
                            </FadeIn>
                        </div>
                        <div className="space-y-2.5">
                            <FadeIn delay={1000}>
                                <div className="text-sm font-bold text-foreground">Estimated code review effort</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <span className="text-yellow-400">⚡</span>
                                    <TypingLine text="3 (Moderate)  |  ~20 minutes" delay={1200} speed={30} className="" />
                                </div>
                            </FadeIn>
                            <FadeIn delay={2000}>
                                <div className="text-xs text-muted-foreground space-y-1 mt-3">
                                    <div className="flex items-center gap-1.5"><span className="text-violet-400">▶</span> Nitpick comments (3)</div>
                                    <div className="flex items-center gap-1.5"><span className="text-violet-400">▶</span> Review details</div>
                                    <div className="flex items-center gap-1.5 pl-3"><span className="text-muted-foreground/50">▶</span> Files selected for processing (11)</div>
                                    <div className="flex items-center gap-1.5 pl-3"><span className="text-muted-foreground/50">▶</span> Files with no reviewable changes (2)</div>
                                </div>
                            </FadeIn>
                        </div>
                    </div>
                </FadeIn>

                {/* ── Card 2: Bot Review Comment ── */}
                <FadeIn delay={500} className="md:col-span-1">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-lg h-full">
                        {/* Bot header */}
                        <FadeIn delay={700}>
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
                                    <BrainCircuit className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-foreground">codelax</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1.5 font-mono">bot</span>
                                    <span className="text-xs text-muted-foreground ml-2">1 min ago</span>
                                </div>
                            </div>
                        </FadeIn>

                        <FadeIn delay={1200}>
                            <div className="mb-3">
                                <span className="text-yellow-400 text-sm font-bold">⚠ Potential issue</span>
                                <span className="text-muted-foreground mx-2">|</span>
                                <span className="text-red-400 text-sm font-bold">● Critical</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                <TypingLine
                                    text="... A 404 might be more suitable for not found errors."
                                    delay={1500}
                                    speed={25}
                                />
                            </p>
                        </FadeIn>

                        {/* Code diff */}
                        <FadeIn delay={2800}>
                            <div className="rounded-lg overflow-hidden border border-border/50 font-mono text-xs mb-4">
                                <div className="bg-red-500/10 px-3 py-1.5 text-red-400 flex items-center gap-2">
                                    <span className="select-none opacity-50">-</span>
                                    <TypingLine text="status_code=400," delay={3000} speed={30} />
                                </div>
                                <div className="bg-emerald-500/10 px-3 py-1.5 text-emerald-400 flex items-center gap-2">
                                    <span className="select-none opacity-50">+</span>
                                    <TypingLine text="status_code=404," delay={3500} speed={30} />
                                </div>
                            </div>
                        </FadeIn>

                        <FadeIn delay={4000}>
                            <div className="text-xs text-violet-400 flex items-center gap-1.5 mb-4">
                                <span>▶</span> Committable suggestion
                            </div>
                        </FadeIn>

                        {/* Author reply */}
                        <FadeIn delay={4500}>
                            <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-border/50">
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">JB</div>
                                <div>
                                    <span className="text-xs font-bold text-foreground">jbrooks215</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1.5">author</span>
                                    <span className="text-[10px] text-muted-foreground ml-2">Now</span>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                <TypingLine text="Great catch! Just Fixed it." delay={5000} speed={35} />
                            </p>
                        </FadeIn>
                    </div>
                </FadeIn>

                {/* ── Card 3: Chat & Suggestions ── */}
                <FadeIn delay={800} className="md:col-span-1">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-lg h-full">
                        <FadeIn delay={1000}>
                            <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50 text-xs">
                                <TypingLine
                                    text="Recommended to use a wildcard imports"
                                    delay={1200}
                                    speed={25}
                                    className="text-foreground"
                                />
                                <FadeIn delay={2500}>
                                    <div className="mt-2 font-mono text-[11px]">
                                        <span className="text-red-400">-7</span>
                                        <span className="text-muted-foreground mx-1.5"> </span>
                                        <span className="text-emerald-400">+1</span>
                                    </div>
                                </FadeIn>
                                <FadeIn delay={3200}>
                                    <div className="flex items-center gap-1.5 mt-2 text-violet-400 text-[11px]">
                                        <span>▶</span> Committable suggestions
                                    </div>
                                </FadeIn>
                            </div>
                        </FadeIn>

                        {/* Author response */}
                        <FadeIn delay={3800}>
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">JB</div>
                                <div>
                                    <span className="text-xs font-bold text-foreground">jbrooks215</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1.5">author</span>
                                    <span className="text-[10px] text-muted-foreground ml-2">2 min ago</span>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                <TypingLine
                                    text="@codelax No, we want to get rid of the star imports."
                                    delay={4200}
                                    speed={25}
                                />
                            </p>
                        </FadeIn>

                        {/* Bot acknowledgment */}
                        <FadeIn delay={6000}>
                            <div className="mt-5 pt-4 border-t border-border/50">
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center">
                                        <BrainCircuit className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-foreground">codelax</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1.5 font-mono">bot</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    <TypingLine
                                        text="Got it! I'll keep explicit imports in future reviews for this project."
                                        delay={6500}
                                        speed={25}
                                    />
                                </p>
                                <FadeIn delay={8500}>
                                    <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-xs">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Learning saved</span>
                                    </div>
                                </FadeIn>
                            </div>
                        </FadeIn>
                    </div>
                </FadeIn>
            </div>
        </div>
    );
}
