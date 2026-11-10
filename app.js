// The library page: saved sentences, saved words, card game, settings.
// Every text goes through t() / tn() so it appears in the user's own language.
(() => {
  const GS = globalThis.GSTStore;
  const GG = globalThis.GSTGame;
  const I18n = globalThis.GSTI18n;
  const A = globalThis.GSTAudio;
  const { t, tn } = I18n;
  const Store = GS.create(chrome.storage.local);

  const $title = document.getElementById('title');
  const $view = document.getElementById('view');
  const $tabs = document.getElementById('tabs');
  const $toast = document.getElementById('toast');

  const state = {
    tab: 'sentences',
    settings: GS.merge(GS.DEFAULT_SETTINGS, {}),
    sentences: [],
    words: [],
    open: null, // the word panel that is open under a sentence
    sentenceTranslations: new Map(), // translations cached by sentence ID + target language
    sentenceTranslationPending: new Set(),
    mode: 'words', // practice: 'words' (card game) or 'listen' (listening game)
  };
  let game = null; // the running card game
  let lgame = null; // the running listening game

  // ---------- small helpers ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }
  // a language's name written in that language (what the user recognises)
  const langLabel = (code) => (GS.LANGS.find((l) => l[0] === code) || [code, code, code])[1];
  const dirOf = (code) => (GS.RTL.includes(code) ? 'rtl' : 'ltr');
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  // everything on this page belongs to the language being learned; items saved for other languages are kept but hidden
  const learn = () => state.settings.learn || 'de';
  const mySentences = () => state.sentences.filter((s) => (s.learn || 'de') === learn());
  const myWords = () => state.words.filter((w) => (w.learn || 'de') === learn());
  const hiddenCount = () => state.sentences.length - mySentences().length + state.words.length - myWords().length;
  const hiddenNote = () => (hiddenCount() ? h('p', { class: 'muted' }, t('lib.hidden', { n: hiddenCount() })) : null);
  const savedWord = (w) => myWords().some((x) => GS.norm(x.word) === GS.norm(w));
  const kbd = (k) => h('kbd', null, k);

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.style.display = 'none'; }, 2600);
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const translateWord = (text) =>
    chrome.runtime
      .sendMessage({ type: 'translate', text, sl: learn(), tl: state.settings.lang })
      .then((r) => (r && r.text ? String(r.text).trim() : ''));

  // A saved sentence may have been translated into a different native language.
  // Translate it on demand and cache each target language independently.
  function sentenceTranslationKey(s, target = state.settings.lang) {
    return `${s.id}|${target}`;
  }

  const sentenceTranslationQueue = [];
  let sentenceTranslationWorkers = 0;

  function runSentenceTranslationQueue() {
    while (sentenceTranslationWorkers < 4 && sentenceTranslationQueue.length) {
      const job = sentenceTranslationQueue.shift();
      // Drop obsolete queued work after the user changes their native language.
      if (job.target !== state.settings.lang) {
        state.sentenceTranslationPending.delete(job.key);
        continue;
      }
      sentenceTranslationWorkers++;
      chrome.runtime.sendMessage({
        type: 'translate', text: job.sentence.text, sl: job.sentence.learn || 'de', tl: job.target,
      })
        .then(async (r) => {
          const translated = r && r.text ? String(r.text).trim() : '';
          if (!translated) throw new Error('Empty translation');
          state.sentenceTranslations.set(job.key, translated);
          // Persist the latest selected language, without allowing a stale request
          // to overwrite a newer language choice.
          if (state.settings.lang === job.target) {
            job.sentence.translation = translated;
            job.sentence.lang = job.target;
            await Store.updateSentence(job.sentence.id, { translation: translated, lang: job.target });
            if (state.tab === 'sentences' || (state.tab === 'practice' && state.mode === 'listen')) render();
          }
        })
        .catch((e) => console.warn('[GST] sentence translation failed', e))
        .finally(() => {
          state.sentenceTranslationPending.delete(job.key);
          sentenceTranslationWorkers--;
          runSentenceTranslationQueue();
        });
    }
  }

  function requestSentenceTranslation(s, target) {
    const key = sentenceTranslationKey(s, target);
    if (state.sentenceTranslations.has(key) || state.sentenceTranslationPending.has(key)) return;
    state.sentenceTranslationPending.add(key);
    sentenceTranslationQueue.push({ key, sentence: s, target });
    runSentenceTranslationQueue();
  }

  function sentenceTranslation(s) {
    const target = state.settings.lang;
    if (s.lang === target && s.translation) return s.translation;
    const key = sentenceTranslationKey(s, target);
    if (state.sentenceTranslations.has(key)) return state.sentenceTranslations.get(key);
    requestSentenceTranslation(s, target);
    return '…';
  }

  function seg(options, current, onPick, attrName) {
    return h(
      'div',
      { class: 'seg', role: 'group' },
      options.map(([value, label]) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(String(current) === String(value)),
          [attrName || 'data-v']: value,
          onclick: () => onPick(value),
        }, label)
      )
    );
  }
  const diffOptions = () => [[1, t('diff.easy')], [2, t('diff.medium')], [3, t('diff.hard')]];

  function keysCard() {
    return h('div', { class: 'card' },
      h('h3', null, t('keys.title')),
      h('p', null, tn('keys.save', { key: kbd('W') })),
      h('p', null, tn('keys.repeat', { key: kbd('S') })),
      h('p', null, tn('keys.prev', { key: kbd('A') })),
      h('p', null, tn('keys.next', { key: kbd('D') })),
      h('p', null, tn('keys.toggle', { key: kbd('C') })),
      h('p', null, t('keys.word')),
      h('p', null, t('keys.drag'))
    );
  }

  // ---------- language of this page ----------
  // left-to-right or right-to-left, page title, heading
  function applyLangChrome() {
    const lang = state.settings.lang;
    I18n.setLearn(learn());
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    document.title = t('app.title');
    $title.textContent = t('app.heading');
    $tabs.setAttribute('aria-label', t('tabs.aria'));
  }

  let langRun = 0;
  // load the texts of the chosen language, then draw everything again
  async function applyLang() {
    const run = ++langRun;
    const lang = state.settings.lang;
    const slow = lang !== 'en' ? setTimeout(() => toast(t('i18n.preparing')), 500) : null;
    const ok = await I18n.load(lang);
    clearTimeout(slow);
    if (run !== langRun) return;
    applyLangChrome();
    renderTabs();
    render();
    if (!ok && lang !== 'en') toast(t('i18n.failed'));
  }

  // ---------- tabs ----------
  const TABS = ['sentences', 'words', 'practice', 'settings'];
  function renderTabs() {
    $tabs.replaceChildren(
      ...TABS.map((id) => {
        const n = id === 'sentences' ? mySentences().length : id === 'words' ? myWords().length : null;
        return h('button', {
          type: 'button', role: 'tab', 'aria-selected': String(state.tab === id),
          onclick: () => go(id),
        }, t('tab.' + id), n ? h('span', { class: 'n' }, ` (${n})`) : null);
      })
    );
  }
  function go(tab) {
    if (tab !== state.tab) { state.open = null; }
    state.tab = tab;
    renderTabs();
    render(false);
  }

  function render(keepScroll = true) {
    const y = window.scrollY;
    document.documentElement.style.setProperty('--ui', String(state.settings.uiScale || 1));
    const view = { sentences: viewSentences, words: viewWords, practice: viewPractice, settings: viewSettings }[state.tab]();
    $view.replaceChildren(view);
    window.scrollTo(0, keepScroll ? y : 0);
  }

  // ---------- saved sentences ----------
  function viewSentences() {
    const box = h('div');
    const list = mySentences();
    if (!list.length) {
      box.append(
        h('h2', null, t('sent.title')),
        h('div', { class: 'card' },
          h('h3', null, t('sent.emptyTitle')),
          h('ol', { class: 'steps' },
            h('li', null, t('sent.step1')),
            h('li', null, tn('sent.step2', { key: kbd('W') })),
            h('li', null, t('sent.step3')))),
        keysCard(),
        hiddenNote()
      );
      return box;
    }
    box.append(
      h('div', { class: 'bar' },
        h('h2', null, t('sent.title')),
        h('button', {
          class: 'btn secondary small', type: 'button',
          onclick: () => download(`sentences-${learn()}-${today()}.json`, GS.sentencesToJson(list), 'application/json'),
        }, t('sent.download'))),
      h('p', { class: 'hint' }, t('sent.hint'))
    );
    for (const s of list) box.append(sentenceCard(s));
    box.append(hiddenNote());
    return box;
  }

  function sentenceCard(s) {
    const line = h('p', { class: 'de', lang: learn(), dir: dirOf(learn()) },
      GS.tokens(s.text, learn()).map((tk) => {
        if (!tk.w) return tk.t;
        const p = tk.t;
        const isOpen = state.open && state.open.sid === s.id && GS.norm(state.open.word) === GS.norm(p);
        return h('button', {
          type: 'button',
          class: 'w' + (savedWord(p) ? ' saved' : ''),
          title: t('sent.lookup'),
          'aria-expanded': String(!!isOpen),
          onclick: () => lookup(s, p),
        }, p);
      })
    );
    const card = h('div', { class: 'card' },
      line,
      h('div', { class: 'row audio' },
        h('button', { class: 'btn secondary small', type: 'button', title: t('audio.voiceTitle'), onclick: () => playVoice(s) }, t('audio.voice'))),
      h('p', { class: 'tr', dir: dirOf(state.settings.lang), lang: state.settings.lang }, sentenceTranslation(s)),
      h('p', { class: 'src' },
        s.videoTitle ? `${s.videoTitle} · ` : '',
        s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, t('sent.watch', { time: fmtTime(s.time) })) : null,
        s.lang && s.lang !== state.settings.lang ? h('span', { class: 'lang-tag' }, ` ${langLabel(s.lang)}`) : null
      )
    );
    if (state.open && state.open.sid === s.id) card.append(wordPanel(s));
    card.append(
      h('div', { class: 'row' },
        h('span', { class: 'grow' }),
        h('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => {
            if (!confirm(t('sent.confirmDelete'))) return;
            await Store.removeSentence(s.id);
            if (state.open && state.open.sid === s.id) state.open = null;
            await reload();
            toast(t('sent.deleted'));
          },
        }, t('sent.delete')))
    );
    return card;
  }

  function lookup(s, rawWord) {
    const word = rawWord.replace(/^[-'’]+|[-'’]+$/g, '');
    if (!word) return;
    if (state.open && state.open.sid === s.id && GS.norm(state.open.word) === GS.norm(word)) {
      state.open = null; // tapping the same word again closes it
      return render();
    }
    const mine = { sid: s.id, word, translation: '', difficulty: 2, loading: true, error: false };
    state.open = mine;
    render();
    translateWord(word)
      .then((tr) => { mine.translation = tr; mine.error = !tr; })
      .catch(() => { mine.error = true; })
      .finally(() => {
        mine.loading = false;
        if (state.open === mine) render();
      });
  }

  function wordPanel(s) {
    const o = state.open;
    const panel = h('div', { class: 'panel', role: 'region', 'aria-label': t('word.aria') });
    panel.append(h('div', { class: 'pw' }, tn('word.to', { word: h('b', { lang: learn(), dir: dirOf(learn()) }, o.word), lang: langLabel(state.settings.lang) })));
    if (o.loading) {
      panel.append(h('p', null, t('common.translating')));
    } else {
      if (o.error) {
        panel.classList.add('err');
        panel.append(h('p', null, t('word.failed')));
      }
      const input = h('input', {
        type: 'text', value: o.translation, 'aria-label': t('common.meaning'), placeholder: t('common.meaning'),
        dir: dirOf(state.settings.lang), lang: state.settings.lang,
        style: 'width:100%;min-height:3.2rem;padding:.4rem .8rem;border:2px solid #9aa5b1;border-radius:12px;font-size:1.2rem',
        oninput: (e) => { o.translation = e.target.value; },
      });
      panel.append(input);
      panel.append(h('p', { class: 'lbl', style: 'margin:.8rem 0 .3rem;font-weight:700' }, t('common.howHard')));
      panel.append(seg(diffOptions(), o.difficulty, (d) => { o.difficulty = Number(d); render(); }, 'data-d'));
      panel.append(
        h('div', { class: 'row' },
          h('button', {
            class: 'btn', type: 'button',
            onclick: async () => {
              const meaning = (o.translation || '').trim();
              if (!meaning) { toast(t('word.typeFirst')); input.focus(); return; }
              const res = await Store.addWord({
                word: o.word, translation: meaning, lang: state.settings.lang, learn: learn(), difficulty: o.difficulty,
                sentenceDe: s.text, sentenceTr: sentenceTranslation(s), videoTitle: s.videoTitle || '', url: s.url || '',
              });
              state.open = null;
              await reload();
              toast(res.added ? t('word.saved') : t('word.dup'));
            },
          }, t('word.save')),
          h('button', { class: 'btn secondary', type: 'button', onclick: () => { state.open = null; render(); } }, t('common.cancel')))
      );
    }
    requestAnimationFrame(() => panel.scrollIntoView({ block: 'nearest' }));
    return panel;
  }

  // ---------- saved words ----------
  function viewWords() {
    const box = h('div');
    const list = myWords();
    if (!list.length) {
      box.append(
        h('h2', null, t('words.title')),
        h('div', { class: 'card' },
          h('h3', null, t('words.emptyTitle')),
          h('p', null, t('words.emptyText'))),
        hiddenNote()
      );
      return box;
    }
    box.append(
      h('div', { class: 'bar' },
        h('h2', null, t('words.title')),
        h('button', {
          class: 'btn secondary small', type: 'button',
          onclick: () => download(`words-${learn()}-${today()}.csv`, GS.wordsToCsv(list), 'text/csv;charset=utf-8'),
        }, t('words.download'))),
      h('p', { class: 'hint' }, t('words.hint'))
    );
    for (const w of list) {
      box.append(
        h('div', { class: 'wrow' },
          h('div', { class: 'wmain' },
            h('span', { class: 'wde', lang: learn(), dir: dirOf(learn()) }, w.word),
            h('span', { class: 'arrow' }, '→'),
            h('span', { class: 'wtr', dir: dirOf(w.lang), lang: w.lang }, w.translation),
            h('span', { class: 'lang-tag' }, langLabel(w.lang))),
          seg(diffOptions(), w.difficulty, async (d) => {
            await Store.updateWord(w.id, { difficulty: Number(d) });
            await reload();
          }, 'data-d'),
          h('div', { class: 'row' },
            h('span', { class: 'stats grow' }, t('words.stats', { right: w.correct || 0, wrong: w.wrong || 0 })),
            h('button', {
              class: 'btn danger small', type: 'button',
              onclick: async () => {
                if (!confirm(t('words.confirmDelete', { word: w.word }))) return;
                await Store.removeWord(w.id);
                await reload();
                toast(t('words.deleted'));
              },
            }, t('sent.delete'))))
      );
    }
    box.append(hiddenNote());
    return box;
  }

  // ---------- practice (card game) ----------
  function viewPractice() {
    const lang = state.settings.lang;
    const pool = GG.pool(state.words, lang, learn());
    const box = h('div');
    box.append(
      h('div', { class: 'field', role: 'group', 'aria-label': t('prac.modeAria') },
        seg([['words', t('prac.modeWords')], ['listen', t('prac.modeListen')]], state.mode, (m) => {
          state.mode = m; game = null; lgame = null; A.stopSpeaking(); render(false);
        }, 'data-mode'))
    );
    if (state.mode === 'listen') return viewListen(box);
    box.append(h('h2', null, t('prac.title')));

    if (!GG.canPlay(pool)) {
      const other = state.words.length - pool.length;
      box.append(
        h('div', { class: 'card' },
          h('h3', null, t('prac.needTitle')),
          h('p', null, pool.length === 1 ? t('prac.haveOne', { lang: langLabel(lang) }) : t('prac.haveMany', { n: pool.length, lang: langLabel(lang) })),
          other > 0 ? h('p', { class: 'muted' }, other === 1 ? t('prac.otherOne') : t('prac.otherMany', { n: other })) : null,
          h('p', null, t('prac.saveFirst')),
          h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => go('sentences') }, t('prac.goSentences'))))
      );
      game = null;
      return box;
    }

    if (!game) {
      const g = state.settings.game;
      box.append(
        h('div', { class: 'card' },
          h('p', null, t('prac.intro', { n: pool.length })),
          h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('prac.see')),
            seg([
              ['mixed', t('prac.both')],
              ['de2tr', t('prac.de2tr', { lang: langLabel(lang) })],
              ['tr2de', t('prac.tr2de', { lang: langLabel(lang) })],
            ], g.direction, async (v) => { state.settings = await Store.setSettings({ game: { direction: v } }); render(); })),
          h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('prac.howMany')),
            seg([[5, '5'], [10, '10'], [20, '20']], g.count, async (v) => { state.settings = await Store.setSettings({ game: { count: Number(v) } }); render(); })),
          h('div', { class: 'row' }, h('button', { class: 'btn big', type: 'button', onclick: startGame }, t('prac.start'))))
      );
      return box;
    }

    if (game.finished) {
      const ratio = game.score / game.total;
      box.append(
        h('div', { class: 'card center' },
          h('p', { class: 'qlabel' }, t('prac.finished')),
          h('div', { class: 'score', dir: 'ltr' }, `${game.score} / ${game.total}`),
          h('p', null, ratio >= 0.8 ? t('prac.great') : ratio >= 0.5 ? t('prac.good') : t('prac.keep')),
          h('div', { class: 'row', style: 'justify-content:center' },
            h('button', { class: 'btn big', type: 'button', onclick: startGame }, t('prac.again')),
            h('button', { class: 'btn secondary', type: 'button', onclick: () => { game = null; render(); } }, t('common.back'))))
      );
      return box;
    }

    const q = game.q;
    const word = state.words.find((w) => w.id === q.wordId) || game.word;
    const answered = game.answered !== null;
    const promptDir = q.dir === 'de2tr' ? dirOf(learn()) : dirOf(lang);
    const optDir = q.dir === 'de2tr' ? dirOf(lang) : dirOf(learn());
    const done = game.asked - (answered ? 0 : 1);

    box.append(
      h('div', { class: 'card' },
        h('p', { class: 'qlabel' }, t('prac.q', { n: game.asked, total: game.total })),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(game.total), 'aria-valuenow': String(done) },
          h('div', { style: `width:${(done / game.total) * 100}%` })),
        h('p', { class: 'qlabel' }, q.dir === 'de2tr' ? t('prac.askDe', { lang: langLabel(lang) }) : t('prac.askTr')),
        h('div', { class: 'prompt', dir: promptDir, lang: q.dir === 'de2tr' ? learn() : lang }, q.prompt),
        h('div', { class: 'opts' },
          q.options.map((opt, i) =>
            h('button', {
              type: 'button',
              class: 'opt' + (answered ? (i === q.correctIndex ? ' right' : i === game.answered ? ' wrong' : '') : ''),
              disabled: answered, dir: optDir, lang: q.dir === 'de2tr' ? lang : learn(),
              onclick: () => answer(i),
            }, h('span', { class: 'k' }, `${i + 1}`), ' ', opt)))
      )
    );

    if (answered) {
      const ok = game.answered === q.correctIndex;
      const fb = h('div', { class: 'card' },
        h('div', { class: 'verdict ' + (ok ? 'good' : 'bad') }, ok ? t('prac.correct') : t('prac.wrong')),
        ok ? null : h('p', null, tn('prac.answerIs', { answer: h('b', null, q.correct) })),
        h('p', { class: 'muted' }, h('b', { lang: learn(), dir: dirOf(learn()) }, word.word), ' = ', h('span', { dir: dirOf(word.lang) }, word.translation))
      );
      if (word.sentenceDe) {
        const ex = h('div', { class: 'example', lang: learn(), dir: dirOf(learn()) });
        const idx = word.sentenceDe.toLowerCase().indexOf(word.word.toLowerCase());
        if (idx >= 0) ex.append(word.sentenceDe.slice(0, idx), h('mark', null, word.sentenceDe.slice(idx, idx + word.word.length)), word.sentenceDe.slice(idx + word.word.length));
        else ex.append(word.sentenceDe);
        fb.append(ex);
      }
      fb.append(
        h('p', { class: 'lbl', style: 'margin:.8rem 0 .3rem;font-weight:700' }, t('prac.howHardWord')),
        seg(diffOptions(), word.difficulty, async (d) => {
          await Store.updateWord(word.id, { difficulty: Number(d) });
          state.words = await Store.listWords();
          render();
        }, 'data-d'),
        h('div', { class: 'row' },
          h('button', { class: 'btn big', type: 'button', id: 'next', onclick: nextQuestion },
            game.asked >= game.total ? t('prac.score') : t('prac.next')),
          h('span', { class: 'muted' }, t('prac.enter')))
      );
      box.append(fb);
      // on small screens the feedback is below the visible area: bring it into view
      requestAnimationFrame(() => fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    } else {
      box.append(h('p', { class: 'muted' }, t('prac.tip')));
    }
    box.append(h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onclick: () => { game = null; render(); } }, t('prac.stop'))));
    return box;
  }

  function startGame() {
    const g = state.settings.game;
    game = { total: Number(g.count) || 10, asked: 0, score: 0, q: null, word: null, answered: null, lastId: null, finished: false };
    nextQuestion();
  }

  function nextQuestion() {
    if (!game) return;
    if (game.q && game.asked >= game.total) { game.finished = true; return render(); }
    const pool = GG.pool(state.words, state.settings.lang, learn());
    if (!GG.canPlay(pool)) { game = null; return render(); }
    const word = GG.pickWord(pool, Math.random, game.lastId);
    game.word = word;
    game.lastId = word.id;
    game.q = GG.makeQuestion(pool, word, state.settings.game.direction);
    game.answered = null;
    game.asked += 1;
    render(false);
  }

  async function answer(i) {
    if (!game || !game.q || game.answered !== null) return;
    game.answered = i;
    const ok = i === game.q.correctIndex;
    if (ok) game.score += 1;
    render();
    const w = state.words.find((x) => x.id === game.q.wordId);
    if (w) {
      await Store.updateWord(w.id, ok ? { correct: (w.correct || 0) + 1 } : { wrong: (w.wrong || 0) + 1 });
      state.words = await Store.listWords();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (state.tab === 'practice' && state.mode === 'listen' && lgame && lgame.cur && !lgame.finished) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter' && !lgame.shown) { e.preventDefault(); showListen(); }
      else if (k === 'r') { e.preventDefault(); playSentence(lgame.cur); }
      else if (lgame.shown && k === '1') { e.preventDefault(); rateListen(true); }
      else if (lgame.shown && k === '2') { e.preventDefault(); rateListen(false); }
      return;
    }
    if (state.tab !== 'practice' || state.mode !== 'words' || !game || !game.q || game.finished) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target;
    if (tg && (tg.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tg.tagName))) return;
    if (game.answered === null && /^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < game.q.options.length) { e.preventDefault(); answer(i); }
    } else if (game.answered !== null && e.key === 'Enter') {
      e.preventDefault();
      nextQuestion();
    }
  });

  // ---------- playing a sentence with the computer voice ----------
  function playVoice(s) {
    const r = A.speak(s.text, s.learn || 'de', { rate: 1 });
    if (!r.ok) toast(r.reason === 'no-voice' ? t('audio.noVoice') : t('audio.noSpeech'));
    return r.ok;
  }

  // ---------- practice: the listening game ----------
  function viewListen(box) {
    const pool = GG.listenPool(state.sentences, learn());
    box.append(h('h2', null, t('listen.title')));
    if (!pool.length) {
      lgame = null;
      box.append(
        h('div', { class: 'card' },
          h('h3', null, t('listen.needTitle')),
          h('p', null, tn('listen.needText', { key: kbd('W') })),
          h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => go('sentences') }, t('prac.goSentences'))))
      );
      return box;
    }
    const g = state.settings.game;
    if (!lgame) {
      box.append(
        h('div', { class: 'card' },
          h('p', null, t('listen.intro', { n: pool.length })),
          h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('listen.howMany')),
            seg([[5, '5'], [10, '10'], [20, '20']], g.listenCount, async (v) => { state.settings = await Store.setSettings({ game: { listenCount: Number(v) } }); render(); }, 'data-n')),
          h('div', { class: 'row' }, h('button', { class: 'btn big', type: 'button', onclick: startListen }, t('prac.start'))))
      );
      return box;
    }
    if (lgame.finished) {
      const ratio = lgame.got / lgame.total;
      box.append(
        h('div', { class: 'card center' },
          h('p', { class: 'qlabel' }, t('prac.finished')),
          h('div', { class: 'score', dir: 'ltr' }, `${lgame.got} / ${lgame.total}`),
          h('p', null, t('listen.result', { got: lgame.got, total: lgame.total })),
          h('p', null, ratio >= 0.8 ? t('prac.great') : ratio >= 0.5 ? t('prac.good') : t('prac.keep')),
          h('div', { class: 'row', style: 'justify-content:center' },
            h('button', { class: 'btn big', type: 'button', onclick: startListen }, t('prac.again')),
            h('button', { class: 'btn secondary', type: 'button', onclick: () => { lgame = null; A.stopSpeaking(); render(); } }, t('common.back'))))
      );
      return box;
    }

    const s = lgame.cur;
    box.append(
      h('div', { class: 'card center' },
        h('p', { class: 'qlabel' }, t('listen.q', { n: lgame.asked, total: lgame.total })),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(lgame.total), 'aria-valuenow': String(lgame.asked - 1) },
          h('div', { style: `width:${((lgame.asked - 1) / lgame.total) * 100}%` })),
        h('p', { class: 'qlabel' }, t('listen.question')),
        h('div', { class: 'row', style: 'justify-content:center' },
          h('button', { class: 'btn big', type: 'button', id: 'hear', onclick: () => playSentence(s) }, t('listen.play'))))
    );
    if (!lgame.shown) {
      box.append(
        h('div', { class: 'row', style: 'justify-content:center' },
          h('button', { class: 'btn big secondary', type: 'button', id: 'show', onclick: showListen }, t('listen.show'))),
        h('p', { class: 'muted' }, t('listen.tip'))
      );
    } else {
      const fb = h('div', { class: 'card' },
        h('p', { class: 'de', lang: learn(), dir: dirOf(learn()) }, s.text),
        h('p', { class: 'tr', lang: state.settings.lang, dir: dirOf(state.settings.lang) }, sentenceTranslation(s)),
        h('div', { class: 'row' },
          h('button', { class: 'btn secondary small', type: 'button', onclick: () => playSentence(s) }, t('listen.replay'))),
        h('div', { class: 'row' },
          h('button', { class: 'btn big', type: 'button', id: 'got', onclick: () => rateListen(true) }, t('listen.got')),
          h('button', { class: 'btn big secondary', type: 'button', id: 'miss', onclick: () => rateListen(false) }, t('listen.miss')))
      );
      box.append(fb);
      requestAnimationFrame(() => fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
    box.append(h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onclick: () => { lgame = null; A.stopSpeaking(); render(); } }, t('prac.stop'))));
    return box;
  }

  function playSentence(s) {
    playVoice(s);
  }
  function startListen() {
    const g = state.settings.game;
    lgame = { total: Number(g.listenCount) || 10, asked: 0, got: 0, cur: null, shown: false, rated: false, lastId: null, finished: false };
    nextListen();
  }
  function nextListen() {
    if (!lgame) return;
    const pool = GG.listenPool(state.sentences, learn());
    if (!pool.length) { lgame = null; A.stopSpeaking(); return render(); }
    const s = GG.pickSentence(pool, Math.random, lgame.lastId);
    lgame.cur = s;
    lgame.lastId = s.id;
    lgame.shown = false;
    lgame.rated = false;
    lgame.asked += 1;
    render(false);
    playSentence(s); // (still inside the click that started this, so the browser allows the sound)
  }
  function showListen() {
    if (!lgame || lgame.shown) return;
    lgame.shown = true;
    render();
  }
  async function rateListen(ok) {
    if (!lgame || !lgame.shown || lgame.rated) return;
    lgame.rated = true;
    const s = lgame.cur;
    if (ok) lgame.got += 1;
    // store the rating first, so the next sentence is picked with the new weights
    await Store.updateSentence(s.id, ok ? { got: (s.got || 0) + 1 } : { missed: (s.missed || 0) + 1 });
    state.sentences = await Store.listSentences();
    if (!lgame) return; // the game was stopped meanwhile
    if (lgame.asked >= lgame.total) { lgame.finished = true; A.stopSpeaking(); render(false); } else nextListen();
  }

  // the language being learned changed: everything on this page is about the other language now
  async function afterLearnChange() {
    game = null;
    lgame = null;
    state.open = null;
    A.stopSpeaking();
    applyLangChrome();
    renderTabs();
    render(false);
  }

  // ---------- settings ----------
  // "I wanted to know how it works." in some of the languages, for the preview
  const SAMPLES = {
    en: 'I wanted to know how it works.', de: 'Ich wollte wissen, wie es funktioniert.', es: 'Quería saber cómo funciona.',
    fr: 'Je voulais savoir comment ça marche.', it: 'Volevo sapere come funziona.', pt: 'Eu queria saber como funciona.',
    nl: 'Ik wilde weten hoe het werkt.', tr: 'Nasıl çalıştığını bilmek istedim.', ru: 'Я хотел знать, как это работает.',
    pl: 'Chciałem wiedzieć, jak to działa.', ja: 'どう動くのか知りたかった。', ko: '어떻게 작동하는지 알고 싶었어요.',
    zh: '我想知道它是如何运作的。', ar: 'أردت أن أعرف كيف يعمل.', sv: 'Jag ville veta hur det fungerar.',
  };
  const SWATCHES = [
    ['#ffffff', 'white'], ['#ffd54f', 'yellow'], ['#9ae6b4', 'green'],
    ['#7dd3fc', 'blue'], ['#fda4af', 'pink'], ['#fdba74', 'orange'],
  ];

  function viewSettings() {
    const box = h('div');
    const s = state.settings;
    box.append(h('h2', null, t('set.title')));

    // the language being learned
    const optionOf = ([code, native, english], current, other) =>
      h('option', { value: code, selected: code === current, disabled: code === other }, native === english ? english : `${native} — ${english}`);
    const learnSel = h('select', {
      id: 'learn', 'aria-label': t('set.learnAria'),
      onchange: async (e) => {
        state.settings = await Store.setSettings({ learn: e.target.value });
        await afterLearnChange();
        toast(t('set.learnNow'));
      },
    }, GS.LANGS.map((l) => optionOf(l, s.learn, s.lang)));
    box.append(
      h('div', { class: 'card' },
        h('h3', null, t('set.learnTitle')),
        h('p', { class: 'muted' }, t('set.learnText')),
        h('div', { class: 'field' }, learnSel))
    );

    // language of everything + the translations
    const langSel = h('select', {
      id: 'lang', 'aria-label': t('set.langAria'),
      onchange: async (e) => {
        state.settings = await Store.setSettings({ lang: e.target.value });
        await applyLang();
        toast(t('set.langNow', { lang: langLabel(state.settings.lang) }));
      },
    }, GS.LANGS.map((l) => optionOf(l, s.lang, s.learn)));
    box.append(
      h('div', { class: 'card' },
        h('h3', null, t('set.langTitle')),
        h('p', { class: 'muted' }, t('set.langText')),
        h('div', { class: 'field' }, langSel))
    );

    // live preview
    const pde = h('div', { class: 'pde' });
    const ptr = h('div', { class: 'ptr' });
    const preview = h('div', { class: 'preview', 'aria-label': t('set.previewAria') }, pde, ptr);
    function refreshPreview() {
      const cur = state.settings;
      pde.lang = cur.learn; pde.dir = dirOf(cur.learn);
      pde.textContent = SAMPLES[GS.baseLang(cur.learn)] || SAMPLES.en;
      pde.style.color = cur.de.color; pde.style.fontSize = `${(28 * cur.de.size) / 100}px`;
      ptr.style.color = cur.tr.color; ptr.style.fontSize = `${(24 * cur.tr.size) / 100}px`;
      ptr.dir = dirOf(cur.lang);
      ptr.textContent = t('set.previewSample');
    }

    const refreshers = [];
    function styleControl(key, title) {
      const sizeVal = h('span', { class: 'val', dir: 'ltr' });
      const nudge = async (delta) => {
        const cur = Number(state.settings[key].size) || 100;
        const size = Math.min(250, Math.max(60, cur + delta));
        state.settings = await Store.setSettings({ [key]: { size } });
        refreshAll();
      };
      const setColor = async (color) => {
        state.settings = await Store.setSettings({ [key]: { color } });
        refreshAll();
      };
      const swatches = SWATCHES.map(([c, name]) =>
        h('button', { type: 'button', class: 'sw', style: `background:${c}`, 'aria-label': t('color.' + name), title: t('color.' + name), 'data-c': c, 'data-name': name, onclick: () => setColor(c) }));
      const custom = h('input', {
        type: 'color', 'aria-label': `${title} — ${t('set.customColour')}`,
        oninput: (e) => { state.settings[key].color = e.target.value; refreshPreview(); },
        onchange: (e) => setColor(e.target.value),
      });
      const refresh = () => {
        const cur = state.settings[key];
        sizeVal.textContent = `${cur.size}%`;
        for (const b of swatches) b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === String(cur.color).toLowerCase()));
        custom.value = /^#[0-9a-f]{6}$/i.test(cur.color) ? cur.color : '#ffffff';
      };
      refreshers.push(refresh);
      return h('div', { class: 'card', 'data-key': key },
        h('h3', null, title),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('common.size')),
          h('div', { class: 'sizer' },
            h('button', { type: 'button', 'aria-label': t('common.smaller'), onclick: () => nudge(-10) }, '−'),
            sizeVal,
            h('button', { type: 'button', 'aria-label': t('common.bigger'), onclick: () => nudge(10) }, '+'))),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('common.colour')),
          h('div', { class: 'swatches' }, swatches, h('label', { class: 'custom' }, t('common.other') + ' ', custom))));
    }
    const refreshAll = () => { refreshPreview(); refreshers.forEach((f) => f()); };

    box.append(
      h('div', { class: 'card' }, h('h3', null, t('set.previewTitle')), preview),
      styleControl('de', t('text.de')),
      styleControl('tr', t('text.tr'))
    );

    // size of this page
    const uiVal = h('span', { class: 'val', dir: 'ltr' }, `${Math.round((s.uiScale || 1) * 100)}%`);
    const nudgeUi = async (delta) => {
      const cur = state.settings.uiScale || 1;
      const next = Math.round(Math.min(1.6, Math.max(0.9, cur + delta)) * 10) / 10;
      state.settings = await Store.setSettings({ uiScale: next });
      document.documentElement.style.setProperty('--ui', String(next));
      uiVal.textContent = `${Math.round(next * 100)}%`;
    };
    box.append(
      h('div', { class: 'card', 'data-key': 'ui' },
        h('h3', null, t('set.uiTitle')),
        h('div', { class: 'sizer' },
          h('button', { type: 'button', 'aria-label': t('common.smaller'), onclick: () => nudgeUi(-0.1) }, '−'),
          uiVal,
          h('button', { type: 'button', 'aria-label': t('common.bigger'), onclick: () => nudgeUi(0.1) }, '+')))
    );

    // downloads + reset
    box.append(
      h('div', { class: 'card' },
        h('h3', null, t('set.filesTitle')),
        h('p', { class: 'muted' }, t('set.filesText')),
        h('div', { class: 'row' },
          h('button', {
            class: 'btn secondary', type: 'button',
            onclick: () => mySentences().length
              ? download(`sentences-${learn()}-${today()}.json`, GS.sentencesToJson(mySentences()), 'application/json')
              : toast(t('set.noSentences')),
          }, t('set.dlSentences')),
          h('button', {
            class: 'btn secondary', type: 'button',
            onclick: () => myWords().length
              ? download(`words-${learn()}-${today()}.csv`, GS.wordsToCsv(myWords()), 'text/csv;charset=utf-8')
              : toast(t('set.noWords')),
          }, t('set.dlWords'))),
        h('hr'),
        h('button', {
          class: 'btn danger small', type: 'button',
          onclick: async () => {
            if (!confirm(t('set.confirmReset'))) return;
            state.settings = await Store.setSettings({
              lang: GS.DEFAULT_SETTINGS.lang, learn: GS.DEFAULT_SETTINGS.learn, de: { ...GS.DEFAULT_SETTINGS.de }, tr: { ...GS.DEFAULT_SETTINGS.tr },
              pos: null, uiScale: GS.DEFAULT_SETTINGS.uiScale, game: { ...GS.DEFAULT_SETTINGS.game },
            });
            await applyLang();
            await afterLearnChange();
            toast(t('set.resetDone'));
          },
        }, t('set.reset')))
    );
    box.append(keysCard());
    refreshAll();
    return box;
  }

  // ---------- loading ----------
  async function reload() {
    [state.settings, state.sentences, state.words] = await Promise.all([Store.getSettings(), Store.listSentences(), Store.listWords()]);
    renderTabs();
    render();
  }

  // something was saved or changed on YouTube while this page is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let langChanged = false;
    let learnChanged = false;
    if (changes.sentences) state.sentences = changes.sentences.newValue || [];
    if (changes.words) state.words = changes.words.newValue || [];
    if (changes.settings) {
      const prev = state.settings.lang;
      const prevLearn = learn();
      state.settings = GS.merge(GS.DEFAULT_SETTINGS, changes.settings.newValue || {});
      langChanged = state.settings.lang !== prev;
      learnChanged = learn() !== prevLearn;
    }
    if (learnChanged) afterLearnChange();
    if (langChanged) { applyLang(); return; }
    if (learnChanged) return;
    renderTabs();
    // do not disturb the user while typing, answering or editing settings
    const busy = state.open || state.tab === 'settings' || (state.tab === 'practice' && (game || lgame));
    if (!busy) render();
  });

  (async () => {
    try {
      [state.settings, state.sentences, state.words] = await Promise.all([Store.getSettings(), Store.listSentences(), Store.listWords()]);
      applyLangChrome();
      renderTabs();
      render();
      if (state.settings.lang !== 'en') await applyLang(); // draw again in the user's language
    } catch (e) {
      console.error(e);
      $view.replaceChildren(h('div', { class: 'card' }, h('h3', null, t('app.loadFail')), h('p', null, String(e))));
    }
  })();
})();
