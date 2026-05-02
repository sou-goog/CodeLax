import React from 'react'
import {SidebarProvider, SidebarTrigger, SidebarInset} from "@/components/ui/sidebar"
import {AppSidebar} from "@/components/app-sidebar"
import { requireAuth } from "@/module/auth/utils/auth-utils"

const DashboardLayout = async(
    {children}: {
        children: React.ReactNode
    }
) => {
    await requireAuth();
  return (
    <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1"/>
            <div data-orientation="vertical" role="none" className="shrink-0 bg-border w-[1px] mr-2 h-4" />
            <h1 className="text-xl font-semibold text-foreground">CodeLax</h1>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
          </main>
        </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout