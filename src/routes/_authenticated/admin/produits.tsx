import { createFileRoute } from "@tanstack/react-router";
import { ProductsSection } from "@/components/admin/products-section";

export const Route = createFileRoute("/_authenticated/admin/produits")({ component: ProductsSection });
