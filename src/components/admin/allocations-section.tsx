import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

function buildNotes(remise: string, notes: string) {
  const parts: string[] = [];
  const r = parseFloat(remise);
  if (r > 0) parts.push(`Remise: ${r} USD`);
  if (notes.trim()) parts.push(notes.trim());
  return parts.length ? parts.join(" | ") : null;
}

function parseRemise(notes: string | null) {
  if (!notes) return null;
  const m = notes.match(/Remise:\s*([\d.]+)\s*USD/);
  return m ? parseFloat(m[1]) : null;
}

export function AllocationsSection() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").eq("active", true)).data ?? [] });
  const { data: livreurs = [] } = useQuery({ queryKey: ["livreurs"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, badge_number").not("badge_number", "is", null)).data ?? [] });
  const { data: history = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: async () => (await supabase.from("stock_allocations").select("id, quantity, created_at, notes, product:products(name, price), livreur:profiles!stock_allocations_livreur_id_fkey(full_name, badge_number)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const [form, setForm] = useState({ product_id: "", livreur_id: "", quantity: "", remise_usd: "", notes: "" });

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const qty = parseInt(form.quantity) || 0;
  const remise = parseFloat(form.remise_usd) || 0;
  const lineValue = selectedProduct ? qty * Number(selectedProduct.price) : 0;
  const afterRemise = Math.max(0, lineValue - remise);

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("stock_allocations").insert({
      product_id: form.product_id,
      livreur_id: form.livreur_id,
      quantity: qty,
      notes: buildNotes(form.remise_usd, form.notes),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Stock alloué");
      setForm({ product_id: "", livreur_id: "", quantity: "", remise_usd: "", notes: "" });
      qc.invalidateQueries();
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Allocations" description="Remettre du stock aux livreurs avec remise optionnelle" />
      <Card className="border shadow-sm"><CardContent className="p-6">
        <form onSubmit={allocate} className="grid md:grid-cols-2 gap-4">
          <div><Label>Produit</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — stock {p.stock_global}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Livreur</Label>
            <Select value={form.livreur_id} onValueChange={(v) => setForm({ ...form, livreur_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{livreurs.map((l) => <SelectItem key={l.id} value={l.id}>{l.full_name} — {l.badge_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantité</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></div>
          <div><Label>Remise / réduction (USD)</Label><Input type="number" min="0" step="0.01" value={form.remise_usd} onChange={(e) => setForm({ ...form, remise_usd: e.target.value })} placeholder="0.00" /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optionnel" /></div>
          {selectedProduct && qty > 0 && (
            <div className="md:col-span-2 text-sm bg-muted/40 rounded-lg p-3 flex justify-between">
              <span>Valeur ligne : <strong>{formatCurrency(lineValue)}</strong></span>
              {remise > 0 && <span>Après remise : <strong>{formatCurrency(afterRemise)}</strong></span>}
            </div>
          )}
          <div className="md:col-span-2"><Button type="submit" disabled={!form.product_id || !form.livreur_id || !form.quantity}>Allouer le stock</Button></div>
        </form>
      </CardContent></Card>
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Historique</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20"><TableHead>Date</TableHead><TableHead>Produit</TableHead><TableHead>Livreur</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">Remise</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm">{formatDate(h.created_at)}</TableCell>
                  <TableCell>{h.product?.name}</TableCell>
                  <TableCell>{h.livreur?.full_name}</TableCell>
                  <TableCell className="text-right font-medium">{h.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{parseRemise(h.notes) != null ? formatCurrency(parseRemise(h.notes)!) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{h.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
