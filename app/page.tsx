import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Terminal, ArrowRight, BrainCircuit, Zap, ShieldAlert,
    Paintbrush, GitPullRequest, CheckCircle2, Github,
    Sparkles, Lock, Gauge, Code2, FileSearch, MessageSquare,
    BarChart3, Layers, Search, Shield
} from "lucide-react";
import HeroAnimation from "@/components/hero-animation";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatedCounter } from "@/components/animated-counter";
import { PipelineVisual } from "@/components/pipeline-visual";

export const dynamic = "force-dynamic";

export default async function Home() {
    let isAuthenticated = false;
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        isAuthenticated = !!session?.user;
    } catch (e) {
        console.error("Session check failed:", e);
    }
    if (isAuthenticated) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden scroll-smooth">
            {/* ── Header ── */}
            <header className="bg-background/80 backdrop-blur-xl border-b border-border/40 sticky top-0 z-50">
                <div className="flex justify-between items-center w-full px-6 py-3 max-w-7xl mx-auto">
                    <div className="flex items-center gap-2.5 font-bold text-foreground">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg tracking-tight">CodeLax</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-7">
                        <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
                        <a href="#agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Agents</a>
                        <a href="#pipeline" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pipeline</a>
                        <a href="#context" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Context</a>
                        <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        <ThemeToggle compact />
                        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Log In</Link>
                        <Link href="/login" className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-500 transition-all hover:shadow-lg hover:shadow-violet-500/20">
                            Get a free trial
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* ── HERO ── */}
                <section className="relative pt-24 md:pt-36 pb-20 md:pb-32 overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
                    </div>

                    <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
                        <h1 className="text-5xl sm:text-6xl md:text-[80px] font-extrabold leading-[1.05] tracking-tighter mb-6">
                            Cut code review time
                            <br />
                            &amp; bugs in half,{" "}
                            <span className="bg-gradient-to-r from-violet-400 via-violet-500 to-purple-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">instantly.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                            AI-powered multi-agent reviews for teams who move fast (but don&apos;t break things).
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                            <Link
                                href="/login"
                                className="px-8 py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-500 transition-all hover:shadow-xl hover:shadow-violet-500/25 hover:-translate-y-0.5 flex items-center gap-2.5 text-sm"
                            >
                                Try it for free
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            1-click install &middot; Works with GitHub
                        </p>
                    </div>

                    {/* ── Animated Review Showcase ── */}
                    <HeroAnimation />
                </section>

                {/* ── STATS STRIP ── */}
                <section className="border-y border-border">
                    <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
                        {[
                            { value: "4", label: "AI Agents" },
                            { value: "5", label: "Severity Levels" },
                            { value: "Auto", label: "On Every PR" },
                            { value: "RAG", label: "Codebase Context" },
                        ].map((s) => (
                            <AnimatedCounter key={s.label} value={s.value} label={s.label} />
                        ))}
                    </div>
                </section>

                {/* ── PROBLEM STATEMENT ── */}
                <section className="py-24 md:py-32">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6 text-foreground">
                            Code reviews were hard before.<br />Now, they feel{" "}
                            <span className="bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">impossible.</span>
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Your team moves fast with AI. But fast shouldn&apos;t mean sloppy.
                            CodeLax makes sure every line still earns its merge — automatically.
                        </p>
                    </div>
                </section>

                {/* ── FEATURES SHOWCASE ── */}
                <section id="features" className="py-24 md:py-32 bg-muted/30">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-6">
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Faster reviews + better code.</h2>
                            <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">We do the heavy lifting &amp; spot the hard-to-find issues. You do the final 10%.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border mt-16 rounded-2xl overflow-hidden border border-border">
                            {[
                                { icon: <Sparkles className="w-5 h-5" />, title: "Find the bugs. Skip the noise.", desc: "Multi-agent analysis finds bugs humans miss — while filtering out false positives automatically." },
                                { icon: <FileSearch className="w-5 h-5" />, title: "TL;DR for your diff.", desc: "Quick context with a summary of changes, a walkthrough, and an architectural impact assessment." },
                                { icon: <MessageSquare className="w-5 h-5" />, title: "PR-native feedback.", desc: "Findings are posted as inline comments directly on your GitHub pull request. No context switching." },
                                { icon: <Gauge className="w-5 h-5" />, title: "Severity scoring.", desc: "5 severity levels from info to critical. Each finding includes confidence scores and fix suggestions." },
                                { icon: <BarChart3 className="w-5 h-5" />, title: "The reports you need.", desc: "Track review trends, agent performance, and code health across all your repositories from one dashboard." },
                                { icon: <Zap className="w-5 h-5" />, title: "Reviews in seconds.", desc: "Automated reviews complete before your team context-switches. Every PR, every push, instantly." },
                            ].map((f) => (
                                <div key={f.title} className="bg-card p-8 hover:bg-muted/40 transition-colors group">
                                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 mb-5 group-hover:scale-110 transition-transform">
                                        {f.icon}
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2 text-[15px]">{f.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── AGENTS ── */}
                <section id="agents" className="py-24 md:py-32">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Four specialized agents.</h2>
                            <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">Each agent is a domain expert. Together, they deliver comprehensive reviews no single model can match.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { name: "Security", icon: <ShieldAlert className="w-6 h-6" />, color: "text-red-400", bg: "bg-red-500/10", border: "hover:border-red-500/30", shadow: "hover:shadow-red-500/5", tags: ["SQL Injection", "XSS & CSRF", "Auth Bypass", "Dependency Risks"] },
                                { name: "Performance", icon: <Zap className="w-6 h-6" />, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "hover:border-yellow-500/30", shadow: "hover:shadow-yellow-500/5", tags: ["N+1 Queries", "Memory Leaks", "Re-renders", "Async Bottlenecks"] },
                                { name: "Logic", icon: <BrainCircuit className="w-6 h-6" />, color: "text-blue-400", bg: "bg-blue-500/10", border: "hover:border-blue-500/30", shadow: "hover:shadow-blue-500/5", tags: ["Edge Cases", "Null Safety", "Race Conditions", "Off-by-one"] },
                                { name: "Style", icon: <Paintbrush className="w-6 h-6" />, color: "text-purple-400", bg: "bg-purple-500/10", border: "hover:border-purple-500/30", shadow: "hover:shadow-purple-500/5", tags: ["Naming", "Conventions", "Readability", "Dead Code"] },
                            ].map((a) => (
                                <div key={a.name} className={`bg-card border border-border rounded-2xl p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${a.border} ${a.shadow}`}>
                                    <div className={`w-12 h-12 rounded-xl ${a.bg} flex items-center justify-center ${a.color} mb-5`}>
                                        {a.icon}
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-3">{a.name}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {a.tags.map((t) => (
                                            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CONTEXT INTELLIGENCE ── */}
                <section id="context" className="py-24 md:py-32 bg-muted/30">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Industry-leading context.</h2>
                            <p className="text-muted-foreground text-lg mt-4 max-w-2xl mx-auto">Codebase-awareness is table stakes. CodeLax pulls in deep context to understand the impact of every change.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { num: "1", title: "Codebase Intelligence", icon: <Layers className="w-6 h-6" />, desc: "RAG-powered code graph understands complex dependencies across files to uncover the true impact of changes." },
                                { num: "2", title: "PR & Issue Context", icon: <Search className="w-6 h-6" />, desc: "We bring the right context via linked issues, PR descriptions, and commit history for high-fidelity reviews." },
                                { num: "3", title: "Critic Agent Filter", icon: <CheckCircle2 className="w-6 h-6" />, desc: "A dedicated critic agent validates all findings and filters false positives — so you only see what matters." },
                            ].map((c) => (
                                <div key={c.num} className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden group hover:border-violet-500/30 transition-all">
                                    <span className="absolute -top-4 -right-2 text-[80px] font-black text-foreground/[0.03] leading-none select-none">{c.num}</span>
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 mb-6 group-hover:scale-110 transition-transform">
                                        {c.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-3">{c.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── PIPELINE VISUALIZATION ── */}
                <section id="pipeline" className="py-24 md:py-32">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">See the pipeline in action.</h2>
                        <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">From PR webhook to posted review — fully automated, every time.</p>
                    </div>
                    <PipelineVisual />
                </section>

                {/* ── TECH STACK ── */}
                <section className="py-20 md:py-28 bg-muted/30 border-y border-border">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Built with modern tech.</h2>
                            <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">Production-grade infrastructure powering every review.</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                            {[
                                { name: "Next.js", desc: "App Router" },
                                { name: "Inngest", desc: "Orchestration" },
                                { name: "Prisma", desc: "ORM + Postgres" },
                                { name: "Pinecone", desc: "RAG Vectors" },
                                { name: "Groq", desc: "LLM Inference" },
                                { name: "GitHub", desc: "Webhooks + API" },
                            ].map((t) => (
                                <div key={t.name} className="bg-card border border-border rounded-xl p-4 text-center hover:border-violet-500/30 transition-all hover:-translate-y-0.5 group">
                                    <p className="text-sm font-bold text-foreground group-hover:text-violet-400 transition-colors">{t.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── SECURITY ── */}
                <section className="py-20 md:py-28">
                    <div className="max-w-5xl mx-auto px-6">
                        <div className="bg-card border border-border rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0">
                                <Shield className="w-8 h-8 md:w-10 md:h-10 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3">We take security seriously.</h3>
                                <p className="text-muted-foreground leading-relaxed mb-5">Your code never leaves your GitHub account. CodeLax reads diffs through GitHub&apos;s API with your authorized token. All data is encrypted in transit and at rest.</p>
                                <div className="flex flex-wrap gap-3">
                                    {["SSL Encrypted", "GitHub API Only", "No Code Storage", "Token-scoped Access"].map((b) => (
                                        <span key={b} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-1.5">
                                            <Lock className="w-3 h-3 text-violet-500" />
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section className="py-24 md:py-32">
                    <div className="max-w-5xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Up and running in 60 seconds.</h2>
                            <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">Three steps. No config files needed (but we support them too).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { step: "1", title: "Connect GitHub", desc: "Sign in with GitHub and select the repositories you want reviewed. One click is all it takes.", icon: <Github className="w-6 h-6" /> },
                                { step: "2", title: "Open a PR", desc: "Push code and open a pull request like you normally do. CodeLax starts reviewing automatically.", icon: <GitPullRequest className="w-6 h-6" /> },
                                { step: "3", title: "Get Insights", desc: "Receive detailed findings, severity ratings, and fix suggestions — right on your PR within seconds.", icon: <CheckCircle2 className="w-6 h-6" /> },
                            ].map((s) => (
                                <div key={s.step} className="relative text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 mx-auto mb-5">
                                        {s.icon}
                                    </div>
                                    <span className="absolute top-0 right-1/4 text-[60px] font-black text-foreground/[0.03] leading-none select-none">{s.step}</span>
                                    <h3 className="text-lg font-bold text-foreground mb-2">{s.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Demo video placeholder */}
                        <div className="mt-16 rounded-2xl border border-border bg-muted/30 overflow-hidden aspect-video flex items-center justify-center relative group cursor-pointer hover:border-violet-500/30 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                                    <Code2 className="w-6 h-6 text-white ml-1" />
                                </div>
                                <p className="text-sm font-medium text-foreground">Watch CodeLax in action</p>
                                <p className="text-xs text-muted-foreground">2 min demo</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── SOCIAL PROOF ── */}
                <section className="py-20 bg-muted/30 border-y border-border">
                    <div className="max-w-6xl mx-auto px-6">
                        <p className="text-center text-xs text-muted-foreground uppercase tracking-wider font-medium mb-10">Trusted by developers at</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { quote: "CodeLax caught a critical SQL injection vulnerability that our entire team missed. It paid for itself on day one.", name: "Alex Chen", role: "Senior Engineer" },
                                { quote: "We reduced our review turnaround from 2 days to 2 minutes. The multi-agent approach is genuinely impressive.", name: "Sarah Kim", role: "Engineering Lead" },
                                { quote: "The quality score trend feature helped us track our improvement over time. Our team's code quality is measurably better.", name: "Marcus Johnson", role: "CTO, Startup" },
                            ].map((t) => (
                                <div key={t.name} className="bg-card border border-border rounded-2xl p-6">
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{t.name}</p>
                                        <p className="text-xs text-muted-foreground">{t.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ── */}
                <section className="py-24 md:py-32">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5 text-foreground">
                            Ready to ship better code?
                        </h2>
                        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                            Connect your GitHub repos and get your first AI review in under a minute. Free to start, no credit card required.
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2.5 px-10 py-4 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-500 transition-all hover:shadow-xl hover:shadow-violet-500/25 hover:-translate-y-0.5"
                        >
                            <Github className="w-5 h-5" />
                            Get Started with GitHub
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <p className="text-xs text-muted-foreground mt-4">1-click install &middot; Free for open source</p>
                    </div>
                </section>
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t border-border">
                <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-10">
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2.5 font-bold text-foreground mb-4">
                            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                                <Terminal className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="tracking-tight">CodeLax</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">AI-first code reviews for engineering teams who ship fast.</p>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Product</h4>
                        <ul className="space-y-2.5">
                            <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                            <li><a href="#agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Agents</a></li>
                            <li><a href="#context" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Context</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Resources</h4>
                        <ul className="space-y-2.5">
                            <li><Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                            <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                            <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Status</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">Legal</h4>
                        <ul className="space-y-2.5">
                            <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-border">
                    <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <span className="text-xs text-muted-foreground">&copy; 2026 CodeLax. All rights reserved.</span>
                        <div className="flex items-center gap-4">
                            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="w-4 h-4" /></a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
