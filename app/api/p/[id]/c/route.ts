import { type NextRequest, NextResponse } from "next/server";
import { addReflection } from "@/actions/addReflection";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";

type TParams = {
  params: Promise<{
    id: string;
  }>;
};

export const POST = async (req: NextRequest, { params }: TParams) => {
  try {
    const { id } = await params;
    const ip = getClientIp(req.headers);
    const elKey = req.headers.get("x-el-key") ?? undefined;

    const limitKey = elKey ? `c:key:${ip}` : `c:${ip}:${id}`;
    const limit = elKey ? 10 : 30;
    const rate = rateLimit(limitKey, limit, 60 * 1000);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }

    const body = await req.json();
    const { reflectionId, text } = body;

    const newReflection = await addReflection({
      perspectiveId: id,
      reflectionId,
      text,
      elKey,
    });

    if (newReflection) {
      return NextResponse.json(newReflection, { status: 201 });
    }
    return NextResponse.json(
      { error: "Failed to add reflection" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to add reflection" },
      { status: 400 },
    );
  }
};
