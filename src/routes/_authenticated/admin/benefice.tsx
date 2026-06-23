import { createFileRoute } from "@tanstack/react-router";
import { BenefitSection } from "@/components/admin/benefit-section";

export const Route = createFileRoute("/_authenticated/admin/benefice")({ component: BenefitSection });
