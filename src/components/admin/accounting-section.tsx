import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, CHART_COLORS } from "@/components/admin/shared";
import { useAdvancedAccounting } from "@/components/admin/expenses-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate, formatMonth, monthRange, formatCDF } from "@/lib/format";
import { exportMonthlyExcel, exportMonthlyPDF } from "@/lib/exports";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

export function AccountingSection() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { start, end } = monthRange(month);
  const { data: advanced } = useAdvancedAccounting(month);

  const { data: rows = [] } = useQuery({
    queryKey: ["accounting", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, receipt_number, delivered_at, client_name, subtotal, discount_amount, total_amount, payment_method, livreur:profiles!deliveries_livreur_id_fkey(full_name, badge_number)")
        .gte("delivered_at", start).lt("delivered_at", end)
        .order("delivered_at", { ascending: false });
      return (data ?? []).map((r: any) => ({ ...r, livreur_name: `${r.livreur?.full_name ?? ""} (${r.livreur?.badge_number ?? ""})` }));
    },
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["accounting-stock"],
    queryFn: async () => (await supabase.from("products").select("name, stock_global, price, cost_price").eq("active", true).order("name")).data ?? [],
  });

  const totals = rows.reduce((acc, r) => ({
    ca: acc.ca + Number(r.total_amount),
    red: acc.red + Number(r.discount_amount),
    subtotal: acc.subtotal + Number(r.subtotal),
    count: acc.count + 1,
  }), { ca: 0, red: 0, subtotal: 0, count: 0 });

  const stockQty = stock.reduce((s, p) => s + p.stock_global, 0);
  const stockValue = stock.reduce((s, p) => s + p.stock_global * Number(p.price), 0);
  const stockCost = stock.reduce((s, p) => s + p.stock_global * Number(p.cost_price ?? 0), 0);

  const perLivreur = rows.reduce((acc: Record<string, { name: string; ca: number; count: number }>, r) => {
    const k = r.livreur_name;
    if (!acc[k]) acc[k] = { name: k, ca: 0, count: 0 };
    acc[k].ca += Number(r.total_amount);
    acc[k].count += 1;
    return acc;
  }, {});

  const paymentChart = Object.entries(rows.reduce((acc: Record<string, number>, r) => {
    const m = r.payment_method || "inconnu";
    acc[m] = (acc[m] || 0) + Number(r.total_amount);
    return acc;
  }, {})).map(([name, value]) => ({ name, value: Number(value) }));

  const trendChart = Object.values(rows.reduce((acc: Record<string, { date: string; revenue: number }>, r) => {
    const date = new Date(r.delivered_at).toLocaleDateString("fr-FR", { month: "2-digit", day: "2-digit" });
    if (!acc[date]) acc[date] = { date, revenue: 0 };
    acc[date].revenue += Number(r.total_amount);
    return acc;
  }, {}));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comptabilité"
        description={formatMonth(month + "-01")}
        actions={
          <>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button variant="outline" onClick={() => exportMonthlyExcel(month, rows)} disabled={rows.length === 0}><Download className="size-4 mr-1" />Excel</Button>
            <Button onClick={() => exportMonthlyPDF(month, rows)} disabled={rows.length === 0}><Download className="size-4 mr-1" />PDF</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="CA produits" value={formatCurrency(advanced?.caProducts ?? totals.ca)} highlight />
        <StatCard label="Réductions ventes" value={formatCurrency(totals.red)} />
        <StatCard label="Frais livraison" value={formatCDF(advanced?.totalFeesCdf ?? 0)} />
        <StatCard label="Dépenses" value={formatCurrency(advanced?.totalExpenses ?? 0)} />
        <StatCard label="Résultat net" value={formatCurrency(advanced?.netResult ?? totals.ca)} />
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Stock global — valorisation</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix vente</TableHead>
                <TableHead className="text-right">Valeur vente</TableHead>
                <TableHead className="text-right">Coût unit.</TableHead>
                <TableHead className="text-right">Valeur coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right"><Badge variant={p.stock_global < 5 ? "destructive" : "secondary"}>{p.stock_global}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.stock_global * Number(p.price))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(p.cost_price)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(p.stock_global * Number(p.cost_price ?? 0))}</TableCell>
                </TableRow>
              ))}
              {stock.length > 0 && (
                <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
                  <TableCell>Total entrepôt</TableCell>
                  <TableCell className="text-right tabular-nums">{stockQty}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(stockValue)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(stockCost)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {trendChart.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><TrendingUp className="size-4" />Tendance CA</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#171717" strokeWidth={2} dot={false} name="CA" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {Object.keys(perLivreur).length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Performance livreurs</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={Object.values(perLivreur)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="ca" fill="#404040" name="CA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {paymentChart.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Modes de paiement</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentChart} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                  {paymentChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Détail livraisons</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead>Date</TableHead><TableHead>Reçu</TableHead><TableHead>Client</TableHead><TableHead>Livreur</TableHead>
                <TableHead className="text-right">Sous-total</TableHead><TableHead className="text-right">Réduction</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(r.delivered_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                  <TableCell>{r.client_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.livreur_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.subtotal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.discount_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
