import { createFileRoute } from "@tanstack/react-router";
import { LivreursSection } from "@/components/admin/livreurs-section";

export const Route = createFileRoute("/_authenticated/admin/livreurs")({ component: LivreursSection });
