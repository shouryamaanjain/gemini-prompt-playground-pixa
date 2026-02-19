import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Get batch with all annotations
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: batch, error: batchError } = await supabase
      .from("batch_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 404 });
    }

    const { data: annotations, error: annError } = await supabase
      .from("annotations")
      .select("*")
      .eq("batch_id", id)
      .order("created_at", { ascending: true });

    if (annError) {
      return NextResponse.json({ error: annError.message }, { status: 500 });
    }

    return NextResponse.json({
      ...batch,
      annotations: annotations || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Mark batch as completed
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Verify all Gemini processing is done (done or error)
    const { data: pending } = await supabase
      .from("annotations")
      .select("id")
      .eq("batch_id", id)
      .in("gemini_status", ["pending", "processing"])
      .limit(1);

    if (pending && pending.length > 0) {
      return NextResponse.json(
        { error: "Cannot complete batch: Gemini processing still in progress" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("batch_runs")
      .update({ status: "completed" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
