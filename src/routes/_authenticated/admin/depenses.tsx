import { createFileRoute } from "@tanstack/react-router";
import { ExpensesSection } from "@/components/admin/expenses-section";

export const Route = createFileRoute("/_authenticated/admin/depenses")({ component: ExpensesSection });
