
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'livreur');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  badge_number TEXT UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(12,2) DEFAULT 0 CHECK (cost_price >= 0),
  stock_global INTEGER NOT NULL DEFAULT 0 CHECK (stock_global >= 0),
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Stock allocations (historique des remises)
CREATE TABLE public.stock_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  livreur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  allocated_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_allocations TO authenticated;
GRANT ALL ON public.stock_allocations TO service_role;
ALTER TABLE public.stock_allocations ENABLE ROW LEVEL SECURITY;

-- Livreur stock courant
CREATE TABLE public.livreur_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (livreur_id, product_id)
);
GRANT SELECT ON public.livreur_stock TO authenticated;
GRANT ALL ON public.livreur_stock TO service_role;
ALTER TABLE public.livreur_stock ENABLE ROW LEVEL SECURITY;

-- Deliveries
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL DEFAULT 'AS-' || to_char(now(), 'YYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6),
  livreur_id UUID NOT NULL REFERENCES public.profiles(id),
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_phone TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  notes TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deliveries_livreur ON public.deliveries(livreur_id);
CREATE INDEX idx_deliveries_date ON public.deliveries(delivered_at);

-- Delivery items
CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_items TO authenticated;
GRANT ALL ON public.delivery_items TO service_role;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);

-- ========= TRIGGERS =========

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_livreur_stock_updated BEFORE UPDATE ON public.livreur_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allocation: décrémenter stock_global, incrémenter livreur_stock
CREATE OR REPLACE FUNCTION public.apply_stock_allocation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_stock INT;
BEGIN
  SELECT stock_global INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock global insuffisant (disponible: %, demandé: %)', current_stock, NEW.quantity;
  END IF;
  UPDATE public.products SET stock_global = stock_global - NEW.quantity WHERE id = NEW.product_id;
  INSERT INTO public.livreur_stock (livreur_id, product_id, quantity)
  VALUES (NEW.livreur_id, NEW.product_id, NEW.quantity)
  ON CONFLICT (livreur_id, product_id) DO UPDATE
    SET quantity = livreur_stock.quantity + EXCLUDED.quantity, updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_allocation AFTER INSERT ON public.stock_allocations
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_allocation();

-- Delivery item: décrémenter livreur_stock
CREATE OR REPLACE FUNCTION public.apply_delivery_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_qty INT; v_livreur UUID;
BEGIN
  SELECT livreur_id INTO v_livreur FROM public.deliveries WHERE id = NEW.delivery_id;
  SELECT quantity INTO current_qty FROM public.livreur_stock
    WHERE livreur_id = v_livreur AND product_id = NEW.product_id FOR UPDATE;
  IF current_qty IS NULL OR current_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Stock livreur insuffisant pour ce produit';
  END IF;
  UPDATE public.livreur_stock SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE livreur_id = v_livreur AND product_id = NEW.product_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_delivery_item AFTER INSERT ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_delivery_item();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, badge_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'badge_number'
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========= RLS POLICIES =========

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- user_roles
CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- products
CREATE POLICY "Authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage products insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products update" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products delete" ON public.products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- stock_allocations
CREATE POLICY "Admins read allocations" ON public.stock_allocations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR livreur_id = auth.uid());
CREATE POLICY "Admins create allocations" ON public.stock_allocations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- livreur_stock
CREATE POLICY "View own livreur_stock" ON public.livreur_stock FOR SELECT TO authenticated
  USING (livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- deliveries
CREATE POLICY "View deliveries" ON public.deliveries FOR SELECT TO authenticated
  USING (livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Livreurs create deliveries" ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (livreur_id = auth.uid() AND public.has_role(auth.uid(), 'livreur'));

-- delivery_items
CREATE POLICY "View delivery_items" ON public.delivery_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id
    AND (d.livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Insert delivery_items" ON public.delivery_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND d.livreur_id = auth.uid()));
