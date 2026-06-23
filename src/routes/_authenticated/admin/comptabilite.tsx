import { createFileRoute } from "@tanstack/react-router";
import { AccountingSection } from "@/components/admin/accounting-section";

export const Route = createFileRoute("/_authenticated/admin/comptabilite")({ component: AccountingSection });
