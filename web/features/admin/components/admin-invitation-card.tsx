import { Button } from "@/components/ui/button";
import { type InvitationItem } from "@/features/admin/components/admin-shared";
import { formatDateTimeDisplay } from "@/lib/date";
import { formatRoleLabel } from "@/lib/users/role-label";

type AdminInvitationCardProps = {
  invitation: InvitationItem;
  resendDisabled: boolean;
  revokeDisabled: boolean;
  onResend: () => void;
  onRevoke: () => void;
};

export function AdminInvitationCard({
  invitation,
  resendDisabled,
  revokeDisabled,
  onResend,
  onRevoke
}: AdminInvitationCardProps) {
  const isLocked = Boolean(invitation.acceptedAt) || Boolean(invitation.revokedAt);

  return (
    <article className="data-card min-w-0 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full min-w-0 space-y-1 sm:flex-1">
          <p className="font-semibold">{invitation.name}</p>
          <p className="break-words text-sm text-[var(--color-muted-foreground)]">
            {invitation.email} | {formatRoleLabel({ role: invitation.role })}
          </p>
          {!isLocked ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Por seguranca, links pendentes aparecem apenas ao criar ou reenviar o convite.
            </p>
          ) : null}
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Expira em {formatDateTimeDisplay(invitation.expiresAt)}
            {invitation.acceptedAt ? ` | Aceito em ${formatDateTimeDisplay(invitation.acceptedAt)}` : ""}
            {invitation.revokedAt ? ` | Revogado em ${formatDateTimeDisplay(invitation.revokedAt)}` : ""}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button className="w-full sm:w-auto" disabled={resendDisabled || isLocked} onClick={onResend} type="button" variant="secondary">
            Reenviar e-mail
          </Button>
          <Button className="w-full sm:w-auto" disabled={revokeDisabled || isLocked} onClick={onRevoke} type="button" variant="ghost">
            Revogar
          </Button>
        </div>
      </div>
    </article>
  );
}
