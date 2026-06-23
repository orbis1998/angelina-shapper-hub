import { createFileRoute } from "@tanstack/react-router";
import { OrdersSection } from "@/components/admin/orders-section";

export const Route = createFileRoute("/_authenticated/admin/commandes")({ component: OrdersSection });
