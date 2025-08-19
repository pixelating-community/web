import { type NextRequest, NextResponse } from "next/server";
import { addTopic } from "@/actions/addTopic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, key, token } = body;
    const res = await addTopic({ name, key, token });

    if ("name" in res) {
      return NextResponse.json(
        { success: true, message: `added topic: ${res.name}` },
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
