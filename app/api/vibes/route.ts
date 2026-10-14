import "server-only";
import { NextResponse } from "next/server";
import { listVibes, saveVibe } from "@/lib/server/vibes-store";

export const runtime = "nodejs";

export const GET = () => {
  try { return NextResponse.json({ vibes: listVibes() }); }
  catch { return NextResponse.json({ error: "Saved vibes could not be loaded." }, { status: 500 }); }
}

export const POST = async (request: Request) => {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Choose saved vibe settings and chords." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("vibeIds" in body) || !("chords" in body)) {
    return NextResponse.json({ error: "Choose saved vibe settings and chords." }, { status: 400 });
  }
  try {
    const saved = saveVibe(body);
    return saved ? NextResponse.json({ vibe: saved }, { status: 201 }) : NextResponse.json({ error: "The vibe settings or chords are invalid." }, { status: 400 });
  } catch { return NextResponse.json({ error: "This vibe could not be saved." }, { status: 500 }); }
}
