# Portfolio chatbot — Cloudflare Worker

Tiny Worker that proxies questions from the portfolio site to Cloudflare Workers AI (Llama 3.1 8B Instruct), grounded by a system prompt with biographical facts.

## Deploy

One-time setup:

```sh
cd worker
npm install
npx wrangler login          # opens browser, signs into your Cloudflare account
npx wrangler deploy         # builds and publishes the Worker
```

After `deploy`, wrangler prints a URL like:

```
https://stephen-portfolio-bot.<your-subdomain>.workers.dev
```

Copy that URL and paste it into `main.js` where the constant `WORKER_URL` is defined (search for `WORKER_URL =`). Bump the `?v=` cache-bust on the script tag in your HTML files so visitors get the new URL on next load.

## Local test

```sh
npx wrangler dev
```

Spawns a local Worker on `http://localhost:8787`. The portfolio's `localhost:8765` and `127.0.0.1:8765` are already in the Worker's allowed-origin list for local-dev.

Try it:

```sh
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{"question":"what is the IEEE big data paper about?"}'
```

## Limits

- Cloudflare Workers free tier: 100k requests/day. Workers AI free tier: 10k Neurons/day. Llama 3.1 8B is roughly 2–5 Neurons per typical short response, so the chatbot can handle thousands of conversations per day for $0.
- If the daily AI quota is exhausted, requests return HTTP 502. The widget on the site shows that as an error and suggests emailing.

## Updating the system prompt

Edit `src/index.js` (`SYSTEM_PROMPT` constant), then `npx wrangler deploy` again. The Worker URL stays the same.
