// Card game logic (no page code in here, so it can be tested on its own).
globalThis.GSTGame = (() => {
  // the harder a word is rated, the more often it shows up
  const WEIGHTS = { 1: 1, 2: 3, 3: 6 };
  const weight = (w) => WEIGHTS[w.difficulty] ?? WEIGHTS[2];
  const norm = (s) => String(s || '').trim().toLowerCase();

  // words that can be played: words of the language being learned (old items are German), with a translation in the chosen language
  const pool = (words, lang, learn = 'de') =>
    words.filter((w) => w.lang === lang && (w.learn || 'de') === learn && norm(w.translation));
  const canPlay = (words) => words.length >= 2;

  function shuffle(a, rng = Math.random) {
    const x = [...a];
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  function pickWord(words, rng = Math.random, avoidId = null) {
    const list = avoidId && words.length > 1 ? words.filter((w) => w.id !== avoidId) : words;
    const total = list.reduce((s, w) => s + weight(w), 0);
    let r = rng() * total;
    for (const w of list) {
      r -= weight(w);
      if (r < 0) return w;
    }
    return list[list.length - 1];
  }

  // direction: 'de2tr' (the learned language shown), 'tr2de' (own language shown) or 'mixed' (random each time)
  function makeQuestion(words, word, direction = 'mixed', rng = Math.random) {
    const dir = direction === 'mixed' ? (rng() < 0.5 ? 'de2tr' : 'tr2de') : direction;
    const answerOf = (w) => (dir === 'de2tr' ? w.translation : w.word);
    const correct = answerOf(word);
    const seen = new Set([norm(correct)]);
    const distractors = [];
    for (const w of shuffle(words.filter((x) => x.id !== word.id), rng)) {
      const a = answerOf(w);
      if (!norm(a) || seen.has(norm(a))) continue;
      // two words can share a translation: do not offer the other one as a wrong answer
      if (dir === 'tr2de' && norm(w.translation) === norm(word.translation)) continue;
      seen.add(norm(a));
      distractors.push(a);
      if (distractors.length === 3) break;
    }
    const options = shuffle([correct, ...distractors], rng);
    return {
      dir,
      wordId: word.id,
      prompt: dir === 'de2tr' ? word.word : word.translation,
      correct,
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  // ---- listening game: sentences ----
  // sentences of the language being learned; one you missed (pressed "Again") comes up more often
  const listenPool = (sentences, learn = 'de') => sentences.filter((s) => (s.learn || 'de') === learn && norm(s.text));
  function listenWeight(s) {
    const missed = s.missed || 0;
    const got = s.got || 0;
    if (missed > got) return 4;
    return missed > 0 ? 2 : 1;
  }
  function pickSentence(list, rng = Math.random, avoidId = null) {
    const cand = avoidId && list.length > 1 ? list.filter((s) => s.id !== avoidId) : list;
    const total = cand.reduce((a, s) => a + listenWeight(s), 0);
    let r = rng() * total;
    for (const s of cand) {
      r -= listenWeight(s);
      if (r < 0) return s;
    }
    return cand[cand.length - 1];
  }

  return { WEIGHTS, pool, canPlay, pickWord, makeQuestion, shuffle, listenPool, listenWeight, pickSentence };
})();
