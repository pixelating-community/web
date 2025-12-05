import { type NextRequest, NextResponse } from "next/server";
import { addCollection } from "@/actions/addCollection";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-api-key") ?? "";
  if (!process.env.EL_KEY || token !== process.env.EL_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const rate = rateLimit(`admin:${ip}`, 10, 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }

  try {
    const body = await req.json();
    const { name, description, total } = body;
    const res = await addCollection({ name, description, total });

    if (res?.id) {
      return NextResponse.json(
        { success: true, message: `added collection: ${res?.id}` },
        { status: 201 },
      );
    } else {
      return NextResponse.json({
        success: false,
        error: res,
        status: 400,
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
