// Voice in and out. Inside the Android app it uses the phone's own speech engines through
// Capacitor plugins; in a browser it uses the Web Speech API where the browser has it.

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as NativeRecognition } from "@capacitor-community/speech-recognition";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

const native = Capacitor.isNativePlatform();
const WebRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const canSpeak = native || "speechSynthesis" in window;
export const canListen = native || Boolean(WebRecognition);

// ---- Playback ----
export async function speak(text, { slow = false } = {}) {
  if (native) {
    await TextToSpeech.stop().catch(() => {});
    await TextToSpeech.speak({ text, lang: "ja-JP", rate: slow ? 0.6 : 1.0 });
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = slow ? 0.6 : 0.95;
  const ja = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ja"));
  if (ja) u.voice = ja;
  speechSynthesis.speak(u);
}

// ---- Recognition ----
// start(lang, { onText, onEnd, onError }) begins listening; stop() ends it.
let webRec = null;
let nativeHandles = [];
let listening = false;

export const isListening = () => listening;

export async function startListening(lang, { onText, onEnd, onError }) {
  const finish = () => {
    if (!listening) return;
    listening = false;
    onEnd();
  };

  if (native) {
    try {
      const perm = await NativeRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") return onError("Allow the microphone to speak.");
      const { available } = await NativeRecognition.available();
      if (!available) return onError("This phone has no speech recognition installed.");
      for (const h of nativeHandles) h.remove();
      nativeHandles = [
        await NativeRecognition.addListener("partialResults", (e) => e.matches?.[0] && onText(e.matches[0])),
        await NativeRecognition.addListener("listeningState", (e) => e.status === "stopped" && finish()),
      ];
      listening = true;
      await NativeRecognition.start({ language: lang, partialResults: true, popup: false });
    } catch (err) {
      finish();
      if (!/no match|no speech|client/i.test(String(err?.message))) onError("Couldn't hear that. Try again.");
    }
    return;
  }

  webRec = new WebRecognition();
  webRec.lang = lang;
  webRec.interimResults = true;
  webRec.onresult = (e) => onText(Array.from(e.results, (r) => r[0].transcript).join(""));
  webRec.onerror = (e) => {
    if (e.error === "not-allowed") onError("Allow the microphone in your browser to speak.");
    else if (e.error !== "aborted" && e.error !== "no-speech") onError("Couldn't hear that. Try again.");
  };
  webRec.onend = finish;
  listening = true;
  webRec.start();
}

export function stopListening() {
  if (native) NativeRecognition.stop().catch(() => {});
  else webRec?.stop();
}
