import { NextResponse } from "next/server";
import { geminiHeaders, geminiUrl, getGeminiConfig, readableGeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { apiKey, model: defaultModel } = getGeminiConfig();
  const baseProvider = {
    id: "gemini",
    label: "Google Gemini",
    local: false,
    configured: Boolean(apiKey),
    available: false,
    error: null as string | null,
    models: [] as Array<{ id: string; name: string; provider: string; local: false }>,
  };

  if (!apiKey) {
    baseProvider.error = "Add GEMINI_API_KEY in Vercel project settings.";
    return NextResponse.json({ providers: [baseProvider], default: null, has_local_models: false });
  }

  try {
    const response = await fetch(geminiUrl("/models", apiKey), {
      headers: geminiHeaders(apiKey),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(readableGeminiError(payload, `Gemini model lookup failed (${response.status}).`));

    const models = (payload.models ?? [])
      .filter((item) => item.name && item.supportedGenerationMethods?.includes("generateContent"))
      .map((item) => {
        const id = item.name!.replace(/^models\//, "");
        return { id, name: item.displayName || id, provider: "gemini" as const, local: false as const };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const preferred = models.find((item) => item.id === defaultModel) ?? models[0] ?? null;
    baseProvider.available = models.length > 0;
    baseProvider.models = models;
    if (!models.length) baseProvider.error = "No Gemini chat models are available for this key.";
    return NextResponse.json({ providers: [baseProvider], default: preferred, has_local_models: false });
  } catch (error) {
    baseProvider.error = error instanceof Error ? error.message : "Gemini model lookup failed.";
    return NextResponse.json({ providers: [baseProvider], default: null, has_local_models: false });
  }
}
