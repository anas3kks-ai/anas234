# Omni Agent

A full-stack AI chat agent platform — a Devin / Manus / Claude-style autonomous agent. It can browse the web, execute code in an isolated sandbox, create and edit files, send emails, and more.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + SQLite + JWT auth
- **LLM**: [Inception Labs Mercury 2](https://inceptionlabs.ai) (OpenAI-compatible, native tool use, ~1000 tok/s)
- **Code Execution**: [E2B Sandbox](https://e2b.dev) (secure Linux VM per conversation)
- **Web Browsing**: [Browserless](https://browserless.io) (headless Chrome REST API)
- **Email**: SMTP (Gmail / SendGrid / Resend compatible)
- **Streaming**: Server-Sent Events for live agent activity

## Features

- Clean, modern chat UI with a split-pane "activity" panel that shows what the agent is doing in real time (browser screenshots, terminal output, file tree)
- Authentication (email + password, JWT)
- Persistent conversation history with long-term memory notes per user
- Agent loop with native tool calling:
  - `browse_web(url)` — fetch rendered page content
  - `screenshot(url)` — capture a full-page screenshot
  - `run_code(language, code)` — execute Python / JS / shell in an E2B sandbox
  - `write_file(path, content)` / `read_file(path)` / `list_files(path)` — filesystem in the sandbox
  - `send_email(to, subject, body)` — send email via SMTP
  - `remember(fact)` / `recall(query)` — persistent long-term memory
- Multi-turn tool use until the task is complete

## Getting started locally

### Backend

```bash
cd backend
cp .env.example .env
# fill in INCEPTION_API_KEY, E2B_API_KEY, BROWSERLESS_TOKEN, JWT_SECRET, (optional SMTP_*)
uv pip install -r requirements.txt  # or: pip install -e .
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000

## Deployment

- **Backend**: Fly.io (Dockerfile and `fly.toml` included)
- **Frontend**: devinapps / Vercel / any static host

See `DEPLOYMENT.md` for details.

## License

MIT
