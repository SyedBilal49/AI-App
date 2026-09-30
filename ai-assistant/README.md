# AI Assistant

A Next.js AI chat app deployed as a **single Vercel project**. The browser talks to same-origin Next.js route handlers, and those handlers call Google Gemini server-side. The Gemini API key is never exposed to the browser.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Set the Vercel project **Root Directory** to `ai-assistant/web`.
3. Add these Vercel Environment Variables for Production (and Preview if desired):
   - `GEMINI_API_KEY` — your Google AI Studio API key.
   - `GEMINI_MODEL` — optional; defaults to `gemini-2.5-flash`.
   - `SYSTEM_PROMPT` — optional.
4. Deploy. Vercel detects Next.js and uses `vercel.json` in the web directory.

No separate backend deployment, `API_URL`, CORS setting, Python runtime, or Docker service is required on Vercel.

## Local run

```bash
cd web
npm ci
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local
npm run dev
```

Open <http://localhost:3000>. The optional FastAPI service under `api/` remains available for local/Docker development, but Vercel uses the Next.js routes under `web/app/api/`.

## Checks

```bash
cd web
npm run typecheck
npm run build
```

Chat history is stored in the browser's local storage. Add authentication and a database before using it for private or multi-user data.
