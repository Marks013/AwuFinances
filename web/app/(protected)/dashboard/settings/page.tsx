import { requireEndUserDashboardPageUser } from "@/lib/auth/session";
import { SettingsClient } from "@/features/settings/components/settings-client";

export default async function SettingsPage() {
  const user = await requireEndUserDashboardPageUser();

  return <SettingsClient initialEmail={user.email ?? ""} initialName={user.name ?? ""} />;
}
