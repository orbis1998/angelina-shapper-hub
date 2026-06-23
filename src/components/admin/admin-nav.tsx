import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Package,
  Users,
  ArrowRightLeft,
  Receipt,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { NavItem } from "@/components/app-shell";

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Tableau de bord", icon: <LayoutDashboard className="size-4" /> },
  { to: "/admin/commandes", label: "Commandes", icon: <ClipboardList className="size-4" /> },
  { to: "/admin/pos", label: "POS Magasin", icon: <Store className="size-4" /> },
  { to: "/admin/produits", label: "Produits", icon: <Package className="size-4" /> },
  { to: "/admin/livreurs", label: "Livreurs", icon: <Users className="size-4" /> },
  { to: "/admin/allocations", label: "Allocations", icon: <ArrowRightLeft className="size-4" /> },
  { to: "/admin/depenses", label: "Dépenses", icon: <Receipt className="size-4" /> },
  { to: "/admin/benefice", label: "Bénéfice général", icon: <TrendingUp className="size-4" /> },
  { to: "/admin/comptabilite", label: "Comptabilité", icon: <BarChart3 className="size-4" /> },
];
