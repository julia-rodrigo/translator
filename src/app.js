import { PROVIDERS, translate, TranslateError } from "./providers.js";
import { isNative, phoneAiStatus } from "./builtin.js";
import { canSpeak, canListen, speak, startListening, stopListening, isListening } from "./voice.js";
import { LEARN } from "./learn.js";

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
};

let photo = null; // { mediaType, data } base64

// ---- Settings: which engine, and its key/model (kept only on this device) ----
const store = {
  get(k) { try { return localStorage.getItem("jpt-" + k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem("jpt-" + k, v); } catch {} },
};
// Carry over a key saved by the first version of the app.
try {
  const old = localStorage.getItem("jp-translator-api-key");
  if (old && !store.get("key-claude")) { store.set("key-claude", old); store.set("provider", "claude"); }
} catch {}

const currentProvider = () => (PROVIDERS[store.get("provider")] ? store.get("provider") : "claude");
function providerSettings(id) {
  const p = PROVIDERS[id];
  return {
    apiKey: store.get("key-" + id),
    model: store.get("model-" + id) || p.defaultModel,
    baseUrl: store.get("url-" + id) || p.defaultBaseUrl,
  };
}

for (const [id, p] of Object.entries(PROVIDERS)) {
  const o = el("option", null, p.name);
  o.value = id;
  $("provider").append(o);
}
function showProviderFields() {
  const id = $("provider").value;
  const p = PROVIDERS[id];
  const cfg = providerSettings(id);
  $("provider-note").textContent = p.note;
  $("key-row").hidden = !p.needsKey;
  $("api-key").value = cfg.apiKey;
  $("model-row").hidden = !p.defaultModel;
  $("url-row").hidden = !p.defaultBaseUrl;
  $("base-url").value = cfg.baseUrl || "";
  // Claude gets a fixed list; the others take any model name.
  $("model-select").hidden = !p.models;
  $("model-text").hidden = Boolean(p.models);
  if (p.models) {
    $("model-select").replaceChildren(...p.models.map(([value, label]) => {
      const o = el("option", null, label);
      o.value = value;
      return o;
    }));
    $("model-select").value = cfg.model;
  } else {
    $("model-text").value = cfg.model || "";
  }
}
function updateEngineLine() {
  const id = currentProvider();
  $("engine-name").textContent = `Translating with: ${PROVIDERS[id].name}`;
  $("photo-label").hidden = !PROVIDERS[id].photos;
  // The non-AI engine can't choose a formality, so the pickers are hidden rather than greyed out.
  $("formality").hidden = !PROVIDERS[id].ai;
  $("dialect").hidden = !PROVIDERS[id].ai;
  updateDialectNote();
  $("basic-note").hidden = PROVIDERS[id].ai;
  // First run: ask for the Claude key up front.
  $("setup").hidden = !(id === "claude" && !store.get("key-claude"));
}
function openSettings() {
  $("provider").value = currentProvider();
  showProviderFields();
  els.settings.open = true;
  els.settings.scrollIntoView({ behavior: "smooth" });
}
$("engine-change").addEventListener("click", openSettings);
$("setup-save").addEventListener("click", () => {
  const key = $("setup-key").value.trim();
  if (!key) return showStatus("Paste your Claude API key first.", true);
  store.set("provider", "claude");
  store.set("key-claude", key);
  $("setup-key").value = "";
  showProviderFields();
  updateEngineLine();
  showStatus("Key saved on this phone. You're ready to translate.");
});
function useEngine(id, message) {
  store.set("provider", id);
  $("provider").value = id;
  showProviderFields();
  updateEngineLine();
  showStatus(message);
}
$("setup-free").addEventListener("click", () =>
  useEngine("free", isNative ? "Using the offline translator." : "Using the free basic translator."));
// Offer the built-in Phone AI on the first-run card when this phone has it.
if (isNative) {
  phoneAiStatus().then((status) => {
    if (status === "unsupported") {
      $("setup-builtin-note").textContent = "This phone doesn't have Google's built-in AI, but the offline translator works without a key.";
      return;
    }
    $("setup-builtin").hidden = false;
  });
}
$("setup-builtin").addEventListener("click", () =>
  useEngine("phone", "Using the built-in Phone AI. The first translation downloads it, which can take a few minutes."));
$("provider").value = currentProvider();
// Remember the last formality and dialect picked.
function updateDialectNote() {
  const d = new FormData(els.form).get("dialect");
  $("dialect-note").hidden = currentProvider() === "free" || d === "standard";
}
for (const name of ["formality", "dialect"]) {
  const saved = store.get(name);
  const input = saved && els.form.querySelector(`input[name="${name}"][value="${saved}"]`);
  if (input) input.checked = true;
  els.form.querySelectorAll(`input[name="${name}"]`).forEach((r) =>
    r.addEventListener("change", () => { store.set(name, r.value); updateDialectNote(); }));
}
$("provider").addEventListener("change", showProviderFields);
showProviderFields();
updateEngineLine();
$("save-settings").addEventListener("click", () => {
  const id = $("provider").value;
  const p = PROVIDERS[id];
  store.set("provider", id);
  if (p.needsKey) store.set("key-" + id, $("api-key").value.trim());
  if (p.defaultModel) store.set("model-" + id, (p.models ? $("model-select").value : $("model-text").value.trim()) || p.defaultModel);
  if (p.defaultBaseUrl) store.set("url-" + id, $("base-url").value.trim() || p.defaultBaseUrl);
  els.settings.open = false;
  updateEngineLine();
  showStatus("Saved on this device.");
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
  const formality = new FormData(els.form).get("formality") || "both";
  const dialect = new FormData(els.form).get("dialect") || "standard";
  const id = currentProvider();
  const usePhoto = PROVIDERS[id].photos ? photo : null;
  if (!text && !usePhoto) return showStatus("Type something or add a photo.", true);
  const cfg = providerSettings(id);
  if (PROVIDERS[id].needsKey && !cfg.apiKey) {
    if (id === "claude") {
      $("setup").scrollIntoView({ behavior: "smooth" });
      $("setup-key").focus();
    } else {
      openSettings();
    }
    return showStatus(`Add your ${PROVIDERS[id].name} API key first.`, true);
  }

  setBusy(true);
  els.results.innerHTML = "";
  try {
    const onProgress = (msg) => showStatus(msg);
    render(await translate(id, { text, photo: usePhoto, formality, dialect }, { ...cfg, onProgress }));
    showStatus("");
  } catch (err) {
    showStatus(err instanceof TranslateError ? err.message : `Something went wrong: ${err.message}`, true);
  } finally {
    setBusy(false);
  }
});

// ---- Rendering ----
function render(result) {
  const frag = document.createDocumentFragment();
  if (result.scene) frag.append(el("p", "scene", result.scene));

  let anyMarks = false;
  for (const v of result.versions) {
    const tone = /casual/i.test(v.label) ? " casual" : /polite/i.test(v.label) ? " polite" : "";
    const card = el("article", "card" + tone);
    card.append(el("h3", "label", v.label));
    const jp = el("p", "jp");
    jp.lang = "ja";
    markUp(jp, v.japanese, v.highlights);
    if (jp.querySelector("mark")) anyMarks = true;
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
    if (canSpeak) {
      actions.append(button("🔊 Listen", () =>
        speak(v.japanese, { slow: $("slow").checked }).catch(() => showStatus("Couldn't play the voice.", true))));
    }
    card.append(actions);
    frag.append(card);
  }

  if (anyMarks) {
    frag.querySelector(".card").before(
      el("p", "legend", "Highlighted parts are what make each version casual or polite."));
  }
  if (result.vocab?.length) {
    const vb = el("section", "vocab");
    vb.append(el("h3", "label", "Words in this one"));
    const dl = el("dl");
    for (const w of result.vocab) {
      const dt = el("dt", null, w.word);
      dt.lang = "ja";
      if (w.reading && w.reading !== w.word) dt.append(el("small", null, w.reading));
      dl.append(dt, el("dd", null, w.meaning));
    }
    vb.append(dl);
    frag.append(vb);
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

if (canSpeak) $("slow-row").hidden = false;

// ---- Voice recognition: speak instead of typing ----
if (canListen) {
  const mic = $("mic");
  $("mic-row").hidden = false;
  mic.addEventListener("click", () => {
    if (isListening()) return stopListening();
    mic.textContent = "⏹ Listening… tap to stop";
    mic.setAttribute("aria-pressed", "true");
    showStatus("");
    startListening(new FormData(els.form).get("mic-lang"), {
      onText: (t) => { els.text.value = t; },
      onError: (msg) => { resetMic(); showStatus(msg, true); },
      onEnd: resetMic,
    });
  });
  function resetMic() {
    mic.textContent = "🎤 Speak";
    mic.setAttribute("aria-pressed", "false");
  }
}

// Wrap the formality-specific substrings of a sentence in <mark>.
function markUp(node, text, highlights = []) {
  const ranges = highlights
    .map((h) => [text.indexOf(h), h.length])
    .filter(([i, len]) => i >= 0 && len > 0)
    .sort((a, b) => a[0] - b[0]);
  let pos = 0;
  for (const [i, len] of ranges) {
    if (i < pos) continue;
    node.append(text.slice(pos, i), el("mark", null, text.slice(i, i + len)));
    pos = i + len;
  }
  node.append(text.slice(pos));
}

// ---- Learn tab: tense chart ----
function chartTable(rows) {
  const t = el("table");
  const head = el("tr");
  head.append(el("th", null, "Form"), el("th", "c", "Casual"), el("th", "p", "Polite"));
  t.append(head);
  for (const [form, gloss, c, cr, p, pr] of rows) {
    const tr = el("tr");
    const th = el("th", null, form);
    if (gloss) th.append(el("small", null, gloss));
    tr.append(th);
    for (const [jp, ro] of [[c, cr], [p, pr]]) {
      const td = el("td");
      const b = el("b", null, jp);
      b.lang = "ja";
      td.append(b, el("i", null, ro));
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
}
function showVerb(i) {
  const v = LEARN.verbs[i];
  [...$("verbs").children].forEach((b, j) => b.setAttribute("aria-pressed", j === i));
  $("verb-kind").textContent = `${v.key} (${v.kana}) means "${v.en}". It's ${v.kind}.`;
  $("verb-table").replaceChildren(chartTable(v.rows));
}
LEARN.verbs.forEach((v, i) => {
  const b = button(`${v.key} · ${v.en}`, () => showVerb(i));
  $("verbs").append(b);
});
showVerb(0);
{
  const t = el("table");
  const head = el("tr");
  head.append(el("th", null, "Meaning"), el("th", null, "Standard"), el("th", "c", "Osaka"), el("th", "p", "Kyoto"));
  t.append(head);
  for (const [meaning, ...forms] of LEARN.dialects) {
    const tr = el("tr");
    tr.append(el("th", null, meaning));
    for (const [jp, ro] of forms) {
      const td = el("td");
      const b = el("b", null, jp);
      b.lang = "ja";
      td.append(b, el("i", null, ro));
      tr.append(td);
    }
    t.append(tr);
  }
  $("dialect-table").append(t);
}
for (const d of LEARN.describing) {
  $("describing").append(el("h3", "label", d.title), el("p", "hint", d.sub), chartTable(d.rows));
}
for (const [tab, view] of [["nav-translate", "view-translate"], ["nav-learn", "view-learn"]]) {
  $(tab).addEventListener("click", () => {
    for (const id of ["view-translate", "view-learn"]) $(id).hidden = id !== view;
    for (const id of ["nav-translate", "nav-learn"]) $(id).setAttribute("aria-selected", id === tab);
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
