/**
 * Git Provider Abstraction Layer
 *
 * Abstracts away GitHub/GitLab/Bitbucket API differences so the review
 * pipeline can work with any provider.
 */

import { Octokit } from "octokit";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PRData {
  title: string;
  description: string;
  diff: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
}

export interface InlineComment {
  file: string;
  line: number;
  body: string;
}

export interface GitProvider {
  /** Fetch PR/MR metadata and diff */
  fetchPR(owner: string, repo: string, prNumber: number): Promise<PRData>;

  /** Fetch incremental diff between two commits */
  fetchIncrementalDiff(owner: string, repo: string, base: string, head: string): Promise<string>;

  /** Post a summary comment on the PR/MR */
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;

  /** Post inline comments on specific lines */
  postInlineComments(owner: string, repo: string, prNumber: number, commitSha: string, comments: InlineComment[]): Promise<void>;

  /** Add labels to the PR/MR */
  addLabels(owner: string, repo: string, prNumber: number, labels: string[]): Promise<void>;

  /** Create/update a status check */
  createCheckRun?(owner: string, repo: string, headSha: string, status: "in_progress" | "completed", conclusion?: string, output?: { title: string; summary: string }): Promise<number | null>;

  /** Update an existing check run */
  updateCheckRun?(owner: string, repo: string, checkRunId: number, status: "completed", conclusion: string, output: { title: string; summary: string }): Promise<void>;
}

// ─── GitHub Provider ─────────────────────────────────────────────────────────

export class GitHubProvider implements GitProvider {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async fetchPR(owner: string, repo: string, prNumber: number): Promise<PRData> {
    const [{ data: pr }, { data: diffData }] = await Promise.all([
      this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
      this.octokit.rest.pulls.get({
        owner, repo, pull_number: prNumber,
        mediaType: { format: "diff" },
      }),
    ]);

    return {
      title: pr.title,
      description: pr.body ?? "",
      diff: diffData as unknown as string,
      headSha: pr.head.sha,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
    };
  }

  async fetchIncrementalDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const { data } = await this.octokit.rest.repos.compareCommits({
      owner, repo, base, head,
      mediaType: { format: "diff" },
    });
    return data as unknown as string;
  }

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner, repo, issue_number: prNumber, body,
    });
  }

  async postInlineComments(owner: string, repo: string, prNumber: number, commitSha: string, comments: InlineComment[]): Promise<void> {
    for (const c of comments) {
      try {
        await this.octokit.rest.pulls.createReviewComment({
          owner, repo, pull_number: prNumber,
          commit_id: commitSha, path: c.file, line: c.line, body: c.body,
        });
      } catch (e) {
        console.error(`[GitHub] Failed inline comment on ${c.file}:${c.line}`, e);
      }
    }
  }

  async addLabels(owner: string, repo: string, prNumber: number, labels: string[]): Promise<void> {
    const colorMap: Record<string, string> = {
      "critical-issues": "d73a4a",
      "needs-fix": "e4a221",
      "security-concern": "b60205",
      "ai-approved": "0e8a16",
    };

    for (const label of labels) {
      try {
        await this.octokit.rest.issues.getLabel({ owner, repo, name: label });
      } catch {
        await this.octokit.rest.issues.createLabel({
          owner, repo, name: label,
          color: colorMap[label] || "ededed",
          description: "Auto-applied by CodeLax AI review",
        });
      }
    }
    await this.octokit.rest.issues.addLabels({ owner, repo, issue_number: prNumber, labels });
  }

  async createCheckRun(owner: string, repo: string, headSha: string, status: "in_progress" | "completed", conclusion?: string, output?: { title: string; summary: string }): Promise<number | null> {
    try {
      const { data } = await this.octokit.rest.checks.create({
        owner, repo, name: "CodeLax AI Review",
        head_sha: headSha, status,
        ...(conclusion && { conclusion: conclusion as "success" | "failure" | "neutral" }),
        ...(output && { output }),
        started_at: new Date().toISOString(),
      });
      return data.id;
    } catch (e) {
      console.error("[GitHub] Failed to create check run:", e);
      return null;
    }
  }

  async updateCheckRun(owner: string, repo: string, checkRunId: number, status: "completed", conclusion: string, output: { title: string; summary: string }): Promise<void> {
    try {
      await this.octokit.rest.checks.update({
        owner, repo, check_run_id: checkRunId, status,
        conclusion: conclusion as "success" | "failure" | "neutral",
        completed_at: new Date().toISOString(), output,
      });
    } catch (e) {
      console.error("[GitHub] Failed to update check run:", e);
    }
  }
}

// ─── GitLab Provider ─────────────────────────────────────────────────────────

export class GitLabProvider implements GitProvider {
  private baseUrl: string;
  private token: string;

