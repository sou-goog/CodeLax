/**
 * Send a Slack notification when critical/high findings are found.
 * Requires SLACK_WEBHOOK_URL env var (Incoming Webhook URL from Slack app).
 * If not configured, notifications are silently skipped.
 */
export async function sendSlackNotification({
  owner,
  repo,
  prNumber,
  prTitle,
  findings,
  overallRisk,
}: {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  findings: { severity: string; title: string; file: string }[];
  overallRisk: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // Slack not configured, skip silently

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  // Only notify on critical or high findings
  if (criticalCount === 0 && highCount === 0) return;

  const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  const riskEmoji = overallRisk === "critical" ? "🔴" : overallRisk === "high" ? "🟠" : "🟡";

  const findingsList = findings
    .filter((f) => ["critical", "high"].includes(f.severity))
    .slice(0, 5)
    .map((f) => `• *${f.severity.toUpperCase()}*: ${f.title} (\`${f.file}\`)`)
    .join("\n");

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${riskEmoji} CodeLax Review Alert`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${prUrl}|${owner}/${repo} #${prNumber}>*\n${prTitle}\n\n*Risk Level:* ${overallRisk.toUpperCase()} | *Critical:* ${criticalCount} | *High:* ${highCount}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top Findings:*\n${findingsList}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View PR", emoji: true },
            url: prUrl,
          },
        ],
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (e) {
    console.error("Failed to send Slack notification:", e);
  }
}
