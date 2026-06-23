import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/suivi/$code")({ component: TrackingPage });

const STATUS_LABELS: Record<string, string> = {
  preparing: "En préparation",
  shipped: "Expédié",
  in_transit: "En transit",
  delivered: "Livré",
  failed: "Échoué",
};

const STATUS_STEPS = ["preparing", "shipped", "in_transit", "delivered"];

function TrackingPage() {
  const { code } = Route.useParams();

  const { data: shipment, isLoading, error } = useQuery({
    queryKey: ["tracking", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("tracking_code, status, recipient_name, country, city, created_at, shipped_at, delivered_at, shipment_items(product_name, quantity)")
        .eq("tracking_code", code)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6 text-primary-foreground">
          <div className="font-display text-3xl text-gold">Angelina Shapper</div>
          <div className="text-sm opacity-80 mt-1 uppercase tracking-widest">Suivi d'expédition</div>
        </div>

        <Card className="shadow-elegant">
          <CardContent className="p-6">
            {isLoading && <p className="text-center text-muted-foreground">Chargement…</p>}
            {error && <p className="text-center text-destructive">Erreur de chargement</p>}
            {!isLoading && !shipment && (
              <div className="text-center py-8">
                <Package className="size-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">Numéro de suivi introuvable : <strong>{code}</strong></p>
              </div>
            )}
            {shipment && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="font-mono text-lg">{shipment.tracking_code}</div>
                  <Badge className="mt-2">{STATUS_LABELS[shipment.status] ?? shipment.status}</Badge>
                </div>

                <div className="flex justify-between items-center px-2">
                  {STATUS_STEPS.map((step, i) => {
                    const current = STATUS_STEPS.indexOf(shipment.status);
                    const done = current >= i || shipment.status === "delivered";
                    return (
                      <div key={step} className="flex flex-col items-center flex-1">
                        <div className={`size-3 rounded-full ${done ? "bg-gold" : "bg-muted"}`} />
                        <span className="text-[10px] text-muted-foreground mt-1 text-center leading-tight">{STATUS_LABELS[step]}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 text-sm border-t pt-4">
                  <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span>{shipment.city}, {shipment.country}</span></div>
                  <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span>Créé le {formatDate(shipment.created_at)}</span></div>
                  {shipment.shipped_at && <div className="text-muted-foreground">Expédié le {formatDate(shipment.shipped_at)}</div>}
                  {shipment.delivered_at && <div className="text-green-600 font-medium">Livré le {formatDate(shipment.delivered_at)}</div>}
                </div>

                {(shipment.shipment_items ?? []).length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-xs uppercase text-muted-foreground mb-2">Articles</div>
                    {(shipment.shipment_items as any[]).map((i, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span>{i.product_name} × {i.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-primary-foreground/60 mt-6">© Angelina Shapper</p>
      </div>
    </div>
  );
}
