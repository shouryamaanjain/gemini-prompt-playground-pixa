import { NextResponse } from "next/server";
import { downloadBuffer } from "@/lib/gcs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("video_id");
  const file = searchParams.get("file");

  if (!videoId || !file) {
    return NextResponse.json({ error: "video_id and file required" }, { status: 400 });
  }

  // Basic path traversal protection
  if (videoId.includes("..") || file.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const buffer = await downloadBuffer(videoId, file);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
