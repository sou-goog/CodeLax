"use client"
import { signIn } from "@/lib/auth-client"
import { Github as GithubIcon, ShieldCheck, Zap, BrainCircuit, Terminal, GitlabIcon } from "lucide-react"
import { useState } from 'react'

const LoginUI = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

    const handleGithubLogin = async () => {
        setIsLoading(true)
        setLoadingProvider("github")
        try {
            await signIn.social({
                provider: "github"
            })
        } catch (error) {
            console.error("Login error:", error)
            setIsLoading(false)
            setLoadingProvider(null)
        }
    }

    const handleGitlabLogin = async () => {
        setIsLoading(true)
        setLoadingProvider("gitlab")
        try {
            await signIn.social({
                provider: "gitlab"
            })
        } catch (error) {
            console.error("Login error:", error)
            setIsLoading(false)
            setLoadingProvider(null)
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
            {/* Left Section - Hero Content */}
            <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-12 lg:py-16 bg-muted/50">
                <div className="max-w-lg mx-auto">
                    <div className="mb-12 lg:mb-16">
                        <div className="inline-flex items-center gap-2 text-2xl font-bold text-foreground">
                            <Terminal className="w-6 h-6 text-violet-500" />
                            <span>CodeLax</span>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-semibold mb-6 leading-tight tracking-tight text-foreground">
                        Cut Code Review Time & Bugs in Half.{" "}
                        <span className="block bg-gradient-to-r from-[#d2bbff] to-[#7c3aed] bg-clip-text text-transparent">Instantly.</span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed mb-10">
                        Supercharge your team to ship faster with the most advanced AI code reviews.
                    </p>

                    <div className="space-y-4 hidden lg:block">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <ShieldCheck className="w-5 h-5 text-violet-400 shrink-0" />
                            <span>Multi-agent security, performance & logic analysis</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <BrainCircuit className="w-5 h-5 text-violet-400 shrink-0" />
                            <span>RAG-powered codebase context understanding</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Zap className="w-5 h-5 text-violet-400 shrink-0" />
                            <span>Automated reviews on every pull request</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-8 md:px-12 py-12 lg:py-16">
                <div className="w-full max-w-sm">
                    <div className="mb-10">
                        <h2 className="text-3xl font-semibold text-foreground mb-2">Welcome Back</h2>
                        <p className="text-muted-foreground">Sign in with your account to get started.</p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleGithubLogin}
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 shadow-lg shadow-violet-600/20"
                        >
                            <GithubIcon size={20} />
                            {loadingProvider === "github" ? "Signing in..." : "Continue with GitHub"}
                        </button>

                        <div className="flex items-center gap-3 my-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">or</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <button
                            onClick={handleGitlabLogin}
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-[#fc6d26] text-white rounded-lg font-semibold hover:bg-[#e65a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20"
                        >
                            <GitlabIcon size={20} />
                            {loadingProvider === "gitlab" ? "Signing in..." : "Continue with GitLab"}
                        </button>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        By continuing, you agree to CodeLax&apos;s Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default LoginUI