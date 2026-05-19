"use client";
import React from 'react'
import { ExternalLink, Star, Search, Link2, FolderOpen, Github, GitlabIcon, Loader2 } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRepositories } from "@/module/repository/hooks/use-repositories"
import { useConnectRepository } from "@/module/repository/hooks/use-connect-repository"
import { RepositoryListSkeleton } from "@/module/repository/components/repository-skeleton"
import { fetchGitLabRepositories, fetchBitbucketRepositories, connectExternalRepository } from "@/module/repository/actions"
import { toast } from "sonner"

type Provider = "github" | "gitlab" | "bitbucket";

interface RepositoryProps {
    id: number | string
    name: string
    full_name: string
    description: string | null
    html_url: string
    stargazers_count: number
    language: string | null
    topics?: string[]
    isConnected?: boolean
    owner?: { login: string }
    provider?: Provider
}

const languageColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    JavaScript: "bg-yellow-400",
    Python: "bg-green-500",
    Rust: "bg-orange-500",
    Go: "bg-cyan-400",
    Java: "bg-red-500",
    CSS: "bg-purple-400",
    HTML: "bg-orange-400",
}

const providerTabs: { id: Provider; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "github", label: "GitHub", icon: <Github className="w-4 h-4" />, color: "violet" },
    { id: "gitlab", label: "GitLab", icon: <GitlabIcon className="w-4 h-4" />, color: "orange" },
    { id: "bitbucket", label: "Bitbucket", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.65 3C2.3 3 2 3.3 2 3.65v.12l2.73 16.5c.07.42.43.73.85.73h13.05c.32 0 .59-.22.64-.54L22 3.77v-.12c0-.35-.3-.65-.65-.65H2.65zM14.1 14.95H9.9L8.72 9.05h6.56l-1.18 5.9z"/></svg>, color: "blue" },
]

