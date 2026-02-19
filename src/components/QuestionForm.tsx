"use client";

import type { SchemaField } from "@/lib/gemini-defaults";

interface QuestionFormProps {
  fields: SchemaField[];
  answers: Record<string, unknown>;
  onChange: (answers: Record<string, unknown>) => void;
  disabled?: boolean;
}

export default function QuestionForm({ fields, answers, onChange, disabled }: QuestionFormProps) {
  const set = (key: string, value: unknown) => {
    onChange({ ...answers, [key]: value });
  };

  if (fields.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No assessable fields in schema (add boolean or string enum properties)
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="flex items-center justify-between gap-4 py-2">
          <label className="text-sm text-zinc-300 font-medium min-w-[160px]">
            {field.label}{field.type === "boolean" ? "?" : ""}
          </label>

          {field.type === "boolean" ? (
            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  disabled={disabled}
                  onClick={() => set(field.key, val)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    answers[field.key] === val
                      ? "bg-white text-black"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {field.options!.map((opt) => (
                <button
                  key={opt}
                  disabled={disabled}
                  onClick={() => set(field.key, opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    answers[field.key] === opt
                      ? "bg-white text-black"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {opt.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
