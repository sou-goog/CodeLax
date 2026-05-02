import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Zap, BrainCircuit, GitPullRequest, ArrowRight } from "lucide-react";

export default async function Home() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Navbar */}
            <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-border">
                <div className="flex items-center gap-2 text-xl font-bold">
                    <div className="w-7 h-7 bg-primary rounded-full" />
                    <span>CodeLax</span>
                </div>
                <div className="flex items-center gap-6">
                    <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        About
                    </Link>
                    <Link
                        href="/login"
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="flex flex-col items-center text-center px-6 pt-20 md:pt-32 pb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
                    <GitPullRequest className="w-4 h-4" />
                    AI-Powered Code Reviews
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight max-w-4xl text-balance">
                    Ship Better Code, <span className="text-primary">Faster</span>
                </h1>
                <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                    CodeLax uses a multi-agent AI pipeline to review your pull requests for security, performance, logic bugs, and code quality — automatically.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-10">
                    <Link
                        href="/login"
                        className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        Start Free <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Features Section */}
            <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">How It Works</h2>
                <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
                    Connect your GitHub repository and CodeLax handles the rest. Every PR gets a thorough multi-agent review.
                </p>
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <GitPullRequest className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg">1. Connect Repos</h3>
                        <p className="text-sm text-muted-foreground">
                            Link your GitHub repositories with one click. We set up webhooks automatically to listen for new PRs.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BrainCircuit className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg">2. AI Agents Analyze</h3>
                        <p className="text-sm text-muted-foreground">
                            Specialist agents (security, performance, logic, style) review your code with RAG-powered codebase context.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg">3. Get Verified Findings</h3>
                        <p className="text-sm text-muted-foreground">
                            A critic agent filters false positives. A synthesizer produces a final review posted directly on your PR.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="px-6 md:px-12 py-16 border-t border-border">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div className="text-3xl font-bold text-primary">4</div>
                        <div className="text-sm text-muted-foreground mt-1">Specialist Agents</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-primary">5</div>
                        <div className="text-sm text-muted-foreground mt-1">Severity Levels</div>
                    </div>
                    <div>
                        <div className="flex items-center justify-center gap-1 text-3xl font-bold text-primary">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Automated on PR Open</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-primary">RAG</div>
                        <div className="text-sm text-muted-foreground mt-1">Codebase Context</div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-6 md:px-12 py-8 border-t border-border text-center text-sm text-muted-foreground">
                Built with Next.js, Gemini AI, Pinecone & Inngest
            </footer>
        </div>
    );
}
