"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getReviews } from "@/module/review/action"
import { formatDistanceToNow } from "date-fns"

export default function ReviewsPage(){
    const {data:reviews , isLoading} = useQuery({
        queryKey:["reviews"],
        queryFn:async ()=>{
            return await getReviews()
        }
    });

    if (isLoading) {
        return <div>Loading reviews...</div>
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Review History</h1>
                <p className="text-muted-foreground">View all AI code reviews</p>
            </div>

            {
                reviews?.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No reviews yet. Connect a repository and open a PR to get started.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {reviews?.map((review: any) => (
                            <Card key={review.id}>
                                <CardHeader className="pb-2">
                                    {/* Title + Badge */}
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-base">{review.prTitle}</span>
                                        {review.status === "completed" && (
                                            <Badge variant="outline" className="gap-1 text-green-500 border-green-500">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Completed
                                            </Badge>
                                        )}
                                        {review.status === "failed" && (
                                            <Badge variant="destructive" className="gap-1">
                                                <XCircle className="h-3 w-3" />
                                                Failed
                                            </Badge>
                                        )}
                                        {review.status === "pending" && (
                                            <Badge variant="secondary" className="gap-1">
                                                <Clock className="h-3 w-3" />
                                                Pending
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Repo + PR number */}
                                    <p className="text-sm text-muted-foreground">
                                        {review.repository.owner}/{review.repository.name} • PR #{review.prNumber}
                                    </p>

                                    {/* Timestamp */}
                                    <p className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                    </p>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    {/* Review preview box */}
                                    <div className="bg-muted rounded-md p-3 text-sm text-muted-foreground">
                                        <p className="line-clamp-4 whitespace-pre-line font-mono text-xs">
                                            {review.review}
                                        </p>
                                    </div>

                                    {/* View Full Review button */}
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={review.prUrl} target="_blank" rel="noopener noreferrer">
                                            View Full Review on GitHub
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )
            }
        </div>
    )
}
