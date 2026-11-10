// Computer voice playback for saved sentences.
// Uses the browser's built-in Speech Synthesis API.
globalThis.GSTAudio = (() => {
  const base = (c) => {
    c = String(c || '').toLowerCase().split(/[-_]/)[0];
    return { iw: 'he', in: 'id', nb: 'no', nn: 'no' }[c] || c;
  };
  const synth = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
  const voices = () => {
    const sy = synth();
    try { return (sy && sy.getVoices && sy.getVoices()) || []; } catch { return []; }
  };
  // A voice for this language: null when voices are known but none fits,
  // undefined when the browser has not loaded its voice list yet.
  function findVoice(lang) {
    const all = voices();
    if (!all.length) return undefined;
    const b = base(lang);
    const fits = all.filter((v) => base(v.lang) === b);
    if (!fits.length) return null;
    const exact = fits.find((v) => String(v.lang).toLowerCase().replace('_', '-') === String(lang).toLowerCase());
    return exact || fits.find((v) => v.localService) || fits[0];
  }
  const speechLang = (code) => ({ no: 'nb-NO' }[code] || code);

  function canSpeak() {
    return !!synth() && typeof SpeechSynthesisUtterance !== 'undefined';
  }
  // Speaks text; returns {ok} or {ok:false, reason:'unsupported'|'no-voice'}.
  function speak(text, lang, opts = {}) {
    const sy = synth();
    if (!canSpeak()) return { ok: false, reason: 'unsupported' };
    const voice = findVoice(lang);
    if (voice === null) return { ok: false, reason: 'no-voice' };
    try { sy.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = speechLang(lang);
    if (voice) u.voice = voice;
    u.rate = opts.rate || 1;
    if (opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
    sy.speak(u);
    return { ok: true };
  }
  function stopSpeaking() {
    try { const sy = synth(); if (sy) sy.cancel(); } catch {}
  }

  return { canSpeak, findVoice, speak, stopSpeaking, speechLang };
})();
