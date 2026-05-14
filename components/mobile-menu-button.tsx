"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/dashboard-sidebar";

export function MobileMenuButton() {
    const { setOpen } = useSidebar();
    return (
        <button
            onClick={() => setOpen(true)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open menu"
        >
            <Menu className="w-5 h-5" />
        </button>
    );
}
