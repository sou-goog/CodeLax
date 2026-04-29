import { PrismaClient } from "./lib/generated/prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
    console.log("Starting DB test...");
    try {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 1000,
            connectionTimeoutMillis: 30000, // 30 seconds
        });
        
        const adapter = new PrismaPg(pool);
        const prisma = new PrismaClient({ adapter });
        
        const owner = "sou-goog";
        const repo = "testing-repo";
        const prNumber = 2;
        const title = "test title";
        const review = "test review";

        const repository = await prisma.repository.findFirst({
            where:{
                owner,
                name:repo
            }
        });

        if(repository){
            console.log("Found repo", repository.id);
            await prisma.review.create({
                data: {
                    repositoryId: repository.id,
                    prNumber,
                    prTitle: title,
                    prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                    review,
                    status: "completed",
                },
            });
            console.log("Success!");
        } else {
            console.log("Repo not found");
        }
        
        await prisma.$disconnect();
    } catch(e) {
        console.error("Error:", e);
    }
}
main();
