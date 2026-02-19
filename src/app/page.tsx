"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import QuestionForm from "@/components/QuestionForm";
import DiffView from "@/components/DiffView";
import SegmentNav from "@/components/SegmentNav";
import BatchBar from "@/components/BatchBar";
import BatchSegmentNav, { type BatchSegmentState, isSegmentComplete } from "@/components/BatchSegmentNav";
import TranscriptReview from "@/components/TranscriptReview";
import GeminiSettingsPanel from "@/components/GeminiSettingsPanel";
import BatchHistory from "@/components/BatchHistory";
import { Segment } from "@/lib/types";
import { type GeminiConfig, buildDefaultConfig, parseSchemaFields } from "@/lib/gemini-defaults";

type AppPhase = "selecting" | "annotating" | "reviewing";

interface BatchRun {
  id: string;
  segment_count: number;
  segments: { video_id: string; segment_id: string }[];
  gemini_config: GeminiConfig | null;
  status: "in_progress" | "completed";
  created_at: string;
}

interface DBAnnotation {
  video_id: string;
  segment_id: string;
  user_answers: Record<string, unknown>;
  gemini_answers: Record<string, unknown> | null;
  gemini_status: "pending" | "processing" | "done" | "error";
  gemini_error: string | null;
  user_transcript_correct: boolean | null;
}

function segKey(s: { video_id: string; segment_id: string }) {
  return `${s.video_id}/${s.segment_id}`;
}

function annotationToState(ann: DBAnnotation): BatchSegmentState {
  return {
    userAnswers: ann.user_answers || {},
    geminiResult: ann.gemini_status === "done" ? ann.gemini_answers : null,
    geminiLoading: ann.gemini_status === "pending" || ann.gemini_status === "processing",
    geminiError: ann.gemini_status === "error" ? (ann.gemini_error || "Unknown error") : null,
    transcriptCorrect: ann.user_transcript_correct,
  };
}

