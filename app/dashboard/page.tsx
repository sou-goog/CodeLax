"use client"
import React from 'react'
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from
"recharts"
import {Code, Bug, Timer, Zap, Grid3X3} from "lucide-react"
import {useQuery} from "@tanstack/react-query"
import {getDashboardStats , getMonthlyActivity} from "@/module/dashboard/actions";
import ContributionGraph from '@/module/dashboard/actions/components/contribution-graph'

const MainPage = () => {
  const {data:stats , isLoading} = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn:async () =>await getDashboardStats(),
    refetchOnWindowFocus:false,
  })
  const {data:monthlyActivity , isLoading:isLoadingActivity} = useQuery({
    queryKey: ["monthly-activity"],
    queryFn:async () =>await getMonthlyActivity(),
    refetchOnWindowFocus:false,
  })

  return (
    <div className='space-y-8 pb-12'>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-1">Developer Dashboard</h1>
          <p className="text-muted-foreground">Monitoring performance across your active repositories.</p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-lg border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Code className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1 text-muted-foreground">TOTAL COMMITS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : (stats?.totalCommits || 0).toLocaleString()}</span>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Bug className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1 text-muted-foreground">REPOSITORIES</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalRepos || 0}</span>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Timer className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1 text-muted-foreground">PULL REQUESTS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalPRs || 0}</span>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1 text-muted-foreground">AI REVIEWS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalReviews || 0}</span>
        </div>
      </div>

      {/* Contribution Graph */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-medium text-foreground flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-violet-400" />
            Contribution Graph
          </h3>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-sm bg-zinc-800"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-900/40"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-700/60"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-500"></div>
          </div>
        </div>
        <div className="p-6">
          <ContributionGraph />
        </div>
      </section>

      {/* Activity Chart */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xl font-medium text-foreground">Activity Overview</h3>
        </div>
        <div className="p-6">
          {isLoadingActivity ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyActivity || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend />
                  <Bar dataKey="commits" name="Commits" fill="#7c3aed" radius={[4,4,0,0]} barSize={52}/>
                  <Bar dataKey="prs" name="Pull Requests" fill="#8b5cf6" radius={[4,4,0,0]} barSize={52}/>
                  <Bar dataKey="reviews" name="AI Reviews" fill="#10b981" radius={[4,4,0,0]} barSize={52}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default MainPage