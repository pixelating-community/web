import { addTopic } from "@/actions/addTopic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, key, token } = body;

    await addTopic({ name, key, token });

    return NextResponse.json({ success: true, message: "Data received" });
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
