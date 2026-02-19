import { NextResponse } from "next/server";
import { analyzeSegment } from "@/lib/gemini";
import { downloadBuffer } from "@/lib/gcs";
import type { GeminiConfig } from "@/lib/gemini-defaults";

function validateConfig(config: GeminiConfig): string | null {
  try {
    const parsed = JSON.parse(config.schemaJson);
    if (typeof parsed !== "object" || parsed === null) return "Schema must be a JSON object";
  } catch {
    return "Invalid JSON in schema";
  }

  const validThinking = ["minimal", "low", "medium", "high"];
  if (!validThinking.includes(config.params.thinkingLevel)) {
    return "Invalid thinking level";
  }

  const validResolutions = [
    null, "MEDIA_RESOLUTION_UNSPECIFIED", "MEDIA_RESOLUTION_LOW",
    "MEDIA_RESOLUTION_MEDIUM", "MEDIA_RESOLUTION_HIGH",
  ];
  if (!validResolutions.includes(config.params.mediaResolution)) {
    return "Invalid media resolution";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const { video_id, segment_id, geminiConfig } = await request.json();

    if (!video_id || !segment_id) {
      return NextResponse.json({ error: "video_id and segment_id required" }, { status: 400 });
    }

    if (geminiConfig) {
      const validationError = validateConfig(geminiConfig);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const audioBuffer = await downloadBuffer(video_id, `${segment_id}.wav`);
    const audioBase64 = audioBuffer.toString("base64");

    const result = await analyzeSegment(audioBase64, "audio/wav", geminiConfig);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
