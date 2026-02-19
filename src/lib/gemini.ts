import { GoogleGenAI, ThinkingLevel, type MediaResolution as MediaResolutionType } from "@google/genai";
import { DEFAULT_PROMPT, DEFAULT_SCHEMA, type GeminiConfig } from "./gemini-defaults";

const THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
  minimal: "MINIMAL" as ThinkingLevel,
  low: "LOW" as ThinkingLevel,
  medium: "MEDIUM" as ThinkingLevel,
  high: "HIGH" as ThinkingLevel,
};

const MEDIA_RESOLUTION_MAP: Record<string, string> = {
  MEDIA_RESOLUTION_UNSPECIFIED: "MEDIA_RESOLUTION_UNSPECIFIED",
  MEDIA_RESOLUTION_LOW: "MEDIA_RESOLUTION_LOW",
  MEDIA_RESOLUTION_MEDIUM: "MEDIA_RESOLUTION_MEDIUM",
  MEDIA_RESOLUTION_HIGH: "MEDIA_RESOLUTION_HIGH",
};

export async function analyzeSegment(
  audioBase64: string,
  mimeType: string,
  geminiConfig?: GeminiConfig
) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const prompt = geminiConfig?.prompt ?? DEFAULT_PROMPT;
  const schema = geminiConfig?.schemaJson
    ? JSON.parse(geminiConfig.schemaJson)
    : DEFAULT_SCHEMA;
  const params = geminiConfig?.params;

  const apiConfig: Record<string, unknown> = {
    thinkingConfig: {
      thinkingLevel: THINKING_LEVEL_MAP[params?.thinkingLevel ?? "high"] ?? ThinkingLevel.HIGH,
    },
    responseMimeType: "application/json",
    responseSchema: schema,
  };

  if (params?.mediaResolution && MEDIA_RESOLUTION_MAP[params.mediaResolution]) {
    apiConfig.mediaResolution = MEDIA_RESOLUTION_MAP[params.mediaResolution] as MediaResolutionType;
  }

  // Tools: Google Search and URL Context
  const tools: Record<string, object>[] = [];
  if (params?.googleSearch) tools.push({ googleSearch: {} });
  if (params?.urlContext) tools.push({ urlContext: {} });
  if (tools.length > 0) apiConfig.tools = tools;

  // Safety settings
  if (params?.safetySettings && params.safetySettings.length > 0) {
    apiConfig.safetySettings = params.safetySettings;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: audioBase64, mimeType } },
        ],
      },
    ],
    config: apiConfig,
  });

  const text = response.text || "";
  return JSON.parse(text);
}
