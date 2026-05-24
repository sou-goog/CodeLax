import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

/**
 * Multi-provider model rotation with automatic fallback.
 * 
 * Role-specific model tiers:
 *   - critic / synthesizer: strongest available models (reasoning-heavy tasks)
 *   - specialist: standard quality models (bulk analysis)
 *   - planner: lightweight models (small JSON output)
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

type ModelTier = "strong" | "standard" | "light";

function buildProviderChain(): Record<ModelTier, ProviderEntry[]> {
  const strong: ProviderEntry[] = [];
  const standard: ProviderEntry[] = [];
  const light: ProviderEntry[] = [];

  // --- Collect Groq keys ---
  const groqKeys: string[] = [];
  if (process.env.GROQ_API_KEY) {
    groqKeys.push(...process.env.GROQ_API_KEY.split(",").map((k) => k.trim()).filter(Boolean));
  }
  for (let n = 2; n <= 10; n++) {
    const key = process.env[`GROQ_API_KEY_${n}`];
    if (key) groqKeys.push(key.trim());
  }

  // Groq 70B → strong + standard + light tier
  for (let i = 0; i < groqKeys.length; i++) {
    const groq = createGroq({ apiKey: groqKeys[i] });
    const entry: ProviderEntry = {
      name: `groq-70b-${i + 1}`,
      model: groq("llama-3.3-70b-versatile") as any,
    };
    strong.push(entry);
    standard.push(entry);
    light.push(entry);
  }

  // OpenRouter (strong quality free model)
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const entry: ProviderEntry = {
      name: "openrouter-gemini-free",
      model: openrouter("google/gemini-2.0-flash-exp:free") as any,
    };
    strong.push(entry);
    standard.push(entry);
  }

  // Google Gemini Flash (standard + light)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    standard.push({
      name: "google-gemini-flash",
      model: google("gemini-2.0-flash-lite") as any,
    });
    // Light tier: use the same lite model — fast and cheap for planner
    light.push({
      name: "google-gemini-lite",
      model: google("gemini-2.0-flash-lite") as any,
    });
  }

  // Ensure every tier has at least the full chain as fallback
  const allEntries = [...strong, ...standard, ...light];
  if (allEntries.length === 0) {
    throw new Error("No AI provider API keys configured. Set at least GROQ_API_KEY.");
  }

  // Fill empty tiers with whatever is available
  if (strong.length === 0) strong.push(...standard, ...light);
  if (standard.length === 0) standard.push(...strong, ...light);
  if (light.length === 0) light.push(...standard, ...strong);

  console.log(`[model-provider] Strong: ${strong.map((p) => p.name).join(" → ")}`);
  console.log(`[model-provider] Standard: ${standard.map((p) => p.name).join(" → ")}`);
  console.log(`[model-provider] Light: ${light.map((p) => p.name).join(" → ")}`);
  return { strong, standard, light };
}

let providerChains: Record<ModelTier, ProviderEntry[]> | null = null;

function getChain(tier: ModelTier = "standard"): ProviderEntry[] {
  if (!providerChains) {
    providerChains = buildProviderChain();
  }
  return providerChains[tier];
}

// Role → tier mapping
const ROLE_TIER: Record<string, ModelTier> = {
  critic: "strong",
  synthesizer: "strong",
  specialist: "standard",
  planner: "light",
};

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
 * Returns the first available model from the provider chain for the given role.
 * Critic and Synthesizer get the strongest models; Planner gets lightweight.
 */
export function getModel(role: "specialist" | "planner" | "critic" | "synthesizer") {
  const tier = ROLE_TIER[role] ?? "standard";
  const chain = getChain(tier);
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
  // Determine tier from the model being passed in — find which chain it belongs to
  const allChains = providerChains ?? buildProviderChain();
  let chain = allChains.standard;
  for (const [, tierChain] of Object.entries(allChains)) {
    if (tierChain.some((p) => p.model === options.model)) {
      chain = tierChain;
      break;
    }
  }
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
