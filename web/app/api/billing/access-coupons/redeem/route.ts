import { NextResponse } from "next/server";
import { z } from "zod";

import {
  redeemAccessCouponForSession,
  redeemAccessCouponSchema,
  toAccessCouponRouteStatus
} from "@/lib/billing/access-coupons";
import { captureRequestError } from "@/lib/observability/sentry";
import { getClientIpAddress, takeThrottleHit } from "@/lib/security/request-throttle";

const redeemIpThrottleWindowMs = 15 * 60 * 1000;

function buildThrottleResponse(retryAfterMs: number) {
  return NextResponse.json(
    { message: "Muitas tentativas de cupom. Aguarde alguns minutos e tente novamente." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
      }
    }
  );
}

async function enforceRedeemIpThrottle(request: Request) {
  const clientIp = getClientIpAddress(request);

  if (!clientIp) {
    return null;
  }

  const result = await takeThrottleHit({
    namespace: "access-coupon-redeem-ip",
    key: `ip:${clientIp}`,
    limit: 20,
    windowMs: redeemIpThrottleWindowMs
  });

  return result.allowed ? null : buildThrottleResponse(result.retryAfterMs);
}

export async function POST(request: Request) {
  try {
    const throttled = await enforceRedeemIpThrottle(request);

    if (throttled) {
      return throttled;
    }

    const result = await redeemAccessCouponForSession(redeemAccessCouponSchema.parse(await request.json()));
    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      captureRequestError(error, { request, feature: "billing-access-coupon-redeem" });
    }

    return NextResponse.json(
      {
        message:
          error instanceof z.ZodError
            ? error.issues[0]?.message ?? "Dados invalidos"
            : error instanceof Error
              ? error.message
              : "Failed to redeem access coupon"
      },
      { status: toAccessCouponRouteStatus(error) }
    );
  }
}
