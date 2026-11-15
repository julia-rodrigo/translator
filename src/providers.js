// Translation engines. Each takes { text, photo, formality } and returns the result object
// described by OUTPUT_SCHEMA in prompt.js (the non-AI engine fills only what it can).

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, OUTPUT_SCHEMA, JSON_SHAPE_HINT } from "./prompt.js";

export const PROVIDERS = {
  free: {
    name: "Basic (no AI, free)",
    needsKey: false,
    photos: false,
    note: "Free and needs no key. Gives one plain translation: no casual/polite choice, no readings, no photos.",
  },
  gemini: {
    name: "Google Gemini",
    needsKey: true,
    photos: true,
    defaultModel: "gemini-flash-latest",
    note: "Has a free tier. Get a key at aistudio.google.com.",
  },
  openai: {
    name: "ChatGPT (OpenAI) or compatible",
    needsKey: true,
    photos: true,
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    note: "OpenAI's API is paid (separate from the free ChatGPT app). Change the address to use another OpenAI-compatible service, such as Groq or OpenRouter.",
  },
  claude: {
    name: "Claude (Anthropic)",
    needsKey: true,
    photos: true,
    defaultModel: "claude-haiku-5-5",
    models: [
      ["claude-haiku-5-5", "Haiku 5.5 (cheapest, fast)"],
      ["claude-sonnet-5-5", "Sonnet 5.5"],
      ["claude-opus-5-5", "Opus 5.5 (best)"],
    ],
    note: "Paid. Get a key at console.anthropic.com.",
  },
};

export class TranslateError extends Error {}

function userText({ text, formality }) {
  return `Formality: ${formality}\n\n${text || "Translate the text in this photo."}`;
}

function parseJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new TranslateError("The answer came back garbled. Try again.");
  try {
    const out = JSON.parse(raw.slice(start, end + 1));
    out.versions = (out.versions || []).map((v) => ({ ...v, back_translation: v.back_translation ?? v.meaning ?? "" }));
    return out;
  } catch {
    throw new TranslateError("The answer came back garbled. Try again.");
  }
}

async function httpError(res, who) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message || "";
  } catch {}
  if (res.status === 401 || res.status === 403) return new TranslateError(`${who} didn't accept that API key. Check it in Settings.`);
  if (res.status === 429) return new TranslateError(`${who} says you've hit a limit. Wait a moment, or switch engine in Settings.`);
  if (res.status === 404) return new TranslateError(`${who} doesn't know that model name. Check it in Settings.`);
  return new TranslateError(`${who} error ${res.status}${detail ? ": " + detail : ""}`);
}

// ---- No AI: MyMemory public translation memory (free, no key) ----
const JAPANESE = /[぀-ヿ一-鿿]/;

async function translateFree({ text }) {
  if (!text) throw new TranslateError("Basic mode can't read photos. Type the text, or pick an AI engine in Settings.");
  if (text.length > 480) throw new TranslateError("Basic mode handles up to about 480 characters at a time.");
  const fromJa = JAPANESE.test(text);
  const pair = fromJa ? "ja|en" : "en|ja";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
  const res = await fetch(url);
  if (!res.ok) throw new TranslateError("The free translator is busy. Try again in a moment.");
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || data.responseStatus !== 200) {
    throw new TranslateError("The free translator has hit its daily limit. Try later, or pick an AI engine in Settings.");
  }
  return {
    scene: "",
    versions: [
      {
        label: "Basic translation",
        japanese: fromJa ? text : out,
        reading: "",
        romaji: "",
        back_translation: fromJa ? out : text,
        highlights: [],
      },
    ],
    vocab: [],
    notes: ["Basic mode gives one plain translation. Pick an AI engine in Settings for casual vs polite, readings, word lists and photos."],
  };
}

// ---- Google Gemini ----
async function translateGemini(input, { apiKey, model }) {
  const parts = [];
  if (input.photo) parts.push({ inlineData: { mimeType: input.photo.mediaType, data: input.photo.data } });
  parts.push({ text: userText(input) });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + "\n\n" + JSON_SHAPE_HINT }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw await httpError(res, "Gemini");
  const data = await res.json();
  const raw = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!raw) throw new TranslateError("Gemini couldn't translate that one. Try rewording it.");
  return parseJson(raw);
}

// ---- OpenAI and OpenAI-compatible services ----
async function translateOpenAI(input, { apiKey, model, baseUrl }) {
  const content = [{ type: "text", text: userText(input) }];
  if (input.photo) {
    content.push({ type: "image_url", image_url: { url: `data:${input.photo.mediaType};base64,${input.photo.data}` } });
  }
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + JSON_SHAPE_HINT },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw await httpError(res, "The service");
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new TranslateError("No translation came back. Try rewording it.");
  return parseJson(raw);
}

// ---- Claude ----
async function translateClaude(input, { apiKey, model }) {
  const content = [];
  if (input.photo) {
    content.push({ type: "image", source: { type: "base64", media_type: input.photo.mediaType, data: input.photo.data } });
  }
  content.push({ type: "text", text: userText(input) });

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const params = {
    model,
    max_tokens: 16000,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };
  try {
    // Opus and Sonnet can hand a declined request to a backup model; Haiku has no such option.
    const response = model.includes("haiku")
      ? await client.messages.create(params)
      : await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    if (response.stop_reason === "refusal") throw new TranslateError("Claude couldn't translate that one. Try rewording it.");
    const block = response.content.find((b) => b.type === "text");
    if (!block) throw new TranslateError("No translation came back. Try again.");
    return parseJson(block.text);
  } catch (err) {
    if (err instanceof TranslateError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new TranslateError("Claude didn't accept that API key. Check it in Settings.");
    if (err instanceof Anthropic.RateLimitError) throw new TranslateError("Too many requests. Wait a moment and try again.");
    if (err instanceof Anthropic.APIConnectionError) throw new TranslateError("Couldn't reach Claude. Check your connection.");
    if (err instanceof Anthropic.APIError) throw new TranslateError(`Claude error ${err.status ?? ""}: ${err.message}`);
    throw err;
  }
}

export async function translate(provider, input, settings) {
  try {
    if (provider === "free") return await translateFree(input);
    if (provider === "gemini") return await translateGemini(input, settings);
    if (provider === "openai") return await translateOpenAI(input, settings);
    return await translateClaude(input, settings);
  } catch (err) {
    if (err instanceof TranslateError) throw err;
    if (err instanceof TypeError) throw new TranslateError("Couldn't reach the translator. Check your connection.");
    throw new TranslateError(`Something went wrong: ${err.message}`);
  }
}
