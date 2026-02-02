import { inngest } from "@/inngest/client";
import { getRepoFileContents } from "@/module/github/lib/github";
import prisma from "@/lib/db";
import { indexCodebase } from "@/module/ai/lib/rag";

export const indexRepo = inngest.createFunction(
    {id: "index-repo"},
    {event: "github/index.repo"},

    async ({event , step}) => {
      const {owner , repo , userId} = event.data

      const files = await step.run("fetch-files" , async()=>{
        const account = await prisma.account.findFirst({
          where: {
            userId:userId,
            providerId:"github"
          }
        })

        if (!account){ throw new Error("No github account found");
      }

      if (!account.accessToken) {
        throw new Error("No access token found for github account");
      }

      console.log(`Calling getRepoFileContents with owner: ${owner}, repo: ${repo}`);
      return await getRepoFileContents(account.accessToken , owner , repo)
      })

      await step.run("index-files" , async()=>{
       await indexCodebase(`${owner}/${repo}` , files)
      })

      return {success:true, indexedFiles:files.length}
    }
)