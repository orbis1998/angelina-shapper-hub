import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/admin/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMonth, monthRange } from "@/lib/format";

export function DashboardSection() {
  const month = new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);
  const { data } = useQuery({
    queryKey: ["admin-dashboard", month],
    queryFn: async () => {
      const [deliveries, products, livreurs, orders] = await Promise.all([
        supabase.from("deliveries").select("total_amount, discount_amount").gte("delivered_at", start).lt("delivered_at", end),
        supabase.from("products").select("id, name, stock_global, price, cost_price").eq("active", true),
        supabase.from("profiles").select("id").not("badge_number", "is", null),
        supabase.from("orders").select("id").eq("status", "assigned"),
      ]);
      return {
        deliveries: deliveries.data ?? [],
        products: products.data ?? [],
        livreurs: livreurs.data ?? [],
        pendingOrders: orders.data?.length ?? 0,
      };
    },
  });
  const d = data ?? { deliveries: [], products: [], livreurs: [], pendingOrders: 0 };
  const ca = d.deliveries.reduce((s, x) => s + Number(x.total_amount), 0);
  const reductions = d.deliveries.reduce((s, x) => s + Number(x.discount_amount), 0);
  const stockQty = d.products.reduce((s, p) => s + p.stock_global, 0);
  const stockValue = d.products.reduce((s, p) => s + p.stock_global * Number(p.price), 0);

  return (
    <div className="space-y-8">
      <PageHeader title={`Tableau de bord — ${formatMonth(month + "-01")}`} description="Vue d'ensemble de l'activité du mois." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Chiffre d'affaires" value={formatCurrency(ca)} highlight />
        <StatCard label="Livraisons" value={String(d.deliveries.length)} />
        <StatCard label="Réductions" value={formatCurrency(reductions)} />
        <StatCard label="Commandes en cours" value={String(d.pendingOrders)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Stock global (unités)" value={String(stockQty)} sub="Entrepôt principal" />
        <StatCard label="Valeur stock" value={formatCurrency(stockValue)} sub="Prix de vente" />
        <StatCard label="Livreurs actifs" value={String(d.livreurs.length)} />
      </div>
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Stock global — détail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix unit.</TableHead>
                <TableHead className="text-right">Valeur totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right"><Badge variant={p.stock_global < 5 ? "destructive" : "secondary"}>{p.stock_global}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(p.stock_global * Number(p.price))}</TableCell>
                </TableRow>
              ))}
              {d.products.length > 0 && (
                <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{stockQty}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(stockValue)}</TableCell>
                </TableRow>
              )}
              {d.products.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Aucun produit actif.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
