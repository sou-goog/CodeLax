import { pineconeIndex } from "@/lib/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function generateEmbeddings(text: string) {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent({
        content: { parts: [{ text }], role: "user" },
        taskType: "RETRIEVAL_DOCUMENT",
    });
    return result.embedding.values;
}


export async function indexCodebase(repoId:string , files:{path:string; content:string}[]) {
    const vectors = [];
    for(const file of files){
        const content = `File: ${file.path}\n\n${file.content}`;

        const truncatedContent = content.slice(0 , 8000)

        try {
            const embedding = await generateEmbeddings(truncatedContent);
            vectors.push({
                id:`${repoId}-${file.path.replace(/\//g , "_")}`,
                values:embedding,
                metadata:{
                    repoId,
                    path:file.path,
                    content:truncatedContent
                }
            })
        }catch (e){
            console.error(`Failed to embed ${file.path}:`, e);
        }
    }
    if (vectors.length > 0){
        const batchSize = 100;
        
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            await pineconeIndex.upsert({ records: batch })
        }
    }
    console.log("indexing completed")
}

export async function retrieveContext(query:string , repoId:string , topK:number = 5){
    const embedding = await generateEmbeddings(query);
    const results = await pineconeIndex.query({
        vector:embedding,
        filter:{repoId},
        topK,
        includeMetadata:true
    });

    return results.matches.map(match => match.metadata?.content as string).filter(Boolean);
}