import { type NextRequest, NextResponse } from "next/server";
import { addTrack } from "@/actions/addTrack";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, src, key } = body;
    const res = await addTrack({ name, src, key });

    if ("name" in res) {
      return NextResponse.json(
        { success: true, message: `added track: ${res.name}` },
        { status: 201 },
      );
    } else {
      return NextResponse.json({
        success: false,
        error: res.message,
        status: 400,
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
