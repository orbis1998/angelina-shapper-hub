import { createFileRoute } from "@tanstack/react-router";
import { DashboardSection } from "@/components/admin/dashboard-section";

export const Route = createFileRoute("/_authenticated/admin/")({ component: DashboardSection });
