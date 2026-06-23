import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard } from "@/components/admin/shared";
import { useAdvancedAccounting } from "@/components/admin/expenses-section";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatMonth, monthRange, formatCDF } from "@/lib/format";

export function BenefitSection() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { start, end } = monthRange(month);
  const { data: adv } = useAdvancedAccounting(month);

  const { data: extra } = useQuery({
    queryKey: ["benefit-detail", month],
    queryFn: async () => {
      const [deliveries, products, orders] = await Promise.all([
        supabase.from("deliveries").select("discount_amount, subtotal, total_amount").gte("delivered_at", start).lt("delivered_at", end),
        supabase.from("products").select("stock_global, price, cost_price").eq("active", true),
        supabase.from("orders").select("discount_amount_usd, total_products_usd").eq("status", "delivered").gte("delivered_at", start).lt("delivered_at", end),
      ]);
      const totalDiscounts =
        (deliveries.data ?? []).reduce((s, d) => s + Number(d.discount_amount), 0) +
        (orders.data ?? []).reduce((s, o) => s + Number(o.discount_amount_usd), 0);
      const stockValue = (products.data ?? []).reduce((s, p) => s + p.stock_global * Number(p.price), 0);
      const stockCost = (products.data ?? []).reduce((s, p) => s + p.stock_global * Number(p.cost_price ?? 0), 0);
      return { totalDiscounts, stockValue, stockCost };
    },
  });

  const ca = adv?.caProducts ?? 0;
  const expenses = adv?.totalExpenses ?? 0;
  const netBenefit = ca - expenses;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bénéfice général"
        description={`Synthèse financière — ${formatMonth(month + "-01")}`}
        actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="CA total produits" value={formatCurrency(ca)} highlight sub="Livraisons + POS + expéditions" />
        <StatCard label="Total dépenses" value={formatCurrency(expenses)} sub="Impact direct sur le bénéfice" />
        <StatCard label="Bénéfice net" value={formatCurrency(netBenefit)} sub="CA − dépenses" />
        <StatCard label="Réductions accordées" value={formatCurrency(extra?.totalDiscounts ?? 0)} sub="Remises clients" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="CA livraisons" value={formatCurrency(adv?.caDeliveries ?? 0)} />
        <StatCard label="CA POS magasin" value={formatCurrency(adv?.caPos ?? 0)} />
        <StatCard label="CA expéditions" value={formatCurrency(adv?.caShipments ?? 0)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Frais livraison (CDF)" value={formatCDF(adv?.totalFeesCdf ?? 0)} sub="Hors CA produits" />
        <StatCard label="Stock valorisé" value={formatCurrency(extra?.stockValue ?? 0)} sub="Actif entrepôt (prix vente)" />
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Calcul du bénéfice</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {[
                ["Chiffre d'affaires produits", formatCurrency(ca), false],
                ["− Dépenses opérationnelles", formatCurrency(expenses), true],
                ["= Bénéfice net", formatCurrency(netBenefit), false],
                ["Réductions / remises (info)", formatCurrency(extra?.totalDiscounts ?? 0), true],
                ["Stock entrepôt (actif)", formatCurrency(extra?.stockValue ?? 0), true],
              ].map(([label, value, muted]) => (
                <TableRow key={label as string} className={label === "= Bénéfice net" ? "bg-muted/40 font-semibold" : ""}>
                  <TableCell className={muted ? "text-muted-foreground" : ""}>{label}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
