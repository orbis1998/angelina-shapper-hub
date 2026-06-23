-- Orders, POS, Shipments, Expenses module

CREATE TYPE public.order_status AS ENUM (
  'pending', 'assigned', 'en_route', 'delivered', 'failed', 'cancelled'
);

CREATE TYPE public.shipment_status AS ENUM (
  'preparing', 'shipped', 'in_transit', 'delivered', 'failed'
);

-- ========= ORDERS =========

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT 'CMD-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
  livreur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_address TEXT NOT NULL,
  commune TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  delivery_fee_cdf NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_cdf >= 0),
  subtotal_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount_usd >= 0),
  total_products_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  notes TEXT,
  failure_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  stock_reserved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12,2) NOT NULL,
  line_total_usd NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status public.order_status,
  new_status public.order_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= SHIPMENTS (expédition internationale) =========

CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code TEXT UNIQUE NOT NULL DEFAULT 'EXP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
  status public.shipment_status NOT NULL DEFAULT 'preparing',
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_address TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  subtotal_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
  total_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12,2) NOT NULL,
  line_total_usd NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_status public.shipment_status,
  new_status public.shipment_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= POS MAGASIN =========

CREATE TABLE public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT UNIQUE NOT NULL DEFAULT 'POS-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  subtotal_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
  total_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL,
  client_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd NUMERIC(12,2) NOT NULL,
  line_total_usd NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= EXPENSES =========

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.expense_categories (name, description) VALUES
  ('Loyer', 'Loyer et charges locatives'),
  ('Carburant', 'Essence et transport'),
  ('Salaires', 'Rémunération personnel'),
  ('Fournitures', 'Matériel et consommables'),
  ('Marketing', 'Publicité et promotion'),
  ('Maintenance', 'Réparations et entretien'),
  ('Autre', 'Dépenses diverses');

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link deliveries to orders (avoid double stock decrement)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'livreur_pos';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_fee_cdf NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX idx_orders_livreur ON public.orders(livreur_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_scheduled ON public.orders(scheduled_at);
CREATE INDEX idx_shipments_tracking ON public.shipments(tracking_code);
CREATE INDEX idx_shipments_status ON public.shipments(status);
CREATE INDEX idx_pos_sales_date ON public.pos_sales(created_at);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
GRANT SELECT, INSERT ON public.shipment_items TO authenticated;
GRANT ALL ON public.shipment_items TO service_role;
GRANT SELECT, INSERT ON public.shipment_status_history TO authenticated;
GRANT ALL ON public.shipment_status_history TO service_role;
GRANT SELECT, INSERT ON public.pos_sales TO authenticated;
GRANT ALL ON public.pos_sales TO service_role;
GRANT SELECT, INSERT ON public.pos_sale_items TO authenticated;
GRANT ALL ON public.pos_sale_items TO service_role;
GRANT SELECT ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ========= STOCK FUNCTIONS =========

CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_livreur UUID;
  current_qty INT;
BEGIN
  SELECT livreur_id INTO v_livreur FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_livreur IS NULL THEN
    RAISE EXCEPTION 'Commande sans livreur assigné';
  END IF;
  IF (SELECT stock_reserved FROM public.orders WHERE id = p_order_id) THEN
    RETURN;
  END IF;
  FOR r IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
    SELECT quantity INTO current_qty FROM public.livreur_stock
      WHERE livreur_id = v_livreur AND product_id = r.product_id FOR UPDATE;
    IF current_qty IS NULL OR current_qty < r.quantity THEN
      RAISE EXCEPTION 'Stock livreur insuffisant pour le produit';
    END IF;
    UPDATE public.livreur_stock SET quantity = quantity - r.quantity, updated_at = now()
      WHERE livreur_id = v_livreur AND product_id = r.product_id;
  END LOOP;
  UPDATE public.orders SET stock_reserved = true, updated_at = now() WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_livreur UUID;
BEGIN
  IF NOT (SELECT stock_reserved FROM public.orders WHERE id = p_order_id) THEN
    RETURN;
  END IF;
  SELECT livreur_id INTO v_livreur FROM public.orders WHERE id = p_order_id;
  IF v_livreur IS NULL THEN RETURN; END IF;
  FOR r IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
    INSERT INTO public.livreur_stock (livreur_id, product_id, quantity)
    VALUES (v_livreur, r.product_id, r.quantity)
    ON CONFLICT (livreur_id, product_id) DO UPDATE
      SET quantity = livreur_stock.quantity + EXCLUDED.quantity, updated_at = now();
  END LOOP;
  UPDATE public.orders SET stock_reserved = false, updated_at = now() WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_pos_sale_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_stock INT;
BEGIN
  SELECT stock_global INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock global insuffisant (disponible: %, demandé: %)', current_stock, NEW.quantity;
  END IF;
  UPDATE public.products SET stock_global = stock_global - NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.apply_shipment_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_stock INT;
BEGIN
  SELECT stock_global INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock global insuffisant (disponible: %, demandé: %)', current_stock, NEW.quantity;
  END IF;
  UPDATE public.products SET stock_global = stock_global - NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

-- Skip stock decrement for deliveries created from orders (already reserved)
CREATE OR REPLACE FUNCTION public.apply_delivery_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_qty INT; v_livreur UUID; v_order_id UUID;
BEGIN
  SELECT livreur_id, order_id INTO v_livreur, v_order_id FROM public.deliveries WHERE id = NEW.delivery_id;
  IF v_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT quantity INTO current_qty FROM public.livreur_stock
    WHERE livreur_id = v_livreur AND product_id = NEW.product_id FOR UPDATE;
  IF current_qty IS NULL OR current_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Stock livreur insuffisant pour ce produit';
  END IF;
  UPDATE public.livreur_stock SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE livreur_id = v_livreur AND product_id = NEW.product_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shipments_updated BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_apply_pos_sale_item AFTER INSERT ON public.pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_pos_sale_item();
CREATE TRIGGER trg_apply_shipment_item AFTER INSERT ON public.shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_shipment_item();

REVOKE ALL ON FUNCTION public.reserve_order_stock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_order_stock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(UUID) TO service_role;

-- ========= RLS POLICIES =========

CREATE POLICY "Admins manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Livreurs view assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (livreur_id = auth.uid());

CREATE POLICY "Livreurs update assigned orders" ON public.orders FOR UPDATE TO authenticated
  USING (livreur_id = auth.uid())
  WITH CHECK (livreur_id = auth.uid());

CREATE POLICY "View order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Admins manage order items" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View order history" ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Insert order history" ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.livreur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Admins manage shipments" ON public.shipments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read shipments by tracking" ON public.shipments FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admins manage shipment items" ON public.shipment_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read shipment items" ON public.shipment_items FOR SELECT TO anon
  USING (true);

CREATE POLICY "View shipment history" ON public.shipment_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert shipment history" ON public.shipment_status_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage pos sales" ON public.pos_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage pos sale items" ON public.pos_sale_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Read expense categories" ON public.expense_categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
