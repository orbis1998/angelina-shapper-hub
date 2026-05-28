import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (role === "admin") navigate({ to: "/admin" });
    else if (role === "livreur") navigate({ to: "/livreur" });
    else navigate({ to: "/login" });
  }, [loading, session, role, navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="text-center">
        <div className="font-display text-3xl text-gold">Angelina Shapper</div>
        <div className="mt-2 text-sm opacity-80">Chargement…</div>
      </div>
    </div>
  );
}
