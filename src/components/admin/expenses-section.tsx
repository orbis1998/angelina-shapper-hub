import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createExpense, deleteExpense } from "@/lib/expense.functions";
import { formatCurrency, formatDate, formatMonth, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/admin/shared";

export function ExpensesSection() {
  const qc = useQueryClient();
  const create = useServerFn(createExpense);
  const del = useServerFn(deleteExpense);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { start, end } = monthRange(month);
  const { data: adv } = useAdvancedAccounting(month);

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", month],
    queryFn: async () =>
      (await supabase.from("expenses").select("*, category:expense_categories(name)").gte("expense_date", start.slice(0, 10)).lt("expense_date", end.slice(0, 10)).order("expense_date", { ascending: false })).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category_id: "", amount_usd: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });

  const m = useMutation({
    mutationFn: async () => create({
      data: {
        category_id: form.category_id,
        amount_usd: parseFloat(form.amount_usd),
        description: form.description,
        expense_date: form.expense_date,
      },
    }),
    onSuccess: () => {
      toast.success("Dépense enregistrée");
      setOpen(false);
      setForm({ category_id: "", amount_usd: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount_usd), 0);
  const ca = adv?.caProducts ?? 0;
  const netAfterExpenses = ca - totalExpenses;

  const byCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    const k = e.category?.name ?? "Autre";
    acc[k] = (acc[k] || 0) + Number(e.amount_usd);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dépenses"
        description="Enregistrement des charges — impact direct sur le bénéfice général"
        actions={
          <>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Nouvelle dépense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Enregistrer une dépense</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
                <div><Label>Catégorie</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Montant (USD)</Label><Input type="number" min="0.01" step="0.01" value={form.amount_usd} onChange={(e) => setForm({ ...form, amount_usd: e.target.value })} required /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
                <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required /></div>
                <DialogFooter><Button type="submit" disabled={m.isPending}>Enregistrer</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="CA du mois" value={formatCurrency(ca)} />
        <StatCard label="Total dépenses" value={formatCurrency(totalExpenses)} highlight />
        <StatCard label="CA après dépenses" value={formatCurrency(netAfterExpenses)} sub="Bénéfice avant autres charges" />
      </div>

      {Object.keys(byCategory).length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base font-semibold">Par catégorie — {formatMonth(month + "-01")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20"><TableHead>Catégorie</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="text-right">% du CA</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(amt)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{ca > 0 ? `${((amt / ca) * 100).toFixed(1)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20"><TableHead>Date</TableHead><TableHead>Catégorie</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Montant</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{e.expense_date}</TableCell>
                <TableCell>{e.category?.name}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(e.amount_usd)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("Supprimer ?")) return;
                    try { await del({ data: { expense_id: e.id } }); qc.invalidateQueries(); toast.success("Supprimé"); }
                    catch (err) { toast.error((err as Error).message); }
                  }}><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune dépense ce mois.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

/** KPIs comptabilité avancée — à intégrer dans AccountingSection */
export function useAdvancedAccounting(month: string) {
  const { start, end } = monthRange(month);
  return useQuery({
    queryKey: ["advanced-accounting", month],
    queryFn: async () => {
      const [deliveries, posSales, shipments, expenses, deliveryFees] = await Promise.all([
        supabase.from("deliveries").select("total_amount, subtotal, delivered_at").gte("delivered_at", start).lt("delivered_at", end),
        supabase.from("pos_sales").select("total_usd, created_at").gte("created_at", start).lt("created_at", end),
        supabase.from("shipments").select("total_usd, subtotal_usd, status, created_at").gte("created_at", start).lt("created_at", end),
        supabase.from("expenses").select("amount_usd, expense_date").gte("expense_date", start.slice(0, 10)).lt("expense_date", end.slice(0, 10)),
        supabase.from("deliveries").select("delivery_fee_cdf").gte("delivered_at", start).lt("delivered_at", end),
      ]);
      const caDeliveries = (deliveries.data ?? []).reduce((s, d) => s + Number(d.total_amount), 0);
      const caPos = (posSales.data ?? []).reduce((s, d) => s + Number(d.total_usd), 0);
      const caShipments = (shipments.data ?? []).filter((s) => s.status === "delivered").reduce((s, d) => s + Number(d.subtotal_usd), 0);
      const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount_usd), 0);
      const totalFeesCdf = (deliveryFees.data ?? []).reduce((s, d) => s + Number(d.delivery_fee_cdf ?? 0), 0);
      const caProducts = caDeliveries + caPos + caShipments;
      return { caProducts, caDeliveries, caPos, caShipments, totalExpenses, totalFeesCdf, netResult: caProducts - totalExpenses };
    },
  });
}
