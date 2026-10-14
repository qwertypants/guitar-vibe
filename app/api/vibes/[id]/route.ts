import "server-only";
import { NextResponse } from "next/server";
import { deleteVibe } from "@/lib/server/vibes-store";

export const runtime = "nodejs";

export const DELETE = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return NextResponse.json({ error: "Choose a valid saved vibe." }, { status: 400 });
  }
  try {
    return deleteVibe(Number(id)) ? new Response(null, { status: 204 }) : NextResponse.json({ error: "Saved vibe not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "This vibe could not be deleted." }, { status: 500 }); }
}
