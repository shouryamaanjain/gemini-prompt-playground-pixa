import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processGeminiBatch } from "@/lib/gemini-batch";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Create batch + start server-side Gemini processing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gemini_config, segments } = body;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "segments array required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check no other batch is in_progress
    const { data: existing } = await supabase
      .from("batch_runs")
      .select("id")
      .eq("status", "in_progress")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Another batch is already in progress", existing_id: existing[0].id },
        { status: 409 }
      );
    }

    // Create batch run
    const { data: batch, error: batchError } = await supabase
      .from("batch_runs")
      .insert({
        gemini_config: gemini_config ?? null,
        segments: segments,
        segment_count: segments.length,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      console.error("Batch create error:", batchError?.message);
      return NextResponse.json({ error: batchError?.message || "Failed to create batch" }, { status: 500 });
    }

    // Create annotation rows (all pending)
    const rows = segments.map((s: { video_id: string; segment_id: string }) => ({
      batch_id: batch.id,
      video_id: s.video_id,
      segment_id: s.segment_id,
      gemini_status: "pending",
    }));

    const { error: insertError } = await supabase
      .from("annotations")
      .insert(rows);

    if (insertError) {
      console.error("Annotations insert error:", insertError.message);
      await supabase.from("batch_runs").delete().eq("id", batch.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Fire-and-forget Gemini processing
    processGeminiBatch(batch.id, segments, gemini_config);

    return NextResponse.json({ id: batch.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// List all batch runs
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("batch_runs")
      .select("id, segment_count, segments, gemini_config, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
