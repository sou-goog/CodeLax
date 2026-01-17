import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function RepositoryCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4 animate-pulse">
                    <div className="space-y-2 flex-1">
                        {/* Title and Badge placeholder */}
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-32 bg-muted rounded" />
                            <div className="h-5 w-16 bg-muted rounded" />
                        </div>
                        {/* Description placeholder */}
                        <div className="space-y-1 mt-2">
                             <div className="h-4 w-[75%] bg-muted rounded" />
                             <div className="h-4 w-[50%] bg-muted rounded" />
                        </div>
                    </div>
                    {/* Buttons placeholder */}
                    <div className="flex gap-2">
                        <div className="h-9 w-9 bg-muted rounded" />
                        <div className="h-9 w-24 bg-muted rounded" />
                    </div>
                </div>
            </CardHeader>
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