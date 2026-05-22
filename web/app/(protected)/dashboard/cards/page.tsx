import { redirect } from "next/navigation";

export default function CardsPage() {
  redirect("/dashboard/accounts?view=cards");
}
