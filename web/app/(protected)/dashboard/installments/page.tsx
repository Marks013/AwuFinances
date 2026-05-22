import { redirect } from "next/navigation";

export default function InstallmentsPage() {
  redirect("/dashboard/subscriptions?view=installments");
}
