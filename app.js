import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
import { SYSTEM_PROMPT, OUTPUT_SCHEMA } from "./prompt.js";

const MODEL = "claude-opus-5-5";
const KEY_STORAGE = "jp-translator-api-key";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("form"),
  text: $("text"),
  photo: $("photo"),
  preview: $("preview"),
  previewImg: $("preview-img"),
  clearPhoto: $("clear-photo"),
  go: $("go"),
  status: $("status"),
  results: $("results"),
  settings: $("settings"),
  apiKey: $("api-key"),
  saveKey: $("save-key"),
};

let photo = null; // { mediaType, data } base64

// ---- API key (kept only in this browser) ----
function getKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; }
}
function setKey(k) {
  try { localStorage.setItem(KEY_STORAGE, k); } catch {}
}
els.apiKey.value = getKey();
if (!getKey()) els.settings.open = true;
els.saveKey.addEventListener("click", () => {
  setKey(els.apiKey.value.trim());
  els.settings.open = false;
  showStatus("API key saved on this device.");
});

// ---- Photo: downscale before sending (smaller upload, same accuracy) ----
els.photo.addEventListener("change", async () => {
  const file = els.photo.files?.[0];
  if (!file) return;
  try {
    photo = await shrinkImage(file, 1568);
    els.previewImg.src = `data:${photo.mediaType};base64,${photo.data}`;
    els.preview.hidden = false;
  } catch (e) {
    showStatus("Couldn't read that photo. Try another one.", true);
  }
});
els.clearPhoto.addEventListener("click", () => {
  photo = null;
  els.photo.value = "";
  els.preview.hidden = true;
});

async function shrinkImage(file, maxSide) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
}

// ---- Translate ----
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = els.text.value.trim();
  const formality = new FormData(els.form).get("formality");
  if (!text && !photo) return showStatus("Type something or add a photo.", true);
  const apiKey = getKey();
  if (!apiKey) {
    els.settings.open = true;
    return showStatus("Add your Anthropic API key first.", true);
  }

  const content = [];
  if (photo) {
    content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }
  content.push({
    type: "text",
    text: `Formality: ${formality}\n\n${text || "Translate the text in this photo."}`,
  });

  setBusy(true);
  els.results.innerHTML = "";
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return showStatus("Claude couldn't translate that one. Try rewording it.", true);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("Empty response");
    render(JSON.parse(textBlock.text));
    showStatus("");
  } catch (err) {
    showStatus(friendlyError(err), true);
  } finally {
    setBusy(false);
  }
});

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "That API key didn't work. Check it in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the server. Check your connection.";
  if (err instanceof Anthropic.APIError) return `Error ${err.status ?? ""}: ${err.message}`;
  return `Something went wrong: ${err.message}`;
}

// ---- Rendering ----
function render(result) {
  const frag = document.createDocumentFragment();
  if (result.scene) frag.append(el("p", "scene", result.scene));

  for (const v of result.versions) {
    const card = el("article", "card");
    card.append(el("h3", "label", v.label));
    const jp = el("p", "jp", v.japanese);
    jp.lang = "ja";
    card.append(jp);
    if (v.reading && v.reading !== v.japanese) {
      const r = el("p", "reading", v.reading);
      r.lang = "ja";
      card.append(r);
    }
    if (v.romaji) card.append(el("p", "romaji", v.romaji));
    if (v.back_translation) card.append(el("p", "meaning", v.back_translation));

    const actions = el("div", "actions");
    actions.append(button("Copy", () => navigator.clipboard?.writeText(v.japanese)));
    if ("speechSynthesis" in window) actions.append(button("🔊 Listen", () => speak(v.japanese)));
    card.append(actions);
    frag.append(card);
  }

  if (result.notes?.length) {
    const notes = el("aside", "notes");
    notes.append(el("h3", "label", "Tips"));
    const ul = el("ul");
    for (const n of result.notes) ul.append(el("li", null, n));
    notes.append(ul);
    frag.append(notes);
  }
  els.results.append(frag);
}

function speak(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = $("slow").checked ? 0.6 : 0.95;
  const ja = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ja"));
  if (ja) u.voice = ja;
  speechSynthesis.speak(u);
}
if ("speechSynthesis" in window) $("slow-row").hidden = false;

// ---- Voice recognition: speak instead of typing ----
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  const mic = $("mic");
  let rec = null;
  $("mic-row").hidden = false;
  mic.addEventListener("click", () => {
    if (rec) return rec.stop();
    rec = new Recognition();
    rec.lang = new FormData(els.form).get("mic-lang");
    rec.interimResults = true;
    rec.onresult = (e) => {
      els.text.value = Array.from(e.results, (r) => r[0].transcript).join("");
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") showStatus("Allow the microphone in your browser to speak.", true);
      else if (e.error !== "aborted" && e.error !== "no-speech") showStatus("Couldn't hear that. Try again.", true);
    };
    rec.onend = () => {
      rec = null;
      mic.textContent = "🎤 Speak";
      mic.setAttribute("aria-pressed", "false");
    };
    mic.textContent = "⏹ Listening… tap to stop";
    mic.setAttribute("aria-pressed", "true");
    showStatus("");
    rec.start();
  });
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function button(label, onClick) {
  const b = el("button", "small", label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
function setBusy(busy) {
  els.go.disabled = busy;
  els.go.textContent = busy ? "Translating…" : "Translate";
  if (busy) showStatus("");
}
function showStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}
