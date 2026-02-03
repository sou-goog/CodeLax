"use server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db"
import { getPullRequestDiff } from "@/module/github/lib/github";

export async function reviewPullRequest(
    owner:string,
    repo:string,
    prNumber:number
) {

    try {

    const repository = await prisma.repository.findFirst({
        where:{
            owner,
            name:repo,
        },
        include:{
            user:{
                include:{
                    account:{
                        where:{
                            providerId:"github"
                        }
                    }
                }
            }
        }
    })
    if(!repository){
        throw new Error(`Respository ${owner}/${repo} not found in database. Please reconnect the repository.`)
    }
    const githubAccount = repository.user.account[0];
    if(!githubAccount?.accessToken){
        throw new Error("No GitHub access token found for repository owner")
    }
    const token = githubAccount.accessToken

    const {title} = await getPullRequestDiff(token, owner , repo , prNumber)
    
    await inngest.send({
        name:"pr.review.requested",
        data:{
            owner,
            repo,
            prNumber,
            userId:repository.userId
        }
    })

    return {succes:true , message:"Review Queued"}
    } catch(error){
        try{
        const repository = await prisma.repository.findFirst({
            where:{
                owner,
                name:repo
            }
        })

        if(repository){
            await prisma.review.create({
                data:{
                    repositoryId:repository.id,
                    prNumber,
                    prTitle:"Failed to fetch PR",
                    prUrl:`https://github.com/${owner}/${repo}/pull/${prNumber}`,
                    review:`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    status:"failed"
                }
            })
        }
        }catch(dbError){
            console.error("Failed to save error to database", dbError)
        }
    }
}