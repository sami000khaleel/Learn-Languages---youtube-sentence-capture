// Interface texts. English is the source; every other language is the English text translated once
// (Google Translate, done by background.js) and cached in chrome.storage.local ("i18n_<language>").
// {name} marks a value that is filled in later. Keep the keys short and the English plain and simple.
globalThis.GSTI18n = (() => {
  const EN = {
    // ---- shared ----
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.smaller': 'Smaller',
    'common.bigger': 'Bigger',
    'common.size': 'Size',
    'common.colour': 'Colour',
    'common.other': 'Other:',
    'common.back': 'Back',
    'common.translating': 'Translating…',
    'common.translationFailed': '(translation failed)',
    'common.meaning': 'Meaning',
    'common.howHard': 'How hard is this word for you?',
    'diff.easy': '🙂 Easy',
    'diff.medium': '😐 Medium',
    'diff.hard': '😣 Hard',
    'color.white': 'White',
    'color.yellow': 'Yellow',
    'color.green': 'Green',
    'color.blue': 'Blue',
    'color.pink': 'Pink',
    'color.orange': 'Orange',
    'text.de': '{learn} text',
    'text.tr': 'Translation text',
    'action.title': 'Open my library',
    'i18n.preparing': 'Preparing your language…',
    'i18n.failed': 'Could not load your language. Showing English for now.',
    'word.to': '{word} → {lang}',
    'word.failed': 'The translation did not work. Check your internet connection, or type the meaning yourself.',
    'word.save': '✓ Save this word',
    'word.typeFirst': 'Please type the meaning first',
    'word.saved': '✓ Word saved',

    // ---- the library page ----
    'app.title': 'My {learn} Library',
    'app.heading': '📖 My {learn} Library',
    'app.loadFail': 'Could not load your data',
    'tabs.aria': 'Sections',
    'tab.sentences': '💬 Sentences',
    'tab.words': '🔤 Words',
    'tab.practice': '🎮 Practice',
    'tab.settings': '⚙️ Settings',

    'sent.title': 'Your saved sentences',
    'sent.emptyTitle': 'Nothing saved yet',
    'sent.step1': 'Open a {learn} video on YouTube.',
    'sent.step2': 'When you hear a sentence you want to keep, press the {key} key.',
    'sent.step3': 'Come back here and tap any word you did not understand.',
    'sent.download': '⬇ Download as file (.json)',
    'sent.hint': '👆 Tap any {learn} word you did not understand. You can then save it for the card game.',
    'sent.lookup': 'Tap to look up this word',
    'sent.watch': '▶ Watch this moment ({time})',
    'sent.delete': '🗑 Delete',
    'sent.confirmDelete': 'Delete this sentence?',
    'sent.deleted': 'Sentence deleted',
    'word.aria': 'Word',
    'word.dup': 'This word is already saved',

    'keys.title': 'Keys to use on YouTube',
    'keys.save': '{key} save this sentence',
    'keys.repeat': '{key} hear it again',
    'keys.prev': '{key} sentence before',
    'keys.next': '{key} next sentence',
    'keys.toggle': '{key} show or hide the text',
    'keys.word': '👆 Click a {learn} word on the video to save it to your words.',
    'keys.drag': '🖱 Drag the black part or the translation to move the text. Right-click it, or use the ⚙ button, for its settings.',

    'words.title': 'Your saved words',
    'words.emptyTitle': 'No words yet',
    'words.emptyText': 'Go to the Sentences tab, tap a word you did not understand, then press “Save this word”.',
    'words.download': '⬇ Download as file (.csv)',
    'words.hint': 'The harder a word is, the more often it comes up in the game.',
    'words.stats': 'Right: {right} · Wrong: {wrong}',
    'words.confirmDelete': 'Delete the word “{word}”?',
    'words.deleted': 'Word deleted',

    'prac.title': 'Practice your words',
    'prac.needTitle': 'You need at least 2 saved words',
    'prac.haveOne': 'You have 1 word with {lang} meanings.',
    'prac.haveMany': 'You have {n} words with {lang} meanings.',
    'prac.otherOne': '(1 more word is saved with another language. You can change the language in Settings.)',
    'prac.otherMany': '({n} more words are saved with another language. You can change the language in Settings.)',
    'prac.saveFirst': 'Save words from your sentences first.',
    'prac.goSentences': 'Go to my sentences',
    'prac.intro': 'Guess the meaning of your saved words. You have {n} words. Words you rated Hard come up most often.',
    'prac.see': 'What do you want to see?',
    'prac.both': '🔀 Both ways',
    'prac.de2tr': '{learn} → {lang}',
    'prac.tr2de': '{lang} → {learn}',
    'prac.howMany': 'How many questions?',
    'prac.start': '▶ Start',
    'prac.finished': 'Finished!',
    'prac.great': '🎉 Great job!',
    'prac.good': '👍 Good, keep going!',
    'prac.keep': '💪 Keep practising, it gets easier!',
    'prac.again': '↻ Play again',
    'prac.q': 'Question {n} of {total}',
    'prac.askDe': 'What does this {learn} word mean in {lang}?',
    'prac.askTr': 'How do you say this in {learn}?',
    'prac.correct': '✓ Correct!',
    'prac.wrong': '✗ Not quite',
    'prac.answerIs': 'The answer is: {answer}',
    'prac.howHardWord': 'How hard is this word?',
    'prac.score': 'See my score',
    'prac.next': 'Next →',
    'prac.enter': 'or press Enter',
    'prac.tip': 'Tip: you can also press the keys 1, 2, 3 or 4.',
    'prac.stop': 'Stop game',

    'set.title': 'Settings',
    'set.langTitle': '🌍 My language',
    'set.langText': 'Everything is shown in this language, and the sentences and words you learn are translated into it.',
    'set.learnTitle': '📚 The language I am learning',
    'set.learnText': 'The videos you watch are in this language. The sentences and words you save are kept for it.',
    'set.learnAria': 'The language I am learning',
    'set.learnNow': 'You are now learning {learn}',
    'lib.hidden': '{n} saved items in other languages are hidden. Change the language you are learning in Settings to see them.',
    'set.langAria': 'My language',
    'set.langNow': 'Your language is now {lang}',
    'set.previewTitle': '👀 How the text looks on the video',
    'set.previewSample': 'I wanted to know how it works.',
    'set.previewAria': 'Preview',
    'set.customColour': 'Custom colour',
    'set.uiTitle': '🔎 Text size of this page',
    'set.filesTitle': '💾 My files',
    'set.filesText': 'Everything is stored in your browser. You can also download it.',
    'set.dlSentences': '⬇ Sentences (.json)',
    'set.dlWords': '⬇ Words (.csv)',
    'set.noSentences': 'No saved sentences yet',
    'set.noWords': 'No saved words yet',
    'set.reset': 'Reset settings',
    'set.confirmReset': 'Put all settings back to normal? Your saved sentences and words are kept.',
    'set.resetDone': 'Settings reset',

    // ---- audio and the listening game ----
    'audio.voice': '🔊 Voice',
    'audio.voiceTitle': 'Hear a computer voice read the sentence',
    'audio.noVoice': 'No {learn} computer voice is installed on this device.',
    'audio.noSpeech': 'This browser cannot read text aloud.',
    'prac.modeAria': 'Which game?',
    'prac.modeWords': '🔤 Word game',
    'prac.modeListen': '🎧 Listening game',
    'listen.title': 'Listening practice',
    'listen.needTitle': 'You need at least 1 saved sentence',
    'listen.needText': 'While watching a {learn} video, press {key} to save a sentence. Then come back here.',
    'listen.intro': 'You hear a sentence. Try to understand it, then press “Show” to check. You have {n} sentences. The ones you missed come back more often.',
    'listen.howMany': 'How many sentences?',
    'listen.q': 'Sentence {n} of {total}',
    'listen.question': 'Listen. What is being said?',
    'listen.play': '▶ Listen',
    'listen.replay': '🔁 Hear it again',
    'listen.show': '👁 Show the sentence',
    'listen.got': '✓ I understood it',
    'listen.miss': '↻ Again later',
    'listen.tip': 'Keys: Enter = show, R = hear again, 1 = understood, 2 = again later.',
    'listen.result': '{got} of {total} understood',

    // ---- on the video ----
    'v.loading': 'Loading the {learn} transcript…',
    'v.noLearn': 'This video has no {learn} subtitles.',
    'v.failed': 'Could not load the {learn} transcript ({reason}). Try the CC button once.',
    'v.noSentence': 'No sentence to save yet',
    'v.sentenceSaved': '✓ Sentence saved',
    'v.sentenceDup': 'This sentence is already saved',
    'v.saveFailed': 'Could not save (reload the page once)',
    'v.wordUpdated': '✓ Word updated',
    'v.wordDup': 'Already in your words',
    'v.boxTip': 'Drag to move · ⚙ or right-click for settings',
    'v.wordTip': 'Click a word to save it',
    'm.title': 'Caption settings',
    'm.tip': 'Tip: drag the black part or the translation to move the text.',
    'm.translateInto': 'My language',
    'm.learn': 'The language I am learning',
    'm.reset': '↺ Put the text back in its usual place',
    'm.library': '📖 Open my library',
    'w.aria': 'Save a word',
    'w.already': '✓ Already in your words',
    'w.failed': 'The translation did not work. You can type the meaning yourself.',
    'w.update': '✓ Update this word',
  };

  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  // changes whenever an English text changes, so old cached translations are not reused
  const VERSION = hash(JSON.stringify(EN));

  let lang = 'en';
  let dict = {};

  const raw = (key) => (dict[key] !== undefined ? dict[key] : EN[key] !== undefined ? EN[key] : key);

  // {learn} is always the name of the language being learned, written in the interface language
  let learnCode = 'de';
  const learnName = () => {
    const code = String(learnCode).split('-')[0];
    for (const l of [lang, 'en']) {
      try {
        const n = new Intl.DisplayNames([l], { type: 'language' }).of(code);
        if (n && n !== code) return n;
      } catch {}
    }
    return code;
  };
  const setLearn = (code) => { learnCode = code || 'de'; };
  // the value for {k}; at the very start of a text a language name gets a capital letter (Spanish: "alemán" -> "Alemán")
  const valueOf = (k, vars, idx) => {
    if (vars && k in vars) return vars[k];
    if (k !== 'learn') return null;
    const n = learnName();
    return idx === 0 ? n.charAt(0).toLocaleUpperCase(lang) + n.slice(1) : n;
  };
  // text with {name} values filled in
  const t = (key, vars) =>
    raw(key).replace(/\{(\w+)\}/g, (m, k, idx) => {
      const v = valueOf(k, vars, idx);
      return v === null ? m : String(v);
    });
  // same, but values may be page elements (for example a <kbd>): returns a list of strings / nodes
  const tn = (key, vars) => {
    const str = raw(key);
    const out = [];
    let last = 0;
    str.replace(/\{(\w+)\}/g, (m, k, idx) => {
      const v = valueOf(k, vars, idx);
      out.push(str.slice(last, idx), v === null ? m : v);
      last = idx + m.length;
      return m;
    });
    out.push(str.slice(last));
    return out.filter((x) => x !== '');
  };

  const getCached = (code) =>
    new Promise((res) => chrome.storage.local.get('i18n_' + code, (o) => res((o && o['i18n_' + code]) || null)));

  // Make `code` the interface language. Resolves true when its texts are ready (English is always ready).
  async function load(code) {
    lang = code || 'en';
    dict = {};
    if (lang === 'en') return true;
    const want = lang;
    let c = await getCached(want);
    if (!(c && c.v === VERSION && c.s)) {
      let res = null;
      try { res = await chrome.runtime.sendMessage({ type: 'ui-translate', lang: want, strings: EN, version: VERSION }); } catch {}
      c = res && res.ok && res.strings ? { s: res.strings } : null;
    }
    if (lang !== want) return false; // the language changed again while we were waiting
    if (!c) return false;
    dict = c.s;
    return true;
  }

  return { EN, VERSION, t, tn, load, setLearn, learnName, get lang() { return lang; } };
})();
