"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyTeams, createTeam, inviteToTeam,
  updateMemberRole, removeMember,
} from "@/module/team/actions";
import {
  Users, Plus, Mail, Shield, Eye, Pencil, Crown,
  Loader2, UserMinus, ChevronDown, ChevronRight,
  FolderOpen, Copy, Check,
} from "lucide-react";

const roleConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: "Admin", icon: <Crown className="w-3 h-3" />, color: "text-amber-400" },
  reviewer: { label: "Reviewer", icon: <Pencil className="w-3 h-3" />, color: "text-blue-400" },
  viewer: { label: "Viewer", icon: <Eye className="w-3 h-3" />, color: "text-muted-foreground" },
};

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["my-teams"],
    queryFn: () => getMyTeams(),
  });

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await createTeam(teamName.trim());
      setTeamName("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (e: any) {
      alert(e.message || "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (teamId: string) => {
    if (!inviteEmail.trim()) return;
    setInviting(teamId);
    try {
      await inviteToTeam(teamId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteRole("viewer");
      queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (e: any) {
      alert(e.message || "Failed to invite");
    } finally {
      setInviting(null);
    }
  };

  const handleRoleChange = async (teamId: string, userId: string, role: string) => {
    try {
      await updateMemberRole(teamId, userId, role);
      queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (e: any) {
      alert(e.message || "Failed to update role");
    }
  };

  const handleRemove = async (teamId: string, userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember(teamId, userId);
      queryClient.invalidateQueries({ queryKey: ["my-teams"] });
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
          <p className="text-sm text-muted-foreground">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Teams</h1>
          <p className="text-muted-foreground">Manage workspaces and collaborate with your team.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Team
        </button>
      </div>

      {/* Create team form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-foreground mb-3">Create a new team</h3>
          <div className="flex gap-3">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Team name..."
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!teamName.trim() || creating}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Teams list */}
      {teams.length === 0 && !showCreate ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No teams yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Create a team to collaborate with others.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team: any) => {
            const expanded = expandedTeam === team.id;
            const isAdmin = team.myRole === "admin";
            return (
              <div key={team.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Team header */}
                <button
                  onClick={() => setExpandedTeam(expanded ? null : team.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="shrink-0">
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold text-sm border border-violet-500/20">
                    {team.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground">{team.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {team._count.members} member{team._count.members !== 1 ? "s" : ""} · {team._count.repositories} repo{team._count.repositories !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${roleConfig[team.myRole]?.color || "text-muted-foreground"} bg-muted/50 border-border`}>
                    {roleConfig[team.myRole]?.label || team.myRole}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border">
                    {/* Members */}
                    <div className="px-5 py-3 bg-muted/20">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Members</span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {team.members.map((member: any) => {
                        const rc = roleConfig[member.role] || roleConfig.viewer;
                        return (
                          <div key={member.id} className="px-5 py-3 flex items-center gap-3">
                            {member.user.image ? (
                              <img src={member.user.image} alt="" className="w-7 h-7 rounded-full border border-border" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                                {member.user.name?.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{member.user.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{member.user.email}</p>
                            </div>
                            {isAdmin ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleRoleChange(team.id, member.user.id, e.target.value)}
                                  className="text-[10px] bg-muted/50 border border-border rounded px-2 py-1 text-foreground"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="reviewer">Reviewer</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <button
                                  onClick={() => handleRemove(team.id, member.user.id)}
                                  className="text-muted-foreground hover:text-red-400 transition-colors"
                                  title="Remove member"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className={`flex items-center gap-1 text-[10px] font-medium ${rc.color}`}>
                                {rc.icon} {rc.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Invite form (admin only) */}
                    {isAdmin && (
                      <div className="px-5 py-4 border-t border-border bg-muted/10">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-2">Invite Member</span>
                        <div className="flex gap-2">
                          <input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="email@example.com"
                            className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-muted/50 border border-border rounded-lg px-2 py-2 text-xs text-foreground"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleInvite(team.id)}
                            disabled={!inviteEmail.trim() || inviting === team.id}
                            className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
                          >
                            {inviting === team.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                            Invite
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Repos */}
                    {team.repositories.length > 0 && (
                      <div className="border-t border-border">
                        <div className="px-5 py-3 bg-muted/20">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Shared Repositories</span>
                        </div>
                        <div className="px-5 py-3 flex flex-wrap gap-2">
                          {team.repositories.map((r: any) => (
                            <span key={r.id} className="text-[11px] bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-foreground flex items-center gap-1.5">
                              <FolderOpen className="w-3 h-3 text-muted-foreground" />
                              {r.fullName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
