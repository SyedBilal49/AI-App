const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiRole = "user" | "model";

export interface GeminiMessage {
  role: GeminiRole;
  parts: { text: string }[];
}

export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function geminiHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

export function geminiUrl(path: string, apiKey: string, query = "") {
  const suffix = query ? `?${query}` : "";
  return `${GEMINI_API_BASE}${path}${suffix}`;
}

export function toGeminiContents(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): GeminiMessage[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export function sseEvent(type: string, data: Record<string, unknown>) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
    .join("");
}

export function readableGeminiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}
