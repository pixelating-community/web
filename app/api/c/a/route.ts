import { type NextRequest, NextResponse } from "next/server";
import { addCollection } from "@/actions/addCollection";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
