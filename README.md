# Casual Japanese Translator 翻訳

Translates what you type, say or photograph into **casual** (タメ口) or **polite** (です・ます)
Japanese, or both side by side. Paste or photograph Japanese and you get the English, how formal
the original is, and a suggested reply. It runs as a web page and as an Android app.

- The parts that make a sentence casual or polite are highlighted.
- Each result has the reading, romaji, a literal meaning, a word list, Copy and 🔊 Listen (with a slow mode).
- 🎤 Speak lets you talk instead of typing, in English or Japanese.
- **Dialect**: Standard (標準語), Osaka-ben (大阪弁) or Kyoto-ben (京都弁), combined with casual or polite.
  The Learn tab has an Osaka/Kyoto cheat sheet. The app remembers your last formality and dialect.
- The **📖 Learn** tab has a casual-vs-polite tense chart for verbs, adjectives and nouns.

## Translation engines (Settings)
| Engine | Cost | Casual/polite, readings, words | Photos |
|---|---|---|---|
| Claude (default) | Paid, key from console.anthropic.com | Yes | Yes |
| Google Gemini | Free tier, key from aistudio.google.com | Yes | Yes |
| ChatGPT (OpenAI) or compatible | Paid; or point it at Groq / OpenRouter | Yes | If the model supports images |
| Basic (no AI) | Free, no key | No, one plain translation | No |

The app ships with no key inside it. On first launch it asks each person for their own Claude key,
which is stored only on their device and sent only to the engine they picked.

## Run it
```
npm install
npm run build      # bundles src/ into docs/
npm run serve      # open the printed address
```
`docs/` is committed, so GitHub Pages can serve it: Settings → Pages → this branch → `/docs`.

## Android app
```
npm run android                      # build the web part and copy it into android/
cd android && ./gradlew assembleDebug
```
The APK lands in `android/app/build/outputs/apk/debug/`. You need the Android SDK (`ANDROID_HOME`)
and JDK 21. For Google Play you need a signed release bundle: `./gradlew bundleRelease` with your
own signing key.

## Just want the prompt?
[`PROMPT.md`](PROMPT.md) is a standalone prompt you can paste into Claude or a Claude Project.

## Files
- `src/providers.js`: the four translation engines
- `src/voice.js`: speech recognition and playback (native in the Android app, Web Speech in browsers)
- `src/prompt.js`: system prompt and JSON output schema for the AI engines
- `src/learn.js`: tense chart data
- `src/app.js`, `src/index.html`, `src/style.css`: the page
- `android/`: Capacitor Android project
- `store/icon-512.png`: app icon at the size Google Play asks for