  constructor(token: string, baseUrl: string = "https://gitlab.com") {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  private async api(path: string, options?: RequestInit) {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  private projectPath(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async fetchPR(owner: string, repo: string, prNumber: number): Promise<PRData> {
    const project = this.projectPath(owner, repo);
    const mr = await this.api(`/projects/${project}/merge_requests/${prNumber}`);

    // Fetch the diff
    const changes = await this.api(`/projects/${project}/merge_requests/${prNumber}/changes`);
    const diff = changes.changes
      .map((c: { diff: string; new_path: string }) => `--- a/${c.new_path}\n+++ b/${c.new_path}\n${c.diff}`)
      .join("\n");

    return {
      title: mr.title,
      description: mr.description ?? "",
      diff,
      headSha: mr.sha,
      baseBranch: mr.target_branch,
      headBranch: mr.source_branch,
    };
  }

  async fetchIncrementalDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const project = this.projectPath(owner, repo);
    const compare = await this.api(`/projects/${project}/repository/compare?from=${base}&to=${head}`);
    return compare.diffs
      .map((d: { diff: string; new_path: string }) => `--- a/${d.new_path}\n+++ b/${d.new_path}\n${d.diff}`)
      .join("\n");
  }

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    const project = this.projectPath(owner, repo);
    await this.api(`/projects/${project}/merge_requests/${prNumber}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async postInlineComments(owner: string, repo: string, prNumber: number, _commitSha: string, comments: InlineComment[]): Promise<void> {
    const project = this.projectPath(owner, repo);
    for (const c of comments) {
      try {
        await this.api(`/projects/${project}/merge_requests/${prNumber}/discussions`, {
          method: "POST",
          body: JSON.stringify({
            body: c.body,
            position: {
              position_type: "text",
              new_path: c.file,
              new_line: c.line,
              base_sha: "", // Will use head of target branch
              head_sha: _commitSha,
              start_sha: "",
            },
          }),
        });
      } catch (e) {
        console.error(`[GitLab] Failed inline comment on ${c.file}:${c.line}`, e);
      }
    }
  }

  async addLabels(owner: string, repo: string, prNumber: number, labels: string[]): Promise<void> {
    const project = this.projectPath(owner, repo);
    await this.api(`/projects/${project}/merge_requests/${prNumber}`, {
      method: "PUT",
      body: JSON.stringify({ add_labels: labels.join(",") }),
    });
  }
}

// ─── Bitbucket Provider ──────────────────────────────────────────────────────

export class BitbucketProvider implements GitProvider {
  private token: string;
  private baseUrl = "https://api.bitbucket.org/2.0";

  constructor(token: string) {
    this.token = token;
  }

  private async api(path: string, options?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async fetchPR(owner: string, repo: string, prNumber: number): Promise<PRData> {
    const pr = await this.api(`/repositories/${owner}/${repo}/pullrequests/${prNumber}`);
    const diffRes = await fetch(`${this.baseUrl}/repositories/${owner}/${repo}/pullrequests/${prNumber}/diff`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const diff = await diffRes.text();

    return {
      title: pr.title,
      description: pr.description ?? "",
      diff,
      headSha: pr.source?.commit?.hash ?? "",
      baseBranch: pr.destination?.branch?.name ?? "main",
      headBranch: pr.source?.branch?.name ?? "",
    };
  }

  async fetchIncrementalDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const diffRes = await fetch(`${this.baseUrl}/repositories/${owner}/${repo}/diff/${base}..${head}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return diffRes.text();
  }

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    await this.api(`/repositories/${owner}/${repo}/pullrequests/${prNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: { raw: body } }),
    });
  }

  async postInlineComments(owner: string, repo: string, prNumber: number, _commitSha: string, comments: InlineComment[]): Promise<void> {
    for (const c of comments) {
      try {
        await this.api(`/repositories/${owner}/${repo}/pullrequests/${prNumber}/comments`, {
          method: "POST",
          body: JSON.stringify({
            content: { raw: c.body },
            inline: { to: c.line, path: c.file },
          }),
        });
      } catch (e) {
        console.error(`[Bitbucket] Failed inline comment on ${c.file}:${c.line}`, e);
      }
    }
  }

  async addLabels(_owner: string, _repo: string, _prNumber: number, _labels: string[]): Promise<void> {
    // Bitbucket doesn't have native PR labels — skip silently
    console.log("[Bitbucket] Labels not supported natively, skipping");
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createGitProvider(provider: string, token: string, baseUrl?: string): GitProvider {
  switch (provider) {
    case "gitlab":
      return new GitLabProvider(token, baseUrl);
    case "bitbucket":
      return new BitbucketProvider(token);
    case "github":
    default:
      return new GitHubProvider(token);
  }
}
