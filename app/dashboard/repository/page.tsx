"use client";
import React from 'react'
import {Card,CardHeader,CardTitle,CardDescription} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {ExternalLink,Star,Search} from "lucide-react"
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
            {
                threshold: 0.1
            }
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
    <div className ='space-y-4'>
        <div>
            <h1 className='text-3xl font-bold tracking-tight'>Repositories</h1>
            <p className='text-muted-foreground'>Manage and view all your GitHub repositories</p>
        </div>

            <div className='relative'>
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                <Input 
                placeholder='Search repositories...' 
                className='pl-8 mb-4'
                value={searchQuery}
                onChange={(e)=>setSearchQuery(e.target.value)}
                />
                <div className='grid gap-4'>

                    {isLoading ? (
                         <RepositoryListSkeleton />
                    ): isError ? (
                        <div>Failed to load repositories.</div>
                    ): (
                        filteredRepositories.map((repo: RepositoryProps) => (
                            <Card key={repo.id} className="hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-lg">{repo.name}</CardTitle>
                                                <Badge variant="outline">{repo.language || "Unknown"}</Badge>
                                                {repo.isConnected && <Badge variant="secondary">Connected</Badge>}
                                            </div>
                                            <CardDescription>{repo.description}</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                onClick={() => handleConnect(repo)}
                                                disabled={localConnectingId === repo.id || repo.isConnected}
                                                variant={repo.isConnected ? "outline" : "default"}
                                            >
                                                {repo.isConnected ? "Connected" : localConnectingId === repo.id ? "Connecting..." : "Connect"}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))
                    )}
                </div>
                <div ref={observerTarget} className='py-4'>
                    {isFetchingNextPage && <RepositoryListSkeleton/>}
                    {!hasNextPage && allRepositories.length > 0 && 
                        <p className="text-center text-muted-foreground">No more Repositories</p>}
                </div>
            </div>
    </div>
  )
}


export default RepositoryPage