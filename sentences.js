globalThis.GST = (() => {
  // Per language (edit these to taste):
  //  abbr  = abbreviations whose full stop does not end a sentence
  //  conj  = connectors that start a new sentence when they follow a comma
  //  and   = the word for "and", which only counts as a connector when one of the words in `next` follows
  //  month = (German) "3. März": the full stop after a number does not end the sentence
  // A language without an entry is simply split at sentence ends and, where long enough, at commas.
  const PROFILES = {
    de: {
      abbr: 'z|B|d|h|u|a|ca|bzw|vgl|ggf|evtl|Nr|Dr|Prof|Str|inkl|bspw|sog|Tel|Abb',
      month: /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?![\p{L}])/u,
      conj: 'und|aber|oder|sondern|denn|doch|jedoch|allerdings|weil|obwohl|damit|sodass',
      and: 'und',
      next: 'ich|du|er|sie|es|wir|ihr|man|dann|jetzt|da|dort|hier|deshalb|deswegen|darum|so|das|dies|heute|also|natürlich|vielleicht|später|zuerst|danach|dabei|was|wie|wer|wo|wann|warum|wieso|weshalb|welche|welcher|welches|wenn|dass|ob',
    },
    en: {
      abbr: 'Mr|Mrs|Ms|Dr|Prof|St|vs|etc|Jr|Sr|Inc|Ltd|No|e\\.g|i\\.e',
      conj: 'and|but|or|so|because|although|though|while|whereas|yet|however',
      and: 'and',
      next: 'I|you|he|she|it|we|they|then|now|there|here|so|this|that|what|how|who|where|when|why|if',
    },
    es: {
      abbr: 'Sr|Sra|Srta|Dr|Dra|etc|pág|núm|Ud|Uds',
      conj: 'y|pero|o|sino|porque|aunque|mientras|así que|sin embargo',
      and: 'y',
      next: 'yo|tú|él|ella|nosotros|ellos|ellas|ahora|entonces|aquí|allí|eso|esto|qué|cómo|quién|dónde|cuándo|por qué|si',
    },
    fr: {
      abbr: 'M|Mme|Mlle|Dr|Pr|etc|cf|env',
      conj: 'et|mais|ou|car|donc|parce que|bien que|alors que|pourtant',
      and: 'et',
      next: 'je|tu|il|elle|on|nous|vous|ils|elles|puis|alors|ici|là|ça|ce|cela|que|comment|qui|où|quand|pourquoi|si',
    },
    it: {
      abbr: 'Sig|Sig\\.ra|Dott|Prof|ecc|pag',
      conj: 'e|ma|o|però|perché|anche se|mentre|quindi|tuttavia',
      and: 'e',
      next: 'io|tu|lui|lei|noi|voi|loro|poi|ora|qui|là|questo|quello|che|come|chi|dove|quando|perché|se',
    },
    pt: {
      abbr: 'Sr|Sra|Dr|Dra|etc|pág',
      conj: 'e|mas|ou|porque|embora|enquanto|então|porém|contudo',
      and: 'e',
      next: 'eu|tu|ele|ela|nós|eles|elas|então|agora|aqui|ali|isso|isto|que|como|quem|onde|quando|porque|se',
    },
    nl: {
      abbr: 'bv|mevr|dhr|enz|bijv|nr|dr',
      conj: 'en|maar|of|want|omdat|hoewel|terwijl|dus|echter',
      and: 'en',
      next: 'ik|jij|je|hij|zij|ze|wij|we|jullie|dan|nu|hier|daar|dit|dat|wat|hoe|wie|waar|wanneer|waarom|als',
    },
  };
  const NO_SPACES = ['ja', 'zh', 'th']; // no spaces between words: clause splitting by word count makes no sense
  const baseOf = (lang) => String(lang || 'de').toLowerCase().split(/[-_]/)[0];
  const profileOf = (lang) => PROFILES[baseOf(lang)] || {};
  const U = '(?![\\p{L}\\p{M}])'; // "the word ends here" (works for letters with accents too)
  const abbrRe = (pr) => (pr.abbr ? new RegExp(`(?:^|[\\s(])(?:${pr.abbr})\\.$`, 'u') : null);

  // seeking with s / a / d lands this many seconds BEFORE the sentence start, so the first word is not cut off
  const LEAD_IN = 0.3;
  // a sentence counts as "current" this much before its start (a bit more than LEAD_IN)
  const TOL = LEAD_IN + 0.05;

  // ---- reading caption data ----
  const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

  // segs: [{txt, off}] ; off = word offset in ms inside the cue, undefined when the format has no word timing
  function makeCue(startMs, durMs, segs) {
    const base = startMs / 1000;
    const timed = segs.some((s) => s.off !== undefined && s.off !== null);
    let raw = '';
    const parts = [];
    for (const sg of segs) {
      const txt = sg.txt || '';
      const lead = (txt.match(/^\s*/) || [''])[0];
      if (timed && txt.trim()) {
        // character position (in the cleaned text) where this word starts
        const pre = (raw + lead).replace(/\s+/g, ' ').replace(/^ /, '');
        parts.push({ pos: pre.length, start: base + (sg.off || 0) / 1000 });
      }
      raw += txt;
    }
    return { start: base, end: (startMs + (durMs || 0)) / 1000, text: clean(raw), parts };
  }

  function cuesFromJson3(data) {
    return (data.events || [])
      .filter((e) => e.segs)
      .map((e) => makeCue(e.tStartMs, e.dDurationMs, e.segs.map((s) => ({ txt: s.utf8, off: s.tOffsetMs }))))
      .filter((c) => c.text);
  }

  // ---- splitting long sentences at connectors (see PROFILES above) ----
  const MIN_WORDS = 3;
  const words = (t) => (t.match(/\S+/g) || []).length;

  // after a comma, a clause of at least this many words (up to the next comma) starts a new sentence;
  // short bits (2-3 words) and list items stay attached
  const MIN_COMMA_CLAUSE = 3;
  const MIN_COMMA_REST = 4;

  // text -> [{offset, text}] ; offset = character position of the piece in the original text
  function splitClauses(text, lang = 'de') {
    if (NO_SPACES.includes(baseOf(lang))) return [{ offset: 0, text }];
    const pr = profileOf(lang);
    const cand = new Map(); // position -> 'conj' | 'comma'
    let m;
    if (pr.conj) {
      const reComma = new RegExp(`,\\s+(?=(?:${pr.conj})${U})`, 'giu');
      while ((m = reComma.exec(text))) cand.set(m.index + m[0].length, 'conj');
    }
    if (pr.and && pr.next) {
      const reUnd = new RegExp(`\\s+(?=${pr.and}\\s+(?:${pr.next})${U})`, 'giu');
      while ((m = reUnd.exec(text))) cand.set(m.index + m[0].length, 'conj');
    }
    const reAnyComma = /,\s+(?=\S)/g;
    while ((m = reAnyComma.exec(text))) {
      const pos = m.index + m[0].length;
      if (!cand.has(pos)) cand.set(pos, 'comma');
    }

    const cuts = [];
    let last = 0;
    for (const pos of [...cand.keys()].sort((a, b) => a - b)) {
      if (pos === last) continue;
      const rest = text.slice(pos);
      // the new sentence (connector included) must have at least MIN_COMMA_REST words
      if (words(text.slice(last, pos)) < MIN_WORDS || words(rest) < MIN_COMMA_REST) continue;
      if (cand.get(pos) === 'comma') {
        const clause = rest.split(',')[0];
        if (words(clause) < MIN_COMMA_CLAUSE) continue;
        // the part before the comma must be clause-sized too, otherwise it is a list item ("..., Eier, Butter und Milch")
        const prevParts = text.slice(last, pos).replace(/,\s*$/, '').split(',');
        if (words(prevParts[prevParts.length - 1]) < MIN_COMMA_CLAUSE) continue;
      }
      cuts.push(pos);
      last = pos;
    }
    const bounds = [0, ...cuts, text.length];
    const out = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      let piece = text.slice(bounds[i], bounds[i + 1]).trim().replace(/,$/, '');
      if (!piece) continue;
      if (i > 0) piece = piece[0].toLocaleUpperCase(lang) + piece.slice(1);
      out.push({ offset: bounds[i], text: piece });
    }
    return out;
  }

  // cues: [{start, end, text, parts?}] in seconds -> [{start, end, text}]   (lang = language of the captions)
  function build(cues, lang = 'de') {
    const pr = profileOf(lang);
    const abbr = abbrRe(pr);
    cues = cues.filter((c) => c.text && !/^\[.*\]$/.test(c.text));
    if (!cues.length) return [];

    // one joined text, plus a map from character position to time.
    // With word timing (auto-captions) every word is a mark; otherwise every cue is one mark.
    const marks = [];
    const cuePos = [];
    let full = '';
    for (const c of cues) {
      if (full) full += ' ';
      const base = full.length;
      cuePos.push(base);
      const parts = c.parts && c.parts.length ? c.parts : [{ pos: 0, start: c.start }];
      parts.forEach((p, i) => {
        const nx = parts[i + 1];
        marks.push({
          pos: base + p.pos,
          endPos: base + (nx ? nx.pos : c.text.length),
          start: p.start,
          end: nx ? nx.start : Math.max(c.end, p.start),
        });
      });
      full += c.text;
    }

    const timeAt = (index) => {
      let k = 0;
      for (let i = 0; i < marks.length; i++) { if (marks[i].pos <= index) k = i; else break; }
      const m = marks[k];
      const frac = Math.min(1, Math.max(0, (index - m.pos) / Math.max(1, m.endPos - m.pos)));
      let t = m.start + frac * (m.end - m.start);
      const nextStart = marks[k + 1]?.start;
      if (nextStart !== undefined) t = Math.min(t, nextStart);
      return t;
    };

    let segs = [];
    const punct = (full.match(/[.!?。！？｡।؟…]/g) || []).length;
    if (punct < full.split(/\s+/).length / 40) {
      // auto-captions without punctuation: group about 7 seconds of cues
      let startIdx = 0;
      let startT = cues[0].start;
      cues.forEach((c, i) => {
        const isLast = i === cues.length - 1;
        if (c.end - startT >= 7 || isLast) {
          const endIdx = isLast ? full.length : cuePos[i + 1] - 1;
          segs.push({ text: full.slice(startIdx, endIdx), index: startIdx });
          if (!isLast) { startIdx = cuePos[i + 1]; startT = cues[i + 1].start; }
        }
      });
    } else {
      let sentenceSeg;
      try { sentenceSeg = new Intl.Segmenter(lang, { granularity: 'sentence' }); } catch { sentenceSeg = new Intl.Segmenter('en', { granularity: 'sentence' }); }
      for (const s of sentenceSeg.segment(full)) {
        const text = s.segment.trim();
        if (!text) continue;
        const prev = segs[segs.length - 1];
        const joinPrev =
          prev &&
          ((abbr && abbr.test(prev.text)) ||
            (pr.month && /\d\.$/.test(prev.text) && pr.month.test(text)) ||
            /^\p{Ll}/u.test(text));
        if (joinPrev) prev.text += ' ' + text;
        else segs.push({ text, index: s.index });
      }
    }

    const pieces = segs.flatMap((s) =>
      splitClauses(s.text, lang).map((p) => ({ text: p.text, index: s.index + p.offset }))
    );

    const r2 = (x) => Math.round(x * 100) / 100;
    let last = -Infinity;
    const out = pieces.map((s) => {
      let start = timeAt(s.index);
      if (start <= last) start = last + 0.01;
      last = start;
      return { start: r2(start), text: s.text };
    });
    // where each sentence is finished being spoken (never later than the next one starts)
    pieces.forEach((s, i) => {
      let end = Math.max(out[i].start + 0.4, timeAt(s.index + s.text.length));
      const next = out[i + 1];
      if (next && end > next.start) end = Math.max(out[i].start + 0.05, next.start);
      out[i].end = r2(end);
    });
    return out;
  }

  // index of the sentence that is playing at time t (-1 = before the first)
  function indexAt(ss, t) {
    let lo = 0, hi = ss.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (ss[m].start <= t + TOL) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  // key: 's' repeat, 'a' previous, 'd' next -> time to seek to
  function targetFor(key, ss, t) {
    if (!ss.length) return null;
    const cur = indexAt(ss, t);
    let i = cur;
    if (key === 's') i = Math.max(cur, 0);
    else if (key === 'a') i = Math.max(cur - 1, 0);
    else if (key === 'd') i = Math.min(cur + 1, ss.length - 1);
    return Math.max(0, ss[i].start - LEAD_IN);
  }

  return { build, indexAt, targetFor, makeCue, cuesFromJson3, clean, splitClauses, PROFILES };
})();
