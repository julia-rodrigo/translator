// Built-in engines that need no API key. They run on the phone itself, inside the Android app.
// - Phone AI: Google's Gemini Nano through ML Kit GenAI (only on phones that ship it).
// - Offline translator: ML Kit Translation plus ML Kit Text Recognition for photos (any Android phone).

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { GenAiPrompt, FeatureStatus } from "@capacitor-mlkit/genai-prompt";
import { Translation, Language } from "@capacitor-mlkit/translation";
import { TextRecognition, Script } from "@capacitor-mlkit/text-recognition";

export const isNative = Capacitor.isNativePlatform();

export class BuiltinError extends Error {}

const JAPANESE = /[぀-ヿ一-鿿]/;

// Both ML Kit plugins read images from a file, so write the photo to the app's cache first.
async function photoFile(photo) {
  const { uri } = await Filesystem.writeFile({
    path: `photo-${Date.now()}.jpg`,
    data: photo.data,
    directory: Directory.Cache,
  });
  return uri;
}

// ---- Phone AI (Gemini Nano) ----

// "ready", "download" (supported, model not on the phone yet), "downloading" or "unsupported".
export async function phoneAiStatus() {
  if (!isNative) return "unsupported";
  try {
    const { featureStatus } = await GenAiPrompt.checkFeatureStatus();
    if (featureStatus === FeatureStatus.Available) return "ready";
    if (featureStatus === FeatureStatus.Downloadable) return "download";
    if (featureStatus === FeatureStatus.Downloading) return "downloading";
  } catch {}
  return "unsupported";
}

// Gemini Nano is small: it gets a short prompt and is asked for a small answer (it can
// write about 256 tokens), so no word list and at most one tip.
function nanoPrompt({ text, formality, dialect }) {
  const wanted = formality === "both" ? "two entries: Casual, then Polite" : `one entry: ${formality === "casual" ? "Casual" : "Polite"}`;
  const dialectLine = {
    standard: "",
    osaka: "Use Osaka dialect (大阪弁): や not だ, 〜へん negatives, 〜ねん, ほんま, めっちゃ, あかん.\n",
    kyoto: "Use Kyoto dialect (京都弁): soft, 〜はる honorific, や not だ, 〜へん negatives, 〜え / 〜し endings.\n",
  }[dialect || "standard"];
  const source = text
    ? `Text: ${text}`
    : "The image is a photo. Translate the main text in it.";
  return `You translate between English and Japanese for a learner.
If the text is English, translate it into natural spoken Japanese. If it is Japanese, give the Japanese as written and put the English meaning in "back_translation".
Casual = plain forms (タメ口). Polite = です／ます.
${dialectLine}Give ${wanted}. Label dialect versions like "Casual · Osaka".
"highlights" = exact parts of "japanese" that make it casual, polite or dialect.
Reply with only this JSON, nothing else:
{"versions":[{"label":"Casual","japanese":"","reading":"(hiragana)","romaji":"","back_translation":"","highlights":[]}],"notes":["one short tip"]}

${source}`;
}

export async function translatePhoneAi(input, onProgress) {
  const status = await phoneAiStatus();
  if (status === "unsupported") {
    throw new BuiltinError("This phone doesn't have Google's built-in AI (Gemini Nano). Pick the offline translator or add an API key in Settings.");
  }
  if (status !== "ready") {
    onProgress?.("Downloading the built-in AI to your phone. This happens once and can take a few minutes…");
    try {
      await GenAiPrompt.downloadFeature();
    } catch {
      throw new BuiltinError("Couldn't download the built-in AI. Connect to Wi-Fi and try again.");
    }
  }
  onProgress?.("Translating on your phone…");
  let raw;
  try {
    const opts = { prompt: nanoPrompt(input), maxOutputTokens: 256, temperature: 0.2 };
    if (input.photo) opts.imagePath = await photoFile(input.photo);
    ({ text: raw } = await GenAiPrompt.generateContent(opts));
  } catch (err) {
    if (input.photo) throw new BuiltinError("The built-in AI on this phone can't read photos. Try the offline translator for photos.");
    throw new BuiltinError(`The built-in AI couldn't translate that: ${err.message || "unknown error"}`);
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  try {
    const out = JSON.parse(raw.slice(start, end + 1));
    return {
      scene: "",
      versions: (out.versions || []).map((v) => ({
        label: v.label || "Translation",
        japanese: v.japanese || "",
        reading: v.reading || "",
        romaji: v.romaji || "",
        back_translation: v.back_translation || v.meaning || "",
        highlights: Array.isArray(v.highlights) ? v.highlights : [],
      })),
      vocab: [],
      notes: [...(Array.isArray(out.notes) ? out.notes.slice(0, 1) : []), "Built-in AI is small and offline, so it can make mistakes. Claude gives fuller answers with word lists."],
    };
  } catch {
    throw new BuiltinError(
      input.formality === "both"
        ? "The built-in AI's answer got cut off. Try Casual or Polite on its own, or shorter text."
        : "The built-in AI's answer came back garbled. Try shorter text.",
    );
  }
}

// ---- Offline translator (ML Kit, no AI) ----

async function mlTranslate(text, fromJa, onProgress) {
  const sourceLanguage = fromJa ? Language.Japanese : Language.English;
  const targetLanguage = fromJa ? Language.English : Language.Japanese;
  const { languages } = await Translation.getDownloadedModels();
  if (!languages.includes(Language.Japanese)) {
    onProgress?.("Downloading the Japanese language pack (about 30 MB, once)…");
    try {
      await Translation.downloadModel({ language: Language.Japanese });
    } catch {
      throw new BuiltinError("Couldn't download the Japanese language pack. Connect to the internet once and try again.");
    }
  }
  const { text: out } = await Translation.translate({ text, sourceLanguage, targetLanguage });
  return out;
}

export async function translateOffline({ text, photo }, onProgress) {
  if (photo) {
    onProgress?.("Reading the text in your photo…");
    const { blocks } = await TextRecognition.processImage({ path: await photoFile(photo), script: Script.Japanese });
    const pieces = blocks.map((b) => b.text.trim()).filter(Boolean).slice(0, 15);
    if (!pieces.length) throw new BuiltinError("Couldn't find any text in that photo. Try a closer, sharper shot.");
    const versions = [];
    for (const [i, piece] of pieces.entries()) {
      const fromJa = JAPANESE.test(piece);
      const out = await mlTranslate(piece.replace(/\s*\n\s*/g, fromJa ? "" : " "), fromJa, onProgress);
      versions.push({
        label: `Text ${i + 1}`,
        japanese: fromJa ? piece : out,
        reading: "",
        romaji: "",
        back_translation: fromJa ? out : piece,
        highlights: [],
      });
    }
    return {
      scene: "",
      versions,
      vocab: [],
      notes: ["The offline translator reads the photo and translates each block word for word. Claude gives fuller answers."],
    };
  }
  const fromJa = JAPANESE.test(text);
  const out = await mlTranslate(text, fromJa, onProgress);
  return {
    scene: "",
    versions: [{
      label: "Offline translation",
      japanese: fromJa ? text : out,
      reading: "",
      romaji: "",
      back_translation: fromJa ? out : text,
      highlights: [],
    }],
    vocab: [],
    notes: ["The offline translator gives one plain translation, with no casual/polite choice. Pick Claude or Phone AI in Settings for more."],
  };
}
