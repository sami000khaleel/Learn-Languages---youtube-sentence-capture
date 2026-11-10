// Runs in the page context (MAIN world).
// 1) Reads the player's own caption responses (YouTube guards the caption files with tokens
//    that only the player's request carries, so we copy the response instead of re-downloading).
// 2) Switches the subtitle track of the language being learned on through the player API, retrying until the player
//    really delivers the file, then puts the player back the way it was.
(() => {
  const TAG = '[GST]';
  const isTT = (u) => typeof u === 'string' && u.includes('/api/timedtext');

  // the language being learned (set by the content script when it asks for the captions)
  let want = 'de';
  // main part of a language code; old / alternative codes YouTube and Google use are mapped together
  const base = (c) => {
    c = String(c || '').toLowerCase().split(/[-_]/)[0];
    return { iw: 'he', in: 'id', nb: 'no', nn: 'no', jw: 'jv' }[c] || c;
  };
  const isWanted = (t) => !!t && base(t.languageCode) === base(want);

  // ---------- read caption responses ----------
  let gotWanted = false;

  function onBody(url, body) {
    let lang = '', tlang = '';
    try {
      const u = new URL(url, location.origin);
      lang = u.searchParams.get('lang') || '';
      tlang = u.searchParams.get('tlang') || '';
    } catch {}
    if (!body || !body.trim()) { console.log(TAG, 'empty caption response', lang); return; }
    console.log(TAG, 'caption response', lang || '?', body.length, 'chars');
    if (base(lang) === base(want) && !tlang) gotWanted = true;
    window.postMessage({ source: 'gst-timedtext-body', url, body }, '*');
  }

  const origFetch = window.fetch;
  window.fetch = function (input, ...rest) {
    const p = origFetch.call(this, input, ...rest);
    try {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
      if (isTT(url)) {
        p.then((res) => res.clone().text().then((b) => onBody(url, b)).catch(() => {})).catch(() => {});
      }
    } catch {}
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = String(url);
      if (isTT(u)) {
        this.addEventListener('load', () => {
          try {
            let body = '';
            if (this.responseType === '' || this.responseType === 'text') body = this.responseText;
            else if (this.responseType === 'json') body = JSON.stringify(this.response);
            else if (this.responseType === 'arraybuffer') body = new TextDecoder().decode(this.response);
            onBody(u, body);
          } catch {}
        });
      }
    } catch {}
    return origOpen.call(this, method, url, ...rest);
  };

  // ---------- switch the track of the language being learned on ----------
  const player = () => document.getElementById('movie_player');

  let running = false;
  let runId = 0;
  let touched = false;
  let prevTrack = null;
  let wasOn = false;

  function trackList(p) {
    let list = [];
    try { list = p.getOption('captions', 'tracklist', { includeAsr: true }) || []; } catch {}
    if (!list.length) { try { list = p.getOption('captions', 'tracklist') || []; } catch {} }
    return list;
  }

  function restore() {
    if (!touched) return;
    touched = false;
    const p = player();
    if (!p) return;
    try {
      if (wasOn && prevTrack) p.setOption('captions', 'track', prevTrack);
      else {
        p.setOption('captions', 'track', {});
        if (p.unloadModule) p.unloadModule('captions');
      }
    } catch {}
  }

  function finish(ok, reason) {
    if (!running) return;
    running = false;
    runId++;
    restore();
    console.log(TAG, 'caption switch finished', ok ? 'ok' : 'failed: ' + reason);
    if (!ok) window.postMessage({ source: 'gst-captions-result', ok: false, reason }, '*');
  }

  function start() {
    if (running) { window.postMessage({ source: 'gst-captions-result', stage: 'started' }, '*'); return; }
    running = true;
    const id = ++runId;
    gotWanted = false;
    touched = false;
    let attempt = 0;
    let tries = 0;
    let lastSet = 0;
    let reason = 'no-player';
    window.postMessage({ source: 'gst-captions-result', stage: 'started' }, '*');

    const step = () => {
      if (id !== runId || !running) return;
      if (gotWanted) return finish(true);
      if (++attempt > 60) return finish(false, reason === 'ok' ? 'no-response' : reason);

      const p = player();
      if (!p || typeof p.getOption !== 'function') { reason = 'no-player'; return setTimeout(step, 1000); }
      try {
        if (p.loadModule) p.loadModule('captions');
        const list = trackList(p);
        if (!list.length) { reason = 'no-tracklist'; return setTimeout(step, 1000); }
        const de = list.find((t) => isWanted(t) && t.kind !== 'asr') || list.find(isWanted);
        if (!de) return finish(false, 'no-language');

        const cur = p.getOption('captions', 'track');
        if (!touched) {
          prevTrack = cur;
          wasOn = !!(cur && cur.languageCode);
          touched = true;
        }
        reason = 'no-response';

        if (Date.now() - lastSet > 3500) {
          lastSet = Date.now();
          // alternate between the exact track object and a minimal one
          const wanted = tries % 2 === 0 ? de : { languageCode: de.languageCode };
          console.log(TAG, 'switching track to', de.languageCode, de.kind || '', 'try', tries + 1);
          if (isWanted(cur) || tries > 0) {
            // make the player request the file again
            p.setOption('captions', 'track', {});
            setTimeout(() => { try { p.setOption('captions', 'track', wanted); } catch {} }, 300);
          } else {
            p.setOption('captions', 'track', wanted);
          }
          tries++;
        }
      } catch (e) {
        console.warn(TAG, 'player API error', e);
      }
      setTimeout(step, 1000);
    };
    step();
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const s = e.data && e.data.source;
    if (s === 'gst-enable-captions') {
      const l = e.data.lang || 'de';
      // another language than before: stop the old run and start again for the new one
      if (running && base(l) !== base(want)) finish(true);
      want = l;
      start();
    }
    else if (s === 'gst-cancel-captions') finish(true);
  });
})();
