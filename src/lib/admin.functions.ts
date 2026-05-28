import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createLivreurSchema = z.object({
  badge_number: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/, "Badge: lettres, chiffres, - ou _ uniquement"),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  password: z.string().min(6).max(72),
});

function badgeToEmail(badge: string) {
  return `livreur.${badge.toLowerCase().replace(/[^a-z0-9]/g, "")}@angelina.shapper`;
}

/** Création d'un compte livreur — admin uniquement. */
export const createLivreur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createLivreurSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Vérifier que l'appelant est admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Accès refusé : admin requis");

    const email = badgeToEmail(data.badge_number);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, badge_number: data.badge_number },
    });
    if (error) throw new Error(error.message);
    const newUid = created.user!.id;

    // Mettre à jour le profil (trigger l'a déjà créé) avec téléphone
    if (data.phone) {
      await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", newUid);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUid, role: "livreur" });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newUid, email };
  });

/** Désactiver un livreur (suppression). */
export const deleteLivreur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Accès refusé");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Réinitialiser le mot de passe d'un livreur. */
export const resetLivreurPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Accès refusé");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bootstrap : promouvoir l'utilisateur actuel en admin SI aucun admin n'existe encore. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Error("Un admin existe déjà");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
