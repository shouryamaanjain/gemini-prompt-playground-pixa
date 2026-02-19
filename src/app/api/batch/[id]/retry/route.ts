import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processGeminiBatch } from "@/lib/gemini-batch";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Retry failed Gemini for a single segment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { video_id, segment_id } = body;

    if (!video_id || !segment_id) {
      return NextResponse.json({ error: "video_id and segment_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get batch config
    const { data: batch } = await supabase
      .from("batch_runs")
      .select("gemini_config")
      .eq("id", id)
      .single();

    // Reset annotation to pending
    const { error } = await supabase
      .from("annotations")
      .update({ gemini_status: "pending", gemini_error: null, gemini_answers: null })
      .eq("batch_id", id)
      .eq("video_id", video_id)
      .eq("segment_id", segment_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget Gemini for just this segment
    processGeminiBatch(id, [{ video_id, segment_id }], batch?.gemini_config ?? null);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
