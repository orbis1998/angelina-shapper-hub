import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  client_name: z.string().trim().min(2).max(120),
  client_phone: z.string().trim().max(30).optional().nullable(),
  client_address: z.string().trim().min(3).max(300),
  commune: z.string().trim().min(2),
  livreur_id: z.string().uuid(),
  scheduled_at: z.string().optional().nullable(),
  delivery_fee_cdf: z.number().min(0).default(0),
  discount_amount_usd: z.number().min(0).default(0),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer"]).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(orderItemSchema).min(1),
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

async function getProductMap(ids: string[]) {
  const { data, error } = await supabaseAdmin.from("products").select("id, name, price").in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map(data?.map((p) => [p.id, p]) ?? []);
  return map;
}

function calcTotals(
  items: { quantity: number; unit_price: number }[],
  discount: number,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const disc = Math.min(subtotal, Math.max(0, discount));
  return { subtotal_usd: subtotal, total_products_usd: subtotal - disc, discount_amount_usd: disc };
}

/** Créer une commande et assigner au livreur (réserve le stock). */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const productMap = await getProductMap(data.items.map((i) => i.product_id));
    const lineItems = data.items.map((i) => {
      const p = productMap.get(i.product_id);
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
    const totals = calcTotals(lineItems, data.discount_amount_usd);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        client_name: data.client_name,
        client_phone: data.client_phone ?? null,
        client_address: data.client_address,
        commune: data.commune,
        livreur_id: data.livreur_id,
        status: "assigned",
        scheduled_at: data.scheduled_at ?? null,
        delivery_fee_cdf: data.delivery_fee_cdf,
        subtotal_usd: totals.subtotal_usd,
        discount_amount_usd: totals.discount_amount_usd,
        total_products_usd: totals.total_products_usd,
        payment_method: data.payment_method ?? null,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(
      lineItems.map((li) => ({ ...li, order_id: order.id })),
    );
    if (itemsErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsErr.message);
    }

    const { error: stockErr } = await supabaseAdmin.rpc("reserve_order_stock", { p_order_id: order.id });
    if (stockErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(stockErr.message);
    }

    await supabaseAdmin.from("order_status_history").insert({
      order_id: order.id,
      old_status: null,
      new_status: "assigned",
      changed_by: context.userId,
      notes: "Commande créée et assignée",
    });

    return { id: order.id, order_number: order.order_number };
  });

/** Annuler une commande (restaure le stock). */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: order } = await supabaseAdmin.from("orders").select("status, stock_reserved").eq("id", data.order_id).single();
    if (!order) throw new Error("Commande introuvable");
    if (order.status === "delivered") throw new Error("Impossible d'annuler une commande livrée");
    if (order.stock_reserved) {
      const { error } = await supabaseAdmin.rpc("restore_order_stock", { p_order_id: data.order_id });
      if (error) throw new Error(error.message);
    }
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("order_status_history").insert({
      order_id: data.order_id,
      old_status: order.status,
      new_status: "cancelled",
      changed_by: context.userId,
    });
    return { ok: true };
  });

/** Livreur : changer le statut d'une commande. */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum(["en_route", "delivered", "failed"]),
        failure_reason: z.string().trim().max(300).optional().nullable(),
        payment_method: z.enum(["cash", "mobile_money", "bank_transfer"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.order_id)
      .single();
    if (fetchErr || !order) throw new Error("Commande introuvable");
    if (order.livreur_id !== context.userId) throw new Error("Accès refusé");

    const oldStatus = order.status;
    const allowed: Record<string, string[]> = {
      assigned: ["en_route", "failed"],
      en_route: ["delivered", "failed"],
    };
    if (!allowed[oldStatus]?.includes(data.status)) {
      throw new Error(`Transition invalide : ${oldStatus} → ${data.status}`);
    }

    if (data.status === "failed") {
      if (!data.failure_reason?.trim()) throw new Error("Motif d'échec requis");
      if (order.stock_reserved) {
        const { error } = await supabaseAdmin.rpc("restore_order_stock", { p_order_id: data.order_id });
        if (error) throw new Error(error.message);
      }
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "failed",
          failure_reason: data.failure_reason,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.order_id);
      if (error) throw new Error(error.message);
    } else if (data.status === "en_route") {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ status: "en_route", updated_at: new Date().toISOString() })
        .eq("id", data.order_id);
      if (error) throw new Error(error.message);
    } else if (data.status === "delivered") {
      const payment = data.payment_method ?? order.payment_method ?? "cash";
      const items = (order.order_items ?? []) as Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price_usd: number;
        line_total_usd: number;
      }>;

      const { data: delivery, error: dErr } = await supabaseAdmin
        .from("deliveries")
        .insert({
          livreur_id: order.livreur_id!,
          client_name: order.client_name,
          client_address: `${order.client_address}, ${order.commune}`,
          client_phone: order.client_phone,
          subtotal: order.subtotal_usd,
          discount_amount: order.discount_amount_usd,
          total_amount: order.total_products_usd,
          payment_method: payment,
          notes: order.notes,
          order_id: order.id,
          source: "order",
          delivery_fee_cdf: order.delivery_fee_cdf,
        })
        .select()
        .single();
      if (dErr) throw new Error(dErr.message);

      const { error: iErr } = await supabaseAdmin.from("delivery_items").insert(
        items.map((i) => ({
          delivery_id: delivery.id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price_usd,
          line_total: i.line_total_usd,
        })),
      );
      if (iErr) throw new Error(iErr.message);

      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "delivered",
          delivery_id: delivery.id,
          payment_method: payment,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.order_id);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("order_status_history").insert({
      order_id: data.order_id,
      old_status: oldStatus,
      new_status: data.status,
      changed_by: context.userId,
      notes: data.failure_reason ?? null,
    });

    return { ok: true };
  });
