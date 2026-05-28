import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, badgeToEmail } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, role, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapAdmin);

  useEffect(() => {
    if (loading || !session) return;
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "livreur") navigate({ to: "/livreur" });
  }, [session, role, loading, navigate]);

  // Admin
  const [aEmail, setAEmail] = useState("");
  const [aPass, setAPass] = useState("");
  const [aSign, setASign] = useState(false);
  const [aName, setAName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (aSign) {
        const { error } = await supabase.auth.signUp({
          email: aEmail, password: aPass,
          options: { emailRedirectTo: window.location.origin, data: { full_name: aName || aEmail } },
        });
        if (error) throw error;
        // Tente de devenir admin (premier compte uniquement)
        try { await bootstrap(); toast.success("Compte admin créé"); }
        catch { toast.success("Compte créé. Demandez à un admin de vous attribuer un rôle."); }
        await refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: aEmail, password: aPass });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  // Livreur
  const [badge, setBadge] = useState("");
  const [lPass, setLPass] = useState("");
  async function submitLivreur(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: badgeToEmail(badge), password: lPass,
      });
      if (error) throw new Error("Badge ou mot de passe incorrect");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-primary-foreground">
          <div className="font-display text-4xl text-gold">Angelina Shapper</div>
          <div className="text-sm opacity-80 mt-2 uppercase tracking-widest">Plateforme de gestion</div>
        </div>
        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <Tabs defaultValue="livreur" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="livreur">Livreur</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              <TabsContent value="livreur" className="space-y-4 pt-4">
                <form onSubmit={submitLivreur} className="space-y-4">
                  <div><Label>Numéro de badge</Label><Input value={badge} onChange={(e) => setBadge(e.target.value)} required autoComplete="username" /></div>
                  <div><Label>Mot de passe</Label><Input type="password" value={lPass} onChange={(e) => setLPass(e.target.value)} required autoComplete="current-password" /></div>
                  <Button type="submit" className="w-full" disabled={busy}>Se connecter</Button>
                </form>
              </TabsContent>
              <TabsContent value="admin" className="space-y-4 pt-4">
                <form onSubmit={submitAdmin} className="space-y-4">
                  {aSign && (
                    <div><Label>Nom complet</Label><Input value={aName} onChange={(e) => setAName(e.target.value)} required /></div>
                  )}
                  <div><Label>Email</Label><Input type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} required autoComplete="email" /></div>
                  <div><Label>Mot de passe</Label><Input type="password" value={aPass} onChange={(e) => setAPass(e.target.value)} required minLength={6} autoComplete={aSign ? "new-password" : "current-password"} /></div>
                  <Button type="submit" className="w-full" disabled={busy}>{aSign ? "Créer le compte" : "Se connecter"}</Button>
                  <button type="button" onClick={() => setASign(!aSign)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                    {aSign ? "Déjà un compte ? Se connecter" : "Premier admin ? Créer un compte"}
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-primary-foreground/60 mt-6">© Angelina Shapper</p>
      </div>
    </div>
  );
}
