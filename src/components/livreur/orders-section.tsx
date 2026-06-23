import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateOrderStatus } from "@/lib/order.functions";
import { formatCurrency, formatCDF, formatDate } from "@/lib/format";
import { whatsappLink, orderWhatsAppMessage } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, MessageCircle, Truck, CheckCircle, XCircle, Package } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assignée", en_route: "En route", delivered: "Livrée", failed: "Échouée",
};

export function LivreurOrdersSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const updateStatus = useServerFn(updateOrderStatus);
  const [detail, setDetail] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [failReason, setFailReason] = useState("");
  const [failOpen, setFailOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(product_name, quantity, unit_price_usd, line_total_usd)")
        .eq("livreur_id", userId)
        .in("status", ["assigned", "en_route"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const stats = {
    assigned: orders.filter((o) => o.status === "assigned").length,
    en_route: orders.filter((o) => o.status === "en_route").length,
  };

  async function changeStatus(orderId: string, status: "en_route" | "delivered" | "failed", extra?: { failure_reason?: string; payment_method?: string }) {
    setBusy(true);
    try {
      await updateStatus({ data: { order_id: orderId, status, ...extra } });
      toast.success(status === "delivered" ? "Commande livrée — comptabilité mise à jour" : "Statut mis à jour");
      setDetail(null);
      setFailOpen(false);
      setFailReason("");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl">Mes commandes</h1>
        <p className="text-sm text-muted-foreground">
          {stats.assigned} assignée(s) · {stats.en_route} en route
        </p>
      </div>

      {orders.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Package className="size-10 mx-auto mb-3 opacity-40" />
          Aucune commande assignée pour le moment.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {orders.map((o: any) => (
          <Card key={o.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setDetail(o); setPaymentMethod(o.payment_method ?? "cash"); }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{o.order_number}</div>
                  <div className="font-medium text-lg">{o.client_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="size-3" />{o.commune} — {o.client_address}
                  </div>
                </div>
                <Badge>{STATUS_LABELS[o.status]}</Badge>
              </div>
              <div className="flex justify-between items-center mt-3 text-sm">
                <span>{o.scheduled_at ? formatDate(o.scheduled_at) : "Heure non définie"}</span>
                <span className="font-semibold">{formatCurrency(o.total_products_usd)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.order_number}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div><strong>{detail.client_name}</strong></div>
                <div className="text-muted-foreground">{detail.client_address}, {detail.commune}</div>
                {detail.scheduled_at && <div>Heure : {formatDate(detail.scheduled_at)}</div>}
                <div>Frais livraison : {formatCDF(detail.delivery_fee_cdf)}</div>
                {detail.notes && <div className="bg-muted rounded p-2">{detail.notes}</div>}
                <div className="border-t pt-2 space-y-1">
                  {(detail.order_items ?? []).map((i: any) => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.product_name} × {i.quantity}</span>
                      <span>{formatCurrency(i.line_total_usd)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total produits</span><span>{formatCurrency(detail.total_products_usd)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {detail.client_phone && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={whatsappLink(detail.client_phone, orderWhatsAppMessage(detail.order_number, detail.client_name))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-4 mr-2" />Contacter sur WhatsApp
                    </a>
                  </Button>
                )}
                {detail.status === "assigned" && (
                  <>
                    <Button className="w-full" disabled={busy} onClick={() => changeStatus(detail.id, "en_route")}>
                      <Truck className="size-4 mr-2" />En route
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setFailOpen(true); }}>
                      <XCircle className="size-4 mr-2" />Échoué
                    </Button>
                  </>
                )}
                {detail.status === "en_route" && (
                  <>
                    <div><Label>Paiement</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Espèces</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          <SelectItem value="bank_transfer">Virement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" disabled={busy} onClick={() => changeStatus(detail.id, "delivered", { payment_method: paymentMethod })}>
                      <CheckCircle className="size-4 mr-2" />Livré
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => setFailOpen(true)}>
                      <XCircle className="size-4 mr-2" />Échoué
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif d'échec</DialogTitle></DialogHeader>
          <Textarea value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="Client absent, adresse incorrecte…" rows={3} />
          <Button variant="destructive" disabled={busy || !failReason.trim()} onClick={() => detail && changeStatus(detail.id, "failed", { failure_reason: failReason })}>
            Confirmer l'échec
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
