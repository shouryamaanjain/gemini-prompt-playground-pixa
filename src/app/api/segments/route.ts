import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SEGMENTS_DIR = path.join(process.cwd(), "segments");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const videos = fs.readdirSync(SEGMENTS_DIR).filter((d) => {
    return fs.statSync(path.join(SEGMENTS_DIR, d)).isDirectory();
  });

  const allSegments = [];
  for (const videoId of videos) {
    const videoDir = path.join(SEGMENTS_DIR, videoId);
    const wavFiles = fs.readdirSync(videoDir).filter((f) => f.endsWith(".wav")).sort();
    for (const f of wavFiles) {
      allSegments.push({
        video_id: videoId,
        segment_id: f.replace(".wav", ""),
        audio_url: `/segments/${videoId}/${f}`,
      });
    }
  }

  return NextResponse.json(shuffle(allSegments));
}
