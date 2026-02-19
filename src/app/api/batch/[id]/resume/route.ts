import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processGeminiBatch } from "@/lib/gemini-batch";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Resume stalled Gemini processing after server restart
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Get batch config
    const { data: batch } = await supabase
      .from("batch_runs")
      .select("gemini_config")
      .eq("id", id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Reset 'processing' annotations back to 'pending' (they were in-flight when server died)
    await supabase
      .from("annotations")
      .update({ gemini_status: "pending" })
      .eq("batch_id", id)
      .eq("gemini_status", "processing");

    // Find all pending annotations
    const { data: pending, error } = await supabase
      .from("annotations")
      .select("video_id, segment_id")
      .eq("batch_id", id)
      .eq("gemini_status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ resumed: 0 });
    }

    // Fire-and-forget Gemini for all pending segments
    processGeminiBatch(id, pending, batch.gemini_config);

    return NextResponse.json({ resumed: pending.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
