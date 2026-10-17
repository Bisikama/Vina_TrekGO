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
    
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();
    const paymentMethod = body.paymentMethod;

    const response = await fetch(`${backendUrl}/api/v1/trails/${trailId}/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ paymentMethod })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { message: "Error" }, { status: response.status });
    }

    return NextResponse.json(data || {}, { status: 200 });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
