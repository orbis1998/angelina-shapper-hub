import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lineItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès refusé : admin requis");
}

async function buildLineItems(items: z.infer<typeof lineItemSchema>[]) {
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, price")
    .in("id", items.map((i) => i.product_id));
  if (error) throw new Error(error.message);
  const map = new Map(products?.map((p) => [p.id, p]) ?? []);
  return items.map((i) => {
    const p = map.get(i.product_id);
    if (!p) throw new Error("Produit introuvable");
    const unit = Number(p.price);
    return {
      product_id: i.product_id,
      product_name: p.name,
      quantity: i.quantity,
      unit_price_usd: unit,
      line_total_usd: i.quantity * unit,
    };
  });
}

/** Vente POS magasin — décrémente stock global. */
export const createPosSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z.array(lineItemSchema).min(1),
        discount_usd: z.number().min(0).default(0),
        payment_method: z.enum(["cash", "mobile_money", "bank_transfer"]),
        client_name: z.string().trim().max(120).optional().nullable(),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const lineItems = await buildLineItems(data.items);
    const subtotal = lineItems.reduce((s, i) => s + i.line_total_usd, 0);
    const disc = Math.min(subtotal, data.discount_usd);
    const total = subtotal - disc;

    const { data: sale, error } = await supabaseAdmin
      .from("pos_sales")
      .insert({
        cashier_id: context.userId,
        subtotal_usd: subtotal,
        discount_usd: disc,
        total_usd: total,
        payment_method: data.payment_method,
        client_name: data.client_name ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsErr } = await supabaseAdmin.from("pos_sale_items").insert(
      lineItems.map((li) => ({ ...li, pos_sale_id: sale.id })),
    );
    if (itemsErr) throw new Error(itemsErr.message);

    return { id: sale.id, sale_number: sale.sale_number, total_usd: total };
  });

/** Expédition internationale — décrémente stock global. */
export const createShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        recipient_name: z.string().trim().min(2).max(120),
        recipient_phone: z.string().trim().max(30).optional().nullable(),
        recipient_address: z.string().trim().max(300).optional().nullable(),
        country: z.string().trim().min(2),
        city: z.string().trim().min(2),
        items: z.array(lineItemSchema).min(1),
        discount_usd: z.number().min(0).default(0),
        shipping_fee_usd: z.number().min(0).default(0),
        payment_method: z.enum(["cash", "mobile_money", "bank_transfer"]),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const lineItems = await buildLineItems(data.items);
    const subtotal = lineItems.reduce((s, i) => s + i.line_total_usd, 0);
    const disc = Math.min(subtotal, data.discount_usd);
    const total = subtotal - disc + data.shipping_fee_usd;

    const { data: shipment, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        recipient_name: data.recipient_name,
        recipient_phone: data.recipient_phone ?? null,
        recipient_address: data.recipient_address ?? null,
        country: data.country,
        city: data.city,
        subtotal_usd: subtotal,
        discount_usd: disc,
        total_usd: total,
        shipping_fee_usd: data.shipping_fee_usd,
        payment_method: data.payment_method,
        notes: data.notes ?? null,
        created_by: context.userId,
        status: "preparing",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsErr } = await supabaseAdmin.from("shipment_items").insert(
      lineItems.map((li) => ({ ...li, shipment_id: shipment.id })),
    );
    if (itemsErr) throw new Error(itemsErr.message);

    await supabaseAdmin.from("shipment_status_history").insert({
      shipment_id: shipment.id,
      old_status: null,
      new_status: "preparing",
      changed_by: context.userId,
      notes: "Expédition créée",
    });

    return {
      id: shipment.id,
      tracking_code: shipment.tracking_code,
      total_usd: total,
    };
  });

/** Mettre à jour le statut d'une expédition. */
export const updateShipmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shipment_id: z.string().uuid(),
        status: z.enum(["shipped", "in_transit", "delivered", "failed"]),
        notes: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: shipment } = await supabaseAdmin
      .from("shipments")
      .select("status")
      .eq("id", data.shipment_id)
      .single();
    if (!shipment) throw new Error("Expédition introuvable");

    const updates: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "shipped") updates.shipped_at = new Date().toISOString();
    if (data.status === "delivered") updates.delivered_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from("shipments").update(updates).eq("id", data.shipment_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("shipment_status_history").insert({
      shipment_id: data.shipment_id,
      old_status: shipment.status,
      new_status: data.status,
      changed_by: context.userId,
      notes: data.notes ?? null,
    });

    return { ok: true };
  });
