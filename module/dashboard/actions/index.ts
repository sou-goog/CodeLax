"use server";
import {
    fetchUserContribution, getGithubToken
} from "@/module/github/lib/github"

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Octokit } from "octokit";
import prisma from "@/lib/db";

export async function getContributionStats() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        if (!session) {
            throw new Error("Unauthorized");
        }

        const token = await getGithubToken();
        const octokit = new Octokit({ auth: token });
        const { data: user } = await octokit.rest.users.getAuthenticated();
        const username =user.login;

        const calendar = await fetchUserContribution(token, username);

        if (!calendar) {
            return null;
        }

        const contributions = calendar.weeks.flatMap((week: { contributionDays: { date: string; contributionCount: number }[] }) =>
            week.contributionDays.map((day) => ({
                date: day.date,
                count: day.contributionCount,
                level: Math.min(4, Math.floor(day.contributionCount / 3)),
            }))
        );

        return {
            totalContributions: calendar.totalContributions,
            contributions
        };

    } catch (error) {
        console.error("Error fetching contribution stats", error);
        return null;
    }
}

export async function getDashboardStats() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session) {
            throw new Error("Unauthorized");
        }

        const token = await getGithubToken();
        const octokit = new Octokit({ auth: token })


        //github username
        const { data: user } = await octokit.rest.users.getAuthenticated()

        const totalRepos = await prisma.repository.count({
            where: { userId: session.user.id }
        });

        const calendar = await fetchUserContribution(token, user.login);
        const totalCommits = calendar?.totalContributions || 0

        const { data: prs } = await octokit.rest.search.issuesAndPullRequests({
            q: `author:${user.login} type:pr`,
            per_page: 1
        })

        const totalPRs = prs.total_count;

        const totalReviews = await prisma.review.count({
            where: { repository: { userId: session.user.id } }
        });

        return {
            totalCommits,
            totalPRs,
            totalReviews,
            totalRepos
        }
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return {
            totalCommits: 0,
            totalPRs: 0,
            totalReviews: 0,
            totalRepos: 0
        }
    }
}

export async function getDashboardOverview() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;

    // Recent reviews
    const teamIds = (
        await prisma.team_member.findMany({ where: { userId }, select: { teamId: true } })
    ).map((m) => m.teamId);

    const recentReviews = await prisma.review.findMany({
        where: {
            repository: {
                OR: [{ userId }, ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : [])],
            },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
            repository: { select: { fullName: true } },
            _count: { select: { findings: true } },
        },
    });

    // Severity summary from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentFindings = await prisma.review_finding.groupBy({
        by: ["severity"],
        where: {
            review: {
                createdAt: { gte: thirtyDaysAgo },
                repository: {
                    OR: [{ userId }, ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : [])],
                },
            },
        },
        _count: true,
    });

    const severitySummary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of recentFindings) {
        severitySummary[f.severity] = f._count;
    }

    // Team summary
    const teams = await prisma.team_member.findMany({
        where: { userId },
        include: {
            team: {
                select: { id: true, name: true, _count: { select: { members: true, repositories: true } } },
            },
        },
    });

    // Review trend (this week vs last week)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const thisWeek = await prisma.review.count({
        where: { repository: { userId }, createdAt: { gte: oneWeekAgo } },
    });
    const lastWeek = await prisma.review.count({
        where: { repository: { userId }, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    });

    return {
        recentReviews,
        severitySummary,
        teams: teams.map((t) => ({
            id: t.team.id,
            name: t.team.name,
            role: t.role,
            members: t.team._count.members,
            repos: t.team._count.repositories,
        })),
        trend: { thisWeek, lastWeek, change: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0 },
    };
}

export async function getMonthlyActivity() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        if (!session) {
            throw new Error("Unauthorized");
        }
        const token = await getGithubToken();
        const octokit = new Octokit({ auth: token })

        const { data: user } = await octokit.rest.users.getAuthenticated()

        const calendar = await fetchUserContribution(token, user.login)

        if (!calendar) {
            return [];
        }

        const monthlyData: {
            [key: string]: { commits: number; prs: number; reviews: number }
        } = {}

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = monthNames[date.getMonth()];
            monthlyData[monthKey] = {
                commits: 0,
                prs: 0,
                reviews: 0
            };

        }
        calendar.weeks.forEach((week: { contributionDays: { date: string; contributionCount: number }[] }) => {
            week.contributionDays.forEach((day) => {
                const date = new Date(day.date);
                const monthKey = monthNames[date.getMonth()];
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].commits += day.contributionCount;
                }
            })
        })

        //fetch last 6months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const reviews = await prisma.review.findMany({
            where: {
                repository: { userId: session.user.id },
                createdAt: { gte: sixMonthsAgo }
            },
            select: { createdAt: true }
        });

        reviews.forEach((review) => {
            const monthKey = monthNames[review.createdAt.getMonth()];
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].reviews += 1;
            }
        })
        const { data: prs } = await octokit.rest.search.issuesAndPullRequests({
            q: `author:${user.login} type:pr created:>${sixMonthsAgo.toISOString().split("T")[0]
                }`,
            per_page: 100

        });

        prs.items.forEach((pr) => {
            const date = new Date(pr.created_at);
            const monthKey = monthNames[date.getMonth()];
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].prs += 1;
            }
        });

        return Object.keys(monthlyData).map((name) => ({
            name,
            ...monthlyData[name]
        }))
    } catch (error) {
        console.error("Error fetching monthly activity", error);
        return [];
    }

}