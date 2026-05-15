import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  accessCouponInputSchema,
  deleteAccessCouponForAdmin,
  toAccessCouponRouteStatus,
  updateAccessCouponForAdmin
} from "@/lib/billing/access-coupons";
import { captureRequestError } from "@/lib/observability/sentry";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const coupon = await updateAccessCouponForAdmin(id, accessCouponInputSchema.parse(await request.json()));
    return NextResponse.json({ coupon, message: "Cupom de acesso atualizado" });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      captureRequestError(error, { request, feature: "admin-access-coupons", surface: "admin" });
    }

    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Dados invalidos"
        : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? "Ja existe um cupom com este codigo"
          : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
            ? "Cupom nao encontrado"
            : error instanceof Error
              ? error.message
              : "Failed to update access coupon";

    return NextResponse.json({ message }, { status: toAccessCouponRouteStatus(error) });
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    await deleteAccessCouponForAdmin(id);
    return NextResponse.json({ message: "Cupom de acesso removido" });
  } catch (error) {
    captureRequestError(error, { request, feature: "admin-access-coupons", surface: "admin" });
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
        ? "Cupom nao encontrado"
        : error instanceof Error
          ? error.message
          : "Failed to delete access coupon";

    return NextResponse.json({ message }, { status: toAccessCouponRouteStatus(error) });
  }
}
