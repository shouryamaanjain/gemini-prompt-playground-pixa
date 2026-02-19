import { NextResponse } from "next/server";
import { downloadBuffer } from "@/lib/gcs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; file: string }> }
) {
  const { videoId, file } = await params;

  if (!videoId || !file) {
    return NextResponse.json({ error: "videoId and file required" }, { status: 400 });
  }

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
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
