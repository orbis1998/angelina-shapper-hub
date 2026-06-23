import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth, badgeToEmail } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, role, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "livreur") navigate({ to: "/livreur" });
  }, [session, role, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const email = identifier.includes("@") ? identifier : badgeToEmail(identifier);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Identifiant ou mot de passe incorrect");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-background">
          <div className="text-2xl font-semibold tracking-tight">Angelina Shapper</div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] opacity-60 mt-2">Plateforme de gestion</div>
        </div>
        <Card className="shadow-elegant border-0">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Email ou numéro de badge</Label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin@angelina.shapper ou LIV-001"
                />
              </div>
              <div>
                <Label>Mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-background/40 mt-6">© Angelina Shapper</p>
      </div>
    </div>
  );
}
