# AI-App

## Stack

- **Frontend and Vercel API:** Next.js 16, React 19, TypeScript 7, Tailwind CSS 4, shadcn/ui
- **AI provider:** Google Gemini via server-side Next.js route handlers
- **Optional local backend:** FastAPI under `ai-assistant/api/` for local/Docker development only

## Commands

```bash
cd ai-assistant/web
npm ci
cp .env.example .env.local
# Set GEMINI_API_KEY in .env.local
npm run dev
npm run typecheck
npm run build
```

## Rules

- Never commit `.env`, secrets, or API keys.
- Keep `GEMINI_API_KEY` server-side; never use a `NEXT_PUBLIC_` variable for it.
- Run typecheck and production build after changes.
- Keep changes minimal, type-safe, and maintainable.
