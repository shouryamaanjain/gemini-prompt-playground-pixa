import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SEGMENTS_FILE = path.join(process.cwd(), "segments.txt");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const lines = fs.readFileSync(SEGMENTS_FILE, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.endsWith(".wav"));

  const allSegments = lines.map((line) => {
    // line format: video_id/segment.wav
    const parts = line.split("/");
    const videoId = parts[0];
    const segmentFile = parts[1];
    const segmentId = segmentFile.replace(".wav", "");

    return {
      video_id: videoId,
      segment_id: segmentId,
      audio_url: `/api/audio/${videoId}/${segmentFile}`,
    };
  });

  return NextResponse.json(shuffle(allSegments));
}
