import { Octokit } from "octokit";

export interface CodeLaxConfig {
  // Which agents to run (default: all)
  agents?: ("security" | "performance" | "logic" | "style")[];
  // Files/patterns to ignore in review
  ignore?: string[];
  // Minimum severity to post inline comments
  minSeverity?: "critical" | "high" | "medium" | "low";
  // Max inline comments per review
  maxInlineComments?: number;
  // Custom review instructions in natural language
  instructions?: string[];
  // Whether to auto-generate PR descriptions
  autoDescription?: boolean;
}

const DEFAULT_CONFIG: CodeLaxConfig = {
  agents: ["security", "performance", "logic", "style"],
  ignore: [],
  minSeverity: "medium",
  maxInlineComments: 5,
  instructions: [],
  autoDescription: true,
};

/**
 * Fetch .codelax.yaml from the repo's default branch.
 * Returns default config if file doesn't exist.
 */
export async function fetchRepoConfig(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<CodeLaxConfig> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".codelax.yaml",
    });

    if ("content" in data && data.type === "file") {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return parseConfig(content);
    }
  } catch (e: unknown) {
    // 404 = file doesn't exist, use defaults
    if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
      return { ...DEFAULT_CONFIG };
    }
    console.error("Error fetching .codelax.yaml:", e);
  }

  return { ...DEFAULT_CONFIG };
}

function parseConfig(yamlContent: string): CodeLaxConfig {
  const config: CodeLaxConfig = { ...DEFAULT_CONFIG };

  // Simple YAML parser for our flat config structure
  const lines = yamlContent.split("\n");
  let currentKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top-level key
    const keyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      currentKey = key;

      if (key === "minSeverity" && value) {
        config.minSeverity = value.trim() as CodeLaxConfig["minSeverity"];
      } else if (key === "maxInlineComments" && value) {
        config.maxInlineComments = parseInt(value.trim(), 10) || 5;
      } else if (key === "autoDescription") {
        config.autoDescription = value.trim() !== "false";
      }
      continue;
    }

    // List item
    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && currentKey) {
      const item = listMatch[1].trim().replace(/^["']|["']$/g, "");
      if (currentKey === "agents") {
        if (!config.agents) config.agents = [];
        config.agents.push(item as "security" | "performance" | "logic" | "style");
      } else if (currentKey === "ignore") {
        if (!config.ignore) config.ignore = [];
        config.ignore.push(item);
      } else if (currentKey === "instructions") {
        if (!config.instructions) config.instructions = [];
        config.instructions.push(item);
      }
    }
  }

  return config;
}
