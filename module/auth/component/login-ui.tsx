"use client"
import { signIn } from "@/lib/auth-client"
import { Github as GithubIcon, ShieldCheck, Zap, BrainCircuit } from "lucide-react"
import { useState } from 'react'

const LoginUI = () => {
    const [isLoading, setIsLoading] = useState(false)

    const handleGithubLogin = async () => {
        setIsLoading(true)
        try {
            await signIn.social({
                provider: "github"
            })
        } catch (error) {
            console.error("Login error:", error)
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
            {/* Left Section - Hero Content */}
            <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-12 lg:py-16 bg-muted/50">
                <div className="max-w-lg mx-auto">
                    {/* Logo */}
                    <div className="mb-12 lg:mb-16">
                        <div className="inline-flex items-center gap-2 text-2xl font-bold">
                            <div className="w-8 h-8 bg-primary rounded-full" />
                            <span>CodeLax</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-balance">
                        Cut Code Review Time & Bugs in Half. <span className="block">Instantly.</span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed mb-10">
                        Supercharge your team to ship faster with the most advanced AI code reviews.
                    </p>

                    {/* Feature highlights */}
                    <div className="space-y-4 hidden lg:block">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                            <span>Multi-agent security, performance & logic analysis</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <BrainCircuit className="w-5 h-5 text-primary shrink-0" />
                            <span>RAG-powered codebase context understanding</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Zap className="w-5 h-5 text-primary shrink-0" />
                            <span>Automated reviews on every pull request</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-8 md:px-12 py-12 lg:py-16">
                <div className="w-full max-w-sm">
                    <div className="mb-10">
                        <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                        <p className="text-muted-foreground">Sign in with your GitHub account to get started.</p>
                    </div>

                    {/* GitHub Login Button */}
                    <button
                        onClick={handleGithubLogin}
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
                    >
                        <GithubIcon size={20} />
                        {isLoading ? "Signing in..." : "Continue with GitHub"}
                    </button>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        By continuing, you agree to CodeLax&apos;s Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default LoginUI