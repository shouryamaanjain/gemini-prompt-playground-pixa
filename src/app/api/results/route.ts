import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { video_id, segment_id, user_answers, gemini_answers, user_transcript_correct } = body;

    if (!video_id || !segment_id) {
      return NextResponse.json({ error: "video_id and segment_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from("annotations")
      .upsert({
        video_id,
        segment_id,
        user_answers: user_answers ?? null,
        gemini_answers: gemini_answers ?? null,
        user_transcript_correct: user_transcript_correct ?? null,
      }, { onConflict: "video_id,segment_id" });

    if (error) {
      console.error("Supabase upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = getSupabase();

  const videoId = searchParams.get("video_id");
  const segmentId = searchParams.get("segment_id");

  if (videoId && segmentId) {
    const { data, error } = await supabase
      .from("annotations")
      .select("*")
      .eq("video_id", videoId)
      .eq("segment_id", segmentId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || null);
  }

  const { data, error } = await supabase
    .from("annotations")
    .select("video_id, segment_id")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
