import { NextResponse } from "next/server";
import {
  extractGeminiText,
  geminiHeaders,
  geminiUrl,
  getGeminiConfig,
  readableGeminiError,
  sseEvent,
  toGeminiContents,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  messages?: Array<{ role?: string; content?: string }>;
  provider?: string | null;
  model?: string | null;
}

export async function POST(request: Request) {
  const { apiKey, model: defaultModel } = getGeminiConfig();
  if (!apiKey) {
    return NextResponse.json({ detail: "Gemini is not configured. Add GEMINI_API_KEY in Vercel." }, { status: 503 });
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const messages = body.messages?.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
  );
  if (!messages?.length || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ detail: "The last message must be from the user." }, { status: 422 });
  }
  if (messages.length > 100 || messages.some((message) => message.content.length > 32_000)) {
    return NextResponse.json({ detail: "The conversation is too long." }, { status: 422 });
  }

  const model = body.model?.trim() || defaultModel;
  const prompt = process.env.SYSTEM_PROMPT?.trim() ||
    "You are a helpful, accurate and concise AI assistant. Use Markdown for structure when it helps readability.";
  const upstream = await fetch(
    geminiUrl(`/models/${encodeURIComponent(model)}:streamGenerateContent`, apiKey, "alt=sse"),
    {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: toGeminiContents(messages),
      }),
      signal: request.signal,
      cache: "no-store",
    },
  );

  if (!upstream.ok || !upstream.body) {
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = null;
    }
    return NextResponse.json(
      { detail: readableGeminiError(payload, `Gemini request failed (${upstream.status}).`) },
      { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  let finished = false;
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (!finished) controller.enqueue(encoder.encode(sseEvent("done", {})));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const payload = JSON.parse(raw) as unknown;
            const text = extractGeminiText(payload);
            if (text) {
              if (!started) {
                started = true;
                controller.enqueue(encoder.encode(sseEvent("meta", {
                  provider: "gemini",
                  provider_label: "Google Gemini",
                  model,
                  local: false,
                  fallback: false,
                  notice: null,
                })));
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
            }
          } catch {
            // Ignore keep-alive or incomplete SSE lines; the next chunk completes them.
          }
        }
      } catch (error) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(sseEvent("error", {
          message: error instanceof Error ? error.message : "Gemini streaming failed.",
        })));
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
