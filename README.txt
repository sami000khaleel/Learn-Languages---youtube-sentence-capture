Language Sentence Trainer — computer-voice-only update

This update removes the original-audio playback feature completely. It keeps
computer voice playback for saved sentences and listening practice.

Files to replace in your existing extension source folder:
- app.js
- app.css
- app.html
- audio.js
- i18n.js
- store.js

Then open chrome://extensions, click Reload for the extension, and refresh any
YouTube tab where the caption overlay is running.

What changed:
- Removed the Original audio button from saved sentence cards.
- Removed the YouTube-opening player/dock and its URL-generation code.
- Removed the original-vs-computer audio choice from listening practice.
- Listening practice now always uses the computer voice.
- Kept the computer-voice button and browser speech-synthesis implementation.
- Removed the obsolete audio setting from the default settings.
- Existing saved sentences, words, translations, and caption settings are not
  deleted. Any old audio preference values are ignored.

The browser's installed voices are still required for computer voice playback.
