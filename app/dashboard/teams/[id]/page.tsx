"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeamById, getTeamAnalytics, getTeamReviews,
  getAssignableRepos, assignRepoToTeam, unassignRepoFromTeam,
  getTeamLeaderboard,
} from "@/module/team/actions";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft, Users, FolderOpen, BrainCircuit, Plus, Minus,
  BarChart3, GitPullRequest, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Clock, Crown, Pencil, Eye, Star, Code,
  ExternalLink, TrendingUp, FileCode2, Shield, Trophy, Medal,
} from "lucide-react";
import Link from "next/link";

const roleConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: "Admin", icon: <Crown className="w-3 h-3" />, color: "text-amber-400" },
  reviewer: { label: "Reviewer", icon: <Pencil className="w-3 h-3" />, color: "text-blue-400" },
  viewer: { label: "Viewer", icon: <Eye className="w-3 h-3" />, color: "text-muted-foreground" },
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  completed: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { color: "text-red-400 bg-red-500/10 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
  in_progress: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  pending: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: <Clock className="w-3 h-3" /> },
};

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const teamId = params.id as string;
  const [activeTab, setActiveTab] = useState<"overview" | "repos" | "reviews" | "leaderboard">("overview");
  const [assigningRepo, setAssigningRepo] = useState("");

  const { data: team, isLoading, isError, refetch } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeamById(teamId),
  });

  const { data: analytics } = useQuery({
    queryKey: ["team-analytics", teamId],
    queryFn: () => getTeamAnalytics(teamId),
    enabled: !!team,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["team-reviews", teamId],
    queryFn: () => getTeamReviews(teamId),
    enabled: !!team && activeTab === "reviews",
  });

  const { data: assignableRepos = [] } = useQuery({
    queryKey: ["assignable-repos", teamId],
    queryFn: () => getAssignableRepos(teamId),
    enabled: !!team && activeTab === "repos",
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["team-leaderboard", teamId],
    queryFn: () => getTeamLeaderboard(teamId),
    enabled: !!team && (activeTab === "leaderboard" || activeTab === "overview"),
  });

  const canManageRepos = team?.myRole === "admin" || team?.myRole === "reviewer";

  const handleAssign = async () => {
    if (!assigningRepo) return;
    try {
      await assignRepoToTeam(teamId, assigningRepo);
      setAssigningRepo("");
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-analytics", teamId] });
      queryClient.invalidateQueries({ queryKey: ["assignable-repos", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-reviews", teamId] });
    } catch (e: any) {
      alert(e.message || "Failed to assign");
    }
  };

  const handleUnassign = async (repoId: string) => {
    if (!confirm("Remove this repo from the team?")) return;
    try {
      await unassignRepoFromTeam(teamId, repoId);
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-analytics", teamId] });
      queryClient.invalidateQueries({ queryKey: ["assignable-repos", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-reviews", teamId] });
    } catch (e: any) {
      alert(e.message || "Failed to remove");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading team...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Users className="w-12 h-12 text-red-400" />
        <h3 className="text-lg font-medium text-foreground">Failed to load team</h3>
        <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
        <button onClick={() => refetch()} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-lg font-medium transition-colors">Retry</button>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Team not found or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/teams")}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All Teams
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold text-lg border border-violet-500/20">
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team._count.members} member{team._count.members !== 1 ? "s" : ""}
            {" · "}{team._count.repositories} repo{team._count.repositories !== 1 ? "s" : ""}
            {" · "}Your role: <span className={`font-medium capitalize ${roleConfig[team.myRole]?.color}`}>{team.myRole}</span>
          </p>
        </div>
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <FolderOpen className="w-4 h-4 text-violet-400 mb-2" />
            <div className="text-2xl font-bold text-foreground">{analytics.repos.length}</div>
            <div className="text-[11px] text-muted-foreground">Shared Repos</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <BrainCircuit className="w-4 h-4 text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-foreground">{analytics.totalReviews}</div>
            <div className="text-[11px] text-muted-foreground">Total Reviews</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-foreground">{analytics.totalFindings}</div>
            <div className="text-[11px] text-muted-foreground">Total Findings</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <Users className="w-4 h-4 text-emerald-400 mb-2" />
            <div className="text-2xl font-bold text-foreground">{team._count.members}</div>
            <div className="text-[11px] text-muted-foreground">Team Members</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit border border-border/40">
        {(["overview", "repos", "reviews", "leaderboard"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "repos" ? `Repos (${team._count.repositories})` : tab === "leaderboard" ? "Leaderboard" : "Reviews"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Members */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />
                Members
              </h3>
            </div>
            <div className="divide-y divide-border/50">
              {team.members.map((member: any) => {
                const rc = roleConfig[member.role] || roleConfig.viewer;
                return (
                  <div key={member.id} className="px-5 py-3 flex items-center gap-3">
                    {member.user.image ? (
                      <img src={member.user.image} alt="" className="w-8 h-8 rounded-full border border-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                        {member.user.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{member.user.email}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${rc.color}`}>
                      {rc.icon} {rc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent reviews */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-400" />
                Recent Reviews
              </h3>
            </div>
            {analytics?.recentReviews?.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <BrainCircuit className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
                <p className="text-[11px] text-muted-foreground/60">Assign repos and open PRs to see reviews here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {analytics?.recentReviews?.slice(0, 5).map((review: any) => {
                  const sc = statusConfig[review.status] || statusConfig.pending;
                  return (
                    <Link
                      key={review.id}
                      href={`/dashboard/reviews/${review.id}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.color}`}>
                        {sc.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{review.prTitle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {review.repository.fullName} · {review._count.findings} finding{review._count.findings !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "repos" && (
        <div className="space-y-4">
          {/* Assign repo */}
          {canManageRepos && assignableRepos.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                Share a Repository
              </h3>
              <p className="text-[11px] text-muted-foreground mb-3">Repos shared with the team let all members see their reviews and findings.</p>
              <div className="flex gap-3">
                <select
                  value={assigningRepo}
                  onChange={(e) => setAssigningRepo(e.target.value)}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                >
                  <option value="">Select a repository...</option>
                  {assignableRepos.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.fullName} (by {r.user.name})</option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!assigningRepo}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          )}

          {/* Assigned repos */}
          {team.repositories.length === 0 ? (
            <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No shared repositories</h3>
              <p className="text-muted-foreground text-sm mt-1">Share a repo so all team members can see its reviews.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {team.repositories.map((repo: any) => (
                <div key={repo.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{repo.fullName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {repo.language && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Code className="w-2.5 h-2.5" /> {repo.language}
                        </span>
                      )}
                      {repo.stars > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" /> {repo.stars}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManageRepos && (
                    <button
                      onClick={() => handleUnassign(repo.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1.5"
                      title="Remove from team"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Team Leaderboard
            </h3>
            <span className="text-[11px] text-muted-foreground">{leaderboard.length} member{leaderboard.length !== 1 ? "s" : ""}</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Assign repos and run reviews to populate the leaderboard.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {leaderboard.map((member: any, i: number) => {
                const rc = roleConfig[member.role] || roleConfig.viewer;
                const medals = ["🥇", "🥈", "🥉"];
                const maxReviews = leaderboard[0]?.reviews || 1;
                return (
                  <div key={member.userId} className={`px-5 py-4 flex items-center gap-4 ${i === 0 && member.reviews > 0 ? "bg-amber-500/[0.03]" : ""}`}>
                    <div className="w-8 text-center shrink-0">
                      {i < 3 && member.reviews > 0 ? (
                        <span className="text-lg">{medals[i]}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-bold">#{i + 1}</span>
                      )}
                    </div>
                    {member.image ? (
                      <img src={member.image} alt="" className="w-9 h-9 rounded-full border border-border shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                        {member.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                        <span className={`flex items-center gap-1 text-[9px] font-bold ${rc.color}`}>
                          {rc.icon} {rc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <BrainCircuit className="w-3 h-3" /> {member.reviews} reviews
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {member.findings} findings
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" /> {member.repos} repos
                        </span>
                        {member.lastActive && (
                          <span className="text-[10px] text-muted-foreground/60">
                            Last active {formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 shrink-0">
                      <div className="bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-violet-500"
                          }`}
                          style={{ width: `${(member.reviews / maxReviews) * 100}%`, minWidth: member.reviews > 0 ? "6px" : "0px" }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground text-right mt-1">
                        {member.reviews > 0 ? `${Math.round((member.reviews / maxReviews) * 100)}%` : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
              <BrainCircuit className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">No team reviews yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Share repos with the team and open PRs to see reviews here.</p>
            </div>
          ) : (
            reviews.map((review: any) => {
              const sc = statusConfig[review.status] || statusConfig.pending;
              return (
                <Link
                  key={review.id}
                  href={`/dashboard/reviews/${review.id}`}
                  className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors block"
                >
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${sc.color} shrink-0`}>
                    {sc.icon}
                    <span className="capitalize">{review.status.replace("_", " ")}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{review.prTitle}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{review.repository.fullName}</span>
                      <span className="text-[11px] text-muted-foreground">#{review.prNumber}</span>
                      <span className="text-[11px] text-muted-foreground">{review._count.findings} finding{review._count.findings !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </p>
                    {review.durationMs && (
                      <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {(review.durationMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
