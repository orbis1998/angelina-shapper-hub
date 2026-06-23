import { createFileRoute } from "@tanstack/react-router";
import { PosAdminSection } from "@/components/admin/pos-section";

export const Route = createFileRoute("/_authenticated/admin/pos")({ component: PosAdminSection });
