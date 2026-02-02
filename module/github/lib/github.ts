import{Octokit} from "octokit";
import {auth} from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";


//github access token 

export const getGithubToken = async () => {
    const session = await auth.api.getSession({
        headers:await headers()
    })
    if (!session) {
        throw new Error("Unauthorized");
    }

    const account = await prisma.account.findFirst({
        where:{
            userId:session.user.id,
            providerId:"github"
        }
    })
    if (!account?.accessToken) {
        throw new Error("No github access token found");
    }
    return account.accessToken;
}

interface ContributionData {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: {
            contributionDays: {
              contributionCount: number;
              date: string;
              color: string;
            }[];
          }[];
        };
      };
    };
  }

export async function fetchUserContribution(token: string, username: string) {
  const octokit = new Octokit({ auth: token });

  const query = `
        query($username:String!){
            user(login:$username){
                contributionsCollection{
                    contributionCalendar{
                        totalContributions
                        weeks{
                            contributionDays{
                                contributionCount
                                date
                                color          
                            }
                        }
                    }
                }
            }
        }
        `;
  
  try {
    const response = await octokit.graphql<ContributionData>(query, {
      username,
    });

    return response.user.contributionsCollection.contributionCalendar;
  } catch (error) {
    console.error("Error fetching contributions:", error);
    return null;
  }
}

export const getRepositories = async (page: number = 1, perPage: number = 10) => {

    const token = await getGithubToken();
    const octokit = new Octokit({ auth: token });

    const {data} = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        visibility: "all",
        per_page: perPage,
        page:page
    })
    
    return data;
}

export const createWebhook = async (owner:string , repo:string)=>{
    const token = await getGithubToken();
    const octokit = new Octokit({ auth: token });

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`

    const {data:hooks} = await octokit.rest.repos.listWebhooks({
        owner,
        repo
    })

    const existingHook = hooks.find(hook=>hook.config.url === webhookUrl);
    if(existingHook){
        return existingHook
    }

    const {data} = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config:{
            url:webhookUrl,
            content_type:"json"
        },
        events:["pull_request"]
    });

    return data;
}

export const deleteWebhook = async (owner: string, repo: string) => {
    const token = await getGithubToken();
    const octokit = new Octokit({ auth: token });
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;

    try {
        const { data: hooks } = await octokit.rest.repos.listWebhooks({
            owner,
            repo
        });

        const hookToDelete = hooks.find(hook => hook.config.url === webhookUrl);

        if (hookToDelete) {
            await octokit.rest.repos.deleteWebhook({
                owner,
                repo,
                hook_id: hookToDelete.id
            })
        }

        return true;
    } catch (error) {
        console.error("Error deleting webhook:", error);
        return false;
    }
}

export async function getRepoFileContents(
    token:string,
    owner:string,
    repo:string,
    path:string = ""
) {
    const octokit = new Octokit({ auth: token });
    
    try {
        console.log(`Fetching contents for: ${owner}/${repo}${path ? '/' + path : ''}`);
        const {data} = await octokit.rest.repos.getContent({
            owner,
            repo,
            path
        });
     if (!Array.isArray(data)){
        if (data.type === "file"&& data.content){
            return [{
            path:data.path,
            content:Buffer.from(data.content , "base64").toString("utf-8")
        }];
    }
        return[];
     }
     let files: { path: string; content: string }[] = [];

     for(const item of data){
        if(item.type === "file"){
            const {data:fileData} = await octokit.rest.repos.getContent({
                owner,
                repo,
                path:item.path
            })
             if (!Array.isArray(fileData) && fileData.type === "file" && fileData.content){
                if(!item.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)){
                    files.push({
                        path:item.path,
                        content:Buffer.from(fileData.content , "base64").toString("utf-8")
                    });
                }
             }
        }
        else if(item.type === "dir"){
            const subFiles = await getRepoFileContents(token, owner, repo, item.path)
            files= files.concat(subFiles)
        }
     }
    
    return files;
    } catch (error: any) {
        console.error(`Error fetching repo contents for ${owner}/${repo}${path ? '/' + path : ''}:`, error.message);
        if (error.status === 404) {
            throw new Error(`Repository ${owner}/${repo} not found or access denied. Please verify the repository exists and you have access.`);
        }
        throw error;
    }
}