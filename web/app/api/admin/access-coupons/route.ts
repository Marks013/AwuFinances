import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  accessCouponInputSchema,
  createAccessCouponForAdmin,
  listAccessCouponsForAdmin,
  toAccessCouponRouteStatus
} from "@/lib/billing/access-coupons";
import { captureRequestError } from "@/lib/observability/sentry";

export async function GET(request: Request) {
  try {
    const coupons = await listAccessCouponsForAdmin();
    return NextResponse.json({ coupons });
  } catch (error) {
    captureRequestError(error, { request, feature: "admin-access-coupons", surface: "admin" });
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load access coupons"
      },
      { status: toAccessCouponRouteStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const coupon = await createAccessCouponForAdmin(accessCouponInputSchema.parse(await request.json()));
    return NextResponse.json({ coupon, message: "Cupom de acesso criado" }, { status: 201 });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      captureRequestError(error, { request, feature: "admin-access-coupons", surface: "admin" });
    }

    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Dados invalidos"
        : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? "Ja existe um cupom com este codigo"
          : error instanceof Error
            ? error.message
            : "Failed to create access coupon";

    return NextResponse.json({ message }, { status: toAccessCouponRouteStatus(error) });
  }
}
