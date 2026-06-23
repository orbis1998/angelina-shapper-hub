-- ============================================
-- SCRIPT POUR CRÉER UN ADMIN VIA SQL
-- ============================================

-- OPTION 1: Ajouter le rôle admin à un utilisateur EXISTANT
-- Si tu as déjà un utilisateur créé, utilise son UUID:

-- D'abord, trouve l'UUID de l'utilisateur:
-- SELECT id, email FROM auth.users WHERE email = 'admin@angelina.shapper';

-- Puis exécute ceci (remplace UUID_DE_L_UTILISATEUR par l'UUID trouvé):
INSERT INTO public.user_roles (user_id, role)
VALUES ('UUID_DE_L_UTILISATEUR', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================

-- OPTION 2: Ajouter le rôle admin à TOUS les utilisateurs (utile si tu veux un seul admin initial)
-- ⚠️ À utiliser avec prudence:

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@angelina.shapper'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================

-- OPTION 3: Vérifier tous les admins actuels:
SELECT
  u.id,
  u.email,
  ur.role,
  p.full_name
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE ur.role = 'admin'
ORDER BY ur.created_at DESC;

-- ============================================

-- OPTION 4: Copie le UUID d'un utilisateur existant depuis la console Supabase:
-- 1. Va sur Supabase > Authentication > Users
-- 2. Copie l'UUID de l'utilisateur
-- 3. Exécute ceci:

-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('COLLE_LE_UUID_ICI', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
