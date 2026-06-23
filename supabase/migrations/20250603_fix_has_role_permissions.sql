-- Grant EXECUTE permission to has_role for authenticated users (needed for RLS policies)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;