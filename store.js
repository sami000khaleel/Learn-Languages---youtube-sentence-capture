// Shared by the video script and the library page: settings, saved sentences, saved words.
// Everything lives in chrome.storage.local; the library page can export it as .json / .csv files.
globalThis.GSTStore = (() => {
  // the language the user's browser is set to, when we can translate into it (else English)
  function detectLang() {
    try {
      const full = navigator.language || 'en';
      const base = full.split('-')[0];
      const codes = LANGS.map((l) => l[0]);
      if (codes.includes(full)) return full;
      if (base === 'zh') return 'zh-CN';
      if (base === 'nb' || base === 'nn') return 'no';
      if (codes.includes(base)) return base;
    } catch {}
    return 'en';
  }
  const DEFAULT_SETTINGS = {
    lang: 'en', // language of the interface and the translations (replaced by the browser language below)
    learn: 'de', // the language being learned (the language of the videos)
    de: { size: 100, color: '#ffffff' }, // German line on the video (size in %)
    tr: { size: 100, color: '#ffd54f' }, // translation line on the video
    pos: null, // where the captions sit on the video: {x, y} = centre as a share of the video size; null = default place
    uiScale: 1, // text size of the library page
    game: { direction: 'mixed', count: 10, listenCount: 10 }, // listening practice always uses the computer voice
  };

  // [Google Translate code, name in its own language, English name]
  const LANGS = [
    ['en', 'English', 'English'], ['ar', 'العربية', 'Arabic'], ['tr', 'Türkçe', 'Turkish'],
    ['es', 'Español', 'Spanish'], ['fr', 'Français', 'French'], ['ru', 'Русский', 'Russian'],
    ['uk', 'Українська', 'Ukrainian'], ['fa', 'فارسی', 'Persian'], ['ku', 'Kurdî', 'Kurdish'],
    ['nl', 'Nederlands', 'Dutch'], ['it', 'Italiano', 'Italian'], ['pl', 'Polski', 'Polish'],
    ['pt', 'Português', 'Portuguese'], ['ro', 'Română', 'Romanian'], ['el', 'Ελληνικά', 'Greek'],
    ['sv', 'Svenska', 'Swedish'], ['da', 'Dansk', 'Danish'], ['no', 'Norsk', 'Norwegian'],
    ['fi', 'Suomi', 'Finnish'], ['cs', 'Čeština', 'Czech'], ['sk', 'Slovenčina', 'Slovak'],
    ['hu', 'Magyar', 'Hungarian'], ['bg', 'Български', 'Bulgarian'], ['hr', 'Hrvatski', 'Croatian'],
    ['sr', 'Српски', 'Serbian'], ['sq', 'Shqip', 'Albanian'], ['zh-CN', '中文（简体）', 'Chinese (Simplified)'],
    ['ja', '日本語', 'Japanese'], ['ko', '한국어', 'Korean'], ['hi', 'हिन्दी', 'Hindi'],
    ['ur', 'اردو', 'Urdu'], ['bn', 'বাংলা', 'Bengali'], ['vi', 'Tiếng Việt', 'Vietnamese'],
    ['th', 'ไทย', 'Thai'], ['id', 'Bahasa Indonesia', 'Indonesian'], ['he', 'עברית', 'Hebrew'],
    ['sw', 'Kiswahili', 'Swahili'], ['am', 'አማርኛ', 'Amharic'],
    ['de', 'Deutsch', 'German'], ['ca', 'Català', 'Catalan'], ['lt', 'Lietuvių', 'Lithuanian'], ['lv', 'Latviešu', 'Latvian'],
    ['et', 'Eesti', 'Estonian'], ['sl', 'Slovenščina', 'Slovenian'], ['ms', 'Bahasa Melayu', 'Malay'], ['tl', 'Filipino', 'Filipino'],
    ['af', 'Afrikaans', 'Afrikaans'],
  ];
  const RTL = ['ar', 'fa', 'ur', 'he', 'ku'];
  DEFAULT_SETTINGS.lang = detectLang(); // (LANGS is known from here on)
  const DIFFICULTY = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

  // ---- language helpers ----
  // the main part of a language code, with the old / alternative codes YouTube and Google use mapped together
  const baseLang = (c) => {
    c = String(c || '').toLowerCase().split(/[-_]/)[0];
    return { iw: 'he', in: 'id', nb: 'no', nn: 'no', jw: 'jv' }[c] || c;
  };
  const sameLang = (a, b) => !!a && !!b && baseLang(a) === baseLang(b);
  // a code the browser (speech, word splitting) understands
  const bcp47 = (c) => ({ no: 'nb', 'zh-CN': 'zh-CN', he: 'he', id: 'id' }[c] || c);
  const langEnglish = (code) => (LANGS.find((l) => l[0] === code) || [code, code, code])[2];
  const langNative = (code) => (LANGS.find((l) => l[0] === code) || [code, code, code])[1];
  // languages written without spaces between words
  const NO_SPACES = ['ja', 'zh', 'th'];

  // text -> [{t, w}] ; w = true for the words (to click on), false for spaces / punctuation / numbers
  const _seg = {};
  function tokens(text, lang) {
    text = String(text || '');
    const key = bcp47(lang || 'en');
    let seg = _seg[key];
    if (!seg) {
      try { seg = new Intl.Segmenter(key, { granularity: 'word' }); } catch { seg = new Intl.Segmenter('en', { granularity: 'word' }); }
      _seg[key] = seg;
    }
    const out = [];
    for (const s of seg.segment(text)) out.push({ t: s.segment, w: !!s.isWordLike && /\p{L}/u.test(s.segment) });
    return out;
  }

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
    return out;
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const norm = (w) => String(w || '').trim().toLowerCase();

  function create(area) {
    const get = (keys) => new Promise((res) => area.get(keys, res));
    const set = (obj) => new Promise((res) => area.set(obj, res));
    // one change at a time, so two quick saves cannot overwrite each other
    let queue = Promise.resolve();
    const run = (fn) => {
      const p = queue.then(fn);
      queue = p.catch(() => {});
      return p;
    };
    const list = async (key) => {
      const o = await get(key);
      return Array.isArray(o[key]) ? o[key] : [];
    };

    return {
      async getSettings() {
        const { settings } = await get('settings');
        return merge(DEFAULT_SETTINGS, settings || {});
      },
      setSettings: (patch) =>
        run(async () => {
          const { settings } = await get('settings');
          const next = merge(merge(DEFAULT_SETTINGS, settings || {}), patch);
          await set({ settings: next });
          return next;
        }),

      listSentences: () => list('sentences'),
      addSentence: (s) =>
        run(async () => {
          const items = await list('sentences');
          const dup = items.find((i) => i.videoId === s.videoId && i.text === s.text && Math.abs(i.time - s.time) < 1);
          if (dup) return { added: false, item: dup };
          const item = { id: uid(), savedAt: Date.now(), learn: 'de', ...s };
          await set({ sentences: [item, ...items] });
          return { added: true, item };
        }),
      updateSentence: (id, patch) =>
        run(async () => {
          const items = await list('sentences');
          const i = items.findIndex((x) => x.id === id);
          if (i < 0) return null;
          items[i] = { ...items[i], ...patch };
          await set({ sentences: items });
          return items[i];
        }),
      removeSentence: (id) =>
        run(async () => {
          await set({ sentences: (await list('sentences')).filter((i) => i.id !== id) });
        }),

      listWords: () => list('words'),
      addWord: (w) =>
        run(async () => {
          const items = await list('words');
          const dup = items.find((i) => i.lang === w.lang && (i.learn || 'de') === (w.learn || 'de') && norm(i.word) === norm(w.word));
          if (dup) return { added: false, item: dup };
          const item = { id: uid(), savedAt: Date.now(), learn: 'de', difficulty: 2, correct: 0, wrong: 0, ...w };
          await set({ words: [item, ...items] });
          return { added: true, item };
        }),
      updateWord: (id, patch) =>
        run(async () => {
          const items = await list('words');
          const i = items.findIndex((x) => x.id === id);
          if (i < 0) return null;
          items[i] = { ...items[i], ...patch };
          await set({ words: items });
          return items[i];
        }),
      removeWord: (id) =>
        run(async () => {
          await set({ words: (await list('words')).filter((i) => i.id !== id) });
        }),
    };
  }

  // ---- export ----
  const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function wordsToCsv(words) {
    const head = ['Word', 'Translation', 'Word language', 'Translation language', 'Difficulty', 'Sentence', 'Sentence translation',
      'Video', 'Link', 'Saved on', 'Right answers', 'Wrong answers'];
    const rows = words.map((w) => [
      w.word, w.translation, w.learn || 'de', w.lang, DIFFICULTY[w.difficulty] || '', w.sentenceDe, w.sentenceTr,
      w.videoTitle, w.url, w.savedAt ? new Date(w.savedAt).toISOString().slice(0, 10) : '', w.correct || 0, w.wrong || 0,
    ]);
    // the BOM makes Excel open the file as UTF-8 (umlauts)
    return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  function sentencesToJson(sentences) {
    return JSON.stringify(
      sentences.map((s) => ({
        sentence: s.text, sentenceLanguage: s.learn || 'de', translation: s.translation, translationLanguage: s.lang, video: s.videoTitle,
        link: s.url, timeSeconds: Math.round((s.time || 0) * 10) / 10,
        endSeconds: typeof s.end === 'number' ? Math.round(s.end * 10) / 10 : null,
        savedAt: s.savedAt ? new Date(s.savedAt).toISOString() : null,
      })),
      null,
      2
    );
  }

  return { create, DEFAULT_SETTINGS, LANGS, RTL, DIFFICULTY, NO_SPACES, merge, norm, wordsToCsv, sentencesToJson, baseLang, sameLang, bcp47, langEnglish, langNative, tokens };
})();
