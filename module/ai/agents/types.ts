export interface AgentFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  file: string;
  line?: number;
  title: string;
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface SpecialistReport {
  agentName: string;
  findings: AgentFinding[];
  summary: string;
  analysisNotes: string;
}

export interface CriticReport {
  verifiedFindings: (AgentFinding & { agentName: string })[];
  rejectedFindings: { finding: AgentFinding; reason: string }[];
  overallRisk: "critical" | "high" | "medium" | "low";
}

export interface FinalReview {
  walkthrough: string;
  summary: string;
  findings: (AgentFinding & { agentName: string })[];
  poem: string;
  mermaidDiagram?: string;
}

export function parseJsonFromText(text: string) {
  // Try multiple strategies to extract JSON
  const strategies = [
    // Strategy 1: fenced code block
    () => {
      const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) return JSON.parse(match[1].trim());
      throw new Error("No fenced block");
    },
    // Strategy 2: raw JSON parse
    () => JSON.parse(text.trim()),
    // Strategy 3: find first { ... } or [ ... ] block
    () => {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(text.slice(start, end + 1));
      }
      throw new Error("No JSON object found");
    },
    // Strategy 4: strip trailing commas and retry
    () => {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const cleaned = text.slice(start, end + 1)
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)\1\s*:/g, '"$2":');
        return JSON.parse(cleaned);
      }
      throw new Error("Cannot repair JSON");
    },
  ];

  for (const strategy of strategies) {
    try {
      return strategy();
    } catch {
      continue;
    }
  }

  console.error("All JSON parse strategies failed for:", text.slice(0, 500));
  throw new Error("Failed to parse JSON from AI response");
}
