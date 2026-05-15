import { Prisma, type AccessCouponTarget } from "@prisma/client";
import { z } from "zod";

import { logAdminAudit } from "@/lib/admin/audit";
import { getBillingSessionAccess } from "@/lib/billing/access";
import { PermissionError } from "@/lib/observability/errors";
import { prisma } from "@/lib/prisma/client";
import { takeThrottleHit } from "@/lib/security/request-throttle";

const dayMs = 24 * 60 * 60 * 1000;
const redeemThrottleWindowMs = 15 * 60 * 1000;

export const accessCouponInputSchema = z.object({
  code: z.string().trim().min(3).max(40),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).nullable().optional(),
  target: z.enum(["trial", "subscription"]),
  days: z.number().int().min(1).max(730),
  enabled: z.boolean(),
  startsAt: z.string().trim().min(1).nullable().optional(),
  endsAt: z.string().trim().min(1).nullable().optional(),
  maxRedemptions: z.number().int().min(1).max(100000).nullable().optional(),
  maxRedemptionsPerTenant: z.number().int().min(1).max(100).optional(),
  maxRedemptionsPerUser: z.number().int().min(1).max(100).optional()
}).strict();

export const redeemAccessCouponSchema = z.object({
  code: z.string().trim().min(3).max(40)
}).strict();

type AccessCouponInput = z.infer<typeof accessCouponInputSchema>;
type CouponDbClient = typeof prisma | Prisma.TransactionClient;

export class AccessCouponError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AccessCouponError";
    this.statusCode = statusCode;
  }
}

function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AccessCouponError(`${field} invalida`, 400);
  }

  return date;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

function maxDate(left: Date | null | undefined, right: Date) {
  return left && left > right ? left : right;
}

function summarizeCouponTarget(target: AccessCouponTarget) {
  return target === "trial" ? "avaliacao" : "assinatura";
}

function isSerializableConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function resolveTrialPlan(db: CouponDbClient) {
  const plan = await db.plan.findFirst({
    where: {
      isActive: true,
      tier: "pro",
      trialDays: {
        gt: 0
      }
    },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }]
  });

  if (!plan) {
    throw new AccessCouponError("Nenhum plano de avaliacao premium ativo foi encontrado", 409);
  }

  return plan;
}

async function resolveSubscriptionPlan(db: CouponDbClient) {
  const plan = await db.plan.findFirst({
    where: {
      isActive: true,
      tier: "pro",
      trialDays: 0
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  if (!plan) {
    throw new AccessCouponError("Nenhum plano premium ativo foi encontrado", 409);
  }

  return plan;
}

function mapCouponInput(input: AccessCouponInput, createdByUserId?: string) {
  const startsAt = parseOptionalDate(input.startsAt, "Inicio do cupom");
  const endsAt = parseOptionalDate(input.endsAt, "Fim do cupom");

  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new AccessCouponError("A data final precisa ser maior que a data inicial", 400);
  }

  return {
    code: normalizeCouponCode(input.code),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    target: input.target,
    days: input.days,
    enabled: input.enabled,
    startsAt,
    endsAt,
    maxRedemptions: input.maxRedemptions ?? null,
    maxRedemptionsPerTenant: input.maxRedemptionsPerTenant ?? 1,
    maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? 1,
    ...(createdByUserId ? { createdByUserId } : {})
  };
}

export async function listAccessCouponsForAdmin() {
  const admin = await getBillingSessionAccess();

  if (!admin.isPlatformAdmin) {
    throw new PermissionError("Forbidden");
  }

  return prisma.accessCoupon.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: {
        select: {
          redemptions: true
        }
      }
    }
  });
}

export async function createAccessCouponForAdmin(input: AccessCouponInput) {
  const admin = await getBillingSessionAccess();

  if (!admin.isPlatformAdmin) {
    throw new PermissionError("Forbidden");
  }

  const coupon = await prisma.accessCoupon.create({
    data: mapCouponInput(input, admin.id)
  });

  await logAdminAudit({
    actorUserId: admin.id,
    actorTenantId: admin.tenantId,
    action: "access_coupon.created",
    entityType: "access_coupon",
    entityId: coupon.id,
    summary: `Cupom de ${summarizeCouponTarget(coupon.target)} criado: ${coupon.code}`,
    metadata: {
      code: coupon.code,
      target: coupon.target,
      days: coupon.days,
      enabled: coupon.enabled,
      maxRedemptionsPerTenant: coupon.maxRedemptionsPerTenant,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
      maxRedemptions: coupon.maxRedemptions
    }
  });

  return coupon;
}

