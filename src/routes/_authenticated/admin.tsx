import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createLivreur, deleteLivreur, resetLivreurPassword } from "@/lib/admin.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Package, Users, ArrowRightLeft, BarChart3, Plus, Trash2, KeyRound, Download } from "lucide-react";
import { formatCurrency, formatDate, formatMonth, monthRange } from "@/lib/format";
import { exportMonthlyExcel, exportMonthlyPDF } from "@/lib/exports";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

const NAV = [
  { to: "/admin", label: "Tableau de bord", icon: <LayoutDashboard className="size-4" /> },
];

function AdminPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role && role !== "admin") navigate({ to: "/livreur" });
  }, [role, loading, navigate]);

  if (loading) return <div className="p-8">Chargement…</div>;
  if (role !== "admin") return null;

  return (
    <AppShell items={NAV} subtitle="Administration">
      <Tabs defaultValue="dashboard">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full mb-6">
          <TabsTrigger value="dashboard"><LayoutDashboard className="size-4 mr-1.5 hidden sm:inline" />Aperçu</TabsTrigger>
          <TabsTrigger value="products"><Package className="size-4 mr-1.5 hidden sm:inline" />Produits</TabsTrigger>
          <TabsTrigger value="livreurs"><Users className="size-4 mr-1.5 hidden sm:inline" />Livreurs</TabsTrigger>
          <TabsTrigger value="allocations"><ArrowRightLeft className="size-4 mr-1.5 hidden sm:inline" />Allocations</TabsTrigger>
          <TabsTrigger value="accounting"><BarChart3 className="size-4 mr-1.5 hidden sm:inline" />Comptabilité</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardSection /></TabsContent>
        <TabsContent value="products"><ProductsSection /></TabsContent>
        <TabsContent value="livreurs"><LivreursSection /></TabsContent>
        <TabsContent value="allocations"><AllocationsSection /></TabsContent>
        <TabsContent value="accounting"><AccountingSection /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ============== DASHBOARD ==============
function DashboardSection() {
  const month = new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);
  const { data } = useQuery({
    queryKey: ["admin-dashboard", month],
    queryFn: async () => {
      const [deliveries, products, livreurs] = await Promise.all([
        supabase.from("deliveries").select("total_amount, discount_amount, delivered_at, livreur_id").gte("delivered_at", start).lt("delivered_at", end),
        supabase.from("products").select("id, name, stock_global, price").eq("active", true),
        supabase.from("profiles").select("id").not("badge_number", "is", null),
      ]);
      return { deliveries: deliveries.data ?? [], products: products.data ?? [], livreurs: livreurs.data ?? [] };
    },
  });
  const d = data ?? { deliveries: [], products: [], livreurs: [] };
  const ca = d.deliveries.reduce((s, x) => s + Number(x.total_amount), 0);
  const reductions = d.deliveries.reduce((s, x) => s + Number(x.discount_amount), 0);
  const stockValue = d.products.reduce((s, p) => s + p.stock_global * Number(p.price), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Aperçu — {formatMonth(month + "-01")}</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de l'activité du mois courant.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Chiffre d'affaires" value={formatCurrency(ca)} highlight />
        <Stat label="Livraisons" value={String(d.deliveries.length)} />
        <Stat label="Réductions accordées" value={formatCurrency(reductions)} />
        <Stat label="Valeur stock global" value={formatCurrency(stockValue)} />
      </div>
      <Card>
        <CardHeader><CardTitle>État du stock</CardTitle></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Prix</TableHead><TableHead className="text-right">Valeur</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right"><Badge variant={p.stock_global < 5 ? "destructive" : "secondary"}>{p.stock_global}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.stock_global * Number(p.price))}</TableCell>
                </TableRow>
              ))}
              {d.products.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucun produit. Créez-en dans l'onglet Produits.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "bg-gradient-primary text-primary-foreground border-0 shadow-elegant" : ""}>
      <CardContent className="p-5">
        <div className={`text-xs uppercase tracking-wider ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</div>
        <div className="font-display text-2xl mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

// ============== PRODUCTS ==============
function ProductsSection() {
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
    const res = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Produit mis à jour" : "Produit créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }
  }
  async function remove(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["products"] }); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl">Produits</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-1" />Nouveau</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau produit"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={60} /></div>
                <div><Label>Stock</Label><Input type="number" min="0" value={form.stock_global} onChange={(e) => setForm({ ...form, stock_global: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix de vente (USD)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
                <div><Label>Coût d'achat</Label><Input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={500} /></div>
              <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Prix</TableHead><TableHead className="text-right">Stock</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                <TableCell className="text-right"><Badge variant={p.stock_global < 5 ? "destructive" : "secondary"}>{p.stock_global}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun produit pour l'instant.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

// ============== LIVREURS ==============
function LivreursSection() {
  const qc = useQueryClient();
  const create = useServerFn(createLivreur);
  const del = useServerFn(deleteLivreur);
  const resetPwd = useServerFn(resetLivreurPassword);
  const { data: livreurs = [] } = useQuery({
    queryKey: ["livreurs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("id, full_name, badge_number, phone, created_at")
        .not("badge_number", "is", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", badge_number: "", phone: "", password: "" });
  const m = useMutation({
    mutationFn: async () => create({ data: { ...form, phone: form.phone || null } }),
    onSuccess: () => { toast.success("Livreur créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["livreurs"] }); setForm({ full_name: "", badge_number: "", phone: "", password: "" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  async function remove(id: string) {
    if (!confirm("Supprimer ce livreur ?")) return;
    try { await del({ data: { user_id: id } }); qc.invalidateQueries({ queryKey: ["livreurs"] }); toast.success("Supprimé"); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function reset(id: string) {
    const p = prompt("Nouveau mot de passe (min 6 caractères) :");
    if (!p || p.length < 6) return;
    try { await resetPwd({ data: { user_id: id, password: p } }); toast.success("Mot de passe modifié"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Livreurs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Nouveau livreur</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un compte livreur</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
              <div><Label>Nom complet</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div><Label>Numéro de badge</Label><Input value={form.badge_number} onChange={(e) => setForm({ ...form, badge_number: e.target.value })} required placeholder="ex: LIV-001" /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Mot de passe initial</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>Créer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Badge</TableHead><TableHead>Téléphone</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {livreurs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.full_name}</TableCell>
                <TableCell><Badge className="bg-gold text-gold-foreground hover:bg-gold">{l.badge_number}</Badge></TableCell>
                <TableCell>{l.phone ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => reset(l.id)}><KeyRound className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(l.id)}><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {livreurs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun livreur. Créez-en un pour commencer.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

// ============== ALLOCATIONS ==============
function AllocationsSection() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await supabase.from("products").select("*").eq("active", true)).data ?? [] });
  const { data: livreurs = [] } = useQuery({ queryKey: ["livreurs"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, badge_number").not("badge_number", "is", null)).data ?? [] });
  const { data: history = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: async () => (await supabase.from("stock_allocations").select("id, quantity, created_at, notes, product:products(name), livreur:profiles!stock_allocations_livreur_id_fkey(full_name, badge_number)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const [form, setForm] = useState({ product_id: "", livreur_id: "", quantity: "", notes: "" });
  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("stock_allocations").insert({
      product_id: form.product_id, livreur_id: form.livreur_id,
      quantity: parseInt(form.quantity), notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Stock alloué"); setForm({ product_id: "", livreur_id: "", quantity: "", notes: "" });
      qc.invalidateQueries(); }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Remettre du stock à un livreur</h1>
      <Card><CardContent className="p-6">
        <form onSubmit={allocate} className="grid md:grid-cols-2 gap-4">
          <div><Label>Produit</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.stock_global})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Livreur</Label>
            <Select value={form.livreur_id} onValueChange={(v) => setForm({ ...form, livreur_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir un livreur" /></SelectTrigger>
              <SelectContent>{livreurs.map((l) => <SelectItem key={l.id} value={l.id}>{l.full_name} — {l.badge_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantité</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></div>
          <div><Label>Notes (optionnel)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={!form.product_id || !form.livreur_id || !form.quantity}>Remettre le stock</Button></div>
        </form>
      </CardContent></Card>
      <div>
        <h2 className="font-display text-xl mb-3">Historique récent</h2>
        <Card><CardContent className="p-0 overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Produit</TableHead><TableHead>Livreur</TableHead><TableHead className="text-right">Quantité</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDate(h.created_at)}</TableCell>
                  <TableCell>{h.product?.name}</TableCell>
                  <TableCell>{h.livreur?.full_name} <span className="text-muted-foreground">({h.livreur?.badge_number})</span></TableCell>
                  <TableCell className="text-right font-medium">{h.quantity}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucune allocation pour l'instant.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  );
}

// ============== ACCOUNTING ==============
function AccountingSection() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { start, end } = monthRange(month);
  const { data: rows = [] } = useQuery({
    queryKey: ["accounting", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, receipt_number, delivered_at, client_name, client_address, subtotal, discount_amount, total_amount, payment_method, livreur:profiles!deliveries_livreur_id_fkey(full_name, badge_number)")
        .gte("delivered_at", start).lt("delivered_at", end)
        .order("delivered_at", { ascending: false });
      return (data ?? []).map((r: any) => ({ ...r, livreur_name: `${r.livreur?.full_name ?? ""} (${r.livreur?.badge_number ?? ""})` }));
    },
  });
  const totals = rows.reduce((acc, r) => ({
    ca: acc.ca + Number(r.total_amount), red: acc.red + Number(r.discount_amount), count: acc.count + 1,
  }), { ca: 0, red: 0, count: 0 });

  const perLivreur = rows.reduce((acc: Record<string, { name: string; ca: number; count: number }>, r) => {
    const k = r.livreur_name;
    if (!acc[k]) acc[k] = { name: k, ca: 0, count: 0 };
    acc[k].ca += Number(r.total_amount); acc[k].count += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Comptabilité mensuelle</h1>
          <p className="text-sm text-muted-foreground">{formatMonth(month + "-01")}</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button variant="outline" onClick={() => exportMonthlyExcel(month, rows)} disabled={rows.length === 0}><Download className="size-4 mr-1" />Excel</Button>
          <Button onClick={() => exportMonthlyPDF(month, rows)} disabled={rows.length === 0}><Download className="size-4 mr-1" />PDF</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Chiffre d'affaires" value={formatCurrency(totals.ca)} highlight />
        <Stat label="Livraisons" value={String(totals.count)} />
        <Stat label="Réductions accordées" value={formatCurrency(totals.red)} />
      </div>
      <Card>
        <CardHeader><CardTitle>Performance par livreur</CardTitle></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Livreur</TableHead><TableHead className="text-right">Livraisons</TableHead><TableHead className="text-right">CA</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.values(perLivreur).map((l) => (
                <TableRow key={l.name}><TableCell>{l.name}</TableCell><TableCell className="text-right">{l.count}</TableCell><TableCell className="text-right font-medium">{formatCurrency(l.ca)}</TableCell></TableRow>
              ))}
              {Object.keys(perLivreur).length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Aucune livraison ce mois-ci.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Détail des livraisons</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reçu</TableHead><TableHead>Client</TableHead><TableHead>Livreur</TableHead><TableHead className="text-right">Réduc.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.delivered_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                  <TableCell>{r.client_name}</TableCell>
                  <TableCell className="text-xs">{r.livreur_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.discount_amount)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
