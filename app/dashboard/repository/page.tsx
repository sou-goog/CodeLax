"use client";
import React from 'react'
import {ExternalLink,Star,Search,Link2,FolderOpen} from "lucide-react"
import {useRef,useEffect,useState} from "react"
import { useRepositories } from "@/module/repository/hooks/use-repositories"
import { useConnectRepository } from "@/module/repository/hooks/use-connect-repository"
import { RepositoryListSkeleton } from "@/module/repository/components/repository-skeleton"

interface RepositoryProps {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    stargazers_count: number
    language: string | null
    topics: string[]
    isConnected?: boolean
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

const RepositoryPage = () => {
    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        isFetchingNextPage,
        hasNextPage
    } = useRepositories()

    const {mutateAsync:connectRepo} = useConnectRepository()

    const [searchQuery, setSearchQuery] = useState('')
    const [localConnectingId, setLocalConnectingId] = useState<number | null>(null)

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

    const allRepositories = data?.pages.flatMap((page) => page) || []
    const filteredRepositories = allRepositories.filter((repo: RepositoryProps) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleConnect = async (repo: RepositoryProps) => {
        setLocalConnectingId(repo.id)
        connectRepo({
                owner:repo.full_name.split('/')[0],
                repo: repo.name,
                githubId: repo.id},
                {
                    onSettled:()=>{
                        setLocalConnectingId(null)
                    }
                }
            )
    }

  return (
    <div className='space-y-6 pb-12'>
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Repositories</h1>
                <p className="text-muted-foreground">Manage your source code and monitor AI-driven code health across projects.</p>
            </div>
        </section>

        {/* Search Bar */}
        <div className="bg-muted border border-border rounded-xl p-4">
            <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                    className="w-full bg-background border border-border focus:border-violet-500 focus:outline-none rounded-lg pl-10 pr-4 py-2 text-sm text-foreground transition-all"
                    placeholder="Search repositories..."
                    type="text"
                    value={searchQuery}
                    onChange={(e)=>setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Repository Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
            {isLoading ? (
                <RepositoryListSkeleton />
            ): isError ? (
                <div className="col-span-full text-center text-muted-foreground py-12">Failed to load repositories.</div>
            ): (
                filteredRepositories.map((repo: RepositoryProps) => (
                    <div key={repo.id} className="bg-card border border-border hover:border-violet-500/50 rounded-xl p-5 transition-all group">
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
                                <span>GitHub</span>
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
                                <Link2 className="w-4 h-4" />
                                {repo.isConnected ? "Connected" : localConnectingId === repo.id ? "Connecting..." : "Connect"}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
        <div ref={observerTarget} className='py-4'>
            {isFetchingNextPage && <RepositoryListSkeleton/>}
            {!hasNextPage && allRepositories.length > 0 &&
                <p className="text-center text-muted-foreground text-sm">All repositories loaded.</p>}
        </div>
    </div>
  )
}

export default RepositoryPage