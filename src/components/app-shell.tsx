import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  items: NavItem[];
  children: ReactNode;
  subtitle: string;
}

export function AppShell({ items, children, subtitle }: Props) {
  const { fullName, badgeNumber, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <SidebarContent items={items} subtitle={subtitle} fullName={fullName} badgeNumber={badgeNumber} signOut={signOut} path={path} />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <SidebarContent items={items} subtitle={subtitle} fullName={fullName} badgeNumber={badgeNumber} signOut={signOut} path={path} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-card sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2"><Menu className="size-5" /></button>
          <div className="font-display text-lg">Angelina Shapper</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  items, subtitle, fullName, badgeNumber, signOut, path, onNavigate,
}: {
  items: NavItem[]; subtitle: string; fullName: string | null; badgeNumber: string | null;
  signOut: () => Promise<void>; path: string; onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="text-lg font-semibold tracking-tight text-sidebar-foreground leading-tight">Angelina Shapper</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/50 mt-1.5">{subtitle}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          const active = it.to === "/admin"
            ? path === "/admin"
            : path === it.to || path.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium border-l-2 border-sidebar-primary pl-[10px]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span className="size-4 shrink-0 opacity-80">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div>
          <div className="text-sm font-medium text-sidebar-foreground truncate">{fullName ?? "—"}</div>
          {badgeNumber && <div className="text-xs text-sidebar-foreground/50 mt-0.5">Badge {badgeNumber}</div>}
        </div>
        <Button variant="outline" size="sm" className="w-full bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
          <LogOut className="size-4 mr-2" /> Déconnexion
        </Button>
      </div>
    </>
  );
}