const RepositoryPage = () => {
    const [activeProvider, setActiveProvider] = useState<Provider>("github")
    const [searchQuery, setSearchQuery] = useState('')
    const [localConnectingId, setLocalConnectingId] = useState<number | string | null>(null)
    const queryClient = useQueryClient()

    // GitHub repos (existing infinite query)
    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        isFetchingNextPage,
        hasNextPage
    } = useRepositories()

    const { mutateAsync: connectRepo } = useConnectRepository()

    // GitLab repos
    const { data: gitlabRepos = [], isLoading: gitlabLoading } = useQuery({
        queryKey: ["gitlab-repositories"],
        queryFn: () => fetchGitLabRepositories(1, 50),
        enabled: activeProvider === "gitlab",
        staleTime: 1000 * 60 * 5,
    })

    // Bitbucket repos
    const { data: bitbucketRepos = [], isLoading: bitbucketLoading } = useQuery({
        queryKey: ["bitbucket-repositories"],
        queryFn: () => fetchBitbucketRepositories(1, 50),
        enabled: activeProvider === "bitbucket",
        staleTime: 1000 * 60 * 5,
    })

    // Connect external repo mutation
    const connectExternalMutation = useMutation({
        mutationFn: async (repo: RepositoryProps) => {
            const ownerLogin = repo.owner?.login || repo.full_name.split("/")[0];
            return await connectExternalRepository(
                ownerLogin,
                repo.name,
                repo.full_name,
                (repo.provider || activeProvider) as "gitlab" | "bitbucket",
                String(repo.id),
                repo.html_url,
            );
        },
        onSuccess: () => {
            toast.success("Repository connected!");
            queryClient.invalidateQueries({ queryKey: ["gitlab-repositories"] });
            queryClient.invalidateQueries({ queryKey: ["bitbucket-repositories"] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to connect repository");
        },
        onSettled: () => setLocalConnectingId(null),
    })

    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                   fetchNextPage()
                }
            },
            { threshold: 0.1 }
        )

        const currentTarget = observerTarget.current
        if(currentTarget){
            observer.observe(currentTarget)
        }

        return ()=>{
            if(currentTarget){
                observer.unobserve(currentTarget)
            }
        }
    }, [hasNextPage , isFetchingNextPage , fetchNextPage])

    // Get repos for active provider
    const getRepos = (): RepositoryProps[] => {
        if (activeProvider === "github") {
            return data?.pages.flatMap((page) => page) || []
        }
        if (activeProvider === "gitlab") return gitlabRepos
        if (activeProvider === "bitbucket") return bitbucketRepos
        return []
    }

    const getIsLoading = () => {
        if (activeProvider === "github") return isLoading
        if (activeProvider === "gitlab") return gitlabLoading
        if (activeProvider === "bitbucket") return bitbucketLoading
        return false
    }

    const allRepositories = getRepos()
    const filteredRepositories = allRepositories.filter((repo: RepositoryProps) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleConnect = async (repo: RepositoryProps) => {
        setLocalConnectingId(repo.id)
        if (activeProvider === "github") {
            connectRepo({
                owner: repo.full_name.split('/')[0],
                repo: repo.name,
                githubId: repo.id as number
            }, {
                onSettled: () => setLocalConnectingId(null)
            })
        } else {
            connectExternalMutation.mutate({ ...repo, provider: activeProvider })
        }
    }

    const providerLabel = providerTabs.find(t => t.id === activeProvider)?.label || "GitHub"

  return (
    <div className='space-y-6 pb-12'>
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Repositories</h1>
                <p className="text-muted-foreground">Manage your source code and monitor AI-driven code health across projects.</p>
            </div>
        </section>

        {/* Provider Tabs */}
        <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1 w-fit">
            {providerTabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => { setActiveProvider(tab.id); setSearchQuery(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeProvider === tab.id
                            ? "bg-background text-foreground shadow-sm border border-border"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Search Bar */}
        <div className="bg-muted border border-border rounded-xl p-4">
            <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                    className="w-full bg-background border border-border focus:border-violet-500 focus:outline-none rounded-lg pl-10 pr-4 py-2 text-sm text-foreground transition-all"
                    placeholder={`Search ${providerLabel} repositories...`}
                    type="text"
                    value={searchQuery}
                    onChange={(e)=>setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* No account linked message */}
        {activeProvider !== "github" && !getIsLoading() && allRepositories.length === 0 && (
            <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                    {providerTabs.find(t => t.id === activeProvider)?.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground">No {providerLabel} account linked</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    {activeProvider === "gitlab"
                        ? "Sign in with GitLab from the login page to connect your repositories, or link your GitLab account in Settings."
                        : "Add your Bitbucket access token in Settings to connect repositories."}
                </p>
            </div>
        )}

        {/* Repository Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
            {getIsLoading() ? (
                <RepositoryListSkeleton />
            ): isError && activeProvider === "github" ? (
                <div className="col-span-full text-center text-muted-foreground py-12">Failed to load repositories.</div>
            ): (
                filteredRepositories.map((repo: RepositoryProps) => (
                    <div key={`${activeProvider}-${repo.id}`} className="bg-card border border-border hover:border-violet-500/50 rounded-xl p-5 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-violet-400">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground group-hover:text-violet-400 transition-colors">{repo.name}</h3>
                                    <p className="text-xs text-muted-foreground">{repo.full_name}</p>
                                </div>
                            </div>
                            {repo.isConnected ? (
                                <div className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20">Active</div>
                            ) : (
                                <div className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-border">Inactive</div>
                            )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-6 line-clamp-2">{repo.description || "No description provided."}</p>

                        <div className="flex items-center gap-4 mb-6 border-y border-border/50 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Star className="w-3.5 h-3.5" />
                                <span>{repo.stargazers_count}</span>
                            </div>
                            {repo.language && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className={`w-2.5 h-2.5 rounded-full ${languageColors[repo.language] || "bg-zinc-500"}`} />
                                    <span>{repo.language}</span>
                                </div>
                            )}
                            <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto hover:text-violet-400 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{providerLabel}</span>
                            </a>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                onClick={() => handleConnect(repo)}
                                disabled={localConnectingId === repo.id || repo.isConnected}
                                className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                                    repo.isConnected
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20"
                                }`}
                            >
                                {localConnectingId === repo.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Link2 className="w-4 h-4" />
                                )}
                                {repo.isConnected ? "Connected" : localConnectingId === repo.id ? "Connecting..." : "Connect"}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
        {activeProvider === "github" && (
            <div ref={observerTarget} className='py-4'>
                {isFetchingNextPage && <RepositoryListSkeleton/>}
                {!hasNextPage && allRepositories.length > 0 &&
                    <p className="text-center text-muted-foreground text-sm">All repositories loaded.</p>}
            </div>
        )}
    </div>
  )
}

export default RepositoryPage