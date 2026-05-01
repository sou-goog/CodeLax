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
  try {
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from AI response", text);
    throw e;
  }
}
