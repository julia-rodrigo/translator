# Casual Japanese Translator 翻訳

A phone-friendly web app that translates what you type, or what you photograph, into
**casual** (タメ口) or **polite** (です・ます) Japanese, or both side by side. Paste or
photograph Japanese and you get the English, how formal the original is, and a suggested reply.

Each result shows the Japanese, hiragana reading, romaji, a literal back-translation, a Copy
button and a 🔊 Listen button (your phone's Japanese voice, with a slow mode). In Chrome you can also tap 🎤 Speak and say it in English or Japanese instead of typing.

## Use it
1. Host the folder anywhere static (GitHub Pages works: Settings → Pages → deploy from this branch),
   or run `npx serve .` locally. It has to be served over http(s); opening `index.html` as a file won't load the modules.
2. Open it on your phone, tap **Settings**, and paste an Anthropic API key
   (from console.anthropic.com). It's saved only in that browser.
3. Pick a formality, type or tap **📷 Take / choose photo**, then **Translate**.

## Just want the prompt?
[`PROMPT.md`](PROMPT.md) is a standalone prompt you can paste into Claude or a Claude Project.
The Claude app can already take photos, so that gets you the same thing without hosting anything.

## Files
- `prompt.js`: system prompt and JSON output schema the app sends
- `app.js`: UI logic and the Claude API call (`claude-opus-5-5`, low effort, structured output)
- `index.html`, `style.css`: the page