export async function updateAccessCouponForAdmin(couponId: string, input: AccessCouponInput) {
  const admin = await getBillingSessionAccess();

  if (!admin.isPlatformAdmin) {
    throw new PermissionError("Forbidden");
  }

  const coupon = await prisma.accessCoupon.update({
    where: {
      id: couponId
    },
    data: mapCouponInput(input)
  });

  await logAdminAudit({
    actorUserId: admin.id,
    actorTenantId: admin.tenantId,
    action: "access_coupon.updated",
    entityType: "access_coupon",
    entityId: coupon.id,
    summary: `Cupom de ${summarizeCouponTarget(coupon.target)} atualizado: ${coupon.code}`,
    metadata: {
      code: coupon.code,
      target: coupon.target,
      days: coupon.days,
      enabled: coupon.enabled,
      maxRedemptionsPerTenant: coupon.maxRedemptionsPerTenant,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
      maxRedemptions: coupon.maxRedemptions
    }
  });

  return coupon;
}

export async function deleteAccessCouponForAdmin(couponId: string) {
  const admin = await getBillingSessionAccess();

  if (!admin.isPlatformAdmin) {
    throw new PermissionError("Forbidden");
  }

  const coupon = await prisma.accessCoupon.delete({
    where: {
      id: couponId
    }
  });

  await logAdminAudit({
    actorUserId: admin.id,
    actorTenantId: admin.tenantId,
    action: "access_coupon.deleted",
    entityType: "access_coupon",
    entityId: coupon.id,
    summary: `Cupom de ${summarizeCouponTarget(coupon.target)} removido: ${coupon.code}`,
    metadata: {
      code: coupon.code,
      target: coupon.target,
      days: coupon.days
    }
  });

  return coupon;
}

