import {pineconeIndex} from "@/lib/pinecone";
import {embed} from "ai";
import {google} from "@ai-sdk/google";

export async function generateEmbeddings(text:string) {
    const {embedding} = await embed ({
        model:google.textEmbedding("gemini-embedding-2"),
        value:text
    })

    return embedding;
}


const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 200;

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
    if (text.length <= chunkSize) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

export async function indexCodebase(repoId:string , files:{path:string; content:string}[]) {
    const vectors = [];
    for(const file of files){
        const fullContent = `File: ${file.path}\n\n${file.content}`;
        const chunks = chunkText(fullContent);

        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await generateEmbeddings(chunks[i]);
                vectors.push({
                    id: `${repoId}-${file.path.replace(/\//g , "_")}-chunk${i}`,
                    values: embedding,
                    metadata: {
                        repoId,
                        path: file.path,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        content: chunks[i]
                    }
                });
            } catch (e) {
                console.error(`Failed to embed ${file.path} chunk ${i}:`, e);
            }
        }
    }
    if (vectors.length > 0){
        const batchSize = 100;
        
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            await pineconeIndex.upsert({ records: batch })
        }
    }
    console.log(`Indexing completed: ${vectors.length} chunks from ${files.length} files`)
}

export async function retrieveContext(query:string , repoId:string , topK:number = 10){
    const embedding = await generateEmbeddings(query);
    const results = await pineconeIndex.query({
        vector:embedding,
        filter:{repoId},
        topK,
        includeMetadata:true
    });

    // Deduplicate by file path — keep the highest scoring chunk per file
    const bestByFile = new Map<string, { content: string; score: number }>();
    for (const match of results.matches) {
        const path = match.metadata?.path as string || "unknown";
        const content = match.metadata?.content as string;
        const score = match.score ?? 0;
        if (!content) continue;
        const existing = bestByFile.get(path);
        if (!existing || score > existing.score) {
            bestByFile.set(path, { content, score });
        }
    }

    return Array.from(bestByFile.values())
        .sort((a, b) => b.score - a.score)
        .map(v => v.content);
}