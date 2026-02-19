"use client";

import { useState } from "react";
import {
  type GeminiConfig,
  type GeminiApiParams,
  type SafetySetting,
  DEFAULT_PROMPT,
  DEFAULT_SCHEMA_JSON,
  DEFAULT_API_PARAMS,
  HARM_CATEGORIES,
  HARM_THRESHOLDS,
  buildDefaultConfig,
} from "@/lib/gemini-defaults";

interface GeminiSettingsPanelProps {
  config: GeminiConfig;
  onChange: (config: GeminiConfig) => void;
  disabled?: boolean;
}

const THINKING_LEVELS = ["low", "high"] as const;

const MEDIA_RESOLUTIONS = [
  { value: "", label: "Default" },
  { value: "MEDIA_RESOLUTION_LOW", label: "Low" },
  { value: "MEDIA_RESOLUTION_MEDIUM", label: "Medium" },
  { value: "MEDIA_RESOLUTION_HIGH", label: "High" },
] as const;

export default function GeminiSettingsPanel({ config, onChange, disabled }: GeminiSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const setPrompt = (prompt: string) => onChange({ ...config, prompt });
  const setSchemaJson = (schemaJson: string) => onChange({ ...config, schemaJson });
  const setParam = <K extends keyof GeminiApiParams>(key: K, value: GeminiApiParams[K]) =>
    onChange({ ...config, params: { ...config.params, [key]: value } });

  const handleSchemaBlur = () => {
    try {
      const parsed = JSON.parse(config.schemaJson);
      setSchemaJson(JSON.stringify(parsed, null, 2));
      setSchemaError(null);
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const handleReset = () => {
    onChange(buildDefaultConfig());
    setSchemaError(null);
  };

  const getSafetyThreshold = (category: string): string => {
    const setting = config.params.safetySettings.find((s) => s.category === category);
    return setting?.threshold ?? "OFF";
  };

  const setSafetyThreshold = (category: string, threshold: string) => {
    const filtered = config.params.safetySettings.filter((s) => s.category !== category);
    const next: SafetySetting[] = threshold === "OFF"
      ? filtered
      : [...filtered, { category, threshold }];
    setParam("safetySettings", next);
  };

  const isDefault = (key: keyof GeminiApiParams) =>
    JSON.stringify(config.params[key]) === JSON.stringify(DEFAULT_API_PARAMS[key]);

  const isPromptDefault = config.prompt === DEFAULT_PROMPT;
  const isSchemaDefault = (() => {
    try {
      return JSON.stringify(JSON.parse(config.schemaJson)) === JSON.stringify(JSON.parse(DEFAULT_SCHEMA_JSON));
    } catch {
      return false;
    }
  })();
  const isAllDefault = isPromptDefault && isSchemaDefault &&
    (Object.keys(DEFAULT_API_PARAMS) as (keyof GeminiApiParams)[]).every(isDefault);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Gemini Settings</span>
          {!isAllDefault && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 border border-amber-800">
              Modified
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`border-t border-zinc-800 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          {/* System Prompt */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">System Prompt</label>
              {!isPromptDefault && (
                <button
                  onClick={() => setPrompt(DEFAULT_PROMPT)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  Reset
                </button>
              )}
            </div>
            <textarea
              value={config.prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-mono rounded-lg p-3 resize-y focus:outline-none focus:border-zinc-500 transition"
              style={{ minHeight: "200px" }}
            />
          </div>

          {/* Response Schema */}
          <div className="p-4 space-y-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Response Schema (JSON)</label>
              {!isSchemaDefault && (
                <button
                  onClick={() => { setSchemaJson(DEFAULT_SCHEMA_JSON); setSchemaError(null); }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  Reset
                </button>
              )}
            </div>
            <textarea
              value={config.schemaJson}
              onChange={(e) => { setSchemaJson(e.target.value); setSchemaError(null); }}
              onBlur={handleSchemaBlur}
              className={`w-full bg-zinc-800 border text-zinc-100 text-sm font-mono rounded-lg p-3 resize-y focus:outline-none transition ${
                schemaError ? "border-red-700 focus:border-red-600" : "border-zinc-700 focus:border-zinc-500"
              }`}
              style={{ minHeight: "300px" }}
            />
            {schemaError && (
              <p className="text-xs text-red-400 bg-red-900/20 rounded p-2 border border-red-800">
                {schemaError}
              </p>
            )}
          </div>

          {/* API Parameters */}
          <div className="p-4 space-y-4 border-t border-zinc-800">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide block">Parameters</label>

            {/* Thinking Level */}
            <ParamRow label="Thinking Effort">
              <div className="flex gap-1.5">
                {THINKING_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setParam("thinkingLevel", level)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      config.params.thinkingLevel === level
                        ? "bg-white text-black"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </ParamRow>

            {/* Media Resolution */}
            <ParamRow label="Media Resolution">
              <select
                value={config.params.mediaResolution ?? ""}
                onChange={(e) => setParam("mediaResolution", e.target.value as GeminiApiParams["mediaResolution"] || null)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:border-zinc-500 transition"
              >
                {MEDIA_RESOLUTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </ParamRow>

            {/* Google Search */}
            <ParamRow label="Google Search">
              <Toggle
                value={config.params.googleSearch}
                onChange={(v) => setParam("googleSearch", v)}
              />
            </ParamRow>

            {/* URL Context */}
            <ParamRow label="URL Context">
              <Toggle
                value={config.params.urlContext}
                onChange={(v) => setParam("urlContext", v)}
              />
            </ParamRow>
          </div>

          {/* Safety Settings */}
          <div className="p-4 space-y-3 border-t border-zinc-800">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide block">Safety Settings</label>
            <p className="text-[10px] text-zinc-600">Default is Off for Gemini 3 models</p>

            {HARM_CATEGORIES.map((cat) => (
              <ParamRow key={cat.value} label={cat.label}>
                <select
                  value={getSafetyThreshold(cat.value)}
                  onChange={(e) => setSafetyThreshold(cat.value, e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:border-zinc-500 transition"
                >
                  {HARM_THRESHOLDS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </ParamRow>
            ))}
          </div>

          {/* Reset All */}
          {!isAllDefault && (
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition"
              >
                Reset All to Defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-300 font-medium min-w-[160px]">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        value ? "bg-white" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
          value ? "translate-x-5 bg-black" : "translate-x-0 bg-zinc-400"
        }`}
      />
    </button>
  );
}