export default function Home() {
  // All segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());

  // Batch annotation
  const [appPhase, setAppPhase] = useState<AppPhase>("selecting");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchSegments, setBatchSegments] = useState<Segment[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchState, setBatchState] = useState<Map<string, BatchSegmentState>>(new Map());
  const [batchCompleted, setBatchCompleted] = useState(false);

  // Batch history
  const [batchHistory, setBatchHistory] = useState<BatchRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Review mode config (from the batch that was saved)
  const [reviewConfig, setReviewConfig] = useState<GeminiConfig | null>(null);

  // Config
  const [geminiConfig, setGeminiConfig] = useState<GeminiConfig>(buildDefaultConfig);

  // Derive form fields from schema (use reviewConfig in review mode)
  const activeConfig = appPhase === "reviewing" && reviewConfig ? reviewConfig : geminiConfig;
  const fields = useMemo(
    () => parseSchemaFields(activeConfig.schemaJson),
    [activeConfig.schemaJson]
  );

  // Reset answers when schema fields change during annotation
  const prevFieldKeys = useRef<string>("");
  useEffect(() => {
    const keys = fields.map((f) => f.key).join(",");
    if (prevFieldKeys.current && prevFieldKeys.current !== keys && appPhase === "annotating") {
      setBatchState((prev) => {
        const next = new Map(prev);
        for (const [k, v] of next) {
          next.set(k, { ...v, userAnswers: {} });
        }
        return next;
      });
    }
    prevFieldKeys.current = keys;
  }, [fields, appPhase]);

  // Load segments
  useEffect(() => {
    fetch("/api/segments")
      .then((r) => r.json())
      .then((segs: Segment[]) => setSegments(segs));
  }, []);

  // Load batch history
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    fetch("/api/batch")
      .then((r) => r.json())
      .then((data: BatchRun[]) => {
        setBatchHistory(data);
        return data;
      })
      .then((data) => {
        // Auto-resume: check for in-progress batch
        if (appPhase === "selecting" && !batchId) {
          const inProgress = data.find((b) => b.status === "in_progress");
          if (inProgress) {
            resumeBatch(inProgress.id);
          }
        }
      })
      .catch(() => setBatchHistory([]))
      .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── POLLING: fetch batch state from DB every 2 seconds ──────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/batch/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const annotations: DBAnnotation[] = data.annotations;

        setBatchState((prev) => {
          const next = new Map(prev);
          for (const ann of annotations) {
            const key = segKey(ann);
            const existing = next.get(key);
            // Update Gemini-related fields from DB, preserve local user answers
            next.set(key, {
              userAnswers: existing?.userAnswers || ann.user_answers || {},
              geminiResult: ann.gemini_status === "done" ? ann.gemini_answers : (existing?.geminiResult || null),
              geminiLoading: ann.gemini_status === "pending" || ann.gemini_status === "processing",
              geminiError: ann.gemini_status === "error" ? (ann.gemini_error || "Unknown error") : null,
              transcriptCorrect: existing?.transcriptCorrect ?? ann.user_transcript_correct,
            });
          }
          return next;
        });

        // Stop polling when all Gemini processing is done
        const allDone = annotations.every(
          (a) => a.gemini_status === "done" || a.gemini_status === "error"
        );
        if (allDone && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // Ignore poll errors
      }
    };

    poll(); // Immediate first poll
    pollingRef.current = setInterval(poll, 2000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ─── RESUME BATCH ────────────────────────────────────────────
  const resumeBatch = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/batch/${id}`);
      if (!res.ok) return;
      const data = await res.json();

      const annotations: DBAnnotation[] = data.annotations;
      const config: GeminiConfig | null = data.gemini_config;
      const batchSegmentList: { video_id: string; segment_id: string }[] = data.segments;
      const status: string = data.status;

      // Build segment list with audio_url
      const segMap = new Map(segments.map((s) => [segKey(s), s]));
      const segs: Segment[] = batchSegmentList.map((bs) => {
        const key = segKey(bs);
        return segMap.get(key) || {
          video_id: bs.video_id,
          segment_id: bs.segment_id,
          audio_url: `/api/segments/${bs.video_id}/${bs.segment_id}`,
        };
      });

      // Build state from DB annotations
      const stateMap = new Map<string, BatchSegmentState>();
      for (const ann of annotations) {
        stateMap.set(segKey(ann), annotationToState(ann));
      }

      setBatchId(id);
      setBatchSegments(segs);
      setBatchIndex(0);
      setBatchState(stateMap);
      setBatchCompleted(status === "completed");

      if (status === "completed") {
        setReviewConfig(config);
        setAppPhase("reviewing");
      } else {
        if (config) setGeminiConfig(config);
        setAppPhase("annotating");

        // Check for stalled segments and resume
        const hasStalled = annotations.some(
          (a) => a.gemini_status === "pending" || a.gemini_status === "processing"
        );
        if (hasStalled) {
          fetch(`/api/batch/${id}/resume`, { method: "POST" }).catch(() => {});
        }

        // Start polling for Gemini updates
        startPolling(id);
      }
    } catch (err) {
      console.error("Failed to resume batch:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, startPolling]);

  // Current state helpers
  const currentBatchSeg = batchSegments[batchIndex];
  const currentBatchKey = currentBatchSeg ? segKey(currentBatchSeg) : "";
  const currentSegState = batchState.get(currentBatchKey);

  // Toggle selection
  const toggleSelect = useCallback((key: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Select all segments
  const selectAll = useCallback(() => {
    setSelectedSet(new Set(segments.map(segKey)));
  }, [segments]);

  // ─── SAVE ANSWER TO DB (incremental) ─────────────────────────
  const saveAnswerToDB = useCallback(async (
    videoId: string,
    segmentId: string,
    data: { user_answers?: Record<string, unknown>; user_transcript_correct?: boolean }
  ) => {
    if (!batchId) return;
    try {
      await fetch(`/api/batch/${batchId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          segment_id: segmentId,
          ...data,
        }),
      });
    } catch {
      // Silently fail — local state is still correct
    }
  }, [batchId]);

  // Retry a failed segment (server-side)
  const retryGemini = useCallback((segment: Segment) => {
    if (!batchId) return;

    // Optimistically set to loading
    const k = segKey(segment);
    setBatchState((prev) => {
      const next = new Map(prev);
      const existing = next.get(k);
      if (existing) next.set(k, { ...existing, geminiLoading: true, geminiError: null, geminiResult: null });
      return next;
    });

    fetch(`/api/batch/${batchId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: segment.video_id,
        segment_id: segment.segment_id,
      }),
    }).catch(() => {});

    // Restart polling
    startPolling(batchId);
  }, [batchId, startPolling]);

  // ─── START BATCH ─────────────────────────────────────────────
  const handleStartBatch = useCallback(async () => {
    const selected = segments.filter((s) => selectedSet.has(segKey(s)));
    if (selected.length === 0) return;

    const segmentRefs = selected.map((s) => ({
      video_id: s.video_id,
      segment_id: s.segment_id,
    }));

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_config: geminiConfig,
          segments: segmentRefs,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409 && err.existing_id) {
          // Another batch in progress — resume it
          resumeBatch(err.existing_id);
          return;
        }
        alert(err.error || "Failed to create batch");
        return;
      }

      const { id } = await res.json();

      // Initialize local state as all-pending
      const initState = new Map<string, BatchSegmentState>();
      for (const s of selected) {
        initState.set(segKey(s), {
          userAnswers: {},
          geminiResult: null,
          geminiLoading: true,
          geminiError: null,
          transcriptCorrect: null,
        });
      }

      setBatchId(id);
      setBatchSegments(selected);
      setBatchIndex(0);
      setBatchState(initState);
      setBatchCompleted(false);
      setAppPhase("annotating");

      // Start polling (Gemini already running server-side)
      startPolling(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create batch";
      alert(message);
    }
  }, [segments, selectedSet, geminiConfig, resumeBatch, startPolling]);

  // ─── BACK TO SELECTION ───────────────────────────────────────
  const handleBackToSelection = useCallback(() => {
    if (appPhase === "annotating" && !batchCompleted) {
      // Batch is in-progress — just go back, everything is persisted
      // No confirmation needed since state is saved to DB
    }
    stopPolling();
    setAppPhase("selecting");
    setBatchId(null);
    setBatchSegments([]);
    setBatchIndex(0);
    setBatchState(new Map());
    setBatchCompleted(false);
    setReviewConfig(null);
    loadHistory();
  }, [appPhase, batchCompleted, stopPolling, loadHistory]);

  // ─── UPDATE ANSWERS (optimistic local + save to DB) ──────────
  const updateCurrentAnswers = useCallback((answers: Record<string, unknown>) => {
    setBatchState((prev) => {
      const next = new Map(prev);
      const existing = next.get(currentBatchKey);
      if (existing) next.set(currentBatchKey, { ...existing, userAnswers: answers });
      return next;
    });

    if (currentBatchSeg) {
      saveAnswerToDB(currentBatchSeg.video_id, currentBatchSeg.segment_id, {
        user_answers: answers,
      });
    }
  }, [currentBatchKey, currentBatchSeg, saveAnswerToDB]);

  const updateTranscriptCorrect = useCallback((value: boolean) => {
    setBatchState((prev) => {
      const next = new Map(prev);
      const existing = next.get(currentBatchKey);
      if (existing) next.set(currentBatchKey, { ...existing, transcriptCorrect: value });
      return next;
    });

    if (currentBatchSeg) {
      saveAnswerToDB(currentBatchSeg.video_id, currentBatchSeg.segment_id, {
        user_transcript_correct: value,
      });
    }
  }, [currentBatchKey, currentBatchSeg, saveAnswerToDB]);

  // ─── SUBMIT (complete) BATCH ─────────────────────────────────
  const submitBatch = useCallback(async () => {
    if (!batchId) return;

    try {
      const res = await fetch(`/api/batch/${batchId}`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to complete batch");
        return;
      }

      setBatchCompleted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Complete failed";
      alert(message);
    }
  }, [batchId]);

  // ─── LOAD BATCH FOR REVIEW ──────────────────────────────────
  const loadBatchForReview = useCallback(async (id: string, status?: string) => {
    // If the batch is in-progress, resume it instead of reviewing
    if (status === "in_progress") {
      resumeBatch(id);
      return;
    }

    try {
      const res = await fetch(`/api/batch/${id}`);
      if (!res.ok) throw new Error("Failed to load batch");
      const data = await res.json();

      const annotations: DBAnnotation[] = data.annotations;
      const config: GeminiConfig | null = data.gemini_config;
      const batchSegmentList: { video_id: string; segment_id: string }[] = data.segments;

      const segMap = new Map(segments.map((s) => [segKey(s), s]));
      const reviewSegs: Segment[] = batchSegmentList.map((bs) => {
        const key = segKey(bs);
        return segMap.get(key) || {
          video_id: bs.video_id,
          segment_id: bs.segment_id,
          audio_url: `/api/segments/${bs.video_id}/${bs.segment_id}`,
        };
      });

      const reviewState = new Map<string, BatchSegmentState>();
      for (const ann of annotations) {
        reviewState.set(segKey(ann), annotationToState(ann));
      }

      setBatchId(id);
      setBatchSegments(reviewSegs);
      setBatchIndex(0);
      setBatchState(reviewState);
      setBatchCompleted(true);
      setReviewConfig(config);
      setAppPhase("reviewing");
    } catch (err) {
      console.error("Failed to load batch:", err);
    }
  }, [segments, resumeBatch]);

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
  useEffect(() => {
    if (appPhase === "selecting") return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "ArrowLeft" && !e.shiftKey) {
        e.preventDefault();
        setBatchIndex((i) => Math.max(0, i - 1));
      } else if (e.code === "ArrowRight" && !e.shiftKey) {
        e.preventDefault();
        setBatchIndex((i) => Math.min(batchSegments.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [appPhase, batchSegments.length]);

  // Per-segment completion
  const geminiDone = currentSegState?.geminiResult != null;
  const geminiFinished = geminiDone || currentSegState?.geminiError != null;
  const hasTranscript = typeof currentSegState?.geminiResult?.transcript === "string";
  const transcriptAnswered = currentSegState?.transcriptCorrect != null;
  const allFieldsAnswered = currentSegState && fields.length > 0 &&
    fields.every((f) => currentSegState.userAnswers[f.key] !== undefined);

  // Batch-level completion
  const allSegmentsComplete = batchSegments.length > 0 &&
    batchSegments.every((seg) => isSegmentComplete(batchState.get(segKey(seg)), fields));
  const canSubmitBatch = allSegmentsComplete && !batchCompleted;

  const isReadOnly = appPhase === "reviewing" || batchCompleted;

  // Loading state
  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">Loading segments...</p>
      </div>
    );
  }

  // ─── SELECTING PHASE ──────────────────────────────────────────
  if (appPhase === "selecting") {
    const browseSeg = segments[browseIndex];

    return (
      <main className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <h1 className="text-xl font-semibold text-zinc-100">Annotation Dashboard</h1>

        <BatchHistory
          batches={batchHistory}
          loading={historyLoading}
          onSelect={loadBatchForReview}
        />

        <GeminiSettingsPanel
          config={geminiConfig}
          onChange={setGeminiConfig}
        />

        {browseSeg && (
          <>
            <SegmentNav
              segments={segments}
              currentIndex={browseIndex}
              onSelect={setBrowseIndex}
              selectedSet={selectedSet}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
            />

            <AudioPlayer src={browseSeg.audio_url} />

            <BatchBar
              selectedCount={selectedSet.size}
              onStart={handleStartBatch}
              onClear={() => setSelectedSet(new Set())}
            />
          </>
        )}
      </main>
    );
  }

  // ─── ANNOTATING / REVIEWING PHASE ──────────────────────────────
  return (
    <main className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">
        {appPhase === "reviewing" ? "Batch Review" : "Annotation Dashboard"}
      </h1>

      {/* Settings — locked during annotation, shown read-only in review */}
      <GeminiSettingsPanel
        config={activeConfig}
        onChange={setGeminiConfig}
        disabled
      />

      {currentBatchSeg && currentSegState && (
        <>
          <BatchSegmentNav
            segments={batchSegments}
            currentIndex={batchIndex}
            onSelect={setBatchIndex}
            stateMap={batchState}
            onBack={handleBackToSelection}
            onRetry={retryGemini}
            fields={fields}
            readOnly={isReadOnly}
          />

          <AudioPlayer src={currentBatchSeg.audio_url} />

          {/* Assessment Card */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
              {isReadOnly ? "Assessment (Read Only)" : "Your Assessment"}
            </h2>

            <QuestionForm
              fields={fields}
              answers={currentSegState.userAnswers}
              onChange={updateCurrentAnswers}
              disabled={isReadOnly}
            />

            {/* Gemini Status */}
            {currentSegState.geminiLoading && (
              <div className="text-center py-3">
                <p className="text-zinc-500 text-sm animate-pulse">
                  Gemini is processing this segment...
                </p>
              </div>
            )}

            {currentSegState.geminiError != null && (
              <p className="text-sm text-red-400 bg-red-900/20 rounded-lg p-3 border border-red-800">
                Gemini error: {currentSegState.geminiError}
              </p>
            )}

            {/* Transcript Review */}
            {geminiDone && typeof currentSegState.geminiResult?.transcript === "string" && (
              <TranscriptReview
                transcript={currentSegState.geminiResult.transcript as string}
                value={currentSegState.transcriptCorrect}
                onChange={updateTranscriptCorrect}
                disabled={isReadOnly}
              />
            )}

            {/* Per-segment status hints (only during annotation) */}
            {!isReadOnly && (
              <div className="space-y-1">
                {!geminiFinished && (
                  <p className="text-xs text-zinc-500 text-center">Waiting for Gemini to finish...</p>
                )}
                {geminiFinished && !allFieldsAnswered && fields.length > 0 && (
                  <p className="text-xs text-zinc-500 text-center">Answer all assessment fields</p>
                )}
                {allFieldsAnswered && hasTranscript && !transcriptAnswered && (
                  <p className="text-xs text-zinc-500 text-center">Answer the transcript correctness question</p>
                )}
                {isSegmentComplete(currentSegState, fields) && (
                  <p className="text-xs text-green-500 text-center">Segment complete</p>
                )}
              </div>
            )}
          </div>

          {/* DiffView — shows when Gemini is done */}
          {geminiDone && (
            <DiffView
              fields={fields}
              userAnswers={currentSegState.userAnswers}
              geminiAnswers={currentSegState.geminiResult!}
            />
          )}

          {/* Batch Submit (only during annotation, not completed) */}
          {appPhase === "annotating" && !batchCompleted && (
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300 font-medium">
                    {Array.from(batchState.values()).filter((s) => isSegmentComplete(s, fields)).length} / {batchSegments.length} segments complete
                  </p>
                  {!allSegmentsComplete && (
                    <p className="text-xs text-zinc-500">Complete all segments to submit the batch</p>
                  )}
                </div>
                <button
                  onClick={submitBatch}
                  disabled={!canSubmitBatch}
                  className="px-6 py-3 rounded-lg font-medium text-sm transition bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Submit Batch
                </button>
              </div>
            </div>
          )}

          {batchCompleted && appPhase === "annotating" && (
            <div className="bg-green-900/20 rounded-xl p-4 border border-green-800 text-center">
              <p className="text-green-400 font-medium">Batch completed</p>
              <button
                onClick={handleBackToSelection}
                className="mt-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                Back to dashboard
              </button>
            </div>
          )}

          {/* Persistent state indicator */}
          {appPhase === "annotating" && !batchCompleted && (
            <p className="text-center text-[10px] text-zinc-600">
              All progress auto-saved. Safe to close tab or refresh.
            </p>
          )}

          {/* Keyboard hints */}
          <div className="text-center text-[10px] text-zinc-600 space-x-4">
            <span>Space: play/pause</span>
            <span>Left/Right: prev/next segment</span>
            <span>Shift+Left/Right: skip 5s</span>
          </div>
        </>
      )}
    </main>
  );
}
