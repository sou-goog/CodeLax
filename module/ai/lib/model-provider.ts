import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

/**
 * Multi-provider model rotation with automatic fallback.
 * 
 * Priority order (best quality first):
 *   1. Groq llama-3.3-70b-versatile (100K TPD per key — supports multiple keys)
 *   2. OpenRouter google/gemini-2.0-flash-exp:free (free, excellent quality)
 *   3. Google gemini-2.0-flash-lite (free tier fallback)
 * 
 * Environment variables:
 *   GROQ_API_KEY        — single key, OR comma-separated for rotation: "key1,key2,key3"
 *   OPENROUTER_API_KEY  — optional, enables OpenRouter free models
 *   GOOGLE_GENERATIVE_AI_API_KEY — optional, enables Google Gemini fallback
 */

// --- Build the provider chain at startup ---

interface ProviderEntry {
  name: string;
  model: ReturnType<typeof createGroq> extends (id: string) => infer R ? R : any;
}

function buildProviderChain(): ProviderEntry[] {
  const chain: ProviderEntry[] = [];

  // 1. Groq keys (supports comma-separated AND separate env vars: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3...)
  const groqKeys: string[] = [];

  // Collect from GROQ_API_KEY (may be comma-separated)
  if (process.env.GROQ_API_KEY) {
    groqKeys.push(...process.env.GROQ_API_KEY.split(",").map((k) => k.trim()).filter(Boolean));
  }
  // Collect from GROQ_API_KEY_2, GROQ_API_KEY_3, etc.
  for (let n = 2; n <= 10; n++) {
    const key = process.env[`GROQ_API_KEY_${n}`];
    if (key) groqKeys.push(key.trim());
  }

  for (let i = 0; i < groqKeys.length; i++) {
    const groq = createGroq({ apiKey: groqKeys[i] });
    chain.push({
      name: `groq-${i + 1}`,
      model: groq("llama-3.3-70b-versatile") as any,
    });
  }

  // 2. OpenRouter (free Gemini flash)
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    chain.push({
      name: "openrouter-gemini-free",
      model: openrouter("google/gemini-2.0-flash-exp:free") as any,
    });
  }

  // 3. Google Gemini (final fallback)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    chain.push({
      name: "google-gemini-lite",
      model: google("gemini-2.0-flash-lite") as any,
    });
  }

  if (chain.length === 0) {
    throw new Error("No AI provider API keys configured. Set at least GROQ_API_KEY.");
  }

  console.log(`[model-provider] Chain: ${chain.map((p) => p.name).join(" → ")}`);
  return chain;
}

let providerChain: ProviderEntry[] | null = null;

function getChain(): ProviderEntry[] {
  if (!providerChain) {
    providerChain = buildProviderChain();
  }
  return providerChain;
}

// Track which providers are temporarily exhausted (reset after 1 hour)
const exhaustedUntil = new Map<string, number>();

function isExhausted(name: string): boolean {
  const until = exhaustedUntil.get(name);
  if (!until) return false;
  if (Date.now() > until) {
    exhaustedUntil.delete(name);
    return false;
  }
  return true;
}

function markExhausted(name: string) {
  // Mark as exhausted for 1 hour
  exhaustedUntil.set(name, Date.now() + 60 * 60 * 1000);
  console.warn(`[model-provider] ${name} marked exhausted for 1 hour`);
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Rate limit") ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("TPD") ||
    msg.includes("rate_limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

/**
 * Returns the first available model from the provider chain.
 */
export function getModel(_role: "specialist" | "planner" | "critic" | "synthesizer") {
  const chain = getChain();
  for (const entry of chain) {
    if (!isExhausted(entry.name)) {
      return entry.model;
    }
  }
  // All exhausted — try the first one anyway (it may have reset)
  return chain[0].model;
}

/**
 * Generate text with automatic provider rotation.
 * Tries each provider in the chain until one succeeds.
 * Rate-limited providers are temporarily skipped.
 */
export async function generateTextWithFallback(
  options: Parameters<typeof generateText>[0]
): Promise<string> {
  const chain = getChain();
  const availableProviders = chain.filter((p) => !isExhausted(p.name));
  const providers = availableProviders.length > 0 ? availableProviders : chain;

  let lastError: unknown;

  for (const provider of providers) {
    try {
      const result = await generateText({
        ...options,
        model: provider.model,
      });
      return result.text;
    } catch (error: unknown) {
      lastError = error;

      if (isRateLimitError(error)) {
        markExhausted(provider.name);
        console.warn(`[model-provider] ${provider.name} rate limited, trying next...`);
        continue;
      }

      // Non-rate-limit error — still try next provider
      console.error(`[model-provider] ${provider.name} failed:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  throw lastError ?? new Error("All AI providers failed");
}
