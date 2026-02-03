import { NextResponse, NextRequest } from "next/server";
import { reviewPullRequest } from "@/module/ai/actions";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const event = req.headers.get("x-github-event");

        if (event === "ping") {
            return NextResponse.json({ message: "Pong" }, { status: 200 })
        }

        if(event === "pull_request"){
            const action = body.action;
            const repo = body.repository;
            const prNumber = body.number;

            const [owner , repoName] = repo.full_name.split("/");

            if(action === "opened" || action === "synchronize"){
                reviewPullRequest(owner , repoName , prNumber)
                .then(()=>console.log(`Review completed for ${repo} #${prNumber}`))
                .catch((error: unknown)=>console.log(`Review failed for ${repo} #${prNumber}:` , error))
            }
        }

        // TODO: HANDLE LATER

        return NextResponse.json({ message: "Event Processes" }, { status: 200 })
    } catch (error: unknown) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
