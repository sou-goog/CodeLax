"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

export async function getAnalytics() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;

    // Fetch all reviews with findings for this user
    const reviews = await prisma.review.findMany({
        where: { repository: { userId } },
        include: { findings: true, repository: true },
        orderBy: { createdAt: "desc" },
    });

    // Total stats
    const totalReviews = reviews.length;
    const totalFindings = reviews.reduce((sum, r) => sum + r.findings.length, 0);
    const avgFindings = totalReviews > 0 ? Math.round(totalFindings / totalReviews * 10) / 10 : 0;

    // Severity distribution
    const severityDist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const r of reviews) {
        for (const f of r.findings) {
            severityDist[f.severity] = (severityDist[f.severity] || 0) + 1;
        }
    }

    // Agent distribution
    const agentDist: Record<string, number> = {};
    for (const r of reviews) {
        for (const f of r.findings) {
            agentDist[f.agentName] = (agentDist[f.agentName] || 0) + 1;
        }
    }

    // Top risky files (most findings)
    const fileCounts: Record<string, number> = {};
    for (const r of reviews) {
        for (const f of r.findings) {
            fileCounts[f.file] = (fileCounts[f.file] || 0) + 1;
        }
    }
    const topFiles = Object.entries(fileCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }));

    // Reviews over time (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentReviews = reviews.filter((r) => new Date(r.createdAt) > thirtyDaysAgo);

    const reviewsByDay: Record<string, { reviews: number; findings: number }> = {};
    for (const r of recentReviews) {
        const day = new Date(r.createdAt).toISOString().split("T")[0];
        if (!reviewsByDay[day]) reviewsByDay[day] = { reviews: 0, findings: 0 };
        reviewsByDay[day].reviews++;
        reviewsByDay[day].findings += r.findings.length;
    }

    const timeline = Object.entries(reviewsByDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, data]) => ({ date, ...data }));

    // Per-repo stats
    const repoStats: Record<string, { name: string; reviews: number; findings: number }> = {};
    for (const r of reviews) {
        const repoName = r.repository.fullName || `${r.repository.owner}/${r.repository.name}`;
        if (!repoStats[repoName]) repoStats[repoName] = { name: repoName, reviews: 0, findings: 0 };
        repoStats[repoName].reviews++;
        repoStats[repoName].findings += r.findings.length;
    }
    const repos = Object.values(repoStats).sort((a, b) => b.reviews - a.reviews);

    // Weekly quality score (100 - weighted severity per review)
    const weeklyScores: { week: string; score: number; reviews: number }[] = [];
    const weekMap: Record<string, { totalScore: number; count: number }> = {};

    for (const r of reviews) {
      const date = new Date(r.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weekMap[weekKey]) weekMap[weekKey] = { totalScore: 0, count: 0 };

      // Score: 100 minus weighted severity penalties
      const penalties = r.findings.reduce((sum, f) => {
        const weights: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
        return sum + (weights[f.severity] || 5);
      }, 0);
      const score = Math.max(0, Math.min(100, 100 - penalties));

      weekMap[weekKey].totalScore += score;
      weekMap[weekKey].count++;
    }

    for (const [week, data] of Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)) {
      weeklyScores.push({
        week,
        score: Math.round(data.totalScore / data.count),
        reviews: data.count,
      });
    }

    // Most common issue types (by title similarity - group top recurring)
    const issueFrequency: Record<string, number> = {};
    for (const r of reviews) {
      for (const f of r.findings) {
        const key = f.title.toLowerCase().trim();
        issueFrequency[key] = (issueFrequency[key] || 0) + 1;
      }
    }
    const commonIssues = Object.entries(issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title, count]) => ({ title, count }));

    // Average review duration
    const reviewsWithDuration = reviews.filter((r) => r.durationMs);
    const avgDuration = reviewsWithDuration.length > 0
      ? Math.round(reviewsWithDuration.reduce((sum, r) => sum + (r.durationMs || 0), 0) / reviewsWithDuration.length)
      : 0;

    return {
        totalReviews,
        totalFindings,
        avgFindings,
        avgDuration,
        severityDist,
        agentDist,
        topFiles,
        timeline,
        repos,
        weeklyScores,
        commonIssues,
    };
}
