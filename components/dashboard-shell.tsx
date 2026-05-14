"use client";

import React from "react";
import { SidebarProvider } from "@/components/dashboard-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return <SidebarProvider>{children}</SidebarProvider>;
}
