import { type NextRequest, NextResponse } from "next/server";
import { addCollection } from "@/actions/addCollection";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, total } = body;
    const res = await addCollection({ id, name, description, total });

    if ("name" in res) {
      return NextResponse.json(
        { success: true, message: `added collection: ${res.name}` },
        { status: 201 },
      );
    } else {
      return NextResponse.json({
        success: false,
        error: res.id,
        status: 400,
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
