import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trailId: string }> }
) {
  try {
    const { trailId } = await params;
    const body = await req.json();
    
    // Extract Authorization header to forward to backend
    const authHeader = req.headers.get("authorization");

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    
    const idempotencyKey = body.idempotencyKey || req.headers.get("idempotency-key") || crypto.randomUUID();
    const paymentMethod = body.paymentMethod || "REDIRECT";
    const gateway = body.gateway;

    const payload: Record<string, string> = { paymentMethod };
    if (gateway) {
      payload.gateway = gateway;
    }

    const forwardedFor = req.headers.get("x-forwarded-for");

    const response = await fetch(`${backendUrl}/api/v1/trails/${trailId}/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { message: "Error" }, { status: response.status });
    }

    return NextResponse.json(data || {}, { status: response.status });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
