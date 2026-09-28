// Free Forever Router - Cloudflare Worker
// Routes requests to the best available free LLM from OpenRouter + Hugging Face

const FREE_MODELS = [
  // OpenRouter free tier
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", context: 1000000, tags: ["general", "long-context", "powerful"] },
  { id: "thinkingmachines/inkling:free", provider: "openrouter", context: 1048576, tags: ["general", "long-context", "powerful"] },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", provider: "openrouter", context: 262144, tags: ["general", "reasoning", "powerful"] },
  { id: "nvidia/nemotron-3.5-lightning:free", provider: "openrouter", context: 1000000, tags: ["general", "fast", "long-context"] },
  { id: "thinkingmachines/inkling-small:free", provider: "openrouter", context: 1048576, tags: ["general", "long-context"] },
  { id: "qwen/qwen3.8-27b:free", provider: "openrouter", context: 262144, tags: ["coding", "general", "vision"] },
  { id: "google/gemma-4-31b-it:free", provider: "openrouter", context: 262144, tags: ["general"] },
  { id: "google/gemma-4-26b-a4b-it:free", provider: "openrouter", context: 262144, tags: ["general"] },
  { id: "nex-agi/nex-n2.5-pro:free", provider: "openrouter", context: 262144, tags: ["general", "vision"] },
  { id: "nex-agi/nex-n2.5-mini:free", provider: "openrouter", context: 262144, tags: ["general", "vision"] },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", provider: "openrouter", context: 256000, tags: ["reasoning", "vision", "audio"] },
  { id: "dots-studio/dots-3-note-preview:free", provider: "openrouter", context: 512000, tags: ["general", "vision", "long-context"] },
  { id: "inclusionai/ling-3.0-flash-vl:free", provider: "openrouter", context: 262144, tags: ["vision", "general"] },
  { id: "inclusionai/ling-3.0-flash-fin:free", provider: "openrouter", context: 262144, tags: ["general", "finance"] },
  { id: "inclusionai/ling-3.0-flash-sante:free", provider: "openrouter", context: 262144, tags: ["general", "medical"] },
  { id: "poolside/laguna-s-2.1:free", provider: "openrouter", context: 262144, tags: ["coding"] },
  { id: "poolside/laguna-xs-2.1:free", provider: "openrouter", context: 262144, tags: ["coding"] },
  { id: "cohere/north-mini-code:free", provider: "openrouter", context: 256000, tags: ["coding"] },
  { id: "z-ai/glm-5.2:free", provider: "openrouter", context: 32768, tags: ["general"] },
  { id: "liquid/lfm-2.5-2.6b:free", provider: "openrouter", context: 65536, tags: ["general", "fast"] },
  { id: "openrouter/free", provider: "openrouter", context: 200000, tags: ["general"] },
  // Hugging Face free models
  { id: "meta-llama/Llama-3.2-3B-Instruct", provider: "huggingface", context: 131072, tags: ["general", "fast"] },
  { id: "Qwen/Qwen2.5-7B-Instruct", provider: "huggingface", context: 32768, tags: ["general", "coding"] },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", provider: "huggingface", context: 32768, tags: ["general"] },
  { id: "google/gemma-2-9b-it", provider: "huggingface", context: 8192, tags: ["general"] },
  { id: "microsoft/Phi-3-mini-4k-instruct", provider: "huggingface", context: 4096, tags: ["general", "fast"] },
];

const CATEGORY_PROMPT = `You are a router for a free LLM API. Analyze the user request and classify it into EXACTLY ONE category: coding, reasoning, math, vision, long-context, or general.

Rules:
- coding: writing or debugging code, software architecture, APIs, regex, scripts, SQL
- reasoning: logical puzzles, multi-step analysis, explanations, comparisons
- math: calculations, algebra, equations, statistics
- vision: images, screenshots, diagrams, describe what you see (only if request mentions images)
- long-context: summarizing or analyzing large documents, >4000 tokens expected
- general: everything else, simple chat, creative writing, casual questions

Respond with ONLY the category word, nothing else.

User request: {{prompt}}`;

function getCategoryFromRequest(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return "general";
  const content = typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content);
  if (content.includes("image") || content.includes("screenshot") || content.includes("diagram") || content.includes("photo")) return "vision";
  if (content.length > 2000) return "long-context";
  return null; // needs AI classification
}

async function classifyWithAI(env, messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return "general";
  const prompt = typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content);
  const truncated = prompt.slice(0, 1500);

  const body = {
    messages: [
      { role: "system", content: "You classify user requests into one category: coding, reasoning, math, vision, long-context, or general. Reply with ONLY the category word." },
      { role: "user", content: `Category for this request: ${truncated}` }
    ],
    max_tokens: 10,
    temperature: 0.1,
  };

  try {
    const res = await env.AI.run("@cf/meta/llama-3.2-1b-instruct", body);
    const text = (res.response || "").toLowerCase().trim();
    if (text.includes("coding")) return "coding";
    if (text.includes("reasoning")) return "reasoning";
    if (text.includes("math")) return "math";
    if (text.includes("vision")) return "vision";
    if (text.includes("long-context")) return "long-context";
    return "general";
  } catch {
    return "general";
  }
}

function selectModels(category, requestedModel) {
  if (requestedModel && requestedModel !== "free-forever" && requestedModel !== "auto") {
    const specific = FREE_MODELS.find(m => m.id === requestedModel);
    if (specific) return [specific];
  }

  // Score models by category match and context
  const scored = FREE_MODELS.map(m => {
    let score = 0;
    if (m.tags.includes(category)) score += 10;
    if (category === "coding" && m.tags.includes("coding")) score += 5;
    if (category === "reasoning" && m.tags.includes("reasoning")) score += 5;
    if (category === "vision" && m.tags.includes("vision")) score += 5;
    if (category === "long-context") score += Math.log10(m.context + 1);
    score += Math.log10(m.context + 1) * 0.5;
    if (m.provider === "openrouter") score += 1; // prefer OpenRouter free tier
    return { ...m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

async function tryOpenRouter(model, body, env) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://free-forever-router.pages.dev",
      "X-Title": "Free Forever Router",
    },
    body: JSON.stringify({ ...body, model: model.id }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  return res;
}

async function tryHuggingFace(model, body, env) {
  const res = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.HUGGINGFACE_TOKEN}`,
    },
    body: JSON.stringify({ ...body, model: model.id }),
  });
  if (!res.ok) throw new Error(`HuggingFace error: ${res.status} ${await res.text()}`);
  return res;
}

async function routeRequest(body, env) {
  const category = getCategoryFromRequest(body.messages) || await classifyWithAI(env, body.messages);
  const models = selectModels(category, body.model);

  for (const model of models) {
    try {
      const start = Date.now();
      const res = model.provider === "openrouter"
        ? await tryOpenRouter(model, body, env)
        : await tryHuggingFace(model, body, env);
      console.log(`Routed to ${model.id} (${model.provider}) in ${Date.now() - start}ms`);
      return res;
    } catch (err) {
      console.error(`Failed ${model.id}:`, err.message);
      continue;
    }
  }

  throw new Error("All free models failed");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (url.pathname !== "/v1/chat/completions") {
      return new Response(JSON.stringify({ error: "Only /v1/chat/completions is supported" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Always override model to our router
    body.model = "free-forever";

    try {
      const res = await routeRequest(body, env);
      return new Response(res.body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("Content-Type") || "application/json",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};
