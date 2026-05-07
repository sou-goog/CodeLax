import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Returns a model with automatic fallback.
 * Primary: Groq llama-3.3-70b (fast, 100K TPD free limit)
 * Fallback: Gemini 2.0 flash-lite (generous free tier)
 */
export function getModel(role: "specialist" | "planner" | "critic" | "synthesizer") {
  return groq("llama-3.3-70b-versatile");
}

export function getFallbackModel() {
  return google("gemini-2.0-flash-lite");
}

/**
 * Generate text with automatic provider fallback.
 * Tries Groq first, falls back to Gemini on rate limit errors.
 */
export async function generateTextWithFallback(
  options: Parameters<typeof import("ai").generateText>[0]
): Promise<string> {
  const { generateText } = await import("ai");

  try {
    const result = await generateText(options);
    return result.text;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMsg.includes("Rate limit") || 
                        errorMsg.includes("429") || 
                        errorMsg.includes("quota") ||
                        errorMsg.includes("TPD");

    if (isRateLimit) {
      console.warn(`[model-provider] Groq rate limited, falling back to Gemini`);
      const fallbackModel = getFallbackModel();
      const result = await generateText({
        ...options,
        model: fallbackModel,
      });
      return result.text;
    }

    throw error;
  }
}
