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

### Cloudflare secrets

Set these in your Cloudflare dashboard or via wrangler:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put HUGGINGFACE_TOKEN
```

### GitHub secrets

Add these to your GitHub repo settings:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENROUTER_API_KEY`
- `HUGGINGFACE_TOKEN`

### Deploy

Push to `main` — GitHub Actions deploys automatically.

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