export async function redeemAccessCouponForSession(input: z.infer<typeof redeemAccessCouponSchema>) {
  const access = await getBillingSessionAccess({
    requireManager: true
  });

  if (access.isPlatformAdmin) {
    throw new AccessCouponError("O superadmin nao resgata cupons pela conta da plataforma", 403);
  }

  const throttle = await takeThrottleHit({
    namespace: "access-coupon-redeem-user",
    key: `user:${access.id}`,
    limit: 10,
    windowMs: redeemThrottleWindowMs
  });

  if (!throttle.allowed) {
    throw new AccessCouponError("Muitas tentativas de cupom. Aguarde alguns minutos e tente novamente.", 429);
  }

  const code = normalizeCouponCode(input.code);
  const now = new Date();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
      const coupon = await tx.accessCoupon.findUnique({
        where: {
          code
        }
      });

      if (!coupon || !coupon.enabled) {
        throw new AccessCouponError("Cupom invalido ou indisponivel", 404);
      }

      if (coupon.startsAt && coupon.startsAt > now) {
        throw new AccessCouponError("Este cupom ainda nao esta disponivel", 409);
      }

      if (coupon.endsAt && coupon.endsAt < now) {
        throw new AccessCouponError("Este cupom ja expirou", 409);
      }

      const [totalRedemptions, tenantRedemptions, userRedemptions, tenant] = await Promise.all([
        tx.accessCouponRedemption.count({
          where: {
            couponId: coupon.id
          }
        }),
        tx.accessCouponRedemption.count({
          where: {
            couponId: coupon.id,
            tenantId: access.tenantId
          }
        }),
        tx.accessCouponRedemption.count({
          where: {
            couponId: coupon.id,
            userId: access.id
          }
        }),
        tx.tenant.findUnique({
          where: {
            id: access.tenantId
          },
          select: {
            id: true,
            planId: true,
            trialStart: true,
            trialDays: true,
            trialExpiresAt: true,
            expiresAt: true,
            isActive: true,
            planConfig: {
              select: {
                tier: true,
                trialDays: true
              }
            }
          }
        })
      ]);

      if (!tenant) {
        throw new AccessCouponError("Conta nao encontrada", 404);
      }

      if (coupon.maxRedemptions !== null && totalRedemptions >= coupon.maxRedemptions) {
        throw new AccessCouponError("Este cupom atingiu o limite global de uso", 409);
      }

      if (tenantRedemptions >= coupon.maxRedemptionsPerTenant) {
        throw new AccessCouponError("Este cupom ja foi usado nesta conta", 409);
      }

      if (userRedemptions >= coupon.maxRedemptionsPerUser) {
        throw new AccessCouponError("Este cupom ja foi usado por este usuario", 409);
      }

      const previousTrialExpiresAt = tenant.trialExpiresAt;
      const previousExpiresAt = tenant.expiresAt;
      let newTrialExpiresAt: Date | null = tenant.trialExpiresAt;
      let newExpiresAt: Date | null = tenant.expiresAt;

      if (coupon.target === "trial") {
        if (tenant.expiresAt && tenant.expiresAt > now) {
          throw new AccessCouponError("A conta ja possui assinatura ativa; use um cupom de assinatura", 409);
        }

        const trialPlan = await resolveTrialPlan(tx);
        newTrialExpiresAt = addDays(maxDate(tenant.trialExpiresAt, now), coupon.days);
        const trialStart = tenant.trialStart ?? now;
        const trialDays = Math.max(1, Math.ceil((newTrialExpiresAt.getTime() - trialStart.getTime()) / dayMs));

        await tx.tenant.update({
          where: {
            id: tenant.id
          },
          data: {
            planId: trialPlan.id,
            trialStart,
            trialDays,
            trialExpiresAt: newTrialExpiresAt,
            expiresAt: null,
            isActive: true
          }
        });
        newExpiresAt = null;
      } else {
        const subscriptionPlan = await resolveSubscriptionPlan(tx);
        newExpiresAt = addDays(maxDate(tenant.expiresAt, now), coupon.days);

        await tx.tenant.update({
          where: {
            id: tenant.id
          },
          data: {
            planId: subscriptionPlan.id,
            trialStart: null,
            trialDays: 0,
            trialExpiresAt: null,
            expiresAt: newExpiresAt,
            isActive: true
          }
        });
        newTrialExpiresAt = null;
      }

      const redemption = await tx.accessCouponRedemption.create({
        data: {
          couponId: coupon.id,
          tenantId: tenant.id,
          userId: access.id,
          daysApplied: coupon.days,
          previousTrialExpiresAt,
          newTrialExpiresAt,
          previousExpiresAt,
          newExpiresAt
        }
      });

      await tx.adminAuditLog.create({
        data: {
          actorUserId: access.id,
          actorTenantId: access.tenantId,
          targetTenantId: access.tenantId,
          action: "access_coupon.redeemed",
          entityType: "access_coupon",
          entityId: coupon.id,
          summary: `Cupom ${coupon.code} resgatado pela conta ${access.tenant.name}`,
          metadata: {
            code: coupon.code,
            target: coupon.target,
            days: coupon.days,
            redemptionId: redemption.id,
            previousTrialExpiresAt: previousTrialExpiresAt?.toISOString() ?? null,
            newTrialExpiresAt: newTrialExpiresAt?.toISOString() ?? null,
            previousExpiresAt: previousExpiresAt?.toISOString() ?? null,
            newExpiresAt: newExpiresAt?.toISOString() ?? null
          }
        }
      });

          return {
            message:
              coupon.target === "trial"
                ? `Cupom aplicado. Avaliacao prorrogada por ${coupon.days} dia(s).`
                : `Cupom aplicado. Assinatura prorrogada por ${coupon.days} dia(s).`,
            coupon: {
              code: coupon.code,
              title: coupon.title,
              target: coupon.target,
              days: coupon.days
            },
            license: {
              trialExpiresAt: newTrialExpiresAt?.toISOString() ?? null,
              expiresAt: newExpiresAt?.toISOString() ?? null
            }
          };
        },
        {
          isolationLevel: "Serializable"
        }
      );
    } catch (error) {
      if (attempt < 2 && isSerializableConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new AccessCouponError("Nao foi possivel aplicar o cupom com seguranca", 409);
}

export function toAccessCouponRouteStatus(error: unknown) {
  if (error instanceof AccessCouponError) {
    return error.statusCode;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return 404;
    }

    if (error.code === "P2002") {
      return 409;
    }
  }

  if (error instanceof PermissionError) {
    return 403;
  }

  if (error instanceof z.ZodError) {
    return 400;
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return 401;
  }

  if (error instanceof Error && error.message === "Forbidden") {
    return 403;
  }

  return 500;
}
