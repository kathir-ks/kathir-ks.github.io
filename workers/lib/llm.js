/**
 * Provider-agnostic LLM layer for Kathir OS workers.
 *
 * Usage:
 *   import { chat } from "../lib/llm.js";
 *   const { text } = await chat(env, {
 *     system: "You are ...",
 *     messages: [{ role: "user", content: "Hi" }],
 *     maxTokens: 512,
 *     temperature: 0.6,
 *   });
 *
 * Provider is selected by env.LLM_PROVIDER (default: "gemini").
 * Each provider has its own env vars — see PROVIDERS below.
 *
 * Supported providers:
 *   - gemini    → Google AI Studio (free tier, default)
 *   - openai    → any OpenAI-compatible endpoint
 *                 (covers OpenAI, Groq, OpenRouter, vLLM, Ollama, self-hosted)
 *   - anthropic → Claude API
 *
 * Unified message shape: { role: "user" | "assistant", content: string }
 * Unified return: { text: string, raw: object }
 *
 * Throws on transport/API error so callers can decide whether to fall back.
 */

const DEFAULT_PROVIDER = "gemini";

export async function chat(env, opts) {
  const provider = opts.provider || env.LLM_PROVIDER || DEFAULT_PROVIDER;
  const impl = PROVIDERS[provider];
  if (!impl) throw new Error(`Unknown LLM provider: ${provider}`);
  return impl(env, opts);
}

const PROVIDERS = {
  gemini: geminiChat,
  openai: openaiChat,
  anthropic: anthropicChat,
};

// ── Gemini ────────────────────────────────────────────────────
// env: GEMINI_KEY, optional GEMINI_MODEL (default gemini-2.0-flash)
async function geminiChat(env, { system, messages, maxTokens = 512, temperature = 0.6 }) {
  if (!env.GEMINI_KEY) throw new Error("GEMINI_KEY not set");
  const model = env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`;

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text, raw: data };
}

// ── OpenAI-compatible ─────────────────────────────────────────
// env: OPENAI_KEY, optional OPENAI_BASE_URL (default https://api.openai.com/v1),
//      optional OPENAI_MODEL (default gpt-4o-mini).
// Works for Groq (base_url=https://api.groq.com/openai/v1, model=llama-3.3-70b-versatile),
// OpenRouter, vLLM, Ollama, etc.
async function openaiChat(env, { system, messages, maxTokens = 512, temperature = 0.6 }) {
  if (!env.OPENAI_KEY) throw new Error("OPENAI_KEY not set");
  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.OPENAI_MODEL || "gpt-4o-mini";

  const fullMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return { text, raw: data };
}

// ── Anthropic ─────────────────────────────────────────────────
// env: ANTHROPIC_KEY, optional ANTHROPIC_MODEL (default claude-haiku-4-5-20251001)
async function anthropicChat(env, { system, messages, maxTokens = 512, temperature = 0.6 }) {
  if (!env.ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY not set");
  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };
  if (system) body.system = system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  return { text, raw: data };
}
