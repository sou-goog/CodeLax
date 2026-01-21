"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getConnectedRepositories, disconnectRepository, disconnectAllRepository, getUserProfile } from "@/module/settings/actions"
import { toast } from "sonner"
import { ExternalLink, Trash2, AlertTriangle } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export function RepositoryList() {
    const queryClient = useQueryClient();

    const [disconnectedAllOpen, setDisconnectedAllOpen] = useState(false);

    const { data: repositories, isLoading } = useQuery({
        queryKey: ["connected-repositories"],
        queryFn: async () => await getConnectedRepositories(),
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
    })

    const disconnectMutation = useMutation({
        mutationFn: async (repositoryId: string) => {
            return await disconnectRepository(repositoryId)
        },
        onSuccess: (result) => {
            if (result?.success) {
                queryClient.invalidateQueries({ queryKey: ["connected-repositories"] })
                queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
                toast.success("Repository disconnected successfully")
            } else {
                toast.error(result?.error || "Failed to disconnect repository")
            }
        },
    })
    const disconnectAllMutation = useMutation({
        mutationFn: async () => {
            return await disconnectAllRepository()
        },
        onSuccess: (result) => {
            if (result?.success) {
                queryClient.invalidateQueries({ queryKey: ["connected-repositories"] })
                queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
                toast.success(`Disconnected ${result.count} repositories`)
                setDisconnectedAllOpen(false)
            } else {
                toast.error(result?.error || "Failed to disconnect repositories")
            }
        },
    })

    const { data: user } = useQuery({
        queryKey: ["user-profile"],
        queryFn: async () => await getUserProfile(),
    })

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Connected Repositories</CardTitle>
                    <CardDescription>Manage your connected GitHub repositories</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-4">
                        <div className="h-20 bg-muted rounded"></div>
                        <div className="h-20 bg-muted rounded"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Connected Repositories</CardTitle>
                        <CardDescription>Manage your connected GitHub repositories</CardDescription>
                    </div>
                    {repositories && repositories.length > 0 && (
                        <AlertDialog open={disconnectedAllOpen} onOpenChange={setDisconnectedAllOpen}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Disconnect All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-destructive" />
                                        Disconnect All Repositories?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will disconnect all {repositories.length} repositories and delete
                                        all associated AI reviews.
                                        This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => disconnectAllMutation.mutate()}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={disconnectAllMutation.isPending}
                                    >
                                        {disconnectAllMutation.isPending ? "Disconnecting..." : "Disconnect All"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {(!repositories || repositories.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No repositories connected yet.</p>
                        <p className="text-sm mt-2">Connect repositories from the Repository page.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {repositories.map((repo) => (
                            <div
                                key={repo.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold truncate">{repo.fullName}</h3>
                                        <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </div>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Disconnect Repository?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will disconnect <strong>{repo.fullName}</strong> and delete
                                                all associated AI reviews.
                                                This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => disconnectMutation.mutate(repo.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                disabled={disconnectMutation.isPending}
                                            >
                                                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function RepositoryCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-9" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                </div>
            </CardContent>
        </Card>
    )
}

export function RepositoryListSkeleton() {
    return (
        <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <RepositoryCardSkeleton key={i} />
            ))}
        </div>
    )
}
