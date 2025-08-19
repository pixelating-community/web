import type { UUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { addPerspectiveCollection } from "@/actions/addPerspectiveCollection";

export const runtime = "nodejs";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: UUID }> },
) => {
  try {
    const body = await req.json();
    const { id: perspectiveId } = body;
    const { id } = await params;
    const res = await addPerspectiveCollection({ id, perspectiveId });

    if (res?.id) {
      return NextResponse.json(
        {
          success: true,
          message: `added collection:${res.collection.id} to perspective:${res?.id}`,
        },
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
};
