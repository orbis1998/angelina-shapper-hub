import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createPosSale, createShipment, updateShipmentStatus } from "@/lib/pos.functions";
import { COUNTRY_NAMES, getCitiesForCountry } from "@/lib/locations";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Copy, Package, Store } from "lucide-react";
import { toast } from "sonner";

interface CartLine { product_id: string; name: string; quantity: number; price: number; available: number; }

const SHIP_STATUS: Record<string, string> = {
  preparing: "Préparation", shipped: "Expédié", in_transit: "En transit", delivered: "Livré", failed: "Échoué",
};

import { PageHeader } from "@/components/admin/shared";

export function PosAdminSection() {
  const qc = useQueryClient();
  const posSale = useServerFn(createPosSale);
  const shipment = useServerFn(createShipment);
  const updateShip = useServerFn(updateShipmentStatus);

  const { data: products = [] } = useQuery({
    queryKey: ["products-pos"],
    queryFn: async () => (await supabase.from("products").select("id, name, price, stock_global").eq("active", true).gt("stock_global", 0)).data ?? [],
  });

  const { data: posHistory = [] } = useQuery({
    queryKey: ["pos-sales"],
    queryFn: async () => (await supabase.from("pos_sales").select("*, pos_sale_items(product_name, quantity, line_total_usd)").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => (await supabase.from("shipments").select("*, shipment_items(product_name, quantity)").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  // POS local state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [posDiscount, setPosDiscount] = useState("0");
  const [posPayment, setPosPayment] = useState<"cash" | "mobile_money" | "bank_transfer">("cash");
  const [posClient, setPosClient] = useState("");
  const [posBusy, setPosBusy] = useState(false);

  // Expedition state
  const [expCart, setExpCart] = useState<CartLine[]>([]);
  const [expForm, setExpForm] = useState({
    recipient_name: "", recipient_phone: "", recipient_address: "",
    country: "", city: "", shipping_fee_usd: "0", discount_usd: "0",
    payment_method: "cash" as const, notes: "",
  });
  const [expBusy, setExpBusy] = useState(false);
  const [lastTracking, setLastTracking] = useState("");

  function addToCart(p: any, target: "pos" | "exp") {
    const setter = target === "pos" ? setCart : setExpCart;
    setter((c) => {
      const ex = c.find((x) => x.product_id === p.id);
      if (ex) {
        if (ex.quantity >= p.stock_global) { toast.warning("Stock atteint"); return c; }
        return c.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...c, { product_id: p.id, name: p.name, quantity: 1, price: Number(p.price), available: p.stock_global }];
    });
  }

  const posSubtotal = cart.reduce((s, x) => s + x.quantity * x.price, 0);
  const posDisc = Math.min(posSubtotal, parseFloat(posDiscount) || 0);
  const posTotal = posSubtotal - posDisc;

  async function submitPos() {
    if (cart.length === 0) { toast.error("Panier vide"); return; }
    setPosBusy(true);
    try {
      const res = await posSale({
        data: {
          items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
          discount_usd: posDisc,
          payment_method: posPayment,
          client_name: posClient || null,
        },
      });
      toast.success(`Vente ${res.sale_number} — ${formatCurrency(res.total_usd)}`);
      setCart([]); setPosDiscount("0"); setPosClient("");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setPosBusy(false); }
  }

  const expSubtotal = expCart.reduce((s, x) => s + x.quantity * x.price, 0);
  const expDisc = Math.min(expSubtotal, parseFloat(expForm.discount_usd) || 0);
  const expShipFee = parseFloat(expForm.shipping_fee_usd) || 0;

  async function submitExpedition() {
    if (expCart.length === 0) { toast.error("Ajoutez des articles"); return; }
    if (!expForm.recipient_name || !expForm.country || !expForm.city) {
      toast.error("Nom, pays et ville requis"); return;
    }
    setExpBusy(true);
    try {
      const res = await shipment({
        data: {
          recipient_name: expForm.recipient_name,
          recipient_phone: expForm.recipient_phone || null,
          recipient_address: expForm.recipient_address || null,
          country: expForm.country,
          city: expForm.city,
          items: expCart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
          discount_usd: expDisc,
          shipping_fee_usd: expShipFee,
          payment_method: expForm.payment_method,
          notes: expForm.notes || null,
        },
      });
      setLastTracking(res.tracking_code);
      const url = `${window.location.origin}/suivi/${res.tracking_code}`;
      toast.success(`Expédition créée — ${formatCurrency(res.total_usd)}`);
      navigator.clipboard.writeText(url).catch(() => {});
      toast.info("Lien de suivi copié dans le presse-papiers");
      setExpCart([]);
      setExpForm({ recipient_name: "", recipient_phone: "", recipient_address: "", country: "", city: "", shipping_fee_usd: "0", discount_usd: "0", payment_method: "cash", notes: "" });
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setExpBusy(false); }
  }

  const cities = expForm.country ? getCitiesForCountry(expForm.country) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="POS Magasin" description="Ventes sur place et expéditions internationales" />
    <Tabs defaultValue="store">
      <TabsList className="mb-4">
        <TabsTrigger value="store"><Store className="size-4 mr-1" />Vente magasin</TabsTrigger>
        <TabsTrigger value="expedition"><Package className="size-4 mr-1" />Expédition</TabsTrigger>
        <TabsTrigger value="history">Historique</TabsTrigger>
      </TabsList>

      <TabsContent value="store">
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display text-xl mb-3">Produits (stock magasin)</h2>
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => (
                <Button key={p.id} variant="outline" className="h-auto py-3 flex-col items-start" onClick={() => addToCart(p, "pos")}>
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(p.price)} · stock {p.stock_global}</span>
                </Button>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader><CardTitle>Panier magasin</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cart.map((c) => (
                <div key={c.product_id} className="flex justify-between items-center text-sm">
                  <span>{c.name}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setCart((x) => x.map((i) => i.product_id === c.product_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}><Minus className="size-3" /></Button>
                    <span className="w-6 text-center">{c.quantity}</span>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setCart((x) => x.map((i) => i.product_id === c.product_id ? { ...i, quantity: Math.min(i.available, i.quantity + 1) } : i))}><Plus className="size-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setCart((x) => x.filter((i) => i.product_id !== c.product_id))}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-muted-foreground text-sm">Panier vide</p>}
              <div><Label>Client (optionnel)</Label><Input value={posClient} onChange={(e) => setPosClient(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Remise USD</Label><Input type="number" min="0" value={posDiscount} onChange={(e) => setPosDiscount(e.target.value)} /></div>
                <div><Label>Paiement</Label>
                  <Select value={posPayment} onValueChange={(v: any) => setPosPayment(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Espèces</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-right font-display text-xl">{formatCurrency(posTotal)}</div>
              <Button className="w-full" onClick={submitPos} disabled={posBusy || cart.length === 0}>Encaisser</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="expedition">
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display text-xl mb-3">Articles à expédier</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {products.map((p) => (
                <Button key={p.id} variant="outline" className="h-auto py-3 flex-col items-start" onClick={() => addToCart(p, "exp")}>
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                </Button>
              ))}
            </div>
            {expCart.map((c) => (
              <div key={c.product_id} className="flex justify-between text-sm py-1">
                <span>{c.name} × {c.quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setExpCart((x) => x.filter((i) => i.product_id !== c.product_id))}><Trash2 className="size-3" /></Button>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Destinataire & expédition</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Nom destinataire *</Label><Input value={expForm.recipient_name} onChange={(e) => setExpForm({ ...expForm, recipient_name: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={expForm.recipient_phone} onChange={(e) => setExpForm({ ...expForm, recipient_phone: e.target.value })} /></div>
              <div><Label>Pays *</Label>
                <Select value={expForm.country} onValueChange={(v) => setExpForm({ ...expForm, country: v, city: "" })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un pays" /></SelectTrigger>
                  <SelectContent className="max-h-60">{COUNTRY_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ville *</Label>
                <Select value={expForm.city} onValueChange={(v) => setExpForm({ ...expForm, city: v })} disabled={!expForm.country}>
                  <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
                  <SelectContent className="max-h-60">{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Adresse</Label><Textarea value={expForm.recipient_address} onChange={(e) => setExpForm({ ...expForm, recipient_address: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Frais expédition USD</Label><Input type="number" min="0" value={expForm.shipping_fee_usd} onChange={(e) => setExpForm({ ...expForm, shipping_fee_usd: e.target.value })} /></div>
                <div><Label>Remise USD</Label><Input type="number" min="0" value={expForm.discount_usd} onChange={(e) => setExpForm({ ...expForm, discount_usd: e.target.value })} /></div>
              </div>
              <div className="text-right text-sm">
                Total : <strong>{formatCurrency(expSubtotal - expDisc + expShipFee)}</strong>
              </div>
              {lastTracking && (
                <div className="bg-muted rounded p-2 text-xs flex items-center justify-between">
                  <span>Dernier suivi : {lastTracking}</span>
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/suivi/${lastTracking}`)}><Copy className="size-3" /></Button>
                </div>
              )}
              <Button className="w-full" onClick={submitExpedition} disabled={expBusy}>Créer expédition</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="history">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Ventes magasin récentes</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>N°</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {posHistory.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                      <TableCell>{s.client_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.total_usd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expéditions récentes</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Suivi</TableHead><TableHead>Destinataire</TableHead><TableHead>Destination</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {shipments.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.tracking_code}</TableCell>
                      <TableCell>{s.recipient_name}</TableCell>
                      <TableCell className="text-sm">{s.city}, {s.country}</TableCell>
                      <TableCell><Badge variant="secondary">{SHIP_STATUS[s.status] ?? s.status}</Badge></TableCell>
                      <TableCell className="text-right">{formatCurrency(s.total_usd)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/suivi/${s.tracking_code}`)}><Copy className="size-3" /></Button>
                        {s.status === "preparing" && <Button size="sm" variant="outline" onClick={async () => { await updateShip({ data: { shipment_id: s.id, status: "shipped" } }); qc.invalidateQueries(); toast.success("Expédié"); }}>Expédier</Button>}
                        {s.status === "shipped" && <Button size="sm" variant="outline" onClick={async () => { await updateShip({ data: { shipment_id: s.id, status: "in_transit" } }); qc.invalidateQueries(); }}>En transit</Button>}
                        {["shipped", "in_transit"].includes(s.status) && <Button size="sm" onClick={async () => { await updateShip({ data: { shipment_id: s.id, status: "delivered" } }); qc.invalidateQueries(); toast.success("Livré"); }}>Livré</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    </div>
  );
}
