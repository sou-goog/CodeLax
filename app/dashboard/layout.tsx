import React from 'react'
import { requireAuth } from "@/module/auth/utils/auth-utils"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Terminal } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const DashboardLayout = async(
    {children}: {
        children: React.ReactNode
    }
) => {
    await requireAuth();
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Top Header */}
        <header className="bg-background/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-50 flex justify-between items-center w-full px-6 py-3">
            <div className="text-lg font-bold text-foreground flex items-center gap-2">
                <Terminal className="w-5 h-5 text-violet-500" />
                <span>CodeLax</span>
            </div>
            <ThemeToggle />
        </header>
        <DashboardSidebar />
        <main className="md:ml-64 p-6 min-h-[calc(100vh-49px)] overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                {children}
            </div>
        </main>
    </div>
  )
}

export default DashboardLayout