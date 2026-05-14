"use client";

import { LayoutDashboard, FolderOpen, BrainCircuit, BarChart3, Settings, Settings2, Terminal, LogOut, Moon, Sun, Webhook, X, Users, Shield, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import Logout from "@/module/auth/component/logout";

const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Repositories", url: "/dashboard/repository", icon: FolderOpen },
    { title: "AI Reviews", url: "/dashboard/reviews", icon: BrainCircuit },
    { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Config Editor", url: "/dashboard/config", icon: Settings2 },
    { title: "Rules", url: "/dashboard/rules", icon: Shield },
    { title: "Teams", url: "/dashboard/teams", icon: Users },
    { title: "Webhooks", url: "/dashboard/webhooks", icon: Webhook },
    { title: "Activity", url: "/dashboard/activity", icon: Activity },
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

// Bottom nav shows a subset of items on mobile
const bottomNavItems = navItems.slice(0, 5);

// Context for mobile sidebar open/close
const SidebarContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export function useSidebar() {
    return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on route change
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Prevent body scroll when sidebar open
    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <SidebarContext.Provider value={{ open, setOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function DashboardSidebar() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const { open, setOpen } = useSidebar();

    useEffect(() => {
        setMounted(true);
    }, []);

    const isActive = (url: string) => {
        return pathname === url || (url !== "/dashboard" && pathname.startsWith(url + "/"));
    };

    if (!mounted) return null;

    const user = session?.user;
    const userName = user?.name || "User";
    const userInitials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const sidebarContent = (
        <>
            <div className="px-4 py-4">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-4 mb-2 block">
                    Navigation
                </span>
            </div>
            <nav className="flex-1 px-2">
                {navItems.map((item) => {
                    const active = isActive(item.url);
                    return (
                        <Link
                            key={item.title}
                            href={item.url}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out ${
                                active
                                    ? "bg-violet-500/10 text-violet-400 border-r-2 border-violet-500 rounded-l-lg"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg"
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-border space-y-3">
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <Logout className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-red-400 hover:bg-muted rounded-lg transition-colors cursor-pointer">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </Logout>
                {user && (
                    <div className="flex items-center gap-3 px-4 py-3 mt-2">
                        {user.image ? (
                            <img src={user.image} alt={userName} className="w-8 h-8 rounded-full object-cover border border-border" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400">
                                {userInitials}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="bg-card border-r border-border h-screen w-64 fixed left-0 top-0 flex-col pt-16 z-40 hidden md:flex">
                {sidebarContent}
            </aside>

            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Mobile slide-out drawer */}
            <aside
                className={`fixed top-0 left-0 h-screen w-72 bg-card border-r border-border flex flex-col z-50 md:hidden transition-transform duration-300 ease-in-out ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold">
                        <Terminal className="w-5 h-5 text-violet-500" />
                        <span>CodeLax</span>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {sidebarContent}
            </aside>

            {/* Mobile bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 md:hidden pb-safe">
                <div className="flex items-center justify-around px-2 py-1.5">
                    {bottomNavItems.map((item) => {
                        const active = isActive(item.url);
                        return (
                            <Link
                                key={item.title}
                                href={item.url}
                                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[56px] transition-colors ${
                                    active ? "text-violet-400" : "text-muted-foreground"
                                }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-[9px] font-medium leading-none">{item.title.split(" ")[0]}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
