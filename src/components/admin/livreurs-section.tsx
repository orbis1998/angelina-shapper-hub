import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createLivreur, deleteLivreur, resetLivreurPassword } from "@/lib/admin.functions";
import { PageHeader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function LivreursSection() {
  const qc = useQueryClient();
  const create = useServerFn(createLivreur);
  const del = useServerFn(deleteLivreur);
  const resetPwd = useServerFn(resetLivreurPassword);
  const { data: livreurs = [] } = useQuery({
    queryKey: ["livreurs"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, badge_number, phone, created_at").not("badge_number", "is", null).order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", badge_number: "", phone: "", password: "" });
  const m = useMutation({
    mutationFn: async () => create({ data: { ...form, phone: form.phone || null } }),
    onSuccess: () => { toast.success("Livreur créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["livreurs"] }); setForm({ full_name: "", badge_number: "", phone: "", password: "" }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Livreurs" description="Gestion des comptes livreurs" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Nouveau livreur</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un compte livreur</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
              <div><Label>Nom complet</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div><Label>Badge</Label><Input value={form.badge_number} onChange={(e) => setForm({ ...form, badge_number: e.target.value })} required placeholder="LIV-001" /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Mot de passe</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>Créer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />
      <Card className="border shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20"><TableHead>Nom</TableHead><TableHead>Badge</TableHead><TableHead>Téléphone</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {livreurs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.full_name}</TableCell>
                <TableCell><Badge variant="secondary">{l.badge_number}</Badge></TableCell>
                <TableCell>{l.phone ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={async () => { const p = prompt("Nouveau mot de passe (min 6) :"); if (!p || p.length < 6) return; try { await resetPwd({ data: { user_id: l.id, password: p } }); toast.success("Mot de passe modifié"); } catch (e) { toast.error((e as Error).message); } }}><KeyRound className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={async () => { if (!confirm("Supprimer ?")) return; try { await del({ data: { user_id: l.id } }); qc.invalidateQueries(); toast.success("Supprimé"); } catch (e) { toast.error((e as Error).message); } }}><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
