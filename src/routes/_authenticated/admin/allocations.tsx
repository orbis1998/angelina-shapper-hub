import { createFileRoute } from "@tanstack/react-router";
import { AllocationsSection } from "@/components/admin/allocations-section";

export const Route = createFileRoute("/_authenticated/admin/allocations")({ component: AllocationsSection });
