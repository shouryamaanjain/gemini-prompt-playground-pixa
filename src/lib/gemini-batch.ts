import { createClient } from "@supabase/supabase-js";
import { analyzeSegment } from "./gemini";
import { downloadBuffer } from "./gcs";
import { Semaphore } from "./semaphore";
import type { GeminiConfig } from "./gemini-defaults";

const CONCURRENCY = 5;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

interface SegmentRef {
  video_id: string;
  segment_id: string;
}

export function processGeminiBatch(
  batchId: string,
  segments: SegmentRef[],
  geminiConfig: GeminiConfig | null
) {
  const sem = new Semaphore(CONCURRENCY);
  const supabase = getSupabase();

  const tasks = segments.map((seg) =>
    sem.run(async () => {
      try {
        // Mark as processing
        await supabase
          .from("annotations")
          .update({ gemini_status: "processing" })
          .eq("batch_id", batchId)
          .eq("video_id", seg.video_id)
          .eq("segment_id", seg.segment_id);

        // Download audio from GCS
        const audioBuffer = await downloadBuffer(seg.video_id, `${seg.segment_id}.wav`);
        const audioBase64 = audioBuffer.toString("base64");

        // Call Gemini
        const result = await analyzeSegment(
          audioBase64,
          "audio/wav",
          geminiConfig ?? undefined
        );

        // Write result to DB
        await supabase
          .from("annotations")
          .update({
            gemini_answers: result,
            gemini_status: "done",
            gemini_error: null,
          })
          .eq("batch_id", batchId)
          .eq("video_id", seg.video_id)
          .eq("segment_id", seg.segment_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Gemini error for ${seg.video_id}/${seg.segment_id}:`, message);

        await supabase
          .from("annotations")
          .update({
            gemini_status: "error",
            gemini_error: message,
          })
          .eq("batch_id", batchId)
          .eq("video_id", seg.video_id)
          .eq("segment_id", seg.segment_id);
      }
    })
  );

  // Fire and forget — don't await at call site
  Promise.all(tasks).catch((err) => {
    console.error(`Batch ${batchId} processing failed:`, err);
  });
}
