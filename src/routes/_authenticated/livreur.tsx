import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Trash2, History, Receipt, ClipboardList } from "lucide-react";
import { LivreurOrdersSection } from "@/components/livreur/orders-section";
import { formatCurrency, formatDate } from "@/lib/format";
import { generateReceipt } from "@/lib/exports";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/livreur")({ component: LivreurPage });

function LivreurPage() {
  const { role, loading, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role && role !== "livreur") navigate({ to: "/admin" });
  }, [role, loading, navigate]);
  if (loading || !user) return <div className="p-8">Chargement…</div>;
  if (role !== "livreur") return null;

  return (
    <AppShell items={[{ to: "/livreur", label: "POS", icon: <ShoppingCart className="size-4" /> }]} subtitle="Espace livreur">
      <Tabs defaultValue="orders">
        <TabsList className="grid grid-cols-3 w-full mb-6">
          <TabsTrigger value="orders"><ClipboardList className="size-4 mr-1.5" />Commandes</TabsTrigger>
          <TabsTrigger value="pos"><ShoppingCart className="size-4 mr-1.5" />Nouvelle livraison</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4 mr-1.5" />Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><LivreurOrdersSection userId={user.id} /></TabsContent>
        <TabsContent value="pos"><PosSection userId={user.id} /></TabsContent>
        <TabsContent value="history"><HistorySection userId={user.id} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

interface CartItem { product_id: string; name: string; quantity: number; unit_price: number; available: number; }

function PosSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { fullName, badgeNumber } = useAuth();
  const { data: stock = [] } = useQuery({
    queryKey: ["my-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("livreur_stock")
        .select("quantity, product:products(id, name, price)")
        .eq("livreur_id", userId).gt("quantity", 0);
      return data ?? [];
    },
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [client, setClient] = useState({ name: "", address: "", phone: "" });
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<"cash" | "mobile_money" | "bank_transfer">("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function addToCart(s: any) {
    setCart((c) => {
      const existing = c.find((x) => x.product_id === s.product.id);
      if (existing) {
        if (existing.quantity >= s.quantity) { toast.warning("Stock atteint"); return c; }
        return c.map((x) => x.product_id === s.product.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...c, { product_id: s.product.id, name: s.product.name, quantity: 1, unit_price: Number(s.product.price), available: s.quantity }];
    });
  }
  function updateQty(id: string, delta: number) {
    setCart((c) => c.map((x) => x.product_id === id ? { ...x, quantity: Math.max(1, Math.min(x.available, x.quantity + delta)) } : x));
  }
  function removeItem(id: string) { setCart((c) => c.filter((x) => x.product_id !== id)); }

  const subtotal = cart.reduce((s, x) => s + x.quantity * x.unit_price, 0);
  const disc = Math.max(0, Math.min(subtotal, parseFloat(discount) || 0));
  const total = subtotal - disc;

  async function submit() {
    if (cart.length === 0) { toast.error("Panier vide"); return; }
    if (!client.name || !client.address) { toast.error("Nom et adresse du client requis"); return; }
    setBusy(true);
    try {
      const { data: delivery, error: dErr } = await supabase.from("deliveries").insert({
        livreur_id: userId, client_name: client.name.trim(), client_address: client.address.trim(),
        client_phone: client.phone.trim() || null, subtotal, discount_amount: disc, total_amount: total,
        payment_method: payment, notes: notes.trim() || null,
      }).select().single();
      if (dErr) throw dErr;
      const items = cart.map((c) => ({
        delivery_id: delivery.id, product_id: c.product_id, product_name: c.name,
        quantity: c.quantity, unit_price: c.unit_price, line_total: c.quantity * c.unit_price,
      }));
      const { error: iErr } = await supabase.from("delivery_items").insert(items);
      if (iErr) throw iErr;

      generateReceipt({
        receipt_number: delivery.receipt_number, delivered_at: delivery.delivered_at,
        client_name: client.name, client_address: client.address, client_phone: client.phone,
        livreur_name: `${fullName} (${badgeNumber})`,
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, unit_price: c.unit_price, line_total: c.quantity * c.unit_price })),
        subtotal, discount_amount: disc, total_amount: total, payment_method: payment, notes,
      });

      toast.success("Livraison enregistrée — reçu téléchargé");
      setCart([]); setClient({ name: "", address: "", phone: "" }); setDiscount("0"); setNotes("");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Stock du livreur */}
      <div className="lg:col-span-3 space-y-4">
        <div>
          <h2 className="font-display text-xl">Mon stock</h2>
          <p className="text-xs text-muted-foreground">Touchez un produit pour l'ajouter au panier.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stock.map((s: any) => (
            <button key={s.product.id} onClick={() => addToCart(s)} className="text-left p-4 rounded-lg border bg-card hover:border-primary hover:shadow-soft transition-all active:scale-95">
              <div className="font-medium leading-tight line-clamp-2">{s.product.name}</div>
              <div className="text-primary font-display text-lg mt-2">{formatCurrency(s.product.price)}</div>
              <Badge variant="secondary" className="mt-1 text-xs">Stock: {s.quantity}</Badge>
            </button>
          ))}
          {stock.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Aucun stock attribué. Contactez l'admin pour recevoir des produits.
            </div>
          )}
        </div>
      </div>

      {/* Panier + checkout */}
      <div className="lg:col-span-2 space-y-4">
        <Card><CardContent className="p-4">
          <h2 className="font-display text-xl mb-3">Panier</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Panier vide</p>
          ) : (
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.product_id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(c.unit_price)} × {c.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(c.product_id, -1)}><Minus className="size-3" /></Button>
                    <span className="w-6 text-center text-sm font-medium">{c.quantity}</span>
                    <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(c.product_id, 1)}><Plus className="size-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeItem(c.product_id)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-display text-lg">Client</h3>
          <div><Label>Nom *</Label><Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} required maxLength={120} /></div>
          <div><Label>Adresse *</Label><Textarea value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} required rows={2} maxLength={300} /></div>
          <div><Label>Téléphone</Label><Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} maxLength={40} /></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm"><span>Sous-total</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <div><Label className="text-xs">Réduction</Label><Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div><Label className="text-xs">Paiement</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></div>
          <div className="flex justify-between font-display text-xl pt-2 border-t"><span>TOTAL</span><span className="text-primary">{formatCurrency(total)}</span></div>
          <Button className="w-full h-12 text-base" onClick={submit} disabled={busy || cart.length === 0}>
            <Receipt className="size-5 mr-2" />Valider la livraison
          </Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

function HistorySection({ userId }: { userId: string }) {
  const { data: deliveries = [] } = useQuery({
    queryKey: ["my-deliveries"],
    queryFn: async () => (await supabase.from("deliveries").select("*").eq("livreur_id", userId).order("delivered_at", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reçu</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {deliveries.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="whitespace-nowrap text-xs">{formatDate(d.delivered_at)}</TableCell>
              <TableCell className="font-mono text-xs">{d.receipt_number}</TableCell>
              <TableCell>{d.client_name}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(d.total_amount)}</TableCell>
            </TableRow>
          ))}
          {deliveries.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune livraison.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
