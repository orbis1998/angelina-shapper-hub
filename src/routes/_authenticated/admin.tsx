import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ADMIN_NAV } from "@/components/admin/admin-nav";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role && role !== "admin") navigate({ to: "/livreur" });
  }, [role, loading, navigate]);

  if (loading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (role !== "admin") return null;

  return (
    <AppShell items={ADMIN_NAV} subtitle="Administration">
      <Outlet />
    </AppShell>
  );
}
