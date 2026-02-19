import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

// Get batch with all annotations (+ server-side auto-complete)
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

    // Server-side auto-complete: if all conditions met, mark batch as completed
    if (batch.status === "in_progress" && annotations && annotations.length > 0) {
      const allGeminiDone = annotations.every(
        (a: { gemini_status: string }) =>
          a.gemini_status === "done" || a.gemini_status === "error"
      );

      const allUserAnswered = annotations.every(
        (a: {
          user_answers: Record<string, unknown> | null;
          gemini_answers: Record<string, unknown> | null;
          user_transcript_correct: boolean | null;
        }) => {
          const hasAnswers = a.user_answers && Object.keys(a.user_answers).length > 0;
          const hasTranscript =
            a.gemini_answers && typeof a.gemini_answers.transcript === "string";
          const transcriptOk = !hasTranscript || a.user_transcript_correct != null;
          return hasAnswers && transcriptOk;
        }
      );

      if (allGeminiDone && allUserAnswered) {
        await supabase
          .from("batch_runs")
          .update({ status: "completed" })
          .eq("id", id);
        batch.status = "completed";
      }
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

// Mark batch as completed (manual override)
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

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
