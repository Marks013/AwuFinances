import { redirect } from "next/navigation";

export default function BenefitsPage() {
  redirect("/dashboard/accounts?view=benefits");
}
