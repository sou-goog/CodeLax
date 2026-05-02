import Link from "next/link";
import { ShieldCheck, Zap, BrainCircuit, Paintbrush, ArrowLeft } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Navbar */}
            <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-border">
                <Link href="/" className="flex items-center gap-2 text-xl font-bold">
                    <div className="w-7 h-7 bg-primary rounded-full" />
                    <span>CodeLax</span>
                </Link>
                <Link
                    href="/login"
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                    Get Started
                </Link>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
                {/* Back link */}
                <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to home
                </Link>

                {/* About */}
                <section className="space-y-4">
                    <h1 className="text-4xl font-bold">About CodeLax</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        CodeLax is an AI-powered code review platform that uses a multi-agent architecture to provide
                        thorough, automated reviews on every GitHub pull request. It combines specialized AI agents
                        with RAG-powered codebase understanding to deliver actionable, context-aware feedback.
                    </p>
                </section>

                {/* Agent Architecture */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">Multi-Agent Pipeline</h2>
                    <div className="grid sm:grid-cols-2 gap-6">
                        <div className="border border-border rounded-xl p-5 space-y-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-red-500" />
                                <h3 className="font-semibold">Security Agent</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Scans for injection vulnerabilities, auth bypasses, data exposure, and insecure defaults.
                            </p>
                        </div>
                        <div className="border border-border rounded-xl p-5 space-y-2">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                <h3 className="font-semibold">Performance Agent</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Identifies N+1 queries, memory leaks, unnecessary re-renders, and Big-O inefficiencies.
                            </p>
                        </div>
                        <div className="border border-border rounded-xl p-5 space-y-2">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold">Logic Agent</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Catches off-by-one errors, missing null checks, incorrect conditionals, and race conditions.
                            </p>
                        </div>
                        <div className="border border-border rounded-xl p-5 space-y-2">
                            <div className="flex items-center gap-2">
                                <Paintbrush className="w-5 h-5 text-purple-500" />
                                <h3 className="font-semibold">Style Agent</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Reviews naming conventions, code duplication, missing types, and readability issues.
                            </p>
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold">How It Works</h2>
                    <ol className="space-y-3 text-muted-foreground">
                        <li><strong className="text-foreground">1. Connect</strong> — Link your GitHub repository. A webhook is created automatically.</li>
                        <li><strong className="text-foreground">2. Open a PR</strong> — When a PR is opened or updated, CodeLax receives the event.</li>
                        <li><strong className="text-foreground">3. Plan</strong> — The Planner agent analyzes the diff and selects relevant specialist agents.</li>
                        <li><strong className="text-foreground">4. Analyze</strong> — Specialists review the code using RAG context from your codebase.</li>
                        <li><strong className="text-foreground">5. Critique</strong> — The Critic agent filters duplicates and false positives.</li>
                        <li><strong className="text-foreground">6. Report</strong> — The Synthesizer posts a structured review comment on the PR.</li>
                    </ol>
                </section>
            </main>

            <footer className="px-6 md:px-12 py-8 border-t border-border text-center text-sm text-muted-foreground">
                Built with Next.js, Gemini AI, Pinecone & Inngest
            </footer>
        </div>
    );
}