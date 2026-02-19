import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Incremental save of user answer for one segment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { video_id, segment_id, user_answers, user_transcript_correct } = body;

    if (!video_id || !segment_id) {
      return NextResponse.json({ error: "video_id and segment_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    const update: Record<string, unknown> = {};
    if (user_answers !== undefined) update.user_answers = user_answers;
    if (user_transcript_correct !== undefined) update.user_transcript_correct = user_transcript_correct;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("annotations")
      .update(update)
      .eq("batch_id", id)
      .eq("video_id", video_id)
      .eq("segment_id", segment_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
