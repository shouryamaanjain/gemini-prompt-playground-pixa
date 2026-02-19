"use client";

interface TranscriptReviewProps {
  transcript: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function TranscriptReview({ transcript, value, onChange, disabled }: TranscriptReviewProps) {
  return (
    <div className="space-y-3">
      <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
        <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Gemini Transcript</p>
        <p className="text-lg text-zinc-100 leading-relaxed">{transcript}</p>
      </div>

      <div className="flex items-center justify-between gap-4 py-2">
        <label className="text-sm text-zinc-300 font-medium">Is transcript correct?</label>
        <div className="flex gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              onClick={() => onChange(val)}
              disabled={disabled}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                value === val
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {val ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
