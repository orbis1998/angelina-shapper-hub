import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export function ProductsSection() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", sku: "", price: "", cost_price: "", stock_global: "", description: "" });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", sku: "", price: "", cost_price: "", stock_global: "", description: "" });
    setOpen(true);
  }
  function openEdit(p: any) {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku ?? "", price: String(p.price), cost_price: String(p.cost_price ?? 0), stock_global: String(p.stock_global), description: p.description ?? "" });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(), sku: form.sku.trim() || null,
      price: parseFloat(form.price) || 0, cost_price: parseFloat(form.cost_price) || 0,
      stock_global: parseInt(form.stock_global) || 0, description: form.description.trim() || null,
    };
    const res = editing ? await supabase.from("products").update(payload).eq("id", editing.id) : await supabase.from("products").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Produit mis à jour" : "Produit créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }
  }
  async function remove(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["products"] }); }
  }

  const sorted = [...products].sort((a, b) => Number(b.price) - Number(b.cost_price) - (Number(a.price) - Number(a.cost_price)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produits"
        description="Catalogue, marges et remises produit"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-1" />Nouveau</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau produit"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                  <div><Label>Stock</Label><Input type="number" min="0" value={form.stock_global} onChange={(e) => setForm({ ...form, stock_global: e.target.value })} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prix vente (USD)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
                  <div><Label>Coût achat (USD)</Label><Input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="border shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead>Nom</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Prix</TableHead>
              <TableHead className="text-right">Coût</TableHead><TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-right">Remise max.</TableHead><TableHead className="text-right">Stock</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const margin = Number(p.price) - Number(p.cost_price);
              const maxDiscount = margin > 0 ? margin : 0;
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(p.cost_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(margin)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(maxDiscount)}</TableCell>
                  <TableCell className="text-right"><Badge variant={p.stock_global < 5 ? "destructive" : "secondary"}>{p.stock_global}</Badge></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
