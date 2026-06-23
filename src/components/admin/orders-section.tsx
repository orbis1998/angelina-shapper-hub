import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createOrder, cancelOrder } from "@/lib/order.functions";
import { KINSHASA_COMMUNES } from "@/lib/locations";
import { formatCurrency, formatCDF, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/shared";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  assigned: "Assignée",
  en_route: "En route",
  delivered: "Livrée",
  failed: "Échouée",
  cancelled: "Annulée",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  assigned: "secondary",
  en_route: "default",
  delivered: "default",
  failed: "destructive",
  cancelled: "destructive",
};

interface CartLine { product_id: string; name: string; quantity: number; price: number; }

export function OrdersSection() {
  const qc = useQueryClient();
  const create = useServerFn(createOrder);
  const cancel = useServerFn(cancelOrder);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, livreur:profiles!orders_livreur_id_fkey(full_name, badge_number), order_items(id, product_name, quantity, line_total_usd)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await supabase.from("products").select("id, name, price, stock_global").eq("active", true)).data ?? [],
  });

  const { data: livreurs = [] } = useQuery({
    queryKey: ["livreurs"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, badge_number").not("badge_number", "is", null)).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState("1");
  const [form, setForm] = useState({
    client_name: "", client_phone: "", client_address: "", commune: "",
    livreur_id: "", scheduled_at: "", delivery_fee_cdf: "0",
    discount_amount_usd: "0", payment_method: "cash" as const, notes: "",
  });

  function addLine() {
    const p = products.find((x) => x.id === selProduct);
    if (!p) return;
    const qty = parseInt(selQty) || 1;
    setCart((c) => {
      const ex = c.find((x) => x.product_id === p.id);
      if (ex) return c.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + qty } : x);
      return [...c, { product_id: p.id, name: p.name, quantity: qty, price: Number(p.price) }];
    });
    setSelProduct(""); setSelQty("1");
  }

  const subtotal = cart.reduce((s, x) => s + x.quantity * x.price, 0);
  const disc = Math.min(subtotal, parseFloat(form.discount_amount_usd) || 0);

  const m = useMutation({
    mutationFn: async () => {
      const scheduled = form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null;
      return create({
        data: {
          client_name: form.client_name,
          client_phone: form.client_phone || null,
          client_address: form.client_address,
          commune: form.commune,
          livreur_id: form.livreur_id,
          scheduled_at: scheduled,
          delivery_fee_cdf: parseFloat(form.delivery_fee_cdf) || 0,
          discount_amount_usd: disc,
          payment_method: form.payment_method,
          notes: form.notes || null,
          items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Commande créée et assignée");
      setOpen(false);
      setCart([]);
      setForm({ client_name: "", client_phone: "", client_address: "", commune: "", livreur_id: "", scheduled_at: "", delivery_fee_cdf: "0", discount_amount_usd: "0", payment_method: "cash", notes: "" });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function handleCancel(id: string) {
    if (!confirm("Annuler cette commande ? Le stock sera restitué.")) return;
    try {
      await cancel({ data: { order_id: id } });
      toast.success("Commande annulée");
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        description="Créer et assigner des commandes aux livreurs"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-1" />Nouvelle commande</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (cart.length === 0) { toast.error("Ajoutez au moins un produit"); return; } m.mutate(); }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Nom client *</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required /></div>
                <div><Label>Téléphone (WhatsApp)</Label><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="+243..." /></div>
              </div>
              <div><Label>Commune *</Label>
                <Select value={form.commune} onValueChange={(v) => setForm({ ...form, commune: v })} required>
                  <SelectTrigger><SelectValue placeholder="Choisir une commune" /></SelectTrigger>
                  <SelectContent>{KINSHASA_COMMUNES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Adresse complète *</Label><Textarea value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} required rows={2} /></div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Livreur *</Label>
                  <Select value={form.livreur_id} onValueChange={(v) => setForm({ ...form, livreur_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Assigner un livreur" /></SelectTrigger>
                    <SelectContent>{livreurs.map((l) => <SelectItem key={l.id} value={l.id}>{l.full_name} — {l.badge_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Heure de livraison</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Frais livraison (CDF)</Label><Input type="number" min="0" value={form.delivery_fee_cdf} onChange={(e) => setForm({ ...form, delivery_fee_cdf: e.target.value })} /></div>
                <div><Label>Remise (USD)</Label><Input type="number" min="0" step="0.01" value={form.discount_amount_usd} onChange={(e) => setForm({ ...form, discount_amount_usd: e.target.value })} /></div>
                <div><Label>Paiement</Label>
                  <Select value={form.payment_method} onValueChange={(v: any) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Espèces</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

              <div className="border rounded-lg p-3 space-y-2">
                <Label>Produits</Label>
                <div className="flex gap-2">
                  <Select value={selProduct} onValueChange={setSelProduct}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Produit" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min="1" className="w-20" value={selQty} onChange={(e) => setSelQty(e.target.value)} />
                  <Button type="button" variant="outline" onClick={addLine}>Ajouter</Button>
                </div>
                {cart.map((c) => (
                  <div key={c.product_id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{c.name} × {c.quantity}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatCurrency(c.quantity * c.price)}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setCart((x) => x.filter((i) => i.product_id !== c.product_id))}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm space-y-1 pt-2 border-t">
                  <div>Sous-total : <strong>{formatCurrency(subtotal)}</strong></div>
                  <div>Total produits : <strong>{formatCurrency(subtotal - disc)}</strong></div>
                  <div className="text-muted-foreground">Frais livraison : {formatCDF(form.delivery_fee_cdf)} (hors CA)</div>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>Créer et assigner</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <Card className="border shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead><TableHead>Client</TableHead><TableHead>Commune</TableHead>
              <TableHead>Livreur</TableHead><TableHead>Heure</TableHead>
              <TableHead className="text-right">Produits</TableHead><TableHead className="text-right">Frais CDF</TableHead>
              <TableHead>Statut</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell>
                  <div className="font-medium">{o.client_name}</div>
                  <div className="text-xs text-muted-foreground">{o.client_phone ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[180px]">{o.client_address}</div>
                </TableCell>
                <TableCell className="text-sm">{o.commune}</TableCell>
                <TableCell className="text-sm">{o.livreur?.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{o.scheduled_at ? formatDate(o.scheduled_at) : "—"}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(o.total_products_usd)}</TableCell>
                <TableCell className="text-right text-sm">{formatCDF(o.delivery_fee_cdf)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{STATUS_LABELS[o.status] ?? o.status}</Badge></TableCell>
                <TableCell>
                  {!["delivered", "cancelled", "failed"].includes(o.status) && (
                    <Button variant="ghost" size="icon" onClick={() => handleCancel(o.id)}><XCircle className="size-4 text-destructive" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucune commande.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
