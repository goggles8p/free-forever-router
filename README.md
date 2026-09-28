# Free Forever Router

A Cloudflare Worker that routes LLM requests to the best available **free model** from OpenRouter and Hugging Face.

## Features

- **OpenAI-compatible** `/v1/chat/completions` endpoint
- **AI-powered model selection** using Cloudflare Workers AI (Llama 3.2 1B)
- **Automatic failover** to the next best free model
- **Combines 26+ free models** from OpenRouter and Hugging Face
- **No local builds** — deployed via GitHub Actions

## How it works

1. Receives a chat completion request
2. Classifies the request as: `coding`, `reasoning`, `math`, `vision`, `long-context`, or `general`
3. Picks the best matching free model from the ranked list
4. Forwards the request to OpenRouter or Hugging Face
5. Streams the response back

## Setup

### 1. Add the GitHub Actions workflow (manual step)

Due to GitHub token scope, the workflow file must be added manually. In your repo:

1. Go to https://github.com/goggles8p/free-forever-router
2. Click **Add file** → **Create new file**
3. Path: `.github/workflows/deploy.yml`
4. Paste the contents below
5. Commit directly to `main`

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          HUGGINGFACE_TOKEN: ${{ secrets.HUGGINGFACE_TOKEN }}
```

### 2. Add GitHub secrets

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

- `CLOUDFLARE_API_TOKEN` — your Cloudflare API token with Workers edit permissions
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID
- `OPENROUTER_API_KEY` — your OpenRouter API key
- `HUGGINGFACE_TOKEN` — your Hugging Face API token

### 3. Deploy

Push to `main` (or click **Run workflow** manually). GitHub Actions deploys to Cloudflare.

### Cloudflare Worker secrets

If you deploy manually with Wrangler, set:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put HUGGINGFACE_TOKEN
```

## Usage in opencode

Add this provider to your `opencode.jsonc`:

```jsonc
"free-forever-router": {
  "name": "Free Forever Router",
  "npm": "@ai-sdk/openai-compatible",
  "options": { "baseURL": "https://free-forever-router.<your-subdomain>.workers.dev/v1" },
  "apiKey": "{env:FREE_FOREVER_ROUTER_KEY}",
  "models": {
    "free-forever": { "name": "Free Forever (AI router)", "_launch": true }
  }
}
```
