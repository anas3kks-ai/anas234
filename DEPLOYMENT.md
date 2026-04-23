# Deployment

## Backend (Fly.io)

1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. `flyctl auth login`
3. From `backend/`:
   ```bash
   flyctl launch --no-deploy --dockerfile Dockerfile --name omni-agent-api
   flyctl volumes create omni_agent_data --size 1 -r iad
   flyctl secrets set \
     INCEPTION_API_KEY=sk_... \
     E2B_API_KEY=e2b_... \
     BROWSERLESS_TOKEN=... \
     JWT_SECRET=$(openssl rand -hex 32) \
     DATABASE_URL=sqlite:////data/omni_agent.db \
     CORS_ORIGINS=https://your-frontend.devinapps.com
   flyctl deploy
   ```

## Frontend (static)

From `frontend/`:

```bash
npm install
NEXT_PUBLIC_API_URL=https://your-backend.fly.dev npm run build
# upload ./out to any static host (devinapps, Vercel, Netlify, S3+CloudFront…)
```

Omni Agent is built as a static export (`output: "export"` in `next.config.js`),
so `out/` can be served from any static host without a Node runtime.
